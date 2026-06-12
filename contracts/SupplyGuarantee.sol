// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function allowance(address,address) external view returns (uint256);
    function transfer(address,uint256) external returns (bool);
    function approve(address,uint256) external returns (bool);
    function transferFrom(address,address,uint256) external returns (bool);
}

library SafeERC20Lite {
    function safeTransfer(IERC20 t, address to, uint256 v) internal {
        (bool ok, bytes memory data) = address(t).call(abi.encodeWithSelector(t.transfer.selector, to, v));
        require(ok && (data.length == 0 || abi.decode(data,(bool))), "safeTransfer failed");
    }
    function safeTransferFrom(IERC20 t, address from, address to, uint256 v) internal {
        (bool ok, bytes memory data) = address(t).call(abi.encodeWithSelector(t.transferFrom.selector, from, to, v));
        require(ok && (data.length == 0 || abi.decode(data,(bool))), "safeTransferFrom failed");
    }
}

abstract contract OwnableLite {
    address public owner;
    event OwnershipTransferred(address indexed prev, address indexed next);
    constructor(address _owner){ require(_owner!=address(0),"owner=0"); owner=_owner; emit OwnershipTransferred(address(0),_owner); }
    modifier onlyOwner(){ require(msg.sender==owner,"not owner"); _; }
    function transferOwnership(address n) external onlyOwner { require(n!=address(0),"0"); emit OwnershipTransferred(owner,n); owner=n; }
}

abstract contract PausableLite is OwnableLite {
    bool private _paused;
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    constructor(address _o) OwnableLite(_o) {}
    modifier whenNotPaused(){ require(!_paused,"paused"); _; }
    function pause() external onlyOwner { _paused=true; emit Paused(msg.sender); }
    function unpause() external onlyOwner { _paused=false; emit Unpaused(msg.sender); }
}

abstract contract ReentrancyGuardLite {
    uint256 private _status = 1;
    modifier nonReentrant(){ require(_status==1,"reentrant"); _status=2; _; _status=1; }
}



