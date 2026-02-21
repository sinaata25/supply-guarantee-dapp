"use client";

import Link from "next/link";
import { WEB3_CONFIG } from "@/lib/web3/config";
import { SITE, explorerBaseByChainId } from "@/lib/site";

function ExternalLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="extLink">
      {children}
    </a>
  );
}

function AddressLink({ label, address }) {
  const base = explorerBaseByChainId(WEB3_CONFIG.chainId);
  const href = base ? `${base}/address/${address}` : "";
  if (!address || !base) return null;

  return (
    <div className="addressRow">
      <span className="addressLabel">{label}: </span>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="addressLink"
        title={address}
      >
        {address}
      </a>
    </div>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();
  const explorerBase = explorerBaseByChainId(WEB3_CONFIG.chainId);

  return (
    <footer className="footer">
      <div className="container">
        <div className="grid">
          {/* Brand */}
          <div className="col">
            <div className="brand">
              <div className="logo">SG</div>
              <div className="brandName">{SITE.name}</div>
            </div>

            <p className="tagline">{SITE.tagline}</p>

            <div className="linksRow">
              <ExternalLink href={SITE.docs}>Docs</ExternalLink>
              <ExternalLink href={SITE.github}>GitHub</ExternalLink>
              {explorerBase ? <ExternalLink href={explorerBase}>Explorer</ExternalLink> : null}
            </div>
          </div>

          {/* Product */}
          <div className="col">
            <div className="title">Product</div>

            <nav className="nav">
              <Link href="/how-it-works" className="navLink">
                How it works
              </Link>
              <Link href="/features" className="navLink">
                Features
              </Link>
              <Link href="/security" className="navLink">
                Security
              </Link>
              <Link href="/app" className="navLink">
                Dashboard
              </Link>
            </nav>
          </div>

          {/* Contracts */}
          <div className="col">
            <div className="title">Contracts</div>
            <div className="contracts">
              <AddressLink label="SupplyGuarantee" address={WEB3_CONFIG.sgAddress} />
              <AddressLink label="Token" address={WEB3_CONFIG.tokenAddress} />
            </div>
          </div>
        </div>

        <div className="bottom">
          <div className="copyright">
            © {year} {SITE.name}. All rights reserved.
          </div>
        </div>
      </div>

      <style jsx>{`
        .footer {
          margin-top: 80px;
          background: #ffffff;
          border-top: 1px solid #e5e7eb;
        }

        .container {
          max-width: 1120px;
          margin: 0 auto;
          padding: 48px 24px;
        }

        /* === GRID (balanced 3 sections) === */
        .grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 40px;
        }

        /* Tablet: 2 columns */
        @media (min-width: 640px) {
          .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            column-gap: 56px;
            row-gap: 44px;
          }
        }

        /* Desktop: 3 columns */
        @media (min-width: 900px) {
          .grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            column-gap: 72px;
            row-gap: 48px;
          }
        }

        .col {
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-width: 0; /* برای جلوگیری از بیرون‌زدگی آدرس‌ها */
        }

        /* Brand */
        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .logo {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          background: #000;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 14px;
          letter-spacing: 0.5px;
          flex: 0 0 auto;
        }

        .brandName {
          font-weight: 700;
          color: #111827;
        }

        .tagline {
          margin: 0;
          font-size: 14px;
          line-height: 1.7;
          color: #4b5563;
        }

        .linksRow {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          padding-top: 4px;
        }

        .extLink {
          font-size: 14px;
          color: #4b5563;
          text-decoration: none;
          transition: color 150ms ease;
        }
        .extLink:hover {
          color: #111827;
        }

        /* Product */
        .title {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: #111827;
        }

        .nav {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 2px;
        }

        .navLink {
          font-size: 14px;
          color: #4b5563;
          text-decoration: none;
          transition: color 150ms ease;
        }
        .navLink:hover {
          color: #111827;
        }

        /* Contracts */
        .contracts {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 2px;
        }

        .addressRow {
          font-size: 14px;
          color: #4b5563;
          min-width: 0;
        }

        .addressLabel {
          color: #6b7280;
        }

        .addressLink {
          font-weight: 600;
          color: #4b5563;
          text-decoration: none;
          transition: color 150ms ease;
          word-break: break-all;
        }
        .addressLink:hover {
          color: #111827;
        }

        /* Bottom */
        .bottom {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .copyright {
          font-size: 12px;
          color: #6b7280;
        }
      `}</style>
    </footer>
  );
}