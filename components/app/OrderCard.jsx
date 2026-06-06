"use client";

import React, { useMemo } from "react";
import { ArrowRight, BadgeCheck, AlertTriangle, Sparkles } from "lucide-react";
import {
  ROLE_LABELS,
  shortAddr,
  stageLabel,
  stageTone,
  nextActionForOrder,
  ORDER_STAGE,
} from "@/components/app/orderUtils";

/* ---------- helpers ---------- */
function clamp(n, min = 0, max = 100) {
  const v = Number(n) || 0;
  return Math.max(min, Math.min(max, v));
}

function bpsToPercent(bps) {
  const v = Number(bps);
  if (!Number.isFinite(v)) return "—";
  return `${(v / 100).toFixed(2)}%`;
}

function guessTokenSymbol(tokenAddr) {
  if (!tokenAddr) return "ETH";
  const a = String(tokenAddr).toLowerCase();
  if (a === "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2") return "WETH";
  return "Token";
}

/** BigInt(wei) -> human (18 decimals) without ugly zeros, no scientific notation */
function formatUnits18(valueLike) {
  if (valueLike === null || valueLike === undefined) return "";
  let v;
  try {
    v = typeof valueLike === "bigint" ? valueLike : BigInt(String(valueLike));
  } catch {
    return "";
  }

  const neg = v < 0n;
  if (neg) v = -v;

  const base = 10n ** 18n;
  const whole = v / base;
  const frac = v % base;

  // pad to 18, then trim trailing zeros
  let fracStr = frac.toString().padStart(18, "0").replace(/0+$/, "");
  const wholeStr = whole.toString();

  const out = fracStr ? `${wholeStr}.${fracStr}` : wholeStr;
  return neg ? `-${out}` : out;
}

function formatAmountHuman(amountLike) {
  const base = formatUnits18(amountLike);
  const sym = "ETH";
  return base ? `${base} ${sym}` : "—";
}

function StageIcon({ stage }) {
  const s = Number(stage);
  if (s === ORDER_STAGE.Finalized) return <BadgeCheck size={16} />;
  if (s === ORDER_STAGE.Disputed) return <AlertTriangle size={16} />;
  return null;
}

function Badge({ tone = "gray", children, className = "" }) {
  return (
    <span className={`oc-badge oc-badge--${tone} ${className}`.trim()}>
      {children}
    </span>
  );
}

/* ---------- Progress bar (pretty) ---------- */
function ProgressionBar({ stage, pct }) {
  const s = Number(stage);
  const p = clamp(pct);
  const isDone = s === ORDER_STAGE.Finalized;
  const isDispute = s === ORDER_STAGE.Disputed;

  const label = isDispute ? "Dispute" : isDone ? "Completed" : `${p}%`;

  return (
    <div className="oc-prog">
      <div className="oc-progTop">
        <div className="oc-progLabel">Progress</div>
        <div className={`oc-progValue ${isDispute ? "danger" : isDone ? "done" : ""}`}>
          {label}
        </div>
      </div>

      <div className="oc-progBar" aria-label="progress">
        <div
          className={`oc-progFill ${isDispute ? "oc-progFill--danger" : isDone ? "oc-progFill--done" : ""}`}
          style={{ width: `${isDispute ? 100 : p}%` }}
        />
        <div className="oc-progGloss" />
      </div>

      <div className="oc-progMeta">
        <span className="oc-miniDot" />
        <span className="oc-miniText">
          {isDone ? "All milestones complete" : "Milestones in progress"}
        </span>
      </div>
    </div>
  );
}

