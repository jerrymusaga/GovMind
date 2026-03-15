# GovMind — AI Governance Intelligence for Polkadot

> **Two users. Same proposal. Different values. Different AI recommendations. Both vote on the Relay Chain from Hub EVM via XCM.**

**Track 1: EVM Smart Contract | Track 2: PVM Smart Contracts — Polkadot Solidity Hackathon 2026**

---

## The Problem

Polkadot has the most sophisticated on-chain governance system in crypto — 15 tracks, conviction voting, approval curves, timelocks. But that complexity is also its adoption barrier. Most DOT holders skip governance entirely because:

- Proposals are dense and time-consuming to evaluate
- There's no way to get a recommendation tailored to *your* values
- Voting from EVM environments has never been possible cross-chain

## The Solution

GovMind is an AI governance intelligence platform that makes OpenGov accessible through three innovations:

1. **Personalized AI Analysis** — Users create a 6-axis Governance Identity. The AI analyzes every proposal and produces recommendations that differ per user based on their values. A treasury-conservative user and a growth-focused user see the same proposal but get opposite recommendations.

2. **Cross-Chain Voting via XCM** — GovMind SCALE-encodes `convictionVoting.vote()` in pure Solidity and relays votes to the Polkadot Relay Chain via XCM V5. The first EVM dApp to execute OpenGov votes cross-chain.

3. **Conversational AI Agent** — Users can chat with GovMind's AI agent directly on the proposal page to ask questions about risk factors, treasury impact, and voting decisions — with responses personalized to their governance identity.

### Why This Only Works on Polkadot

- OpenGov (referenda, tracks, conviction voting) is native to Polkadot
- XCM enables cross-chain vote execution from Hub EVM to the Relay Chain
- The XCM precompile at `0x0A0000` allows Solidity contracts to send XCM messages
- pallet-revive provides cross-VM dispatch between EVM and PVM on the same chain
- No other ecosystem has this combination of governance complexity, cross-chain infrastructure, and multi-VM execution

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 14 + Wagmi v2 + RainbowKit + TailwindCSS)   │
│  ├── Dashboard with live on-chain stats & XCM relay status      │
│  ├── Proposal detail with AI analysis + cross-collective panel  │
│  ├── On-chain Collectives (join/leave via tx, dynamic profiles) │
│  ├── Identity builder (6-axis radar chart + delegation config)  │
│  ├── Vote panel with conviction & amount controls               │
│  └── AI Agent chat (context-aware, conflict detection)          │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│  EVM Contracts (Solidity 0.8.28 on Polkadot Hub)     [Track 1]  │
│  ├── GovMindCore.sol         — Vote orchestration & personalize │
│  ├── IdentityVault.sol       — 6-axis governance identity store │
│  ├── AIOracle.sol            — AI analysis bridge (on-chain)    │
│  ├── XCMGovernanceRelay.sol  — XCM vote relay to Relay Chain    │
│  ├── CollectiveRegistry.sol  — On-chain collectives + dynamics  │
│  └── ScaleCodec.sol          — Pure Solidity SCALE encoding     │
└──────────┬────────────────────┬─────────────────────────────────┘
           │ cross-VM dispatch  │ XCM Precompile (0x0A0000)
           ▼ (pallet-revive)   ▼
┌───────────────────────────┐  ┌──────────────────────────────────┐
│  PVM Contracts            │  │  Polkadot Relay Chain             │
│  (Rust → RISC-V)          │  │  └── convictionVoting.vote()      │
│  [Track 2]                │  │      Pallet 20, call 0            │
│  ├── ScaleCodecPVM        │  └──────────────────────────────────┘
│  │   Native SCALE encode  │                   ▲
│  ├── AlignmentScorer      │  ┌────────────────┴─────────────────┐
│  │   Personalization      │  │  AI Backend (Node.js + GPT-4o)   │
│  │   on RISC-V            │  │  ├── Subsquare API — tally, data │
│  └── CollectiveAggregator │  │  ├── Deep analysis — risk, $$$   │
│      Dynamic profile      │  │  ├── Change detection & re-analyze│
│      recalculation        │  │  ├── AI Agent chat — governance   │
│      EVM↔PVM↔EVM loop     │  │  └── REST API (port 3001)        │
└───────────────────────────┘  └──────────────────────────────────┘
```

**Two VMs. Three layers. No bridge.** EVM contracts call Rust PVM contracts via pallet-revive cross-VM dispatch. PVM contracts relay votes to the Relay Chain via XCM. The CollectiveAggregator completes the first EVM→PVM→EVM loop — reading member identities from IdentityVault (EVM), computing weighted averages on RISC-V (PVM), and writing back to CollectiveRegistry (EVM).

---

## Smart Contracts — Technical Deep Dive

### On-Chain Data Structures

```solidity
// IdentityVault.sol — Governance identity stored per user
struct GovernanceIdentity {
    bool exists;
    uint8 riskTolerance;              // 0-100, penalty threshold for risky proposals
    uint8 minConfidenceThreshold;     // 0-100, minimum AI confidence for auto-vote
    uint256 maxAutoVoteAmountDOT;     // Max DOT committed per auto-vote
    bool autoVoteEnabled;             // Master switch for AI delegation
    string preferencesIPFSHash;       // Off-chain preferences backup
    uint256 createdAt;
    uint256 updatedAt;
}

// IdentityVault.sol — Per-track delegation config (15 OpenGov tracks)
struct TrackDelegation {
    bool enabled;                     // AI delegation active for this track?
    uint256 maxAmount;                // Max DOT per vote on this track
    uint8 maxConviction;              // Max conviction 0-6 (lock period)
}

