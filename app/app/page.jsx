"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, RefreshCw, Search, Filter, PlusCircle } from "lucide-react";
import { useWeb3 } from "@/components/web3/Web3Provider";
import { WEB3_CONFIG } from "@/lib/web3/config";
import OrderCard from "@/components/app/OrderCard";
import { ROLE_LABELS } from "@/components/app/orderUtils";
import { ethers } from "ethers";

const GRAPH_URL = process.env.NEXT_PUBLIC_GRAPH_URL;

function lower(a) {
  return (a || "").toLowerCase();
}
function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}
function normalizeHexAddress(a) {
  return lower(a);
}

function detectRolesFromParties(parties, me) {
  const roles = [];
  if (!me) return roles;
  const m = normalizeHexAddress(me);

  if (normalizeHexAddress(parties?.buyer) === m) roles.push("buyer");
  if (normalizeHexAddress(parties?.seller) === m) roles.push("seller");
  if (normalizeHexAddress(parties?.carrier) === m) roles.push("carrier");
  if (normalizeHexAddress(parties?.inspector) === m) roles.push("inspector");

  return roles;
}

async function graphFetchMyOrders(me) {
  if (!GRAPH_URL) throw new Error("GRAPH URL not set. Add NEXT_PUBLIC_GRAPH_URL to .env.local");

  const query = `
  {
    orderParticipants(where: { participant: "${me.toLowerCase()}" }) {
      role
      order { id }
    }
  }`;

  const res = await fetch(GRAPH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json?.errors?.[0]?.message || "Graph request failed");
  if (json?.errors?.length) throw new Error(json.errors[0].message);

  const rows = json?.data?.orderParticipants ?? [];

  const byId = new Map();
  for (const r of rows) {
    const id = r?.order?.id;
    const role = r?.role;
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, new Set());
    if (role) byId.get(id).add(role);
  }

  const out = Array.from(byId.entries()).map(([orderId, roleSet]) => ({
    orderId,
    roles: Array.from(roleSet),
  }));

  out.sort((a, b) => Number(b.orderId) - Number(a.orderId));
  return out;
}

/* ---------------- UI bits ---------------- */

function Chip({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`chip ${active ? "chip--active" : ""}`}
      aria-pressed={active} // ✅ حرفه‌ای‌تر + قابل استایل‌دهی
    >
      <span className="chipIcon" aria-hidden="true">
        <Filter size={16} />
      </span>
      {children}
    </button>
  );
}

function Alert({ kind = "info", children }) {
  const cls =
    kind === "error" ? "alert alert--error" : kind === "success" ? "alert alert--success" : "alert";
  return <div className={cls}>{children}</div>;
}

function SkeletonCard() {
  return <div className="skeletonCard" />;
}