export default function OrderCard({ o, onOpen }) {
  const tone = stageTone(o.stage);
  const paid = Number(o.mPaidCount || 0);
  const total = Number(o.mCount || 0);
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;

  const action = nextActionForOrder(o);

  const tokenSym = useMemo(() => guessTokenSymbol(o.token), [o.token]);
  const priceHuman = useMemo(() => formatAmountHuman(o.price, o.token), [o.price, o.token]);
  const depositedHuman = useMemo(() => formatAmountHuman(o.deposited, o.token), [o.deposited, o.token]);
  const advanceHuman = useMemo(() => formatAmountHuman(o.advance, o.token), [o.advance, o.token]);

  const isMyTurn = !!action?.isMyTurn;

  return (
    <>
      {/* ✅ wrapper برای اینکه global css فقط همین کارت رو هدف بگیره */}
      <div className="orderCard">
        <div className="oc-cardWrap">
          <div className="oc-card">
            {/* Header */}
            <div className="oc-head">
              <div className="oc-headLeft">
                <div className="oc-titleRow">
                  <span className="oc-spark" aria-hidden="true">
                    <Sparkles size={16} />
                  </span>
                  <div className="oc-titleCol">
                    <div className="oc-title">Order #{o.orderId}</div>
                    <div className="oc-sub">
                      Token: <span className="oc-mono">{shortAddr(o.token)}</span>{" "}
                      <span className="oc-muted">•</span> {tokenSym}
                    </div>
                  </div>
                </div>

                <div className="oc-badges">
                  <Badge tone={tone}>
                    <StageIcon stage={o.stage} />
                    {stageLabel(o.stage)}
                  </Badge>

                  {(o.roles || []).slice(0, 3).map((r) => (
                    <Badge key={r} tone="gray" className="oc-roleBadge">
                      {ROLE_LABELS?.[r] ?? r}
                    </Badge>
                  ))}
                  {o.roles?.length > 3 ? (
                    <span className="oc-moreRoles">+{o.roles.length - 3} more</span>
                  ) : null}
                </div>
              </div>

              <div className="oc-headRight">
                <ProgressionBar stage={o.stage} pct={pct} />
              </div>
            </div>

            <div className="oc-divider" />

            {/* Main stats */}
            <div className="oc-stats">
              <div className="oc-stat">
                <div className="oc-statLabel">Price</div>
                <div className="oc-statValue">{priceHuman}</div>
              </div>
              <div className="oc-stat">
                <div className="oc-statLabel">Deposited</div>
                <div className="oc-statValue">{depositedHuman}</div>
              </div>
              <div className="oc-stat">
                <div className="oc-statLabel">Advance</div>
                <div className="oc-statValue">{advanceHuman}</div>
                <div className="oc-statSub">Advance rate: {bpsToPercent(o.advanceBps)}</div>
              </div>
            </div>

            {/* Next step */}
            <div className="oc-next">
              <div className="oc-nextTop">
                <div className="oc-nextTitle">Next step</div>
                <span className={`oc-turnPill ${isMyTurn ? "oc-turnPill--my" : "oc-turnPill--wait"}`}>
                  {isMyTurn ? "Your turn" : "Waiting"}
                </span>
              </div>

              <div className="oc-nextMain">{action?.title ?? "—"}</div>
              <div className="oc-nextDetail">{action?.detail ?? "—"}</div>
            </div>

            {/* Footer CTA */}
            <div className="oc-foot">
              <div className="oc-footLeft">
                <span className="oc-muted">Milestones:</span>{" "}
                <span className="oc-strong">
                  {paid}/{total}
                </span>
              </div>

              <button
                type="button"
                className="oc-cta"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen?.();
                }}
              >
                View more <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ مهم: global + scoped با wrapper */}
      <style jsx global>{`
        .orderCard .oc-cardWrap {
          width: 100%;
        }

        .orderCard .oc-card {
          background: #f5f6f8;
          border: 1px solid rgba(100, 116, 139, 0.45);
          outline: 1px solid rgba(255, 255, 255, 0.85);
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 2px 0 rgba(15, 23, 42, 0.05), 0 18px 50px rgba(15, 23, 42, 0.12);
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }

        .orderCard .oc-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 2px 0 rgba(15, 23, 42, 0.05), 0 26px 75px rgba(15, 23, 42, 0.18);
          border-color: rgba(51, 65, 85, 0.55);
        }

        .orderCard .oc-head {
          display: flex;
          gap: 14px;
          justify-content: space-between;
          padding: 14px 14px;
          background: rgba(255, 255, 255, 0.7);
          border-bottom: 1px solid rgba(148, 163, 184, 0.3);
        }

        .orderCard .oc-headLeft {
          flex: 1;
          min-width: 0;
        }

        .orderCard .oc-headRight {
          width: 280px;
          max-width: 100%;
        }

        .orderCard .oc-titleRow {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .orderCard .oc-spark {
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.06);
          border: 1px solid rgba(148, 163, 184, 0.35);
          color: #0f172a;
          flex: 0 0 auto;
        }

        /* ✅ lucide icons follow currentColor always */
        .orderCard svg {
          stroke: currentColor;
        }

        .orderCard .oc-titleCol {
          min-width: 0;
        }

        .orderCard .oc-title {
          font-size: 14px;
          font-weight: 950;
          color: #0f172a;
          line-height: 1.1;
        }

        .orderCard .oc-sub {
          margin-top: 4px;
          font-size: 11px;
          color: #334155;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 420px;
        }

        .orderCard .oc-badges {
          margin-top: 10px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .orderCard .oc-roleBadge {
          font-weight: 1000;
          letter-spacing: 0.1px;
        }

        .orderCard .oc-moreRoles {
          font-size: 11px;
          font-weight: 800;
          color: #475569;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(241, 245, 249, 0.9);
          border: 1px solid rgba(148, 163, 184, 0.35);
        }

        .orderCard .oc-divider {
          height: 1px;
          background: rgba(148, 163, 184, 0.55);
          margin: 0 14px;
        }

        /* Progression */
        .orderCard .oc-prog {
          background: rgba(255, 255, 255, 0.65);
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 14px;
          padding: 10px 10px;
        }

        .orderCard .oc-progTop {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .orderCard .oc-progLabel {
          font-size: 11px;
          font-weight: 900;
          color: #334155;
        }

        .orderCard .oc-progValue {
          font-size: 11px;
          font-weight: 1000;
          color: #0f172a;
        }

        .orderCard .oc-progValue.done {
          color: #065f46;
        }

        .orderCard .oc-progValue.danger {
          color: #9f1239;
        }

        .orderCard .oc-progBar {
          position: relative;
          margin-top: 8px;
          height: 12px;
          border-radius: 999px;
          background: rgba(226, 232, 240, 0.95);
          border: 1px solid rgba(100, 116, 139, 0.35);
          overflow: hidden;
        }

        .orderCard .oc-progFill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.45s cubic-bezier(0.2, 0.9, 0.2, 1);
          background: linear-gradient(90deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95));
          box-shadow: 0 6px 18px rgba(2, 6, 23, 0.18);
        }

        .orderCard .oc-progFill--done {
          background: linear-gradient(90deg, rgba(6, 95, 70, 0.95), rgba(16, 185, 129, 0.9));
        }

        .orderCard .oc-progFill--danger {
          background: linear-gradient(90deg, rgba(159, 18, 57, 0.95), rgba(244, 63, 94, 0.9));
        }

        .orderCard .oc-progGloss {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0));
          pointer-events: none;
        }

        .orderCard .oc-progMeta {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
        }

        .orderCard .oc-miniDot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.9);
          box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.08);
        }

        .orderCard .oc-miniText {
          font-size: 10px;
          color: #475569;
          font-weight: 850;
        }

        /* Stats */
        .orderCard .oc-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          padding: 12px 14px;
        }

        .orderCard .oc-stat {
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 14px;
          padding: 10px 10px;
          min-width: 0;
        }

        .orderCard .oc-statLabel {
          font-size: 10px;
          font-weight: 900;
          color: #64748b;
        }

        .orderCard .oc-statValue {
          margin-top: 4px;
          font-size: 13px;
          font-weight: 1000;
          color: #0f172a;
          word-break: break-word;
          line-height: 1.15;
        }

        .orderCard .oc-statSub {
          margin-top: 4px;
          font-size: 10px;
          color: #64748b;
          font-weight: 800;
        }

        /* Next */
        .orderCard .oc-next {
          margin: 0 14px 12px 14px;
          padding: 12px 12px;
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 14px;
        }

        .orderCard .oc-nextTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .orderCard .oc-nextTitle {
          font-size: 12px;
          font-weight: 950;
          color: #0f172a;
        }

        .orderCard .oc-turnPill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 7px 12px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 1000;
          letter-spacing: 0.2px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          box-shadow: 0 6px 18px rgba(2, 6, 23, 0.08);
          user-select: none;
        }

        .orderCard .oc-turnPill--my {
          color: #064e3b;
          background: linear-gradient(180deg, rgba(209, 250, 229, 0.95), rgba(167, 243, 208, 0.85));
          border-color: rgba(16, 185, 129, 0.35);
        }

        .orderCard .oc-turnPill--wait {
          color: #7c2d12;
          background: linear-gradient(180deg, rgba(254, 243, 199, 0.98), rgba(253, 230, 138, 0.9));
          border-color: rgba(245, 158, 11, 0.35);
        }

        .orderCard .oc-nextMain {
          margin-top: 8px;
          font-size: 13px;
          font-weight: 1000;
          color: #0f172a;
        }

        .orderCard .oc-nextDetail {
          margin-top: 5px;
          font-size: 11px;
          color: #334155;
          line-height: 1.35;
        }

        /* Footer */
        .orderCard .oc-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.7);
          border-top: 1px solid rgba(148, 163, 184, 0.3);
        }

        .orderCard .oc-footLeft {
          font-size: 11px;
          color: #334155;
          font-weight: 800;
        }

        .orderCard .oc-strong {
          color: #0f172a;
          font-weight: 1000;
        }

        .orderCard .oc-cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 0;
          cursor: pointer;
          padding: 10px 12px;
          border-radius: 14px;
          background: #0f172a;
          color: #fff;
          font-size: 12px;
          font-weight: 950;
          transition: transform 0.15s ease, opacity 0.15s ease;
        }

        .orderCard .oc-cta:hover {
          opacity: 0.96;
          transform: translateX(2px);
        }

        /* Badge */
        .orderCard .oc-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 950;
          border: 1px solid rgba(100, 116, 139, 0.45);
          box-shadow: 0 1px 0 rgba(15, 23, 42, 0.08);
          background: #e2e8f0;
          color: #0f172a;
          white-space: nowrap;
        }

        .orderCard .oc-badge--gray {
          background: #e2e8f0;
          color: #0f172a;
          border-color: rgba(100, 116, 139, 0.45);
        }
        .orderCard .oc-badge--green {
          background: #d1fae5;
          color: #065f46;
          border-color: #86efac;
        }
        .orderCard .oc-badge--red {
          background: #ffe4e6;
          color: #9f1239;
          border-color: #fda4af;
        }
        .orderCard .oc-badge--blue {
          background: #dbeafe;
          color: #1e40af;
          border-color: #93c5fd;
        }
        .orderCard .oc-badge--amber {
          background: #fde68a;
          color: #7c2d12;
          border-color: #fbbf24;
        }

        .orderCard .oc-mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New",
            monospace;
          font-weight: 900;
          color: #0f172a;
        }

        .orderCard .oc-muted {
          color: #64748b;
        }

        @media (max-width: 900px) {
          .orderCard .oc-head {
            flex-direction: column;
          }
          .orderCard .oc-headRight {
            width: 100%;
          }
          .orderCard .oc-stats {
            grid-template-columns: 1fr;
          }
          .orderCard .oc-sub {
            max-width: 100%;
          }
        }
      `}</style>
    </>
  );
}
