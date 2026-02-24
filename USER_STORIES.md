# GovMind — User Stories & Scenarios

> Every scenario a user or system actor can experience in GovMind, end to end.

---

## Table of Contents

1. [First-Time User: Discovering GovMind](#1-first-time-user-discovering-govmind)
2. [Creating a Governance Identity](#2-creating-a-governance-identity)
3. [Browsing AI-Analyzed Proposals](#3-browsing-ai-analyzed-proposals)
4. [Deep Dive: Proposal Analysis](#4-deep-dive-proposal-analysis)
5. [Personalized Recommendations](#5-personalized-recommendations)
6. [Manual Voting with XCM Relay](#6-manual-voting-with-xcm-relay)
7. [AI Auto-Voting](#7-ai-auto-voting)
8. [Updating Governance Identity](#8-updating-governance-identity)
9. [Per-Track Delegation](#9-per-track-delegation)
10. [Re-Analysis on Community Changes](#10-re-analysis-on-community-changes)
11. [Two Users, Same Proposal, Different Votes](#11-two-users-same-proposal-different-votes)
12. [XCM Cross-Chain Vote Execution](#12-xcm-cross-chain-vote-execution)
13. [Viewing Vote History](#13-viewing-vote-history)
14. [Admin: Oracle Management](#14-admin-oracle-management)
15. [Admin: XCM Relay Configuration](#15-admin-xcm-relay-configuration)

---

## 1. First-Time User: Discovering GovMind

**Actor:** New Polkadot token holder who wants to participate in governance but finds OpenGov overwhelming.

**Scenario:**

1. User navigates to GovMind's dashboard at `localhost:3000`.
2. They see the **hero section** — "Your AI Governance Co-Pilot for OpenGov" — with four feature pills: AI Analysis, Personal Identity, XCM Cross-Chain, and On-Chain Proof.
3. Below, the **XCM Banner** shows a visual flow: Hub EVM → XCM V4 → Relay Chain, with a "LIVE" indicator if XCM relay is active.
4. The **stats bar** displays 5 live on-chain metrics: AI Analyses published, Total Votes cast, AI Votes executed, XCM Relayed votes, and Identities created.
5. The user sees a **"Connect Wallet"** button prominently in the hero.
6. They connect their wallet via RainbowKit (MetaMask, WalletConnect, etc.).
7. After connecting, the hero updates to show **"Set Up Identity"** and **"View Proposals"** CTAs.
8. An **Identity Banner** appears: *"Create your Governance Identity — Set your governance philosophy to get personalized AI recommendations."*

**What they learn:** GovMind analyzes proposals with AI, personalizes recommendations to each user, and can relay votes cross-chain to the Relay Chain.

---

## 2. Creating a Governance Identity

**Actor:** Connected wallet holder who wants personalized governance recommendations.

**Scenario:**

1. User clicks **"Set Up Identity"** or navigates to `/identity`.
2. They see two tabs: **Preferences** and **Settings**.

### Preferences Tab (6-Axis Sliders)

3. Six slider controls appear, each representing a governance philosophy axis:
   - **Treasury Conservative** (0-100) — "Minimize treasury spend"
   - **Treasury Growth** (0-100) — "Invest for ecosystem growth"
   - **Technical Progressive** (0-100) — "Favor protocol upgrades"
   - **Technical Conservative** (0-100) — "Favor stability"
   - **Community Focused** (0-100) — "Prioritize community proposals"
   - **Infrastructure Focused** (0-100) — "Prioritize infra/tooling"

4. As the user adjusts sliders, a **radar chart** updates in real-time showing their governance profile shape.
5. A sidebar explains the 4-step flow: Set preferences → AI analyzes → Identity modifies recommendation → Different users get different advice.

### Settings Tab

6. User configures:
   - **Risk Tolerance** (0-100) — How much risk they accept in proposals.
   - **Min AI Confidence** (0-100) — Minimum AI confidence score required before auto-voting is triggered.
   - **Max Auto-Vote Amount (PAS)** — Maximum tokens AI can commit per vote.

### Submitting

7. User clicks **"Create Identity"**.
8. A wallet transaction is triggered — `IdentityVault.createIdentity()` is called on-chain.
9. After confirmation, the status updates to **"Identity Active"** with a green badge.
10. An **Auto-Vote toggle** appears — currently off by default.

**On-chain effect:** `IdentityVault` stores the 6-axis weights, risk tolerance, confidence threshold, and max vote amount. `totalIdentities` increments. The user's address is added to `identityHolders[]`.

---

## 3. Browsing AI-Analyzed Proposals

**Actor:** Any user (with or without wallet connected).

**Scenario:**

1. On the dashboard, the user scrolls past the hero to the **"Active Proposals"** grid.
2. Each proposal is displayed as a **ProposalCard** showing:
   - Referendum number (`#1836`)
   - Track name (`Big Spender`, `Small Tipper`, etc.)
   - An "AI" badge if analysis exists on-chain
   - **Recommendation badge** — Aye (green), Nay (red), or Abstain (amber)
   - **Confidence percentage** — e.g., "78% confidence"
   - **Risk meter** — colored bar from green (low) to red (high) with score
   - **Alignment ring** (if connected with identity) — circular indicator showing 0-100 alignment

3. If connected with an identity, each card shows a text hint:
   - "This proposal aligns with your governance values" (alignment >= 60)
   - "This proposal conflicts with your governance values" (alignment <= 40)
   - No text for neutral alignment (41-59)

4. A live counter shows how many proposals are analyzed: *"5 analyzed"* with a pulsing green dot.
5. If no proposals exist yet, an empty state says: *"No proposals analyzed yet — Run the AI backend to analyze active Polkadot referenda."*

**What happens behind the scenes:** Each `ProposalCard` makes two on-chain reads: `AIOracle.getAnalysis()` for the base AI data, and `GovMindCore.getPersonalizedInsight()` for the user-specific recommendation.

---

## 4. Deep Dive: Proposal Analysis

**Actor:** User who clicks on a proposal card to see the full AI intelligence.

**Scenario:**

1. User clicks a card and navigates to `/proposals/1836`.
2. The **header** shows: referendum number, track, category, analysis version, and date analyzed.
3. Links to **Polkassembly** and **on-chain proof** (Blockscout) are provided.

### Row 1: Recommendations & Risk

4. Three panels side by side:
   - **AI Base Recommendation** — e.g., "Aye" with 82% confidence (same for all users)
   - **Your Personalized Rec** — e.g., "Nay" with 65% confidence (if user has identity; otherwise prompts to create one)
   - **Risk Assessment** — semicircular gauge with needle showing risk score (0-100), color-coded green/amber/red

5. If personalization changed the recommendation, a highlighted banner appears:
   > "Personalization active: Your governance identity changed the recommendation from Aye to Nay"

### Alignment Score

6. An **alignment bar** shows 0-100 how well this proposal matches the user's values, with labels: Opposed / Neutral / Aligned.

### AI Verdict

7. A paragraph-length **AI verdict** summarizes the proposal in plain language.

### Row 2: Deep Analysis Grid (4 panels)

8. **Treasury Breakdown** — Donut chart showing % of treasury requested, total DOT, estimated USD, duration in months, cost/month, value assessment quote.
9. **Voting Momentum** — Aye/Nay split bar with percentages, total DOT committed, trend label (Strong Aye / Leaning Aye / Contested / Leaning Nay / Strong Nay / Early Stage).
10. **Community Sentiment** — Tri-color bar (supportive/neutral/opposed), overall signal badge (bullish/bearish/mixed), weighted score (-100 to +100), key takeaway, listed concerns and endorsements.
11. **Risk Factors** — Each risk with a name, severity badge (low/medium/high/critical), and detail explanation.

### Row 3: Historical Context & Strengths/Weaknesses

12. **Historical Precedent** — Similar past proposals, proposer's track record, precedent analysis. If no data, shows "No historical precedent data available."
13. **Strengths & Weaknesses** — Two-column layout: green-bordered strengths vs red-bordered weaknesses.

### Row 4: Vote & Stats

14. **Cast Your Vote** panel — Amount input, conviction slider (0x to 6x), Aye/Nay buttons.
15. **GovMind Votes** — Aye/Nay bar chart, voter count, AI voter count for this referendum.

### Row 5: XCM Cross-Chain Relay

16. An **XCM section** explains: *"Votes cast through GovMind are relayed to Polkadot Relay Chain via XCM Transact."*
17. Shows the flow: Hub EVM → XCM → Relay Chain, with "SCALE Codec + XCM V4" badge.

---

## 5. Personalized Recommendations

**Actor:** Two users with different governance philosophies viewing the same treasury spending proposal.

**Scenario:**

### Alice — Treasury Growth Advocate
- Treasury Conservative: 20, Treasury Growth: 90
- Technical Progressive: 70, Technical Conservative: 30
- Community Focused: 50, Infrastructure Focused: 50
- Risk Tolerance: 75

### Bob — Fiscal Conservative
- Treasury Conservative: 95, Treasury Growth: 10
- Technical Progressive: 40, Technical Conservative: 60
- Community Focused: 30, Infrastructure Focused: 70
- Risk Tolerance: 25

### Proposal #1836: "Polkadot-API 2026 Development Funding" (Treasury Spend, Risk: 45)

**AI Base Analysis:** Aye, 78% confidence, Risk 45/100

**For Alice:**
1. Category: TREASURY_SPEND → support axis = Treasury Growth (90), oppose axis = Treasury Conservative (20)
2. Raw alignment = 50 + (90 - 20) / 2 = 85
3. Risk 45 <= tolerance 75 → no penalty
4. Alignment 85 >= 60 → push toward Aye
5. **Result: Aye, 87% confidence** (boosted by strong alignment)

**For Bob:**
1. Same category mapping: support = Treasury Growth (10), oppose = Treasury Conservative (95)
2. Raw alignment = 50 + (10 - 95) / 2 = 7.5 → 8
3. Risk 45 > tolerance 25 → penalty: 8 - (45-25)/2 = -2 → clamped to 0
4. Alignment 0 <= 40 → push toward Nay
5. **Result: Nay, 64% confidence** (AI said Aye but user values override)

**Same proposal. Same AI analysis. Completely different recommendations.**

---

## 6. Manual Voting with XCM Relay

**Actor:** Connected user who decides to vote on a proposal after reading the AI analysis.

**Scenario:**

1. On the proposal detail page, the user sees the **Cast Your Vote** panel.
2. They enter:
   - **Amount:** 50 PAS
   - **Conviction:** 3x (drag slider to 3)
3. They click **"Vote Aye"**.
4. A wallet transaction is triggered — `GovMindCore.vote(1836, true, 3, 50e18)`.

### What happens on-chain:

5. `GovMindCore` validates: not already voted, conviction 0-6, amount > 0.
6. A `VoteRecord` is stored: voter, referendum, aye, conviction 3, amount 50 PAS, isAIVote=false.
7. `referendumTrackers[1836]` updates: totalAye += 50 PAS, voterCount++.
8. `totalVotesCast` increments.
9. **If XCM relay is enabled:**
   - `xcmRelay.relayVote(voter, 1836, true, 3, 50e18)` is called
   - The contract SCALE-encodes: pallet 20, call 0, compact poll index 1836, vote byte `0x83` (aye + conviction 3), u128 LE balance
   - Builds XCM V4 message with 5 instructions
   - Sends via `XCM_PRECOMPILE.send()` to Relay Chain destination (parents: 1, interior: Here)
   - `VoteRelayed` event emitted with full XCM message bytes
   - `totalRelayedVotes` increments

10. UI shows: *"Vote recorded on-chain!"* with a green checkmark.
11. Re-visiting the proposal shows: *"You have voted on this proposal"*.

---

## 7. AI Auto-Voting

**Actor:** User who has enabled auto-vote and the AI backend runs analysis.

**Preconditions:**
- User has a governance identity with auto-vote **enabled**
- User has configured **track delegation** for the relevant track (e.g., Big Spender)
- AI confidence exceeds user's minimum threshold

**Scenario:**

1. The AI backend detects a new active referendum #1850 on the Big Spender track.
2. Backend fetches enriched data from Polkassembly: tally, comments, spending info, status.
3. Backend fetches historical precedents: similar past proposals by the same proposer.
4. GPT-4o-mini produces a deep analysis: Aye recommendation, 85% confidence, risk 35.
5. Backend publishes analysis on-chain via `AIOracle.publishAnalysis()`.
6. Backend checks if any identity holders have auto-vote enabled for this track.
7. For eligible user Alice (minConfidence: 60, track delegation enabled with maxAmount: 200 DOT):
   - Confidence 85 > threshold 60 ✓
   - Track delegation enabled ✓
   - Amount within limits ✓
8. Backend calls `GovMindCore.executeAIVote(alice, 1850, true, 1, 100e18, 85, "QmHash...")`.
9. GovMindCore validates: identity exists, auto-vote enabled, analysis exists, track delegated, confidence sufficient, not already voted.
10. Vote is recorded with `isAIVote = true` and reasoning hash.
11. If XCM enabled, vote is relayed cross-chain.
12. `totalAIVotes` increments.
13. Events emitted: `AIVoteExecuted`, `VoteCast`, `VoteRelayedViaXCM`.

**Alice never had to open the app.** Her governance identity voted for her, according to her values, and the vote was relayed to the Relay Chain.

---

## 8. Updating Governance Identity

**Actor:** Existing identity holder who wants to adjust their preferences after learning more about Polkadot governance.

**Scenario:**

1. User navigates to `/identity`.
2. The page shows **"Your Governance Identity"** with an "Identity Active" badge.
3. Their existing slider values are loaded from on-chain data.
4. The radar chart reflects their current profile.
5. They adjust Technical Progressive from 40 to 80 (they now favor upgrades more).
6. They switch to the **Settings** tab and lower their Risk Tolerance from 60 to 30.
7. They click **"Update Identity"**.
8. Transaction calls `IdentityVault.updatePreferences()` with new axis weights.
9. After confirmation, all future `getPersonalizedInsight()` calls reflect the new weights.

**Effect:** Their recommendations on future (and existing) proposals immediately change to reflect their updated philosophy.

---

## 9. Per-Track Delegation

**Actor:** User who trusts AI for small treasury tips but wants manual control over big spending proposals.

**Scenario:**

1. User calls `IdentityVault.configureTrackDelegation()` for specific tracks:
   - **Small Tipper** (track 30): enabled, maxAmount 10 DOT, maxConviction 1
   - **Big Spender** (track 34): **disabled** — AI cannot auto-vote here
   - **Medium Spender** (track 33): enabled, maxAmount 50 DOT, maxConviction 3
2. Or uses `batchConfigureTracks()` to set all at once.

**Effect:**
- AI can auto-vote small tips up to 10 DOT with 1x conviction.
- AI can auto-vote medium spends up to 50 DOT with 3x conviction.
- AI **cannot** auto-vote on Big Spender — user must manually review and vote.
- The `canAutoVote()` function enforces these limits before any AI vote execution.

---

## 10. Re-Analysis on Community Changes

**Actor:** The AI backend detecting that community sentiment shifted on a proposal.

**Scenario:**

1. Referendum #1772 was initially analyzed 2 hours ago: Aye, 72% confidence, risk 40.
2. Since then:
   - 5 new comments posted, 3 expressing concerns about the team's delivery track record
   - Nay votes surged: tally swung from 80% Aye to 55% Aye
   - A prominent validator posted a detailed opposition argument
3. Backend's polling cycle runs (every 5 minutes).
4. `detectChanges(proposal)` compares current data against stored snapshot:
   - Comment count changed: 12 → 17
   - Tally swing > 10%: 80% → 55%
   - Returns: `{ changed: true, reasons: ["Comment count changed: 12 → 17", "Tally Aye swing: 80% → 55%"] }`
5. `cooldownExpired(1772)` checks: last re-analysis was 2 hours ago, cooldown is 30 minutes → yes, proceed.
6. Backend re-runs GPT analysis with updated data.
7. New result: Abstain (changed from Aye!), 65% confidence, risk 55.
8. Backend checks delta: recommendation changed (Aye → Abstain) → material change.
9. Calls `AIOracle.updateAnalysis()` — version increments to 2.
10. Frontend immediately reflects new analysis when page is refreshed.
11. Log output: *"RECOMMENDATION CHANGED: AYE → ABSTAIN"*

---

## 11. Two Users, Same Proposal, Different Votes

**Actor:** Alice (growth-focused) and Bob (conservative) both viewing Referendum #1836.

**Scenario:**

This is the flagship demo scenario for GovMind's personalization.

| Step | Alice | Bob |
|------|-------|-----|
| 1. Open `/proposals/1836` | Same page | Same page |
| 2. See AI Base Recommendation | Aye, 78% confidence | Aye, 78% confidence |
| 3. See Personalized Recommendation | **Aye, 87% confidence** | **Nay, 64% confidence** |
| 4. See Alignment Score | 85/100 — "Aligned" | 0/100 — "Opposed" |
| 5. See Personalization Banner | *(no change, both say Aye)* | **"Your identity changed the rec from Aye to Nay"** |
| 6. See Risk Assessment | 45/100 — Medium Risk | 45/100 — Medium Risk |
| 7. Deep analysis panels | Same treasury, sentiment, etc. | Same treasury, sentiment, etc. |
| 8. Voting decision | Clicks "Vote Aye" with conviction 3 | Clicks "Vote Nay" with conviction 1 |
| 9. XCM relay | Vote relayed as Aye to Relay Chain | Vote relayed as Nay to Relay Chain |

**The data is the same. The AI analysis is the same. But the governance identities produce opposite recommendations.**

---

## 12. XCM Cross-Chain Vote Execution

**Actor:** GovMindCore smart contract relaying a vote to the Polkadot Relay Chain.

**Scenario (technical deep dive):**

1. User calls `GovMindCore.vote(1836, true, 3, 50_000_000_000_000)` (50 DOT in plancks).
2. GovMindCore records the vote internally, then calls:
   ```
   xcmRelay.relayVote(userAddress, 1836, true, 3, 50_000_000_000_000)
   ```
3. **SCALE Encoding** (`_encodeConvictionVote`):
   - Pallet index: `0x14` (ConvictionVoting = 20)
   - Call index: `0x00` (vote)
   - Poll index 1836: compact u32 → `0x29 0x1C` (two-byte mode: 1836 << 2 | 0x01)
   - AccountVote::Standard variant: `0x00`
   - Vote byte: aye(true) + conviction(3) → `0x80 | 0x03` = `0x83`
   - Balance: 50_000_000_000_000 as u128 LE (16 bytes)

4. **XCM Message** (`_buildXcmMessage`):
   ```
   0x04                              // VersionedXcm::V4
   0x14                              // Vec length = 5 (compact)
   [WithdrawAsset: 0.1 DOT]          // Pay for execution
   [BuyExecution: Unlimited]          // No weight limit
   [Transact: SovereignAccount, 500ms refTime, 20KB proofSize, encoded_call]
   [RefundSurplus]                    // Get unused fees back
   [DepositAsset: All → Here]         // Return leftovers
   ```

5. **Destination** (`_encodeRelayChainDestination`):
   ```
   0x04 0x01 0x00   // V4, parents=1 (up to relay), interior=Here
   ```

6. **Send**: `XCM_PRECOMPILE.send(destination, message)` at address `0x0A0000`.

7. The Relay Chain receives the XCM, withdraws DOT from Hub's sovereign account, executes `convictionVoting.vote(1836, Standard { vote: 0x83, balance: 50_000_000_000_000 })`, refunds surplus, deposits remainder.

8. **Verification**: Before sending, anyone can call `previewEncodedCall()` or `previewXcmMessage()` to inspect the exact bytes that would be sent.

---

## 13. Viewing Vote History

**Actor:** User who wants to review their past governance activity.

**Scenario:**

1. User's vote history is stored on-chain in `userVoteHistory[address]`.
2. For each referendum they voted on, a `VoteRecord` stores:
   - Referendum index, aye/nay, conviction, amount
   - Whether it was an AI vote and the AI's confidence at the time
   - IPFS hash of reasoning (for AI votes)
   - Timestamp
3. On the proposal detail page, if the user has already voted, they see: *"You have voted on this proposal"* with a green checkmark instead of the voting panel.
4. The `GovMindStatsInline` component shows per-referendum stats: total aye/nay amounts, voter count, AI voter count.

---

## 14. Admin: Oracle Management

**Actor:** Contract owner managing the AI backend's authority.

**Scenario:**

1. **Authorize a new oracle:** `AIOracle.authorizeOracle(backendWalletAddress)` — allows a new backend to publish analyses.
2. **Revoke an oracle:** `AIOracle.revokeOracle(oldAddress)` — removes publishing rights.
3. **Update request fee:** `AIOracle.setRequestFee(newFee)` — adjusts anti-spam fee for analysis requests.
4. **Withdraw fees:** `AIOracle.withdrawFees(recipient)` — collects accumulated request fees.

**GovMindCore admin:**
5. **Update contract references:** `GovMindCore.updateContracts(newVault, newOracle)` — point to upgraded contracts.
6. **Set XCM relay:** `GovMindCore.setXCMRelay(relayAddress)` — connect/upgrade XCM relay.
7. **Toggle XCM:** `GovMindCore.toggleXCMRelay(true/false)` — enable/disable cross-chain voting.

---

## 15. Admin: XCM Relay Configuration

**Actor:** Contract owner fine-tuning XCM parameters.

**Scenario:**

1. **Enable/disable relay:** `XCMGovernanceRelay.setRelayEnabled(true)` — emergency kill switch.
2. **Authorize callers:** `xcmRelay.authorizeCaller(govMindCoreAddress)` — only GovMindCore can trigger relays.
3. **Revoke callers:** `xcmRelay.revokeCaller(oldAddress)`.
4. **Update weight:** `xcmRelay.updateWeight(600_000_000, 25_000)` — adjust Transact execution limits (refTime, proofSize).
5. **Update fee:** `xcmRelay.updateFee(2_000_000_000)` — increase XCM execution fee (0.2 DOT).

**Safety:** If XCM relay encounters issues, the admin can instantly disable it via `setRelayEnabled(false)`. Votes continue to be recorded internally on Hub EVM — they just won't be relayed cross-chain until re-enabled.

---

## Summary: The GovMind Flow

```
                    ┌─────────────┐
                    │  New User   │
                    └──────┬──────┘
                           │
                    Connect Wallet
                           │
                    ┌──────▼──────┐
                    │   Create    │
                    │  Identity   │──── 6 preference axes
                    └──────┬──────┘     risk tolerance
                           │            confidence threshold
                    ┌──────▼──────┐
                    │   Browse    │
                    │  Proposals  │──── AI-analyzed cards
                    └──────┬──────┘     with personalized alignment
                           │
                    ┌──────▼──────┐
                    │  Deep Dive  │
                    │  Analysis   │──── Treasury, risk, sentiment,
                    └──────┬──────┘     momentum, history, S&W
                           │
                ┌──────────┼──────────┐
                │          │          │
         ┌──────▼───┐ ┌───▼───┐ ┌───▼──────┐
         │  Manual  │ │  AI   │ │  Skip /  │
         │   Vote   │ │ Auto  │ │  Abstain │
         └──────┬───┘ └───┬───┘ └──────────┘
                │         │
                └────┬────┘
                     │
              ┌──────▼──────┐
              │  Record on  │
              │  Hub EVM    │──── VoteRecord stored
              └──────┬──────┘     Referendum stats updated
                     │
              ┌──────▼──────┐
              │  XCM Relay  │
              │  to Relay   │──── SCALE encode vote
              │   Chain     │     Build XCM V4 message
              └──────┬──────┘     Send via precompile
                     │
              ┌──────▼──────┐
              │ Relay Chain │
              │  Executes   │──── convictionVoting.vote()
              │    Vote     │
              └─────────────┘
```

---

*GovMind — AI thinks. You choose. XCM delivers.*
