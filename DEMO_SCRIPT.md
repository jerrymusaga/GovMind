# GovMind Demo Script

> Duration: ~5 minutes | For hackathon judges

---

## Scene 1: The Problem (30 seconds)

**[Screen: Polkadot Subsquare — list of active referenda]**

*Narration:*

"Polkadot has the most powerful on-chain governance in crypto. 15 tracks. Conviction voting. Approval curves. Timelocks. Over 1,400 referenda so far."

**[Scroll through proposals — dense titles, large DOT amounts, technical jargon]**

"But look at this from a regular DOT holder's perspective. Referendum 1386 — a 250,000 DOT treasury request. Should you vote Aye or Nay? You'd need to read the full proposal, evaluate the team's track record, understand the treasury impact, compare it to similar past requests, and check community sentiment."

**[Click into a proposal — wall of text, no clear recommendation]**

"Multiply that by dozens of active proposals. Most DOT holders give up. They skip governance entirely — not because they don't care, but because it's overwhelming. And even if they did decide, there's no way to vote from an EVM environment cross-chain."

"What if AI could analyze every proposal through the lens of YOUR values — and then relay your vote to the Relay Chain from Hub EVM via XCM?"

---

## Scene 2: Meet GovMind (15 seconds)

**[Screen: GovMind homepage — dashboard with live stats]**

"This is GovMind — AI governance intelligence for Polkadot. Six smart contracts on Hub EVM. Three PVM contracts on RISC-V. Cross-chain voting via XCM V5. And a personalized AI that gives different recommendations to different users based on their governance identity."

**[Point out live stats: proposals analyzed, identities created, votes cast, XCM relayed]**

---

## Scene 3: Create Your Governance Identity (45 seconds)

**[Screen: Identity page — 6-axis builder with radar chart]**

"First, you create a governance identity. Six axes capture your values as a voter."

**[Adjust sliders while narrating:]**

- "Treasury Conservative vs Growth — how aggressively should the treasury spend?"
- "Technical Progressive vs Conservative — embrace upgrades or prioritize stability?"
- "Community vs Infrastructure — fund community initiatives or core tooling?"

"I'll set up a treasury-conservative, security-focused profile."

**[Set axes: ~80 conservative, ~30 growth, ~30 tech progressive, ~85 tech conservative, ~40 community, ~60 infra]**
**[Set risk tolerance: 35]**

**[Click "Create Identity" — MetaMask pops up]**

"This is an on-chain transaction. My governance identity is stored in the IdentityVault contract on Polkadot Hub."

**[Transaction confirms — show Blockscout link]**

"There it is — on Blockscout. My 6-axis identity, immutably stored on-chain."

---

## Scene 4: Join a Collective (30 seconds)

**[Screen: Collectives page — four governance tribes]**

"Now, collectives. These are governance tribes with shared philosophies. Each has a 6-axis profile that dynamically shifts based on its members."

**[Point out: Sustainability Guardians, Innovation Accelerators, Security Maximalists, Treasury Efficiency]**

"My identity is security-focused, so I'll join Security Maximalists."

**[Click "Join" — MetaMask pops up]**

"This is also on-chain — the CollectiveRegistry contract records my membership. And here's what's interesting: because my identity profile feeds into the collective's average, Security Maximalists just shifted slightly toward my values."

**[Show member count increment]**

"The formula: `effective_profile = seed * 30% + member_average * 70%`. The founder's vision anchors the collective, but members own 70% of the influence. A third PVM contract — the CollectiveAggregator — computes this weighted average on RISC-V via cross-VM dispatch."

---

## Scene 5: AI Proposal Analysis (60 seconds)

**[Screen: Proposals list — click into an active referendum]**

"Let's look at an active proposal. Referendum 1386 — a treasury spend request."

**[Proposal detail page loads — AI analysis card appears]**

"GovMind's AI has already analyzed this. Risk score: 72 out of 100 — flagged as high risk. Category: Treasury Spend. Base recommendation: Aye with 68% confidence."

**[Point out analysis sections:]**
- "Risk factors — team track record, milestone vagueness, treasury percentage"
- "Community sentiment — weighted from Subsquare comments and reactions"
- "Treasury impact — exact DOT amount, percentage of the 38M DOT treasury"
- "Strengths and weaknesses — balanced analysis with evidence"

"But here's where it gets personal."

**[Scroll to personalized recommendation section]**

"The AI recommendation flipped. For MY identity — treasury-conservative, high security — the personalized recommendation is NAY. My alignment score is 22 out of 100. The risk score of 72 exceeds my tolerance of 35."

