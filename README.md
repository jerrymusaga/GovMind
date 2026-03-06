# GovMind — AI Governance Intelligence for Polkadot

> **Two users. Same proposal. Different values. Different AI recommendations. Both vote on the Relay Chain from Hub EVM via XCM.**

**Track 1: EVM Smart Contract — Polkadot Solidity Hackathon 2026**

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
│  Smart Contracts (Solidity 0.8.28 on Polkadot Hub EVM)          │
│  ├── GovMindCore.sol      — Vote orchestration & personalization│
│  ├── IdentityVault.sol    — 6-axis governance identity storage  │
│  ├── AIOracle.sol         — AI analysis bridge (on-chain proof) │
│  ├── XCMGovernanceRelay.sol — XCM vote relay to Relay Chain     │
│  └── ScaleCodec.sol       — Pure Solidity SCALE encoding lib    │
└───────────────────────────────┬─────────────────────────────────┘
                                │ XCM Precompile (0x0A0000)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Polkadot Relay Chain                                           │
│  └── convictionVoting.vote() — Pallet index 20, call index 0   │
└─────────────────────────────────────────────────────────────────┘
                                ▲
┌───────────────────────────────┴─────────────────────────────────┐
│  AI Backend (Node.js + OpenAI GPT-4o-mini)                      │
│  ├── Polkassembly API — voting tally, comments, spending data   │
│  ├── Historical precedent matching — proposer track record      │
│  ├── Deep analysis — treasury breakdown, risk factors, etc.     │
│  ├── Change detection — re-analyzes on tally swings/new data    │
│  ├── AI Agent chat — conversational governance advisor           │
│  └── REST API (port 3001) — serves analysis + chat to frontend  │
└─────────────────────────────────────────────────────────────────┘
```

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

| Contract | Purpose |
|----------|---------|
| `GovMindCore.sol` | Orchestrates manual + AI votes, on-chain personalization engine (`_computeAlignmentScore`), XCM relay integration |
| `IdentityVault.sol` | Stores governance identities: 6-axis preference weights, risk tolerance, per-track AI delegation config |
| `AIOracle.sol` | Receives AI analyses from backend, stores on-chain with IPFS references. Supports re-analysis with version tracking |
| `XCMGovernanceRelay.sol` | SCALE-encodes `convictionVoting.vote()`, constructs XCM V5 message, sends via XCM precompile to Relay Chain |
| `ScaleCodec.sol` | Pure Solidity SCALE encoding: compact u32/u64/u128, fixed-width u128 LE, Vec\<u8\> |

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

| Contract | Address |
|----------|---------|
| IdentityVault | [`0x5DAdd67d21330153CaA2fF5dB3a0Ce96786f9eb8`](https://blockscout-testnet.polkadot.io/address/0x5DAdd67d21330153CaA2fF5dB3a0Ce96786f9eb8) |
| AIOracle | [`0x628812BE85aC3fe49bfC6b3aD3F26d0097a07667`](https://blockscout-testnet.polkadot.io/address/0x628812BE85aC3fe49bfC6b3aD3F26d0097a07667) |
| GovMindCore | [`0x018aC1f307d6b2FD1426458Df4d32e306660398a`](https://blockscout-testnet.polkadot.io/address/0x018aC1f307d6b2FD1426458Df4d32e306660398a) |
| XCMGovernanceRelay | [`0x246DE6C6e938f70305B6919C94e4D103c0D7d45f`](https://blockscout-testnet.polkadot.io/address/0x246DE6C6e938f70305B6919C94e4D103c0D7d45f) |

**Network:** Polkadot Hub Testnet | **Chain ID:** `420420417` | **RPC:** `https://services.polkadothub-rpc.com/testnet`

**Explorer:** [Blockscout](https://blockscout-testnet.polkadot.io) | **Faucet:** [faucet.polkadot.io](https://faucet.polkadot.io)

---

## Quick Start

```bash
# Smart Contracts
forge install
forge build
forge test -vvv                # 75 tests: identity, AI oracle, personalization, XCM relay, SCALE codec, fuzz

# Deploy to Polkadot Hub Testnet
forge script script/Deploy.s.sol --rpc-url https://services.polkadothub-rpc.com/testnet --broadcast

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

**75 tests** across two test files:

| File | Tests | Coverage |
|------|-------|----------|
| `GovMind.t.sol` | 45 | Identity creation, preference weights, AI analysis publishing/updating, personalization (two users opposite recs), alignment scoring, risk penalty, manual/AI voting, access control, edge cases, 3 fuzz tests |
| `XCMRelay.t.sol` | 30 | SCALE compact encoding (1/2/4 byte), U128 LE encoding, vote byte construction, XCM V5 message structure (WithdrawAsset, InitiateTeleport, BuyExecution, Transact, RefundSurplus, DepositAsset), relay execution with mocked precompile, authorization, weight/fee admin, 4 fuzz tests (256 runs each) |

```bash
forge test -vvv                                    # All 75 tests
forge test --match-path test/XCMRelay.t.sol -vvv   # XCM + SCALE tests only
forge test --match-test testFuzz -vvv              # Fuzz tests only
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Smart Contracts** | Solidity 0.8.28, Foundry, OpenZeppelin v5, XCM Precompile, SCALE Codec |
| **Frontend** | Next.js 14, React 18, TypeScript, Wagmi v2, RainbowKit, TailwindCSS |
| **AI Backend** | Node.js, OpenAI GPT-4o-mini, Ethers.js v6 |
| **Data** | Polkassembly API, IPFS (analysis storage) |

---

## Roadmap

### Current State (Hackathon)
- 5 Solidity contracts deployed on Polkadot Hub Testnet
- AI analysis pipeline with deep proposal intelligence
- 6-axis personalized governance identity with on-chain alignment scoring
- XCM V5 cross-chain vote relay (proof-of-concept via Hub sovereign account)
- Conversational AI governance agent
- 75 tests including fuzz testing

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
