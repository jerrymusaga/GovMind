# GovMind — AI Governance Intelligence Layer for Polkadot

> Personalized AI-powered governance for Polkadot OpenGov. Two users, same proposal, different votes.

## What is GovMind?

GovMind makes Polkadot OpenGov accessible through AI. Users create a "Governance Identity" that captures their values and risk preferences. The AI analyzes every proposal — risk scoring, treasury impact, community sentiment, on-chain voting patterns — and can auto-vote on behalf of users according to their personalized profile.

A treasury-conservative user and a growth-focused user see the **same proposal** but get **different AI recommendations**. That's personalized governance.

## Architecture

```
Frontend (Next.js + Wagmi + RainbowKit)
    ↕
Smart Contracts (Solidity on Polkadot Hub EVM)
  ├── src/GovMindCore.sol    — Vote orchestration & personalization engine
  ├── src/IdentityVault.sol  — User governance preference storage (6-axis)
  └── src/AIOracle.sol       — AI analysis bridge (on-chain proof)
    ↕
AI Backend (Node.js + OpenAI GPT)
  ├── Enriched data from Polkassembly (Klara data layer)
  │     ├── Live voting tally (ayes/nays/support in DOT)
  │     ├── Community comments & sentiment analysis
  │     ├── On-chain proposed_call spending breakdown
  │     └── Status timeline & reaction data
  ├── GPT-4o-mini analysis with community context
  └── On-chain publishing via AIOracle contract
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

**Klara answers "what is this proposal?" — GovMind answers "should *you* vote for this, given *your* values?"**

They are complementary: Klara is the **information layer**, GovMind is the **decision layer**. Better input from Polkassembly = better personalized output from GovMind.

## Deployed Contracts (Polkadot Hub Testnet)

| Contract | Address |
|----------|---------|
| IdentityVault | [`0x9847Be9B20f23b2cb12C2D6C49B58772096E45eF`](https://blockscout-testnet.polkadot.io/address/0x9847Be9B20f23b2cb12C2D6C49B58772096E45eF) |
| AIOracle | [`0xC762A770E8A50887232497032be4CD19EC2C3478`](https://blockscout-testnet.polkadot.io/address/0xC762A770E8A50887232497032be4CD19EC2C3478) |
| GovMindCore | [`0x36B98748d41AAB1E50ca0F29E6dC9c4372C74C6e`](https://blockscout-testnet.polkadot.io/address/0x36B98748d41AAB1E50ca0F29E6dC9c4372C74C6e) |

## Contracts

| Contract | Purpose |
|----------|---------|
| `IdentityVault.sol` | Stores governance identities: 6-axis preference weights, risk tolerance, per-track AI delegation config |
| `AIOracle.sol` | Receives AI analyses from backend, stores on-chain with IPFS references |
| `GovMindCore.sol` | Orchestrates manual + AI votes, personalization engine (_computeAlignmentScore), tracks stats |

### Personalization Algorithm

```
getPersonalizedInsight(user, referendum):
  1. Fetch AI base analysis from AIOracle
  2. Load user's 6-axis preferences from IdentityVault
  3. Map proposal category → supporting/opposing preference axes
  4. Compute alignment score (0-100) with risk penalty
  5. Alignment ≥ 60 → push toward Aye
     Alignment ≤ 40 → push toward Nay
     41-59 → keep base AI recommendation
  6. Return personalized recommendation + adjusted confidence
```

**Result:** Same proposal, different users, different recommendations — all computed on-chain.

## Quick Start

```bash
# === Smart Contracts ===
forge install
forge build
forge test -vvv    # 40 tests including personalization + fuzz tests

# Deploy to Polkadot Hub TestNet
forge script script/Deploy.s.sol --rpc-url https://services.polkadothub-rpc.com/testnet --broadcast

# === AI Backend ===
cd backend && npm install
# Set OPENAI_API_KEY in .env
npm start          # Fetches proposals → AI analysis → publishes on-chain

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

## Key Features

- **Governance Identity** — 6-axis preference system (treasury conservative ↔ growth, technical progressive ↔ conservative, community ↔ infrastructure)
- **AI Proposal Analysis** — Risk scoring, treasury impact, category classification, enriched with Polkassembly community data
- **Personalized Recommendations** — On-chain alignment computation means different users get different advice
- **Per-Track Delegation** — Enable AI voting on specific OpenGov tracks with amount/conviction limits
- **Confidence Thresholds** — AI only auto-votes when confidence exceeds user-set minimum
- **Vote History** — Full on-chain audit trail of manual and AI-assisted votes
- **Polkassembly Integration** — Live voting tally, community sentiment, spending breakdowns feed into AI analysis

## Tech Stack

- **Solidity 0.8.28** — Smart contracts with on-chain personalization
- **Foundry** — Build, test (40 tests + fuzz), deploy
- **OpenZeppelin v5** — Access control, reentrancy guards
- **Next.js 14** — Frontend with App Router
- **Wagmi v2 + RainbowKit** — Wallet connection & contract interaction
- **OpenAI GPT-4o-mini** — Proposal analysis engine
- **Polkassembly API** — Enriched governance data (Klara data layer)

## License

MIT
