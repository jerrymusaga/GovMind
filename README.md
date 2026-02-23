# GovMind — AI Governance Intelligence Layer for Polkadot

> Personalized AI-powered governance for Polkadot OpenGov. Two users, same proposal, different votes.

## What is GovMind?

GovMind makes Polkadot OpenGov accessible through AI. Users create a "Governance Identity" that captures their values and risk preferences. The AI analyzes every proposal — risk scoring, treasury impact, historical comparison — and can auto-vote on behalf of users according to their personalized profile.

A treasury-conservative user and a growth-focused user see the **same proposal** but get **different AI recommendations**. That's personalized governance.

## Architecture

```
Frontend (Next.js + Viem)
    ↕
Smart Contracts (Solidity on Polkadot Hub EVM)
  ├── src/GovMindCore.sol    — Vote orchestration & execution
  ├── src/IdentityVault.sol  — User governance preference storage
  └── src/AIOracle.sol       — AI analysis bridge
    ↕
AI Backend (Node.js)
  ├── Proposal analysis via LLM
  ├── Data from Subsquare + Subscan APIs
  └── Personalized vote matching
```

## Contracts

| Contract | Purpose |
|----------|---------|
| `IdentityVault.sol` | Stores governance identities: 6-axis preference weights, risk tolerance, per-track AI delegation config |
| `AIOracle.sol` | Receives AI analyses from backend, stores on-chain with IPFS references |
| `GovMindCore.sol` | Orchestrates manual + AI votes, tracks stats, interfaces with governance precompiles |

## Quick Start

```bash
# Install dependencies
forge install

# Build contracts
forge build

# Run tests
forge test

# Run tests with verbosity
forge test -vvv

# Deploy to Polkadot Hub TestNet
# 1. Get PAS tokens from https://faucet.polkadot.io
# 2. Set your private key in .env
cp .env.example .env
# 3. Deploy
forge script script/Deploy.s.sol --rpc-url https://services.polkadothub-rpc.com/testnet --broadcast
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
- **AI Proposal Analysis** — Risk scoring, treasury impact, category classification, reasoning chains
- **Per-Track Delegation** — Enable AI voting on specific OpenGov tracks with amount/conviction limits
- **Confidence Thresholds** — AI only auto-votes when confidence exceeds user-set minimum
- **Vote History** — Full on-chain audit trail of manual and AI-assisted votes

## Precompile Integration

- **XCM Precompile** (`0x...0a0000`) — Cross-chain treasury/staking data queries
- **Governance Precompile** — Vote execution on OpenGov referenda (mock provided, production-ready interface)

## Tech Stack

- **Solidity 0.8.28** — Smart contracts
- **Foundry** — Build, test, deploy
- **OpenZeppelin v5** — Access control, reentrancy guards

## License

MIT
