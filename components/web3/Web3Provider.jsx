"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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

const Web3Context = createContext(null);

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

  const refresh = useCallback(async () => {
    setError("");
    try {
      const eth = getEthereum();
      if (!eth) {
        // no wallet: still mark ready so UI can show "Install MetaMask"
        setAccount("");
        setChainId(null);
        setIsCorrectChain(false);
        setProvider(null);
        setSigner(null);
        setContracts({ sg: null, token: null });
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
        // read+write contracts via signer
        setContracts(getContracts(s));
      } else {
        setSigner(null);
        // read-only contracts via provider
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
      // ensure chain after connect
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

  // Soft disconnect: we cannot force MetaMask to disconnect programmatically
  // but we can clear app state.
  const disconnect = useCallback(() => {
    setAccount("");
    setSigner(null);
    setError("");
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
  }, []);

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

  useEffect(() => {
    refresh();
    const unsub = onWalletEvents({
      onAccountsChanged: () => refresh(),
      onChainChanged: () => refresh(),
      onDisconnect: () => refresh(),
    });
    return () => unsub();
  }, [refresh]);

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

      // actions
      connect,
      disconnect,
      refresh,
      switchToTargetChain,

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
      connect,
      disconnect,
      refresh,
      switchToTargetChain,
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
