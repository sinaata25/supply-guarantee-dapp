"use client";

import Link from "next/link";
import { useWeb3 } from "@/components/web3/Web3Provider";
import { shorten } from "@/lib/web3";

export default function Header() {
  const {
    account,
    isCorrectChain,
    isConnecting,
    connect,
    switchToTargetChain,
  } = useWeb3();

  return (
    <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white font-bold">
            SG
          </div>
          <span className="text-lg font-semibold tracking-tight">
            SupplyGuarantee
          </span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
          <Link href="#how-it-works" className="hover:text-black transition">
            How it works
          </Link>
          <Link href="#features" className="hover:text-black transition">
            Features
          </Link>
          <Link href="#security" className="hover:text-black transition">
            Security
          </Link>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/app"
            className="rounded-xl px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
          >
            Dashboard
          </Link>

          {/* Wallet Button */}
          {!account ? (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:opacity-90 transition"
            >
              {isConnecting ? "Connecting…" : "Connect Wallet"}
            </button>
          ) : !isCorrectChain ? (
            <button
              onClick={switchToTargetChain}
              className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition"
            >
              Switch Network
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              {shorten(account)}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