// IdentityVault.sol — 6-axis preference system
enum PreferenceAxis {
    TREASURY_CONSERVATIVE,   // 0 — Minimize spending
    TREASURY_GROWTH,         // 1 — Invest for ecosystem growth
    TECHNICAL_PROGRESSIVE,   // 2 — Favor protocol upgrades
    TECHNICAL_CONSERVATIVE,  // 3 — Favor stability
    COMMUNITY_FOCUSED,       // 4 — Prioritize community proposals
    INFRASTRUCTURE_FOCUSED   // 5 — Prioritize infra & tooling
}
// Each user stores uint8[6] weights (0-100 per axis)

// AIOracle.sol — AI analysis stored on-chain per referendum
struct ProposalAnalysis {
    uint256 referendumIndex;
    uint8 track;                      // OpenGov track ID
    uint8 riskScore;                  // 0-100
    uint8 categoryId;                 // 0-9 (see category mapping below)
    int8 recommendation;              // -1 Nay, 0 Abstain, 1 Aye
    uint8 confidence;                 // 0-100
    uint256 requestedAmountDOT;       // Treasury ask
    uint256 treasuryImpactBps;        // Impact in basis points
    string analysisIPFSHash;          // Deep analysis JSON on IPFS
    uint256 analyzedAt;
    bool exists;
    uint256 version;                  // Incremented on each re-analysis
}

// CollectiveRegistry.sol — On-chain voting collective with dynamic profile
struct Collective {
    bool exists;
    string name;                  // e.g. "Sustainability Guardians"
    string philosophy;            // Short philosophy statement
    uint8[6] seedAxes;            // Founder's original 6-axis profile (immutable anchor)
    uint8[6] axes;                // Current dynamic profile (shifts with members)
    uint8 riskTolerance;          // 0-100: collective's risk appetite
    uint256 memberCount;          // Current number of members
    uint256 createdAt;
}
// Mappings: memberCollective[address] => collectiveId, isMember[address] => bool
// seedWeight: 30 (30% founder, 70% member average)
// Profile recalculation: on every join/leave, via PVM or Solidity fallback

// GovMindCore.sol — Vote record stored per user per referendum
struct VoteRecord {
    address voter;
    uint256 referendumIndex;
    bool aye;
    uint256 conviction;               // 0-6 (0 = 0.1x, 6 = 6x lock)
    uint256 amount;                   // DOT committed
    bool isAIVote;                    // true if AI auto-voted
    uint8 aiConfidence;               // AI confidence when vote was cast
    string reasoningHash;             // IPFS hash of reasoning
    uint256 timestamp;
}
```

### Proposal Category Mapping

The AI categorizes every proposal into one of 10 categories. Each category maps to a supporting and opposing preference axis for personalization:

| Category ID | Name | Supporting Axis | Opposing Axis |
|-------------|------|----------------|---------------|
| 0 | Treasury Spend | 1 (Treasury Growth) | 0 (Treasury Conservative) |
| 1 | Treasury Tip | 1 (Treasury Growth) | 0 (Treasury Conservative) |
| 2 | Technical Upgrade | 2 (Tech Progressive) | 3 (Tech Conservative) |
| 3 | Governance Change | 4 (Community Focused) | 5 (Infrastructure) |
| 4 | Staking Operation | 5 (Infrastructure) | 4 (Community) |
| 5 | Bridge Operation | 5 (Infrastructure) | 4 (Community) |
| 6 | Community Initiative | 4 (Community Focused) | 5 (Infrastructure) |
| 7 | Infrastructure | 5 (Infrastructure) | 4 (Community) |
| 8 | Bounty | 1 (Treasury Growth) | 0 (Treasury Conservative) |
| 9 | Other | Neutral (no mapping) | Neutral (no mapping) |

### Personalization Algorithm (`_computeAlignmentScore`)

Computed on-chain in GovMindCore.sol (Solidity) and AlignmentScorer (Rust PVM). Both implementations produce identical results:

```
Input:  user_weights[6], risk_tolerance, category_id, risk_score, base_recommendation, base_confidence
Output: alignment_score, personalized_recommendation, adjusted_confidence

1. Map category_id → (support_axis, oppose_axis)         // See table above
2. support_weight = user_weights[support_axis]            // 0-100
3. oppose_weight  = user_weights[oppose_axis]             // 0-100
4. alignment = 50 + (support_weight - oppose_weight) / 2  // Range: 0-100
5. if risk_score > risk_tolerance:
     alignment -= (risk_score - risk_tolerance) / 2       // Penalty for exceeding tolerance
6. clamp(alignment, 0, 100)

Decision thresholds:
  alignment >= 60 → push toward Aye   (confidence boosted if base agrees, reduced if override)
  alignment <= 40 → push toward Nay   (confidence boosted if base agrees, reduced if override)
  41-59           → keep base AI recommendation unchanged
```

**Example:** Treasury proposal (category 0), risk score 65:
- **User A** (axes: `[80, 20, ...]`, risk tolerance 40): alignment = 50 + (20-80)/2 = 20, then risk penalty (65-40)/2 = -12.5 → alignment ≈ 8 → **Nay**
- **User B** (axes: `[20, 90, ...]`, risk tolerance 80): alignment = 50 + (90-20)/2 = 85, no risk penalty → **Aye**

Same proposal, same AI analysis, different users, different on-chain recommendations — fully deterministic.

---

## XCM Vote Relay — Byte-Level Encoding

### SCALE Encoding of `convictionVoting.vote()`

GovMind encodes the Relay Chain call in pure Solidity (or native Rust via PVM):

```
Encoded call bytes:
┌────────┬────────┬──────────────────┬──────────┬───────────┬───────────────────┐
│ 0x14   │ 0x00   │ Compact<u32>     │ 0x00     │ vote_byte │ u128 LE           │
│ pallet │ call   │ poll_index       │ Standard │ aye|conv  │ balance           │
│ 1 byte │ 1 byte │ 1-4 bytes        │ 1 byte   │ 1 byte    │ 16 bytes          │
└────────┴────────┴──────────────────┴──────────┴───────────┴───────────────────┘

