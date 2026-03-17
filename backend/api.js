import http from "http";
import OpenAI from "openai";
import { fetchReferendum, fetchHistoricalPrecedents, fetchExternalContext } from "./subsquare.js";
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
 *   GET  /api/proposal/:id       — Proposal metadata from Subsquare
 *   POST /api/analyze/:id        — Trigger on-demand AI analysis
 *   GET  /api/health             — Health check
 */

// In-memory stores (persists while backend is running)
const analysisStore = new Map();
const proposalStore = new Map();

// Lock to prevent concurrent analyses of the same referendum
const analysisInProgress = new Set();

// ─── Collective Membership Store ───
const collectiveMemberships = new Map(); // address → { collectiveId, joinedAt }

function getCollectiveCounts() {
  const counts = {};
  for (const { collectiveId } of collectiveMemberships.values()) {
    counts[collectiveId] = (counts[collectiveId] || 0) + 1;
  }
  return counts;
}

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
 * Store proposal metadata from Subsquare (called from index.js)
 */
export function storeProposalMeta(referendumIndex, proposal) {
  proposalStore.set(Number(referendumIndex), {
    referendumIndex: proposal.referendumIndex,
    title: proposal.title,
    content: proposal.content,
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
    // 1. Fetch proposal from Subsquare
    console.log(`  Fetching proposal #${id} from Subsquare...`);
    const proposal = await fetchReferendum(id);
    if (!proposal) {
      return json(res, { error: "Proposal not found on Subsquare" }, 404);
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

  const { message, history = [], userIdentity, collective } = body;
  if (!message || typeof message !== "string") {
    return json(res, { error: "message is required" }, 400);
  }

  // Build context from stored data
  const analysis = analysisStore.get(id);
  const proposal = proposalStore.get(id);

  // If we don't have proposal data or it's missing content, fetch fresh
  let proposalData = proposal;
  if (!proposalData || !proposalData.content) {
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

    if (proposalData.content) {
      systemPrompt += `

=== PROPOSAL DESCRIPTION ===
${proposalData.content.slice(0, 3000)}`;

      // Fetch external context (forum posts, GitHub releases) linked in the proposal
      try {
        const externalContext = await fetchExternalContext(proposalData.content, proposalData.title);
        if (externalContext) {
          console.log(`  Chat: fetched ${externalContext.length} chars of external context for #${id}`);
          systemPrompt += `

=== EXTERNAL CONTEXT (referenced in proposal) ===
${externalContext.slice(0, 6000)}`;
        } else {
          console.log(`  Chat: no external context found for #${id}`);
        }
      } catch (err) {
        console.error(`  Chat: failed to fetch external context for #${id}:`, err.message);
      }
    }

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
    const axisNames = [
      "Treasury Conservative",
      "Treasury Growth",
      "Tech Progressive",
      "Tech Conservative",
      "Community Focused",
      "Infrastructure",
    ];
    systemPrompt += `

=== USER GOVERNANCE IDENTITY ===
This user has a 6-axis on-chain governance identity stored in IdentityVault. Their preferences:`;
    if (userIdentity.axes) {
      for (let i = 0; i < Math.min(userIdentity.axes.length, 6); i++) {
        systemPrompt += `\n${axisNames[i]}: ${userIdentity.axes[i]}/100`;
      }
    }
    if (userIdentity.riskTolerance != null) {
      systemPrompt += `\nRisk Tolerance: ${userIdentity.riskTolerance}/100`;
    }

    systemPrompt += `

=== HOW PERSONALIZATION WORKS ===
GovMind personalizes recommendations using the on-chain _computeAlignmentScore algorithm in GovMindCore.sol:

1. CATEGORY-TO-AXES MAPPING: Each proposal category maps to a supporting and opposing axis:
   - Treasury Spend/Tip/Bounty (cat 0,1,8) → Treasury Growth supports, Treasury Conservative opposes
   - Technical Upgrade (cat 2) → Tech Progressive supports, Tech Conservative opposes
   - Governance Change/Community (cat 3,6) → Community Focused supports, Infrastructure opposes
   - Staking/Bridge/Infrastructure (cat 4,5,7) → Infrastructure supports, Community Focused opposes

2. ALIGNMENT SCORE: alignment = 50 + (supportWeight - opposeWeight) / 2, then adjusted by risk penalty if proposal risk > user's tolerance

3. PERSONALIZED RECOMMENDATION:
   - Alignment >= 60 and base AI says Aye/Abstain → Personalized = AYE (user values align)
   - Alignment >= 60 but base AI says Nay → Personalized = ABSTAIN (conflicting signals)
   - Alignment <= 40 and base AI says Nay/Abstain → Personalized = NAY (user values oppose)
   - Alignment <= 40 but base AI says Aye → Personalized = NAY (user values override)
   - Alignment 41-59 → Keep the base AI recommendation unchanged

This means the SAME proposal can get different recommendations for different users. If the user asks why their recommendation differs from the base AI analysis, explain it using their specific axis values and this algorithm.`;
    if (userIdentity.personalizedRec != null) {
      const persRecLabel = userIdentity.personalizedRec === 1 ? "Aye" : userIdentity.personalizedRec === -1 ? "Nay" : "Abstain";
      systemPrompt += `

=== PERSONALIZED RESULT FOR THIS USER ===
Personalized Recommendation: ${persRecLabel}
Adjusted Confidence: ${userIdentity.adjustedConfidence || "N/A"}%
Alignment Score: ${userIdentity.alignmentScore || "N/A"}/100
${analysis ? `Base AI Recommendation: ${analysis.recommendation === 1 ? "Aye" : analysis.recommendation === -1 ? "Nay" : "Abstain"}` : ""}
${userIdentity.personalizedRec !== (analysis?.recommendation) ? `NOTE: The recommendation changed from the base AI analysis because this user's governance identity produced an alignment score of ${userIdentity.alignmentScore}/100 for this proposal category.` : ""}`;
    }
  }

  if (collective) {
    systemPrompt += `

=== AI VOTING COLLECTIVE ===
This user is a member of the "${collective.name}" collective (on-chain via CollectiveRegistry contract).
Philosophy: ${collective.philosophy}
Collective Governance Profile (6-axis): Treasury Conservative=${collective.axes[0]}, Treasury Growth=${collective.axes[1]}, Tech Progressive=${collective.axes[2]}, Tech Conservative=${collective.axes[3]}, Community=${collective.axes[4]}, Infrastructure=${collective.axes[5]}
Risk Tolerance: ${collective.riskTolerance}/100
Focus Areas: ${collective.focusAreas.join(", ")}

The collective's recommendation is computed using the SAME alignment algorithm as personal recommendations, but using the collective's 6-axis profile instead of the user's personal profile. When the user asks about the collective's recommendation, apply the category-to-axes mapping and alignment calculation to the collective's axes.`;

    // Detect conflict between user identity and collective
    if (userIdentity && userIdentity.axes && collective.axes) {
      // Compute cosine similarity between user and collective profiles
      let dot = 0, magA = 0, magB = 0;
      for (let i = 0; i < 6; i++) {
        const u = userIdentity.axes[i] || 0;
        const c = collective.axes[i] || 0;
        dot += u * c;
        magA += u * u;
        magB += c * c;
      }
      const alignment = magA > 0 && magB > 0
        ? Math.round((dot / (Math.sqrt(magA) * Math.sqrt(magB))) * 100)
        : 50;

      // Find the axes with biggest disagreements
      const disagreements = [];
      const axisNames = ["Treasury Conservative", "Treasury Growth", "Tech Progressive", "Tech Conservative", "Community Focused", "Infrastructure"];
      for (let i = 0; i < 6; i++) {
        const diff = Math.abs((userIdentity.axes[i] || 0) - (collective.axes[i] || 0));
        if (diff >= 30) {
          disagreements.push(`${axisNames[i]} (you: ${userIdentity.axes[i]}, collective: ${collective.axes[i]}, gap: ${diff})`);
        }
      }

      systemPrompt += `

=== IDENTITY vs COLLECTIVE ALIGNMENT ===
Alignment between this user's personal identity and their collective: ${alignment}%`;

      if (alignment < 60) {
        systemPrompt += `
⚠️ CONFLICT DETECTED: This user's personal governance identity is MISALIGNED with their collective (${alignment}% alignment).
Major disagreements: ${disagreements.join("; ") || "General profile divergence"}

IMPORTANT BEHAVIOR: When the user's personal recommendation and the collective's recommendation DISAGREE on this proposal, you MUST proactively flag this conflict. Explain:
1. What your personal identity says (and why, based on your axis values)
2. What your collective recommends (and why, based on its axis values)
3. Where the specific disagreement lies (which axes conflict)
4. Your honest advice: consider whether this collective still represents their values, or whether they should vote with their personal identity on this one

Be direct and helpful — don't just say "it depends." The user joined this collective but their values don't match. Help them navigate that tension.`;
      } else if (alignment < 80) {
        systemPrompt += `
Note: Moderate alignment (${alignment}%). The user and collective mostly agree but may diverge on some proposal types.
${disagreements.length > 0 ? `Areas of disagreement: ${disagreements.join("; ")}` : ""}
If their personal recommendation differs from the collective's on this proposal, gently point out the divergence and explain which axes cause it.`;
      } else {
        systemPrompt += `
Strong alignment (${alignment}%). The user's personal values closely match their collective. Their recommendations should usually agree.`;
      }
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
 * Handle AI delegation advisor chat
 */
async function handleDelegationChat(req, res) {
  const body = await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try { resolve(JSON.parse(data)); } catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });

  const { message, history = [], userIdentity, delegates } = body;
  if (!message || typeof message !== "string") {
    return json(res, { error: "message is required" }, 400);
  }

  const axisNames = [
    "Treasury Conservative",
    "Treasury Growth",
    "Tech Progressive",
    "Tech Conservative",
    "Community Focused",
    "Infrastructure",
  ];

  let systemPrompt = `You are GovMind Delegation Advisor — an AI assistant that helps Polkadot OpenGov users understand delegation and find the right delegates for their governance values.

RULES:
- Be concise (2-4 sentences per response unless the user asks for detail)
- Explain delegation concepts in simple terms — assume the user may be new to Polkadot governance
- When recommending delegates, reference their alignment scores and governance profiles
- Explain WHY a delegate matches or doesn't match the user's values
- Be opinionated — give clear recommendations when asked
- Use plain language, avoid jargon

=== POLKADOT DELEGATION CONTEXT ===
- In Polkadot OpenGov, users can delegate their voting power to trusted community members PER TRACK
- There are 15+ governance tracks (Root, Treasurer, Staking Admin, Small Tipper, Big Spender, etc.)
- Delegation means lending your voting weight, NOT sending tokens — tokens stay in the user's wallet
- Users can undelegate anytime
- Conviction multipliers apply: higher conviction = longer lock but more voting power
- GovMind uses the AlignmentScorer PVM contract (Rust on RISC-V) to compute cosine similarity between user and delegate governance identities`;

  if (userIdentity && userIdentity.axes) {
    systemPrompt += `\n\n=== USER GOVERNANCE IDENTITY ===`;
    for (let i = 0; i < Math.min(userIdentity.axes.length, 6); i++) {
      systemPrompt += `\n${axisNames[i]}: ${userIdentity.axes[i]}/100`;
    }
    if (userIdentity.riskTolerance != null) {
      systemPrompt += `\nRisk Tolerance: ${userIdentity.riskTolerance}/100`;
    }
  } else {
    systemPrompt += `\n\nThe user has NOT created a governance identity yet. Encourage them to create one on the Identity page so GovMind can compute alignment scores.`;
  }

  if (delegates && delegates.length > 0) {
    systemPrompt += `\n\n=== AVAILABLE DELEGATES ===`;
    for (const d of delegates) {
      systemPrompt += `\n\n${d.name} (${d.badge}): Alignment ${d.alignmentScore ?? "N/A"}%`;
      systemPrompt += `\n  Profile: ${d.identity.map((v, i) => `${axisNames[i]}=${v}`).join(", ")}`;
      systemPrompt += `\n  Tracks: ${d.tracks.join(", ")} | Votes cast: ${d.totalVotes}`;
      systemPrompt += `\n  ${d.description}`;
    }
  }

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
    console.error(`  Delegation chat error: ${err.message}`);
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

      // ─── Collective Membership Endpoints ───

      // GET /api/collectives — member counts
      if (path === "/api/collectives" && req.method === "GET") {
        return json(res, { counts: getCollectiveCounts(), total: collectiveMemberships.size });
      }

      // GET /api/collectives/membership/:address
      const membershipMatch = path.match(/^\/api\/collectives\/membership\/(0x[a-fA-F0-9]+)$/);
      if (membershipMatch && req.method === "GET") {
        const addr = membershipMatch[1].toLowerCase();
        const membership = collectiveMemberships.get(addr);
        return json(res, { membership: membership || null });
      }

      // POST /api/collectives/join
      if (path === "/api/collectives/join" && req.method === "POST") {
        const body = await parseBody(req);
        const { collectiveId, address } = body;
        if (!collectiveId || !address) {
          return json(res, { error: "collectiveId and address required" }, 400);
        }
        const addr = address.toLowerCase();
        collectiveMemberships.set(addr, { collectiveId, joinedAt: Date.now() });
        return json(res, { success: true, counts: getCollectiveCounts() });
      }

      // POST /api/collectives/leave
      if (path === "/api/collectives/leave" && req.method === "POST") {
        const body = await parseBody(req);
        const { address } = body;
        if (!address) {
          return json(res, { error: "address required" }, 400);
        }
        collectiveMemberships.delete(address.toLowerCase());
        return json(res, { success: true, counts: getCollectiveCounts() });
      }

      // POST /api/analyze/:id — On-demand AI analysis
      const analyzeMatch = path.match(/^\/api\/analyze\/(\d+)$/);
      if (analyzeMatch && req.method === "POST") {
        const id = Number(analyzeMatch[1]);
        return await handleAnalyzeRequest(id, res);
      }

      // POST /api/chat/delegation — AI delegation advisor
      if (path === "/api/chat/delegation" && req.method === "POST") {
        return await handleDelegationChat(req, res);
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
        const forceRefresh = url.searchParams?.get("refresh") === "1" || req.url?.includes("refresh=1");

        // If not in memory, or force refresh requested, re-generate deep analysis
        if (!analysis || forceRefresh) {
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
    console.log(`  GET  /api/health           — Health check`);
    console.log(`  GET  /api/collectives      — Collective member counts`);
    console.log(`  POST /api/collectives/join  — Join a collective`);
    console.log(`  POST /api/collectives/leave — Leave a collective\n`);
  });

  return server;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try { resolve(JSON.parse(data)); } catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

function logResult(id, analysis) {
  const rec = analysis.recommendation === 1 ? "AYE" : analysis.recommendation === -1 ? "NAY" : "ABSTAIN";
  console.log(`  Result: ${rec} | Risk: ${analysis.riskScore}/100 | Confidence: ${analysis.confidence}/100`);
}

function json(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}
