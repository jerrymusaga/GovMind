/**
 * Deploy PVM Contracts — Rust RISC-V binaries to Polkadot Hub PVM
 *
 * Deploys:
 *   1. ScaleCodecPVM  (Rust SCALE encoder)
 *   2. AlignmentScorer (Rust governance personalization)
 *
 * Then wires them into the existing EVM contracts:
 *   - XCMGovernanceRelay.setPVMCodec(scaleCodecAddr, true)
 *   - GovMindCore.setPVMScorer(alignmentScorerAddr, true)
 *
 * Usage:
 *   node pvm-contracts/deploy.js
 *
 * Requires:
 *   - .env with PRIVATE_KEY and RPC_URL
 *   - Built .polkavm binaries (run pvm-contracts/build.sh first)
 *   - Deployed EVM contracts (XCMGovernanceRelay + GovMindCore addresses)
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Contract addresses (update after EVM deployment)
const XCM_RELAY_ADDRESS = process.env.XCM_RELAY_ADDRESS || "0x246DE6C6e938f70305B6919C94e4D103c0D7d45f";
const GOVMIND_CORE_ADDRESS = process.env.GOVMIND_CORE_ADDRESS || "0x018aC1f307d6b2FD1426458Df4d32e306660398a";

const RPC_URL = process.env.RPC_URL || "https://services.polkadothub-rpc.com/testnet";

// ABIs for the admin functions we need to call
const XCM_RELAY_ABI = [
  "function setPVMCodec(address _codec, bool _enabled) external",
  "function usePVMCodec() view returns (bool)",
  "function scaleCodecPVM() view returns (address)",
];

const GOVMIND_CORE_ABI = [
  "function setPVMScorer(address _scorer, bool _enabled) external",
  "function usePVMScorer() view returns (bool)",
  "function alignmentScorerPVM() view returns (address)",
];

function loadBlob(name) {
  const candidates = [
    path.join(__dirname, `${name}/${name}.polkavm`),
    path.join(__dirname, `${name}/target/riscv64emac-unknown-none-polkavm/release/${name}`),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p);
    }
  }
  throw new Error(
    `PVM binary not found for ${name}. Run ./pvm-contracts/build.sh first.`
  );
}

function sep(label) {
  console.log(`\n${"─".repeat(56)}\n  ${label}\n${"─".repeat(56)}`);
}

async function main() {
  sep("GovMind PVM Contract Deployment");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const balance = await provider.getBalance(wallet.address);

  console.log(`\n  Deployer : ${wallet.address}`);
  console.log(`  Balance  : ${ethers.formatEther(balance)} PAS`);
  console.log(`  Network  : ${RPC_URL}`);

  if (balance === 0n) {
    console.error("\n  No balance. Get PAS at: https://faucet.polkadot.io");
    process.exit(1);
  }

  // ── 1. Deploy SCALE Codec PVM ──────────────────────────────────────
  console.log("\n  [1/4] Deploying ScaleCodecPVM (Rust → RISC-V → PVM)...");
  const scaleBlob = loadBlob("scale-codec");
  console.log(`      Binary: ${scaleBlob.length} bytes`);

  const scaleTx = await wallet.sendTransaction({
    data: "0x" + scaleBlob.toString("hex"),
  });
  const scaleReceipt = await scaleTx.wait();
  const scaleAddress = scaleReceipt.contractAddress;
  console.log(`      ScaleCodecPVM @ ${scaleAddress}`);

  // ── 2. Deploy Alignment Scorer PVM ─────────────────────────────────
  console.log("\n  [2/4] Deploying AlignmentScorer (Rust → RISC-V → PVM)...");
  const alignBlob = loadBlob("alignment-scorer");
  console.log(`      Binary: ${alignBlob.length} bytes`);

  const alignTx = await wallet.sendTransaction({
    data: "0x" + alignBlob.toString("hex"),
  });
  const alignReceipt = await alignTx.wait();
  const alignAddress = alignReceipt.contractAddress;
  console.log(`      AlignmentScorer @ ${alignAddress}`);

  // ── 3. Wire PVM SCALE Codec into XCMGovernanceRelay ────────────────
  console.log("\n  [3/4] Wiring ScaleCodecPVM into XCMGovernanceRelay...");
  const xcmRelay = new ethers.Contract(XCM_RELAY_ADDRESS, XCM_RELAY_ABI, wallet);
  const tx3 = await xcmRelay.setPVMCodec(scaleAddress, true);
  await tx3.wait();
  console.log(`      setPVMCodec(${scaleAddress}, true) — done`);

  // ── 4. Wire PVM Alignment Scorer into GovMindCore ──────────────────
  console.log("\n  [4/4] Wiring AlignmentScorer into GovMindCore...");
  const govMindCore = new ethers.Contract(GOVMIND_CORE_ADDRESS, GOVMIND_CORE_ABI, wallet);
  const tx4 = await govMindCore.setPVMScorer(alignAddress, true);
  await tx4.wait();
  console.log(`      setPVMScorer(${alignAddress}, true) — done`);

  // ── Summary ────────────────────────────────────────────────────────
  sep("PVM Deployment Complete");
  console.log(`
  Architecture:
    GovMindCore.sol [EVM]
      └─ AlignmentScorer [PVM / Rust] @ ${alignAddress}
           Cross-VM: alignment scoring on RISC-V

    XCMGovernanceRelay.sol [EVM]
      └─ ScaleCodecPVM [PVM / Rust] @ ${scaleAddress}
           Cross-VM: SCALE encoding on RISC-V
      └─ XCM Precompile (0x0A0000)
           Cross-chain vote relay to Relay Chain

  Two VMs. Three layers. No bridge.
  `);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