SCALE Compact<u32> encoding:
  0-63:        1 byte   →  value << 2
  64-16383:    2 bytes  →  (value << 2) | 0x01, little-endian
  16384-2³⁰:  4 bytes  →  (value << 2) | 0x02, little-endian

Vote byte construction:
  bit 7     = aye flag (0x80 if aye, 0x00 if nay)
  bits 0-6  = conviction (0-6)
  Example:  Aye with conviction 3 → 0x80 | 0x03 = 0x83

Balance: Fixed-width u128, 16 bytes, little-endian
  Example:  1 DOT = 10_000_000_000 → 0x00e40b5402000000 0000000000000000
```

### XCM V5 Message Construction

```
XCM opcodes used:
  0x00 = WithdrawAsset    0x06 = Transact         0x0D = DepositAsset
  0x11 = InitiateTeleport 0x13 = BuyExecution     0x14 = RefundSurplus

Message structure (version prefix 0x05):

OUTER message (executes on Hub):
  0x05                              // XCM V5
  0x02                              // 2 instructions
  ├─ WithdrawAsset                  // Withdraw DOT for fees
  │   Asset: { parents: 1, interior: Here }
  │   Amount: configurable (default 0.1 DOT = 1_000_000_000 plancks)
  │
  └─ InitiateTeleport              // Teleport to Relay Chain
      Destination: { parents: 1, interior: Here }
      Assets: All
      INNER message (executes on Relay):
        0x04                        // 4 instructions
        ├─ BuyExecution(Unlimited)  // Pay for execution
        ├─ Transact                 // Execute the vote
        │   OriginKind: SovereignAccount (0x01)
        │   fallback_max_weight: Some(Weight { ref_time: 500_000_000, proof_size: 20_000 })
        │   call: <SCALE-encoded convictionVoting.vote()>
        ├─ RefundSurplus            // Return unused fees
        └─ DepositAsset(All → Here) // Deposit remainder

XCM Precompile call:
  XCM_PRECOMPILE(0x0A0000).execute(xcm_bytes, ref_time=50_000_000_000, proof_size=500_000)
```

### XCM Vote Relay Flow

```
User clicks "Vote" on Hub EVM frontend
    │
    ▼
GovMindCore.vote(referendumIndex, aye, conviction, amount)
    │ Records VoteRecord on-chain
    │ Checks: no double vote, conviction ≤ 6, amount > 0
    ▼
XCMGovernanceRelay.relayVote(voter, referendumIndex, aye, conviction, amount)
    │
    ├─ usePVMCodec?
    │   YES → cross-VM dispatch to ScaleCodecPVM (Rust on RISC-V)
    │   NO  → ScaleCodec.sol (pure Solidity fallback)
    │
    ├─ Encode convictionVoting.vote() → bytes (20-24 bytes)
    ├─ Build XCM V5 message (outer + inner instructions)
    │
    └─ XCM_PRECOMPILE.execute(xcm_message, refTime, proofSize)
         │
         ▼
    DOT teleported to Relay Chain → convictionVoting.vote() executed
    Hub sovereign account casts the vote on the Relay Chain
```

---

## Cross-VM Architecture (Track 2) — PVM Contracts

### How Cross-VM Dispatch Works

pallet-revive allows EVM Solidity contracts to call Rust PVM contracts deployed on the same chain. From the EVM side, it's a regular contract call — pallet-revive transparently routes it to RISC-V execution. No bridge, no XCM, no intermediate encoding.

```
EVM Contract                                 PVM Contract (Rust → RISC-V)
─────────────                                ────────────────────────────
IScaleCodecPVM(pvmAddr).encodeVoteCall()     #[polkavm_export] fn call()
         │                                            │
         └── pallet-revive routes call ──────────────►│
             (same chain, cross-VM)                   ├─ Read 4-byte selector
                                                      ├─ Dispatch to handler
                                                      ├─ Execute in RISC-V VM
                                                      └─ Return ABI-encoded result
```

### PVM Contract: ScaleCodecPVM (1,523 bytes)

Native Rust SCALE encoding on RISC-V. Called cross-VM from `XCMGovernanceRelay.sol`.

```rust
// Function selectors (keccak256 first 4 bytes):
SEL_VOTE_CALL:   [0x6b, 0x8a, 0x58, 0x64]  // encodeVoteCall(uint32,bool,uint8,uint128)
SEL_COMPACT_U32: [0x9c, 0x0c, 0x4b, 0xe6]  // encodeCompactU32(uint32)
SEL_U128_LE:     [0x7c, 0x5a, 0xa5, 0x7d]  // encodeU128LE(uint128)

// encode_vote_call: Reads (poll_index, aye, conviction, balance) from ABI input
// Writes: pallet(0x14) + call(0x00) + compact(poll_index) + variant(0x00) + vote_byte + balance_LE
// Output: 20-24 bytes depending on poll_index compact encoding
// Returns: ABI-encoded bytes (offset + length + padded data)
```

### PVM Contract: AlignmentScorer (690 bytes)

Governance personalization engine on RISC-V. Called cross-VM from `GovMindCore.sol`.

```rust
// Input: 11 parameters packed in 356-byte ABI-encoded calldata
//   w0-w5 (uint8[6]):    6 preference weights, each in a 32-byte slot
//   risk_tolerance (uint8): byte 227
//   category_id (uint8):   byte 259
//   risk_score (uint8):    byte 291
//   recommendation (int8): byte 323 (sign-extended)
//   confidence (uint8):    byte 355

