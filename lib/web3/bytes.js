import { ethers } from "ethers";

export function toBytes32Label(text) {
  // مناسب برای name milestone مثل "m1" یا "steel_1"
  return ethers.encodeBytes32String(String(text || "").slice(0, 31));
}
