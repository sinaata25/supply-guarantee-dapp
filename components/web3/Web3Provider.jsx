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

// ✅ این 3 تا تابع رو از فایل api که ساختیم ایمپورت کن
// مسیرش رو مطابق پروژه خودت تنظیم کن.
// مثال: اگر گذاشتی تو lib/api.js → "@/lib/api"
import { requestNonce, verifySignature, getMe } from "@/lib/api";

const Web3Context = createContext(null);

function safeLoadAccessToken() {
  try {
    return localStorage.getItem("accessToken") || "";
  } catch {
    return "";
  }
}

function safeSaveAccessToken(token) {
  try {
    localStorage.setItem("accessToken", token);
  } catch {}
}

function safeClearAccessToken() {
  try {
    localStorage.removeItem("accessToken");
  } catch {}
}

export function Web3Provider({ children }) {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState(null);
  const [isCorrectChain, setIsCorrectChain] = useState(false);

  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);

  const [contracts, setContracts] = useState({ sg: null, token: null });

  const [isReady, setIsReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");

  // ✅ Auth/Profile state
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [profile, setProfile] = useState(null);

  // load access token once on mount
  useEffect(() => {
    setAccessToken(safeLoadAccessToken());
  }, []);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const eth = getEthereum();
      if (!eth) {
        // no wallet
        setAccount("");
        setChainId(null);
        setIsCorrectChain(false);
        setProvider(null);
        setSigner(null);
        setContracts({ sg: null, token: null });
        setIsReady(true);

        // also clear auth/profile
        setProfile(null);
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

  // ✅ Login with SIWE-style flow:
  // POST /api/accounts/auth/nonce/ -> sign message -> POST /api/accounts/auth/verify/
  // then GET /api/accounts/me/
  const login = useCallback(async () => {
    if (!provider) throw new Error("No provider");
    if (!account) throw new Error("No account connected");

    setIsAuthLoading(true);
    setError("");

    try {
      // 1) chain id
      const cid = await getChainId();
      const chain = cid ?? WEB3_CONFIG.chainId;

      // 2) request nonce+message from backend
      const nonceRes = await requestNonce(account, chain);

      // 3) sign the exact message
      const s = await provider.getSigner();
      const signature = await s.signMessage(nonceRes.message);

      // 4) verify -> jwt
      const tokens = await verifySignature(account, signature);

      // ✅ save access token
      setAccessToken(tokens.access);
      safeSaveAccessToken(tokens.access);

      // 5) fetch profile
      const me = await getMe(tokens.access);
      setProfile(me);

      return me;
    } catch (e) {
      setProfile(null);
      setAccessToken("");
      safeClearAccessToken();
      setError(e?.message || "Auth failed");
      throw e;
    } finally {
      setIsAuthLoading(false);
    }
  }, [provider, account]);

  const logout = useCallback(() => {
    setProfile(null);
    setAccessToken("");
    safeClearAccessToken();
  }, []);

  // Soft disconnect (wallet itself disconnect نمی‌شود)
  const disconnect = useCallback(() => {
    setAccount("");
    setSigner(null);
    setError("");
    setProfile(null);

    // ✅ logout on disconnect
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
      if (!chk.ok) {
        throw new Error("Failed to switch network in wallet");
      }
      await refresh();
    } catch (e) {
      setError(e?.message || "Switch network failed");
    }
  }, [refresh]);

  // init + wallet events
  useEffect(() => {
    refresh();
    const unsub = onWalletEvents({
      onAccountsChanged: () => refresh(),
      onChainChanged: () => refresh(),
      onDisconnect: () => refresh(),
    });
    return () => unsub();
  }, [refresh]);

  // ✅ وقتی account وصل شد: اتومات login کن (اگر دوست نداری، این useEffect رو حذف کن)
  useEffect(() => {
    if (!account || !provider) return;
    // فقط اگر پروفایل نداریم لاگین کنیم
    if (!profile) {
      login().catch(() => {});
    }
  }, [account, provider, profile, login]);

  // ✅ اگر accessToken داریم ولی profile نداریم، یکبار /me رو بزن
  useEffect(() => {
    if (!accessToken || profile) return;

    getMe(accessToken)
      .then((me) => setProfile(me))
      .catch(() => {
        // توکن منقضی/خراب
        logout();
      });
  }, [accessToken, profile, logout]);

  const value = useMemo(
    () => ({
      // state
      isReady,
      isConnecting,
      error,

      account,
      chainId,
      isCorrectChain,

      provider,
      signer,
      contracts,

      // ✅ auth/profile
      isAuthLoading,
      accessToken,
      profile,

      // actions
      connect,
      disconnect,
      refresh,
      switchToTargetChain,

      // ✅ auth actions
      login,
      logout,

      // utils
      ethers,
    }),
    [
      isReady,
      isConnecting,
      error,
      account,
      chainId,
      isCorrectChain,
      provider,
      signer,
      contracts,
      isAuthLoading,
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
  if (!ctx) {
    throw new Error("useWeb3 must be used inside <Web3Provider />");
  }
  return ctx;
}