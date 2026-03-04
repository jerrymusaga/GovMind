import http from "http";
import OpenAI from "openai";
import { fetchReferendum, fetchHistoricalPrecedents } from "./subsquare.js";
import { analyzeProposal } from "./analyzer.js";
import {
  publishAnalysis,
  updateOnChainAnalysis,
  hasExistingAnalysis,
  getOnChainAnalysis,
} from "./contracts.js";
import { detectChanges, saveSnapshot, cooldownExpired } from "./detector.js";

let _chatOpenAI;
function getChatOpenAI() {
  if (!_chatOpenAI) {
    _chatOpenAI = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _chatOpenAI;
}

/**
 * GovMind API Server
 *
 * Serves rich deep analysis data to the frontend.
 * On-chain we store compact params (risk, recommendation, confidence).
 * Here we serve the full analysis: treasury breakdown, risk factors,
 * community sentiment, voting momentum, historical context, and more.
 *
 * Endpoints:
 *   GET  /api/analysis/:id      — Full deep analysis for a referendum
 *   GET  /api/analyses           — All stored analyses (summary view)
 *   GET  /api/proposal/:id       — Proposal metadata from Polkassembly
 *   POST /api/analyze/:id        — Trigger on-demand AI analysis
 *   GET  /api/health             — Health check
 */

// In-memory stores (persists while backend is running)
const analysisStore = new Map();
const proposalStore = new Map();

// Lock to prevent concurrent analyses of the same referendum
const analysisInProgress = new Set();

/**
 * Store a deep analysis result (called from index.js after GPT analysis)
 */
export function storeAnalysis(referendumIndex, analysis) {
  analysisStore.set(Number(referendumIndex), {
    ...analysis,
    storedAt: Date.now(),
    referendumIndex: Number(referendumIndex),
  });
}

/**
 * Store proposal metadata from Polkassembly (called from index.js)
 */
export function storeProposalMeta(referendumIndex, proposal) {
  proposalStore.set(Number(referendumIndex), {
    referendumIndex: proposal.referendumIndex,
    title: proposal.title,
    track: proposal.track,
    trackName: proposal.trackName,
    state: proposal.state,
    proposer: proposal.proposer,
    tally: proposal.tally,
    commentAnalysis: proposal.commentAnalysis,
    spendingInfo: proposal.spendingInfo,
    reactions: proposal.reactions,
    statusTimeline: proposal.statusTimeline,
    commentsCount: proposal.commentsCount,
    dataSource: proposal.dataSource,
    fetchedAt: Date.now(),
  });
}

/**
 * Handle on-demand analysis request
 */
async function handleAnalyzeRequest(id, res) {
  // Check if already in progress
  if (analysisInProgress.has(id)) {
    return json(res, { error: "Analysis already in progress", referendumIndex: id }, 409);
  }

  analysisInProgress.add(id);
  console.log(`\n[ON-DEMAND] Analyzing referendum #${id}...`);

  try {
    // 1. Fetch proposal from Polkassembly
    console.log(`  Fetching proposal #${id} from Polkassembly...`);
    const proposal = await fetchReferendum(id);
    if (!proposal) {
      return json(res, { error: "Proposal not found on Polkassembly" }, 404);
    }

    // 2. Check if analysis already exists on-chain
    let exists = false;
    try {
      exists = await hasExistingAnalysis(id);
    } catch (err) {
      console.warn(`  Could not check on-chain status: ${err.message}`);
    }

    if (exists) {
      // Check if proposal has materially changed since last analysis
      const { changed, reasons } = detectChanges(proposal);

      if (!changed || !cooldownExpired(id)) {
        // No changes (or cooldown active) — return existing analysis
        const cached = analysisStore.get(id);
        if (cached) {
          return json(res, { ...cached, alreadyExisted: true });
        }
        return json(res, {
          referendumIndex: id,
          alreadyExisted: true,
          message: "Analysis already exists on-chain with no material changes detected",
        });
      }

      // Material changes detected — re-analyze
      console.log(`  [CHANGE DETECTED] Re-analyzing...`);
      for (const reason of reasons) {
        console.log(`    -> ${reason}`);
      }

      const historicalData = await fetchHistoricalPrecedents(proposal, 3);
      const analysis = await analyzeProposal(proposal, historicalData);
      logResult(id, analysis);

      storeAnalysis(id, analysis);
      storeProposalMeta(id, proposal);

      // Compare with on-chain to decide if update is worthwhile
      const onChain = await getOnChainAnalysis(id);
      const recChanged = onChain && onChain.recommendation !== analysis.recommendation;
      const riskDelta = onChain ? Math.abs(onChain.riskScore - analysis.riskScore) : 0;
      const confDelta = onChain ? Math.abs(onChain.confidence - analysis.confidence) : 0;

      let publishedOnChain = false;
      if (recChanged || riskDelta >= 10 || confDelta >= 15) {
        console.log(`  Publishing updated analysis to AIOracle...`);
        const receipt = await updateOnChainAnalysis(id, analysis, onChain.version);
        publishedOnChain = !!receipt;
        if (receipt) {
          saveSnapshot(proposal);
          console.log(`  Updated on-chain! TX: ${receipt.hash}`);
        }
      } else {
        console.log(`  Changes detected but analysis delta too small, skipping on-chain update.`);
        saveSnapshot(proposal);
      }

      return json(res, {
        ...analysis,
        referendumIndex: id,
        reanalysis: true,
        changeReasons: reasons,
        proposal: {
          title: proposal.title,
          track: proposal.track,
          trackName: proposal.trackName,
          state: proposal.state,
          proposer: proposal.proposer,
        },
        publishedOnChain,
      });
    }

    // 3. First-time analysis — no on-chain data exists
    console.log("  [NEW] Running first AI analysis...");
    const historicalData = await fetchHistoricalPrecedents(proposal, 3);
    const analysis = await analyzeProposal(proposal, historicalData);
    logResult(id, analysis);

    storeAnalysis(id, analysis);
    storeProposalMeta(id, proposal);

    console.log("  Publishing to AIOracle on-chain...");
    const receipt = await publishAnalysis(id, proposal.track, analysis);

    if (receipt) {
      saveSnapshot(proposal);
      console.log(`  Published! TX: ${receipt.hash}`);
    } else {
      console.log("  Skipped on-chain publish (may already exist)");
    }

    return json(res, {
      ...analysis,
      referendumIndex: id,
      proposal: {
        title: proposal.title,
        track: proposal.track,
        trackName: proposal.trackName,
        state: proposal.state,
        proposer: proposal.proposer,
      },
      publishedOnChain: !!receipt,
    });
  } catch (err) {
    console.error(`  Analysis failed: ${err.message}`);
    return json(res, { error: `Analysis failed: ${err.message}` }, 500);
  } finally {
    analysisInProgress.delete(id);
  }
}

/**
 * Handle AI agent chat request
 */
async function handleChatRequest(id, req, res) {
  // Parse request body
  const body = await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try { resolve(JSON.parse(data)); } catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });

  const { message, history = [], userIdentity } = body;
  if (!message || typeof message !== "string") {
    return json(res, { error: "message is required" }, 400);
  }

  // Build context from stored data
  const analysis = analysisStore.get(id);
  const proposal = proposalStore.get(id);

  // If we don't have proposal data, try fetching it
  let proposalData = proposal;
  if (!proposalData) {
    try {
      proposalData = await fetchReferendum(id);
    } catch {}
  }

  // Build the system prompt with full context
  let systemPrompt = `You are GovMind AI Agent — a conversational governance advisor for Polkadot OpenGov. You help users understand proposals and make informed voting decisions.

RULES:
- Be concise (2-4 sentences per response unless the user asks for detail)
- Reference specific data points from the proposal context below
- If the user has a governance identity, tailor your advice to their preferences
- Be opinionated — give clear Aye/Nay guidance when asked, with reasoning
- Use plain language, avoid jargon unless the user is clearly technical
- If you don't have enough data to answer, say so honestly

=== PROPOSAL CONTEXT ===
Referendum #${id}`;

  if (proposalData) {
    systemPrompt += `
Title: ${proposalData.title || "Unknown"}
Track: ${proposalData.trackName || proposalData.track || "Unknown"}
Status: ${proposalData.state || "Unknown"}
Proposer: ${proposalData.proposer || "Unknown"}`;

    if (proposalData.tally) {
      systemPrompt += `
Voting: ${proposalData.tally.ayePercent || 0}% Aye | Ayes: ${proposalData.tally.ayes?.toLocaleString() || 0} DOT | Nays: ${proposalData.tally.nays?.toLocaleString() || 0} DOT`;
    }
    if (proposalData.spendingInfo?.totalAmountDOT > 0) {
      systemPrompt += `
Treasury Request: ${proposalData.spendingInfo.totalAmountDOT.toLocaleString()} DOT (~$${(proposalData.spendingInfo.totalAmountDOT * 5).toLocaleString()} USD)`;
    }
    if (proposalData.commentsCount) {
      systemPrompt += `
Community: ${proposalData.commentsCount} comments`;
    }
  }

  if (analysis) {
    const rec = analysis.recommendation === 1 ? "Aye" : analysis.recommendation === -1 ? "Nay" : "Abstain";
    systemPrompt += `

=== AI ANALYSIS ===
Recommendation: ${rec} (Confidence: ${analysis.confidence}%)
Risk Score: ${analysis.riskScore}/100
Summary: ${analysis.summary || "N/A"}`;

    if (analysis.deepAnalysis) {
      const deep = analysis.deepAnalysis;
      systemPrompt += `
Verdict: ${deep.verdict || "N/A"}`;
      if (deep.riskFactors?.length > 0) {
        systemPrompt += `
Risk Factors: ${deep.riskFactors.map(r => `${r.factor} (${r.severity})`).join(", ")}`;
      }
      if (deep.communitySentiment) {
        systemPrompt += `
Community Sentiment: ${deep.communitySentiment.overallSignal} (score: ${deep.communitySentiment.weightedScore})`;
      }
      if (deep.treasuryBreakdown?.valueAssessment) {
        systemPrompt += `
Treasury Assessment: ${deep.treasuryBreakdown.valueAssessment}`;
      }
      if (deep.strengthsAndWeaknesses) {
        systemPrompt += `
Strengths: ${deep.strengthsAndWeaknesses.strengths?.join("; ") || "N/A"}
Weaknesses: ${deep.strengthsAndWeaknesses.weaknesses?.join("; ") || "N/A"}`;
      }
    }
  }

  if (userIdentity) {
    const axisLabels = [
      "Treasury Conservative ↔ Growth",
      "Technical Progressive ↔ Conservative",
      "Community ↔ Infrastructure",
    ];
    systemPrompt += `

=== USER GOVERNANCE IDENTITY ===
This user has set their governance preferences. Tailor your advice accordingly:`;
    if (userIdentity.axes) {
      for (let i = 0; i < Math.min(userIdentity.axes.length, 3); i++) {
        systemPrompt += `\n${axisLabels[i]}: ${userIdentity.axes[i]}/100`;
      }
    }
    if (userIdentity.riskTolerance != null) {
      systemPrompt += `\nRisk Tolerance: ${userIdentity.riskTolerance}/100`;
    }
  }

  // Trim history to last 10 messages
  const trimmedHistory = history.slice(-10).map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: String(m.content),
  }));

  try {
    const response = await getChatOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      max_tokens: 500,
      messages: [
        { role: "system", content: systemPrompt },
        ...trimmedHistory,
        { role: "user", content: message },
      ],
    });

    const reply = response.choices[0].message.content.trim();
    return json(res, { reply });
  } catch (err) {
    console.error(`  Chat error: ${err.message}`);
    return json(res, { error: "Chat failed" }, 500);
  }
}

