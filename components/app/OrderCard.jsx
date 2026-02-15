"use client";

import {
  ArrowRight,
  BadgeCheck,
  AlertTriangle,
  Scale,
  Boxes,
  Users,
  Landmark,
  HandCoins,
  Shield,
  Truck,
  ClipboardCheck,
  User,
} from "lucide-react";
import { ROLE_LABELS, shortAddr, stageLabel, stageTone, fmtBigint } from "@/components/app/orderUtils";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function Badge({ tone = "gray", children }) {
  const t = {
    gray: "bg-white ring-1 ring-black/10 text-gray-800",
    green: "bg-green-50 ring-1 ring-green-200 text-green-800",
    red: "bg-red-50 ring-1 ring-red-200 text-red-800",
    blue: "bg-blue-50 ring-1 ring-blue-200 text-blue-800",
    amber: "bg-amber-50 ring-1 ring-amber-200 text-amber-900",
  };
  return (
    <span className={cx("inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold", t[tone])}>
      {children}
    </span>
  );
}

function InfoRow({ label, value, mono = false, title }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-[10px] font-medium text-gray-500">{label}</div>
      <div
        className={cx("text-[11px] font-semibold text-gray-900 text-right break-all", mono && "font-mono")}
        title={title}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}

function PartyRow({ icon, label, addr }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-[10px] font-medium text-gray-500">
        {icon}
        {label}
      </div>
      <div className="text-[11px] font-semibold text-gray-900 font-mono" title={addr}>
        {addr ? shortAddr(addr) : "—"}
      </div>
    </div>
  );
}

export default function OrderCard({ o, onOpen }) {
  const tone = stageTone(o.stage);
  const paid = Number(o.mPaidCount || 0);
  const total = Number(o.mCount || 0);
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;

  const stageIcon =
    Number(o.stage) === 6 ? <BadgeCheck className="h-4 w-4" /> :
    Number(o.stage) === 7 ? <AlertTriangle className="h-4 w-4" /> :
    <Scale className="h-4 w-4" />;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cx(
        "group w-full max-w-[420px] text-left rounded-[20px] bg-white/85 backdrop-blur",
        "ring-2 ring-black/20 border border-black/10",
        "shadow-[0_1px_0_rgba(17,24,39,0.05),0_16px_40px_rgba(17,24,39,0.10)]",
        "transition hover:ring-black/30 hover:shadow-[0_1px_0_rgba(17,24,39,0.06),0_22px_55px_rgba(17,24,39,0.14)]"
      )}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold text-gray-900">
                Order #{o.orderId}
              </div>
              <Badge tone={tone}>
                {stageIcon}
                {stageLabel(o.stage)}
              </Badge>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {o.roles?.map((r) => (
                <Badge key={r} tone="gray">
                  {ROLE_LABELS[r] ?? r}
                </Badge>
              ))}
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2 text-[11px] text-gray-600">
            <span className="rounded-full bg-white ring-1 ring-black/10 px-3 py-1 font-semibold" title={o.token}>
              Token: <span className="font-mono">{shortAddr(o.token)}</span>
            </span>
          </div>
        </div>

        {/* Summary grid */}
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <div className="rounded-2xl bg-white ring-1 ring-black/10 px-3 py-2 overflow-hidden">
            <div className="text-[10px] font-medium text-gray-500">Price</div>
            <div className="mt-0.5 text-[12px] font-semibold text-gray-900 break-all">
              {fmtBigint(o.price)}
            </div>
          </div>

          <div className="rounded-2xl bg-white ring-1 ring-black/10 px-3 py-2 overflow-hidden">
            <div className="text-[10px] font-medium text-gray-500">Deposited</div>
            <div className="mt-0.5 text-[12px] font-semibold text-gray-900 break-all">
              {fmtBigint(o.deposited)}
            </div>
          </div>

          <div className="rounded-2xl bg-white ring-1 ring-black/10 px-3 py-2 overflow-hidden">
            <div className="text-[10px] font-medium text-gray-500">Milestones</div>
            <div className="mt-0.5 flex items-center justify-between gap-3">
              <div className="text-[12px] font-semibold text-gray-900">
                {paid}/{total}
              </div>
              <div className="text-[11px] font-semibold text-gray-600">{pct}%</div>
            </div>

            <div className="mt-1.5 h-2 rounded-full bg-black/10 overflow-hidden">
              <div className="h-full rounded-full bg-black transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        {/* Full details */}
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div className="rounded-2xl bg-white ring-1 ring-black/10 px-3 py-2.5">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-gray-900">
              <Users className="h-4 w-4" />
              Participants
            </div>
            <div className="mt-2 space-y-1.5">
              <PartyRow icon={<User className="h-3.5 w-3.5" />} label="Buyer" addr={o.buyer} />
              <PartyRow icon={<User className="h-3.5 w-3.5" />} label="Seller" addr={o.seller} />
              <PartyRow icon={<Truck className="h-3.5 w-3.5" />} label="Carrier" addr={o.carrier} />
              <PartyRow icon={<ClipboardCheck className="h-3.5 w-3.5" />} label="Inspector" addr={o.inspector} />
              <PartyRow icon={<Landmark className="h-3.5 w-3.5" />} label="Bank" addr={o.bank} />
              <PartyRow icon={<Shield className="h-3.5 w-3.5" />} label="Arbiter" addr={o.arbiter} />
            </div>
          </div>

          <div className="rounded-2xl bg-white ring-1 ring-black/10 px-3 py-2.5">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-gray-900">
              <HandCoins className="h-4 w-4" />
              Financials
            </div>
            <div className="mt-2 space-y-1.5">
              <InfoRow label="Token" value={o.token ? shortAddr(o.token) : "—"} mono title={o.token} />
              <InfoRow label="Advance Bps" value={fmtBigint(o.advanceBps)} />
              <InfoRow label="Advance" value={fmtBigint(o.advance)} />
              <InfoRow label="mLocked" value={fmtBigint(o.mLocked)} />
              <InfoRow label="mPaidCount" value={fmtBigint(o.mPaidCount)} />
              <InfoRow label="mTotalBps" value={fmtBigint(o.mTotalBps)} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <Boxes className="h-4 w-4" />
            SG: <span className="font-mono" title={o.sgAddress}>{shortAddr(o.sgAddress)}</span>
          </div>

          <div className="inline-flex items-center gap-2 text-[12px] font-semibold text-gray-900">
            View
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </button>
  );
}
