import { NextRequest, NextResponse } from "next/server";

const SUBSQUARE_API = "https://polkadot-api.subsquare.io";

interface SubsquarePost {
  referendumIndex: number;
  title?: string;
  track?: number;
  trackInfo?: { name?: string };
  state?: { name?: string };
  proposer?: string;
  createdAt?: string;
  commentsCount?: number;
}

function normalizePost(post: SubsquarePost) {
  return {
    referendumIndex: post.referendumIndex,
    title: post.title || `Referendum #${post.referendumIndex}`,
    track: post.track ?? 0,
    trackName: post.trackInfo?.name || "",
    state: post.state?.name || "Unknown",
    proposer: post.proposer || "",
    createdAt: post.createdAt || "",
    commentsCount: post.commentsCount ?? 0,
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
      const res = await fetch(
        `${SUBSQUARE_API}/gov2/referendums/${id}`,
        { next: { revalidate: 120 } }
      );

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

    // Fetch from Subsquare
    const fetchLimit = search ? 100 : Number(limit);
    let url;
    if (track && track !== "all") {
      url = `${SUBSQUARE_API}/gov2/tracks/${track}/referendums?page=${page}&pageSize=${fetchLimit}`;
    } else {
      url = `${SUBSQUARE_API}/gov2/referendums?page=${page}&pageSize=${fetchLimit}`;
    }

    const res = await fetch(url, { next: { revalidate: 60 } });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Subsquare returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const items: SubsquarePost[] = data.items || [];

    let referenda = items.map(normalizePost);

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
      total: search ? referenda.length : (data.total ?? referenda.length),
      page: Number(page),
      limit: fetchLimit,
    });
  } catch (err) {
    console.error("Subsquare proxy error:", err);
    return NextResponse.json(
      { error: "Failed to fetch referenda" },
      { status: 500 }
    );
  }
}
