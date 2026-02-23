import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are GovMind, an AI governance analyst for Polkadot OpenGov. You analyze referendum proposals using on-chain data, community discussion, and voting patterns to produce structured assessments.

CONTEXT:
- Polkadot treasury currently holds approximately 38 million DOT
- You are evaluating proposals submitted to OpenGov referenda
- Your analysis will be published on-chain, so accuracy matters
- You have access to REAL community comments and on-chain voting data from Polkassembly

PROPOSAL CATEGORIES (pick exactly one by ID):
0 = TREASURY_SPEND (direct treasury spending proposals)
1 = TREASURY_TIP (tips/small payments to contributors)
2 = TECHNICAL_UPGRADE (runtime upgrades, protocol changes)
3 = GOVERNANCE_CHANGE (changes to governance parameters)
4 = STAKING_OPERATION (staking/nomination pool changes)
5 = BRIDGE_OPERATION (bridge-related proposals)
6 = COMMUNITY_INITIATIVE (events, education, marketing)
7 = INFRASTRUCTURE (RPC nodes, indexers, tooling)
8 = BOUNTY (bounty proposals)
9 = OTHER (anything that doesn't fit above)

EVALUATION CRITERIA:
1. Budget reasonableness - Is the requested amount proportional to deliverables?
2. Team credibility - Does the proposer seem capable based on available info?
3. Technical feasibility - Are the goals technically achievable?
4. Ecosystem value - Does this benefit the broader Polkadot ecosystem?
5. Risk factors - Vague milestones, no accountability, excessive ask?
6. Community sentiment - What does the community discussion reveal?
7. On-chain voting momentum - How is the vote trending?
8. Historical context - Is this a recurring proposal from a known team?

IMPORTANT: Weight community concerns heavily. If expert commenters or well-known community members raise red flags, increase risk score accordingly.

Respond with ONLY valid JSON. No markdown, no explanation, no code fences.
{
  "riskScore": <0-100, where 0=very safe, 100=very risky>,
  "categoryId": <0-9, matching categories above>,
  "recommendation": <-1 for Nay, 0 for Abstain, 1 for Aye>,
  "confidence": <0-100, how confident you are>,
  "requestedAmountDOT": <number, 0 if not a treasury proposal>,
  "treasuryImpactBps": <basis points impact on 38M DOT treasury, e.g. 230 = 2.3%>,
  "summary": "<2-3 sentence analysis explaining your recommendation, referencing community sentiment and voting data>"
}`;

/**
 * Build an enriched prompt with all Polkassembly data for the AI to analyze
 */
function buildEnrichedPrompt(proposal) {
  let prompt = `Analyze this Polkadot OpenGov referendum with the following enriched data:

=== PROPOSAL INFO ===
Referendum #: ${proposal.referendumIndex}
Track: ${proposal.trackName} (ID: ${proposal.track})
Origin: ${proposal.origin || proposal.trackName}
Title: ${proposal.title}
Proposer: ${proposal.proposer}
Status: ${proposal.state}
Data Source: ${proposal.dataSource || "polkassembly"}

=== PROPOSAL CONTENT ===
${proposal.content}`;

  // Add on-chain voting data
  if (proposal.tally && (proposal.tally.ayes > 0 || proposal.tally.nays > 0)) {
    prompt += `

=== ON-CHAIN VOTING (Live Tally) ===
Ayes: ${proposal.tally.ayes.toLocaleString()} DOT (${proposal.tally.ayePercent}%)
Nays: ${proposal.tally.nays.toLocaleString()} DOT (${100 - proposal.tally.ayePercent}%)
Support: ${proposal.tally.support.toLocaleString()} DOT
Verdict so far: ${proposal.tally.ayePercent >= 50 ? "Trending Aye" : "Trending Nay"} at ${proposal.tally.ayePercent}%`;
  }

  // Add spending info from proposed_call
  if (proposal.spendingInfo && proposal.spendingInfo.totalAmountDOT > 0) {
    prompt += `

=== TREASURY REQUEST (from on-chain call) ===
Total Amount: ${proposal.spendingInfo.totalAmountDOT.toLocaleString()} DOT
Payment Tranches: ${proposal.spendingInfo.paymentCount}
Beneficiaries: ${proposal.spendingInfo.beneficiaries.length > 0 ? proposal.spendingInfo.beneficiaries.join(", ") : "Not specified"}
Treasury Impact: ~${((proposal.spendingInfo.totalAmountDOT / 38_000_000) * 100).toFixed(3)}% of treasury`;
  }

  // Add community discussion
  if (proposal.commentAnalysis && proposal.commentAnalysis.total > 0) {
    const ca = proposal.commentAnalysis;
    prompt += `

=== COMMUNITY DISCUSSION (${ca.total} comments from Polkassembly) ===
Sentiment Breakdown: ${ca.sentiments.positive} supportive, ${ca.sentiments.negative} opposed, ${ca.sentiments.neutral} neutral`;

    if (ca.topConcerns.length > 0) {
      prompt += `\n\nKey Concerns Raised:`;
      for (const concern of ca.topConcerns) {
        prompt += `\n- ${concern.author}: "${concern.text}"`;
      }
    }

    if (ca.endorsements.length > 0) {
      prompt += `\n\nNotable Endorsements:`;
      for (const endorsement of ca.endorsements) {
        prompt += `\n- ${endorsement.author}${endorsement.isExpert ? " [Expert]" : ""}: "${endorsement.text}"`;
      }
    }
  }

  // Add reactions
  if (proposal.reactions && (proposal.reactions.thumbsUp > 0 || proposal.reactions.thumbsDown > 0)) {
    prompt += `

=== COMMUNITY REACTIONS ===
👍 ${proposal.reactions.thumbsUp} | 👎 ${proposal.reactions.thumbsDown}`;
  }

  // Add status timeline
  if (proposal.statusTimeline && proposal.statusTimeline.length > 0) {
    prompt += `

=== STATUS TIMELINE ===`;
    for (const entry of proposal.statusTimeline) {
      const date = entry.timestamp
        ? new Date(entry.timestamp).toLocaleDateString()
        : `Block #${entry.block}`;
      prompt += `\n${date}: ${entry.status}`;
    }
  }

  return prompt;
}

