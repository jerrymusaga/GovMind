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
- No other ecosystem has this combination of governance complexity and cross-chain infrastructure

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 14 + Wagmi v2 + RainbowKit + TailwindCSS)   │
│  ├── Dashboard with live on-chain stats & XCM relay status      │
│  ├── Proposal detail with deep AI analysis visualizations       │
│  ├── Identity builder (6-axis radar chart + delegation config)  │
│  ├── Vote panel with conviction & amount controls               │
│  └── AI Agent chat (floating, context-aware per proposal)       │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│  EVM Contracts (Solidity 0.8.28 on Polkadot Hub)     [Track 1]  │
│  ├── GovMindCore.sol      — Vote orchestration & personalization│
│  ├── IdentityVault.sol    — 6-axis governance identity storage  │
│  ├── AIOracle.sol         — AI analysis bridge (on-chain proof) │
│  ├── XCMGovernanceRelay.sol — XCM vote relay to Relay Chain     │
│  └── ScaleCodec.sol       — Pure Solidity SCALE encoding lib    │
└──────────┬────────────────────┬─────────────────────────────────┘
           │ cross-VM dispatch  │ XCM Precompile (0x0A0000)
           ▼ (pallet-revive)   ▼
┌──────────────────────┐  ┌──────────────────────────────────────┐
│  PVM Contracts       │  │  Polkadot Relay Chain                │
│  (Rust → RISC-V)     │  │  └── convictionVoting.vote()         │
│  [Track 2]           │  │      Pallet 20, call 0               │
│  ├── ScaleCodecPVM   │  └──────────────────────────────────────┘
│  │   Native SCALE    │                   ▲
│  │   encoding        │  ┌────────────────┴─────────────────────┐
│  └── AlignmentScorer │  │  AI Backend (Node.js + GPT-4o-mini)  │
│      Governance      │  │  ├── Polkassembly API — tally, data  │
│      personalization │  │  ├── Deep analysis — risk, treasury   │
│      on RISC-V       │  │  ├── Change detection & re-analysis  │
└──────────────────────┘  │  ├── AI Agent chat — governance Q&A  │
                          │  └── REST API (port 3001)             │
                          └──────────────────────────────────────┘
```

**Two VMs. Three layers. No bridge.** EVM contracts call Rust PVM contracts via pallet-revive cross-VM dispatch. PVM contracts relay votes to the Relay Chain via XCM.

---

## Key Features

### XCM Cross-Chain Voting
- First EVM dApp to relay OpenGov votes cross-chain via XCM Transact
- Pure Solidity SCALE codec encodes `convictionVoting.vote()` calls
- XCM V5 message: `WithdrawAsset → InitiateTeleport → (BuyExecution → Transact → RefundSurplus → DepositAsset)`
- Sends through the XCM precompile at `0x0A0000` to the Relay Chain
- Preview functions (`previewEncodedCall`, `previewXcmMessage`) for off-chain verification
- On-chain relay tracking with per-referendum vote history

### AI-Powered Deep Analysis
- **Treasury breakdown** — DOT requested, % of 38M treasury, cost/month, value assessment
- **Risk factors** — categorized with severity (low/medium/high/critical)
- **Community sentiment** — weighted score from Polkassembly comments, concerns & endorsements
- **Voting momentum** — aye/nay split, total stake, trend classification
- **Historical precedent** — similar past proposals, proposer track record
- **Strengths & weaknesses** — balanced pro/con assessment
- All analysis stored on-chain via AIOracle with IPFS hash references and version tracking

### Personalized Governance Identity
- **6-axis preference system** — Treasury Conservative ↔ Growth, Technical Progressive ↔ Conservative, Community ↔ Infrastructure
- **On-chain alignment computation** — same proposal + different user = different recommendation
- **Risk tolerance** — proposals exceeding user's threshold get penalty adjustments
- **Confidence thresholds** — AI only auto-votes when confidence exceeds user-set minimum

### AI Governance Agent
- Conversational chat interface on every proposal page
- Context-aware — knows the proposal data, AI analysis, and user's governance identity
- Answers questions about risk, treasury impact, voting strategy, and historical context
- Personalized responses based on user's 6-axis preferences

### Per-Track AI Delegation
- Enable/disable AI voting on specific OpenGov tracks
- Set maximum DOT amount and conviction per track
- Track-level granularity: auto-vote on small tips, manual control on big spends

### Intelligent Re-Analysis
- Detects material changes: tally swings (≥10%), new comments (≥2), status transitions
- Re-runs AI analysis when conditions change
- Only updates on-chain when recommendation or risk score shifts significantly
- 5-minute cooldown prevents excessive re-analysis

---

## Smart Contracts

### EVM Contracts (Solidity — Track 1)

| Contract | Purpose |
|----------|---------|
| `GovMindCore.sol` | Orchestrates manual + AI votes, on-chain personalization engine, XCM relay integration. Delegates to PVM AlignmentScorer when enabled. |
| `IdentityVault.sol` | Stores governance identities: 6-axis preference weights, risk tolerance, per-track AI delegation config |
| `AIOracle.sol` | Receives AI analyses from backend, stores on-chain with IPFS references. Supports re-analysis with version tracking |
| `XCMGovernanceRelay.sol` | Constructs XCM V5 message, sends via XCM precompile to Relay Chain. Delegates SCALE encoding to PVM ScaleCodecPVM when enabled. |
| `ScaleCodec.sol` | Pure Solidity SCALE encoding: compact u32/u64/u128, fixed-width u128 LE, Vec\<u8\> (fallback when PVM codec is disabled) |

### PVM Contracts (Rust → RISC-V — Track 2)

| Contract | Binary Size | Purpose |
|----------|-------------|---------|
| `ScaleCodecPVM` | 1,523 bytes | Native Rust SCALE encoding on RISC-V. Encodes `convictionVoting.vote()` calls with compact integers and fixed-width u128 LE. Called cross-VM from `XCMGovernanceRelay.sol`. |
| `AlignmentScorer` | 690 bytes | Governance personalization engine on RISC-V. Computes 6-axis alignment scores, applies risk penalties, and returns personalized recommendations. Called cross-VM from `GovMindCore.sol`. |

Both PVM contracts are called transparently from EVM Solidity via **pallet-revive cross-VM dispatch** — no bridge, no XCM, just a regular contract call that routes across VMs.

### Personalization Algorithm

```
getPersonalizedInsight(user, referendum):
  1. Fetch AI base analysis from AIOracle
  2. Load user's 6-axis preferences from IdentityVault
  3. Map proposal category → supporting/opposing preference axes
     - Treasury proposals → (TREASURY_GROWTH vs TREASURY_CONSERVATIVE)
     - Technical upgrades → (TECHNICAL_PROGRESSIVE vs TECHNICAL_CONSERVATIVE)
     - Community/infra   → (COMMUNITY_FOCUSED vs INFRASTRUCTURE_FOCUSED)
  4. alignment = 50 + (supportWeight - opposeWeight) / 2
  5. Risk penalty: if riskScore > userTolerance → alignment -= (risk - tolerance) / 2
  6. Alignment >= 60 → push toward Aye
     Alignment <= 40 → push toward Nay
     41-59 → keep base AI recommendation
  7. Return personalized recommendation + adjusted confidence
