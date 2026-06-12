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
import { notifyOrderStage } from "@/lib/api";
import { nextActorNotification } from "@/components/app/orderUtils";
import { uploadToIpfs, ipfsUrlFromBytes32 } from "@/lib/ipfs";
import { getLogsChunked } from "@/lib/web3/getLogsChunked";

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
  AdvanceRequested: 1,
  AdvanceFunded: 2,
  InMilestones: 3,
  Finalized: 4,
  Disputed: 5,
  Cancelled: 6,
};

const MS_STAGE = {
  NotStarted: 0,
  Planned: 1,
  PlanApproved: 2,
  Funded: 3,
  Delivered: 4,
  InspectionApproved: 5,
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
  if (s === ORDER_STAGE.AdvanceRequested) return { label: "Advance requested", tone: "warn" };
  if (s === ORDER_STAGE.AdvanceFunded) return { label: "Advance funded", tone: "warn" };
  if (s === ORDER_STAGE.InMilestones) return { label: "In milestones", tone: "good" };
  if (s === ORDER_STAGE.Finalized) return { label: "Finalized", tone: "good" };
  if (s === ORDER_STAGE.Disputed) return { label: "Disputed", tone: "bad" };
  if (s === ORDER_STAGE.Cancelled) return { label: "Cancelled", tone: "bad" };
  return { label: `Stage ${s}`, tone: "neutral" };
}

/* DocType enum in the contract */
const DOC_TYPE_LABELS = {
  0: "Advance request",
  1: "Advance approval",
  2: "Shipment plan",
  3: "Plan approval",
  4: "Delivery confirmation",
  5: "Inspection report",
  6: "Buyer final approval",
};

function docTypeLabel(t) {
  return DOC_TYPE_LABELS[Number(t)] ?? `Doc type ${t}`;
}

function msLabel(v) {
  const s = Number(v);
  if (s === MS_STAGE.NotStarted) return "Not started";
  if (s === MS_STAGE.Planned) return "Planned";
  if (s === MS_STAGE.PlanApproved) return "Plan approved";
  if (s === MS_STAGE.Funded) return "Funded";
  if (s === MS_STAGE.Delivered) return "Delivered";
  if (s === MS_STAGE.InspectionApproved) return "Inspection approved";
  if (s === MS_STAGE.Paid) return "Paid";
  return `Stage ${s}`;
}