// compute_alignment_score():
//   Same algorithm as Solidity _computeAlignmentScore
//   Category → axes mapping → alignment = 50 + (support - oppose) / 2
//   Risk penalty if risk_score > tolerance
//   Returns: uint8 clamped to [0, 100]

// personalize():
//   alignment >= 60: push toward Aye, boost confidence if base agrees
//   alignment <= 40: push toward Nay, boost confidence if base agrees
//   41-59: keep base recommendation and confidence
//   Override cases reduce confidence by half

// Output: 96 bytes (3 × 32-byte ABI slots)
//   Slot 0, byte 31: alignmentScore (uint8)
//   Slot 1, byte 31: personalizedRecommendation (int8, 0xFF if negative)
//   Slot 2, byte 31: adjustedConfidence (uint8)
```

### PVM Contract: CollectiveAggregator

Dynamic profile recalculation on RISC-V. Called cross-VM from `CollectiveRegistry.sol`. Completes the first EVM→PVM→EVM loop on Polkadot Hub.

```rust
// Function selectors:
SEL_JOIN:  [0x..] // recalculateOnJoin(uint8[6],uint8[6],uint8[6],uint32,uint8) → uint8[6]
SEL_LEAVE: [0x..] // recalculateOnLeave(uint8[6],uint8[6],uint8[6],uint32,uint8) → uint8[6]

// recalculate_on_join():
//   Input: seedAxes[6], currentAxes[6], newMemberAxes[6], memberCount, seedWeight
//   1. Reverse member average from current blended profile
//   2. Incorporate new member's axes into the average
//   3. Blend: effective[i] = seed[i] * seedWeight/100 + newAvg[i] * (100-seedWeight)/100
//   4. Return ABI-encoded uint8[6] (6 × 32-byte slots)

// recalculate_on_leave():
//   Same flow but removes the leaving member from the average
//   If last member leaves → returns seed axes (revert to founder's vision)

// Output: 192 bytes (6 × 32-byte ABI slots)
// Cross-VM flow: EVM CollectiveRegistry → PVM CollectiveAggregator → EVM IdentityVault
```

**Why Rust PVM?**
- **Native SCALE encoding** — Substrate's codec written in the language it was designed for
- **Deterministic integer math** — No Solidity overflow quirks for governance scoring
- **Tiny binaries** — 690 bytes and 1,523 bytes, smaller than most Solidity contracts
- **Togglable** — Admin can switch between EVM-only and cross-VM mode via `setPVMCodec()` / `setPVMScorer()`

---

## EVM Contracts (Solidity — Track 1)

| Contract | LOC | Purpose |
|----------|-----|---------|
| `GovMindCore.sol` | ~600 | Vote orchestration (manual + AI), on-chain personalization engine (`_computeAlignmentScore`), XCM relay integration, PVM scorer delegation |
| `IdentityVault.sol` | ~300 | 6-axis governance identity storage, per-track AI delegation config, auto-vote eligibility checks (`canAutoVote`) |
| `AIOracle.sol` | ~300 | AI analysis storage with IPFS references, re-analysis with version tracking, authorized oracle operators |
| `XCMGovernanceRelay.sol` | ~400 | XCM V5 message construction, SCALE encoding (or PVM delegation), XCM precompile execution, weight/fee admin |
| `CollectiveRegistry.sol` | ~350 | On-chain collective membership, dynamic 6-axis profile aggregation (seed 30% + member avg 70%), PVM cross-VM delegation, Solidity fallback |
| `ScaleCodec.sol` | ~150 | Pure Solidity SCALE: compact u32/u64/u128, fixed-width u128 LE, Vec\<u8\> encoding |

### Key Function Interfaces

```solidity
// ─── IdentityVault ───
function createIdentity(uint8 risk, uint8 minConf, uint256 maxDOT, string hash, uint8[] axes, uint8[] weights)
function configureTrackDelegation(uint8 track, bool enabled, uint256 maxAmount, uint8 maxConviction)
function canAutoVote(address user, uint8 track, uint256 amount, uint8 confidence) → bool
function getPreferenceWeights(address user) → uint8[6]

// ─── AIOracle ───
function publishAnalysis(uint256 refIndex, uint8 track, uint8 risk, uint8 category, int8 rec, uint8 conf,
                         uint256 amountDOT, uint256 impactBps, string ipfsHash)  // onlyOracle
function updateAnalysis(...)  // Increments version, emits AnalysisUpdated(oldRec, newRec)
function getAnalysis(uint256 refIndex) → ProposalAnalysis

// ─── GovMindCore ───
function vote(uint256 refIndex, bool aye, uint256 conviction, uint256 amount)    // Manual vote → XCM relay
function executeAIVote(address user, uint256 refIndex, bool aye, uint256 conviction,
                       uint256 amount, uint8 confidence, string reasoningHash)    // onlyOracle
function getPersonalizedInsight(address user, uint256 refIndex)
    → (int8 recommendation, uint8 confidence, uint8 riskScore, uint8 alignmentScore, string analysisHash)
function getPersonalizedInsightPVM(address user, uint256 refIndex)                // Cross-VM to AlignmentScorer

