# GovMind — Architecture & Build Scope

## AI Governance Intelligence Layer for Polkadot Hub

**Hackathon:** Polkadot Solidity Hackathon (OpenGuild + W3F)
**Track:** Track 1 — EVM Smart Contract (AI-powered dApp)
**Timeline:** Feb 15 – Mar 24, 2026 (6 weeks)
**Deployment:** Polkadot Hub TestNet (EVM via REVM)

---

## 1. System Overview

GovMind is an AI-powered governance platform that makes Polkadot OpenGov accessible, intelligent, and automated. It analyzes governance proposals using on-chain data and AI, enables users to create personalized voting profiles ("Governance Identities"), and supports AI-assisted vote delegation — where the AI votes according to each user's stated values and risk preferences.

### Core Value Proposition
- **For passive DOT holders:** Stop ignoring governance. Set your preferences once, let AI vote intelligently on your behalf.
- **For active voters:** Get deep AI analysis of every proposal — treasury impact, historical precedent, risk scoring — before you vote.
- **For the ecosystem:** Increase governance participation rates, which is a stated W3F priority.

### Why This Can't Exist on Ethereum
- Polkadot OpenGov (referenda, tracks, conviction voting, multi-role delegation) is native to Hub
- Governance precompiles let Solidity contracts interact directly with the governance system
- XCM enables cross-chain data queries for richer AI analysis
- No other chain has this governance complexity or the on-chain infrastructure to support it

---

## 2. Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│              Next.js + Viem + Wagmi + TailwindCSS            │
│    ┌──────────┐  ┌──────────────┐  ┌───────────────────┐    │
│    │ Proposal  │  │  Governance  │  │   AI Delegation   │    │
│    │ Explorer  │  │   Identity   │  │     Dashboard     │    │
│    │ + AI View │  │   Builder    │  │  + Vote History   │    │
│    └─────┬─────┘  └──────┬───────┘  └────────┬──────────┘    │
└──────────┼───────────────┼───────────────────┼───────────────┘
           │               │                   │
           ▼               ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   SMART CONTRACTS (Solidity)                  │
│                   Polkadot Hub EVM (REVM)                     │
│                                                               │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────┐  │
│  │  GovMind Core  │  │  Identity Vault  │  │  AI Oracle   │  │
│  │                │  │                  │  │  Adapter      │  │
│  │ - Proposal     │  │ - Preference     │  │              │  │
│  │   Registry     │  │   Storage        │  │ - Receives   │  │
│  │ - Vote         │  │ - Track-level    │  │   AI scores  │  │
│  │   Execution    │  │   Delegation     │  │ - Validates  │  │
│  │ - Delegation   │  │   Config         │  │   + stores   │  │
│  │   Router       │  │ - Threshold      │  │   analysis   │  │
│  └───────┬────────┘  │   Settings       │  └──────┬───────┘  │
│          │           └─────────────────┘          │          │
│          ▼                                        │          │
│  ┌────────────────────────────────┐               │          │
│  │     PRECOMPILE INTERFACES      │               │          │
│  │                                │               │          │
│  │  Governance Precompile         │               │          │
│  │  └─ Vote on referenda          │               │          │
│  │  └─ Delegate voting power      │               │          │
│  │  └─ Query referendum state     │               │          │
│  │                                │               │          │
│  │  XCM Precompile (0x...0a0000)  │               │          │
│  │  └─ Query staking data         │               │          │
│  │  └─ Query treasury balance     │               │          │
│  └────────────────────────────────┘               │          │
└───────────────────────────────────────────────────┼──────────┘
                                                    │
           ┌────────────────────────────────────────┘
           ▼
