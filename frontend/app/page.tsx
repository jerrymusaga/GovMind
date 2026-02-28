"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAccount, useReadContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  ADDRESSES,
  AI_ORACLE_ABI,
  IDENTITY_VAULT_ABI,
  XCM_RELAY_ABI,
  TRACK_NAMES,
} from "@/lib/contracts";
import { StatsHero } from "@/components/StatsHero";
import { ProposalCard } from "@/components/ProposalCard";
import {
  Brain,
  Sparkles,
  ArrowRight,
  Fingerprint,
  ShieldCheck,
  Zap,
  Globe,
  Layers,
  Search,
  Filter,
  Loader2,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

// ─── Types ───

interface ReferendumListing {
  referendumIndex: number;
  title: string;
  track: number;
  trackName: string;
  state: string;
  proposer: string;
  createdAt: string;
  commentsCount: number;
}

// ─── Hero Section ───

function HeroSection() {
  const { isConnected } = useAccount();

  return (
    <div className="relative mb-12">
      <div className="text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full bg-polkadot-pink/10 border border-polkadot-pink/20">
          <Sparkles className="w-3.5 h-3.5 text-polkadot-pink" />
          <span className="text-xs font-medium text-polkadot-pink">
            AI + XCM Cross-Chain Voting on Polkadot Hub
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold mb-4 tracking-tight">
          Your{" "}
          <span className="gradient-text">AI Governance</span>
          <br />
          Co-Pilot for OpenGov
        </h1>

        <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto leading-relaxed">
          AI-powered analysis. Personalized recommendations. Cross-chain
          execution via XCM. GovMind analyzes proposals, matches them to{" "}
          <em>your</em> values, and relays votes to Polkadot Relay Chain.
        </p>

        {!isConnected ? (
          <div className="flex flex-col items-center gap-4">
            <ConnectButton />
            <p className="text-xs text-gray-500">
              Connect your wallet to get personalized recommendations
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/identity" className="btn-primary flex items-center gap-2">
              <Fingerprint className="w-4 h-4" />
              Set Up Identity
            </Link>
            <a href="#proposals" className="btn-secondary flex items-center gap-2">
              View Proposals
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>

      {/* Feature pills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12 max-w-3xl mx-auto">
        {[
          {
            icon: Brain,
            title: "AI Analysis",
            desc: "GPT-powered risk scoring & recommendations",
          },
          {
            icon: Fingerprint,
            title: "Personal Identity",
            desc: "6-axis governance preference profile",
          },
          {
            icon: Globe,
            title: "XCM Cross-Chain",
            desc: "Vote on Relay Chain directly from Hub EVM",
          },
          {
            icon: ShieldCheck,
            title: "On-Chain Proof",
            desc: "Every analysis stored immutably on-chain",
          },
        ].map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="flex items-start gap-3 p-4 rounded-xl bg-surface-1/50 border border-white/5"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-polkadot-pink/20 to-polkadot-purple/20 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-polkadot-pink" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Identity Banner ───

function IdentityBanner() {
  const { address, isConnected } = useAccount();

  const { data: hasIdentity } = useReadContract({
    address: ADDRESSES.identityVault,
    abi: IDENTITY_VAULT_ABI,
    functionName: "hasIdentity",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address },
  });

  if (!isConnected || hasIdentity) return null;

  return (
    <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-polkadot-pink/10 to-polkadot-purple/10 border border-polkadot-pink/20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-polkadot-pink/20 flex items-center justify-center flex-shrink-0">
          <Zap className="w-6 h-6 text-polkadot-pink" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white mb-1">
            Create your Governance Identity
          </h3>
          <p className="text-xs text-gray-400">
            Set your governance philosophy to get personalized AI recommendations
            that match your values. Without an identity, you&apos;ll see generic
            analysis.
          </p>
        </div>
        <Link href="/identity" className="btn-primary text-sm whitespace-nowrap">
          Create Identity
        </Link>
      </div>
    </div>
  );
}

// ─── XCM Banner ───

function XCMBanner() {
  const { data: relayEnabled } = useReadContract({
    address: ADDRESSES.xcmRelay,
    abi: XCM_RELAY_ABI,
    functionName: "relayEnabled",
  });

  const { data: totalRelayed } = useReadContract({
    address: ADDRESSES.xcmRelay,
    abi: XCM_RELAY_ABI,
    functionName: "totalRelayedVotes",
  });

  return (
    <div className="my-8 p-6 rounded-2xl bg-gradient-to-r from-polkadot-purple/10 via-surface-1 to-polkadot-pink/10 border border-polkadot-purple/20 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-48 h-48 bg-polkadot-purple/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-5 h-5 text-polkadot-purple" />
            <h3 className="text-lg font-bold text-white">
              XCM Cross-Chain Voting
            </h3>
            {relayEnabled && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot" />
                LIVE
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 max-w-lg">
            Vote on Polkadot Relay Chain referenda directly from Hub EVM.
            GovMind SCALE-encodes your vote, constructs an XCM V5 message,
            and relays it cross-chain via the XCM precompile.
          </p>
        </div>

        {/* Flow diagram */}
        <div className="flex items-center gap-2 text-xs shrink-0">
          <div className="px-3 py-2 rounded-lg bg-surface-2 border border-white/10 text-center">
            <Layers className="w-4 h-4 text-polkadot-pink mx-auto mb-1" />
            <span className="text-gray-300 font-medium">Hub EVM</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <ArrowRight className="w-4 h-4 text-polkadot-purple" />
            <span className="text-[9px] text-polkadot-purple font-medium">XCM V5</span>
          </div>
          <div className="px-3 py-2 rounded-lg bg-surface-2 border border-white/10 text-center">
            <Globe className="w-4 h-4 text-polkadot-purple mx-auto mb-1" />
            <span className="text-gray-300 font-medium">Relay Chain</span>
          </div>
          {totalRelayed !== undefined && Number(totalRelayed) > 0 && (
            <div className="ml-3 px-3 py-2 rounded-lg bg-polkadot-purple/10 border border-polkadot-purple/20 text-center">
              <p className="text-lg font-bold text-white">{totalRelayed.toString()}</p>
              <span className="text-gray-400">relayed</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Search & Filter Bar ───

interface FiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  track: string;
  onTrackChange: (v: string) => void;
  status: string;
  onStatusChange: (v: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

function SearchFilterBar({
  search, onSearchChange,
  track, onTrackChange,
  status, onStatusChange,
  onRefresh, loading,
}: FiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search proposals by title, ID, or proposer..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-2 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-polkadot-pink/40 transition-colors"
        />
      </div>

      {/* Track Filter */}
      <div className="relative">
        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
        <select
          value={track}
          onChange={(e) => onTrackChange(e.target.value)}
          className="appearance-none pl-9 pr-8 py-2.5 rounded-xl bg-surface-2 border border-white/10 text-sm text-white focus:outline-none focus:border-polkadot-pink/40 transition-colors cursor-pointer"
        >
          <option value="all">All Tracks</option>
          {Object.entries(TRACK_NAMES).map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
      </div>

      {/* Status Filter */}
      <div className="relative">
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="appearance-none pl-4 pr-8 py-2.5 rounded-xl bg-surface-2 border border-white/10 text-sm text-white focus:outline-none focus:border-polkadot-pink/40 transition-colors cursor-pointer"
        >
          <option value="all">All Status</option>
          <option value="votable">Votable (Deciding + Confirming)</option>
          <option value="Deciding">Deciding</option>
          <option value="Confirming">Confirming</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
          <option value="Cancelled">Cancelled</option>
          <option value="TimedOut">Timed Out</option>
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
      </div>

      {/* Refresh */}
      <button
        onClick={onRefresh}
        disabled={loading}
        className="px-3 py-2.5 rounded-xl bg-surface-2 border border-white/10 text-gray-400 hover:text-white hover:border-polkadot-pink/40 transition-colors disabled:opacity-50"
        title="Refresh proposals"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}

// ─── Proposals Section ───

function ProposalsSection() {
  const [referenda, setReferenda] = useState<ReferendumListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("votable");

  const LIMIT = 24;

  const fetchReferenda = useCallback(async (pageNum: number, append = false) => {
    setLoading(true);
    setError(null);
    try {
      // "votable" fetches both Deciding and Confirming in parallel
      const statuses = statusFilter === "votable"
        ? ["Deciding", "Confirming"]
        : [statusFilter];

      const fetches = statuses.map((s) => {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: String(LIMIT),
        });
        if (trackFilter !== "all") params.set("track", trackFilter);
        if (s !== "all") params.set("status", s);
        return fetch(`/api/referenda?${params}`).then((r) => r.json());
      });

      const results = await Promise.all(fetches);

      let items: ReferendumListing[] = [];
      let totalCount = 0;
      for (const data of results) {
        items = items.concat(data.referenda || []);
        totalCount += data.total || 0;
      }

      // Deduplicate by referendumIndex and sort newest first
      const seen = new Set<number>();
      items = items.filter((r) => {
        if (seen.has(r.referendumIndex)) return false;
        seen.add(r.referendumIndex);
        return true;
      }).sort((a, b) => b.referendumIndex - a.referendumIndex);

      if (append) {
        setReferenda((prev) => {
          const existing = new Set(prev.map((r) => r.referendumIndex));
          return [...prev, ...items.filter((r) => !existing.has(r.referendumIndex))];
        });
      } else {
        setReferenda(items);
      }
      setTotal(totalCount);
      setHasMore(items.length === LIMIT);
    } catch {
      setError("Failed to load proposals from Polkassembly. Using on-chain data only.");
      if (!append) setReferenda([]);
    } finally {
      setLoading(false);
    }
  }, [trackFilter, statusFilter]);

  // Fetch on mount and when filters change
  useEffect(() => {
    setPage(1);
    fetchReferenda(1);
  }, [fetchReferenda]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchReferenda(nextPage, true);
  };

  // On-chain analyzed count
  const { data: analysisCount } = useReadContract({
    address: ADDRESSES.aiOracle,
    abi: AI_ORACLE_ABI,
    functionName: "getAnalyzedReferendaCount",
  });
  const count = analysisCount ? Number(analysisCount) : 0;

  // Client-side search filter (Polkassembly doesn't have text search)
  const filtered = useMemo(() => {
    if (!search.trim()) return referenda;
    const q = search.toLowerCase();
    return referenda.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        String(r.referendumIndex).includes(q) ||
        r.proposer.toLowerCase().includes(q)
    );
  }, [referenda, search]);

  return (
    <div id="proposals" className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">Polkadot OpenGov Proposals</h2>
          <p className="text-sm text-gray-500 mt-1">
            Browse, search, and analyze referenda from Polkadot governance
          </p>
        </div>
        <div className="flex items-center gap-3">
          {total > 0 && (
            <span className="text-xs text-gray-500">
              {total} referenda
            </span>
          )}
          {count > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot" />
              {count} AI analyzed
            </span>
          )}
        </div>
      </div>

      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        track={trackFilter}
        onTrackChange={setTrackFilter}
        status={statusFilter}
        onStatusChange={setStatusFilter}
        onRefresh={() => { setPage(1); fetchReferenda(1); }}
        loading={loading}
      />

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((r) => (
          <ProposalCard
            key={r.referendumIndex}
            referendumIndex={r.referendumIndex}
            title={r.title}
            track={r.track}
            proposer={r.proposer}
            state={r.state}
            createdAt={r.createdAt}
          />
        ))}
      </div>

      {/* Loading state */}
      {loading && referenda.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Loader2 className="w-8 h-8 text-polkadot-pink mx-auto mb-4 animate-spin" />
          <p className="text-sm text-gray-400">Loading proposals from Polkassembly...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Brain className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-400 mb-2">
            {search ? "No matching proposals" : "No proposals found"}
          </h3>
          <p className="text-sm text-gray-500">
            {search
              ? "Try adjusting your search or filters"
              : "Check back later for new referenda"}
          </p>
        </div>
      )}

      {/* Load more */}
      {hasMore && filtered.length > 0 && !loading && (
        <div className="mt-8 text-center">
          <button
            onClick={loadMore}
            className="px-6 py-2.5 rounded-xl bg-surface-2 border border-white/10 text-sm text-gray-300 hover:text-white hover:border-polkadot-pink/40 transition-colors inline-flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>Load More Proposals</>
            )}
          </button>
        </div>
      )}

      {/* Loading more indicator */}
      {loading && referenda.length > 0 && (
        <div className="mt-6 text-center">
          <Loader2 className="w-5 h-5 text-polkadot-pink mx-auto animate-spin" />
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───

export default function Dashboard() {
  return (
    <div>
      <HeroSection />
      <StatsHero />
      <XCMBanner />
      <IdentityBanner />
      <ProposalsSection />
    </div>
  );
}