// ─── XCMGovernanceRelay ───
function relayVote(address voter, uint32 refIndex, bool aye, uint8 conviction, uint128 amount)
function previewEncodedCall(uint32 refIndex, bool aye, uint8 conviction, uint128 amount) → bytes
function previewXcmMessage(uint32 refIndex, bool aye, uint8 conviction, uint128 amount) → bytes
function setPVMCodec(address codec, bool enabled)                                 // Toggle cross-VM SCALE
function setTransactWeight(uint64 refTime, uint64 proofSize)                      // Admin: XCM weight config

// ─── CollectiveRegistry ───
function joinCollective(uint8 collectiveId)                                       // On-chain join (auto-switches)
function leaveCollective()                                                        // Leave current collective
function getCollectiveAxes(uint8 collectiveId) → uint8[6]                         // Dynamic profile (shifts with members)
function getSeedAxes(uint8 collectiveId) → uint8[6]                               // Founder's immutable anchor
function getUserCollective(address user) → uint8                                  // 0 = not in any collective
function getMemberCount(uint8 collectiveId) → uint256
function setPVMAggregator(address aggregator, bool enabled)                       // Toggle cross-VM aggregation
```

### Deployment Scripts

| Script | Purpose |
|--------|---------|
| `Deploy.s.sol` | Deploys all 6 EVM contracts to Polkadot Hub Testnet, wires dependencies, seeds 4 collectives |
| `DeployCollectives.s.sol` | Standalone CollectiveRegistry deployment with IdentityVault linkage and collective seeding |
| `WirePVM.s.sol` | Wires deployed PVM contracts into EVM contracts — calls `setPVMCodec()` on XCMGovernanceRelay, `setPVMScorer()` on GovMindCore, and `setPVMAggregator()` on CollectiveRegistry |

---

## Key Features

### AI-Powered Deep Analysis

The AI backend fetches proposal data from Subsquare, runs GPT-4o-mini analysis, and publishes compact results on-chain via AIOracle:

| Analysis Component | On-Chain | Off-Chain (IPFS) |
|-------------------|----------|-------------------|
| Risk score (0-100) | `uint8 riskScore` | Detailed risk factors with severity levels |
| Recommendation (-1/0/1) | `int8 recommendation` | Full reasoning with evidence |
| Confidence (0-100) | `uint8 confidence` | Confidence breakdown by factor |
| Category (0-9) | `uint8 categoryId` | Category justification |
| Treasury impact | `uint256 requestedAmountDOT`, `treasuryImpactBps` | Cost/month, value assessment, % of 38M treasury |
| Community sentiment | — | Weighted score, concerns, endorsements |
| Voting momentum | — | Aye/nay split, total stake, trend classification |
| Historical precedent | — | Similar proposals, proposer track record |
| Strengths & weaknesses | — | Balanced pro/con with evidence |

### Intelligent Re-Analysis

```
On-demand analysis request → Check if analysis exists on-chain
  │
  ├─ New proposal → Full analysis → publishAnalysis() → store on-chain + IPFS
  │
  └─ Existing analysis → Detect material changes:
       ├─ Tally swing ≥ 10% (aye/nay shift)
       ├─ New comments ≥ 2
       ├─ Status transition (Deciding → Confirming → Executed)
       │
       ├─ Changed + cooldown expired (5 min) → Re-analyze
       │    └─ Only updateAnalysis() if: rec changed OR riskDelta ≥ 10 OR confDelta ≥ 15
       │
       └─ No material change → Return cached analysis
```

### Per-Track AI Delegation

```solidity
// User configures per-track: "Auto-vote up to 50 DOT on Small Tipper, max conviction 2"
configureTrackDelegation(track=30, enabled=true, maxAmount=50e18, maxConviction=2)

// Backend checks eligibility before auto-voting:
canAutoVote(user, track, amount, confidence) → bool
  ├─ identity.exists?
  ├─ identity.autoVoteEnabled?
  ├─ trackDelegation[track].enabled?
  ├─ amount ≤ trackDelegation[track].maxAmount?
  └─ confidence ≥ identity.minConfidenceThreshold?
```

### AI Voting Collectives (On-Chain + Dynamic Profiles)

Four governance tribes with distinct 6-axis profiles, stored and managed entirely on-chain via `CollectiveRegistry.sol`. Membership is an on-chain transaction — join/leave emits events, shifts the collective's profile, and is verifiable on Blockscout.

| Collective | Seed Axes [0-5] | Risk Tolerance | Philosophy |
|------------|----------------|----------------|------------|
| Sustainability Guardians | `[70,40,40,70,80,60]` | 35 | Conservative spending, community-first |
| Innovation Accelerators | `[20,90,90,10,50,80]` | 75 | Growth spending, tech-progressive |
| Security Maximalists | `[60,30,30,95,30,70]` | 20 | Ultra-conservative on tech changes |
| Treasury Efficiency | `[95,10,50,60,40,50]` | 30 | Fiscal hawk, ROI-driven |

**Dynamic profile aggregation:** Collective profiles are not static. When a member joins or leaves, the profile recalculates:

```
effective_axes[i] = seedAxes[i] * seedWeight/100 + memberAverage[i] * (100 - seedWeight)/100

seedWeight = 30 (default)
→ 30% founder's vision (immutable anchor — keeps the name meaningful)
→ 70% member average (democratic influence — collective shifts with its members)
```

**On join:** Reverse the current member average from the blended profile, incorporate the new member's identity axes, re-blend. On leave: reverse out the departing member's axes and re-blend (or revert to seed if last member).

**Cross-VM aggregation pipeline (EVM→PVM→EVM):**
```
CollectiveRegistry.joinCollective(id)        ← EVM: triggers recalculation
    │
    ├─ identityVault.getPreferenceWeights()  ← EVM: read member's 6-axis identity
    │
    └─ aggregatorPVM.recalculateOnJoin(      ← PVM: compute weighted average on RISC-V
         seedAxes, currentAxes,
         newMemberAxes, memberCount,
         seedWeight
       ) → uint8[6] newAxes
    │
    └─ c.axes = newAxes                      ← EVM: store updated profile on-chain
        emit ProfileShifted(id, newAxes)
