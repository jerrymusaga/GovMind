const SUBSQUARE_API = "https://polkadot-api.subsquare.io";

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

/**
 * Fetch active referenda from Subsquare API with full enriched data
 */
export async function fetchActiveReferenda(limit = 10) {
  try {
    console.log(`  Fetching active referenda from Subsquare...`);
    const res = await fetch(
      `${SUBSQUARE_API}/gov2/referendums?page=1&pageSize=${limit}`
    );

    if (!res.ok) throw new Error(`Subsquare returned ${res.status}`);

    const data = await res.json();
    const items = data.items || [];
    const proposals = [];

    for (const item of items) {
      try {
        const proposal = normalizeSubsquarePost(item);
        proposals.push(proposal);
      } catch (err) {
        console.warn(`  Failed to normalize #${item.referendumIndex}: ${err.message}`);
      }
    }

    if (proposals.length > 0) {
      console.log(`Fetched ${proposals.length} enriched proposals from Subsquare`);
      return proposals;
    }
  } catch (err) {
    console.warn(`  Subsquare fetch failed: ${err.message}`);
  }

  console.log("API failed, using fallback proposals for demo...");
  return FALLBACK_PROPOSALS.slice(0, limit);
}

/**
 * Fetch a single referendum by index from Subsquare
 */
export async function fetchReferendum(referendumIndex) {
  const res = await fetch(
    `${SUBSQUARE_API}/gov2/referendums/${referendumIndex}`
  );

  if (!res.ok) {
    throw new Error(`Subsquare returned ${res.status}`);
  }

  const post = await res.json();
  return normalizeSubsquarePost(post);
}

/**
 * Normalize a Subsquare post into our internal format
 */
function normalizeSubsquarePost(post) {
  const onchain = post.onchainData || {};

  // Tally from onchain data
  const tally = extractTally(onchain.tally);

  // Comments from Subsquare
  const commentAnalysis = {
    total: post.commentsCount || 0,
    sentiments: { positive: 0, negative: 0, neutral: post.commentsCount || 0 },
    topConcerns: [],
    endorsements: [],
    summary: post.commentsCount
      ? `${post.commentsCount} community comments`
      : "No community discussion yet.",
  };

  // Status timeline from onchain data
  const statusTimeline = (onchain.timeline || []).map((entry) => ({
    status: entry.name || entry.method || "Unknown",
    timestamp: entry.indexer?.blockTime
      ? new Date(entry.indexer.blockTime).toISOString()
      : "",
    block: entry.indexer?.blockHeight || 0,
  }));

  // Spending info from allSpends
  const spendingInfo = extractSpendingFromSubsquare(post.allSpends);

  // Reactions
  const reactions = extractReactions(post.reactions);

  return {
    referendumIndex: post.referendumIndex,
    title: post.title || "Untitled Referendum",
    content: stripHtml(post.content || "No content available").slice(0, 4000),
    track: post.track ?? 0,
    trackName: post.trackInfo?.name
      ? formatTrackName(post.trackInfo.name)
      : TRACK_NAMES[post.track] || "Unknown",
    state: post.state?.name || "Unknown",
    proposer: post.proposer || "Unknown",
    origin: onchain.info?.origin?.origins || "",

    // === Enriched Subsquare Data ===
    tally,
    commentAnalysis,
    statusTimeline,
    spendingInfo,
    reactions,
    commentsCount: post.commentsCount || 0,
    dataSource: "subsquare",
  };
}

/**
 * Format track name from snake_case to PascalCase
 */