```

**Result:** Same proposal, different users, different recommendations — all computed on-chain, fully deterministic.

### XCM Vote Relay Flow

```
User votes on Hub EVM
    │
    ▼
GovMindCore.vote()
    │
    ▼
XCMGovernanceRelay.relayVote()
    │
    ├─ SCALE-encode convictionVoting.vote(poll_index, AccountVote::Standard{vote, balance})
    │    ├─ Pallet index: 0x14 (20 = ConvictionVoting)
    │    ├─ Call index: 0x00 (vote)
    │    ├─ Poll index: Compact<u32> (1-4 bytes)
    │    ├─ Vote byte: bit 7 = aye flag, bits 0-6 = conviction (0-6)
    │    └─ Balance: u128 fixed-width little-endian (16 bytes)
    │
    ├─ Build XCM V5 message:
    │    ┌─ OUTER (executes on Hub):
    │    │   ├─ WithdrawAsset(DOT, parents:1)
    │    │   └─ InitiateTeleport → Relay Chain
    │    │        └─ INNER (executes on Relay):
    │    │             ├─ BuyExecution(Unlimited)
    │    │             ├─ Transact(SovereignAccount, encoded_call)
    │    │             ├─ RefundSurplus
    │    │             └─ DepositAsset(All → Here)
    │    │
    │    └─ V5 Transact uses Option<Weight> for fallback_max_weight
    │
    └─ XCM_PRECOMPILE.execute(xcm_message, refTime, proofSize)
         │
         ▼
    DOT teleported to Relay Chain → convictionVoting.vote() executed
```

### Cross-VM Architecture (Track 2)

GovMind runs computation-heavy logic on Rust PVM contracts, called from Solidity EVM contracts via pallet-revive's cross-VM dispatch:

```
EVM (Solidity)                          PVM (Rust → RISC-V)
──────────────                          ────────────────────
XCMGovernanceRelay.relayVote()
    │
    ├─ usePVMCodec == true?
    │   YES → scaleCodecPVM.encodeVoteCall(pollIndex, aye, conviction, balance)
    │         │                         ┌─────────────────────────────┐
    │         └── cross-VM dispatch ──► │ ScaleCodecPVM (1,523 bytes) │
    │                                   │  SCALE compact u32          │
    │                                   │  Vote byte (aye + conviction)│
    │                                   │  u128 LE balance            │
    │                                   │  Returns: encoded call bytes│
    │                                   └─────────────────────────────┘
    │   NO  → ScaleCodec.sol (pure Solidity fallback)
    │
    └─ Build XCM V5 → XCM Precompile (0x0A0000) → Relay Chain

