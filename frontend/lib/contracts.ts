export const POLKADOT_HUB_TESTNET = {
  id: 420420417,
  name: "Polkadot Hub Testnet",
  nativeCurrency: { name: "PAS", symbol: "PAS", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://services.polkadothub-rpc.com/testnet"] },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://blockscout-testnet.polkadot.io",
    },
  },
} as const;

export const ADDRESSES = {
  identityVault: "0x6ef53Ce1FBDa8B13A2CCAE598a77A5bdC27402F7" as `0x${string}`,
  aiOracle: "0x8DD746657Cbc7BE0f322F20780c6AD1EEdBD03Af" as `0x${string}`,
  govMindCore: "0x2F23763C8E4196647E9529dBb13e21a8766b64fb" as `0x${string}`,
  xcmRelay: "0x5fd260821D7868738FCCc18f3252f10Ceb7EE3d4" as `0x${string}`,
};

export const IDENTITY_VAULT_ABI = [
  {
    name: "createIdentity",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_riskTolerance", type: "uint8" },
      { name: "_minConfidence", type: "uint8" },
      { name: "_maxAutoVoteDOT", type: "uint256" },
      { name: "_preferencesHash", type: "string" },
      { name: "_axes", type: "uint8[]" },
      { name: "_weights", type: "uint8[]" },
    ],
    outputs: [],
  },
  {
    name: "updatePreferences",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_axes", type: "uint8[]" },
      { name: "_weights", type: "uint8[]" },
    ],
    outputs: [],
  },
  {
    name: "updateSettings",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_riskTolerance", type: "uint8" },
      { name: "_minConfidence", type: "uint8" },
      { name: "_maxAutoVoteDOT", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "toggleAutoVote",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_enabled", type: "bool" }],
    outputs: [],
  },
  {
    name: "configureTrackDelegation",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_track", type: "uint8" },
      { name: "_enabled", type: "bool" },
      { name: "_maxAmount", type: "uint256" },
      { name: "_maxConviction", type: "uint8" },
    ],
    outputs: [],
  },
  {
    name: "hasIdentity",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_user", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "identities",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "exists", type: "bool" },
      { name: "riskTolerance", type: "uint8" },
      { name: "minConfidenceThreshold", type: "uint8" },
      { name: "maxAutoVoteAmountDOT", type: "uint256" },
      { name: "autoVoteEnabled", type: "bool" },
      { name: "preferencesIPFSHash", type: "string" },
      { name: "createdAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
    ],
  },
  {
    name: "getPreferenceWeights",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_user", type: "address" }],
    outputs: [{ name: "weights", type: "uint8[6]" }],
  },
  {
    name: "totalIdentities",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "trackDelegations",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "uint8" },
    ],
    outputs: [
      { name: "enabled", type: "bool" },
      { name: "maxAmount", type: "uint256" },
      { name: "maxConviction", type: "uint8" },
    ],
  },
] as const;

