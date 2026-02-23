const POLKASSEMBLY_BASE = "https://polkadot.polkassembly.io/api/v1";

const TRACK_NAMES = {
  0: "Root",
  1: "WhitelistedCaller",
  2: "WishForChange",
  10: "StakingAdmin",
  11: "Treasurer",
  12: "LeaseAdmin",
  13: "FellowshipAdmin",
  14: "GeneralAdmin",
  15: "AuctionAdmin",
  20: "ReferendumCanceller",
  21: "ReferendumKiller",
  30: "SmallTipper",
  31: "BigTipper",
  32: "SmallSpender",
  33: "MediumSpender",
  34: "BigSpender",
};

// DOT has 10 decimals on Polkadot
const DOT_DECIMALS = 10n;
const DOT_DIVISOR = 10n ** DOT_DECIMALS;

// Recent active referendum IDs to fetch (update as needed)
const ACTIVE_REFERENDUM_IDS = [1836, 1831, 1772, 1766, 1703];

/**
 * Fetch active referenda from Polkassembly API with full enriched data
 * Integrates Polkassembly/Klara data layer: comments, tally, status history,
 * community sentiment, and proposed call details
 */
export async function fetchActiveReferenda(limit = 5) {
  const ids = ACTIVE_REFERENDUM_IDS.slice(0, limit);
  const proposals = [];

  for (const id of ids) {
    try {
      console.log(`  Fetching referendum #${id} from Polkassembly...`);
      const proposal = await fetchReferendum(id);
      if (proposal) proposals.push(proposal);
    } catch (err) {
      console.warn(`  Failed to fetch #${id}: ${err.message}`);
    }
  }

  if (proposals.length > 0) {
    console.log(`Fetched ${proposals.length} enriched proposals from Polkassembly`);
    return proposals;
  }

  console.log("API failed, using fallback proposals for demo...");
  return FALLBACK_PROPOSALS.slice(0, limit);
}

