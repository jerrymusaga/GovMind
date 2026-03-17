import OpenAI from "openai";
import { fetchExternalContext } from "./subsquare.js";

let _openai;
function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const POLKADOT_TREASURY_DOT = 38_000_000;

const DEEP_SYSTEM_PROMPT = `You are GovMind, an expert AI governance analyst for Polkadot OpenGov. You produce institutional-grade analysis — not generic summaries. Every claim must be backed by data from the enriched input you receive.

CONTEXT:
- Polkadot treasury: ~38 million DOT (~$190M at $5/DOT)
- Polkadot has 1.4B total supply, ~55% staked
- You have access to REAL on-chain voting data, community comments, and spending breakdowns from Subsquare
- Your analysis is published on-chain, so precision matters

PROPOSAL CATEGORIES (pick exactly one by ID):
0=TREASURY_SPEND, 1=TREASURY_TIP, 2=TECHNICAL_UPGRADE, 3=GOVERNANCE_CHANGE,
4=STAKING_OPERATION, 5=BRIDGE_OPERATION, 6=COMMUNITY_INITIATIVE, 7=INFRASTRUCTURE,
8=BOUNTY, 9=OTHER

Respond with ONLY valid JSON matching this EXACT structure. No markdown, no explanation, no code fences.
{
  "riskScore": <0-100>,
  "categoryId": <0-9>,
  "recommendation": <-1 for Nay, 0 for Abstain, 1 for Aye>,
  "confidence": <0-100>,
  "requestedAmountDOT": <number>,
  "treasuryImpactBps": <basis points on 38M treasury>,
  "summary": "<1 sentence verdict>",
  "deepAnalysis": {
    "verdict": "<3-4 sentence detailed reasoning chain explaining WHY you reached this recommendation, citing specific data points>",
    "treasuryBreakdown": {
      "requestedDOT": <number>,
      "requestedUSD": <estimated USD value at $5/DOT>,
      "treasuryPercent": <% of 38M treasury>,
      "costPerMonth": <DOT per month if duration known, else 0>,
      "durationMonths": <estimated duration, 0 if unknown>,
      "valueAssessment": "<1 sentence: is the cost justified for deliverables?>"
    },
    "riskFactors": [
      {
        "factor": "<specific risk name>",
        "severity": "<low|medium|high|critical>",
        "detail": "<1-2 sentences explaining this specific risk with evidence>"
      }
    ],
    "communitySentiment": {
      "overallSignal": "<bullish|bearish|mixed|silent>",
      "weightedScore": <-100 to 100, weighted by comment quality/engagement>,
      "keyTakeaway": "<1 sentence summarizing what the community thinks and why it matters>",
      "notableConcerns": ["<specific concern from comments>"],
      "notableEndorsements": ["<specific endorsement from comments>"]
    },
    "votingMomentum": {
      "trend": "<strong_aye|leaning_aye|contested|leaning_nay|strong_nay|early>",
      "ayePercent": <number>,
      "totalStakeDOT": <total DOT committed to votes>,
      "conviction": "<1 sentence on what the voting pattern suggests about community confidence>"
    },
    "historicalContext": {
      "hasHistoricalData": <true|false>,
      "similarProposals": "<description of similar past proposals if provided, or 'No historical data available'>",
      "proposerTrackRecord": "<assessment of proposer based on available data>",
      "precedentAnalysis": "<how this compares to similar past proposals in terms of amount, outcome, delivery>"
    },
    "strengthsAndWeaknesses": {
      "strengths": ["<specific strength with evidence>"],
      "weaknesses": ["<specific weakness with evidence>"]
    }
  }
}`;

/**
 * Build an enriched prompt with all Subsquare data + historical precedents
 */
