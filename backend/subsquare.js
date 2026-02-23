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

// Recent active referendum IDs to fetch (update as needed)
const ACTIVE_REFERENDUM_IDS = [1836, 1831, 1772, 1766, 1703];

/**
 * Fetch active referenda from Polkassembly API with fallback to hardcoded proposals
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
    console.log(`Fetched ${proposals.length} proposals from Polkassembly`);
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

  return {
    referendumIndex: post.post_id ?? referendumIndex,
    title: post.title || "Untitled Referendum",
    content: stripHtml(post.content || post.markdownContent || "No content available").slice(0, 4000),
    track: post.track_number ?? 0,
    trackName: TRACK_NAMES[post.track_number] || post.origin || "Unknown",
    state: post.status || "Unknown",
    proposer: post.proposer || "Unknown",
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
  },
];
