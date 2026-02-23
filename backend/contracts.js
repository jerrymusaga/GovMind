import { ethers } from "ethers";

const AI_ORACLE_ABI = [
  "function publishAnalysis(uint256 _referendumIndex, uint8 _track, uint8 _riskScore, uint8 _categoryId, int8 _recommendation, uint8 _confidence, uint256 _requestedAmountDOT, uint256 _treasuryImpactBps, string calldata _analysisIPFSHash) external",
  "function hasAnalysis(uint256 _referendumIndex) external view returns (bool)",
  "event AnalysisPublished(uint256 indexed referendumIndex, uint8 riskScore, int8 recommendation, uint8 confidence)",
];

let _provider;
let _signer;
let _oracle;

function getProvider() {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(
      process.env.RPC_URL || "https://services.polkadothub-rpc.com/testnet"
    );
  }
  return _provider;
}

function getSigner() {
  if (!_signer) {
    _signer = new ethers.Wallet(process.env.PRIVATE_KEY, getProvider());
  }
  return _signer;
}

function getOracle() {
  if (!_oracle) {
    const address =
      process.env.AI_ORACLE_ADDRESS ||
      "0x0D32685A3b5F3618B8bd6B8f22e748E50144b7EE";
    _oracle = new ethers.Contract(address, AI_ORACLE_ABI, getSigner());
  }
  return _oracle;
}

/**
 * Check if a referendum already has an on-chain analysis
 */
export async function hasExistingAnalysis(referendumIndex) {
  const oracle = getOracle();
  return oracle.hasAnalysis(referendumIndex);
}

/**
 * Publish AI analysis to the AIOracle contract
 */
export async function publishAnalysis(referendumIndex, track, analysis) {
  const oracle = getOracle();

  const exists = await oracle.hasAnalysis(referendumIndex);
  if (exists) {
    console.log(`  Referendum ${referendumIndex} already analyzed on-chain, skipping.`);
    return null;
  }

  const ipfsHash = `QmGovMind_${referendumIndex}`;

  // Convert requestedAmountDOT to wei-like units (whole DOT as uint256)
  const requestedAmount = ethers.parseUnits(
    String(Math.floor(analysis.requestedAmountDOT)),
    0
  );

  const tx = await oracle.publishAnalysis(
    referendumIndex,
    track,
    analysis.riskScore,
    analysis.categoryId,
    analysis.recommendation,
    analysis.confidence,
    requestedAmount,
    analysis.treasuryImpactBps,
    ipfsHash
  );

  console.log(`  TX sent: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`  Confirmed in block ${receipt.blockNumber}`);

  return receipt;
}

/**
 * Get the oracle wallet address for logging
 */
export function getOracleAddress() {
  return getSigner().address;
}