function buildEnrichedPrompt(proposal, historicalData) {
  let prompt = `Analyze this Polkadot OpenGov referendum with the following REAL on-chain and community data:

=== PROPOSAL INFO ===
Referendum #: ${proposal.referendumIndex}
Track: ${proposal.trackName} (ID: ${proposal.track})
Origin: ${proposal.origin || proposal.trackName}
Title: ${proposal.title}
Proposer: ${proposal.proposer}
Status: ${proposal.state}
Data Source: ${proposal.dataSource || "subsquare"}

=== PROPOSAL CONTENT ===
${proposal.content}`;

  // External context from forum or GitHub
  if (proposal.externalContext) {
    prompt += `

=== EXTERNAL CONTEXT (from linked forum/GitHub sources) ===
${proposal.externalContext.slice(0, 3000)}`;
  }

  // On-chain voting data
  if (proposal.tally && (proposal.tally.ayes > 0 || proposal.tally.nays > 0)) {
    const totalStake = proposal.tally.ayes + proposal.tally.nays;
    prompt += `

=== ON-CHAIN VOTING (Live Tally from Polkadot) ===
Ayes: ${proposal.tally.ayes.toLocaleString()} DOT (${proposal.tally.ayePercent}%)
Nays: ${proposal.tally.nays.toLocaleString()} DOT (${100 - proposal.tally.ayePercent}%)
Support: ${proposal.tally.support.toLocaleString()} DOT
Total Stake Committed: ${totalStake.toLocaleString()} DOT
Current Direction: ${proposal.tally.ayePercent >= 60 ? "Strong Aye" : proposal.tally.ayePercent >= 50 ? "Leaning Aye" : proposal.tally.ayePercent >= 40 ? "Contested" : "Leaning Nay"} at ${proposal.tally.ayePercent}%`;
  }

  // Treasury spending data from proposed_call
  if (proposal.spendingInfo && proposal.spendingInfo.totalAmountDOT > 0) {
    const pct = ((proposal.spendingInfo.totalAmountDOT / POLKADOT_TREASURY_DOT) * 100).toFixed(3);
    const usd = (proposal.spendingInfo.totalAmountDOT * 5).toLocaleString();
    prompt += `

=== TREASURY REQUEST (Extracted from On-Chain Call Data) ===
Total Amount: ${proposal.spendingInfo.totalAmountDOT.toLocaleString()} DOT (~$${usd} USD at $5/DOT)
Payment Tranches: ${proposal.spendingInfo.paymentCount}
Beneficiaries: ${proposal.spendingInfo.beneficiaries.length > 0 ? proposal.spendingInfo.beneficiaries.join(", ") : "Not specified"}
Treasury Impact: ${pct}% of ~38M DOT treasury
NOTE: Calculate cost-per-month if the proposal mentions a duration.`;
  }

  // Community discussion with engagement weighting
  if (proposal.commentAnalysis && proposal.commentAnalysis.total > 0) {
    const ca = proposal.commentAnalysis;
    prompt += `

=== COMMUNITY DISCUSSION (${ca.total} comments from Subsquare) ===
Sentiment: ${ca.sentiments.positive} supportive | ${ca.sentiments.negative} opposed | ${ca.sentiments.neutral} neutral
Engagement Ratio: ${ca.total > 10 ? "High" : ca.total > 3 ? "Moderate" : "Low"} (${ca.total} comments)
IMPORTANT: Weight expert/known-contributor comments more heavily than anonymous ones.`;

    if (ca.topConcerns.length > 0) {
      prompt += `\n\nVERBATIM CONCERNS (from real community members):`;
      for (const concern of ca.topConcerns) {
        prompt += `\n- ${concern.author}: "${concern.text}"`;
      }
    }

    if (ca.endorsements.length > 0) {
      prompt += `\n\nVERBATIM ENDORSEMENTS:`;
      for (const endorsement of ca.endorsements) {
        prompt += `\n- ${endorsement.author}${endorsement.isExpert ? " [EXPERT/COUNCIL]" : ""}: "${endorsement.text}"`;
      }
    }
  }

  // Reactions
  if (proposal.reactions && (proposal.reactions.thumbsUp > 0 || proposal.reactions.thumbsDown > 0)) {
    const total = proposal.reactions.thumbsUp + proposal.reactions.thumbsDown || 1;
    const approval = Math.round((proposal.reactions.thumbsUp / total) * 100);
    prompt += `

=== COMMUNITY REACTIONS ===
Thumbs Up: ${proposal.reactions.thumbsUp} | Thumbs Down: ${proposal.reactions.thumbsDown}
Quick Sentiment: ${approval}% approval rate`;
  }

  // Status timeline
  if (proposal.statusTimeline && proposal.statusTimeline.length > 0) {
    prompt += `

=== GOVERNANCE LIFECYCLE ===`;
    for (const entry of proposal.statusTimeline) {
      const date = entry.timestamp
        ? new Date(entry.timestamp).toLocaleDateString()
        : `Block #${entry.block}`;
      prompt += `\n${date}: ${entry.status}`;
    }
    // Calculate time in current status
    const latest = proposal.statusTimeline[proposal.statusTimeline.length - 1];
    if (latest?.timestamp) {
      const daysInStatus = Math.round((Date.now() - new Date(latest.timestamp).getTime()) / 86400000);
      prompt += `\nTime in current status: ${daysInStatus} days`;
    }
  }

  // Historical precedent data
  if (historicalData && historicalData.length > 0) {
    prompt += `

=== HISTORICAL PRECEDENT (Similar Past Proposals) ===
Use these to assess whether this proposal's ask is reasonable compared to precedent:`;
    for (const h of historicalData) {
      prompt += `\n
Referendum #${h.referendumIndex}: "${h.title}"
  Track: ${h.trackName} | Status: ${h.state} | Proposer: ${h.proposer}${h.spendingInfo?.totalAmountDOT > 0 ? `\n  Amount: ${h.spendingInfo.totalAmountDOT.toLocaleString()} DOT` : ""}${h.tally?.ayePercent > 0 ? `\n  Final Vote: ${h.tally.ayePercent}% Aye` : ""}${h.commentsCount > 0 ? `\n  Community Engagement: ${h.commentsCount} comments` : ""}`;
    }
  } else {
    prompt += `

=== HISTORICAL PRECEDENT ===
No historical data available for comparison. Note this as a limitation in your analysis.`;
  }

  prompt += `

=== ANALYSIS INSTRUCTIONS ===
1. Every claim in your analysis MUST reference specific data from above
2. For treasury proposals: calculate cost-per-month, compare to similar proposals
3. Weight expert comments and high-stake voters more heavily
4. Identify SPECIFIC risk factors, not generic ones
5. If community is raising concerns, explain exactly what they are
6. Your verdict must form a logical chain: data → reasoning → recommendation`;

  return prompt;
}

