"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  Wallet,
  Copy,
  Check,
  Users,
  Coins,
  AlertTriangle,
  FileUp,
  ShieldCheck,
  Send,
  BadgeCheck,
} from "lucide-react";
import { ethers } from "ethers";
import { useWeb3 } from "@/components/web3/Web3Provider";
import { WEB3_CONFIG } from "@/lib/web3/config";

/* ---------------- Token ABI (YOUR ABI) ---------------- */
const TOKEN_ABI = [
  {
    inputs: [
      { internalType: "address", name: "", type: "address" },
      { internalType: "address", name: "", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "sp", type: "address" },
      { internalType: "uint256", name: "v", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  { inputs: [], name: "decimals", outputs: [{ internalType: "uint8", name: "", type: "uint8" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "symbol", outputs: [{ internalType: "string", name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "name", outputs: [{ internalType: "string", name: "", type: "string" }], stateMutability: "view", type: "function" },
];

/* ---------------- Contract enums (MATCH SOLIDITY) ---------------- */
const ORDER_STAGE = {
  Created: 0,
  Funded: 1,
  AdvanceRequested: 2,
  AdvanceApproved: 3,
  AdvancePaid: 4, // (unused in your contract, but kept)
  InMilestones: 5,
  Finalized: 6,
  Disputed: 7,
  Cancelled: 8,
};

const MS_STAGE = {
  NotStarted: 0,
  Planned: 1,
  PlanApproved: 2,
  Delivered: 3,
  InspectionApproved: 4,
  BuyerApproved: 5,
  Paid: 6,
};

/* ---------------- utils ---------------- */
function shortAddr(a) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function fmtUnits(v, d) {
  try {
    return ethers.formatUnits(v ?? 0n, d ?? 18);
  } catch {
    return "—";
  }
}

function fmtBps(bps) {
  const v = Number(bps);
  if (!Number.isFinite(v)) return "—";
  return `${(v / 100).toFixed(2)}%`;
}

function addrEq(a, b) {
  if (!a || !b) return false;
  try {
    return ethers.getAddress(a) === ethers.getAddress(b);
  } catch {
    return String(a).toLowerCase() === String(b).toLowerCase();
  }
}

function rolesFromOrder(o, me) {
  return {
    isBuyer: addrEq(me, o?.buyer),
    isSeller: addrEq(me, o?.seller),
    isCarrier: addrEq(me, o?.carrier),
    isInspector: addrEq(me, o?.inspector),
    isBank: addrEq(me, o?.bank),
    isArbiter: addrEq(me, o?.arbiter),
  };
}

/**
 * bytes32 input:
 * - accept exact 32-byte hex
 * - otherwise keccak(text)
 * - return null if empty
 */
function toBytes32OrNull(input) {
  const s = String(input ?? "").trim();
  if (!s) return null;
  if (ethers.isHexString(s, 32)) return s;
  return ethers.keccak256(ethers.toUtf8Bytes(s));
}

function stageBadge(stage) {
  const s = Number(stage);
  if (s === ORDER_STAGE.Created) return { label: "Created", tone: "neutral" };
  if (s === ORDER_STAGE.Funded) return { label: "Funded", tone: "good" };
  if (s === ORDER_STAGE.AdvanceRequested) return { label: "Advance requested", tone: "warn" };
  if (s === ORDER_STAGE.AdvanceApproved) return { label: "Advance approved", tone: "warn" };
  if (s === ORDER_STAGE.InMilestones) return { label: "In milestones", tone: "good" };
  if (s === ORDER_STAGE.Finalized) return { label: "Finalized", tone: "good" };
  if (s === ORDER_STAGE.Disputed) return { label: "Disputed", tone: "bad" };
  if (s === ORDER_STAGE.Cancelled) return { label: "Cancelled", tone: "bad" };
  return { label: `Stage ${s}`, tone: "neutral" };
}

function msLabel(v) {
  const s = Number(v);
  if (s === MS_STAGE.NotStarted) return "Not started";
  if (s === MS_STAGE.Planned) return "Planned";
  if (s === MS_STAGE.PlanApproved) return "Plan approved";
  if (s === MS_STAGE.Delivered) return "Delivered";
  if (s === MS_STAGE.InspectionApproved) return "Inspection approved";
  if (s === MS_STAGE.BuyerApproved) return "Buyer approved";
  if (s === MS_STAGE.Paid) return "Paid";
  return `Stage ${s}`;
}

/* ✅ Next step & turn logic: based on chain stages (current unpaid milestone) */
function nextActionFromChain(o, milestones, me) {
  if (!o || !me) return { isMyTurn: false, title: "—", detail: "—" };

  const { isBuyer, isSeller, isCarrier, isInspector, isBank, isArbiter } = rolesFromOrder(o, me);
  const stage = Number(o.stage);

  if (stage === ORDER_STAGE.Created) {
    if (!o.mLocked) return { isMyTurn: false, title: "Waiting milestones lock", detail: "Configurator must lock milestones first." };
    if (isBuyer) return { isMyTurn: true, title: "Fund the order", detail: "Approve token if needed, then fund." };
    return { isMyTurn: false, title: "Waiting for buyer funding", detail: "Buyer must fund the order." };
  }

  if (stage === ORDER_STAGE.Funded) {
    if (isSeller) return { isMyTurn: true, title: "Request advance", detail: "Seller submits AdvanceRequest hash." };
    return { isMyTurn: false, title: "Waiting for seller", detail: "Seller must request advance." };
  }

  if (stage === ORDER_STAGE.AdvanceRequested) {
    if (isBuyer) return { isMyTurn: true, title: "Approve advance", detail: "Buyer submits AdvanceApproval hash." };
    return { isMyTurn: false, title: "Waiting for buyer", detail: "Buyer must approve advance." };
  }

  if (stage === ORDER_STAGE.AdvanceApproved) {
    if (isBank) return { isMyTurn: true, title: "Bank pay advance", detail: "Bank submits payment hash & pays seller." };
    return { isMyTurn: false, title: "Waiting for bank", detail: "Bank must pay advance." };
  }

  if (stage === ORDER_STAGE.InMilestones) {
    const cur = (milestones || []).find((m) => Number(m.stage) !== MS_STAGE.Paid);
    if (!cur) return { isMyTurn: false, title: "All milestones complete", detail: "Order will be finalized automatically." };

    const ms = Number(cur.stage);

    if (ms === MS_STAGE.NotStarted) {
      if (isSeller || isCarrier) return { isMyTurn: true, title: `Submit shipment plan (MS #${cur.idx})`, detail: "Seller/Carrier submits plan hash." };
      return { isMyTurn: false, title: `Waiting for plan (MS #${cur.idx})`, detail: "Seller/Carrier must submit plan." };
    }

    if (ms === MS_STAGE.Planned) {
      if (isBuyer) return { isMyTurn: true, title: `Approve plan (MS #${cur.idx})`, detail: "Buyer submits plan approval hash." };
      return { isMyTurn: false, title: `Waiting for buyer (MS #${cur.idx})`, detail: "Buyer must approve plan." };
    }

    if (ms === MS_STAGE.PlanApproved) {
      if (isSeller || isCarrier) return { isMyTurn: true, title: `Confirm delivery (MS #${cur.idx})`, detail: "Seller/Carrier submits delivery hash." };
      return { isMyTurn: false, title: `Waiting for delivery (MS #${cur.idx})`, detail: "Seller/Carrier must confirm delivery." };
    }

    if (ms === MS_STAGE.Delivered) {
      if (isInspector) return { isMyTurn: true, title: `Approve inspection (MS #${cur.idx})`, detail: "Inspector submits inspection report hash." };
      return { isMyTurn: false, title: `Waiting for inspector (MS #${cur.idx})`, detail: "Inspector must approve inspection." };
    }

    if (ms === MS_STAGE.InspectionApproved) {
      if (isBuyer) return { isMyTurn: true, title: `Buyer final approval (MS #${cur.idx})`, detail: "Buyer approves milestone payment hash." };
      return { isMyTurn: false, title: `Waiting for buyer (MS #${cur.idx})`, detail: "Buyer must approve milestone payment." };
    }

    if (ms === MS_STAGE.BuyerApproved) {
      if (isBank) return { isMyTurn: true, title: `Bank pay milestone (MS #${cur.idx})`, detail: "Bank pays seller for this milestone." };
      return { isMyTurn: false, title: `Waiting for bank (MS #${cur.idx})`, detail: "Bank must pay milestone." };
    }

    return { isMyTurn: false, title: `Waiting (MS #${cur.idx})`, detail: "—" };
  }

  if (stage === ORDER_STAGE.Disputed) {
    if (rolesFromOrder(o, me).isArbiter) return { isMyTurn: true, title: "Resolve dispute", detail: "Arbiter/admin should resolve dispute." };
    return { isMyTurn: false, title: "Waiting arbiter/admin", detail: "Dispute pending." };
  }

  if (stage === ORDER_STAGE.Finalized) return { isMyTurn: false, title: "Finalized", detail: "All done." };
  if (stage === ORDER_STAGE.Cancelled) return { isMyTurn: false, title: "Cancelled", detail: "—" };

  return { isMyTurn: false, title: "—", detail: "—" };
}

/* ---------------- UI atoms ---------------- */
function Badge({ tone = "neutral", children }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

function CopyButton({ text }) {
  const [ok, setOk] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setOk(true);
      setTimeout(() => setOk(false), 900);
    } catch {}
  }
  return (
    <button type="button" className="iconBtn" onClick={copy} aria-label="Copy">
      {ok ? <Check size={16} /> : <Copy size={16} />}
    </button>
  );
}

function TurnPill({ isMyTurn }) {
  return <span className={`turnPill ${isMyTurn ? "turnPill--my" : "turnPill--wait"}`}>{isMyTurn ? "Your turn" : "Waiting"}</span>;
}

function Field({ label, children }) {
  return (
    <label className="field">
      <div className="fieldLabel">{label}</div>
      {children}
    </label>
  );
}

function Btn({ kind = "primary", icon: Icon, children, onClick, disabled }) {
  return (
    <button type="button" className={`btn2 btn2--${kind} ${disabled ? "btn2--disabled" : ""}`} onClick={onClick} disabled={disabled}>
      {Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
}

/* ---------------- Page ---------------- */
export default function OrderDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.orderId;

  const { account, isCorrectChain, connect, switchToTargetChain, contracts } = useWeb3();

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const [o, setO] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [odl, setOdl] = useState(null);

  const [tokenMeta, setTokenMeta] = useState({ symbol: "", decimals: 18, name: "" });
  const [balance, setBalance] = useState(null);
  const [allowance, setAllowance] = useState(null);

  const [fundAmt, setFundAmt] = useState("");
  const [docHash, setDocHash] = useState("");
  const [reason, setReason] = useState("");

  const [msIdx, setMsIdx] = useState(0);
  const [msHash, setMsHash] = useState("");

  // ✅ کلید حل مشکل: مقدار واقعی input را لحظه‌ی کلیک می‌خوانیم
  const msHashInputRef = useRef(null);

  const canRead = !!account && isCorrectChain && !!contracts?.sg;

  const me = useMemo(() => {
    try {
      return account ? ethers.getAddress(account) : null;
    } catch {
      return null;
    }
  }, [account]);

  async function load() {
    setErr("");
    setLoading(true);

    try {
      if (!orderId) throw new Error("Missing orderId");
      if (!account) throw new Error("Connect wallet first.");
      if (!isCorrectChain) throw new Error("Switch to target network.");
      if (!contracts?.sg) throw new Error("Web3 not ready.");

      const idBig = BigInt(orderId);

      const [buyer, seller, carrier, inspector, bank, arbiter] = await contracts.sg.getOrderParties(idBig);
      const stage = await contracts.sg.orderStageOf(idBig);

      const [token, price, advanceBps, advance, deposited, mLocked, mCount, mPaidCount, mTotalBps] =
        await contracts.sg.getOrderMoney(idBig);

      if (typeof contracts.sg.getOrderDeadline === "function") {
        try {
          const dl = await contracts.sg.getOrderDeadline(idBig);
          setOdl(dl);
        } catch {
          setOdl(null);
        }
      } else {
        setOdl(null);
      }

      const orderObj = {
        orderId: String(orderId),
        stage: Number(stage),
        token,
        price,
        advanceBps,
        advance,
        deposited,
        mLocked,
        mCount: Number(mCount),
        mPaidCount: Number(mPaidCount),
        mTotalBps,
        buyer,
        seller,
        carrier,
        inspector,
        bank,
        arbiter,
      };
      setO(orderObj);

      const provider = contracts.sg.runner?.provider;
      if (!provider) throw new Error("Provider not ready");

      const tokenC = new ethers.Contract(token, TOKEN_ABI, provider);

      const [sym, dec, nm, bal] = await Promise.all([
        tokenC.symbol().catch(() => ""),
        tokenC.decimals().catch(() => 18),
        tokenC.name().catch(() => ""),
        tokenC.balanceOf(me).catch(() => 0n),
      ]);

      const decimals = Number(dec) || 18;

      setTokenMeta({ symbol: sym || "", decimals, name: nm || "" });
      setBalance(bal);

      const alw = await tokenC.allowance(me, WEB3_CONFIG.sgAddress).catch(() => 0n);
      setAllowance(alw);

      if (typeof contracts.sg.getMilestone !== "function") {
        setMilestones([]);
      } else {
        const list = [];
        for (let i = 0; i < Number(mCount); i++) {
          try {
            const m = await contracts.sg.getMilestone(idBig, i);
            list.push({
              idx: i,
              name: m[0],
              bps: m[1],
              amount: m[2],
              stage: Number(m[3]),
              dl: m[4],
              plan: m[5],
              planApproval: m[6],
              delivery: m[7],
              inspection: m[8],
              buyerApproval: m[9],
            });
          } catch {}
        }
        setMilestones(list);
      }

      setMsIdx((prev) => {
        const max = Math.max(Number(mCount) - 1, 0);
        const v = Number(prev);
        if (!Number.isFinite(v)) return 0;
        return Math.min(Math.max(v, 0), max);
      });
    } catch (e) {
      setErr(e?.shortMessage || e?.message || "Failed to load order");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canRead) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, orderId]);

  const { isBuyer, isSeller, isCarrier, isInspector, isBank } = useMemo(() => rolesFromOrder(o, me), [o, me]);

  const stage = useMemo(() => stageBadge(o?.stage ?? 0), [o?.stage]);

  const next = useMemo(() => nextActionFromChain(o, milestones, me), [o, milestones, me]);
  const isMyTurn = !!next?.isMyTurn;
  const nextStep = { title: next?.title ?? "—", detail: next?.detail ?? "—" };

  // ✅ برای هم‌مسیر شدن با منطق نوبت: current unpaid milestone
  const currentUnpaid = useMemo(() => (milestones || []).find((m) => Number(m.stage) !== MS_STAGE.Paid) || null, [milestones]);

  const selectedMs = useMemo(() => milestones.find((m) => m.idx === Number(msIdx)) || null, [milestones, msIdx]);

  const paid = Number(o?.mPaidCount || 0);
  const total = Number(o?.mCount || 0);
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;

  const deadlineText = useMemo(() => {
    const t = odl?.advanceApprovalBy;
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n === 0) return null;
    return new Date(n * 1000).toLocaleString();
  }, [odl]);

  async function runTx(label, fn) {
    setErr("");
    setBusy(label);
    try {
      const tx = await fn();
      await tx.wait?.();
      await load();
    } catch (e) {
      setErr(e?.shortMessage || e?.message || "Transaction failed");
    } finally {
      setBusy("");
    }
  }

  // ---------- Buyer fund: approve + fund ----------
  const canApprove = useMemo(() => {
    if (!o || !fundAmt) return false;
    try {
      const wei = ethers.parseUnits(String(fundAmt), tokenMeta.decimals ?? 18);
      return (allowance ?? 0n) < wei;
    } catch {
      return false;
    }
  }, [o, fundAmt, tokenMeta.decimals, allowance]);

  const canFund = useMemo(() => {
    if (!o || !fundAmt) return false;
    try {
      const wei = ethers.parseUnits(String(fundAmt), tokenMeta.decimals ?? 18);
      const hasBal = (balance ?? 0n) >= wei;
      const hasAlw = (allowance ?? 0n) >= wei;
      return hasBal && hasAlw;
    } catch {
      return false;
    }
  }, [o, fundAmt, tokenMeta.decimals, balance, allowance]);

  async function doApproveForFund() {
    if (!o) return;
    const signer = contracts.sg.runner;
    if (!signer) throw new Error("Signer not ready");

    const wei = ethers.parseUnits(String(fundAmt), tokenMeta.decimals ?? 18);
    const tokenC = new ethers.Contract(o.token, TOKEN_ABI, signer);

    await runTx("approve", () => tokenC.approve(WEB3_CONFIG.sgAddress, wei));
  }

  async function doFund() {
    if (!o) return;
    const wei = ethers.parseUnits(String(fundAmt), tokenMeta.decimals ?? 18);
    await runTx("fund", () => contracts.sg.fund(BigInt(o.orderId), wei));
  }

  // ---------- Advance flow ----------
  async function doRequestAdvance() {
    const h = toBytes32OrNull(docHash);
    if (!h) return setErr("Doc hash is required (text is ok).");
    await runTx("requestAdvance", () => contracts.sg.requestAdvance(BigInt(o.orderId), h));
  }

  async function doApproveAdvance() {
    const h = toBytes32OrNull(docHash);
    if (!h) return setErr("Doc hash is required (text is ok).");
    await runTx("approveAdvance", () => contracts.sg.approveAdvance(BigInt(o.orderId), h));
  }

  async function doBankPayAdvance() {
    const h = toBytes32OrNull(docHash);
    if (!h) return setErr("Payment doc hash is required (text is ok).");
    await runTx("bankPayAdvance", () => contracts.sg.bankPayAdvance(BigInt(o.orderId), h));
  }

  // ---------- Reject ----------
  async function doReject() {
    const r = String(reason || "").trim();
    if (!r) return setErr("Reason is required.");
    await runTx("rejectCurrent", () => contracts.sg.rejectCurrent(BigInt(o.orderId), r));
  }

  function ensureMsIdx() {
    const i = Number(msIdx);
    if (!Number.isFinite(i) || i < 0 || i >= milestones.length) throw new Error("Invalid milestone idx");
    return i;
  }

  // ✅ helper: hash را از input واقعی می‌گیریم (حل قطعی مشکل IME/فارسی)
  function getMilestoneHashNow() {
    const live = msHashInputRef.current?.value ?? msHash;
    const h = toBytes32OrNull(live);
    return { live, h };
  }

  // ---------- Milestone actions ----------
  async function doSubmitPlan() {
    const i = ensureMsIdx();
    const { h } = getMilestoneHashNow();
    if (!h) return setErr("Milestone hash is required (text is ok).");
    await runTx("submitShipmentPlan", () => contracts.sg.submitShipmentPlan(BigInt(o.orderId), i, h));
  }

  async function doApprovePlan() {
    const i = ensureMsIdx();
    const { h } = getMilestoneHashNow();
    if (!h) return setErr("Milestone hash is required (text is ok).");
    await runTx("approveShipmentPlan", () => contracts.sg.approveShipmentPlan(BigInt(o.orderId), i, h));
  }

  async function doConfirmDelivery() {
    const i = ensureMsIdx();
    const { h } = getMilestoneHashNow();
    if (!h) return setErr("Milestone hash is required (text is ok).");
    await runTx("confirmDelivery", () => contracts.sg.confirmDelivery(BigInt(o.orderId), i, h));
  }

  async function doApproveInspection() {
    const i = ensureMsIdx();
    const { h } = getMilestoneHashNow();
    if (!h) return setErr("Milestone hash is required (text is ok).");
    await runTx("approveInspection", () => contracts.sg.approveInspection(BigInt(o.orderId), i, h));
  }

  async function doBuyerFinalApproval() {
    const i = ensureMsIdx();
    const { h } = getMilestoneHashNow();
    if (!h) return setErr("Milestone hash is required (text is ok).");
    await runTx("approveMilestonePayment", () => contracts.sg.approveMilestonePayment(BigInt(o.orderId), i, h));
  }

  async function doBankPayMilestone() {
    const i = ensureMsIdx();
    await runTx("bankPayMilestone", () => contracts.sg.bankPayMilestone(BigInt(o.orderId), i));
  }

  // ---------- Action visibility ----------
  // ✅ طبق درخواست شما: وقتی نوبت نیست، اکشن‌ها اصلاً نمایش داده نشه
  const showAnyActions = !!o && isMyTurn;

  const showFund = showAnyActions && o?.stage === ORDER_STAGE.Created && isBuyer && !!o?.mLocked;
  const showRequestAdvance = showAnyActions && o?.stage === ORDER_STAGE.Funded && isSeller;
  const showApproveAdvance = showAnyActions && o?.stage === ORDER_STAGE.AdvanceRequested && isBuyer;
  const showBankPayAdvance = showAnyActions && o?.stage === ORDER_STAGE.AdvanceApproved && isBank;

  const showReject =
    showAnyActions &&
    ((o?.stage === ORDER_STAGE.AdvanceRequested && isBuyer) ||
      (o?.stage === ORDER_STAGE.AdvanceApproved && isBank) ||
      (o?.stage === ORDER_STAGE.InMilestones && (isBuyer || isCarrier || isInspector)));

  const milestoneAction = useMemo(() => {
    if (!o || !selectedMs) return null;
    if (Number(o.stage) !== ORDER_STAGE.InMilestones) return null;
    if (!showAnyActions) return null;

    // ✅ فقط برای current unpaid milestone اجازه اکشن بده (هم‌راستا با nextActionFromChain)
    if (currentUnpaid && Number(selectedMs.idx) !== Number(currentUnpaid.idx)) return null;

    const ms = Number(selectedMs.stage);

    if (ms === MS_STAGE.NotStarted && (isSeller || isCarrier)) return { label: "Submit shipment plan", icon: FileUp, needsHash: true, fn: doSubmitPlan };
    if (ms === MS_STAGE.Planned && isBuyer) return { label: "Approve plan", icon: ShieldCheck, needsHash: true, fn: doApprovePlan };
    if (ms === MS_STAGE.PlanApproved && (isSeller || isCarrier)) return { label: "Confirm delivery", icon: Send, needsHash: true, fn: doConfirmDelivery };
    if (ms === MS_STAGE.Delivered && isInspector) return { label: "Approve inspection", icon: ShieldCheck, needsHash: true, fn: doApproveInspection };
    if (ms === MS_STAGE.InspectionApproved && isBuyer) return { label: "Buyer final approval", icon: ShieldCheck, needsHash: true, fn: doBuyerFinalApproval };
    if (ms === MS_STAGE.BuyerApproved && isBank) return { label: "Bank pay milestone", icon: Coins, needsHash: false, fn: doBankPayMilestone };

    return null;
  }, [o, selectedMs, showAnyActions, currentUnpaid, isSeller, isCarrier, isBuyer, isInspector, isBank]);

  // ✅ disabled milestone button: به جای state از ref هم کمک می‌گیریم
  const milestoneHashReady = useMemo(() => {
    const live = msHashInputRef.current?.value ?? msHash;
    return !!toBytes32OrNull(live);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msHash]);

  return (
    <>
      <div className="page">
        <div className="container">
          {/* Header */}
          <div className="header">
            <div className="headerLeft">
              <button type="button" className="backBtn" onClick={() => router.push("/app")}>
                <ArrowLeft size={16} /> Back
              </button>

              <div className="titleWrap">
                <div className="kicker">SupplyGuarantee • Order Details</div>
                <div className="titleRow">
                  <h1 className="h1">Order #{orderId}</h1>
                  {o ? <Badge tone={stage.tone}>{stage.label}</Badge> : null}
                </div>
                <div className="subRow">
                  <span className="monoInline">{WEB3_CONFIG.sgAddress}</span>
                  <CopyButton text={WEB3_CONFIG.sgAddress} />
                  <span className="dot" />
                  <span className="muted">Contract</span>
                </div>
              </div>
            </div>

            <div className="headerRight">
              {!account ? (
                <button onClick={connect} className="btn btn--ghost" type="button">
                  <Wallet size={16} /> Connect Wallet
                </button>
              ) : !isCorrectChain ? (
                <button onClick={switchToTargetChain} className="btn btn--primary" type="button">
                  Switch Network
                </button>
              ) : (
                <button onClick={load} className={`btn btn--ghost ${loading ? "btn--disabled" : ""}`} type="button">
                  <RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh
                </button>
              )}
            </div>
          </div>

          {/* Alerts */}
          <div className="alerts">{err ? <div className="alert alert--error">{err}</div> : null}</div>

          {/* Turn */}
          {account && isCorrectChain && o ? (
            <div className={`turn ${isMyTurn ? "turn--my" : "turn--wait"}`}>
              <div className="turnTop">
                <div className="turnTitle">Next step</div>
                <TurnPill isMyTurn={isMyTurn} />
              </div>
              <div className="turnMain">{nextStep.title}</div>
              <div className="turnDetail">{nextStep.detail}</div>
            </div>
          ) : null}

          {!account ? (
            <div className="alert">Connect wallet to see order details.</div>
          ) : !isCorrectChain ? (
            <div className="alert alert--error">
              Wrong network. Switch to chainId <span className="monoInline">{WEB3_CONFIG.chainId}</span>.
            </div>
          ) : loading && !o ? (
            <div className="skeletonBig" />
          ) : !o ? (
            <div className="alert">No data.</div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid3">
                <div className="card">
                  <div className="cardHead">
                    <div className="cardTitle">
                      <Users size={16} /> Parties
                    </div>
                  </div>
                  <div className="cardBody">
                    <div className="kv"><div className="k">Buyer</div><div className="v mono">{shortAddr(o.buyer)}</div></div>
                    <div className="kv"><div className="k">Seller</div><div className="v mono">{shortAddr(o.seller)}</div></div>
                    <div className="kv"><div className="k">Carrier</div><div className="v mono">{shortAddr(o.carrier)}</div></div>
                    <div className="kv"><div className="k">Inspector</div><div className="v mono">{shortAddr(o.inspector)}</div></div>
                    <div className="kv"><div className="k">Bank</div><div className="v mono">{shortAddr(o.bank)}</div></div>
                    <div className="kv"><div className="k">Arbiter</div><div className="v mono">{shortAddr(o.arbiter)}</div></div>
                  </div>
                </div>

                <div className="card">
                  <div className="cardHead">
                    <div className="cardTitle">
                      <Coins size={16} /> Money
                    </div>
                  </div>
                  <div className="cardBody">
                    <div className="kv"><div className="k">Token</div><div className="v mono">{shortAddr(o.token)} <span className="muted">({tokenMeta.symbol})</span></div></div>
                    <div className="kv"><div className="k">Token name</div><div className="v">{tokenMeta.name || "—"}</div></div>
                    <div className="kv"><div className="k">Decimals</div><div className="v">{String(tokenMeta.decimals)}</div></div>
                    <div className="kv"><div className="k">Price</div><div className="v">{fmtUnits(o.price, tokenMeta.decimals)} {tokenMeta.symbol}</div></div>
                    <div className="kv"><div className="k">Deposited</div><div className="v">{fmtUnits(o.deposited, tokenMeta.decimals)} {tokenMeta.symbol}</div></div>
                    <div className="kv"><div className="k">Advance</div><div className="v">{fmtUnits(o.advance, tokenMeta.decimals)} {tokenMeta.symbol} <span className="muted">({fmtBps(o.advanceBps)})</span></div></div>
                    <div className="kv"><div className="k">Milestones</div><div className="v">{paid}/{total} <span className="muted">({pct}%)</span></div></div>
                    {deadlineText ? <div className="kv"><div className="k">Advance approval deadline</div><div className="v">{deadlineText}</div></div> : null}
                  </div>
                </div>

                <div className="card">
                  <div className="cardHead">
                    <div className="cardTitle">
                      <BadgeCheck size={16} /> Wallet
                    </div>
                  </div>
                  <div className="cardBody">
                    <div className="kv"><div className="k">Balance</div><div className="v">{balance == null ? "—" : `${fmtUnits(balance, tokenMeta.decimals)} ${tokenMeta.symbol}`}</div></div>
                    <div className="kv"><div className="k">Allowance</div><div className="v">{allowance == null ? "—" : `${fmtUnits(allowance, tokenMeta.decimals)} ${tokenMeta.symbol}`}</div></div>
                    <div className="kv"><div className="k">Milestones locked</div><div className="v mono">{String(o.mLocked)}</div></div>
                  </div>
                </div>
              </div>

              {/* ✅ Actions فقط وقتی Your turn است */}
              {showAnyActions ? (
                <div className="actions">
                  <div className="actionsHead">
                    <div className="actionsTitle">Actions</div>
                    <div className="actionsHint">Only the correct role at the correct stage can submit.</div>
                  </div>

                  {/* Buyer: Fund */}
                  {showFund ? (
                    <div className="actionRow">
                      <div className="actionInfo">
                        <div className="actionName">Fund order</div>
                        <div className="actionDesc">
                          Buyer must <span className="monoInline">approve</span> token (if needed) then call{" "}
                          <span className="monoInline">fund</span>.
                        </div>
                      </div>

                      <div className="actionControls">
                        <Field label={`Amount (${tokenMeta.symbol || "TOKEN"})`}>
                          <input className="input" value={fundAmt} onChange={(e) => setFundAmt(e.target.value)} placeholder="e.g. 100" />
                        </Field>

                        <div className="btnRow">
                          <Btn kind="ghost" icon={ShieldCheck} disabled={!canApprove || !!busy} onClick={doApproveForFund}>
                            {busy === "approve" ? "Approving…" : "Approve"}
                          </Btn>

                          <Btn kind="primary" icon={Coins} disabled={!canFund || !!busy} onClick={doFund}>
                            {busy === "fund" ? "Funding…" : "Fund"}
                          </Btn>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Seller: Request advance */}
                  {showRequestAdvance ? (
                    <div className="actionRow">
                      <div className="actionInfo">
                        <div className="actionName">Request advance</div>
                        <div className="actionDesc">Seller submits doc hash to move to AdvanceRequested.</div>
                      </div>
                      <div className="actionControls">
                        <Field label="Doc hash (bytes32 یا text)">
                          <input className="input mono" value={docHash} onChange={(e) => setDocHash(e.target.value)} placeholder="0x…32bytes OR any text" />
                        </Field>
                        <Btn kind="primary" icon={FileUp} disabled={!String(docHash).trim() || !!busy} onClick={doRequestAdvance}>
                          {busy === "requestAdvance" ? "Submitting…" : "Request advance"}
                        </Btn>
                      </div>
                    </div>
                  ) : null}

                  {/* Buyer: Approve advance */}
                  {showApproveAdvance ? (
                    <div className="actionRow">
                      <div className="actionInfo">
                        <div className="actionName">Approve advance</div>
                        <div className="actionDesc">Buyer approves advance with a doc hash.</div>
                      </div>
                      <div className="actionControls">
                        <Field label="Doc hash (bytes32 یا text)">
                          <input className="input mono" value={docHash} onChange={(e) => setDocHash(e.target.value)} placeholder="0x…32bytes OR any text" />
                        </Field>
                        <Btn kind="primary" icon={ShieldCheck} disabled={!String(docHash).trim() || !!busy} onClick={doApproveAdvance}>
                          {busy === "approveAdvance" ? "Approving…" : "Approve"}
                        </Btn>
                      </div>
                    </div>
                  ) : null}

                  {/* Bank: Pay advance */}
                  {showBankPayAdvance ? (
                    <div className="actionRow">
                      <div className="actionInfo">
                        <div className="actionName">Bank pay advance</div>
                        <div className="actionDesc">Bank submits payment hash and pays seller.</div>
                      </div>
                      <div className="actionControls">
                        <Field label="Payment doc hash (bytes32 یا text)">
                          <input className="input mono" value={docHash} onChange={(e) => setDocHash(e.target.value)} placeholder="0x…32bytes OR any text" />
                        </Field>
                        <Btn kind="primary" icon={Coins} disabled={!String(docHash).trim() || !!busy} onClick={doBankPayAdvance}>
                          {busy === "bankPayAdvance" ? "Paying…" : "Pay advance"}
                        </Btn>
                      </div>
                    </div>
                  ) : null}

                  {/* Reject */}
                  {showReject ? (
                    <div className="actionRow actionRow--danger">
                      <div className="actionInfo">
                        <div className="actionName">Reject & dispute</div>
                        <div className="actionDesc">Moves order to Disputed stage.</div>
                      </div>
                      <div className="actionControls">
                        <Field label="Reason">
                          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Write reason…" />
                        </Field>
                        <Btn kind="danger" icon={AlertTriangle} disabled={!String(reason).trim() || !!busy} onClick={doReject}>
                          {busy === "rejectCurrent" ? "Submitting…" : "Reject"}
                        </Btn>
                      </div>
                    </div>
                  ) : null}

                  {/* Milestones */}
                  {Number(o.stage) === ORDER_STAGE.InMilestones ? (
                    <div className="actionRow">
                      <div className="actionInfo">
                        <div className="actionName">Milestones</div>
                        <div className="actionDesc">Select a milestone and submit the correct action for its stage.</div>
                      </div>

                      <div className="actionControls">
                        <Field label="Milestone">
                          <select className="input" value={String(msIdx)} onChange={(e) => setMsIdx(Number(e.target.value))}>
                            {milestones.map((m) => (
                              <option key={m.idx} value={m.idx}>
                                #{m.idx} • {msLabel(m.stage)}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <div className="mini">
                          <span className="miniDot" />
                          <span className="miniText">
                            Selected: #{selectedMs?.idx ?? "—"} • {selectedMs ? msLabel(selectedMs.stage) : "—"}
                            {currentUnpaid ? <> • Current unpaid: <span className="monoInline">#{currentUnpaid.idx}</span></> : null}
                          </span>
                        </div>

                        <Field label="Milestone doc hash (bytes32 یا text)">
                          <input
                            ref={msHashInputRef}
                            className="input mono"
                            value={msHash}
                            onChange={(e) => setMsHash(e.target.value)}
                            onInput={(e) => setMsHash(e.currentTarget.value)}
                            onCompositionEnd={(e) => setMsHash(e.currentTarget.value)}
                            placeholder="0x…32bytes OR any text"
                          />
                        </Field>

                        <div className="btnRow">
                          {milestoneAction ? (
                            <Btn
                              kind="primary"
                              icon={milestoneAction.icon}
                              disabled={!!busy || (milestoneAction.needsHash && !milestoneHashReady)}
                              onClick={milestoneAction.fn}
                            >
                              {busy ? "Working…" : milestoneAction.label}
                            </Btn>
                          ) : (
                            <div className="miniText">No milestone action for your role at this stage.</div>
                          )}
                        </div>

                        {milestoneAction?.needsHash ? (
                          <div className="miniText">
                            Tip: you can type any text (even Persian); it will be hashed (keccak256) before sending on-chain.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* ---------------- Styles ---------------- */}
      <style jsx global>{`
        .page {
          min-height: 100vh;
          background:
            radial-gradient(900px 450px at 15% 0%, rgba(0,0,0,0.06), transparent 55%),
            radial-gradient(900px 450px at 90% 10%, rgba(0,0,0,0.05), transparent 55%),
            linear-gradient(to bottom, #fafafa, #ffffff);
        }
        .container { max-width: 1152px; margin: 0 auto; padding: 44px 24px; }

        .header { display: flex; flex-direction: column; gap: 14px; }
        @media (min-width: 900px) { .header { flex-direction: row; align-items: center; justify-content: space-between; } }
        .headerLeft { display: flex; gap: 14px; align-items: flex-start; }
        .titleWrap { display: grid; gap: 8px; }
        .kicker { font-size: 13px; color: #64748b; font-weight: 800; }
        .titleRow { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .h1 { margin: 0; font-size: 32px; font-weight: 950; letter-spacing: -0.02em; color: #0f172a; }
        .subRow { display: inline-flex; align-items: center; gap: 8px; color: #475569; font-size: 13px; }
        .dot { width: 4px; height: 4px; border-radius: 999px; background: rgba(100,116,139,0.6); }
        .muted { color: #64748b; }

        .btn {
          display: inline-flex; align-items: center; gap: 10px;
          border-radius: 16px; padding: 12px 16px;
          font-size: 14px; font-weight: 950;
          border: 1px solid rgba(100,116,139,0.25);
          cursor: pointer; background: #fff; color: #0f172a;
        }
        .btn--primary { background: #0f172a; color: #fff; border-color: rgba(15,23,42,0.55); }
        .btn--ghost { background: rgba(255,255,255,0.85); }
        .btn--disabled { opacity: 0.6; pointer-events: none; }
        .spin { animation: spin 0.9s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .backBtn {
          display: inline-flex; align-items: center; gap: 8px;
          border-radius: 16px; padding: 10px 14px;
          background: rgba(255,255,255,0.85);
          border: 1px solid rgba(15,23,42,0.10);
          cursor: pointer; font-weight: 900;
        }

        .alerts { margin-top: 16px; display: grid; gap: 10px; }
        .alert {
          border-radius: 16px; padding: 14px 16px; font-size: 14px;
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(255,255,255,0.70);
          color: #0f172a;
        }
        .alert--error { background: rgba(254,226,226,0.7); border-color: rgba(239,68,68,0.25); color: #7f1d1d; }

        .badge { display: inline-flex; align-items: center; padding: 8px 10px; border-radius: 999px; font-size: 12px; font-weight: 950; border: 1px solid rgba(15,23,42,0.10); background: rgba(255,255,255,0.75); color: #0f172a; }
        .badge--good { background: rgba(220,252,231,0.7); border-color: rgba(34,197,94,0.25); color: #14532d; }
        .badge--warn { background: rgba(254,249,195,0.75); border-color: rgba(234,179,8,0.28); color: #713f12; }
        .badge--bad { background: rgba(254,226,226,0.7); border-color: rgba(239,68,68,0.25); color: #7f1d1d; }
        .badge--neutral { background: rgba(241,245,249,0.9); border-color: rgba(100,116,139,0.18); color: #0f172a; }

        .turn { margin-top: 14px; border-radius: 18px; border: 1px solid rgba(15,23,42,0.10); padding: 16px; }
        .turn--my { border-color: rgba(16,185,129,0.25); background: rgba(236,253,245,0.65); }
        .turn--wait { border-color: rgba(245,158,11,0.22); background: rgba(255,251,235,0.70); }
        .turnTop { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .turnTitle { font-size: 14px; font-weight: 950; color: #0f172a; }
        .turnPill { display: inline-flex; align-items: center; justify-content: center; padding: 7px 12px; border-radius: 999px; font-size: 11px; font-weight: 1000; border: 1px solid rgba(15,23,42,0.12); }
        .turnPill--my { color: #064e3b; background: rgba(209,250,229,0.95); border-color: rgba(16,185,129,0.35); }
        .turnPill--wait { color: #7c2d12; background: rgba(254,243,199,0.98); border-color: rgba(245,158,11,0.35); }
        .turnMain { margin-top: 10px; font-size: 16px; font-weight: 950; color: #0f172a; }
        .turnDetail { margin-top: 6px; font-size: 13px; font-weight: 800; color: #475569; }

        .grid3 { margin-top: 18px; display: grid; gap: 14px; grid-template-columns: 1fr; align-items: start; }
        @media (min-width: 900px) { .grid3 { grid-template-columns: repeat(3, minmax(0, 1fr)); } }

        .card { border-radius: 18px; background: rgba(255,255,255,0.66); border: 1px solid rgba(15,23,42,0.10); overflow: hidden; }
        .cardHead { padding: 14px 14px 0 14px; }
        .cardTitle { display: inline-flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 950; color: #0f172a; }
        .cardBody { padding: 14px; display: grid; gap: 10px; }

        .kv { display: grid; gap: 6px; }
        .k { font-size: 12px; color: #64748b; font-weight: 800; }
        .v { font-size: 14px; color: #0f172a; font-weight: 900; }
        .mono, .monoInline {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace;
          font-weight: 900;
        }

        .actions { margin-top: 14px; border-radius: 18px; border: 1px solid rgba(148,163,184,0.35); background: rgba(255,255,255,0.72); padding: 12px; display: grid; gap: 12px; }
        .actionsHead { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .actionsTitle { font-size: 12px; font-weight: 1000; color: #0f172a; text-transform: uppercase; letter-spacing: 0.08em; }
        .actionsHint { font-size: 12px; color: #64748b; font-weight: 800; }

        .actionRow { display: grid; gap: 12px; padding: 12px; border-radius: 14px; border: 1px solid rgba(148,163,184,0.35); background: rgba(255,255,255,0.80); }
        .actionRow--danger { border-color: rgba(239,68,68,0.25); background: rgba(254,226,226,0.35); }
        @media (min-width: 900px) { .actionRow { grid-template-columns: 1.1fr 1fr; } }
        .actionInfo { display: grid; gap: 6px; }
        .actionName { font-size: 14px; font-weight: 1000; color: #0f172a; }
        .actionDesc { font-size: 12px; font-weight: 800; color: #475569; line-height: 1.4; }
        .actionControls { display: grid; gap: 10px; }

        .field { display: grid; gap: 6px; }
        .fieldLabel { font-size: 12px; color: #64748b; font-weight: 900; }
        .input {
          width: 100%;
          border-radius: 14px;
          border: 1px solid rgba(15,23,42,0.12);
          background: #fff;
          padding: 12px 12px;
          font-size: 14px;
          outline: none;
        }

        .btnRow { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }

        .btn2 {
          display: inline-flex; align-items: center; justify-content: center;
          gap: 10px;
          border-radius: 16px;
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 1000;
          border: 1px solid rgba(100,116,139,0.25);
          cursor: pointer;
          user-select: none;
        }
        .btn2--primary { background: #0f172a; color: #fff; }
        .btn2--ghost { background: rgba(255,255,255,0.85); color: #0f172a; }
        .btn2--danger { background: #be123c; color: #fff; border-color: rgba(190,18,60,0.3); }
        .btn2--disabled, .btn2:disabled { opacity: 0.6; pointer-events: none; }

        .iconBtn { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 14px; border: 1px solid rgba(15,23,42,0.10); background: rgba(255,255,255,0.85); cursor: pointer; }

        .mini { display: flex; align-items: center; gap: 8px; }
        .miniDot { width: 7px; height: 7px; border-radius: 999px; background: rgba(15,23,42,0.9); box-shadow: 0 0 0 3px rgba(15,23,42,0.08); }
        .miniText { font-size: 12px; color: #64748b; font-weight: 800; }

        .skeletonBig { margin-top: 18px; height: 420px; border-radius: 18px; border: 1px solid rgba(15,23,42,0.10); background: rgba(255,255,255,0.70); }
      `}</style>
    </>
  );
}
