import http from "http";
import { fetchReferendum, fetchHistoricalPrecedents } from "./subsquare.js";
import { analyzeProposal } from "./analyzer.js";
import {
  publishAnalysis,
  hasExistingAnalysis,
} from "./contracts.js";

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

  // Check if already analyzed on-chain
  try {
    const exists = await hasExistingAnalysis(id);
    if (exists) {
      const cached = analysisStore.get(id);
      if (cached) {
        return json(res, { ...cached, alreadyExisted: true });
      }
      return json(res, { error: "Already analyzed on-chain", referendumIndex: id, alreadyExisted: true }, 200);
    }
  } catch (err) {
    console.warn(`  Could not check on-chain status: ${err.message}`);
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

    // 2. Fetch historical precedents
    console.log("  Fetching historical precedents...");
    const historicalData = await fetchHistoricalPrecedents(proposal, 3);

    // 3. Run GPT analysis
    console.log("  Running GPT analysis...");
    const analysis = await analyzeProposal(proposal, historicalData);
    console.log(`  Result: ${analysis.recommendation === 1 ? "AYE" : analysis.recommendation === -1 ? "NAY" : "ABSTAIN"} | Risk: ${analysis.riskScore}/100`);

    // 4. Store locally
    storeAnalysis(id, analysis);
    storeProposalMeta(id, proposal);

    // 5. Publish on-chain
    console.log("  Publishing to AIOracle on-chain...");
    const receipt = await publishAnalysis(id, proposal.track, analysis);

    if (receipt) {
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

      // GET /api/analysis/:id
      const analysisMatch = path.match(/^\/api\/analysis\/(\d+)$/);
      if (analysisMatch) {
        const id = Number(analysisMatch[1]);
        const analysis = analysisStore.get(id);
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
    console.log(`  GET  /api/proposal/:id     — Proposal metadata`);
    console.log(`  GET  /api/health           — Health check\n`);
  });

  return server;
}

function json(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}
