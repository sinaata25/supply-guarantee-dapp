// IPFS (Pinata) helpers.
//
// The contract anchors documents as bytes32 hashes. A CIDv0 ("Qm...") is a
// base58-encoded sha2-256 multihash: 0x12 0x20 + 32-byte digest. So we store
// the 32-byte digest on-chain and can always reconstruct the full CID from it
// — no contract changes needed, and every anchored doc is fetchable from any
// IPFS gateway.

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/";
const API_PREFIX = "api/accounts/";

export const IPFS_GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs";

/* ---------------- base58 (bitcoin alphabet) ---------------- */

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const B58_MAP = Object.fromEntries([...B58].map((c, i) => [c, i]));

function b58decode(str) {
  let bytes = [0];
  for (const c of str) {
    const v = B58_MAP[c];
    if (v === undefined) throw new Error("Invalid base58 character");
    let carry = v;
    for (let i = 0; i < bytes.length; i++) {
      const x = bytes[i] * 58 + carry;
      bytes[i] = x & 0xff;
      carry = x >> 8;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // leading zeros
  for (const c of str) {
    if (c !== "1") break;
    bytes.push(0);
  }
  return Uint8Array.from(bytes.reverse());
}

function b58encode(bytes) {
  let digits = [0];
  for (const b of bytes) {
    let carry = b;
    for (let i = 0; i < digits.length; i++) {
      const x = (digits[i] << 8) + carry;
      digits[i] = x % 58;
      carry = (x / 58) | 0;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "";
  for (const b of bytes) {
    if (b !== 0) break;
    out += "1";
  }
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
  return out;
}

/* ---------------- CID <-> bytes32 ---------------- */

/** "Qm..." CIDv0 -> "0x" + 64 hex chars (the sha2-256 digest). */
export function cidToBytes32(cid) {
  const raw = b58decode(String(cid).trim());
  if (raw.length !== 34 || raw[0] !== 0x12 || raw[1] !== 0x20) {
    throw new Error("Not a CIDv0 sha2-256 multihash");
  }
  return "0x" + [...raw.slice(2)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** "0x" + 64 hex chars -> "Qm..." CIDv0. Returns null for zero/invalid hashes. */
export function bytes32ToCid(hex) {
  const h = String(hex || "").replace(/^0x/i, "");
  if (h.length !== 64 || /^0+$/.test(h)) return null;
  const digest = h.match(/.{2}/g).map((x) => parseInt(x, 16));
  return b58encode(Uint8Array.from([0x12, 0x20, ...digest]));
}

export function ipfsUrlFromBytes32(hex) {
  const cid = bytes32ToCid(hex);
  return cid ? `${IPFS_GATEWAY}/${cid}` : null;
}

/* ---------------- upload through the backend ---------------- */

/**
 * Uploads a file to IPFS via the backend Pinata proxy.
 * Returns { cid, gatewayUrl, hash32 } or throws with a readable message.
 */
export async function uploadToIpfs(file, token) {
  if (!token) {
    throw new Error("You must log in first — use the Login button in the header, then retry the upload.");
  }

  const fd = new FormData();
  fd.append("file", file, file.name);

  const res = await fetch(`${API_BASE}${API_PREFIX}ipfs/upload/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });

  let data = {};
  try {
    data = await res.json();
  } catch {}

  if (res.status === 401) {
    throw new Error("Session expired — click Login again, then retry the upload.");
  }
  if (!res.ok) {
    throw new Error(data?.detail ? String(data.detail) : `Upload failed (HTTP ${res.status})`);
  }

  const cid = data.cid;
  return {
    cid,
    gatewayUrl: data.gateway_url || `${IPFS_GATEWAY}/${cid}`,
    hash32: cidToBytes32(cid),
  };
}
