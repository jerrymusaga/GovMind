# GovMind — AI Governance Intelligence Layer for Polkadot

> Personalized AI governance + cross-chain voting via XCM. Two users, same proposal, different votes — executed on the Relay Chain from Hub EVM.

**Track 1: EVM Smart Contract — Polkadot Solidity Hackathon 2026**

## What is GovMind?

GovMind makes Polkadot OpenGov accessible through AI and cross-chain execution. Users create a **Governance Identity** — a 6-axis preference profile — and GovMind's AI analyzes every proposal with deep intelligence: treasury impact, risk factors, community sentiment, voting momentum, and historical precedent. The AI then produces **personalized recommendations** that differ per user based on their values.

When users vote, GovMind **SCALE-encodes the `convictionVoting.vote()` call** in pure Solidity and **relays it to the Polkadot Relay Chain via XCM** — making it the first EVM dApp to execute OpenGov votes cross-chain.

A treasury-conservative user and a growth-focused user see the **same proposal** but get **different AI recommendations** — and both votes are relayed to the Relay Chain through a single XCM Transact.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 14 + Wagmi v2 + RainbowKit + TailwindCSS)   │
│  ├── Dashboard with live on-chain stats & XCM relay status      │
│  ├── Proposal detail with deep AI analysis charts               │
│  ├── Identity creation (6-axis radar chart + settings)          │
│  └── Vote panel with conviction & amount controls               │
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
│  └── REST API (port 3001) — serves rich analysis to frontend    │
└─────────────────────────────────────────────────────────────────┘
```

## Key Features

### XCM Cross-Chain Voting
- **First EVM dApp to relay OpenGov votes cross-chain** via XCM Transact
- Pure Solidity SCALE codec encodes `convictionVoting.vote()` calls
- XCM V5 message: `WithdrawAsset → BuyExecution → Transact → RefundSurplus → DepositAsset`
- Sends through the XCM precompile at `0x0A0000` to the Relay Chain
- Preview functions (`previewEncodedCall`, `previewXcmMessage`) for off-chain verification

### AI-Powered Deep Analysis
- **Treasury breakdown** — DOT requested, % of treasury, cost/month, value assessment
- **Risk factors** — categorized with severity (low/medium/high/critical)
- **Community sentiment** — weighted score from Polkassembly comments, concerns & endorsements
- **Voting momentum** — aye/nay split, total stake, trend classification
- **Historical precedent** — similar past proposals, proposer track record
- **Strengths & weaknesses** — balanced pro/con assessment

### Personalized Governance
- **6-axis preference system** — Treasury Conservative ↔ Growth, Technical Progressive ↔ Conservative, Community ↔ Infrastructure
- **On-chain alignment computation** — same proposal + different user = different recommendation
- **Risk tolerance** — proposals exceeding user's risk threshold get penalty adjustments
- **Confidence thresholds** — AI only auto-votes when confidence exceeds user-set minimum

### Per-Track AI Delegation
- Enable/disable AI voting on specific OpenGov tracks
- Set maximum DOT amount and conviction per track
- Toggle auto-vote master switch independently

### Intelligent Re-Analysis
- Detects changes: tally swings, new comments, status transitions
- Re-runs AI analysis when significant changes occur
- Only updates on-chain when recommendation or risk score changes materially
- Cooldown prevents excessive re-analysis

## Deployed Contracts (Polkadot Hub Testnet v4)

| Contract | Address |
|----------|---------|
| IdentityVault | [`0x70a5d03293AA0547639cE5E65ad7175Ec1FFfdF8`](https://blockscout-testnet.polkadot.io/address/0x70a5d03293AA0547639cE5E65ad7175Ec1FFfdF8) |
| AIOracle | [`0xA71F44C0832f80690C11fba2309914DB17Daa46A`](https://blockscout-testnet.polkadot.io/address/0xA71F44C0832f80690C11fba2309914DB17Daa46A) |
| GovMindCore | [`0x72F4a9352C9b44B0d3c03c098137f861560D3Ce7`](https://blockscout-testnet.polkadot.io/address/0x72F4a9352C9b44B0d3c03c098137f861560D3Ce7) |
| XCMGovernanceRelay | [`0xCf5E50197C0212bd8171aB40db75E8737416dC2a`](https://blockscout-testnet.polkadot.io/address/0xCf5E50197C0212bd8171aB40db75E8737416dC2a) |

## Contracts

| Contract | Purpose |
|----------|---------|
| `IdentityVault.sol` | Stores governance identities: 6-axis preference weights, risk tolerance, per-track AI delegation config |
| `AIOracle.sol` | Receives AI analyses from backend, stores on-chain with IPFS references. Supports re-analysis with version tracking |
| `GovMindCore.sol` | Orchestrates manual + AI votes, on-chain personalization engine (`_computeAlignmentScore`), XCM relay integration |
| `XCMGovernanceRelay.sol` | SCALE-encodes `convictionVoting.vote()`, constructs XCM V5 message, sends via XCM precompile to Relay Chain |
| `ScaleCodec.sol` | Pure Solidity SCALE encoding: compact u32/u64/u128, fixed-width u128 LE, Vec<u8> |

### Personalization Algorithm

```
getPersonalizedInsight(user, referendum):
  1. Fetch AI base analysis from AIOracle
  2. Load user's 6-axis preferences from IdentityVault
  3. Map proposal category → supporting/opposing preference axes
  4. Compute alignment score (0-100) with risk penalty
  5. Alignment >= 60 → push toward Aye
     Alignment <= 40 → push toward Nay
     41-59 → keep base AI recommendation
  6. Return personalized recommendation + adjusted confidence