```

Three contracts, two VMs, one atomic transaction. The first EVM→PVM→EVM cross-VM loop on Polkadot Hub. Solidity fallback ensures the system works without PVM wired — admin toggles via `setPVMAggregator()`.

**Recommendation computation:** Same `_computeAlignmentScore` algorithm, but using the collective's dynamic profile instead of the user's. Frontend reads `getCollectiveAxes()` on-chain and mirrors the scoring logic client-side.

### Cross-Collective Consensus

Every proposal page shows all four collectives' recommendations side-by-side:

```
┌─────────────────────────────────────────────────────────────┐
│  Cross-Collective Consensus                                  │
│                                                              │
│  Sustainability    ██████████░░░░  Nay (38% alignment)       │
│  Innovation        ████████████░░  Aye (82% alignment)       │
│  Security          ██████░░░░░░░░  Nay (25% alignment)       │
│  Treasury Eff.     ████████░░░░░░  Nay (31% alignment)       │
│                                                              │
│  Consensus: Strong Nay (3/4 agree)                           │
│  ████████████████████████████████░░░░░░░░░░  75% Nay         │
└─────────────────────────────────────────────────────────────┘
```

Consensus labels: "Full Consensus: Aye/Nay" (4/4), "Strong Aye/Nay" (3/4), "Contentious" (2/2 split). When collectives with opposing philosophies (e.g., Innovation + Security) agree, that's a powerful governance signal.

### AI Governance Agent

Conversational chat on every proposal page. System prompt includes:
- Full proposal metadata (title, track, status, tally, treasury request)
- AI analysis (recommendation, risk factors, community sentiment, strengths/weaknesses)
- User's 6-axis governance identity (personalizes advice to their values)
- Personalized recommendation data (alignmentScore, adjustedConfidence, personalizedRec)
- Full `_computeAlignmentScore` algorithm explanation so the AI can reason about *why* recommendations differ
- Last 10 messages of conversation history

**Identity vs Collective Conflict Detection:**

The AI computes cosine similarity between the user's personal identity axes and their collective's profile axes. When similarity drops below 60%, the AI proactively flags the misalignment:

```
cosine_similarity(user_axes[6], collective_axes[6])
  < 60%  →  CONFLICT: "Your identity diverges significantly from your collective"
  60-80% →  MODERATE: Gentle note about specific divergent axes (diff ≥ 30 points)
  > 80%  →  STRONG ALIGNMENT: Confirmation
```

Example: A user with high treasury-growth (90) joins Security Maximalists (treasury-growth: 30). The AI flags: "Your growth-oriented identity conflicts with Security Maximalists' conservative stance on spending. Consider whether Innovation Accelerators might better represent your values."

---

## Subsquare Integration

GovMind integrates with Subsquare's data layer (the same data powering [Klara](https://polkadot.polkassembly.io/)) to enrich AI analysis with real community intelligence:

| Data Source | What We Extract | How It Improves Analysis |
|-------------|----------------|------------------------|
| **On-chain Tally** | Ayes/Nays in DOT, support levels | AI sees real voting momentum before recommending |
| **Community Comments** | Sentiment distribution, key concerns, expert endorsements | Community red flags increase risk score |
| **Proposed Call** | Exact spending amounts, payment tranches, beneficiaries | Precise treasury impact calculation |
| **Status Timeline** | Submission → Deciding → Confirming → Executed | AI understands governance lifecycle stage |
| **Reactions** | Thumbs up/down counts | Quick community sentiment signal |
| **Historical Proposals** | Past proposals by same proposer/track | Proposer track record & precedent analysis |

**Klara answers "what is this proposal?" — GovMind answers "should *you* vote for this, given *your* values?" — and then relays that vote cross-chain.**

---

## Backend API

Node.js REST API on port 3001. No framework — uses native `http` module.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/analyze/:id` | Trigger on-demand AI analysis for a referendum. Fetches from Subsquare, runs GPT-4o-mini, publishes to AIOracle on-chain. Returns full deep analysis JSON. |
| `GET` | `/api/analysis/:id` | Retrieve stored deep analysis. Cache miss triggers re-generation from Subsquare + GPT. |
| `GET` | `/api/analyses` | All stored analyses (summary view: rec, risk, confidence, category, trend). |
| `GET` | `/api/proposal/:id` | Proposal metadata from Subsquare (title, track, tally, comments, spending). |
| `POST` | `/api/chat/:id` | AI agent chat for a specific proposal. Accepts `{ message, history[], userIdentity }`. |
| `POST` | `/api/chat/delegation` | AI delegation advisor chat. Accepts `{ message, history[], userIdentity, delegates[] }`. |
| `GET` | `/api/collectives` | Live member counts (supplementary — primary membership is on-chain via CollectiveRegistry). |
| `POST` | `/api/collectives/join` | Backend sync for collective join (primary: on-chain `joinCollective()` tx). |
| `POST` | `/api/collectives/leave` | Backend sync for collective leave (primary: on-chain `leaveCollective()` tx). |
| `GET` | `/api/collectives/membership/:addr` | Get user's collective membership (reads from both backend cache and on-chain). |
| `GET` | `/api/health` | Health check: analysis count, proposal count, in-progress analyses, uptime. |

---