┌─────────────────────────────────────────────────────────────┐
│                    AI BACKEND SERVICE                         │
│                  Node.js / Python FastAPI                     │
│                                                               │
│  ┌─────────────────┐  ┌──────────────────┐                   │
│  │ Proposal Analyzer│  │ Vote Recommender │                   │
│  │                  │  │                  │                   │
│  │ - Parse proposal │  │ - Match proposal │                   │
│  │   text + calldata│  │   to user prefs  │                   │
│  │ - Treasury impact│  │ - Generate vote  │                   │
│  │   calculation    │  │   recommendation │                   │
│  │ - Risk scoring   │  │ - Confidence     │                   │
│  │ - Category       │  │   scoring        │                   │
│  │   classification │  │ - Reasoning      │                   │
│  └─────────────────┘  │   chain output   │                   │
│                        └──────────────────┘                   │
│  ┌─────────────────────────────────────────┐                 │
│  │          Data Aggregation Layer          │                 │
│  │                                          │                 │
│  │  Subsquare API → Proposal text, votes    │                 │
│  │  Subscan API  → Treasury data, history   │                 │
│  │  On-chain RPC → Live referendum state    │                 │
│  └─────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Smart Contract Architecture

### 3.1 GovMindCore.sol — Main Orchestrator

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract GovMindCore {
    // ============ STATE ============
    
    struct ProposalAnalysis {
        uint256 referendumIndex;
        uint8 track;                    // OpenGov track ID
        uint8 riskScore;                // 0-100 AI-generated
        uint8 categoryId;               // Treasury, Technical, Governance, etc.
        int8 aiRecommendation;          // -1 (Nay), 0 (Abstain), 1 (Aye)
        uint256 requestedAmount;         // DOT requested (if treasury)
        uint256 treasuryImpact;          // % of treasury
        string analysisIPFSHash;         // Full AI analysis stored on IPFS
        uint256 timestamp;
        bool isActive;
    }
    
    struct GovernanceIdentity {
        address owner;
        string preferencesHash;          // IPFS hash of full preference set
        uint8 riskTolerance;             // 0-100
        bool autoVoteEnabled;
        uint256 maxAutoVoteAmount;       // Max DOT for auto-vote on treasury
        uint8[] enabledTracks;           // Which tracks the AI can vote on
        uint256 createdAt;
    }
    
    mapping(uint256 => ProposalAnalysis) public analyses;
    mapping(address => GovernanceIdentity) public identities;
    mapping(address => mapping(uint256 => bool)) public hasVoted;
    
    address public oracleAddress;        // AI oracle backend
    address public governancePrecompile; // Polkadot governance precompile
    
    // ============ EVENTS ============
    
    event AnalysisPublished(uint256 indexed referendumIndex, uint8 riskScore, int8 recommendation);
    event IdentityCreated(address indexed user);
    event IdentityUpdated(address indexed user);
    event AIVoteExecuted(address indexed user, uint256 indexed referendumIndex, bool aye);
    event DelegationConfigured(address indexed user, uint8 track);
    
    // ============ CORE FUNCTIONS ============
    
    // Oracle submits AI analysis for a proposal
    function publishAnalysis(
        uint256 _referendumIndex,
        uint8 _track,
        uint8 _riskScore,
        uint8 _categoryId,
        int8 _aiRecommendation,
        uint256 _requestedAmount,
        uint256 _treasuryImpact,
        string calldata _analysisIPFSHash
    ) external onlyOracle { ... }
    
    // User creates their governance identity
    function createIdentity(
        string calldata _preferencesHash,
        uint8 _riskTolerance,
        uint8[] calldata _enabledTracks,
        uint256 _maxAutoVoteAmount
    ) external { ... }
    
    // AI-triggered vote execution (oracle calls on behalf of users)
    function executeAIVote(
        address _user,
        uint256 _referendumIndex,
        bool _aye,
        uint256 _conviction     // Conviction multiplier (0-6)
    ) external onlyOracle { ... }
    
    // User manually votes with AI recommendation displayed
    function voteWithInsight(
        uint256 _referendumIndex,
        bool _aye,
        uint256 _conviction
    ) external { ... }
    
    // Configure per-track delegation to AI
    function configureDelegation(
        uint8 _track,
        bool _enabled,
        uint256 _maxAmount
    ) external { ... }
}
```

### 3.2 IdentityVault.sol — Preference Storage

```solidity
contract IdentityVault {
    // Governance preference categories
    enum PreferenceAxis {
        TREASURY_CONSERVATIVE,    // Minimize treasury spend
        TREASURY_GROWTH,          // Invest for ecosystem growth
        TECHNICAL_PROGRESSIVE,    // Favor protocol upgrades
        TECHNICAL_CONSERVATIVE,   // Favor stability
        COMMUNITY_FOCUSED,        // Prioritize community proposals
        INFRASTRUCTURE_FOCUSED    // Prioritize infra/tooling
    }
    
    struct UserPreferences {
        mapping(PreferenceAxis => uint8) weights;  // 0-100 per axis
        uint8 minConfidenceThreshold;              // AI must be this confident to auto-vote
        uint256 maxSingleProposalDOT;              // Max treasury ask for auto-approve
        bool requireHumanReviewAboveThreshold;     // Pause auto-vote for large asks
    }
    
    mapping(address => UserPreferences) public preferences;
    
    function setPreferences(
        uint8[] calldata _axisValues,
        uint8 _minConfidence,
        uint256 _maxSingleProposalDOT
    ) external { ... }
    
    function getVoteRecommendation(
        address _user,
        uint256 _referendumIndex
    ) external view returns (bool aye, uint8 confidence, string memory reasoning) { ... }
}
```

### 3.3 AIOracle.sol — Bridge to AI Backend

```solidity
contract AIOracle {
    struct AnalysisRequest {
        uint256 referendumIndex;
        uint256 requestedAt;
        bool fulfilled;
    }
    
    mapping(uint256 => AnalysisRequest) public requests;
    
    // Anyone can request analysis (small fee to prevent spam)
    function requestAnalysis(uint256 _referendumIndex) external payable { ... }
    
    // Backend fulfills with signed analysis
    function fulfillAnalysis(
        uint256 _referendumIndex,
        bytes calldata _analysisData,
        bytes calldata _signature
    ) external { ... }
}
```

### 3.4 Precompile Integration

```solidity
// Interface for Polkadot governance precompile (when available)
// If governance precompile is not yet live on testnet,
// simulate with mock contract for demo