export const AI_ORACLE_ABI = [
  {
    name: "getAnalysis",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_referendumIndex", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "referendumIndex", type: "uint256" },
          { name: "track", type: "uint8" },
          { name: "riskScore", type: "uint8" },
          { name: "categoryId", type: "uint8" },
          { name: "recommendation", type: "int8" },
          { name: "confidence", type: "uint8" },
          { name: "requestedAmountDOT", type: "uint256" },
          { name: "treasuryImpactBps", type: "uint256" },
          { name: "analysisIPFSHash", type: "string" },
          { name: "analyzedAt", type: "uint256" },
          { name: "exists", type: "bool" },
          { name: "version", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "hasAnalysis",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_referendumIndex", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "totalAnalyses",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "analyzedReferenda",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getAnalyzedReferendaCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getAnalyzedReferendaPaginated",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "_offset", type: "uint256" },
      { name: "_limit", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "requestAnalysis",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "_referendumIndex", type: "uint256" }],
    outputs: [],
  },
  {
    name: "analysisRequestFee",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const GOVMIND_CORE_ABI = [
  {
    name: "getPersonalizedInsight",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "_user", type: "address" },
      { name: "_referendumIndex", type: "uint256" },
    ],
    outputs: [
      { name: "personalizedRecommendation", type: "int8" },
      { name: "adjustedConfidence", type: "uint8" },
      { name: "riskScore", type: "uint8" },
      { name: "alignmentScore", type: "uint8" },
      { name: "analysisHash", type: "string" },
    ],
  },
  {
    name: "vote",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_referendumIndex", type: "uint256" },
      { name: "_aye", type: "bool" },
      { name: "_conviction", type: "uint256" },
      { name: "_amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "hasVoted",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "getReferendumStats",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_referendumIndex", type: "uint256" }],
    outputs: [
      { name: "totalAye", type: "uint256" },
      { name: "totalNay", type: "uint256" },
      { name: "voterCount", type: "uint256" },
      { name: "aiVoterCount", type: "uint256" },
    ],
  },
  {
    name: "totalVotesCast",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalAIVotes",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getUserVoteHistory",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_user", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "getVote",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "_user", type: "address" },
      { name: "_referendumIndex", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "voter", type: "address" },
          { name: "referendumIndex", type: "uint256" },
          { name: "aye", type: "bool" },
          { name: "conviction", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "isAIVote", type: "bool" },
          { name: "aiConfidence", type: "uint8" },
          { name: "reasoningHash", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      },
    ],
  },
] as const;

export const TRACK_NAMES: Record<number, string> = {
  0: "Root",
  1: "Whitelisted Caller",
  2: "Wish For Change",
  10: "Staking Admin",
  11: "Treasurer",
  12: "Lease Admin",
  13: "Fellowship Admin",
  14: "General Admin",
  15: "Auction Admin",
  20: "Referendum Canceller",
  21: "Referendum Killer",
  30: "Small Tipper",
  31: "Big Tipper",
  32: "Small Spender",
  33: "Medium Spender",
  34: "Big Spender",
};

export const CATEGORY_NAMES: Record<number, string> = {
  0: "Treasury Spend",
  1: "Treasury Tip",
  2: "Technical Upgrade",
  3: "Governance Change",
  4: "Staking Operation",
  5: "Bridge Operation",
  6: "Community Initiative",
  7: "Infrastructure",
  8: "Bounty",
  9: "Other",
};

export const XCM_RELAY_ABI = [
  {
    name: "relayVote",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_voter", type: "address" },
      { name: "_referendumIndex", type: "uint32" },
      { name: "_aye", type: "bool" },
      { name: "_conviction", type: "uint8" },
      { name: "_amount", type: "uint128" },
    ],
    outputs: [],
  },
  {
    name: "previewEncodedCall",
    type: "function",
    stateMutability: "pure",
    inputs: [
      { name: "_referendumIndex", type: "uint32" },
      { name: "_aye", type: "bool" },
      { name: "_conviction", type: "uint8" },
      { name: "_amount", type: "uint128" },
    ],
    outputs: [{ name: "encodedCall", type: "bytes" }],
  },
  {
    name: "previewXcmMessage",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "_referendumIndex", type: "uint32" },
      { name: "_aye", type: "bool" },
      { name: "_conviction", type: "uint8" },
      { name: "_amount", type: "uint128" },
    ],
    outputs: [{ name: "xcmMessage", type: "bytes" }],
  },
  {
    name: "totalRelayedVotes",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "relayEnabled",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const PREFERENCE_AXES = [
  { id: 0, name: "Treasury Conservative", description: "Minimize treasury spending", color: "#F59E0B", icon: "Shield" },
  { id: 1, name: "Treasury Growth", description: "Invest for ecosystem growth", color: "#10B981", icon: "TrendingUp" },
  { id: 2, name: "Tech Progressive", description: "Favor protocol upgrades", color: "#8B5CF6", icon: "Zap" },
  { id: 3, name: "Tech Conservative", description: "Favor stability", color: "#6366F1", icon: "Lock" },
  { id: 4, name: "Community Focused", description: "Prioritize community proposals", color: "#EC4899", icon: "Users" },
  { id: 5, name: "Infrastructure", description: "Prioritize infra & tooling", color: "#06B6D4", icon: "Server" },
] as const;
