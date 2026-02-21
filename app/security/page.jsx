"use client";

import Link from "next/link";

export default function SecurityPage() {
  return (
    <div className="sec-page">
      <style>{css}</style>

      <div className="sec-container">
        {/* Hero */}
        <section className="sec-hero">
          <div className="sec-hero-left">
            <div className="sec-kicker">Security</div>
            <h1 className="sec-title">Built for safer trade flows.</h1>
            <p className="sec-subtitle">
              SupplyGuarantee is designed around escrow-like controls, role-based
              approvals, document hashing, and emergency pause mechanisms.
              We aim to reduce operational risk — while being transparent about
              what smart contracts can and cannot guarantee.
            </p>

            <div className="sec-hero-actions">
              <Link className="sec-btn sec-btn-primary" href="/app">
                Open Dashboard
              </Link>
              <a className="sec-btn" href="#faq">
                Security FAQ
              </a>
            </div>

            <div className="sec-badges">
              <div className="sec-badge">
                <span className="dot green" /> Role-based approvals
              </div>
              <div className="sec-badge">
                <span className="dot green" /> Reentrancy protection
              </div>
              <div className="sec-badge">
                <span className="dot green" /> Emergency pause
              </div>
              <div className="sec-badge">
                <span className="dot green" /> Document hashing on-chain
              </div>
            </div>
          </div>

          <div className="sec-hero-right">
            <div className="sec-card">
              <div className="sec-card-title">How funds move</div>
              <div className="sec-steps">
                <Step
                  title="1) Buyer funds escrow"
                  desc="Buyer deposits ERC-20 tokens into the contract (until price is reached)."
                />
                <Step
                  title="2) Advance (optional)"
                  desc="Seller requests → Buyer approves → Bank pays the advance."
                />
                <Step
                  title="3) Milestones"
                  desc="Plan → delivery → inspection → buyer approval → bank payment."
                />
                <Step
                  title="4) Disputes"
                  desc="Any rejection can move the order into dispute for arbiter/admin resolution."
                />
              </div>
              <div className="sec-note">
                Note: exact UX depends on your app integration and assigned roles.
              </div>
            </div>
          </div>
        </section>

        {/* Core safeguards */}
        <section className="sec-section">
          <h2 className="sec-h2">Core Safeguards</h2>
          <p className="sec-p">
            Your contract implements several controls that are commonly used to
            reduce on-chain risk. Here’s what they mean for users:
          </p>

          <div className="sec-grid">
            <Feature
              title="Role-based Access Control"
              body={
                <>
                  Each order specifies distinct roles (Buyer, Seller, Bank,
                  Carrier, Inspector, Arbiter). Critical functions are restricted
                  to the appropriate party (e.g., only Bank can execute payments).
                </>
              }
            />
            <Feature
              title="Reentrancy Guard"
              body={
                <>
                  Token-moving functions use a nonReentrant guard to reduce
                  reentrancy risk during transfers.
                </>
              }
            />
            <Feature
              title="Emergency Pause"
              body={
                <>
                  The owner can pause/unpause most flows. This can help mitigate
                  unexpected incidents (e.g., token issues, exploits, or
                  configuration mistakes).
                </>
              }
            />
            <Feature
              title="Safe ERC-20 Calls"
              body={
                <>
                  Transfers use low-level calls and validate return values when
                  present, improving compatibility with non-standard tokens.
                </>
              }
            />
          </div>
        </section>

        {/* Trust & roles */}
        <section className="sec-section">
          <h2 className="sec-h2">Trust Model & Roles</h2>
          <p className="sec-p">
            SupplyGuarantee reduces risk by distributing control across roles.
            However, it is not “trustless” in the pure sense — the Bank and
            Arbiter/Admin can be central points of trust depending on your setup.
          </p>

          <div className="sec-two">
            <div className="sec-panel">
              <div className="sec-panel-title">Who can do what?</div>
              <ul className="sec-list">
                <li>
                  <b>Buyer</b>: funds escrow, approves advance, approves milestone
                  payment after inspection.
                </li>
                <li>
                  <b>Seller</b>: requests advance, submits shipment plan/delivery
                  docs (seller or carrier).
                </li>
                <li>
                  <b>Inspector</b>: approves inspection report.
                </li>
                <li>
                  <b>Bank</b>: pays advance and milestone amounts out to the seller.
                </li>
                <li>
                  <b>Arbiter/Admin</b>: resolves disputes, can cancel and trigger refunds.
                </li>
              </ul>
            </div>

            <div className="sec-panel">
              <div className="sec-panel-title">Document integrity</div>
              <p className="sec-p2">
                The contract stores <b>hashes</b> of submitted documents (e.g.
                plan, delivery proof, inspection report). This enables
                tamper-evident referencing: if someone changes an off-chain PDF,
                its hash will no longer match the on-chain hash.
              </p>
              <div className="sec-mini">
                <div className="sec-mini-row">
                  <span className="sec-mini-k">On-chain</span>
                  <span className="sec-mini-v">bytes32 hash + timestamp + submitter</span>
                </div>
                <div className="sec-mini-row">
                  <span className="sec-mini-k">Off-chain</span>
                  <span className="sec-mini-v">PDF / image / report stored by your app</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Practical tips */}
        <section className="sec-section">
          <h2 className="sec-h2">Operational Security Recommendations</h2>
          <p className="sec-p">
            Security is a system. Smart contract logic is only one layer. These
            steps help reduce real-world risk:
          </p>

          <div className="sec-grid">
            <Feature
              title="Use a vetted ERC-20"
              body="Avoid unknown tokens with transfer fees, blacklists, or unusual behavior unless explicitly supported."
            />
            <Feature
              title="Keep Arbiter & Bank keys secure"
              body="Use multisigs and hardware wallets for privileged roles; set clear internal procedures."
            />
            <Feature
              title="Document workflow discipline"
              body="Hash the final document version before submission; store the original in immutable storage if possible."
            />
            <Feature
              title="Monitor events"
              body="Track contract events to detect unexpected state changes (e.g., disputes/cancellations)."
            />
          </div>
        </section>

        {/* Risk disclosure */}
        <section className="sec-section sec-risk">
          <h2 className="sec-h2">Limitations & Risk Disclosure</h2>
          <div className="sec-risk-box">
            <ul className="sec-list">
              <li>
                <b>Admin pause</b> can halt user actions while an incident is
                investigated.
              </li>
              <li>
                <b>Arbiter/Admin resolution</b> is a governance trust point; your
                policies matter.
              </li>
              <li>
                <b>Off-chain documents</b> are only referenced via hashes — actual
                storage, access, and confidentiality depend on your app.
              </li>
              <li>
                <b>Token behavior</b> varies; non-standard tokens may still cause
                issues despite safe-call wrappers.
              </li>
            </ul>
          </div>
        </section>

        {/* Contact / disclosure */}
        <section className="sec-section">
          <h2 className="sec-h2">Report a Security Issue</h2>
          <p className="sec-p">
            If you discover a vulnerability or suspicious behavior, contact us
            with a clear reproduction and impact description.
          </p>

          <div className="sec-cta">
            <div className="sec-cta-card">
              <div className="sec-cta-title">Responsible Disclosure</div>
              <p className="sec-p2">
                Please avoid public disclosure until we’ve had time to assess and
                patch the issue.
              </p>
              <div className="sec-cta-actions">
                <a className="sec-btn sec-btn-primary" href="mailto:sina.ata25@gmail.com">
                  Email Security
                </a>
                <a className="sec-btn" href="#faq">
                  Read FAQ
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="sec-section" id="faq">
          <h2 className="sec-h2">Security FAQ</h2>
          <div className="sec-faq">
            <Accordion
              q="Can the team steal user funds?"
              a="The contract is designed so funds move via defined roles and stages. However, your trust model includes privileged actors (e.g., owner pause and arbiter/admin dispute resolution). Use multisigs, audits, and transparent policies to reduce risk."
            />
            <Accordion
              q="What happens if something goes wrong mid-order?"
              a="The flow can move into Disputed via rejection. Arbiter/Admin can resolve by setting a next stage or canceling and triggering refunds (subject to what was already paid)."
            />
            <Accordion
              q="Are documents stored on-chain?"
              a="No. The contract stores document hashes (bytes32) and metadata. The actual files remain off-chain."
            />
            <Accordion
              q="Is this contract audited?"
              a="If you have an audit report, link it here. Until then, clearly state that auditing is pending. Avoid claiming 'audited' unless it’s true."
            />
          </div>
        </section>

        <div className="sec-footer-space" />
      </div>
    </div>
  );
}