/* ✅ Next step & turn logic: based on chain stages (current unpaid milestone) */
function nextActionFromChain(o, milestones, me) {
  if (!o || !me) return { isMyTurn: false, title: "—", detail: "—" };

  const { isBuyer, isSeller, isCarrier, isInspector } = rolesFromOrder(o, me);
  const stage = Number(o.stage);

  if (stage === ORDER_STAGE.Created) {
    if (!o.mLocked) return { isMyTurn: false, title: "Waiting milestones lock", detail: "Configurator must lock milestones first." };
    if (isSeller) return { isMyTurn: true, title: "Request advance", detail: "Seller submits AdvanceRequest hash." };
    return { isMyTurn: false, title: "Waiting for seller", detail: "Seller must request advance." };
  }

  if (stage === ORDER_STAGE.AdvanceRequested) {
    if (isBuyer) return { isMyTurn: true, title: "Fund the advance", detail: "Buyer locks exactly the advance amount in escrow." };
    return { isMyTurn: false, title: "Waiting for buyer", detail: "Buyer must fund the advance." };
  }

  if (stage === ORDER_STAGE.AdvanceFunded) {
    if (isBuyer) return { isMyTurn: true, title: "Approve & release advance", detail: "Buyer approves; the escrowed advance is released to the seller." };
    return { isMyTurn: false, title: "Waiting for buyer", detail: "Buyer must approve & release the advance." };
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
      if (isBuyer) return { isMyTurn: true, title: `Fund milestone (MS #${cur.idx})`, detail: "Buyer locks exactly this milestone's amount in escrow." };
      return { isMyTurn: false, title: `Waiting for buyer funding (MS #${cur.idx})`, detail: "Buyer must fund this milestone." };
    }

    if (ms === MS_STAGE.Funded) {
      if (isSeller || isCarrier) return { isMyTurn: true, title: `Confirm delivery (MS #${cur.idx})`, detail: "Seller/Carrier submits delivery hash." };
      return { isMyTurn: false, title: `Waiting for delivery (MS #${cur.idx})`, detail: "Seller/Carrier must confirm delivery." };
    }

    if (ms === MS_STAGE.Delivered) {
      if (isInspector) return { isMyTurn: true, title: `Approve inspection (MS #${cur.idx})`, detail: "Inspector submits inspection report hash." };
      return { isMyTurn: false, title: `Waiting for inspector (MS #${cur.idx})`, detail: "Inspector must approve inspection." };
    }

    if (ms === MS_STAGE.InspectionApproved) {
      if (isBuyer) return { isMyTurn: true, title: `Approve & release payment (MS #${cur.idx})`, detail: "Buyer approves; the escrowed milestone amount is released to the seller." };
      return { isMyTurn: false, title: `Waiting for buyer (MS #${cur.idx})`, detail: "Buyer must approve & release milestone payment." };
    }

    return { isMyTurn: false, title: `Waiting (MS #${cur.idx})`, detail: "—" };
  }

  if (stage === ORDER_STAGE.Disputed) {
    return { isMyTurn: false, title: "Waiting for admin", detail: "The admin must resolve the dispute." };
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

/** File picker that uploads to IPFS (via the backend Pinata proxy) and hands
 *  back the bytes32 digest + CID. Used to fill the on-chain doc hash fields. */
function IpfsUploadButton({ token, disabled, onUploaded, onError }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setBusy(true);
    try {
      const res = await uploadToIpfs(file, token);
      onUploaded?.(res, file);
    } catch (err) {
      onError?.(err?.message || "IPFS upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" style={{ display: "none" }} onChange={onPick} />
      <Btn kind="ghost" icon={FileUp} disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
        {busy ? "Uploading…" : "Upload file (IPFS)"}
      </Btn>
    </>
  );
}

/* ---------------- Page ---------------- */
export default function OrderDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.orderId;

  const { account, isCorrectChain, connect, switchToTargetChain, contracts, accessToken } = useWeb3();

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const [o, setO] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [odl, setOdl] = useState(null);

  const [tokenMeta, setTokenMeta] = useState({ symbol: "", decimals: 18, name: "" });
  const [balance, setBalance] = useState(null);
  const [allowance, setAllowance] = useState(null);

  const [docHash, setDocHash] = useState("");
  const [reason, setReason] = useState("");

  // On-chain documents (DocSubmitted events) + last IPFS upload info
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [lastUpload, setLastUpload] = useState(null); // { cid, gatewayUrl, name }

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

      const [buyer, seller, carrier, inspector] = await contracts.sg.getOrderParties(idBig);
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

      let escrowed = 0n;
      if (typeof contracts.sg.getOrderEscrow === "function") {
        try {
          const esc = await contracts.sg.getOrderEscrow(idBig);
          escrowed = esc[0];
        } catch {
          escrowed = 0n;
        }
      }

      const orderObj = {
        orderId: String(orderId),
        stage: Number(stage),
        token,
        price,
        advanceBps,
        advance,
        deposited,
        escrowed,
        mLocked,
        mCount: Number(mCount),
        mPaidCount: Number(mPaidCount),
        mTotalBps,
        buyer,
        seller,
        carrier,
        inspector,
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

      let msList = [];
      if (typeof contracts.sg.getMilestone === "function") {
        for (let i = 0; i < Number(mCount); i++) {
          try {
            const m = await contracts.sg.getMilestone(idBig, i);
            msList.push({
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
      }
      setMilestones(msList);

      setMsIdx((prev) => {
        const max = Math.max(Number(mCount) - 1, 0);
        const v = Number(prev);
        if (!Number.isFinite(v)) return 0;
        return Math.min(Math.max(v, 0), max);
      });

      return { order: orderObj, milestones: msList };
    } catch (e) {
      setErr(e?.shortMessage || e?.message || "Failed to load order");
      return null;
    } finally {
      setLoading(false);
    }
  }

  // Best-effort SMS to whoever must act next after a stage change.
  // We skip notifying yourself (you just acted) to avoid noise.
  async function notifyNextActor(fresh) {
    try {
      if (!fresh?.order) return;
      const next = nextActorNotification(fresh.order, fresh.milestones);
      if (!next?.address) return;
      if (/^0x0+$/i.test(next.address)) return; // unset role
      if (me && addrEq(next.address, me)) return; // don't SMS yourself
      await notifyOrderStage(
        { walletAddress: next.address, orderstage: next.orderstage, orderId: fresh.order.orderId },
        accessToken
      );
    } catch {}
  }

  // Scan DocSubmitted events for this order and resolve each hash to an IPFS link.
  async function loadDocs() {
    if (!contracts?.sg || !orderId) return;
    setDocsLoading(true);
    try {
      const provider = contracts.sg.runner?.provider;
      if (!provider) return;
      const topics = await contracts.sg.filters.DocSubmitted(BigInt(orderId)).getTopicFilter();
      const logs = await getLogsChunked(
        provider,
        { address: WEB3_CONFIG.sgAddress, topics },
        WEB3_CONFIG.sgStartBlock,
        "latest"
      );
      const parsed = [];
      for (const log of logs) {
        try {
          const ev = contracts.sg.interface.parseLog(log);
          parsed.push({
            t: Number(ev.args.t),
            idx: Number(ev.args.idx),
            hash32: ev.args.hash32,
            by: ev.args.by,
            block: log.blockNumber,
            txHash: log.transactionHash,
            url: ipfsUrlFromBytes32(ev.args.hash32),
          });
        } catch {}
      }
      parsed.sort((a, b) => a.block - b.block);
      setDocs(parsed);
    } catch (e) {
      console.error("loadDocs failed", e);
    } finally {
      setDocsLoading(false);
    }
  }

  useEffect(() => {
    if (canRead) {
      load();
      loadDocs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, orderId]);

  const { isBuyer, isSeller, isCarrier, isInspector } = useMemo(() => rolesFromOrder(o, me), [o, me]);

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
      const fresh = await load();
      loadDocs();
      await notifyNextActor(fresh);
    } catch (e) {
      setErr(e?.shortMessage || e?.message || "Transaction failed");
    } finally {
      setBusy("");
    }
  }

  // ---------- Staged escrow funding: approve exact amount if needed, then fund ----------
  // Approves exactly `amountWei` to the contract when allowance is insufficient.
  async function approveIfNeeded(amountWei) {
    if ((allowance ?? 0n) >= amountWei) return;
    const signer = contracts.sg.runner;
    if (!signer) throw new Error("Signer not ready");
    const tokenC = new ethers.Contract(o.token, TOKEN_ABI, signer);
    const tx = await tokenC.approve(WEB3_CONFIG.sgAddress, amountWei);
    await tx.wait?.();
  }

  // Runs an optional approve, then the fund tx, then reloads.
  async function runFund(label, amountWei, fundFn) {
    setErr("");
    setBusy(label);
    try {
      if ((balance ?? 0n) < amountWei) throw new Error("Insufficient token balance for this stage.");
      await approveIfNeeded(amountWei);
      const tx = await fundFn();
      await tx.wait?.();
      const fresh = await load();
      await notifyNextActor(fresh);
    } catch (e) {
      setErr(e?.shortMessage || e?.message || "Funding failed");
    } finally {
      setBusy("");
    }
  }

  // ---------- Advance flow (staged escrow) ----------
  async function doRequestAdvance() {
    const h = toBytes32OrNull(docHash);
    if (!h) return setErr("Doc hash is required (text is ok).");
    await runTx("requestAdvance", () => contracts.sg.requestAdvance(BigInt(o.orderId), h));
  }

  async function doFundAdvance() {
    if (!o) return;
    await runFund("fundAdvance", o.advance ?? 0n, () => contracts.sg.fundAdvance(BigInt(o.orderId)));
  }

  async function doApproveAdvance() {
    const h = toBytes32OrNull(docHash);
    if (!h) return setErr("Doc hash is required (text is ok).");
    await runTx("approveAdvance", () => contracts.sg.approveAdvance(BigInt(o.orderId), h));
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

  async function doFundMilestone() {
    const i = ensureMsIdx();
    const amount = milestones.find((m) => m.idx === i)?.amount ?? 0n;
    await runFund("fundMilestone", amount, () => contracts.sg.fundMilestone(BigInt(o.orderId), i));
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

  // ---------- Action visibility ----------
  // ✅ طبق درخواست شما: وقتی نوبت نیست، اکشن‌ها اصلاً نمایش داده نشه
  const showAnyActions = !!o && isMyTurn;

  const showRequestAdvance = showAnyActions && o?.stage === ORDER_STAGE.Created && isSeller && !!o?.mLocked;
  const showFundAdvance = showAnyActions && o?.stage === ORDER_STAGE.AdvanceRequested && isBuyer;
  const showApproveAdvance = showAnyActions && o?.stage === ORDER_STAGE.AdvanceFunded && isBuyer;

  const showReject =
    showAnyActions &&
    (((o?.stage === ORDER_STAGE.AdvanceRequested || o?.stage === ORDER_STAGE.AdvanceFunded) && isBuyer) ||
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
    if (ms === MS_STAGE.PlanApproved && isBuyer) return { label: "Fund milestone", icon: Coins, needsHash: false, fn: doFundMilestone };
    if (ms === MS_STAGE.Funded && (isSeller || isCarrier)) return { label: "Confirm delivery", icon: Send, needsHash: true, fn: doConfirmDelivery };
    if (ms === MS_STAGE.Delivered && isInspector) return { label: "Approve inspection", icon: ShieldCheck, needsHash: true, fn: doApproveInspection };
    if (ms === MS_STAGE.InspectionApproved && isBuyer) return { label: "Approve & release payment", icon: Coins, needsHash: true, fn: doBuyerFinalApproval };

    return null;
  }, [o, selectedMs, showAnyActions, currentUnpaid, isSeller, isCarrier, isBuyer, isInspector]);

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
                    <div className="kv"><div className="k">Deposited (total)</div><div className="v">{fmtUnits(o.deposited, tokenMeta.decimals)} {tokenMeta.symbol}</div></div>
                    <div className="kv"><div className="k">In escrow now</div><div className="v">{fmtUnits(o.escrowed, tokenMeta.decimals)} {tokenMeta.symbol}</div></div>
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

              {/* Documents (on-chain DocSubmitted events + IPFS links) */}
              <div className="actions" style={{ marginTop: 14 }}>
                <div className="actionsHead">
                  <div className="actionsTitle">Documents</div>
                  <div className="actionsHint">
                    {docsLoading ? "Loading documents…" : `${docs.length} document(s) anchored on-chain`}
                  </div>
                </div>

                {docs.length === 0 && !docsLoading ? (
                  <div className="miniText" style={{ padding: "4px 6px" }}>
                    No documents submitted yet. Files uploaded via IPFS at each step will appear here.
                  </div>
                ) : null}

                {docs.map((d, i) => (
                  <div key={`${d.txHash}-${i}`} className="docRow">
                    <div className="docInfo">
                      <div className="docName">
                        {docTypeLabel(d.t)}
                        {d.idx !== 255 ? <span className="muted"> • Milestone #{d.idx}</span> : null}
                      </div>
                      <div className="miniText">
                        by <span className="monoInline">{shortAddr(d.by)}</span> • block {d.block}
                      </div>
                    </div>
                    <div className="docActions">
                      {d.url ? (
                        <a className="btn2 btn2--ghost" href={d.url} target="_blank" rel="noreferrer">
                          View on IPFS
                        </a>
                      ) : (
                        <span className="miniText">no file</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* ✅ Actions فقط وقتی Your turn است */}
              {showAnyActions ? (
                <div className="actions">
                  <div className="actionsHead">
                    <div className="actionsTitle">Actions</div>
                    <div className="actionsHint">Only the correct role at the correct stage can submit.</div>
                  </div>

                  {/* Buyer: Fund advance (staged escrow) */}
                  {showFundAdvance ? (
                    <div className="actionRow">
                      <div className="actionInfo">
                        <div className="actionName">Fund advance</div>
                        <div className="actionDesc">
                          Locks exactly the advance amount in escrow. Token{" "}
                          <span className="monoInline">approve</span> happens automatically if needed.
                        </div>
                      </div>

                      <div className="actionControls">
                        <Field label="Advance amount">
                          <input className="input" value={`${fmtUnits(o.advance, tokenMeta.decimals)} ${tokenMeta.symbol}`} readOnly />
                        </Field>

                        <Btn kind="primary" icon={Coins} disabled={!!busy} onClick={doFundAdvance}>
                          {busy === "fundAdvance" ? "Funding…" : "Fund advance"}
                        </Btn>
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
                        <div className="btnRow">
                          <IpfsUploadButton
                            token={accessToken}
                            disabled={!!busy}
                            onUploaded={(res, file) => { setDocHash(res.hash32); setLastUpload({ ...res, name: file.name }); setErr(""); }}
                            onError={(m) => setErr(m)}
                          />
                          <Btn kind="primary" icon={FileUp} disabled={!String(docHash).trim() || !!busy} onClick={doRequestAdvance}>
                            {busy === "requestAdvance" ? "Submitting…" : "Request advance"}
                          </Btn>
                        </div>
                        {lastUpload ? (
                          <div className="miniText">
                            Uploaded <b>{lastUpload.name}</b> → <a href={lastUpload.gatewayUrl} target="_blank" rel="noreferrer" className="monoInline">{lastUpload.cid}</a>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {/* Buyer: Approve & release advance */}
                  {showApproveAdvance ? (
                    <div className="actionRow">
                      <div className="actionInfo">
                        <div className="actionName">Approve &amp; release advance</div>
                        <div className="actionDesc">Buyer approves with a doc hash; the escrowed advance is released to the seller.</div>
                      </div>
                      <div className="actionControls">
                        <Field label="Doc hash (bytes32 یا text)">
                          <input className="input mono" value={docHash} onChange={(e) => setDocHash(e.target.value)} placeholder="0x…32bytes OR any text" />
                        </Field>
                        <div className="btnRow">
                          <IpfsUploadButton
                            token={accessToken}
                            disabled={!!busy}
                            onUploaded={(res, file) => { setDocHash(res.hash32); setLastUpload({ ...res, name: file.name }); setErr(""); }}
                            onError={(m) => setErr(m)}
                          />
                          <Btn kind="primary" icon={Coins} disabled={!String(docHash).trim() || !!busy} onClick={doApproveAdvance}>
                            {busy === "approveAdvance" ? "Releasing…" : "Approve & release"}
                          </Btn>
                        </div>
                        {lastUpload ? (
                          <div className="miniText">
                            Uploaded <b>{lastUpload.name}</b> → <a href={lastUpload.gatewayUrl} target="_blank" rel="noreferrer" className="monoInline">{lastUpload.cid}</a>
                          </div>
                        ) : null}
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

                        {milestoneAction?.needsHash ? (
                          <div className="btnRow">
                            <IpfsUploadButton
                              token={accessToken}
                              disabled={!!busy}
                              onUploaded={(res, file) => { setMsHash(res.hash32); setLastUpload({ ...res, name: file.name }); setErr(""); }}
                              onError={(m) => setErr(m)}
                            />
                            {lastUpload ? (
                              <span className="miniText">
                                Uploaded <b>{lastUpload.name}</b> → <a href={lastUpload.gatewayUrl} target="_blank" rel="noreferrer" className="monoInline">{lastUpload.cid}</a>
                              </span>
                            ) : null}
                          </div>
                        ) : null}

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

        .docRow {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 10px 12px; border-radius: 14px;
          border: 1px solid rgba(148,163,184,0.35); background: rgba(255,255,255,0.80);
        }
        .docInfo { display: grid; gap: 4px; min-width: 0; }
        .docName { font-size: 13px; font-weight: 1000; color: #0f172a; }
        .docActions { flex-shrink: 0; }
        .docActions a { text-decoration: none; }

        .mini { display: flex; align-items: center; gap: 8px; }
        .miniDot { width: 7px; height: 7px; border-radius: 999px; background: rgba(15,23,42,0.9); box-shadow: 0 0 0 3px rgba(15,23,42,0.08); }
        .miniText { font-size: 12px; color: #64748b; font-weight: 800; }

        .skeletonBig { margin-top: 18px; height: 420px; border-radius: 18px; border: 1px solid rgba(15,23,42,0.10); background: rgba(255,255,255,0.70); }
      `}</style>
    </>
  );
}
