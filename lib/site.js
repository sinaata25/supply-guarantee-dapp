export const SITE = {
  name: "SupplyGuarantee",
  tagline: "Milestone-based escrow for construction supply chains.",
  // اگر ریپو داری اینجا بگذار
  github: "https://github.com/your-org/supplyguarantee",
  // اگر داکس جدا داری اینجا بگذار
  docs: "https://github.com/your-org/supplyguarantee#readme",
};

export function explorerBaseByChainId(chainId) {
  // فقط چند شبکه رایج؛ بعداً هرچی خواستی اضافه می‌کنیم
  switch (Number(chainId)) {
    case 1:
      return "https://etherscan.io";
    case 11155111:
      return "https://sepolia.etherscan.io";
    case 137:
      return "https://polygonscan.com";
    case 80002:
      return "https://amoy.polygonscan.com";
    case 56:
      return "https://bscscan.com";
    case 97:
      return "https://testnet.bscscan.com";
    default:
      return ""; // unknown
  }
}
