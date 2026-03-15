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
  identityVault: "0xCC6d8B7896E451cD3c3a34adA0dE55885519aDA1" as `0x${string}`,
  aiOracle: "0xB9364a7Be7be4598BBb4edb812aFbe25a85ebB2A" as `0x${string}`,
  govMindCore: "0x9738ceE50C7ce9E45d32a27D43886D61EF7D3f6a" as `0x${string}`,
  xcmRelay: "0xFf63bF7E3e0eB21BFB552B6e32de08a98Ad01faF" as `0x${string}`,
  scaleCodecPVM: "0x9c0E4B07f26726d6646C8465cfA39f9662550cDb" as `0x${string}`,
  alignmentScorerPVM: "0x60B9D9D2097963ADf51Cf6c1E1b80309c2959238" as `0x${string}`,
  collectiveAggregatorPVM: "0x8561fe6E3A635d5bD6a529Bf0021Cba894D06e13" as `0x${string}`,
  collectiveRegistry: "0x8415f90D44dAb2943836C07F1bb6f21A70174649" as `0x${string}`,
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

export const GOVMIND_CORE_ADMIN_ABI = [
  {
    name: "setPVMScorer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_scorer", type: "address" },
      { name: "_enabled", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "toggleXCMRelay",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_enabled", type: "bool" }],
    outputs: [],
  },
  {
    name: "setXCMRelay",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_relay", type: "address" }],
    outputs: [],
  },
  {
    name: "xcmRelayEnabled",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const XCM_RELAY_ADMIN_ABI = [
  {
    name: "setPVMCodec",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_codec", type: "address" },
      { name: "_enabled", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

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

// PVM cross-VM status reads from existing EVM contracts
export const PVM_STATUS_ABI = [
  {
    name: "usePVMCodec",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "scaleCodecPVM",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "usePVMScorer",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "alignmentScorerPVM",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "usePVMAggregator",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "aggregatorPVM",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const COLLECTIVE_REGISTRY_ABI = [
  {
    name: "joinCollective",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_collectiveId", type: "uint8" }],
    outputs: [],
  },
  {
    name: "leaveCollective",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "collectives",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint8" }],
    outputs: [
      { name: "exists", type: "bool" },
      { name: "name", type: "string" },
      { name: "philosophy", type: "string" },
      { name: "axes", type: "uint8[6]" },
      { name: "riskTolerance", type: "uint8" },
      { name: "memberCount", type: "uint256" },
      { name: "createdAt", type: "uint256" },
    ],
  },
  {
    name: "getUserCollective",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_user", type: "address" }],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "getCollectiveAxes",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_collectiveId", type: "uint8" }],
    outputs: [{ name: "", type: "uint8[6]" }],
  },
  {
    name: "getSeedAxes",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_collectiveId", type: "uint8" }],
    outputs: [{ name: "", type: "uint8[6]" }],
  },
  {
    name: "seedWeight",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "getMemberCount",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_collectiveId", type: "uint8" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "collectiveCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "totalMembers",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "isMember",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ─── AI Voting Collectives ───

export interface Collective {
  id: string;
  name: string;
  description: string;
  philosophy: string;
  icon: string;
  color: string;
  borderColor: string;
  bgColor: string;
  axes: number[];
  riskTolerance: number;
  focusAreas: string[];
  memberCount?: number;
}

export const COLLECTIVES: Collective[] = [
  {
    id: "sustainability",
    name: "Sustainability Collective",
    description: "Champions environmental initiatives, green infrastructure, and long-term ecosystem health over short-term gains.",
    philosophy: "Votes YES on sustainability proposals. Conservative on wasteful spending, progressive on green infrastructure.",
    icon: "Leaf",
    color: "text-emerald-400",
    borderColor: "border-emerald-500/20",
    bgColor: "bg-emerald-500/10",
    axes: [70, 40, 40, 70, 80, 60],
    riskTolerance: 35,
    focusAreas: ["Environmental projects", "Green infrastructure", "Long-term ecosystem growth", "Community well-being"],
  },
  {
    id: "innovation",
    name: "Innovation Collective",
    description: "Backs developer tooling, ecosystem expansion, new parachains, and bold technical proposals that push boundaries.",
    philosophy: "Supports proposals that increase adoption and experimentation. Growth-oriented treasury philosophy.",
    icon: "Rocket",
    color: "text-violet-400",
    borderColor: "border-violet-500/20",
    bgColor: "bg-violet-500/10",
    axes: [20, 90, 90, 10, 50, 80],
    riskTolerance: 75,
    focusAreas: ["Developer tooling", "Ecosystem expansion", "New parachains", "Protocol experimentation"],
  },
  {
    id: "security",
    name: "Security Collective",
    description: "Prioritizes runtime safety, security audits, risk mitigation, and conservative upgrades to protect the network.",
    philosophy: "Conservative voting philosophy. Scrutinizes technical proposals and opposes risky changes.",
    icon: "ShieldCheck",
    color: "text-cyan-400",
    borderColor: "border-cyan-500/20",
    bgColor: "bg-cyan-500/10",
    axes: [60, 30, 30, 95, 30, 70],
    riskTolerance: 20,
    focusAreas: ["Runtime upgrades", "Security audits", "Risk mitigation", "Infrastructure hardening"],
  },
  {
    id: "treasury",
    name: "Treasury Efficiency Collective",
    description: "Demands fiscal discipline, ROI-driven spending, and accountability for every DOT spent from the treasury.",
    philosophy: "Votes NO on wasteful treasury proposals. Demands clear deliverables and cost justification.",
    icon: "Coins",
    color: "text-amber-400",
    borderColor: "border-amber-500/20",
    bgColor: "bg-amber-500/10",
    axes: [95, 10, 50, 60, 40, 50],
    riskTolerance: 30,
    focusAreas: ["Treasury spending discipline", "ROI analysis", "Accountability frameworks", "Cost optimization"],
  },
];

export const PREFERENCE_AXES = [
  { id: 0, name: "Treasury Conservative", description: "Minimize treasury spending", color: "#F59E0B", icon: "Shield" },
  { id: 1, name: "Treasury Growth", description: "Invest for ecosystem growth", color: "#10B981", icon: "TrendingUp" },
  { id: 2, name: "Tech Progressive", description: "Favor protocol upgrades", color: "#8B5CF6", icon: "Zap" },
  { id: 3, name: "Tech Conservative", description: "Favor stability", color: "#6366F1", icon: "Lock" },
  { id: 4, name: "Community Focused", description: "Prioritize community proposals", color: "#EC4899", icon: "Users" },
  { id: 5, name: "Infrastructure", description: "Prioritize infra & tooling", color: "#06B6D4", icon: "Server" },
] as const;