function Step({ title, desc }) {
  return (
    <div className="sec-step">
      <div className="sec-step-title">{title}</div>
      <div className="sec-step-desc">{desc}</div>
    </div>
  );
}

function Feature({ title, body }) {
  return (
    <div className="sec-feature">
      <div className="sec-feature-title">{title}</div>
      <div className="sec-feature-body">{body}</div>
    </div>
  );
}

function Accordion({ q, a }) {
  return (
    <details className="sec-acc">
      <summary className="sec-acc-q">{q}</summary>
      <div className="sec-acc-a">{a}</div>
    </details>
  );
}

const css = `
.sec-page{
  background:#fbfbfd;
  min-height: calc(100vh - 64px);
  padding: 28px 16px 60px;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
  color: #111827;
}

.sec-container{
  max-width: 1100px;
  margin: 0 auto;
}

.sec-hero{
  display:grid;
  grid-template-columns: 1.2fr .8fr;
  gap: 18px;
  align-items: stretch;
  margin-bottom: 26px;
}

.sec-kicker{
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: #6b7280;
}

.sec-title{
  margin: 10px 0 0;
  font-size: 34px;
  line-height: 1.12;
  font-weight: 900;
}

.sec-subtitle{
  margin-top: 12px;
  font-size: 14px;
  line-height: 1.9;
  color: #374151;
  max-width: 68ch;
}

.sec-hero-actions{
  display:flex;
  gap: 10px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.sec-btn{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #111827;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}

.sec-btn:hover{ background:#f9fafb; }

.sec-btn-primary{
  background:#111827;
  border-color:#111827;
  color:#fff;
}
.sec-btn-primary:hover{ opacity:.92; }

.sec-badges{
  display:flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.sec-badge{
  display:flex;
  align-items:center;
  gap: 8px;
  border: 1px solid #e5e7eb;
  background:#fff;
  padding: 8px 10px;
  border-radius: 999px;
  font-size: 12px;
  color:#374151;
}

.dot{
  width: 10px;
  height: 10px;
  border-radius: 999px;
  display:inline-block;
}
.dot.green{ background: #22c55e; }

.sec-card{
  background:#fff;
  border:1px solid #e5e7eb;
  border-radius: 18px;
  box-shadow: 0 12px 30px rgba(0,0,0,.06);
  padding: 16px;
}

.sec-card-title{
  font-weight: 900;
  margin-bottom: 10px;
}

.sec-steps{
  display:flex;
  flex-direction: column;
  gap: 10px;
}

.sec-step{
  border: 1px solid #eef0f3;
  background:#fbfbfd;
  border-radius: 14px;
  padding: 12px;
}

.sec-step-title{
  font-size: 13px;
  font-weight: 900;
}

.sec-step-desc{
  margin-top: 6px;
  font-size: 12.5px;
  line-height: 1.8;
  color:#4b5563;
}

.sec-note{
  margin-top: 10px;
  font-size: 12px;
  color:#6b7280;
}

.sec-section{
  margin-top: 26px;
}

.sec-h2{
  font-size: 18px;
  font-weight: 900;
  margin: 0 0 10px;
}

.sec-p{
  margin: 0 0 14px;
  font-size: 14px;
  line-height: 1.9;
  color:#374151;
  max-width: 90ch;
}

.sec-grid{
  display:grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.sec-feature{
  background:#fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 14px;
}

.sec-feature-title{
  font-size: 13px;
  font-weight: 900;
}

.sec-feature-body{
  margin-top: 8px;
  font-size: 12.5px;
  line-height: 1.85;
  color:#4b5563;
}

.sec-two{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.sec-panel{
  background:#fff;
  border:1px solid #e5e7eb;
  border-radius: 16px;
  padding: 14px;
}

.sec-panel-title{
  font-size: 13px;
  font-weight: 900;
  margin-bottom: 10px;
}

.sec-p2{
  margin: 0;
  font-size: 13px;
  line-height: 1.9;
  color:#4b5563;
}

.sec-list{
  margin: 0;
  padding-left: 18px;
  color:#374151;
  line-height: 1.9;
  font-size: 13px;
}

.sec-mini{
  margin-top: 12px;
  border: 1px solid #eef0f3;
  background:#fbfbfd;
  border-radius: 14px;
  padding: 10px;
}

.sec-mini-row{
  display:flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12.5px;
  padding: 6px 0;
  border-bottom: 1px dashed #e5e7eb;
}
.sec-mini-row:last-child{ border-bottom: none; }

.sec-mini-k{ color:#6b7280; font-weight: 800; }
.sec-mini-v{ color:#111827; font-weight: 700; }

.sec-risk-box{
  background: #fff;
  border: 1px solid #f1c7c7;
  border-radius: 16px;
  padding: 14px;
}

.sec-cta{
  display:flex;
  justify-content: flex-start;
}

.sec-cta-card{
  background:#fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 14px;
  box-shadow: 0 12px 30px rgba(0,0,0,.06);
  max-width: 640px;
  width: 100%;
}

.sec-cta-title{
  font-size: 13px;
  font-weight: 900;
  margin-bottom: 8px;
}

.sec-cta-actions{
  display:flex;
  gap: 10px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.sec-faq{
  display:flex;
  flex-direction: column;
  gap: 10px;
}

.sec-acc{
  background:#fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 12px 14px;
}

.sec-acc-q{
  cursor:pointer;
  font-weight: 900;
  font-size: 13px;
  list-style: none;
}

.sec-acc-q::-webkit-details-marker{ display:none; }

.sec-acc-a{
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.9;
  color:#4b5563;
}

.sec-footer-space{ height: 20px; }

@media (max-width: 980px){
  .sec-hero{ grid-template-columns: 1fr; }
  .sec-grid{ grid-template-columns: repeat(2, 1fr); }
  .sec-two{ grid-template-columns: 1fr; }
}

@media (max-width: 520px){
  .sec-grid{ grid-template-columns: 1fr; }
  .sec-title{ font-size: 28px; }
}
`;