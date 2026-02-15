"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Wallet, RefreshCw, Search, Filter, PlusCircle } from "lucide-react";
import { useWeb3 } from "@/components/web3/Web3Provider";
import { WEB3_CONFIG } from "@/lib/web3/config";
import OrderCard from "@/components/app/OrderCard";
import { ROLE_LABELS } from "@/components/app/orderUtils";
import { ethers } from "ethers";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function Chip({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
        active
          ? "bg-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
          : "bg-white/80 ring-1 ring-black/10 text-gray-900 hover:bg-white"
      )}
    >
      {children}
    </button>
  );
}

function Alert({ kind = "info", children }) {
  const styles =
    kind === "error"
      ? "bg-red-50/70 text-red-900 ring-red-200"
      : kind === "success"
      ? "bg-green-50/70 text-green-900 ring-green-200"
      : "bg-white/70 text-gray-900 ring-black/10";
  return (
    <div className={cx("rounded-2xl px-5 py-4 text-sm ring-1", styles)}>
      {children}
    </div>
  );
}

const GRAPH_URL = process.env.NEXT_PUBLIC_GRAPH_URL;

function lower(a) {
  return (a || "").toLowerCase();
}

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

function normalizeHexAddress(a) {
  // Graph ممکنه bytes رو lower برگردونه، ethers هم checksum
  // ما برای compare پایین می‌کنیم
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
  if (normalizeHexAddress(parties?.bank) === m) roles.push("bank");
  if (normalizeHexAddress(parties?.arbiter) === m) roles.push("arbiter");

  return roles;
}

async function graphFetchMyOrders(me) {
  if (!GRAPH_URL) throw new Error("GRAPH URL not set. Add NEXT_PUBLIC_GRAPH_URL to .env.local");

  // ⚠️ participant در schema Bytes هست؛ TheGraph خروجی رو به شکل 0x.. lowercase میده
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

  // group by order.id → roles[]
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

export default function AppDashboardPage() {
  const { account, isCorrectChain, connect, switchToTargetChain, contracts } = useWeb3();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");

  const [orders, setOrders] = useState([]);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const roleOptions = useMemo(
    () => ["all", "buyer", "seller", "carrier", "inspector", "bank", "arbiter"],
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

      // checksum address برای درخواست‌های onchain
      const me = ethers.getAddress(account);

      // 1) از Graph فقط orderId و roleها رو بگیر
      const base = await graphFetchMyOrders(me);

      if (base.length === 0) {
        setOrders([]);
        setStatus("No orders found for this wallet.");
        return;
      }

      // 2) از قرارداد اطلاعات کامل رو بخون + رول‌ها رو merge کن
      const out = [];

      for (const row of base) {
        const id = row.orderId;

        try {
          // ethers v6: BigInt native لازمه
          const orderIdBig = BigInt(id);

          const [buyer, seller, carrier, inspector, bank, arbiter] =
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

          const parties = { buyer, seller, carrier, inspector, bank, arbiter };

          // رول‌ها از قرارداد (بر اساس address equality)
          const rolesFromChain = detectRolesFromParties(parties, me);

          // رول‌ها از Graph (source of truth برای membership)
          const rolesFromGraph = row.roles || [];

          // merge + unique
          const rolesFinal = uniq([...rolesFromGraph, ...rolesFromChain]);

          out.push({
            orderId: id,
            sgAddress: WEB3_CONFIG.sgAddress,
            stage: Number(stage),
            roles: rolesFinal,

            // money
            token,
            price,
            advanceBps,
            advance,
            deposited,
            mLocked,
            mCount,
            mPaidCount,
            mTotalBps,

            // parties
            buyer,
            seller,
            carrier,
            inspector,
            bank,
            arbiter,
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

      // token/roles/orderId قابل سرچ
      const hay = [o.orderId, o.token, ...(o.roles || [])].join(" ").toLowerCase();
      return hay.includes(qq);
    });
  }, [orders, q, roleFilter]);

  return (
    <div className="min-h-screen bg-[radial-gradient(900px_450px_at_15%_0%,rgba(0,0,0,0.06),transparent_55%),radial-gradient(900px_450px_at_90%_10%,rgba(0,0,0,0.05),transparent_55%),linear-gradient(to_bottom,#fafafa,#ffffff)]">
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* Top bar */}
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="text-sm text-gray-500">SupplyGuarantee • Dashboard</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">My Orders</h1>
            <p className="mt-2 text-sm text-gray-600 max-w-2xl">
              Shows orders where your wallet is a participant (Buyer/Seller/Carrier/Inspector/Bank/Arbiter).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/app/orders/new"
              className="inline-flex items-center gap-2 rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)] transition hover:opacity-90 active:scale-[0.99]"
            >
              <PlusCircle className="h-4 w-4" />
              New Order
            </Link>

            {!account ? (
              <button
                onClick={connect}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-gray-900 ring-1 ring-black/10 hover:bg-gray-50 transition"
                type="button"
              >
                <Wallet className="h-4 w-4" />
                Connect Wallet
              </button>
            ) : !isCorrectChain ? (
              <button
                onClick={switchToTargetChain}
                className="inline-flex items-center gap-2 rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)] transition hover:opacity-90"
                type="button"
              >
                Switch Network
              </button>
            ) : (
              <button
                onClick={loadMyOrders}
                className={cx(
                  "inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-gray-900 ring-1 ring-black/10 hover:bg-gray-50 transition",
                  loading && "pointer-events-none opacity-60"
                )}
                type="button"
              >
                <RefreshCw className={cx("h-4 w-4", loading && "animate-spin")} />
                Refresh
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="mt-8 rounded-[22px] bg-white/60 ring-1 ring-black/10 p-4 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {roleOptions.map((r) => (
                <Chip key={r} active={roleFilter === r} onClick={() => setRoleFilter(r)}>
                  <Filter className="h-4 w-4" />
                  {r === "all" ? "All roles" : ROLE_LABELS?.[r] || r}
                </Chip>
              ))}
            </div>

            <div className="relative w-full lg:w-[360px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                className="w-full rounded-2xl bg-white px-12 py-3 text-sm outline-none ring-1 ring-black/10 focus:ring-4 focus:ring-black/10"
                placeholder="Search by orderId, token, role…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Alerts */}
        <div className="mt-6 space-y-3">
          {status ? <Alert kind="success">{status}</Alert> : null}
          {err ? <Alert kind="error">{err}</Alert> : null}
        </div>

        {/* Content */}
        <div className="mt-8">
          {!account ? (
            <Alert>Connect your wallet to see your orders.</Alert>
          ) : !isCorrectChain ? (
            <Alert kind="error">
              Wrong network. Switch to chainId{" "}
              <span className="font-mono">{WEB3_CONFIG.chainId}</span>.
            </Alert>
          ) : loading ? (
            <div className="grid gap-5 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[210px] rounded-[22px] bg-white/70 ring-1 ring-black/10 animate-pulse"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-[22px] bg-white/70 ring-1 ring-black/10 p-8">
              <div className="text-lg font-semibold text-gray-900">No orders</div>
              <div className="mt-2 text-sm text-gray-600">
                This wallet doesn’t appear in the indexed orders (or no matching roles).
              </div>
              <div className="mt-6">
                <Link
                  href="/app/orders/new"
                  className="inline-flex items-center gap-2 rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)] transition hover:opacity-90"
                >
                  <PlusCircle className="h-4 w-4" />
                  Create your first order
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {filtered.map((o) => (
                <OrderCard
                  key={`order-${o.orderId}`}
                  o={o}
                  onOpen={() => {
                    console.log("Open order", o.orderId);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