/**
 * Start the HTTP API server (no Express dependency — uses Node http)
 */
export function startApiServer(port = 3001) {
  const server = http.createServer(async (req, res) => {
    // CORS headers for frontend
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://localhost:${port}`);
    const path = url.pathname;

    try {
      // GET /api/health
      if (path === "/api/health") {
        return json(res, {
          status: "ok",
          analyses: analysisStore.size,
          proposals: proposalStore.size,
          inProgress: [...analysisInProgress],
          uptime: process.uptime(),
        });
      }

      // POST /api/analyze/:id — On-demand AI analysis
      const analyzeMatch = path.match(/^\/api\/analyze\/(\d+)$/);
      if (analyzeMatch && req.method === "POST") {
        const id = Number(analyzeMatch[1]);
        return await handleAnalyzeRequest(id, res);
      }

      // POST /api/chat/:id — AI agent chat
      const chatMatch = path.match(/^\/api\/chat\/(\d+)$/);
      if (chatMatch && req.method === "POST") {
        const id = Number(chatMatch[1]);
        return await handleChatRequest(id, req, res);
      }

      // GET /api/analysis/:id
      const analysisMatch = path.match(/^\/api\/analysis\/(\d+)$/);
      if (analysisMatch) {
        const id = Number(analysisMatch[1]);
        let analysis = analysisStore.get(id);

        // If not in memory but exists on-chain, re-generate deep analysis
        if (!analysis) {
          try {
            const exists = await hasExistingAnalysis(id);
            if (exists) {
              console.log(`[CACHE MISS] Regenerating deep analysis for #${id}...`);
              const proposal = await fetchReferendum(id);
              if (proposal) {
                const historicalData = await fetchHistoricalPrecedents(proposal, 3);
                const freshAnalysis = await analyzeProposal(proposal, historicalData);
                storeAnalysis(id, freshAnalysis);
                storeProposalMeta(id, proposal);
                analysis = analysisStore.get(id);
              }
            }
          } catch (err) {
            console.warn(`  Could not regenerate analysis: ${err.message}`);
          }
        }

        if (!analysis) {
          return json(res, { error: "Analysis not found", referendumIndex: id }, 404);
        }
        // Merge with proposal meta if available
        const meta = proposalStore.get(id);
        return json(res, {
          ...analysis,
          proposal: meta || null,
        });
      }

      // GET /api/proposal/:id
      const proposalMatch = path.match(/^\/api\/proposal\/(\d+)$/);
      if (proposalMatch) {
        const id = Number(proposalMatch[1]);
        const meta = proposalStore.get(id);
        if (!meta) {
          return json(res, { error: "Proposal not found", referendumIndex: id }, 404);
        }
        return json(res, meta);
      }

      // GET /api/analyses
      if (path === "/api/analyses") {
        const summaries = [];
        for (const [id, analysis] of analysisStore) {
          const meta = proposalStore.get(id);
          summaries.push({
            referendumIndex: id,
            title: meta?.title || `Referendum #${id}`,
            recommendation: analysis.recommendation,
            riskScore: analysis.riskScore,
            confidence: analysis.confidence,
            categoryId: analysis.categoryId,
            summary: analysis.summary,
            communitySignal: analysis.deepAnalysis?.communitySentiment?.overallSignal || "unknown",
            votingTrend: analysis.deepAnalysis?.votingMomentum?.trend || "unknown",
            storedAt: analysis.storedAt,
          });
        }
        return json(res, { count: summaries.length, analyses: summaries });
      }

      // 404
      json(res, { error: "Not found" }, 404);
    } catch (err) {
      console.error("API error:", err.message);
      json(res, { error: "Internal server error" }, 500);
    }
  });

  server.listen(port, () => {
    console.log(`\nGovMind API server running on http://localhost:${port}`);
    console.log(`  GET  /api/analyses         — All analyses`);
    console.log(`  GET  /api/analysis/:id     — Deep analysis for referendum`);
    console.log(`  POST /api/analyze/:id      — Trigger on-demand analysis`);
    console.log(`  POST /api/chat/:id         — AI agent chat`);
    console.log(`  GET  /api/proposal/:id     — Proposal metadata`);
    console.log(`  GET  /api/health           — Health check\n`);
  });

  return server;
}

function logResult(id, analysis) {
  const rec = analysis.recommendation === 1 ? "AYE" : analysis.recommendation === -1 ? "NAY" : "ABSTAIN";
  console.log(`  Result: ${rec} | Risk: ${analysis.riskScore}/100 | Confidence: ${analysis.confidence}/100`);
}

function json(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}
