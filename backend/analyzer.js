import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are GovMind, an AI governance analyst for Polkadot OpenGov. You analyze referendum proposals and produce structured assessments.

CONTEXT:
- Polkadot treasury currently holds approximately 38 million DOT
- You are evaluating proposals submitted to OpenGov referenda
- Your analysis will be published on-chain, so accuracy matters

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

Respond with ONLY valid JSON. No markdown, no explanation, no code fences.
{
  "riskScore": <0-100, where 0=very safe, 100=very risky>,
  "categoryId": <0-9, matching categories above>,
  "recommendation": <-1 for Nay, 0 for Abstain, 1 for Aye>,
  "confidence": <0-100, how confident you are>,
  "requestedAmountDOT": <number, 0 if not a treasury proposal>,
  "treasuryImpactBps": <basis points impact on 38M DOT treasury, e.g. 230 = 2.3%>,
  "summary": "<2-3 sentence analysis explaining your recommendation>"
}`;

/**
 * Analyze a proposal using OpenAI GPT and return structured analysis
 */
export async function analyzeProposal(proposal) {
  const userPrompt = `Analyze this Polkadot OpenGov referendum:

Referendum #: ${proposal.referendumIndex}
Track: ${proposal.trackName} (ID: ${proposal.track})
Title: ${proposal.title}
Proposer: ${proposal.proposer}
Status: ${proposal.state}

Proposal Content:
${proposal.content}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = response.choices[0].message.content.trim();
    const analysis = JSON.parse(raw);
    return validateAnalysis(analysis);
  } catch (err) {
    console.warn("AI analysis failed, retrying once:", err.message);

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.1,
        max_tokens: 500,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      });

      const raw = response.choices[0].message.content.trim();
      const analysis = JSON.parse(raw);
      return validateAnalysis(analysis);
    } catch (retryErr) {
      console.error("AI analysis failed after retry:", retryErr.message);
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
