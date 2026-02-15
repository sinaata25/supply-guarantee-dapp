export const SG_ABI = [
  // read
  "function nextOrderId() view returns (uint256)",
  "function orderStageOf(uint256 id) view returns (uint8)",
  "function getOrderParties(uint256 id) view returns (address,address,address,address,address,address)",
  "function getOrderMoney(uint256 id) view returns (address token,uint256 price,uint16 advanceBps,uint256 advance,uint256 deposited,bool mLocked,uint8 mCount,uint8 mPaidCount,uint16 mTotalBps)",
  "function getMilestone(uint256 id, uint8 idx) view returns (bytes32 name,uint16 bps,uint256 amount,uint8 stage,(uint256,uint256,uint256,uint256) dl,(bytes32,uint64,address) plan,(bytes32,uint64,address) planApproval,(bytes32,uint64,address) delivery,(bytes32,uint64,address) inspection,(bytes32,uint64,address) buyerApproval)",

  // write (نمونه‌ها؛ کامل‌ترش می‌کنیم)
  "function createOrderHeader(address buyer,address seller,address carrier,address inspector,address bank,address arbiter,address token,uint256 price,uint16 advanceBps,(uint256) odl) returns (uint256)",
  "function addMilestone(uint256 id,bytes32 name,uint16 bps,(uint256,uint256,uint256,uint256) dl)",
  "function lockMilestones(uint256 id)",
  "function fund(uint256 id,uint256 amt)",
  "function requestAdvance(uint256 id,bytes32 h)",
  "function approveAdvance(uint256 id,bytes32 h)",
  "function bankPayAdvance(uint256 id,bytes32 h)",
  "function submitShipmentPlan(uint256 id,uint8 idx,bytes32 h)",
  "function approveShipmentPlan(uint256 id,uint8 idx,bytes32 h)",
  "function confirmDelivery(uint256 id,uint8 idx,bytes32 h)",
  "function approveInspection(uint256 id,uint8 idx,bytes32 h)",
  "function approveMilestonePayment(uint256 id,uint8 idx,bytes32 h)",
  "function bankPayMilestone(uint256 id,uint8 idx)",
  "function rejectCurrent(uint256 id,string reason)",
  "function resolveDisputeTo(uint256 id,uint8 next,string note)",
  "function cancelByArbiter(uint256 id,string note)",

  // events (برای بعداً)
  "event OrderCreated(uint256 indexed orderId,address indexed buyer,address indexed seller,address token,uint256 price,uint16 advanceBps)",
  "event OrderStageChanged(uint256 indexed orderId,uint8 prev,uint8 next)",
  "event MilestoneStageChanged(uint256 indexed orderId,uint8 indexed idx,uint8 prev,uint8 next)",
  "event Funded(uint256 indexed orderId,address indexed by,uint256 amount,uint256 total)",
  "event PaidAdvance(uint256 indexed orderId,address indexed to,uint256 amount,address indexed byBank)",
  "event PaidMilestone(uint256 indexed orderId,uint8 indexed idx,address indexed to,uint256 amount,address byBank)",
];

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)",
  "function transferFrom(address,address,uint256) returns (bool)",
];