contract SupplyGuarantee is PausableLite, ReentrancyGuardLite {
    using SafeERC20Lite for IERC20;


    // Staged escrow model: the buyer never deposits the full price upfront.
    // At each stage the buyer locks exactly that stage's amount, the work
    // happens, and the locked amount is then released to the seller.
    // Bank & Arbiter roles removed; disputes/cancellation are owner-only.
    enum OrderStage { Created, AdvanceRequested, AdvanceFunded, InMilestones, Finalized, Disputed, Cancelled }

    // NotStarted -> Planned -> PlanApproved -> Funded (buyer locked the amount)
    // -> Delivered -> InspectionApproved -> Paid (released to seller).
    enum MilestoneStage { NotStarted, Planned, PlanApproved, Funded, Delivered, InspectionApproved, Paid }


    enum DocType {
        AdvanceRequest, AdvanceApproval,
        M_Plan, M_PlanApproval, M_Delivery, M_InspectionReport, M_BuyerFinalApproval
    }

    struct OrderDeadlines { uint256 advanceApprovalBy; }
    struct MilestoneDeadlines { uint256 planBy; uint256 deliveryBy; uint256 inspectionBy; uint256 buyerApprovalBy; }
    struct DocSlot { bytes32 hash32; uint64 at; address by; }

    struct Milestone {
        bytes32 name;
        uint16  bps;
        uint256 amount;
        bool    funded;
        MilestoneStage stage;
        MilestoneDeadlines dl;

        DocSlot plan;
        DocSlot planApproval;
        DocSlot delivery;
        DocSlot inspection;
        DocSlot buyerApproval;
    }

    struct Order {
        //Roles
        address buyer; address seller; address carrier; address inspector;
        //Cash
        address token;
        uint256 price;
        uint16  advanceBps;
        uint256 advance;
        uint256 deposited;   // cumulative amount the buyer has locked over the lifetime
        uint256 escrowed;    // amount currently locked in the contract (not yet released)
        //Settings
        OrderStage stage;
        bool exists;
        bool mLocked;
        bool advanceFunded;
        bool advancePaid;
        OrderDeadlines odl;
        //Milestones
        uint8  mCount;
        uint8  mPaidCount;
        uint16 mTotalBps;
        mapping(uint8 => Milestone) milestones;
        //Documents
        DocSlot advReq;
        DocSlot advApprove;
    }

    uint256 public nextOrderId = 1;
    mapping(uint256 => Order) private orders;

    event OrderCreated(uint256 indexed orderId, address indexed buyer, address indexed seller, address token, uint256 price, uint16 advanceBps);
    event OrderStageChanged(uint256 indexed orderId, OrderStage prev, OrderStage next);
    event MilestoneAdded(uint256 indexed orderId, uint8 indexed idx, bytes32 name, uint16 bps, uint256 planBy, uint256 deliveryBy, uint256 inspectionBy, uint256 buyerApprovalBy);
    event MilestonesLocked(uint256 indexed orderId, uint16 totalBps, uint256 advanceAmount);
    event MilestoneStageChanged(uint256 indexed orderId, uint8 indexed idx, MilestoneStage prev, MilestoneStage next);

    event Funded(uint256 indexed orderId, address indexed by, uint256 amount, uint256 total);
    event PaidAdvance(uint256 indexed orderId, address indexed to, uint256 amount, address indexed by);
    event PaidMilestone(uint256 indexed orderId, uint8 indexed idx, address indexed to, uint256 amount, address by);

    event DocSubmitted(uint256 indexed orderId, DocType indexed t, uint8 indexed idx, bytes32 hash32, address by);
    event Rejected(uint256 indexed orderId, string reason, address indexed by);
    event DisputeRaised(uint256 indexed orderId, string reason, address indexed by);
    event DisputeResolved(uint256 indexed orderId, OrderStage nextStage, string note, address indexed by);
    event Refunded(uint256 indexed orderId, address indexed to, uint256 amount);
    event Cancelled(uint256 indexed orderId, string note, address by);


    constructor(address initialOwner) PausableLite(initialOwner) {}


    modifier orderExists(uint256 id){ require(orders[id].exists, "order not found"); _; }
    modifier onlyBuyer(uint256 id){ require(msg.sender == orders[id].buyer, "not buyer"); _; }
    modifier onlySeller(uint256 id){ require(msg.sender == orders[id].seller, "not seller"); _; }
    modifier onlyCarrier(uint256 id){ require(msg.sender == orders[id].carrier, "not carrier"); _; }
    modifier onlyInspector(uint256 id){ require(msg.sender == orders[id].inspector, "not inspector"); _; }
    modifier onlyConfigurator(uint256 id){
        Order storage o = orders[id];
        require(msg.sender==owner || msg.sender==o.buyer || msg.sender==o.seller, "not configurator");
        _;
    }
    function _setOrderStage(uint256 id, OrderStage next) internal {
        OrderStage prev = orders[id].stage;
        orders[id].stage = next;
        emit OrderStageChanged(id, prev, next);
    }
    function _setMilestoneStage(uint256 id, uint8 idx, MilestoneStage next) internal {
        MilestoneStage prev = orders[id].milestones[idx].stage;
        orders[id].milestones[idx].stage = next;
        emit MilestoneStageChanged(id, idx, prev, next);
    }
    function _now() internal view returns(uint64){ return uint64(block.timestamp); }

    function createOrderHeader(
        address buyer, address seller, address carrier, address inspector,
        address token, uint256 price, uint16 advanceBps,
        OrderDeadlines calldata odl
    ) external whenNotPaused returns (uint256 id) {
        require(token!=address(0) && buyer!=address(0) && seller!=address(0), "zero addr");
        require(price>0, "price=0");
        require(advanceBps<=10_000, "advanceBps>10000");

        id = nextOrderId++;
        Order storage o = orders[id];
        o.buyer=buyer; o.seller=seller; o.carrier=carrier; o.inspector=inspector;
        o.token=token; o.price=price; o.advanceBps=advanceBps;
        o.advance = (price*advanceBps)/10_000;
        o.deposited=0; o.escrowed=0;
        o.stage=OrderStage.Created; o.exists=true; o.mLocked=false;
        o.advanceFunded=false; o.advancePaid=false; o.odl=odl;
        emit OrderCreated(id, buyer, seller, token, price, advanceBps);
        emit OrderStageChanged(id, OrderStage.Created, OrderStage.Created);
    }

    function addMilestone(
        uint256 id, bytes32 name, uint16 bps, MilestoneDeadlines calldata dl
    ) external whenNotPaused orderExists(id) onlyConfigurator(id) {
        Order storage o = orders[id];
        require(!o.mLocked, "locked");
        require(bps>0 && bps<=10_000, "bad bps");
        require(o.mCount < type(uint8).max, "too many");
        uint8 idx = o.mCount; o.mCount = idx+1; o.mTotalBps += bps;

        Milestone storage m = o.milestones[idx];
        m.name=name; m.bps=bps; m.amount=0; m.funded=false; m.stage=MilestoneStage.NotStarted; m.dl=dl;
        emit MilestoneAdded(id, idx, name, bps, dl.planBy, dl.deliveryBy, dl.inspectionBy, dl.buyerApprovalBy);
    }

    function lockMilestones(uint256 id) external whenNotPaused orderExists(id) onlyConfigurator(id) {
        Order storage o = orders[id];
        require(!o.mLocked, "already locked");
        require(o.mCount>0, "no milestones");
        require(o.mTotalBps + o.advanceBps == 10_000, "bps sum != 10000");
        for(uint8 i=0;i<o.mCount;i++){ o.milestones[i].amount = (o.price * o.milestones[i].bps)/10_000; }
        o.mLocked = true;
        emit MilestonesLocked(id, o.mTotalBps, o.advance);
        // No advance configured => jump straight into the milestone flow.
        if (o.advance == 0) _setOrderStage(id, OrderStage.InMilestones);
    }

    /* #####Advance (staged escrow)#### */
    function requestAdvance(uint256 id, bytes32 h) external whenNotPaused orderExists(id) onlySeller(id) {
        Order storage o = orders[id];
        require(o.stage==OrderStage.Created && o.mLocked, "bad stage");
        require(o.advance>0, "no advance");
        o.advReq = DocSlot(h,_now(),msg.sender);
        emit DocSubmitted(id, DocType.AdvanceRequest, 255, h, msg.sender);
        _setOrderStage(id, OrderStage.AdvanceRequested);
    }

    // Buyer locks exactly the advance amount into escrow.
    function fundAdvance(uint256 id) external nonReentrant whenNotPaused orderExists(id) onlyBuyer(id) {
        Order storage o = orders[id];
        require(o.stage==OrderStage.AdvanceRequested, "bad stage");
        IERC20(o.token).safeTransferFrom(msg.sender, address(this), o.advance);
        o.deposited += o.advance;
        o.escrowed  += o.advance;
        o.advanceFunded = true;
        emit Funded(id, msg.sender, o.advance, o.deposited);
        _setOrderStage(id, OrderStage.AdvanceFunded);
    }

    // Buyer approves and releases the escrowed advance to the seller.
    function approveAdvance(uint256 id, bytes32 h) external nonReentrant whenNotPaused orderExists(id) onlyBuyer(id) {
        Order storage o = orders[id];
        require(o.stage==OrderStage.AdvanceFunded, "bad stage");
        if (o.odl.advanceApprovalBy!=0) require(block.timestamp<=o.odl.advanceApprovalBy, "deadline");
        o.advApprove = DocSlot(h,_now(),msg.sender);
        emit DocSubmitted(id, DocType.AdvanceApproval, 255, h, msg.sender);

        o.advancePaid = true;
        o.escrowed -= o.advance;
        if (o.advance > 0) IERC20(o.token).safeTransfer(o.seller, o.advance);
        emit PaidAdvance(id, o.seller, o.advance, msg.sender);
        _setOrderStage(id, OrderStage.InMilestones);
    }

    /*###### Milestones (staged escrow)#### */
    function submitShipmentPlan(uint256 id, uint8 idx, bytes32 h) external whenNotPaused orderExists(id) {
        Order storage o = orders[id];
        require(o.stage==OrderStage.InMilestones, "order not in milestones");
        require(idx<o.mCount, "bad idx");
        require(msg.sender==o.seller || msg.sender==o.carrier, "not seller/carrier");

        Milestone storage m = o.milestones[idx];
        require(m.stage==MilestoneStage.NotStarted, "wrong ms stage");
        if (m.dl.planBy!=0) require(block.timestamp<=m.dl.planBy, "plan dl");
        m.plan = DocSlot(h,_now(),msg.sender);
        emit DocSubmitted(id, DocType.M_Plan, idx, h, msg.sender);
        _setMilestoneStage(id, idx, MilestoneStage.Planned);
    }

    function approveShipmentPlan(uint256 id, uint8 idx, bytes32 h) external whenNotPaused orderExists(id) onlyBuyer(id) {
        Order storage o = orders[id];
        require(o.stage==OrderStage.InMilestones,"order not in milestones");
        require(idx<o.mCount,"bad idx");
        Milestone storage m = o.milestones[idx];
        require(m.stage==MilestoneStage.Planned, "wrong ms stage");
        m.planApproval = DocSlot(h,_now(),msg.sender);
        emit DocSubmitted(id, DocType.M_PlanApproval, idx, h, msg.sender);
        _setMilestoneStage(id, idx, MilestoneStage.PlanApproved);
    }

    // Buyer locks exactly this milestone's amount into escrow before delivery.
    function fundMilestone(uint256 id, uint8 idx) external nonReentrant whenNotPaused orderExists(id) onlyBuyer(id) {
        Order storage o = orders[id];
        require(o.stage==OrderStage.InMilestones,"order not in milestones");
        require(idx<o.mCount,"bad idx");
        Milestone storage m = o.milestones[idx];
        require(m.stage==MilestoneStage.PlanApproved,"wrong ms stage");
        IERC20(o.token).safeTransferFrom(msg.sender, address(this), m.amount);
        o.deposited += m.amount;
        o.escrowed  += m.amount;
        m.funded = true;
        emit Funded(id, msg.sender, m.amount, o.deposited);
        _setMilestoneStage(id, idx, MilestoneStage.Funded);
    }

    function confirmDelivery(uint256 id, uint8 idx, bytes32 h) external whenNotPaused orderExists(id) {
        Order storage o = orders[id];
        require(o.stage==OrderStage.InMilestones,"order not in milestones");
        require(idx<o.mCount,"bad idx");
        require(msg.sender==o.seller || msg.sender==o.carrier, "not seller/carrier");
        Milestone storage m = o.milestones[idx];
        require(m.stage==MilestoneStage.Funded, "wrong ms stage");
        if (m.dl.deliveryBy!=0) require(block.timestamp<=m.dl.deliveryBy,"delivery dl");
        m.delivery = DocSlot(h,_now(),msg.sender);
        emit DocSubmitted(id, DocType.M_Delivery, idx, h, msg.sender);
        _setMilestoneStage(id, idx, MilestoneStage.Delivered);
    }

    function approveInspection(uint256 id, uint8 idx, bytes32 h) external whenNotPaused orderExists(id) onlyInspector(id) {
        Order storage o = orders[id];
        require(o.stage==OrderStage.InMilestones,"order not in milestones");
        require(idx<o.mCount,"bad idx");
        Milestone storage m = o.milestones[idx];
        require(m.stage==MilestoneStage.Delivered,"wrong ms stage");
        if (m.dl.inspectionBy!=0) require(block.timestamp<=m.dl.inspectionBy,"inspection dl");
        m.inspection = DocSlot(h,_now(),msg.sender);
        emit DocSubmitted(id, DocType.M_InspectionReport, idx, h, msg.sender);
        _setMilestoneStage(id, idx, MilestoneStage.InspectionApproved);
    }

    // Buyer's final approval releases the escrowed milestone amount to the seller.
    function approveMilestonePayment(uint256 id, uint8 idx, bytes32 h) external nonReentrant whenNotPaused orderExists(id) onlyBuyer(id) {
        Order storage o = orders[id];
        require(o.stage==OrderStage.InMilestones,"order not in milestones");
        require(idx<o.mCount,"bad idx");
        Milestone storage m = o.milestones[idx];
        require(m.stage==MilestoneStage.InspectionApproved,"wrong ms stage");
        if (m.dl.buyerApprovalBy!=0) require(block.timestamp<=m.dl.buyerApprovalBy,"buyer dl");
        m.buyerApproval = DocSlot(h,_now(),msg.sender);
        emit DocSubmitted(id, DocType.M_BuyerFinalApproval, idx, h, msg.sender);

        o.escrowed -= m.amount;
        IERC20(o.token).safeTransfer(o.seller, m.amount);
        emit PaidMilestone(id, idx, o.seller, m.amount, msg.sender);
        _setMilestoneStage(id, idx, MilestoneStage.Paid);

        o.mPaidCount += 1;
        if (o.mPaidCount == o.mCount) _setOrderStage(id, OrderStage.Finalized);
    }

    function rejectCurrent(uint256 id, string calldata reason) external whenNotPaused orderExists(id) {
        Order storage o = orders[id];
        if (o.stage==OrderStage.AdvanceRequested || o.stage==OrderStage.AdvanceFunded) require(msg.sender==o.buyer,"buyer only");
        else if (o.stage==OrderStage.InMilestones)       require(msg.sender==o.buyer || msg.sender==o.carrier || msg.sender==o.inspector, "not allowed");
        else revert("reject not allowed");
        emit Rejected(id, reason, msg.sender);
        _setOrderStage(id, OrderStage.Disputed);
        emit DisputeRaised(id, reason, msg.sender);
    }

    function resolveDisputeTo(uint256 id, OrderStage next, string calldata note) external whenNotPaused orderExists(id) onlyOwner {
        require(orders[id].stage==OrderStage.Disputed,"no dispute");
        emit DisputeResolved(id, next, note, msg.sender);
        _setOrderStage(id, next);
    }

    function cancelByAdmin(uint256 id, string calldata note) external whenNotPaused orderExists(id) onlyOwner {
        _setOrderStage(id, OrderStage.Cancelled);
        _refund(id);
        emit Cancelled(id, note, msg.sender);
    }

    // Refund whatever is still locked in escrow (funded but not yet released) to the buyer.
    function _refund(uint256 id) internal nonReentrant {
        Order storage o = orders[id];
        uint256 refundable = o.escrowed;
        if (refundable>0){
            IERC20 t = IERC20(o.token);
            uint256 bal = t.balanceOf(address(this));
            uint256 amt = bal<refundable ? bal : refundable;
            if (amt>0){
                o.escrowed -= amt;
                t.safeTransfer(o.buyer, amt);
                emit Refunded(id, o.buyer, amt);
            }
        }
    }


    function orderStageOf(uint256 id) external view orderExists(id) returns(OrderStage){ return orders[id].stage; }
    function getOrderParties(uint256 id) external view orderExists(id) returns(address,address,address,address){
        Order storage o = orders[id]; return (o.buyer,o.seller,o.carrier,o.inspector);
    }
    function getOrderMoney(uint256 id) external view orderExists(id) returns(address token,uint256 price,uint16 advanceBps,uint256 advance,uint256 deposited,bool mLocked,uint8 mCount,uint8 mPaidCount,uint16 mTotalBps){
        Order storage o = orders[id]; return (o.token,o.price,o.advanceBps,o.advance,o.deposited,o.mLocked,o.mCount,o.mPaidCount,o.mTotalBps);
    }
    function getOrderEscrow(uint256 id) external view orderExists(id) returns(uint256 escrowed, bool advanceFunded, bool advancePaid){
        Order storage o = orders[id]; return (o.escrowed, o.advanceFunded, o.advancePaid);
    }
    function getOrderDeadline(uint256 id) external view orderExists(id) returns(OrderDeadlines memory){ return orders[id].odl; }
    function getMilestone(uint256 id, uint8 idx) external view orderExists(id) returns(
        bytes32 name,uint16 bps,uint256 amount,MilestoneStage stage,MilestoneDeadlines memory dl,
        DocSlot memory plan,DocSlot memory planApproval,DocSlot memory delivery,DocSlot memory inspection,DocSlot memory buyerApproval
    ){
        Order storage o = orders[id]; require(idx<o.mCount,"bad idx");
        Milestone storage m = o.milestones[idx];
        return (m.name,m.bps,m.amount,m.stage,m.dl,m.plan,m.planApproval,m.delivery,m.inspection,m.buyerApproval);
    }
}
