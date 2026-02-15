import { ethers } from "ethers";
import { WEB3_CONFIG, invariantEnv } from "./config";
import { SG_ABI, ERC20_ABI } from "./abi";

// ---------- helpers ----------
export function shorten(addr, left = 6, right = 4) {
  if (!addr) return "";
  return `${addr.slice(0, left)}…${addr.slice(-right)}`;
}

export function isBrowser() {
  return typeof window !== "undefined";
}

export function getEthereum() {
  if (!isBrowser()) return null;
  return window.ethereum || null;
}

// ---------- provider/signer ----------
export function getBrowserProvider() {
  const eth = getEthereum();
  if (!eth) throw new Error("MetaMask / wallet not found");
  // EIP-1193 provider
  return new ethers.BrowserProvider(eth);
}

export async function getSigner() {
  const provider = getBrowserProvider();
  return await provider.getSigner();
}

export async function getAddress() {
  const signer = await getSigner();
  return await signer.getAddress();
}

// ---------- chain checks ----------
export async function getChainId() {
  const provider = getBrowserProvider();
  const network = await provider.getNetwork();
  return Number(network.chainId);
}

export async function ensureCorrectChain() {
  invariantEnv();
  const target = WEB3_CONFIG.chainId;
  const eth = getEthereum();
  if (!eth) throw new Error("Wallet not found");

  const current = await getChainId();
  if (current === target) return { ok: true, current, target };

  // try switch
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ethers.toBeHex(target) }],
    });
    return { ok: true, current: target, target };
  } catch (e) {
    // If chain not added, user must add it manually (or we can implement wallet_addEthereumChain if you want)
    return { ok: false, current, target, error: e };
  }
}

// ---------- connect / disconnect-ish ----------
export async function connectWallet() {
  const eth = getEthereum();
  if (!eth) throw new Error("MetaMask / wallet not found");

  // Request accounts
  const accounts = await eth.request({ method: "eth_requestAccounts" });
  const account = accounts?.[0];
  if (!account) throw new Error("No account returned from wallet");

  // Optional: chain check
  const chainCheck = await ensureCorrectChain();
  return { account, chainCheck };
}

export async function getConnectedAccounts() {
  const eth = getEthereum();
  if (!eth) return [];
  const accounts = await eth.request({ method: "eth_accounts" });
  return accounts || [];
}

// ---------- contracts ----------
export function getContracts(signerOrProvider) {
  invariantEnv();

  const sg = new ethers.Contract(WEB3_CONFIG.sgAddress, SG_ABI, signerOrProvider);
  const token = new ethers.Contract(WEB3_CONFIG.tokenAddress, ERC20_ABI, signerOrProvider);

  return { sg, token };
}

export async function getReadContracts() {
  const provider = getBrowserProvider();
  return getContracts(provider);
}

export async function getWriteContracts() {
  const signer = await getSigner();
  return getContracts(signer);
}

// ---------- listeners ----------
export function onWalletEvents({ onAccountsChanged, onChainChanged, onDisconnect } = {}) {
  const eth = getEthereum();
  if (!eth) return () => {};

  const handleAccounts = (accs) => onAccountsChanged && onAccountsChanged(accs);
  const handleChain = (chainIdHex) => onChainChanged && onChainChanged(chainIdHex);
  const handleDisconnect = (err) => onDisconnect && onDisconnect(err);

  eth.on?.("accountsChanged", handleAccounts);
  eth.on?.("chainChanged", handleChain);
  eth.on?.("disconnect", handleDisconnect);

  // unsubscribe
  return () => {
    eth.removeListener?.("accountsChanged", handleAccounts);
    eth.removeListener?.("chainChanged", handleChain);
    eth.removeListener?.("disconnect", handleDisconnect);
  };
}
