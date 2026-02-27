import { ethers } from "ethers";

const AI_ORACLE_ABI = [
  "function publishAnalysis(uint256 _referendumIndex, uint8 _track, uint8 _riskScore, uint8 _categoryId, int8 _recommendation, uint8 _confidence, uint256 _requestedAmountDOT, uint256 _treasuryImpactBps, string calldata _analysisIPFSHash) external",
  "function updateAnalysis(uint256 _referendumIndex, uint8 _riskScore, uint8 _categoryId, int8 _recommendation, uint8 _confidence, uint256 _requestedAmountDOT, uint256 _treasuryImpactBps, string calldata _analysisIPFSHash) external",
  "function hasAnalysis(uint256 _referendumIndex) external view returns (bool)",
  "function getAnalysisVersion(uint256 _referendumIndex) external view returns (uint256)",
  "function getAnalysis(uint256 _referendumIndex) external view returns (tuple(uint256 referendumIndex, uint8 track, uint8 riskScore, uint8 categoryId, int8 recommendation, uint8 confidence, uint256 requestedAmountDOT, uint256 treasuryImpactBps, string analysisIPFSHash, uint256 analyzedAt, bool exists, uint256 version))",
  "event AnalysisPublished(uint256 indexed referendumIndex, uint8 riskScore, int8 recommendation, uint8 confidence)",
  "event AnalysisUpdated(uint256 indexed referendumIndex, uint8 riskScore, int8 oldRecommendation, int8 newRecommendation, uint8 confidence, uint256 version)",
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
      "0x8DD746657Cbc7BE0f322F20780c6AD1EEdBD03Af";
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
 * Get the current on-chain analysis for comparison
 */
export async function getOnChainAnalysis(referendumIndex) {
  const oracle = getOracle();
  const exists = await oracle.hasAnalysis(referendumIndex);
  if (!exists) return null;

  const analysis = await oracle.getAnalysis(referendumIndex);
  return {
    riskScore: Number(analysis.riskScore),
    categoryId: Number(analysis.categoryId),
    recommendation: Number(analysis.recommendation),
    confidence: Number(analysis.confidence),
    version: Number(analysis.version),
    analyzedAt: Number(analysis.analyzedAt),
  };
}

/**
 * Publish AI analysis to the AIOracle contract (first time)
 */
export async function publishAnalysis(referendumIndex, track, analysis) {
  const oracle = getOracle();

  const exists = await oracle.hasAnalysis(referendumIndex);
  if (exists) {
    console.log(`  Referendum ${referendumIndex} already analyzed on-chain, skipping.`);
    return null;
  }

  const ipfsHash = `QmGovMind_${referendumIndex}_v1`;
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
 * Update an existing on-chain analysis (re-analysis due to data changes)
 */
export async function updateOnChainAnalysis(referendumIndex, analysis, version) {
  const oracle = getOracle();

  const ipfsHash = `QmGovMind_${referendumIndex}_v${version + 1}`;
  const requestedAmount = ethers.parseUnits(
    String(Math.floor(analysis.requestedAmountDOT)),
    0
  );

  const tx = await oracle.updateAnalysis(
    referendumIndex,
    analysis.riskScore,
    analysis.categoryId,
    analysis.recommendation,
    analysis.confidence,
    requestedAmount,
    analysis.treasuryImpactBps,
    ipfsHash
  );

  console.log(`  UPDATE TX sent: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`  Update confirmed in block ${receipt.blockNumber} (v${version + 1})`);

  return receipt;
}

/**
 * Get the oracle wallet address for logging
 */
export function getOracleAddress() {
  return getSigner().address;
}
