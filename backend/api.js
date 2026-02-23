import http from "http";

/**
 * GovMind API Server
 *
 * Serves rich deep analysis data to the frontend.
 * On-chain we store compact params (risk, recommendation, confidence).
 * Here we serve the full analysis: treasury breakdown, risk factors,
 * community sentiment, voting momentum, historical context, and more.
 *
 * Endpoints:
 *   GET /api/analysis/:id      — Full deep analysis for a referendum
 *   GET /api/analyses           — All stored analyses (summary view)
 *   GET /api/proposal/:id       — Proposal metadata from Polkassembly
 *   GET /api/health             — Health check
 */

// In-memory stores (persists while backend is running)
const analysisStore = new Map();
const proposalStore = new Map();

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
 * Start the HTTP API server (no Express dependency — uses Node http)
 */
export function startApiServer(port = 3001) {
  const server = http.createServer((req, res) => {
    // CORS headers for frontend
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
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
          uptime: process.uptime(),
        });
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
    console.log(`  GET /api/analyses         — All analyses`);
    console.log(`  GET /api/analysis/:id     — Deep analysis for referendum`);
    console.log(`  GET /api/proposal/:id     — Proposal metadata`);
    console.log(`  GET /api/health           — Health check\n`);
  });

  return server;
}

function json(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}
