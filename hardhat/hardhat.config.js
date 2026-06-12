require("@nomicfoundation/hardhat-ethers");
require("dotenv").config();

const fs = require("fs");
const path = require("path");

// Single source of truth is ../contracts — sync those .sol files into
// ./contracts on every Hardhat invocation (HH1007 forbids out-of-root sources).
const SRC_DIR = path.resolve(__dirname, "..", "contracts");
const DST_DIR = path.resolve(__dirname, "contracts");
fs.mkdirSync(DST_DIR, { recursive: true });
for (const f of fs.readdirSync(SRC_DIR)) {
  if (f.endsWith(".sol")) {
    fs.copyFileSync(path.join(SRC_DIR, f), path.join(DST_DIR, f));
  }
}

const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    sepolia: {
      url: SEPOLIA_RPC_URL,
      chainId: 11155111,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
  },
};
