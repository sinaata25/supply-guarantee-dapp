export const WEB3_CONFIG = {
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 0),

  // Support both env names to avoid breaking changes
  sgAddress:
    process.env.NEXT_PUBLIC_SG_ADDRESS ||
    process.env.NEXT_PUBLIC_SUPPLY_ADDRESS ||
    "",

  tokenAddress: process.env.NEXT_PUBLIC_TOKEN_ADDRESS || "",
};

export function invariantEnv() {
  const missing = [];
  if (!WEB3_CONFIG.chainId) missing.push("NEXT_PUBLIC_CHAIN_ID");
  if (!WEB3_CONFIG.sgAddress) missing.push("NEXT_PUBLIC_SG_ADDRESS or NEXT_PUBLIC_SUPPLY_ADDRESS");
  if (!WEB3_CONFIG.tokenAddress) missing.push("NEXT_PUBLIC_TOKEN_ADDRESS");

  if (missing.length) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }
}