"If I had a growth-focused identity, I'd see AYE on the same proposal. Same data, different values, different recommendation — computed on-chain."

---

## Scene 6: Cross-Collective Consensus (30 seconds)

**[Point to the cross-collective consensus panel]**

"And look at this — cross-collective consensus. All four collectives analyzed the same proposal:"

- "Sustainability Guardians: Nay (conservative spending)"
- "Innovation Accelerators: Aye (growth opportunity)"
- "Security Maximalists: Nay (high risk)"
- "Treasury Efficiency: Nay (poor ROI)"

**[Point to consensus bar]**

"Three out of four say Nay. The consensus label: 'Strong Nay.' When collectives with opposite philosophies agree, that's a powerful signal."

---

## Scene 7: AI Chat Agent (45 seconds)

**[Click the chat bubble — AI agent opens]**

"I can also chat with GovMind's AI directly. It knows the proposal, my identity, my collective, and the full analysis."

**[Type: "Why did my identity change the recommendation from Aye to Nay?"]**

**[AI responds with personalized explanation — references user's axes, risk tolerance, alignment score]**

"It explains exactly how my axes influenced the score. The algorithm is deterministic — `alignment = 50 + (support - oppose) / 2`, with a risk penalty."

**[Type: "My collective is Security Maximalists but my identity is more moderate. Is there a conflict?"]**

**[AI responds with cosine similarity analysis, flags specific divergent axes]**

"It computes cosine similarity between my identity and the collective profile — 73% alignment. It flags that my community-focus axis (40) diverges from the collective's (30). Smart enough to tell me when my tribe doesn't fully represent my values."

---

## Scene 8: Vote via XCM (45 seconds)

**[Scroll to vote panel — set conviction to 1x, amount to 1 DOT]**

"Now I'll vote. I'm on Hub EVM — but the vote needs to execute on the Polkadot Relay Chain. GovMind handles this with XCM."

**[Click "Vote Nay" — MetaMask pops up]**

"Here's what happens under the hood:"

1. "GovMindCore records my vote on-chain"
2. "XCMGovernanceRelay SCALE-encodes `convictionVoting.vote()` — pallet 20, call index 0"
3. "It builds an XCM V5 message: WithdrawAsset, InitiateTeleport to Relay Chain, BuyExecution, Transact, RefundSurplus, DepositAsset"
4. "The XCM precompile at `0x0A0000` sends it cross-chain"

**[Transaction confirms]**

"Vote confirmed. Let me show you the transaction on Blockscout."

**[Open Blockscout — show the transaction, contract interaction, XCM precompile call]**

"There — the XCM precompile call. DOT teleported to the Relay Chain, and `convictionVoting.vote()` executed. An EVM contract on Hub just cast a governance vote on the Relay Chain."

---

## Scene 9: Technical Architecture (30 seconds)

**[Screen: Architecture slide or README diagram]**

"The full stack:"

- "Six EVM contracts in Solidity — identity, AI oracle, vote orchestration, XCM relay, SCALE codec, collective registry"
- "Three PVM contracts in Rust compiled to RISC-V — SCALE encoding, alignment scoring, collective aggregation"
- "Cross-VM dispatch via pallet-revive — EVM calls PVM on the same chain, no bridge"
- "XCM V5 for cross-chain vote execution — Hub EVM to Relay Chain"
- "79 Foundry tests including 7 fuzz tests"

"Two VMs. Three layers. No bridge. This only works on Polkadot."

---

## Scene 10: Closing (15 seconds)

"GovMind turns Polkadot's governance complexity from a barrier into an advantage. Personalized AI analysis. On-chain governance identity. Dynamic collectives. Cross-chain voting via XCM. All live on testnet."

"Thank you."

---

## Key Transactions to Have Ready

Before recording, ensure these transactions are visible on Blockscout:

1. **Identity creation** — IdentityVault `createIdentity()` tx
2. **Collective join** — CollectiveRegistry `joinCollective()` tx
3. **Vote cast** — GovMindCore `vote()` tx with XCM precompile call
4. **AI analysis published** — AIOracle `publishAnalysis()` tx

Block explorer: https://blockscout-testnet.polkadot.io

## Tips for Recording

- Use a clean wallet with a fresh identity for the demo
- Pre-load the wallet with testnet DOT from faucet.polkadot.io
- Have the proposal page pre-loaded (analysis takes a few seconds first time)
- Keep MetaMask visible during transactions — judges want to see real tx confirmations
- Open Blockscout in a separate tab, ready to show transaction details
- The AI chat responds in 2-3 seconds — no need to speed up
