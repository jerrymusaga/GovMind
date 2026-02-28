import { NextRequest, NextResponse } from "next/server";

const POLKASSEMBLY_BASE = "https://polkadot.polkassembly.io/api/v1";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const referendumIndex = Number(id);

  if (isNaN(referendumIndex)) {
    return NextResponse.json({ error: "Invalid referendum ID" }, { status: 400 });
  }

  try {
    const url = `${POLKASSEMBLY_BASE}/posts/on-chain-post?postId=${referendumIndex}&proposalType=referendums_v2`;
    const res = await fetch(url, {
      headers: { "x-network": "polkadot" },
      next: { revalidate: 120 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Polkassembly returned ${res.status}` },
        { status: res.status }
      );
    }

    const post = await res.json();

    return NextResponse.json({
      referendumIndex: post.post_id ?? referendumIndex,
      title: post.title || `Referendum #${referendumIndex}`,
      content: (post.content || post.markdownContent || "").slice(0, 8000),
      track: post.track_number ?? 0,
      trackName: post.origin || "",
      state: post.status || "Unknown",
      proposer: post.proposer || "",
      createdAt: post.created_at || "",
      commentsCount: post.comments_count ?? 0,
      tally: post.tally
        ? {
            ayes: post.tally.ayes || "0",
            nays: post.tally.nays || "0",
            support: post.tally.support || "0",
          }
        : null,
    });
  } catch (err) {
    console.error(`Polkassembly proxy error for #${referendumIndex}:`, err);
    return NextResponse.json(
      { error: "Failed to fetch referendum" },
      { status: 500 }
    );
  }
}