interface IGovernancePrecompile {
    function vote(uint256 referendumIndex, bool aye, uint256 conviction, uint256 balance) external;
    function delegate(uint8 track, address to, uint256 conviction, uint256 balance) external;
    function undelegate(uint8 track) external;
    function referendumInfo(uint256 index) external view returns (
        uint8 track, uint8 status, uint256 ayes, uint256 nays
    );
}

// XCM Precompile at 0x00000000000000000000000000000000000a0000
interface IXcm {
    function execute(bytes calldata message, uint64 refTime, uint64 proofSize) external;
    function send(bytes calldata dest, bytes calldata message) external;
    function weighMessage(bytes calldata message) external view returns (uint64 refTime, uint64 proofSize);
}
```

**Precompile Strategy:**
- If governance precompile is live on testnet → use it directly
- If not yet available → deploy a `MockGovernance.sol` that simulates the interface, clearly documenting that it wraps the real precompile in production
- XCM precompile IS live at `0x...0a0000` → use it for cross-chain treasury/staking queries in the demo

---

## 4. AI Backend Architecture

### 4.1 Proposal Analysis Pipeline

```
New Referendum Detected (via Subsquare API / on-chain events)
         │
         ▼
┌─ STEP 1: DATA COLLECTION ──────────────────────┐
│  - Proposal text from Subsquare API             │
│  - Call data decoding (what the proposal does)  │
│  - Proposer history (past proposals, outcomes)  │
│  - Treasury balance from on-chain RPC           │
│  - Current track queue depth                    │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─ STEP 2: AI ANALYSIS (Claude API / OpenAI) ─────┐
│                                                   │
│  Structured prompt with:                          │
│  - Proposal summary + context                     │
│  - Treasury impact calculation                    │
│  - Historical comparison (similar past proposals) │
│  - Track-specific evaluation criteria             │
│                                                   │
│  Output (JSON):                                   │
│  {                                                │
│    "summary": "...",                              │
│    "category": "treasury_spend",                  │
│    "risk_score": 42,                              │
│    "treasury_impact_pct": 2.3,                    │
│    "recommendation": "aye",                       │
│    "confidence": 78,                              │
│    "reasoning": [                                 │
│      "Team has delivered on 3 prior proposals",   │
│      "Requested amount is within historical...",  │
│      "Milestone structure reduces risk..."        │
│    ],                                             │
│    "concerns": [                                  │
│      "No third-party audit mentioned",            │
│      "Timeline is aggressive for scope"           │
│    ],                                             │
│    "comparable_proposals": [1612, 1534, 1201]     │
│  }                                                │
└─────────────────────┬─────────────────────────────┘
                      │
                      ▼
