const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/";

const API_PREFIX = "api/accounts/";

export async function requestNonce(address, chainId) {
  const res = await fetch(`${API_BASE}${API_PREFIX}auth/nonce/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, chain_id: chainId }),
  });

  if (!res.ok) throw new Error("Nonce failed");
  return res.json();
}

export async function verifySignature(address, signature) {
  const res = await fetch(`${API_BASE}${API_PREFIX}auth/verify/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, signature }),
  });

  if (!res.ok) throw new Error("Verify failed");
  return res.json();
}

export async function getMe(token) {
  const res = await fetch(`${API_BASE}${API_PREFIX}me/`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error("Get profile failed");
  return res.json();
}

/**
 * Best-effort: ask the backend to SMS the next actor about an order stage change.
 * The backend only sends if that wallet has a phone number on file.
 * Never throws — notifications are non-critical.
 */
export async function notifyOrderStage({ walletAddress, orderstage, orderId }, token) {
  try {
    const res = await fetch(`${API_BASE}${API_PREFIX}notify/order-stage/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        wallet_address: walletAddress,
        orderstage,
        order_id: orderId ?? "",
      }),
    });
    return await res.json().catch(() => ({}));
  } catch {
    return { sent: false };
  }
}