/**
 * Analyze a proposal using OpenAI GPT with enriched Polkassembly data
 */
export async function analyzeProposal(proposal) {
  const userPrompt = buildEnrichedPrompt(proposal);

  // Log enrichment stats
  const enrichmentStats = [];
  if (proposal.tally?.ayes > 0 || proposal.tally?.nays > 0) enrichmentStats.push("tally");
  if (proposal.commentAnalysis?.total > 0) enrichmentStats.push(`${proposal.commentAnalysis.total} comments`);
  if (proposal.spendingInfo?.totalAmountDOT > 0) enrichmentStats.push("spending data");
  if (proposal.statusTimeline?.length > 0) enrichmentStats.push("timeline");
  if (enrichmentStats.length > 0) {
    console.log(`  Enriched with: ${enrichmentStats.join(", ")}`);
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 600,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = response.choices[0].message.content.trim();
    const analysis = JSON.parse(raw);
    return validateAnalysis(analysis);
  } catch (err) {
    console.warn("  AI analysis failed, retrying once:", err.message);

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.1,
        max_tokens: 600,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      });

      const raw = response.choices[0].message.content.trim();
      const analysis = JSON.parse(raw);
      return validateAnalysis(analysis);
    } catch (retryErr) {
      console.error("  AI analysis failed after retry:", retryErr.message);
      return {
        riskScore: 50,
        categoryId: 9,
        recommendation: 0,
        confidence: 10,
        requestedAmountDOT: 0,
        treasuryImpactBps: 0,
        summary: "Analysis unavailable — defaulting to abstain with low confidence.",
      };
    }
  }
}

function validateAnalysis(analysis) {
  return {
    riskScore: clamp(analysis.riskScore ?? 50, 0, 100),
    categoryId: clamp(analysis.categoryId ?? 9, 0, 9),
    recommendation: clamp(analysis.recommendation ?? 0, -1, 1),
    confidence: clamp(analysis.confidence ?? 50, 0, 100),
    requestedAmountDOT: Math.max(0, Number(analysis.requestedAmountDOT) || 0),
    treasuryImpactBps: Math.max(0, Number(analysis.treasuryImpactBps) || 0),
    summary: analysis.summary || "No summary provided.",
  };
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, Math.round(Number(val) || 0)));
}