┌─ STEP 3: PERSONALIZED MATCHING ─────────────────┐
│                                                   │
│  For each user with auto-vote enabled:            │
│  - Load their GovernanceIdentity preferences      │
│  - Score proposal against preference axes         │
│  - Apply risk tolerance filter                    │
│  - Apply max treasury threshold                   │
│  - Generate personalized recommendation           │
│                                                   │
│  Result: { user, vote: aye/nay, confidence: 82 }  │
└─────────────────────┬─────────────────────────────┘
                      │
                      ▼
┌─ STEP 4: ON-CHAIN SUBMISSION ───────────────────┐
│                                                   │
│  - Upload full analysis to IPFS                   │
│  - Call GovMindCore.publishAnalysis()             │
│  - For auto-vote users above confidence threshold:│
│    Call GovMindCore.executeAIVote()               │
│  - Emit events for frontend notifications         │
└──────────────────────────────────────────────────┘
```

### 4.2 Data Sources

| Source | Data | Method |
|--------|------|--------|
| Subsquare API | Proposal text, discussions, vote tallies | `GET https://polkadot.subsquare.io/api/gov2/referendums` |
| Subscan API | Treasury balance, transfer history | `GET https://polkadot.api.subscan.io/api/scan/treasury` |
| Polkadot Hub RPC | Live referendum state, block data | `ethers.JsonRpcProvider('https://services.polkadothub-rpc.com/testnet')` |
| IPFS | Full AI analysis storage | Pinata / web3.storage |

### 4.3 AI Prompt Architecture

The AI analysis uses a structured system prompt with these sections:

1. **Role:** You are a Polkadot governance analyst specializing in OpenGov referendum evaluation.
2. **Context injection:** Current treasury balance, recent spending trends, track-specific thresholds.
3. **Evaluation framework:**
   - Proposer track record (prior proposals, delivery history)
   - Budget reasonableness (comparison to similar proposals)
   - Technical feasibility assessment
   - Milestone structure quality
   - Ecosystem alignment score
4. **Output schema:** Enforced JSON response matching the on-chain `ProposalAnalysis` struct.

---

## 5. Frontend Architecture

### 5.1 Pages & Components

```
/                          → Landing page + active proposals overview
/proposals                 → All proposals with AI analysis badges
/proposals/[id]            → Single proposal deep dive
  ├── AI Analysis Panel    → Summary, risk score, recommendation
  ├── Treasury Impact Viz  → Donut chart showing % of treasury
  ├── Vote Comparison      → "How would different profiles vote?"
  ├── Historical Context   → Similar past proposals + outcomes
  └── Vote Action          → Cast vote (manual or AI-assisted)
/identity                  → Create/edit Governance Identity
  ├── Preference Sliders   → 6 axes with visual feedback
  ├── Track Configuration  → Enable/disable per-track delegation
  ├── Risk Settings        → Tolerance, thresholds, limits
  └── Simulation Panel     → "How would I have voted on past 10 proposals?"
/dashboard                 → Personal governance dashboard
  ├── Vote History         → All votes (manual + AI) with reasoning
  ├── Delegation Status    → Active delegations per track
  ├── Impact Score         → How aligned your votes were with outcomes
  └── Notifications        → New proposals matching your interests
```

### 5.2 Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Next.js 14 (App Router) | SSR for SEO, good DX |
| Blockchain | Viem + Wagmi | Standard EVM interaction, Polkadot Hub compatible |
| Wallet | MetaMask (RainbowKit) | Hub exposes Ethereum JSON-RPC |
| Styling | TailwindCSS + shadcn/ui | Fast, clean, professional |
| Charts | Recharts | Treasury impact visualizations |
| State | Zustand | Lightweight global state |
| AI Display | react-markdown | Render AI analysis text |