function formatTrackName(name) {
  return name
    .replace(/\x00/g, "")
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
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
 * Extract spending info from Subsquare's allSpends field
 */
function extractSpendingFromSubsquare(allSpends) {
  if (!allSpends || allSpends.length === 0) {
    return { totalAmountDOT: 0, paymentCount: 0, beneficiaries: [] };
  }

  let totalAmount = 0n;
  const beneficiarySet = new Set();

  for (const spend of allSpends) {
    if (spend.amount) {
      try {
        totalAmount += BigInt(spend.amount);
      } catch (_) {}
    }
    if (spend.beneficiary) beneficiarySet.add(spend.beneficiary);
  }

  return {
    totalAmountRaw: totalAmount.toString(),
    totalAmountDOT: Number(totalAmount / DOT_DIVISOR),
    paymentCount: allSpends.length,
    beneficiaries: Array.from(beneficiarySet).slice(0, 5),
  };
}

/**
 * Extract reaction counts
 */
function extractReactions(reactions) {
  if (!reactions || !Array.isArray(reactions)) return { thumbsUp: 0, thumbsDown: 0 };

  let thumbsUp = 0;
  let thumbsDown = 0;
  for (const r of reactions) {
    if (r.reaction === "👍" || r.reaction === "thumbup") thumbsUp++;
    if (r.reaction === "👎" || r.reaction === "thumbdown") thumbsDown++;
  }

  return { thumbsUp, thumbsDown };
}

/**
 * Fetch historical precedent: similar past proposals for AI comparison
 */
export async function fetchHistoricalPrecedents(proposal, limit = 3) {
  const precedents = [];

  try {
    // Fetch past proposals on same track
    const trackUrl = `${SUBSQUARE_API}/gov2/tracks/${proposal.track}/referendums?page=1&pageSize=10`;
    try {
      const res = await fetch(trackUrl);
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        for (const item of items) {
          if (item.referendumIndex !== proposal.referendumIndex) {
            precedents.push(formatPrecedent(item, "same_track"));
          }
        }
      }
    } catch (_) {}
  } catch (err) {
    console.warn(`  Historical precedent fetch failed: ${err.message}`);
  }

  return precedents.slice(0, limit);
}

function formatPrecedent(post, matchType) {
  const onchain = post.onchainData || {};
  const tally = extractTally(onchain.tally);

  return {
    referendumIndex: post.referendumIndex,
    title: post.title || "Untitled",
    track: post.track ?? 0,
    trackName: post.trackInfo?.name
      ? formatTrackName(post.trackInfo.name)
      : TRACK_NAMES[post.track] || "Unknown",
    state: post.state?.name || "Unknown",
    proposer: post.proposer || "Unknown",
    tally,
    spendingInfo: extractSpendingFromSubsquare(post.allSpends),
    commentsCount: post.commentsCount || 0,
    matchType,
  };
}

function stripHtml(str) {
  return str.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

// Hardcoded real proposals as fallback for demo reliability
const FALLBACK_PROPOSALS = [
  {
    referendumIndex: 1856,
    title: "Polkadot-API maintenance funding March 2026 - February 2027",
    content: "This proposal covers the funding for the maintenance costs of the Polkadot-API for the next 12 months.",
    track: 33,
    trackName: "MediumSpender",
    state: "Confirming",
    proposer: "16JGzEsi8gcySKjpmxHVrkLTHdFHodRepEz8n244gNZpr9J",
    tally: { ayes: 0, nays: 0, support: 0, ayePercent: 0 },
    commentAnalysis: { total: 0, sentiments: { positive: 0, negative: 0, neutral: 0 }, topConcerns: [], endorsements: [], summary: "Fallback data" },
    statusTimeline: [],
    spendingInfo: { totalAmountDOT: 0, paymentCount: 0, beneficiaries: [] },
    reactions: { thumbsUp: 0, thumbsDown: 0 },
    commentsCount: 0,
    dataSource: "fallback",
  },
  {
    referendumIndex: 1860,
    title: "OpenSquare products maintenance and development funding",
    content: "Maintenance and development funding for OpenSquare governance products including Subsquare.",
    track: 33,
    trackName: "MediumSpender",
    state: "Deciding",
    proposer: "Unknown",
    tally: { ayes: 0, nays: 0, support: 0, ayePercent: 0 },
    commentAnalysis: { total: 0, sentiments: { positive: 0, negative: 0, neutral: 0 }, topConcerns: [], endorsements: [], summary: "Fallback data" },
    statusTimeline: [],
    spendingInfo: { totalAmountDOT: 0, paymentCount: 0, beneficiaries: [] },
    reactions: { thumbsUp: 0, thumbsDown: 0 },
    commentsCount: 0,
    dataSource: "fallback",
  },
];
