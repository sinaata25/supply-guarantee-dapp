/**
 * Deploys SupplyGuarantee to Sepolia and wires the new address into:
 *   - ../.env.local            (NEXT_PUBLIC_SG_ADDRESS)
 *   - ../supp/subgraph.yaml    (address + startBlock)
 *   - ../supp/networks.json    (address + startBlock)
 *   - ../supp/abis/SupplyGuarantee.json (fresh ABI from the compiled artifact)
 *   - ../lib/abi/SupplyGuarantee.json   (kept in sync for reference)
 *
 * Usage: npm run deploy:sepolia   (needs DEPLOYER_PRIVATE_KEY in hardhat/.env)
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const ROOT = path.resolve(__dirname, "..", "..");

function patchFile(file, replacer) {
  const before = fs.readFileSync(file, "utf8");
  const after = replacer(before);
  fs.writeFileSync(file, after);
  console.log(`  patched ${path.relative(ROOT, file)}`);
}

async function main() {
  const { ethers } = hre;

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No deployer account. Put DEPLOYER_PRIVATE_KEY=0x... in hardhat/.env"
    );
  }

  console.log("Deployer:", deployer.address);
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log("Balance :", ethers.formatEther(bal), "ETH (Sepolia)");
  if (bal === 0n) {
    throw new Error("Deployer has 0 Sepolia ETH — fund it from a faucet first.");
  }

  console.log("\nDeploying SupplyGuarantee (initialOwner = deployer)...");
  const Factory = await ethers.getContractFactory("SupplyGuarantee");
  const contract = await Factory.deploy(deployer.address);
  const tx = contract.deploymentTransaction();
  const receipt = await tx.wait();

  const address = await contract.getAddress();
  const startBlock = receipt.blockNumber;
  console.log("Deployed at:", address);
  console.log("Block      :", startBlock);

  // --- sanity check: the deployed bytecode must contain the staged-escrow selectors ---
  const code = await ethers.provider.getCode(address);
  const mustHave = {
    "fundAdvance(uint256)": null,
    "fundMilestone(uint256,uint8)": null,
    "getOrderEscrow(uint256)": null,
    "cancelByAdmin(uint256,string)": null,
  };
  let ok = true;
  for (const sig of Object.keys(mustHave)) {
    const sel = ethers.id(sig).slice(2, 10);
    const present = code.includes(sel);
    console.log(present ? "  ✓" : "  ✗", sig);
    if (!present) ok = false;
  }
  if (!ok) throw new Error("Deployed bytecode is missing expected functions — aborting wiring.");

  console.log("\nWiring project files...");

  // .env.local
  patchFile(path.join(ROOT, ".env.local"), (s) =>
    s.replace(/^NEXT_PUBLIC_SG_ADDRESS=.*$/m, `NEXT_PUBLIC_SG_ADDRESS=${address}`)
  );

  // supp/networks.json
  const networksFile = path.join(ROOT, "supp", "networks.json");
  const networks = JSON.parse(fs.readFileSync(networksFile, "utf8"));
  networks.sepolia.SupplyGuarantee.address = address;
  networks.sepolia.SupplyGuarantee.startBlock = startBlock;
  fs.writeFileSync(networksFile, JSON.stringify(networks, null, 2) + "\n");
  console.log("  patched supp/networks.json");

  // supp/subgraph.yaml
  patchFile(path.join(ROOT, "supp", "subgraph.yaml"), (s) =>
    s
      .replace(/address: "0x[0-9a-fA-F]{40}"/, `address: "${address}"`)
      .replace(/startBlock: \d+/, `startBlock: ${startBlock}`)
  );

  // ABIs from the compiled artifact
  const artifact = await hre.artifacts.readArtifact("SupplyGuarantee");
  const abiJson = JSON.stringify(artifact.abi, null, 2) + "\n";
  fs.writeFileSync(path.join(ROOT, "supp", "abis", "SupplyGuarantee.json"), abiJson);
  console.log("  wrote supp/abis/SupplyGuarantee.json");
  const libAbiDir = path.join(ROOT, "lib", "abi");
  if (fs.existsSync(libAbiDir)) {
    fs.writeFileSync(path.join(libAbiDir, "SupplyGuarantee.json"), abiJson);
    console.log("  wrote lib/abi/SupplyGuarantee.json");
  }

  console.log("\n✅ Done.");
  console.log("Next steps:");
  console.log("  1. Restart the Next.js dev server (env changed).");
  console.log("  2. cd supp && npx graph codegen && npx graph build");
  console.log("     npx graph auth <STUDIO_DEPLOY_KEY> && npm run deploy");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