### 5.3 Network Configuration

```typescript
// Polkadot Hub TestNet chain config for Viem
export const polkadotHubTestnet = {
  id: 420420417,
  name: 'Polkadot Hub TestNet',
  network: 'polkadot-hub-testnet',
  nativeCurrency: { name: 'PAS', symbol: 'PAS', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://services.polkadothub-rpc.com/testnet'] },
  },
  blockExplorers: {
    default: { 
      name: 'Blockscout', 
      url: 'https://blockscout-passet-hub.parity-testnet.parity.io' 
    },
  },
} as const;
```

---

## 6. Development Plan (6-Week Sprint)

### Week 1 (Feb 15-21): Foundation
- [ ] Set up Hardhat project with Polkadot Hub testnet config
- [ ] Deploy `GovMindCore.sol` skeleton to testnet
- [ ] Deploy `IdentityVault.sol` with preference storage
- [ ] Set up Next.js frontend with wallet connection
- [ ] Test basic contract interactions via Viem
- [ ] Get PAS testnet tokens from faucet

### Week 2 (Feb 22-28): Smart Contracts Complete
- [ ] Implement full `GovMindCore` with vote execution logic
- [ ] Implement `AIOracle` adapter contract
- [ ] Build mock governance precompile (or integrate real one if available)
- [ ] Write XCM precompile integration for treasury data query
- [ ] Unit tests for all contracts
- [ ] Deploy full contract suite to testnet

### Week 3 (Mar 1-7): AI Backend
- [ ] Build proposal data aggregation service (Subsquare + Subscan APIs)
- [ ] Design and test AI analysis prompt with real Polkadot proposals
- [ ] Implement personalized vote matching algorithm
- [ ] Set up IPFS pinning for analysis storage
- [ ] Build oracle submission pipeline (backend → contract)
- [ ] Test end-to-end: detect proposal → analyze → publish on-chain

### Week 4 (Mar 8-14): Frontend Core
- [ ] Proposal Explorer page with AI analysis display
- [ ] Governance Identity Builder (preference sliders, track config)
- [ ] Single proposal deep-dive page with all visualizations
- [ ] Vote execution flow (manual + AI-assisted)
- [ ] Dashboard with vote history

### Week 5 (Mar 15-20): Integration & Polish
- [ ] Full end-to-end flow testing
- [ ] "Simulation Panel" — show users how AI would've voted on past proposals
- [ ] Treasury impact visualization (charts, comparisons)
- [ ] Mobile responsiveness
- [ ] Error handling, loading states, edge cases
- [ ] XCM demo integration (cross-chain data in analysis)

### Week 6 (Mar 21-24): Demo & Submission
- [ ] Record demo video (keep under 5 minutes)
- [ ] Write README + architecture documentation
- [ ] Prepare live demo with real Polkadot proposals
- [ ] Deploy frontend to Vercel
- [ ] Submit before deadline

---

## 7. Demo Script (The 3-Minute Win)

This is the flow that wins. Practice it.

**[0:00-0:30] The Problem**
"Polkadot has the most sophisticated on-chain governance in crypto. But most DOT holders don't vote. The proposals are complex, the tracks are confusing, and there's no easy way to stay informed. GovMind fixes this."

**[0:30-1:00] AI Analysis Demo**
Open proposal explorer. Click on a real, active Polkadot referendum (e.g., a treasury proposal). Show the AI analysis: risk score, treasury impact percentage, category, recommendation with reasoning chain. Point out: "This analysis considers the proposer's track record, compares the budget to similar past proposals, and evaluates milestone structure."

**[1:00-1:30] Governance Identity**
Create a governance identity. Drag preference sliders: "I'm treasury-conservative but technically progressive." Set risk tolerance to 60. Enable auto-vote on Small Tipper and Small Spender tracks. Show the simulation: "Based on these preferences, here's how the AI would have voted on the last 10 proposals — and how those votes compared to actual outcomes."