async function fetchReferendum(referendumIndex) {
  const url = `${POLKASSEMBLY_BASE}/posts/on-chain-post?postId=${referendumIndex}&proposalType=referendums_v2`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Polkassembly returned ${res.status}`);
  }

  const post = await res.json();

  // --- Extract enriched data from Polkassembly ---

  // 1. Tally (on-chain vote counts)
  const tally = extractTally(post.tally);

  // 2. Community comments & sentiment analysis
  const commentAnalysis = analyzeComments(post.comments || []);

  // 3. Status history / timeline
  const statusTimeline = extractStatusHistory(post.statusHistory || []);

  // 4. Proposed spending amounts from on-chain call
  const spendingInfo = extractSpendingInfo(post.proposed_call, post.beneficiaries);

  // 5. Reactions
  const reactions = extractReactions(post.post_reactions);

  return {
    referendumIndex: post.post_id ?? referendumIndex,
    title: post.title || "Untitled Referendum",
    content: stripHtml(post.content || post.markdownContent || "No content available").slice(0, 4000),
    track: post.track_number ?? 0,
    trackName: TRACK_NAMES[post.track_number] || post.origin || "Unknown",
    state: post.status || "Unknown",
    proposer: post.proposer || "Unknown",
    origin: post.origin || "",

    // === Enriched Polkassembly Data (Klara integration) ===
    tally,
    commentAnalysis,
    statusTimeline,
    spendingInfo,
    reactions,
    commentsCount: post.comments_count || 0,
    dataSource: post.dataSource || "polkassembly",
  };
}

/**
 * Extract and normalize tally data (ayes/nays/support in DOT)
 */
function extractTally(tally) {
  if (!tally) return { ayes: 0, nays: 0, support: 0, ayePercent: 0 };

  const ayes = Number(BigInt(tally.ayes || 0) / DOT_DIVISOR);
  const nays = Number(BigInt(tally.nays || 0) / DOT_DIVISOR);
  const support = Number(BigInt(tally.support || 0) / DOT_DIVISOR);
  const total = ayes + nays || 1;

  return {
    ayes,
    nays,
    support,
    ayePercent: Math.round((ayes / total) * 100),
  };
}

/**
 * Analyze community comments: extract sentiment distribution,
 * key concerns, and notable endorsements
 */
function analyzeComments(comments) {
  if (!comments || comments.length === 0) {
    return {
      total: 0,
      sentiments: { positive: 0, negative: 0, neutral: 0 },
      topConcerns: [],
      endorsements: [],
      summary: "No community discussion yet.",
    };
  }

  const sentiments = { positive: 0, negative: 0, neutral: 0 };
  const concerns = [];
  const endorsements = [];

  for (const c of comments) {
    // Count sentiment
    const sentiment = (c.sentiment || "neutral").toLowerCase();
    if (sentiment === "against" || sentiment === "negative") {
      sentiments.negative++;
    } else if (sentiment === "for" || sentiment === "positive" || sentiment === "completely_for") {
      sentiments.positive++;
    } else {
      sentiments.neutral++;
    }

    const text = stripHtml(c.content || "").slice(0, 500);
    const author = c.username || "Anonymous";
    const isExpert = c.isExpertComment || false;

    // Identify concerns (negative/neutral comments with substance)
    if ((sentiment === "against" || sentiment === "negative") && text.length > 50) {
      concerns.push({ author, text: text.slice(0, 200) });
    }

    // Identify endorsements (positive or expert comments)
    if ((sentiment === "for" || sentiment === "positive" || sentiment === "completely_for" || isExpert) && text.length > 30) {
      endorsements.push({ author, text: text.slice(0, 200), isExpert });
    }
  }

  // Build a human-readable summary for the AI
  const parts = [`${comments.length} community comments`];
  if (sentiments.positive > 0) parts.push(`${sentiments.positive} supportive`);
  if (sentiments.negative > 0) parts.push(`${sentiments.negative} opposed`);
  if (sentiments.neutral > 0) parts.push(`${sentiments.neutral} neutral`);

  return {
    total: comments.length,
    sentiments,
    topConcerns: concerns.slice(0, 3),
    endorsements: endorsements.slice(0, 3),
    summary: parts.join(", "),
  };
}

/**
 * Extract status history timeline
 */
function extractStatusHistory(statusHistory) {
  if (!statusHistory || statusHistory.length === 0) return [];

  return statusHistory.map((entry) => ({
    status: entry.status,
    timestamp: entry.timestamp,
    block: entry.block,
  }));
}

/**
 * Extract spending amounts from proposed_call data
 */
function extractSpendingInfo(proposedCall, beneficiaries) {
  if (!proposedCall) return { totalAmountDOT: 0, paymentCount: 0, beneficiaries: [] };

  let totalAmount = 0n;
  let paymentCount = 0;
  const beneficiarySet = new Set();

  // Handle batch calls
  const calls = proposedCall.args?.calls || [proposedCall];

  for (const call of calls) {
    // Look for spend/transfer amounts in various call formats
    const amount = call.args?.amount || call.args?.value;
    if (amount) {
      try {
        totalAmount += BigInt(amount);
        paymentCount++;
      } catch (_) {}
    }

    // Extract beneficiary
    const beneficiary = call.args?.beneficiary?.value || call.args?.dest?.value || call.args?.dest?.id;
    if (beneficiary) beneficiarySet.add(beneficiary);
  }

  // Also check top-level beneficiaries array
  if (beneficiaries && beneficiaries.length > 0) {
    for (const b of beneficiaries) {
      if (b.address) beneficiarySet.add(b.address);
    }
  }

  return {
    totalAmountRaw: totalAmount.toString(),
    totalAmountDOT: Number(totalAmount / DOT_DIVISOR),
    paymentCount,
    beneficiaries: Array.from(beneficiarySet).slice(0, 5),
  };
}

/**
 * Extract reaction counts
 */
function extractReactions(reactions) {
  if (!reactions) return { thumbsUp: 0, thumbsDown: 0 };

  return {
    thumbsUp: reactions["👍"]?.count || 0,
    thumbsDown: reactions["👎"]?.count || 0,
  };
}

function stripHtml(str) {
  return str.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

// Hardcoded real proposals as fallback for demo reliability
const FALLBACK_PROPOSALS = [
  {
    referendumIndex: 1836,
    title: "Polkadot-API 2026 Development Funding through Polkadot Community Foundation",
    content:
      "This proposal requests funding for the continued development and maintenance of Polkadot-API for January to December 2026. Polkadot-API is a core infrastructure library used by many ecosystem projects for interacting with Polkadot and its parachains. The team has consistently delivered on prior proposals and this continuation ensures the library remains well-maintained, compatible with runtime upgrades, and accessible to developers building on Polkadot.",
    track: 33,
    trackName: "MediumSpender",
    state: "Deciding",
    proposer: "16SDAKg9F6je8EhqitGMWuVU4VEx5gSzAFKMMqb2jydCRKVb",
    tally: { ayes: 0, nays: 0, support: 0, ayePercent: 0 },
    commentAnalysis: { total: 0, sentiments: { positive: 0, negative: 0, neutral: 0 }, topConcerns: [], endorsements: [], summary: "Fallback data - no live comments" },
    statusTimeline: [],
    spendingInfo: { totalAmountDOT: 0, paymentCount: 0, beneficiaries: [] },
    reactions: { thumbsUp: 0, thumbsDown: 0 },
    commentsCount: 0,
    dataSource: "fallback",
  },
  {
    referendumIndex: 1831,
    title: "Polkadot Staking Dashboard: Protocol-Aligned Development",
    content:
      "Proposal for continued development of the Polkadot Staking Dashboard from February 2026 to July 2026. The dashboard is a widely-used tool for staking, nomination pool management, and validator selection. This proposal covers maintenance, new features including DeFi integration, improved validator analytics, and mobile responsiveness improvements. The team has a strong track record of delivering on past proposals.",
    track: 33,
    trackName: "MediumSpender",
    state: "Deciding",
    proposer: "1hYiMW8KSfUYChzCQSPGXvMSyKVqmyvMXqohjKr3oU5PCXF",
    tally: { ayes: 0, nays: 0, support: 0, ayePercent: 0 },
    commentAnalysis: { total: 0, sentiments: { positive: 0, negative: 0, neutral: 0 }, topConcerns: [], endorsements: [], summary: "Fallback data - no live comments" },
    statusTimeline: [],
    spendingInfo: { totalAmountDOT: 0, paymentCount: 0, beneficiaries: [] },
    reactions: { thumbsUp: 0, thumbsDown: 0 },
    commentsCount: 0,
    dataSource: "fallback",
  },
  {
    referendumIndex: 1772,
    title: "Polkadot Staking Dashboard: Improvements, Upgrades & DeFi Integration",
    content:
      "Technical upgrade proposal for the Polkadot Staking Dashboard focusing on DeFi integration, staking analytics improvements, and validator selection enhancements. Budget covers development, testing, and deployment across 6 months.",
    track: 32,
    trackName: "SmallSpender",
    state: "Deciding",
    proposer: "1hYiMW8KSfUYChzCQSPGXvMSyKVqmyvMXqohjKr3oU5PCXF",
    tally: { ayes: 0, nays: 0, support: 0, ayePercent: 0 },
    commentAnalysis: { total: 0, sentiments: { positive: 0, negative: 0, neutral: 0 }, topConcerns: [], endorsements: [], summary: "Fallback data - no live comments" },
    statusTimeline: [],
    spendingInfo: { totalAmountDOT: 0, paymentCount: 0, beneficiaries: [] },
    reactions: { thumbsUp: 0, thumbsDown: 0 },
    commentsCount: 0,
    dataSource: "fallback",
  },
  {
    referendumIndex: 1766,
    title: "Polkawatch Decentralization Analytics Infrastructure Maintenance 2025",
    content:
      "Polkawatch provides decentralization analytics for the Polkadot network, tracking validator distribution, nominator behavior, and geographic decentralization metrics. This proposal covers infrastructure maintenance and development costs for 2025.",
    track: 33,
    trackName: "MediumSpender",
    state: "Deciding",
    proposer: "15cfSaBcTxNr8kRFDnVSU5EEPcroH4VqJLq5cAWJ2Nq37va",
    tally: { ayes: 0, nays: 0, support: 0, ayePercent: 0 },
    commentAnalysis: { total: 0, sentiments: { positive: 0, negative: 0, neutral: 0 }, topConcerns: [], endorsements: [], summary: "Fallback data - no live comments" },
    statusTimeline: [],
    spendingInfo: { totalAmountDOT: 0, paymentCount: 0, beneficiaries: [] },
    reactions: { thumbsUp: 0, thumbsDown: 0 },
    commentsCount: 0,
    dataSource: "fallback",
  },
  {
    referendumIndex: 1703,
    title: "Polkadot Staking Dashboard: September 2025 - March 2026 Funding",
    content:
      "Requesting treasury funding for the Polkadot Staking Dashboard maintenance and improvements for the period September 2025 to March 2026. Includes support for new staking features, bug fixes, performance optimization, and user experience improvements.",
    track: 33,
    trackName: "MediumSpender",
    state: "Confirming",
    proposer: "1hYiMW8KSfUYChzCQSPGXvMSyKVqmyvMXqohjKr3oU5PCXF",
    tally: { ayes: 0, nays: 0, support: 0, ayePercent: 0 },
    commentAnalysis: { total: 0, sentiments: { positive: 0, negative: 0, neutral: 0 }, topConcerns: [], endorsements: [], summary: "Fallback data - no live comments" },
    statusTimeline: [],
    spendingInfo: { totalAmountDOT: 0, paymentCount: 0, beneficiaries: [] },
    reactions: { thumbsUp: 0, thumbsDown: 0 },
    commentsCount: 0,
    dataSource: "fallback",
  },
];
