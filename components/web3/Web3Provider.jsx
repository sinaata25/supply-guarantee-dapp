"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ethers } from "ethers";
import {
  connectWallet,
  ensureCorrectChain,
  getBrowserProvider,
  getChainId,
  getConnectedAccounts,
  getContracts,
  getEthereum,
  onWalletEvents,
} from "@/lib/web3";
import { WEB3_CONFIG } from "@/lib/web3/config";

// ✅ مسیر را مطابق پروژه‌ات درست کن
import { requestNonce, verifySignature, getMe } from "@/lib/api";

const Web3Context = createContext(null);

function safeGet(key, fallback = "") {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function safeDel(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function Web3Provider({ children }) {
  // ---- Web3 state ----
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState(null);
  const [isCorrectChain, setIsCorrectChain] = useState(false);

  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);

  const [contracts, setContracts] = useState({ sg: null, token: null });

  const [isReady, setIsReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");

  // ---- Auth/Profile state ----
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [profile, setProfile] = useState(null);

  // Load token once
  useEffect(() => {
    setAccessToken(safeGet("accessToken", ""));
  }, []);

  // ---- refresh wallet state (NO sign, NO popup) ----
  const refresh = useCallback(async () => {
    setError("");
    try {
      const eth = getEthereum();
      if (!eth) {
        setAccount("");
        setChainId(null);
        setIsCorrectChain(false);
        setProvider(null);
        setSigner(null);
        setContracts({ sg: null, token: null });
        setProfile(null);
        setIsReady(true);
        return;
      }

      const accs = await getConnectedAccounts();
      const acc = accs?.[0] || "";
      setAccount(acc);

      const p = getBrowserProvider();
      setProvider(p);

      const cid = await getChainId();
      setChainId(cid);

      const ok = cid === WEB3_CONFIG.chainId;
      setIsCorrectChain(ok);

      if (acc) {
        const s = await p.getSigner();
        setSigner(s);
        setContracts(getContracts(s));
      } else {
        setSigner(null);
        setContracts(getContracts(p));
      }

      setIsReady(true);
    } catch (e) {
      setError(e?.message || "Web3 refresh failed");
      setIsReady(true);
    }
  }, []);

  // ---- connect wallet (still NO sign) ----
  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError("");
    try {
      await connectWallet();

      const chk = await ensureCorrectChain();
      if (!chk.ok) {
        throw new Error(
          `Wrong network. Please switch to chainId ${WEB3_CONFIG.chainId} (target), current=${chk.current}`
        );
      }

      await refresh();
    } catch (e) {
      setError(e?.message || "Connect failed");
    } finally {
      setIsConnecting(false);
    }
  }, [refresh]);

  // ---- logout (clear tokens/profile, NO wallet disconnect) ----
  const logout = useCallback(() => {
    setProfile(null);
    setAccessToken("");
    safeDel("accessToken");
  }, []);

  // Soft disconnect (clear app state)
  const disconnect = useCallback(() => {
    setAccount("");
    setSigner(null);
    setError("");

    // also logout
    logout();

    // keep provider for read-only if possible
    try {
      const eth = getEthereum();
      if (eth) {
        const p = getBrowserProvider();
        setProvider(p);
        setContracts(getContracts(p));
      } else {
        setProvider(null);
        setContracts({ sg: null, token: null });
      }
    } catch {
      setProvider(null);
      setContracts({ sg: null, token: null });
    }
  }, [logout]);

  const switchToTargetChain = useCallback(async () => {
    setError("");
    try {
      const chk = await ensureCorrectChain();
      if (!chk.ok) throw new Error("Failed to switch network in wallet");
      await refresh();
    } catch (e) {
      setError(e?.message || "Switch network failed");
    }
  }, [refresh]);

  // ---- login (THIS triggers MetaMask popup because it signs) ----
  // ✅ فقط وقتی کاربر کلیک می‌کند صدا بزن (نه auto on refresh)
  const login = useCallback(async () => {
    if (!provider) throw new Error("No provider");
    if (!account) throw new Error("Wallet not connected");
    if (!isCorrectChain) {
      throw new Error(`Wrong network. Please switch to chainId ${WEB3_CONFIG.chainId}`);
    }

    setIsAuthLoading(true);
    setError("");

    try {
      const chain = chainId ?? WEB3_CONFIG.chainId;

      // 1) nonce/message
      const nonceRes = await requestNonce(account, chain);

      // 2) sign
      const s = await provider.getSigner();
      const signature = await s.signMessage(nonceRes.message);

      // 3) verify -> tokens
      const tokens = await verifySignature(account, signature);

      setAccessToken(tokens.access);
      safeSet("accessToken", tokens.access);

      // 4) me
      const me = await getMe(tokens.access);
      setProfile(me);

      return me;
    } catch (e) {
      logout();
      setError(e?.message || "Auth failed");
      throw e;
    } finally {
      setIsAuthLoading(false);
    }
  }, [provider, account, chainId, isCorrectChain, logout]);

  // ---- Load profile using existing token (NO sign, NO popup) ----
  useEffect(() => {
    if (!accessToken || profile) return;

    getMe(accessToken)
      .then((me) => setProfile(me))
      .catch(() => {
        // token invalid/expired -> clear and require manual login
        logout();
      });
  }, [accessToken, profile, logout]);

  // init + wallet events
  useEffect(() => {
    refresh();
    const unsub = onWalletEvents({
      onAccountsChanged: () => {
        // account changed -> clear auth, then refresh
        logout();
        refresh();
      },
      onChainChanged: () => {
        // chain changed -> clear auth, then refresh
        logout();
        refresh();
      },
      onDisconnect: () => {
        logout();
        refresh();
      },
    });
    return () => unsub();
  }, [refresh, logout]);

  const value = useMemo(
    () => ({
      // state
      isReady,
      isConnecting,
      isAuthLoading,
      error,

      account,
      chainId,
      isCorrectChain,

      provider,
      signer,
      contracts,

      // auth/profile
      accessToken,
      profile,

      // actions
      connect,
      disconnect,
      refresh,
      switchToTargetChain,

      // auth actions
      login,
      logout,

      // utils
      ethers,
    }),
    [
      isReady,
      isConnecting,
      isAuthLoading,
      error,
      account,
      chainId,
      isCorrectChain,
      provider,
      signer,
      contracts,
      accessToken,
      profile,
      connect,
      disconnect,
      refresh,
      switchToTargetChain,
      login,
      logout,
    ]
  );

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
}

export function useWeb3() {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error("useWeb3 must be used inside <Web3Provider />");
  return ctx;
}