**[1:30-2:15] The Magic Moment — Two Users, Same Proposal**
Show the same treasury proposal from two different user perspectives:
- User A (treasury-conservative, risk-averse): AI recommends **Nay** with 73% confidence. Reasoning: "Budget exceeds historical average for this category by 40%."
- User B (growth-focused, risk-tolerant): AI recommends **Aye** with 81% confidence. Reasoning: "Team has strong delivery record, ecosystem impact justifies premium."

"Same proposal. Different values. Different votes. That's the power of personalized governance."

**[2:15-2:45] On-Chain Execution**
Execute a vote through the contract. Show the transaction on Blockscout. Show the XCM query pulling treasury balance data. "This all runs on Polkadot Hub's EVM, using governance precompiles and XCM — impossible on any other chain."

**[2:45-3:00] Close**
"GovMind turns passive DOT holders into active governance participants. Built natively on Polkadot Hub, powered by AI, designed for the future of decentralized decision-making."

---

## 8. Key Technical Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Governance precompile not live on testnet | Can't execute real votes | Deploy MockGovernance.sol, document upgrade path |
| XCM precompile limited functionality | Weak cross-chain story | Use XCM for simple treasury balance query, enough for demo |
| Subsquare API rate limits | Can't fetch proposal data | Cache aggressively, pre-fetch historical data |
| AI hallucination in analysis | Wrong recommendations | Anchor analysis to on-chain data (treasury numbers, vote counts), add confidence scores |
| Testnet instability | Demo fails live | Pre-record backup demo video, have screenshots ready |
| Eligibility (APAC focus) | Disqualification | Verify with organizers before building |

---

## 9. Repository Structure

```
govmind/
├── contracts/
│   ├── GovMindCore.sol
│   ├── IdentityVault.sol
│   ├── AIOracle.sol
│   ├── MockGovernance.sol
│   ├── interfaces/
│   │   ├── IGovernancePrecompile.sol
│   │   └── IXcm.sol
│   └── test/
│       ├── GovMindCore.test.js
│       └── IdentityVault.test.js
├── backend/
│   ├── src/
│   │   ├── analyzer/          # AI proposal analysis
│   │   ├── aggregator/        # Data collection (Subsquare, Subscan)
│   │   ├── matcher/           # Preference-to-vote matching
│   │   ├── oracle/            # On-chain submission
│   │   └── ipfs/              # Analysis storage
│   ├── prompts/
│   │   └── proposal-analysis.md
│   └── package.json
├── frontend/
│   ├── app/
│   │   ├── page.tsx           # Landing
│   │   ├── proposals/
│   │   ├── identity/
│   │   └── dashboard/
│   ├── components/
│   │   ├── ProposalCard.tsx
│   │   ├── AIAnalysisPanel.tsx
│   │   ├── PreferenceSlider.tsx
│   │   ├── VoteComparison.tsx
│   │   └── TreasuryImpact.tsx
│   ├── hooks/
│   │   ├── useGovMind.ts
│   │   └── useIdentity.ts
│   ├── lib/
│   │   ├── contracts.ts       # ABI + addresses
│   │   └── viem.ts            # Chain config
│   └── package.json
├── hardhat.config.ts
├── README.md
└── .env.example
```

---

## 10. Differentiation Checklist (What Judges Score)

- [x] **Uses Polkadot-native features** — OpenGov, conviction voting, track-based delegation
- [x] **Uses precompiles** — Governance precompile + XCM precompile
- [x] **AI is substantive** — Not just a ChatGPT wrapper; on-chain data-driven analysis with quantified outputs
- [x] **Solves a real problem** — Low governance participation
- [x] **Aligned with W3F priorities** — Governance tooling, ecosystem engagement
- [x] **Clean demo** — Compelling 3-min story with "two users, same proposal" moment
- [x] **Production potential** — Clear path from hackathon to real product
- [x] **Code quality** — Tests, documentation, clean architecture

---

## FIRST ACTION: Verify Eligibility

Before writing a single line of code, join the OpenGuild Discord (https://discord.gg/WWgzkDfPQF) and confirm:
1. Is participation open to developers outside APAC?
2. If yes, are there any scoring adjustments for non-APAC participants?
3. What's the exact submission format (GitHub repo? Devpost? Video required?)

This takes 10 minutes and could save you 6 weeks.