/**
 * Analyze a proposal using OpenAI GPT with enriched Subsquare data + historical context
 * Returns both on-chain params AND rich deep analysis for the API
 */
export async function analyzeProposal(proposal, historicalData = []) {
  // Fetch external context (forum posts, GitHub releases) linked in proposal
  try {
    const externalContext = await fetchExternalContext(proposal.content, proposal.title);
    if (externalContext) {
      proposal = { ...proposal, externalContext };
    }
  } catch {}

  const userPrompt = buildEnrichedPrompt(proposal, historicalData);

  // Log enrichment stats
  const enrichmentStats = [];
  if (proposal.tally?.ayes > 0 || proposal.tally?.nays > 0) enrichmentStats.push("tally");
  if (proposal.commentAnalysis?.total > 0) enrichmentStats.push(`${proposal.commentAnalysis.total} comments`);
  if (proposal.spendingInfo?.totalAmountDOT > 0) enrichmentStats.push("spending");
  if (proposal.statusTimeline?.length > 0) enrichmentStats.push("timeline");
  if (historicalData.length > 0) enrichmentStats.push(`${historicalData.length} precedents`);
  if (proposal.externalContext) enrichmentStats.push("forum/github context");
  if (enrichmentStats.length > 0) {
    console.log(`  Enriched with: ${enrichmentStats.join(", ")}`);
  }

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 2000,
      messages: [
        { role: "system", content: DEEP_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = response.choices[0].message.content.trim();
    const analysis = JSON.parse(raw);
    return validateDeepAnalysis(analysis, proposal);
  } catch (err) {
    console.warn("  AI analysis failed, retrying with lower temp:", err.message);

    try {
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.1,
        max_tokens: 2000,
        messages: [
          { role: "system", content: DEEP_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      });

      const raw = response.choices[0].message.content.trim();
      const analysis = JSON.parse(raw);
      return validateDeepAnalysis(analysis, proposal);
    } catch (retryErr) {
      console.error("  AI analysis failed after retry:", retryErr.message);
      return fallbackAnalysis(proposal);
    }
  }
}

function validateDeepAnalysis(analysis, proposal) {
  const base = {
    riskScore: clamp(analysis.riskScore ?? 50, 0, 100),
    categoryId: clamp(analysis.categoryId ?? 9, 0, 9),
    recommendation: clamp(analysis.recommendation ?? 0, -1, 1),
    confidence: clamp(analysis.confidence ?? 50, 0, 100),
    requestedAmountDOT: Math.max(0, Number(analysis.requestedAmountDOT) || 0),
    treasuryImpactBps: Math.max(0, Number(analysis.treasuryImpactBps) || 0),
    summary: analysis.summary || "No summary provided.",
  };

  // Validate and normalize deep analysis
  const deep = analysis.deepAnalysis || {};

  base.deepAnalysis = {
    verdict: deep.verdict || base.summary,

    treasuryBreakdown: {
      requestedDOT: deep.treasuryBreakdown?.requestedDOT || base.requestedAmountDOT,
      requestedUSD: deep.treasuryBreakdown?.requestedUSD || base.requestedAmountDOT * 5,
      treasuryPercent: deep.treasuryBreakdown?.treasuryPercent || Number(((base.requestedAmountDOT / POLKADOT_TREASURY_DOT) * 100).toFixed(3)),
      costPerMonth: deep.treasuryBreakdown?.costPerMonth || 0,
      durationMonths: deep.treasuryBreakdown?.durationMonths || 0,
      valueAssessment: deep.treasuryBreakdown?.valueAssessment || "No value assessment available.",
    },

    riskFactors: Array.isArray(deep.riskFactors)
      ? deep.riskFactors.map((r) => ({
          factor: r.factor || "Unknown risk",
          severity: ["low", "medium", "high", "critical"].includes(r.severity) ? r.severity : "medium",
          detail: r.detail || "",
        })).slice(0, 6)
      : [{ factor: "Insufficient data", severity: "medium", detail: "Unable to assess specific risks." }],

    communitySentiment: {
      overallSignal: ["bullish", "bearish", "mixed", "silent"].includes(deep.communitySentiment?.overallSignal)
        ? deep.communitySentiment.overallSignal
        : proposal.commentAnalysis?.total > 0 ? "mixed" : "silent",
      weightedScore: clamp(deep.communitySentiment?.weightedScore ?? 0, -100, 100),
      keyTakeaway: deep.communitySentiment?.keyTakeaway || "No community discussion available.",
      notableConcerns: Array.isArray(deep.communitySentiment?.notableConcerns)
        ? deep.communitySentiment.notableConcerns.slice(0, 4)
        : [],
      notableEndorsements: Array.isArray(deep.communitySentiment?.notableEndorsements)
        ? deep.communitySentiment.notableEndorsements.slice(0, 4)
        : [],
    },

    votingMomentum: {
      trend: ["strong_aye", "leaning_aye", "contested", "leaning_nay", "strong_nay", "early"].includes(deep.votingMomentum?.trend)
        ? deep.votingMomentum.trend
        : "early",
      ayePercent: deep.votingMomentum?.ayePercent ?? (proposal.tally?.ayePercent || 0),
      totalStakeDOT: deep.votingMomentum?.totalStakeDOT ?? ((proposal.tally?.ayes || 0) + (proposal.tally?.nays || 0)),
      conviction: deep.votingMomentum?.conviction || "Insufficient voting data to assess conviction.",
    },

    historicalContext: {
      hasHistoricalData: deep.historicalContext?.hasHistoricalData ?? false,
      similarProposals: deep.historicalContext?.similarProposals || "No historical data available.",
      proposerTrackRecord: deep.historicalContext?.proposerTrackRecord || "No prior proposals found for this proposer.",
      precedentAnalysis: deep.historicalContext?.precedentAnalysis || "Unable to compare to historical precedent.",
    },

    strengthsAndWeaknesses: {
      strengths: Array.isArray(deep.strengthsAndWeaknesses?.strengths)
        ? deep.strengthsAndWeaknesses.strengths.slice(0, 5)
        : ["Insufficient data to identify strengths."],
      weaknesses: Array.isArray(deep.strengthsAndWeaknesses?.weaknesses)
        ? deep.strengthsAndWeaknesses.weaknesses.slice(0, 5)
        : ["Insufficient data to identify weaknesses."],
    },
  };

  return base;
}

function fallbackAnalysis(proposal) {
  return {
    riskScore: 50,
    categoryId: 9,
    recommendation: 0,
    confidence: 10,
    requestedAmountDOT: proposal.spendingInfo?.totalAmountDOT || 0,
    treasuryImpactBps: 0,
    summary: "Analysis unavailable — defaulting to abstain with low confidence.",
    deepAnalysis: {
      verdict: "AI analysis was unable to complete. Manual review recommended.",
      treasuryBreakdown: {
        requestedDOT: proposal.spendingInfo?.totalAmountDOT || 0,
        requestedUSD: (proposal.spendingInfo?.totalAmountDOT || 0) * 5,
        treasuryPercent: 0,
        costPerMonth: 0,
        durationMonths: 0,
        valueAssessment: "Unable to assess.",
      },
      riskFactors: [{ factor: "Analysis failure", severity: "high", detail: "AI analysis could not complete. Proceed with manual review." }],
      communitySentiment: { overallSignal: "silent", weightedScore: 0, keyTakeaway: "No analysis available.", notableConcerns: [], notableEndorsements: [] },
      votingMomentum: { trend: "early", ayePercent: 0, totalStakeDOT: 0, conviction: "No data." },
      historicalContext: { hasHistoricalData: false, similarProposals: "N/A", proposerTrackRecord: "N/A", precedentAnalysis: "N/A" },
      strengthsAndWeaknesses: { strengths: ["N/A"], weaknesses: ["Analysis unavailable"] },
    },
  };
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, Math.round(Number(val) || 0)));
}
