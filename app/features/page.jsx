"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const FEATURE_CARDS = [
  {
    title: "Escrow-style Funding",
    desc: "Buyer deposits ERC-20 funds into the contract. Orders become funded once the price threshold is reached.",
    icon: "shield",
    tags: ["Funding", "Transparency"],
  },
  {
    title: "Milestone Payments",
    desc: "Split settlements into milestones with clear amounts, deadlines, and stage transitions.",
    icon: "roadmap",
    tags: ["Milestones", "Automation"],
  },
  {
    title: "Advance Workflow",
    desc: "Optional advance request → buyer approval → bank execution. Helps suppliers start work with confidence.",
    icon: "spark",
    tags: ["Advance", "Workflow"],
  },
  {
    title: "Document Hashing",
    desc: "Submit document hashes on-chain (plan, delivery proof, inspection report) for tamper-evident verification.",
    icon: "hash",
    tags: ["Docs", "Integrity"],
  },
  {
    title: "Role-based Approvals",
    desc: "Buyer, Seller, Bank, Inspector, Carrier, Arbiter each have explicit permissions to reduce single-point failures.",
    icon: "users",
    tags: ["Roles", "Controls"],
  },
  {
    title: "Dispute Handling",
    desc: "Rejections can transition orders into dispute, allowing arbiter/admin resolution or cancellation & refund.",
    icon: "gavel",
    tags: ["Disputes", "Safety"],
  },
  {
    title: "Emergency Pause",
    desc: "Admin can pause critical flows in case of incident response or contract issues.",
    icon: "pause",
    tags: ["Ops", "Risk"],
  },
  {
    title: "Event-driven Auditing",
    desc: "Events for order creation, funding, docs, stage changes, and payouts enable monitoring & analytics.",
    icon: "pulse",
    tags: ["Events", "Monitoring"],
  },
];

const ROLE_FEATURES = {
  Buyer: [
    {
      title: "Controlled release of funds",
      desc: "Approve advance and milestone payouts only after required proof and inspection.",
    },
    {
      title: "Transparency at every step",
      desc: "Track stage transitions and document hashes for auditability.",
    },
    {
      title: "Refund path for remaining balance",
      desc: "In cancellation or dispute resolution, remaining funds can be refunded (net of paid amounts).",
    },
  ],
  Seller: [
    {
      title: "Advance support",
      desc: "Request an advance to begin work; buyer approval + bank execution keeps the flow accountable.",
    },
    {
      title: "Structured milestone delivery",
      desc: "Submit plan and delivery proofs with clear stage expectations.",
    },
    {
      title: "Predictable settlement terms",
      desc: "Once milestones are locked, payment structure is fixed and consistent.",
    },
  ],
  Bank: [
    {
      title: "Execution control",
      desc: "Bank triggers advance and milestone transfers, aligning on-chain settlement with real-world operations.",
    },
    {
      title: "Clear eligibility checks",
      desc: "Payments occur only at explicit stages (e.g., BuyerApproved milestone).",
    },
    {
      title: "Operational audit trail",
      desc: "On-chain events provide traceability for compliance and internal controls.",
    },
  ],
  Inspector: [
    {
      title: "Independent verification",
      desc: "Inspector approves inspection report hashes before buyer confirms payout.",
    },
    {
      title: "Deadline-aware workflow",
      desc: "Inspection steps can enforce optional deadlines to keep timelines predictable.",
    },
    {
      title: "Reduced disputes",
      desc: "Structured inspection reduces ambiguity and improves settlement confidence.",
    },
  ],
};

const PLANS = [
  {
    name: "Core",
    price: "$0",
    desc: "For early pilots and demos.",
    items: [
      "Order creation & funding",
      "Milestone flow UI",
      "Document hashing references",
      "Basic monitoring",
    ],
    highlight: false,
  },
  {
    name: "Pro",
    price: "Custom",
    desc: "For real-world operations.",
    items: [
      "Role dashboards (Buyer/Seller/Bank)",
      "Dispute workflow UI",
      "Advanced event monitoring",
      "SLA support",
    ],
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    desc: "For larger institutions.",
    items: [
      "Multi-sig & governance setup",
      "Audit/compliance tooling",
      "Custom integrations",
      "Dedicated support",
    ],
    highlight: false,
  },
];