GovMindCore.getPersonalizedInsightPVM()
    │
    ├─ Load user preferences from IdentityVault
    ├─ Load AI analysis from AIOracle
    │
    └─ alignmentScorerPVM.computeAlignment(w0..w5, risk, category, ...)
                                        ┌─────────────────────────────┐
           cross-VM dispatch ─────────► │ AlignmentScorer (690 bytes)  │
                                        │  6-axis alignment scoring   │
                                        │  Risk penalty calculation   │
                                        │  Recommendation adjustment  │
                                        │  Returns: (score, rec, conf)│
                                        └─────────────────────────────┘
```

**Why Rust PVM?**
- **Native SCALE encoding** — Substrate's codec written in the language it was designed for
- **Deterministic integer math** — No Solidity overflow quirks for governance scoring
- **Tiny binaries** — 690 bytes and 1,523 bytes, smaller than most Solidity contracts
- **Togglable** — Admin can switch between EVM-only and cross-VM mode via `setPVMCodec()` / `setPVMScorer()`

---

## Polkassembly Integration

GovMind integrates with Polkassembly's data layer (the same data powering [Klara](https://polkadot.polkassembly.io/)) to enrich AI analysis with real community intelligence:

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

## Deployed Contracts (Polkadot Hub Testnet v4)

### EVM Contracts

| Contract | Address |
|----------|---------|
| IdentityVault | [`0x32F9f794b917AdC54b1708Df809a10386c81f07d`](https://blockscout-testnet.polkadot.io/address/0x32F9f794b917AdC54b1708Df809a10386c81f07d) |
| AIOracle | [`0x7bD88Cd06d781B2cf39f509D0a7909160DcE95da`](https://blockscout-testnet.polkadot.io/address/0x7bD88Cd06d781B2cf39f509D0a7909160DcE95da) |
| GovMindCore | [`0x8DF87ba9728C42a5597e7398bC369B86c4D6386f`](https://blockscout-testnet.polkadot.io/address/0x8DF87ba9728C42a5597e7398bC369B86c4D6386f) |
| XCMGovernanceRelay | [`0x34a2f569D91561A583432F8DEC0055C4f811DB73`](https://blockscout-testnet.polkadot.io/address/0x34a2f569D91561A583432F8DEC0055C4f811DB73) |

### PVM Contracts (Rust → RISC-V)

| Contract | Address | Binary Size |
|----------|---------|-------------|
| ScaleCodecPVM | [`0x9c0E4B07f26726d6646C8465cfA39f9662550cDb`](https://blockscout-testnet.polkadot.io/address/0x9c0E4B07f26726d6646C8465cfA39f9662550cDb) | 1,523 bytes |
| AlignmentScorer | [`0x60B9D9D2097963ADf51Cf6c1E1b80309c2959238`](https://blockscout-testnet.polkadot.io/address/0x60B9D9D2097963ADf51Cf6c1E1b80309c2959238) | 690 bytes |

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
./build.sh                     # Builds ScaleCodecPVM (1,523 bytes) + AlignmentScorer (690 bytes)
node deploy.cjs                # Deploys PVM binaries and wires into EVM contracts

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

**79 tests** across two test files:

| File | Tests | Coverage |
|------|-------|----------|
| `GovMind.t.sol` | 47 | Identity creation, preference weights, AI analysis publishing/updating, personalization (two users opposite recs), alignment scoring, risk penalty, manual/AI voting, PVM scorer integration, access control, edge cases, 3 fuzz tests |
| `XCMRelay.t.sol` | 32 | SCALE compact encoding (1/2/4 byte), U128 LE encoding, vote byte construction, XCM V5 message structure (WithdrawAsset, InitiateTeleport, BuyExecution, Transact, RefundSurplus, DepositAsset), relay execution with mocked precompile, PVM codec integration, authorization, weight/fee admin, 4 fuzz tests (256 runs each) |

```bash
forge test -vvv                                    # All 79 tests
forge test --match-path test/XCMRelay.t.sol -vvv   # XCM + SCALE tests only
forge test --match-test testFuzz -vvv              # Fuzz tests only
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **EVM Contracts** | Solidity 0.8.28, Foundry, OpenZeppelin v5, XCM Precompile, SCALE Codec |
| **PVM Contracts** | Rust (no_std), polkavm-derive, pallet-revive-uapi, RISC-V target, polkatool |
| **Cross-VM** | pallet-revive cross-VM dispatch (EVM ↔ PVM, transparent routing) |
| **Frontend** | Next.js 14, React 18, TypeScript, Wagmi v2, RainbowKit, TailwindCSS |
| **AI Backend** | Node.js, OpenAI GPT-4o-mini, Ethers.js v6 |
| **Data** | Polkassembly API, IPFS (analysis storage) |

---

## Roadmap

### Current State (Hackathon)
- 5 EVM contracts (Solidity) deployed on Polkadot Hub Testnet
- 2 PVM contracts (Rust → RISC-V) with cross-VM integration into EVM contracts
- AI analysis pipeline with deep proposal intelligence
- 6-axis personalized governance identity with on-chain alignment scoring
- XCM V5 cross-chain vote relay (proof-of-concept via Hub sovereign account)
- Conversational AI governance agent
- 79 tests including fuzz testing
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
