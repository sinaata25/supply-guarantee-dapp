"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * How It Works page (Next.js App Router)
 * - English
 * - CSS-in-component (no Tailwind)
 * - Beautiful, structured flow UI
 */

const FLOW = [
  {
    key: "create",
    title: "Create an Order",
    kicker: "Setup",
    desc: "Define parties (buyer, seller, bank, inspector, carrier, arbiter), choose token & price, and configure the advance + milestones.",
    bullets: [
      "Set the participants and responsibilities",
      "Choose ERC-20 token and total price",
      "Split payments into advance + milestones (100%)",
    ],
    tag: "Order: Created",
  },
  {
    key: "lock",
    title: "Lock Milestones",
    kicker: "Safety",
    desc: "Once milestones are locked, the percentages are fixed. This reduces mid-process ambiguity and keeps payment rules consistent.",
    bullets: [
      "Milestone bps + advance bps must equal 10,000",
      "Amounts are calculated from total price",
      "Prevents changing milestone terms later",
    ],
    tag: "Milestones: Locked",
  },
  {
    key: "fund",
    title: "Buyer Funds Escrow",
    kicker: "Funding",
    desc: "Buyer deposits tokens into the contract. When the deposited amount reaches the order price, the order becomes funded.",
    bullets: [
      "Funds are held in the contract",
      "Funding can be done in one or multiple transfers",
      "Order becomes Funded at full amount",
    ],
    tag: "Order: Funded",
  },
  {
    key: "advance",
    title: "Advance Payment (Optional)",
    kicker: "Advance",
    desc: "Seller requests an advance with a document hash. Buyer approves. Bank executes the advance payment to seller.",
    bullets: [
      "Seller submits advance request hash",
      "Buyer approves (deadline optional)",
      "Bank pays advance to seller",
    ],
    tag: "Stage: In Milestones",
  },
  {
    key: "milestones",
    title: "Milestone Workflow",
    kicker: "Delivery",
    desc: "For each milestone: plan → plan approval → delivery → inspection → buyer approval → bank pays. Repeat until all milestones are paid.",
    bullets: [
      "Seller/Carrier submits plan & delivery hashes",
      "Inspector approves inspection report hash",
      "Buyer gives final approval for payout",
    ],
    tag: "Milestones: Paid",
  },
  {
    key: "finalize",
    title: "Finalize",
    kicker: "Close",
    desc: "When all milestones are paid, the order is finalized. If disputes occur, arbiter/admin can resolve or cancel and trigger refunds.",
    bullets: [
      "Finalized after last milestone payout",
      "Disputes can be raised via rejection",
      "Arbiter/Admin can cancel & refund remaining",
    ],
    tag: "Order: Finalized",
  },
];

const ROLES = [
  {
    title: "Buyer",
    desc: "Funds escrow, approves advance, approves milestone payments after inspection.",
    chips: ["Fund", "Approve", "Confirm"],
  },
  {
    title: "Seller",
    desc: "Requests advance, submits shipment plans and delivery proofs.",
    chips: ["Request", "Submit docs"],
  },
  {
    title: "Bank",
    desc: "Executes advance and milestone payments to seller.",
    chips: ["Pay advance", "Pay milestones"],
  },
  {
    title: "Inspector",
    desc: "Approves inspection reports prior to buyer payment approval.",
    chips: ["Inspect", "Approve report"],
  },
  {
    title: "Carrier",
    desc: "Can submit shipment plan and confirm delivery documents (if assigned).",
    chips: ["Plan", "Deliver"],
  },
  {
    title: "Arbiter / Admin",
    desc: "Resolves disputes, can cancel and trigger refunds of remaining funds.",
    chips: ["Resolve", "Cancel", "Refund"],
  },
];

