import { NextRequest, NextResponse } from "next/server";

const POLKASSEMBLY_BASE = "https://polkadot.polkassembly.io/api/v1";

function normalizePost(post: Record<string, unknown>) {
  return {
    referendumIndex: post.post_id ?? post.id,
    title: post.title || `Referendum #${post.post_id ?? post.id}`,
    track: post.track_number ?? post.track_no ?? 0,
    trackName: post.origin || "",
    state: post.status || "Unknown",
    proposer: post.proposer || "",
    createdAt: post.created_at || post.createdAt || "",
    commentsCount: post.comments_count ?? 0,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") || "1";
  const limit = searchParams.get("limit") || "20";
  const track = searchParams.get("track");
  const search = searchParams.get("search")?.trim() || "";

  try {
    // If search is a pure number, fetch that specific proposal by ID
    if (search && /^\d+$/.test(search)) {
      const id = search;
      const url = `${POLKASSEMBLY_BASE}/posts/on-chain-post?postId=${id}&proposalType=referendums_v2`;
      const res = await fetch(url, {
        headers: { "x-network": "polkadot" },
        next: { revalidate: 120 },
      });

      if (res.ok) {
        const post = await res.json();
        return NextResponse.json({
          referenda: [normalizePost(post)],
          total: 1,
          page: 1,
          limit: 1,
          directLookup: true,
        });
      }
      // If not found, fall through to listing search
    }

    // Fetch a larger batch when searching (Polkassembly has no text search API)
    const fetchLimit = search ? "100" : limit;
    let url = `${POLKASSEMBLY_BASE}/listing/on-chain-posts?proposalType=referendums_v2&page=${page}&listingLimit=${fetchLimit}&sortBy=newest`;
    if (track && track !== "all") {
      url += `&trackNo=${track}`;
    }

    const res = await fetch(url, {
      headers: { "x-network": "polkadot" },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Polkassembly returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const posts = data.posts || data || [];

    let referenda = (Array.isArray(posts) ? posts : []).map(normalizePost);

    // Server-side text filtering
    if (search) {
      const q = search.toLowerCase();
      referenda = referenda.filter(
        (r) =>
          String(r.title).toLowerCase().includes(q) ||
          String(r.referendumIndex).includes(q) ||
          String(r.proposer).toLowerCase().includes(q) ||
          String(r.trackName).toLowerCase().includes(q)
      );
    }

    return NextResponse.json({
      referenda,
      total: search ? referenda.length : (data.count ?? referenda.length),
      page: Number(page),
      limit: Number(fetchLimit),
    });
  } catch (err) {
    console.error("Polkassembly proxy error:", err);
    return NextResponse.json(
      { error: "Failed to fetch referenda" },
      { status: 500 }
    );
  }
}