```

**Result:** Same proposal, different users, different recommendations — all computed on-chain.

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
    │    └─ Vote byte: bit 7 = aye, bits 0-6 = conviction
    │
    ├─ Build XCM V5 message:
    │    ├─ WithdrawAsset(DOT for fees)
    │    ├─ BuyExecution(Unlimited weight limit)
    │    ├─ Transact(SovereignAccount, encoded_call)
    │    ├─ RefundSurplus
    │    └─ DepositAsset(All → Here)
    │
    └─ XCM_PRECOMPILE.send(relay_chain_destination, xcm_message)
         │
         ▼
    Polkadot Relay Chain executes convictionVoting.vote()
```

## Polkassembly / Klara Integration

GovMind integrates with **Polkassembly's data layer** (the same data that powers [Klara](https://polkadot.polkassembly.io/), Polkassembly's AI governance assistant) to enrich AI analysis with real community intelligence:

| Data Source | What We Extract | How It Improves Analysis |
|-------------|----------------|------------------------|
| **On-chain Tally** | Ayes/Nays in DOT, support levels | AI sees real voting momentum before recommending |
| **Community Comments** | Sentiment distribution, key concerns, expert endorsements | Community red flags increase risk score |
| **Proposed Call** | Exact spending amounts, payment tranches, beneficiaries | Precise treasury impact calculation |
| **Status Timeline** | Submission → Deciding → Confirming → Executed | AI understands governance lifecycle stage |
| **Reactions** | Thumbs up/down counts | Quick community sentiment signal |
| **Historical Proposals** | Past proposals by same proposer/track | Proposer track record & precedent analysis |

**Klara answers "what is this proposal?" — GovMind answers "should *you* vote for this, given *your* values?" — and then relays that vote cross-chain.**

## Quick Start

```bash
# === Smart Contracts ===
forge install
forge build
forge test -vvv    # 75 tests including XCM relay + SCALE codec + fuzz tests

# Deploy to Polkadot Hub TestNet
forge script script/Deploy.s.sol --rpc-url https://services.polkadothub-rpc.com/testnet --broadcast

# === AI Backend ===
cd backend && npm install
# Set OPENAI_API_KEY and PRIVATE_KEY in .env
npm start          # Fetches proposals → deep AI analysis → publishes on-chain → serves API

# === Frontend ===
cd frontend && npm install
npm run dev        # Opens at http://localhost:3000
```

## Network Config

| Parameter | Value |
|-----------|-------|
| Network | Polkadot Hub TestNet |
| RPC URL | `https://services.polkadothub-rpc.com/testnet` |
| Chain ID | `420420417` |
| Explorer | https://blockscout-testnet.polkadot.io |
| Faucet | https://faucet.polkadot.io |

## Test Suite

**75 tests** across two test files:

| File | Tests | Coverage |
|------|-------|----------|
| `GovMind.t.sol` | 45 | Identity creation, preference weights, AI analysis, personalization, alignment scoring, manual/AI voting, access control, edge cases, fuzz tests |
| `XCMRelay.t.sol` | 30 | SCALE compact encoding, U128 LE encoding, vote byte encoding, XCM message structure, relay execution with mocked precompile, access control, weight/fee admin, 4 fuzz tests (256 runs each) |

```bash
forge test -vvv          # Run all 75 tests
forge test --match-path test/XCMRelay.t.sol -vvv  # XCM tests only
```

## Tech Stack

- **Solidity 0.8.28** — Smart contracts with on-chain personalization + SCALE codec
- **Foundry** — Build, test (75 tests + fuzz), deploy
- **OpenZeppelin v5** — Access control, reentrancy guards
- **XCM Precompile** — Cross-chain messaging to Relay Chain
- **SCALE Codec** — Substrate-compatible encoding in pure Solidity
- **Next.js 14** — Frontend with App Router
- **Wagmi v2 + RainbowKit** — Wallet connection & contract interaction
- **TailwindCSS** — Responsive dark-themed UI with data visualizations
- **OpenAI GPT-4o-mini** — Deep proposal analysis engine
- **Polkassembly API** — Enriched governance data (Klara data layer)

## Frontend Screenshots

The dashboard features:
- **Hero section** with XCM cross-chain voting highlight
- **5 live stat cards** — AI Analyses, Total Votes, AI Votes, XCM Relayed, Identities
- **XCM Banner** — visual flow diagram (Hub EVM → XCM V5 → Relay Chain) with live status
- **Proposal cards** — risk meter, recommendation badge, alignment ring
- **Deep analysis page** — Treasury donut chart, sentiment bar, voting momentum, risk factors, historical precedent, strengths/weaknesses
- **Identity page** — 6-axis sliders with radar chart, auto-vote settings, track delegation

## License

MIT