export default function FeaturesPage() {
  const [role, setRole] = useState("Buyer");

  const roleItems = useMemo(() => ROLE_FEATURES[role] || [], [role]);

  return (
    <div className="ft-page">
      <style>{css}</style>

      <div className="ft-container">
        {/* HERO */}
        <section className="ft-hero">
          <div className="ft-hero-left">
            <div className="ft-kicker">Features</div>
            <h1 className="ft-title">Everything you need for structured settlements.</h1>
            <p className="ft-subtitle">
              A modern trade flow combining escrow-style funding, milestone payouts,
              role-based approvals, and document integrity — designed to be operationally realistic.
            </p>

            <div className="ft-cta">
              <Link href="/app" className="ft-btn ft-btn-primary">
                Open Dashboard
              </Link>
              <a href="#by-role" className="ft-btn">
                See by Role
              </a>
            </div>

            <div className="ft-stats">
              <Stat label="Approvals" value="Role-based" />
              <Stat label="Docs" value="Hashed" />
              <Stat label="Payments" value="Milestones" />
            </div>
          </div>

          <div className="ft-hero-right">
            <div className="ft-hero-card">
              <div className="ft-hero-card-title">What users feel</div>
              <div className="ft-quote">
                <div className="ft-quote-mark">“</div>
                <div className="ft-quote-text">
                  Clear responsibilities. Clear evidence. Clear payouts.
                </div>
              </div>
              <div className="ft-hero-mini">
                <MiniCheck text="Less ambiguity" />
                <MiniCheck text="More accountability" />
                <MiniCheck text="Better audit trail" />
              </div>
            </div>
          </div>
        </section>

        {/* FEATURE GRID */}
        <section className="ft-section">
          <div className="ft-section-head">
            <div>
              <h2 className="ft-h2">Core capabilities</h2>
              <p className="ft-p">
                A complete toolkit to manage high-trust transactions with structured steps
                and measurable proof.
              </p>
            </div>

            <div className="ft-chipbar" aria-label="Feature tags">
              <span className="ft-chip">Funding</span>
              <span className="ft-chip">Milestones</span>
              <span className="ft-chip">Docs</span>
              <span className="ft-chip">Disputes</span>
            </div>
          </div>

          <div className="ft-grid">
            {FEATURE_CARDS.map((f) => (
              <div className="ft-card" key={f.title}>
                <div className="ft-card-top">
                  <div className={`ft-icon ${f.icon}`} aria-hidden="true" />
                  <div className="ft-card-title">{f.title}</div>
                </div>

                <div className="ft-card-desc">{f.desc}</div>

                <div className="ft-tags">
                  {f.tags.map((t) => (
                    <span className="ft-tag" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* BY ROLE */}
        <section className="ft-section" id="by-role">
          <h2 className="ft-h2">Features by role</h2>
          <p className="ft-p">
            Different participants care about different outcomes. Here’s what each role gets.
          </p>

          <div className="ft-role">
            <div className="ft-tabs" role="tablist" aria-label="Role tabs">
              {Object.keys(ROLE_FEATURES).map((r) => (
                <button
                  key={r}
                  className={`ft-tab ${role === r ? "active" : ""}`}
                  onClick={() => setRole(r)}
                  role="tab"
                  aria-selected={role === r}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="ft-role-panel" role="tabpanel">
              <div className="ft-role-title">{role} benefits</div>
              <div className="ft-role-grid">
                {roleItems.map((it) => (
                  <div className="ft-role-card" key={it.title}>
                    <div className="ft-role-card-title">{it.title}</div>
                    <div className="ft-role-card-desc">{it.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* PLANS */}
        <section className="ft-section">
          <h2 className="ft-h2">Packaging (UI only)</h2>
          <p className="ft-p">
            This is a presentation section. You can later connect it to real pricing or remove it.
          </p>

          <div className="ft-plans">
            {PLANS.map((p) => (
              <div className={`ft-plan ${p.highlight ? "highlight" : ""}`} key={p.name}>
                <div className="ft-plan-top">
                  <div className="ft-plan-name">{p.name}</div>
                  <div className="ft-plan-price">{p.price}</div>
                </div>
                <div className="ft-plan-desc">{p.desc}</div>

                <ul className="ft-plan-list">
                  {p.items.map((x) => (
                    <li key={x}>
                      <span className="ft-check" aria-hidden="true" />
                      {x}
                    </li>
                  ))}
                </ul>

                <Link href="/app" className={`ft-btn ${p.highlight ? "ft-btn-primary" : ""}`}>
                  Get started
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="ft-section" id="faq">
          <h2 className="ft-h2">FAQ</h2>
          <div className="ft-faq">
            <Accordion
              q="Do you store files on-chain?"
              a="No. Only hashes (bytes32) and metadata are stored. Your application stores the actual files off-chain."
            />
            <Accordion
              q="Who releases funds?"
              a="Buyer funds the contract. Bank executes advance and milestone payments when the order is in the correct stage and approvals are complete."
            />
            <Accordion
              q="Can I customize roles?"
              a="Yes, the order header defines roles per order. Your UI can enforce role-based access on top of the contract’s checks."
            />
          </div>
        </section>

        <div className="ft-spacer" />
      </div>
    </div>
  );
}

/* ---------- Small components (outside main) ---------- */

function Stat({ label, value }) {
  return (
    <div className="ft-stat">
      <div className="ft-stat-value">{value}</div>
      <div className="ft-stat-label">{label}</div>
    </div>
  );
}

function MiniCheck({ text }) {
  return (
    <div className="ft-mini">
      <span className="ft-mini-dot" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

function Accordion({ q, a }) {
  return (
    <details className="ft-acc">
      <summary className="ft-acc-q">{q}</summary>
      <div className="ft-acc-a">{a}</div>
    </details>
  );
}

const css = `
.ft-page{
  background: radial-gradient(900px 540px at 12% 0%, rgba(17,24,39,.06), transparent 58%),
              radial-gradient(900px 540px at 96% 10%, rgba(0,0,0,.05), transparent 58%),
              #fbfbfd;
  min-height: calc(100vh - 64px);
  padding: 28px 16px 64px;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
  color: #111827;
}

.ft-container{ max-width: 1120px; margin: 0 auto; }

.ft-hero{
  display:grid;
  grid-template-columns: 1.1fr .9fr;
  gap: 16px;
  align-items: stretch;
  margin-bottom: 26px;
}

.ft-kicker{
  font-size: 12px;
  font-weight: 950;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: #6b7280;
}

.ft-title{
  margin: 10px 0 0;
  font-size: 40px;
  line-height: 1.08;
  font-weight: 950;
  letter-spacing: -.02em;
}

.ft-subtitle{
  margin-top: 12px;
  font-size: 14px;
  line-height: 1.9;
  color: #374151;
  max-width: 76ch;
}

.ft-cta{
  display:flex;
  gap: 10px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.ft-btn{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border: 1px solid #e5e7eb;
  background: rgba(255,255,255,.9);
  color: #111827;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 850;
  text-decoration: none;
  cursor: pointer;
  transition: transform .12s ease, background .12s ease, opacity .12s ease;
}

.ft-btn:hover{ background:#fff; transform: translateY(-1px); }
.ft-btn-primary{
  background:#111827;
  border-color:#111827;
  color:#fff;
}
.ft-btn-primary:hover{ opacity:.92; background:#111827; }

.ft-stats{
  display:flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.ft-stat{
  background: rgba(255,255,255,.9);
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 10px 12px;
  min-width: 180px;
  box-shadow: 0 14px 30px rgba(0,0,0,.05);
}
.ft-stat-value{ font-size: 13px; font-weight: 950; }
.ft-stat-label{ margin-top: 4px; font-size: 12px; color:#6b7280; font-weight: 750; }

.ft-hero-card{
  background: rgba(255,255,255,.9);
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  box-shadow: 0 16px 34px rgba(0,0,0,.06);
  padding: 14px;
  height: 100%;
}

.ft-hero-card-title{
  font-weight: 950;
  font-size: 13px;
  margin-bottom: 10px;
}

.ft-quote{
  border: 1px solid #eef0f3;
  background: linear-gradient(180deg, #fbfbfd, #fff);
  border-radius: 16px;
  padding: 12px;
  display:flex;
  gap: 10px;
  align-items:flex-start;
}

.ft-quote-mark{
  width: 32px;
  height: 32px;
  border-radius: 12px;
  background: #111827;
  color: #fff;
  display:flex;
  align-items:center;
  justify-content:center;
  font-weight: 950;
  font-size: 18px;
}

.ft-quote-text{
  font-size: 13px;
  line-height: 1.9;
  color:#374151;
  font-weight: 750;
}

.ft-hero-mini{
  margin-top: 12px;
  display:flex;
  flex-direction: column;
  gap: 8px;
}

.ft-mini{
  display:flex;
  gap: 10px;
  align-items:center;
  font-size: 13px;
  color:#4b5563;
  font-weight: 750;
}

.ft-mini-dot{
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34,197,94,.12);
}

.ft-section{ margin-top: 26px; }

.ft-section-head{
  display:flex;
  align-items:flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.ft-h2{ margin: 0; font-size: 18px; font-weight: 950; }

.ft-p{
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.9;
  color:#374151;
  max-width: 90ch;
}

.ft-chipbar{
  display:flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ft-chip{
  font-size: 12px;
  font-weight: 850;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background:#fff;
  color:#374151;
}

.ft-grid{
  margin-top: 14px;
  display:grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.ft-card{
  background: rgba(255,255,255,.9);
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  box-shadow: 0 16px 34px rgba(0,0,0,.06);
  padding: 14px;
  transition: transform .14s ease, box-shadow .14s ease;
}
.ft-card:hover{
  transform: translateY(-2px);
  box-shadow: 0 18px 40px rgba(0,0,0,.08);
}

.ft-card-top{
  display:flex;
  gap: 10px;
  align-items:center;
}

.ft-card-title{
  font-size: 14px;
  font-weight: 950;
}

.ft-card-desc{
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.9;
  color:#4b5563;
}

.ft-tags{
  margin-top: 12px;
  display:flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ft-tag{
  font-size: 12px;
  font-weight: 850;
  padding: 7px 10px;
  border-radius: 999px;
  background:#111827;
  color:#fff;
}

.ft-icon{
  width: 36px;
  height: 36px;
  border-radius: 14px;
  border: 1px solid #e5e7eb;
  background: #fff;
  position: relative;
  flex: 0 0 auto;
}
.ft-icon::after{
  content:"";
  position:absolute;
  inset: 9px;
  border-radius: 10px;
  background: #111827;
  opacity: .12;
}
.ft-icon.shield::before{
  content:"";
  position:absolute;
  left: 12px; top: 10px;
  width: 12px; height: 16px;
  border: 2px solid #111827;
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
}
.ft-icon.roadmap::before{
  content:"";
  position:absolute;
  left: 10px; top: 12px;
  width: 16px; height: 2px;
  background:#111827;
  box-shadow: 0 6px 0 #111827, 0 12px 0 #111827;
}
.ft-icon.spark::before{
  content:"";
  position:absolute;
  left: 17px; top: 9px;
  width: 2px; height: 18px;
  background:#111827;
  transform: rotate(25deg);
}
.ft-icon.hash::before{
  content:"#";
  position:absolute;
  left: 13px; top: 7px;
  font-weight: 950;
  font-size: 18px;
  color:#111827;
}
.ft-icon.users::before{
  content:"";
  position:absolute;
  left: 10px; top: 12px;
  width: 7px; height: 7px;
  border-radius: 999px;
  background:#111827;
  box-shadow: 10px 0 0 #111827;
}
.ft-icon.gavel::before{
  content:"";
  position:absolute;
  left: 11px; top: 11px;
  width: 14px; height: 4px;
  background:#111827;
  transform: rotate(-20deg);
}
.ft-icon.pause::before{
  content:"";
  position:absolute;
  left: 14px; top: 11px;
  width: 3px; height: 14px;
  background:#111827;
  box-shadow: 8px 0 0 #111827;
}
.ft-icon.pulse::before{
  content:"";
  position:absolute;
  left: 10px; top: 18px;
  width: 16px; height: 2px;
  background:#111827;
}
.ft-icon.pulse::after{
  content:"";
  position:absolute;
  left: 12px; top: 12px;
  width: 12px; height: 12px;
  border: 2px solid rgba(17,24,39,.25);
  border-radius: 12px;
  background: transparent;
}

.ft-role{
  margin-top: 14px;
  background: rgba(255,255,255,.9);
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  box-shadow: 0 16px 34px rgba(0,0,0,.06);
  overflow: hidden;
}

.ft-tabs{
  display:flex;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid #eef0f3;
  flex-wrap: wrap;
}

.ft-tab{
  border: 1px solid #e5e7eb;
  background:#fff;
  color:#111827;
  padding: 9px 12px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 900;
  cursor:pointer;
}
.ft-tab:hover{ background:#f9fafb; }
.ft-tab.active{
  background:#111827;
  border-color:#111827;
  color:#fff;
}

.ft-role-panel{
  padding: 14px;
}

.ft-role-title{
  font-size: 14px;
  font-weight: 950;
  margin-bottom: 10px;
}

.ft-role-grid{
  display:grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.ft-role-card{
  border: 1px solid #eef0f3;
  background: linear-gradient(180deg, #fbfbfd, #fff);
  border-radius: 18px;
  padding: 14px;
}

.ft-role-card-title{
  font-weight: 950;
  font-size: 13px;
}

.ft-role-card-desc{
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.9;
  color:#4b5563;
}

.ft-plans{
  margin-top: 14px;
  display:grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.ft-plan{
  background: rgba(255,255,255,.9);
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  box-shadow: 0 16px 34px rgba(0,0,0,.06);
  padding: 14px;
}

.ft-plan.highlight{
  border-color: rgba(17,24,39,.45);
  box-shadow: 0 18px 44px rgba(0,0,0,.10);
  transform: translateY(-2px);
}

.ft-plan-top{
  display:flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
}

.ft-plan-name{ font-weight: 950; font-size: 14px; }
.ft-plan-price{ font-weight: 950; font-size: 14px; color:#111827; }

.ft-plan-desc{
  margin-top: 8px;
  font-size: 13px;
  color:#4b5563;
  line-height: 1.85;
}

.ft-plan-list{
  margin: 12px 0 14px;
  padding-left: 18px;
  color:#374151;
  line-height: 1.9;
  font-size: 13px;
}

.ft-plan-list li{
  display:flex;
  gap: 10px;
  align-items:flex-start;
  margin: 8px 0;
}

.ft-check{
  width: 16px;
  height: 16px;
  border-radius: 6px;
  background:#22c55e;
  margin-top: 2px;
  box-shadow: 0 0 0 4px rgba(34,197,94,.12);
  position: relative;
  flex: 0 0 auto;
}
.ft-check::after{
  content:"";
  position:absolute;
  left: 5px; top: 3px;
  width: 4px; height: 8px;
  border-right: 2px solid #fff;
  border-bottom: 2px solid #fff;
  transform: rotate(35deg);
}

.ft-faq{
  margin-top: 12px;
  display:flex;
  flex-direction: column;
  gap: 10px;
}

.ft-acc{
  background: rgba(255,255,255,.9);
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  box-shadow: 0 16px 34px rgba(0,0,0,.06);
  padding: 12px 14px;
}

.ft-acc-q{
  cursor:pointer;
  font-weight: 950;
  font-size: 13px;
  list-style: none;
}
.ft-acc-q::-webkit-details-marker{ display:none; }

.ft-acc-a{
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.9;
  color:#4b5563;
}

.ft-spacer{ height: 18px; }

@media (max-width: 1040px){
  .ft-hero{ grid-template-columns: 1fr; }
  .ft-grid{ grid-template-columns: repeat(2, 1fr); }
  .ft-role-grid{ grid-template-columns: 1fr; }
  .ft-plans{ grid-template-columns: 1fr; }
  .ft-title{ font-size: 34px; }
}

@media (max-width: 560px){
  .ft-grid{ grid-template-columns: 1fr; }
  .ft-title{ font-size: 28px; }
  .ft-stat{ min-width: 0; width: 100%; }
}
`;