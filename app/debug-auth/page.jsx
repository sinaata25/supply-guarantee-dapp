"use client";

import React, { useMemo, useState } from "react";
import { useWeb3 } from "@/components/web3/Web3Provider"; // اگر مسیر Provider شما فرق داره اصلاح کن
import { requestNonce, verifySignature, getMe } from "@/lib/api"; // مسیر api شما

function short(addr) {
  if (!addr) return "-";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function DebugAuthPage() {
  const {
    isReady,
    isConnecting,
    error: web3Error,
    account,
    chainId,
    isCorrectChain,
    connect,
    refresh,
    logout, // اگر در Provider گذاشتی
    accessToken, // اگر در Provider گذاشتی
    profile, // اگر در Provider گذاشتی
  } = useWeb3();

  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [tokens, setTokens] = useState(null);
  const [me, setMe] = useState(null);

  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE_URL, []);

  const log = (title, data) => {
    setLogs((prev) => [
      { at: new Date().toLocaleTimeString(), title, data },
      ...prev,
    ]);
  };

  const doLoginTest = async () => {
    setBusy(true);
    setAuthError("");
    setTokens(null);
    setMe(null);

    try {
      if (!account) {
        throw new Error("Wallet not connected. Click Connect first.");
      }

      // 1) nonce
      log("1) requestNonce شروع شد", { account, chainId });
      const nonceRes = await requestNonce(account, chainId || 1);
      log("✅ 1) requestNonce موفق", nonceRes);

      // 2) sign (با ethers از window.ethereum)
      // ما اینجا مستقیم signer می‌گیریم تا وابسته به Provider شما نباشه.
      const { ethers } = await import("ethers");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      log("2) signMessage شروع شد", { message: nonceRes.message });
      const signature = await signer.signMessage(nonceRes.message);
      log("✅ 2) signMessage موفق", { signature });

      // 3) verify
      log("3) verifySignature شروع شد", { account });
      const t = await verifySignature(account, signature);
      setTokens(t);
      log("✅ 3) verifySignature موفق (JWT دریافت شد)", t);

      // 4) me
      log("4) getMe شروع شد", { access: t.access });
      const profileRes = await getMe(t.access);
      setMe(profileRes);
      log("✅ 4) getMe موفق (پروفایل دریافت شد)", profileRes);
    } catch (e) {
      const msg = e?.message || "Auth test failed";
      setAuthError(msg);
      log("❌ خطا", { message: msg, raw: e });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Debug Auth (Wallet → SIWE → JWT → /me)</h1>

      <div style={{ marginTop: 12, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
        <div><b>ENV</b></div>
        <div>NEXT_PUBLIC_API_BASE_URL: <code>{apiBase || "undefined"}</code></div>

        <hr style={{ margin: "12px 0" }} />

        <div><b>Web3</b></div>
        <div>Ready: {String(isReady)}</div>
        <div>Connecting: {String(isConnecting)}</div>
        <div>Account: {account ? <code>{account}</code> : "-" } ({short(account)})</div>
        <div>ChainId: {chainId ?? "-"}</div>
        <div>Correct Chain: {String(isCorrectChain)}</div>
        {web3Error ? <div style={{ color: "red" }}>Web3 Error: {web3Error}</div> : null}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={connect} disabled={isConnecting || busy}>
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
          <button onClick={refresh} disabled={busy}>Refresh</button>
          {logout ? (
            <button onClick={logout} disabled={busy}>Logout</button>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={doLoginTest} disabled={!isReady || busy}>
            {busy ? "Testing..." : "Run Login Test (nonce → sign → verify → me)"}
          </button>
        </div>

        {authError ? (
          <div style={{ marginTop: 12, color: "red" }}>
            <b>Auth Error:</b> {authError}
          </div>
        ) : null}

        <div style={{ marginTop: 12 }}>
          <b>Result</b>
          <div style={{ marginTop: 8 }}>
            <div><b>Tokens (from this page)</b></div>
            <pre style={{ whiteSpace: "pre-wrap" }}>{tokens ? JSON.stringify(tokens, null, 2) : "-"}</pre>
          </div>

          <div style={{ marginTop: 8 }}>
            <div><b>/me (from this page)</b></div>
            <pre style={{ whiteSpace: "pre-wrap" }}>{me ? JSON.stringify(me, null, 2) : "-"}</pre>
          </div>

          <div style={{ marginTop: 8 }}>
            <div><b>Provider State (اگر داری)</b></div>
            <div>accessToken: {accessToken ? "YES" : "NO"}</div>
            <div>profile: {profile ? "YES" : "NO"}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
        <div><b>Logs</b></div>
        <div style={{ fontSize: 12, color: "#666" }}>
          اگر خطا داری، همین Logs رو کپی کن بفرست تا دقیق بگم مشکل کجاست.
        </div>
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {logs.length === 0 ? (
            <div>-</div>
          ) : (
            logs.map((x, idx) => (
              <div key={idx} style={{ padding: 12, background: "#fafafa", borderRadius: 10, border: "1px solid #eee" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <b>{x.title}</b>
                  <span style={{ color: "#888" }}>{x.at}</span>
                </div>
                <pre style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                  {typeof x.data === "string" ? x.data : JSON.stringify(x.data, null, 2)}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}