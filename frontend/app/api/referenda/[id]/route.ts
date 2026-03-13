import { NextRequest, NextResponse } from "next/server";

const SUBSQUARE_API = "https://polkadot-api.subsquare.io";

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
    const res = await fetch(
      `${SUBSQUARE_API}/gov2/referendums/${referendumIndex}`,
      { next: { revalidate: 120 } }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `Subsquare returned ${res.status}` },
        { status: res.status }
      );
    }

    const post = await res.json();
    const onchain = post.onchainData || {};
    const tally = onchain.tally;

    return NextResponse.json({
      referendumIndex: post.referendumIndex ?? referendumIndex,
      title: post.title || `Referendum #${referendumIndex}`,
      content: (post.content || "").slice(0, 8000),
      track: post.track ?? 0,
      trackName: post.trackInfo?.name || "",
      state: post.state?.name || "Unknown",
      proposer: post.proposer || "",
      createdAt: post.createdAt || "",
      commentsCount: post.commentsCount ?? 0,
      tally: tally
        ? {
            ayes: tally.ayes || "0",
            nays: tally.nays || "0",
            support: tally.support || "0",
          }
        : null,
    });
  } catch (err) {
    console.error(`Subsquare proxy error for #${referendumIndex}:`, err);
    return NextResponse.json(
      { error: "Failed to fetch referendum" },
      { status: 500 }
    );
  }
}