export default function AppDashboardPage() {
  const router = useRouter();
  const { account, isCorrectChain, connect, switchToTargetChain, contracts } = useWeb3();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");

  const [orders, setOrders] = useState([]);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const roleOptions = useMemo(
    () => ["all", "buyer", "seller", "carrier", "inspector"],
    []
  );

  const canRead = !!account && isCorrectChain && !!contracts?.sg;

  function resetMsg() {
    setErr("");
    setStatus("");
  }

  async function loadMyOrders() {
    resetMsg();
    setLoading(true);

    try {
      if (!account) throw new Error("Connect wallet first.");
      if (!isCorrectChain) throw new Error("Switch to target network.");
      if (!contracts?.sg) throw new Error("Web3 not ready.");
      if (!GRAPH_URL) throw new Error("Missing NEXT_PUBLIC_GRAPH_URL in .env.local");

      setStatus("Loading orders…");

      const me = ethers.getAddress(account);
      const base = await graphFetchMyOrders(me);

      if (base.length === 0) {
        setOrders([]);
        setStatus("No orders found for this wallet.");
        return;
      }

      const out = [];

      for (const row of base) {
        const id = row.orderId;

        try {
          const orderIdBig = BigInt(id);

          const [buyer, seller, carrier, inspector] =
            await contracts.sg.getOrderParties(orderIdBig);

          const stage = await contracts.sg.orderStageOf(orderIdBig);

          const [
            token,
            price,
            advanceBps,
            advance,
            deposited,
            mLocked,
            mCount,
            mPaidCount,
            mTotalBps,
          ] = await contracts.sg.getOrderMoney(orderIdBig);

          const parties = { buyer, seller, carrier, inspector };

          const rolesFromChain = detectRolesFromParties(parties, me);
          const rolesFromGraph = row.roles || [];
          const rolesFinal = uniq([...rolesFromGraph, ...rolesFromChain]);

          // For orders in the milestone phase, find the current (first unpaid)
          // milestone so "your turn / waiting" can be computed correctly.
          let nextMsIdx = null;
          let nextMsStage = null;
          const MS_PAID = 6; // MilestoneStage.Paid
          if (Number(stage) === 3 && typeof contracts.sg.getMilestone === "function") {
            for (let i = 0; i < Number(mCount); i++) {
              try {
                const m = await contracts.sg.getMilestone(orderIdBig, i);
                if (Number(m[3]) !== MS_PAID) {
                  nextMsIdx = i;
                  nextMsStage = Number(m[3]);
                  break;
                }
              } catch {}
            }
          }

          out.push({
            orderId: id,
            sgAddress: WEB3_CONFIG.sgAddress,
            stage: Number(stage),
            roles: rolesFinal,

            token,
            price,
            advanceBps,
            advance,
            deposited,
            mLocked,
            mCount,
            mPaidCount,
            mTotalBps,

            nextMsIdx,
            nextMsStage,

            buyer,
            seller,
            carrier,
            inspector,
          });
        } catch (e) {
          console.error("Reading order failed id=" + id, e);
        }
      }

      setOrders(out);
      setStatus(out.length ? `Loaded ${out.length} order(s).` : "No orders found for this wallet.");
    } catch (e) {
      console.error(e);
      setErr(e?.shortMessage || e?.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canRead) loadMyOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return orders.filter((o) => {
      const roleOk = roleFilter === "all" ? true : (o.roles || []).includes(roleFilter);
      if (!roleOk) return false;
      if (!qq) return true;
      const hay = [o.orderId, o.token, ...(o.roles || [])].join(" ").toLowerCase();
      return hay.includes(qq);
    });
  }, [orders, q, roleFilter]);

  return (
    <>
      <div className="page">
        <div className="container">
          {/* Top bar */}
          <div className="topbar">
            <div className="topbarLeft">
              <div className="kicker">SupplyGuarantee • Dashboard</div>
              <h1 className="h1">My Orders</h1>
              <p className="desc">
                Shows orders where your wallet is a participant (Buyer/Seller/Carrier/Inspector).
              </p>
            </div>

            <div className="topbarRight">
              <button type="button" onClick={() => router.push("/app/orders/new")} className="btn btn--new">
                <PlusCircle size={16} />
                New Order
              </button>

              {!account ? (
                <button onClick={connect} className="btn btn--ghost" type="button">
                  <Wallet size={16} />
                  Connect Wallet
                </button>
              ) : !isCorrectChain ? (
                <button onClick={switchToTargetChain} className="btn btn--primary" type="button">
                  Switch Network
                </button>
              ) : (
                <button
                  onClick={loadMyOrders}
                  className={`btn btn--ghost ${loading ? "btn--disabled" : ""}`}
                  type="button"
                >
                  <RefreshCw size={16} className={loading ? "spin" : ""} />
                  Refresh
                </button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="panel">
            <div className="filters">
              <div className="chips">
                {roleOptions.map((r) => (
                  <Chip key={r} active={roleFilter === r} onClick={() => setRoleFilter(r)}>
                    {r === "all" ? "All roles" : ROLE_LABELS?.[r] || r}
                  </Chip>
                ))}
              </div>

              <div className="search">
                <span className="searchIcon" aria-hidden="true">
                  <Search size={16} />
                </span>
                <input
                  className="searchInput"
                  placeholder="Search by orderId, token, role…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="alerts">
            {status ? <Alert kind="success">{status}</Alert> : null}
            {err ? <Alert kind="error">{err}</Alert> : null}
          </div>

          {/* Content */}
          <div className="content">
            {!account ? (
              <Alert>Connect your wallet to see your orders.</Alert>
            ) : !isCorrectChain ? (
              <Alert kind="error">
                Wrong network. Switch to chainId <span className="monoInline">{WEB3_CONFIG.chainId}</span>.
              </Alert>
            ) : loading ? (
              <div className="grid">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty">
                <div className="emptyTitle">No orders</div>
                <div className="emptyDesc">
                  This wallet doesn’t appear in the indexed orders (or no matching roles).
                </div>
                <div className="emptyActions">
                  <button type="button" onClick={() => router.push("/app/orders/new")} className="btn btn--new">
                    <PlusCircle size={16} />
                    Create your first order
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid">
                {filtered.map((o) => (
<OrderCard
  key={`order-${o.orderId}`}
  o={o}
  onOpen={() => router.push(`/app/orders/${o.orderId}`)}
/>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ✅ مهم: global تا حتماً روی دکمه‌های فیلتر اثر کنه */}
      <style jsx global>{`
        .page {
          min-height: 100vh;
          background:
            radial-gradient(900px 450px at 15% 0%, rgba(0,0,0,0.06), transparent 55%),
            radial-gradient(900px 450px at 90% 10%, rgba(0,0,0,0.05), transparent 55%),
            linear-gradient(to bottom, #fafafa, #ffffff);
        }

        .container {
          max-width: 1152px;
          margin: 0 auto;
          padding: 48px 24px;
        }

        .topbar {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        @media (min-width: 900px) {
          .topbar {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
        }

        .kicker {
          font-size: 13px;
          color: #64748b;
          font-weight: 800;
        }

        .h1 {
          margin-top: 6px;
          font-size: 32px;
          font-weight: 950;
          letter-spacing: -0.02em;
          color: #0f172a;
        }

        .desc {
          margin-top: 10px;
          font-size: 14px;
          color: #475569;
          max-width: 680px;
          line-height: 1.5;
        }

        .topbarRight {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
        }

        /* ---------- Buttons ---------- */
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          border-radius: 16px;
          padding: 12px 16px;
          font-size: 14px;
          font-weight: 950;
          border: 1px solid rgba(100,116,139,0.25);
          cursor: pointer;
          text-decoration: none;
          transition: transform 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
          user-select: none;
          background: #fff;
          color: #0f172a;
        }

        .btn--primary {
          background: linear-gradient(180deg, #0f172a, #0b1220);
          color: #fff;
          border-color: rgba(15,23,42,0.55);
          box-shadow: 0 14px 34px rgba(0,0,0,0.22);
        }

        .btn--ghost {
          background: rgba(255,255,255,0.85);
          box-shadow: none;
        }

        .btn--new {
          position: relative;
          overflow: hidden;
          background: linear-gradient(180deg, #0f172a 0%, #070b14 100%);
          color: #fff;
          border-color: rgba(15,23,42,0.55);
          box-shadow: 0 14px 34px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06);
        }

        .btn--new::before {
          content: "";
          position: absolute;
          inset: -2px;
          background: radial-gradient(700px 220px at 20% 10%, rgba(255,255,255,0.14), transparent 55%);
          pointer-events: none;
        }

        .btn--disabled {
          opacity: 0.6;
          pointer-events: none;
        }

        .spin { animation: spin 0.9s linear infinite; }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* ---------- Panel / filters ---------- */
        .panel {
          margin-top: 24px;
          border-radius: 18px;
          background: rgba(255,255,255,0.62);
          border: 1px solid rgba(15,23,42,0.10);
          backdrop-filter: blur(10px);
          padding: 14px;
        }

        .filters {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        @media (min-width: 900px) {
          .filters {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
          }
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        /* ---------- Chips (FIXED) ---------- */
        .chip {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 950;
          cursor: pointer;
          border: 1px solid rgba(15,23,42,0.12);
          background: rgba(255,255,255,0.90);
          color: #0f172a;
          transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
          user-select: none;
        }

        .chip:hover {
          background: #fff;
          transform: translateY(-1px);
          box-shadow: 0 10px 24px rgba(0,0,0,0.10);
        }

        /* ✅ lucide icon follows text color */
        .chipIcon { display: inline-flex; opacity: 0.95; }
        .chipIcon svg { stroke: currentColor; }

        /* ✅ Active: clearly selected */
        .chip--active,
        .chip[aria-pressed="true"] {
          position: relative;
          overflow: hidden;
          background: linear-gradient(180deg, #0f172a 0%, #070b14 100%);
          color: #fff;
          border-color: rgba(15,23,42,0.65);
          box-shadow:
            0 14px 34px rgba(0,0,0,0.22),
            0 0 0 3px rgba(15,23,42,0.08),
            inset 0 1px 0 rgba(255,255,255,0.08);
          transform: translateY(-1px);
        }

        .chip--active::before,
        .chip[aria-pressed="true"]::before {
          content: "";
          position: absolute;
          inset: -2px;
          border-radius: 999px;
          background: radial-gradient(700px 220px at 20% 10%, rgba(255,255,255,0.16), transparent 55%);
          pointer-events: none;
        }

        .chip:focus-visible {
          outline: none;
          box-shadow: 0 0 0 4px rgba(15,23,42,0.14);
        }

        /* ---------- Search ---------- */
        .search {
          position: relative;
          width: 100%;
          max-width: 360px;
        }

        .searchIcon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
          pointer-events: none;
          display: inline-flex;
        }

        .searchInput {
          width: 100%;
          border-radius: 16px;
          border: 1px solid rgba(15,23,42,0.12);
          background: #fff;
          padding: 12px 14px 12px 44px;
          font-size: 14px;
          outline: none;
          transition: box-shadow 0.15s ease, border-color 0.15s ease;
        }

        .searchInput:focus {
          border-color: rgba(15,23,42,0.28);
          box-shadow: 0 0 0 4px rgba(15,23,42,0.10);
        }

        /* ---------- Alerts / content ---------- */
        .alerts {
          margin-top: 18px;
          display: grid;
          gap: 10px;
        }

        .alert {
          border-radius: 16px;
          padding: 14px 16px;
          font-size: 14px;
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(255,255,255,0.70);
          color: #0f172a;
        }

        .alert--error {
          background: rgba(254,226,226,0.7);
          border-color: rgba(239,68,68,0.25);
          color: #7f1d1d;
        }

        .alert--success {
          background: rgba(220,252,231,0.7);
          border-color: rgba(34,197,94,0.25);
          color: #14532d;
        }

        .content { margin-top: 24px; }

        .grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 18px;
          align-items: start;
        }

        @media (min-width: 900px) {
          .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }

        .skeletonCard {
          height: 230px;
          border-radius: 18px;
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(255,255,255,0.70);
          overflow: hidden;
          position: relative;
        }

        .skeletonCard::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(0,0,0,0.06), transparent);
          transform: translateX(-60%);
          animation: shimmer 1.2s infinite;
        }

        @keyframes shimmer {
          0% { transform: translateX(-60%); }
          100% { transform: translateX(60%); }
        }

        .empty {
          border-radius: 18px;
          background: rgba(255,255,255,0.70);
          border: 1px solid rgba(15,23,42,0.10);
          padding: 22px;
        }

        .emptyTitle {
          font-size: 18px;
          font-weight: 950;
          color: #0f172a;
        }

        .emptyDesc {
          margin-top: 8px;
          font-size: 14px;
          color: #475569;
          line-height: 1.5;
        }

        .emptyActions { margin-top: 16px; }

        .monoInline {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-weight: 800;
        }
      `}</style>
    </>
  );
}
