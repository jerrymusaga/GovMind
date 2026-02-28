import { NextRequest, NextResponse } from "next/server";

const POLKASSEMBLY_BASE = "https://polkadot.polkassembly.io/api/v1";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") || "1";
  const limit = searchParams.get("limit") || "20";
  const track = searchParams.get("track");
  const status = searchParams.get("status"); // Deciding, Confirming, Approved, etc.

  try {
    // Build Polkassembly listing URL
    let url = `${POLKASSEMBLY_BASE}/listing/on-chain-posts?proposalType=referendums_v2&page=${page}&listingLimit=${limit}&sortBy=newest`;
    if (track && track !== "all") {
      url += `&trackNo=${track}`;
    }
    if (status && status !== "all") {
      url += `&trackStatus=${status}`;
    }

    const res = await fetch(url, {
      headers: { "x-network": "polkadot" },
      next: { revalidate: 60 }, // cache for 60s
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Polkassembly returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const posts = data.posts || data || [];

    // Normalize to our shape
    const referenda = (Array.isArray(posts) ? posts : []).map((post: Record<string, unknown>) => ({
      referendumIndex: post.post_id ?? post.id,
      title: post.title || `Referendum #${post.post_id ?? post.id}`,
      track: post.track_number ?? post.track_no ?? 0,
      trackName: post.origin || "",
      state: post.status || "Unknown",
      proposer: post.proposer || "",
      createdAt: post.created_at || post.createdAt || "",
      commentsCount: post.comments_count ?? 0,
    }));

    return NextResponse.json({
      referenda,
      total: data.count ?? referenda.length,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    console.error("Polkassembly proxy error:", err);
    return NextResponse.json(
      { error: "Failed to fetch referenda" },
      { status: 500 }
    );
  }
}
