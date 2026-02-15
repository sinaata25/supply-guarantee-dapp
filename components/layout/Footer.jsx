"use client";

import Link from "next/link";
import { WEB3_CONFIG } from "@/lib/web3/config";
import { SITE, explorerBaseByChainId } from "@/lib/site";

function ExternalLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-sm text-gray-600 hover:text-black transition"
    >
      {children}
    </a>
  );
}

function AddressLink({ label, address }) {
  const base = explorerBaseByChainId(WEB3_CONFIG.chainId);
  const href = base ? `${base}/address/${address}` : "";
  if (!address || !base) return null;

  return (
    <div className="text-sm text-gray-600">
      <span className="text-gray-500">{label}: </span>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="font-medium hover:text-black transition break-all"
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
    <footer className="border-t bg-white mt-20">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white font-bold">
                SG
              </div>
              <div className="font-semibold">{SITE.name}</div>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              {SITE.tagline}
            </p>

            <div className="pt-2 flex gap-4">
              <ExternalLink href={SITE.docs}>Docs</ExternalLink>
              <ExternalLink href={SITE.github}>GitHub</ExternalLink>
              {explorerBase ? (
                <ExternalLink href={explorerBase}>Explorer</ExternalLink>
              ) : null}
            </div>
          </div>

          {/* Product */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-900">Product</div>
            <div className="space-y-2">
              <Link href="#how-it-works" className="block text-sm text-gray-600 hover:text-black transition">
                How it works
              </Link>
              <Link href="#features" className="block text-sm text-gray-600 hover:text-black transition">
                Features
              </Link>
              <Link href="#security" className="block text-sm text-gray-600 hover:text-black transition">
                Security
              </Link>
              <Link href="/app" className="block text-sm text-gray-600 hover:text-black transition">
                Dashboard
              </Link>
            </div>
          </div>

          {/* Developers */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-900">Developers</div>
            <div className="space-y-2">
              <ExternalLink href={SITE.docs}>Documentation</ExternalLink>
              <ExternalLink href={SITE.github}>Repository</ExternalLink>
              {explorerBase ? <ExternalLink href={explorerBase}>Block Explorer</ExternalLink> : null}
            </div>

            <div className="pt-3 text-xs text-gray-500">
              Network ChainId: <span className="font-medium">{WEB3_CONFIG.chainId || "—"}</span>
            </div>
          </div>

          {/* Contracts */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-900">Contracts</div>

            <div className="space-y-3">
              <AddressLink label="SupplyGuarantee" address={WEB3_CONFIG.sgAddress} />
              <AddressLink label="Token" address={WEB3_CONFIG.tokenAddress} />
            </div>

            <div className="pt-2 text-xs text-gray-500">
              These addresses are read from your <span className="font-mono">.env.local</span>.
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t pt-6 md:flex-row md:items-center md:justify-between">
          <div className="text-xs text-gray-500">
            © {year} {SITE.name}. All rights reserved.
          </div>
          <div className="text-xs text-gray-500">
            Built with Next.js + Ethers + Tailwind
          </div>
        </div>
      </div>
    </footer>
  );
}