## Deployed Contracts (Polkadot Hub Testnet v5)

### EVM Contracts

| Contract | Address |
|----------|---------|
| IdentityVault | [`0xCC6d8B7896E451cD3c3a34adA0dE55885519aDA1`](https://blockscout-testnet.polkadot.io/address/0xCC6d8B7896E451cD3c3a34adA0dE55885519aDA1) |
| AIOracle | [`0xB9364a7Be7be4598BBb4edb812aFbe25a85ebB2A`](https://blockscout-testnet.polkadot.io/address/0xB9364a7Be7be4598BBb4edb812aFbe25a85ebB2A) |
| GovMindCore | [`0x9738ceE50C7ce9E45d32a27D43886D61EF7D3f6a`](https://blockscout-testnet.polkadot.io/address/0x9738ceE50C7ce9E45d32a27D43886D61EF7D3f6a) |
| XCMGovernanceRelay | [`0xFf63bF7E3e0eB21BFB552B6e32de08a98Ad01faF`](https://blockscout-testnet.polkadot.io/address/0xFf63bF7E3e0eB21BFB552B6e32de08a98Ad01faF) |
| CollectiveRegistry | [`0x8415f90D44dAb2943836C07F1bb6f21A70174649`](https://blockscout-testnet.polkadot.io/address/0x8415f90D44dAb2943836C07F1bb6f21A70174649) |

### PVM Contracts (Rust → RISC-V)

| Contract | Address | Binary Size |
|----------|---------|-------------|
| ScaleCodecPVM | [`0x9c0E4B07f26726d6646C8465cfA39f9662550cDb`](https://blockscout-testnet.polkadot.io/address/0x9c0E4B07f26726d6646C8465cfA39f9662550cDb) | 1,523 bytes |
| AlignmentScorer | [`0x60B9D9D2097963ADf51Cf6c1E1b80309c2959238`](https://blockscout-testnet.polkadot.io/address/0x60B9D9D2097963ADf51Cf6c1E1b80309c2959238) | 690 bytes |
| CollectiveAggregator | [`0x8561fe6E3A635d5bD6a529Bf0021Cba894D06e13`](https://blockscout-testnet.polkadot.io/address/0x8561fe6E3A635d5bD6a529Bf0021Cba894D06e13) | 1,148 bytes |

**Network:** Polkadot Hub Testnet | **Chain ID:** `420420417` | **RPC:** `https://eth-rpc-testnet.polkadot.io/`

**Explorer:** [Blockscout](https://blockscout-testnet.polkadot.io) | **Faucet:** [faucet.polkadot.io](https://faucet.polkadot.io)

---

## Quick Start

```bash
# EVM Smart Contracts (Track 1)
forge install
forge build
forge test -vvv                # 79 tests: identity, AI oracle, personalization, XCM relay, SCALE codec, fuzz

# Deploy EVM to Polkadot Hub Testnet
forge script script/Deploy.s.sol --rpc-url https://services.polkadothub-rpc.com/testnet --broadcast

# PVM Smart Contracts (Track 2)
# Requires: rustup with nightly-2024-11-19, polkatool
cd pvm-contracts
./build.sh                     # Builds ScaleCodecPVM + AlignmentScorer + CollectiveAggregator
node deploy.cjs                # Deploys PVM binaries to Polkadot Hub Testnet

# Wire PVM contracts into EVM contracts (enables cross-VM dispatch)
cd ..
forge script script/WirePVM.s.sol --rpc-url https://services.polkadothub-rpc.com/testnet --broadcast

# AI Backend
cd backend && npm install
# Set OPENAI_API_KEY and PRIVATE_KEY in .env
npm start                      # API on port 3001

# Frontend
cd frontend && npm install
npm run dev                    # http://localhost:3000
```

---

## Test Suite

**79 tests** across two test files with **7 fuzz tests** (256 runs each):

### GovMind.t.sol — 47 tests

| Category | Tests | What's Tested |
|----------|-------|---------------|
| IdentityVault | 8 | Create identity, duplicate revert, risk tolerance validation, update preferences, toggle auto-vote, configure track delegation, batch configure, `canAutoVote` eligibility |
| AIOracle | 6 | Request analysis, fee validation, publish analysis, unauthorized revert, duplicate revert, authorize/revoke operators |
| Re-Analysis | 5 | Update analysis, update changes personalization output, update nonexistent revert, unauthorized revert, multiple version increments |
| Manual Voting | 5 | Manual vote recording, double vote revert, zero amount revert, invalid conviction revert, referendum stats aggregation |
| Vote History | 2 | Full history retrieval, paginated history |
| AI Auto-Vote | 6 | `executeAIVote` flow, no identity revert, not enabled revert, no analysis revert, below confidence revert, confidence validation |
| Personalization | 5 | No identity returns base, no analysis reverts, **two users with opposite axes get opposite recommendations**, technical upgrade category mapping, risk tolerance penalty reduces alignment |
| Admin | 2 | Update contract references, toggle XCM relay |
| Fuzz | 3 | `testFuzz_CreateIdentityRiskTolerance(uint8)`, `testFuzz_VoteConviction(uint256)`, `testFuzz_RequestFee(uint256)` |

### XCMRelay.t.sol — 32 tests

| Category | Tests | What's Tested |
|----------|-------|---------------|
| SCALE Codec | 6 | Compact u32 single-byte (0-63), two-byte (64-16383), four-byte (16384+), u128 LE encoding, zero encoding, Vec\<u8\> |
| Vote Encoding | 4 | Aye+conviction 1 (0x81), Nay+conviction 3 (0x03), no conviction (0x80/0x00), max conviction 6 |
| XCM V5 Structure | 5 | Relay chain destination, overall structure, contains InitiateTeleport (0x11), BuyExecution (0x13), Transact (0x06) + RefundSurplus (0x14) + DepositAsset (0x0D) |
| Relay Execution | 10 | Relay disabled revert, unauthorized revert, invalid conviction revert, zero amount revert, authorize/revoke callers, update weight, update fee, owner relay, records vote, emits event |
| V5 Format | 1 | Transact uses `Option<Weight>` format for `fallback_max_weight` |
| Multi-Relay | 1 | Multiple consecutive relays for same referendum |
| Fuzz | 4 | Compact u32 length validation, u128 LE always 16 bytes, conviction vote encoding range, XCM message length > 30 bytes with V5 prefix |

```bash
forge test -vvv                                    # All 79 tests
forge test --match-path test/XCMRelay.t.sol -vvv   # XCM + SCALE tests only
forge test --match-test testFuzz -vvv              # Fuzz tests only (256 runs each)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **EVM Contracts** | Solidity 0.8.28, Foundry, OpenZeppelin v5, XCM Precompile (`0x0A0000`), SCALE Codec |
| **PVM Contracts** | Rust (`no_std`), `polkavm-derive`, `pallet-revive-uapi`, RISC-V target (`riscv32emac-unknown-none-polkavm`), `polkatool` |
| **Cross-VM** | pallet-revive cross-VM dispatch (EVM ↔ PVM, transparent routing, ABI-compatible) |
| **Frontend** | Next.js 14, React 18, TypeScript, Wagmi v2, RainbowKit, TailwindCSS, react-markdown |
| **AI Backend** | Node.js (native `http`), OpenAI GPT-4o-mini, Ethers.js v6 |
| **Data** | Subsquare API (`polkadot-api.subsquare.io`), IPFS (analysis storage) |

---

## Roadmap

### Current State (Hackathon)
- 6 EVM contracts (Solidity) deployed on Polkadot Hub Testnet — including CollectiveRegistry with dynamic profiles
- 3 PVM contracts (Rust → RISC-V) with cross-VM integration — ScaleCodecPVM, AlignmentScorer, CollectiveAggregator
- First EVM→PVM→EVM cross-VM loop on Polkadot Hub (CollectiveRegistry → CollectiveAggregator → IdentityVault)
- AI analysis pipeline with deep proposal intelligence from Subsquare + GPT-4o-mini
- 6-axis personalized governance identity with on-chain alignment scoring
- XCM V5 cross-chain vote relay (proof-of-concept via Hub sovereign account)
- On-chain Voting Collectives with dynamic profiles (30% seed + 70% member influence), cross-collective consensus panel
- Conversational AI governance agent with identity-vs-collective conflict detection (cosine similarity)
- Cross-collective consensus: 4 collectives' recommendations side-by-side per proposal
- Backend REST API with 11 endpoints (analysis, chat, collectives, health)
- 79 tests including 7 fuzz tests (256 runs each)
- Dual-track submission: Track 1 (EVM) + Track 2 (PVM)

### Phase 1 — Production Voting (Post-Hackathon)
**Goal:** Make every user's vote count individually on the Relay Chain.

Currently, votes relay through Hub's sovereign account — all users' votes appear as one pooled vote on the Relay Chain. To fix this:

- **Derivative account model** — Map each Hub EVM user to a unique derivative index under Hub's sovereign account. Each derivative gets its own Relay Chain address, enabling per-user countable votes. This is the same approach [Bifrost uses for vDOT governance](https://docs.bifrost.io/for-builders/lst-governance) and is proven in production.
- **Governance proxy fallback** — For users who want stronger on-chain identity, create per-user governance proxy accounts on the Relay Chain via XCM.

### Phase 2 — Hub Governance Precompile
**Goal:** Native EVM governance without XCM complexity.

Polkadot's 2026 roadmap includes governance precompiles for Hub EVM ([Moonbeam already has one](https://docs.moonbeam.network/builders/ethereum/precompiles/features/governance/conviction-voting/)). When available:

- Replace XCM relay with direct precompile calls
- Atomic execution — no cross-chain latency
- Users vote with their own Hub account, not a sovereign derivative
- GovMindCore becomes a thin wrapper around the precompile with personalization logic on top

### Phase 3 — Ecosystem Integration
**Goal:** Become the governance intelligence layer for Polkadot.

- **Bifrost vDOT support** — Let liquid stakers vote without unstaking. Integrate with Bifrost's SLPx for cross-chain vDOT minting and governance.
- **Decentralized AI** — Replace centralized OpenAI dependency with on-chain or decentralized inference (e.g., Phala Network, Giza). Multiple oracle operators instead of one backend.
- **Multi-chain governance** — Extend to parachain governance (Moonbeam, Astar, Hydration) using XCM for cross-chain analysis and voting.
- **Delegation marketplace** — Users delegate to GovMind as a governance delegate, with AI voting based on the delegator's identity profile. GovMind becomes an on-chain delegate with transparent, auditable decision-making.

### Phase 4 — Autonomous Governance Agent
**Goal:** From tool to autonomous participant.

- **True AI agent** — Autonomous monitoring of new proposals, automatic analysis, proactive notifications, and delegated vote execution without manual triggering.
- **Learning from outcomes** — Track proposal outcomes (delivered vs failed) and feed results back into the AI model to improve future recommendations.
- **Cross-proposal reasoning** — AI considers interactions between proposals (e.g., two treasury requests competing for the same funds).
- **DAO-as-a-service** — Organizations configure a single governance identity and GovMind votes across all Polkadot governance on their behalf.

---

## License

MIT