export default function HowItWorksPage() {
  const [active, setActive] = useState(0);

  const progress = useMemo(() => {
    if (FLOW.length <= 1) return 0;
    return Math.round((active / (FLOW.length - 1)) * 100);
  }, [active]);

  const current = FLOW[active];

  return (
    <div className="hiw-page">
      <style>{css}</style>

      <div className="hiw-container">
        {/* HERO */}
        <section className="hiw-hero">
          <div className="hiw-hero-left">
            <div className="hiw-kicker">How it works</div>
            <h1 className="hiw-title">A clear flow from funding to final settlement.</h1>
            <p className="hiw-subtitle">
              SupplyGuarantee orchestrates trade settlements through role-based approvals,
              document hashing, and milestone payouts. Here’s the process end-to-end.
            </p>

            <div className="hiw-cta">
              <Link className="hiw-btn hiw-btn-primary" href="/app">
                Go to Dashboard
              </Link>
              <a className="hiw-btn" href="#flow">
                View the Flow
              </a>
            </div>

            <div className="hiw-metrics">
              <Metric label="Document integrity" value="Hash on-chain" />
              <Metric label="Payout control" value="Bank executes" />
              <Metric label="Disputes" value="Arbiter/Admin" />
            </div>
          </div>

          <div className="hiw-hero-right">
            <div className="hiw-hero-card">
              <div className="hiw-hero-card-title">At a glance</div>
              <div className="hiw-pill-row">
                <Pill>Created</Pill>
                <Pill>Funded</Pill>
                <Pill>Advance</Pill>
                <Pill>Milestones</Pill>
                <Pill>Finalized</Pill>
              </div>

              <div className="hiw-mini-flow">
                <MiniNode label="Buyer funds" />
                <MiniArrow />
                <MiniNode label="Docs hashed" />
                <MiniArrow />
                <MiniNode label="Approvals" />
                <MiniArrow />
                <MiniNode label="Bank pays" />
              </div>

              <div className="hiw-note">
                Tip: the UI can mirror these stages exactly via on-chain events.
              </div>
            </div>
          </div>
        </section>

        {/* FLOW */}
        <section className="hiw-section" id="flow">
          <div className="hiw-section-head">
            <div>
              <h2 className="hiw-h2">The settlement flow</h2>
              <p className="hiw-p">
                Click each step to understand responsibilities, documents, and outcomes.
              </p>
            </div>

            <div className="hiw-progress">
              <div className="hiw-progress-top">
                <span className="hiw-progress-label">Progress</span>
                <span className="hiw-progress-value">{progress}%</span>
              </div>
              <div className="hiw-bar">
                <div className="hiw-bar-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          <div className="hiw-flow">
            {/* Stepper */}
            <div className="hiw-stepper" role="tablist" aria-label="How it works steps">
              {FLOW.map((s, idx) => (
                <button
                  key={s.key}
                  className={`hiw-step ${idx === active ? "active" : ""}`}
                  onClick={() => setActive(idx)}
                  role="tab"
                  aria-selected={idx === active}
                >
                  <div className="hiw-step-left">
                    <div className={`hiw-step-dot ${idx <= active ? "done" : ""}`} />
                    {idx < FLOW.length - 1 ? <div className={`hiw-step-line ${idx < active ? "done" : ""}`} /> : null}
                  </div>
                  <div className="hiw-step-right">
                    <div className="hiw-step-kicker">{s.kicker}</div>
                    <div className="hiw-step-title">{s.title}</div>
                    <div className="hiw-step-tag">{s.tag}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Detail */}
            <div className="hiw-detail" role="tabpanel" aria-label="Selected step details">
              <div className="hiw-detail-card">
                <div className="hiw-detail-top">
                  <div>
                    <div className="hiw-detail-kicker">{current.kicker}</div>
                    <div className="hiw-detail-title">{current.title}</div>
                    <div className="hiw-detail-desc">{current.desc}</div>
                  </div>
                  <div className="hiw-detail-badge">{current.tag}</div>
                </div>

                <div className="hiw-detail-grid">
                  <div className="hiw-detail-box">
                    <div className="hiw-detail-box-title">What happens</div>
                    <ul className="hiw-list">
                      {current.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="hiw-detail-box">
                    <div className="hiw-detail-box-title">Typical documents (hashed)</div>
                    <div className="hiw-docs">
                      <DocChip>Shipment plan</DocChip>
                      <DocChip>Delivery proof</DocChip>
                      <DocChip>Inspection report</DocChip>
                      <DocChip>Buyer approval</DocChip>
                      <DocChip>Advance request</DocChip>
                    </div>
                    <div className="hiw-note small">
                      Your app stores files off-chain; the contract stores hashes + timestamps.
                    </div>
                  </div>
                </div>

                <div className="hiw-detail-actions">
                  <button
                    className="hiw-btn"
                    onClick={() => setActive((v) => Math.max(0, v - 1))}
                    disabled={active === 0}
                  >
                    Previous
                  </button>
                  <button
                    className="hiw-btn hiw-btn-primary"
                    onClick={() => setActive((v) => Math.min(FLOW.length - 1, v + 1))}
                    disabled={active === FLOW.length - 1}
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="hiw-side-card">
                <div className="hiw-side-title">State machine (simplified)</div>
                <div className="hiw-state">
                  <StateRow left="Created" right="Funded" />
                  <StateRow left="Funded" right="Advance Requested" />
                  <StateRow left="Advance Approved" right="In Milestones" />
                  <StateRow left="In Milestones" right="Finalized" />
                  <div className="hiw-state-note">
                    Rejections can move an order into <b>Disputed</b>, then resolved by Arbiter/Admin.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ROLES */}
        <section className="hiw-section">
          <h2 className="hiw-h2">Roles & responsibilities</h2>
          <p className="hiw-p">
            Settlement safety comes from distributing authority across roles. Each role has clear
            permissions in the flow.
          </p>

          <div className="hiw-roles">
            {ROLES.map((r) => (
              <div className="hiw-role" key={r.title}>
                <div className="hiw-role-title">{r.title}</div>
                <div className="hiw-role-desc">{r.desc}</div>
                <div className="hiw-role-chips">
                  {r.chips.map((c) => (
                    <span key={c} className="hiw-chip">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="hiw-section" id="faq">
          <h2 className="hiw-h2">FAQ</h2>
          <div className="hiw-faq">
            <Accordion
              q="Do you store documents on-chain?"
              a="No. The contract stores hashes (bytes32) + metadata. The actual files are stored by your application."
            />
            <Accordion
              q="Why does the bank execute payments?"
              a="This design supports real-world settlement workflows where a bank (or a controlled payment role) releases funds after required approvals."
            />
            <Accordion
              q="What happens if parties disagree?"
              a="A rejection can transition the order into Disputed, where an Arbiter/Admin can resolve the next stage or cancel and refund remaining funds."
            />
          </div>
        </section>

        <div className="hiw-spacer" />
      </div>
    </div>
  );
}

/* ---------- Small UI components (outside main to avoid remount focus issues) ---------- */

function Metric({ label, value }) {
  return (
    <div className="hiw-metric">
      <div className="hiw-metric-value">{value}</div>
      <div className="hiw-metric-label">{label}</div>
    </div>
  );
}

function Pill({ children }) {
  return <span className="hiw-pill">{children}</span>;
}

function DocChip({ children }) {
  return <span className="hiw-doc">{children}</span>;
}

function MiniNode({ label }) {
  return <div className="hiw-mini-node">{label}</div>;
}

function MiniArrow() {
  return (
    <div className="hiw-mini-arrow" aria-hidden="true">
      <span />
    </div>
  );
}

function StateRow({ left, right }) {
  return (
    <div className="hiw-state-row">
      <span className="hiw-state-pill">{left}</span>
      <span className="hiw-state-arrow">→</span>
      <span className="hiw-state-pill">{right}</span>
    </div>
  );
}

function Accordion({ q, a }) {
  return (
    <details className="hiw-acc">
      <summary className="hiw-acc-q">{q}</summary>
      <div className="hiw-acc-a">{a}</div>
    </details>
  );
}

const css = `
.hiw-page{
  background: radial-gradient(1000px 600px at 15% 0%, rgba(17,24,39,.06), transparent 55%),
              radial-gradient(900px 520px at 95% 10%, rgba(0,0,0,.05), transparent 55%),
              #fbfbfd;
  min-height: calc(100vh - 64px);
  padding: 28px 16px 64px;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
  color: #111827;
}

.hiw-container{
  max-width: 1120px;
  margin: 0 auto;
}

.hiw-hero{
  display:grid;
  grid-template-columns: 1.15fr .85fr;
  gap: 16px;
  align-items: stretch;
  margin-bottom: 26px;
}

.hiw-kicker{
  font-size: 12px;
  font-weight: 900;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: #6b7280;
}

.hiw-title{
  margin: 10px 0 0;
  font-size: 40px;
  line-height: 1.08;
  font-weight: 950;
  letter-spacing: -.02em;
}

.hiw-subtitle{
  margin-top: 12px;
  font-size: 14px;
  line-height: 1.9;
  color: #374151;
  max-width: 72ch;
}

.hiw-cta{
  display:flex;
  gap: 10px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.hiw-btn{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border: 1px solid #e5e7eb;
  background: rgba(255,255,255,.9);
  color: #111827;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
  transition: transform .12s ease, background .12s ease, opacity .12s ease;
}

.hiw-btn:hover{ background: #fff; transform: translateY(-1px); }
.hiw-btn:disabled{ opacity: .55; cursor: not-allowed; transform:none; }

.hiw-btn-primary{
  background:#111827;
  border-color:#111827;
  color:#fff;
}
.hiw-btn-primary:hover{ opacity:.92; background:#111827; }

.hiw-metrics{
  display:flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.hiw-metric{
  background: rgba(255,255,255,.9);
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 10px 12px;
  min-width: 180px;
  box-shadow: 0 14px 30px rgba(0,0,0,.05);
}

.hiw-metric-value{
  font-size: 13px;
  font-weight: 950;
}

.hiw-metric-label{
  margin-top: 4px;
  font-size: 12px;
  color:#6b7280;
  font-weight: 700;
}

.hiw-hero-card{
  background: rgba(255,255,255,.9);
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  box-shadow: 0 16px 34px rgba(0,0,0,.06);
  padding: 14px;
  height: 100%;
}

.hiw-hero-card-title{
  font-weight: 950;
  font-size: 13px;
  margin-bottom: 10px;
}

.hiw-pill-row{
  display:flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.hiw-pill{
  font-size: 12px;
  font-weight: 800;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background:#fff;
  color:#374151;
}

.hiw-mini-flow{
  display:flex;
  align-items:center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px;
  border: 1px solid #eef0f3;
  border-radius: 16px;
  background: linear-gradient(180deg, #fbfbfd, #fff);
}

.hiw-mini-node{
  padding: 8px 10px;
  border-radius: 14px;
  background:#111827;
  color:#fff;
  font-weight: 850;
  font-size: 12px;
}

.hiw-mini-arrow{
  width: 28px;
  height: 10px;
  display:flex;
  align-items:center;
  justify-content:center;
}
.hiw-mini-arrow span{
  width: 100%;
  height: 2px;
  background:#cbd5e1;
  position: relative;
}
.hiw-mini-arrow span::after{
  content:"";
  position:absolute;
  right: -2px;
  top: -3px;
  border-left: 7px solid #cbd5e1;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
}

.hiw-note{
  margin-top: 10px;
  font-size: 12px;
  color:#6b7280;
  line-height: 1.7;
}
.hiw-note.small{ margin-top: 10px; }

.hiw-section{ margin-top: 26px; }

.hiw-section-head{
  display:flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.hiw-h2{
  margin: 0;
  font-size: 18px;
  font-weight: 950;
}

.hiw-p{
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.9;
  color:#374151;
  max-width: 90ch;
}

.hiw-progress{
  min-width: 240px;
  background: rgba(255,255,255,.9);
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 10px 12px;
  box-shadow: 0 14px 30px rgba(0,0,0,.05);
}

.hiw-progress-top{
  display:flex;
  justify-content: space-between;
  align-items:center;
}

.hiw-progress-label{ font-size: 12px; color:#6b7280; font-weight: 800; }
.hiw-progress-value{ font-size: 12px; color:#111827; font-weight: 950; }

.hiw-bar{
  margin-top: 8px;
  height: 10px;
  border-radius: 999px;
  background: #eef0f3;
  overflow:hidden;
}
.hiw-bar-fill{
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #111827, #6b7280);
  transition: width .22s ease;
}

.hiw-flow{
  margin-top: 14px;
  display:grid;
  grid-template-columns: 360px 1fr;
  gap: 12px;
  align-items: start;
}

.hiw-stepper{
  background: rgba(255,255,255,.9);
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  box-shadow: 0 16px 34px rgba(0,0,0,.06);
  padding: 10px;
}

.hiw-step{
  width: 100%;
  text-align:left;
  display:flex;
  gap: 10px;
  padding: 10px;
  border-radius: 16px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  transition: background .12s ease, transform .12s ease, border-color .12s ease;
}

.hiw-step:hover{
  background: #fff;
  border-color: #eef0f3;
  transform: translateY(-1px);
}

.hiw-step.active{
  background: #111827;
  border-color: #111827;
}
.hiw-step.active .hiw-step-title,
.hiw-step.active .hiw-step-kicker,
.hiw-step.active .hiw-step-tag{ color:#fff; }
.hiw-step.active .hiw-step-tag{ opacity:.85; }

.hiw-step-left{
  width: 22px;
  display:flex;
  flex-direction: column;
  align-items:center;
  padding-top: 3px;
}

.hiw-step-dot{
  width: 12px;
  height: 12px;
  border-radius: 999px;
  border: 2px solid #cbd5e1;
  background: #fff;
}
.hiw-step-dot.done{
  border-color: #111827;
  background:#111827;
}

.hiw-step-line{
  width: 2px;
  flex: 1;
  margin-top: 6px;
  background:#e5e7eb;
  border-radius: 999px;
}
.hiw-step-line.done{ background:#111827; opacity:.7; }

.hiw-step-right{ flex: 1; }

.hiw-step-kicker{
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
  color:#6b7280;
}

.hiw-step-title{
  margin-top: 4px;
  font-size: 13px;
  font-weight: 950;
  color:#111827;
}

.hiw-step-tag{
  margin-top: 6px;
  font-size: 12px;
  color:#4b5563;
  font-weight: 750;
}

.hiw-detail{
  display:grid;
  grid-template-columns: 1fr 320px;
  gap: 12px;
}

.hiw-detail-card{
  background: rgba(255,255,255,.9);
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  box-shadow: 0 16px 34px rgba(0,0,0,.06);
  padding: 14px;
}

.hiw-detail-top{
  display:flex;
  align-items:flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.hiw-detail-kicker{
  font-size: 12px;
  font-weight: 900;
  color:#6b7280;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.hiw-detail-title{
  margin-top: 6px;
  font-size: 18px;
  font-weight: 950;
}

.hiw-detail-desc{
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.9;
  color:#374151;
  max-width: 90ch;
}

.hiw-detail-badge{
  font-size: 12px;
  font-weight: 900;
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background:#fff;
  color:#111827;
}

.hiw-detail-grid{
  margin-top: 12px;
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.hiw-detail-box{
  border: 1px solid #eef0f3;
  background: linear-gradient(180deg, #fbfbfd, #fff);
  border-radius: 16px;
  padding: 12px;
}

.hiw-detail-box-title{
  font-size: 12px;
  font-weight: 950;
}

.hiw-list{
  margin: 10px 0 0;
  padding-left: 18px;
  color:#374151;
  line-height: 1.9;
  font-size: 13px;
}

.hiw-docs{
  margin-top: 10px;
  display:flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hiw-doc{
  font-size: 12px;
  font-weight: 850;
  padding: 7px 10px;
  border-radius: 999px;
  background:#111827;
  color:#fff;
}

.hiw-detail-actions{
  display:flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 12px;
}

.hiw-side-card{
  background: rgba(255,255,255,.9);
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  box-shadow: 0 16px 34px rgba(0,0,0,.06);
  padding: 14px;
  height: fit-content;
}

.hiw-side-title{
  font-size: 13px;
  font-weight: 950;
  margin-bottom: 10px;
}

.hiw-state{
  border: 1px solid #eef0f3;
  border-radius: 16px;
  background: linear-gradient(180deg, #fbfbfd, #fff);
  padding: 12px;
}

.hiw-state-row{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px dashed #e5e7eb;
}
.hiw-state-row:last-child{ border-bottom:none; }

.hiw-state-pill{
  font-size: 12px;
  font-weight: 900;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background:#fff;
  color:#111827;
  white-space: nowrap;
}

.hiw-state-arrow{
  color:#6b7280;
  font-weight: 900;
}

.hiw-state-note{
  margin-top: 10px;
  font-size: 12px;
  color:#6b7280;
  line-height: 1.8;
}

.hiw-roles{
  margin-top: 14px;
  display:grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.hiw-role{
  background: rgba(255,255,255,.9);
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  box-shadow: 0 16px 34px rgba(0,0,0,.06);
  padding: 14px;
}

.hiw-role-title{
  font-weight: 950;
  font-size: 14px;
}

.hiw-role-desc{
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.85;
  color:#4b5563;
}

.hiw-role-chips{
  margin-top: 10px;
  display:flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hiw-chip{
  font-size: 12px;
  font-weight: 850;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background:#fff;
  color:#374151;
}

.hiw-faq{
  margin-top: 12px;
  display:flex;
  flex-direction: column;
  gap: 10px;
}

.hiw-acc{
  background: rgba(255,255,255,.9);
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  box-shadow: 0 16px 34px rgba(0,0,0,.06);
  padding: 12px 14px;
}

.hiw-acc-q{
  cursor:pointer;
  font-weight: 950;
  font-size: 13px;
  list-style: none;
}
.hiw-acc-q::-webkit-details-marker{ display:none; }

.hiw-acc-a{
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.9;
  color:#4b5563;
}

.hiw-spacer{ height: 18px; }

@media (max-width: 1040px){
  .hiw-hero{ grid-template-columns: 1fr; }
  .hiw-flow{ grid-template-columns: 1fr; }
  .hiw-detail{ grid-template-columns: 1fr; }
  .hiw-roles{ grid-template-columns: repeat(2, 1fr); }
  .hiw-title{ font-size: 34px; }
}

@media (max-width: 560px){
  .hiw-title{ font-size: 28px; }
  .hiw-metric{ min-width: 0; width: 100%; }
  .hiw-detail-grid{ grid-template-columns: 1fr; }
  .hiw-roles{ grid-template-columns: 1fr; }
}
`;
