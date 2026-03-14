"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useReadContract } from "wagmi";
import {
  ADDRESSES,
  AI_ORACLE_ABI,
  TRACK_NAMES,
} from "@/lib/contracts";
import { ProposalCard } from "@/components/ProposalCard";
import {
  Brain,
  Search,
  Filter,
  Loader2,
  ChevronDown,
  RefreshCw,
} from "lucide-react";

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

// ─── Proposals Page ───

export default function ProposalsPage() {
  const [referenda, setReferenda] = useState<ReferendumListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const [search, setSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const LIMIT = 24;
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const VOTABLE_STATES = new Set(["Deciding", "Confirming"]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const fetchReferenda = useCallback(async (pageNum: number, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const fetchLimit = statusFilter !== "all" ? LIMIT * 3 : LIMIT;
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: String(fetchLimit),
      });
      if (trackFilter !== "all") params.set("track", trackFilter);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());

      const res = await fetch(`/api/referenda?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      let items: ReferendumListing[] = data.referenda || [];

      if (statusFilter === "votable") {
        items = items.filter((r) => VOTABLE_STATES.has(r.state));
      } else if (statusFilter !== "all") {
        items = items.filter((r) => r.state === statusFilter);
      }

      if (append) {
        setReferenda((prev) => {
          const existing = new Set(prev.map((r) => r.referendumIndex));
          return [...prev, ...items.filter((r) => !existing.has(r.referendumIndex))];
        });
      } else {
        setReferenda(items);
      }
      setTotal(data.total || items.length);
      setHasMore(!data.directLookup && items.length > 0 && (data.referenda || []).length === fetchLimit);
    } catch {
      setError("Failed to load proposals from Subsquare. Using on-chain data only.");
      if (!append) setReferenda([]);
    } finally {
      setLoading(false);
    }
  }, [trackFilter, statusFilter, debouncedSearch]);

  useEffect(() => {
    setPage(1);
    fetchReferenda(1);
  }, [fetchReferenda]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchReferenda(nextPage, true);
  };

  const { data: analysisCount } = useReadContract({
    address: ADDRESSES.aiOracle,
    abi: AI_ORACLE_ABI,
    functionName: "getAnalyzedReferendaCount",
  });
  const count = analysisCount ? Number(analysisCount) : 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">OpenGov Proposals</h1>
        <p className="text-gray-400">
          Browse, search, and analyze Polkadot governance referenda. Get AI-powered
          insights and vote cross-chain.
        </p>
      </div>

      <div className="flex items-center gap-3 mb-6">
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
        {referenda.map((r) => (
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

      {loading && referenda.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card p-5 animate-pulse">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 w-12 bg-surface-3 rounded-md" />
                <div className="h-5 w-20 bg-surface-3 rounded-md" />
                <div className="h-5 w-16 bg-surface-3 rounded-md" />
              </div>
              <div className="h-4 w-3/4 bg-surface-3 rounded mb-2" />
              <div className="h-4 w-1/2 bg-surface-3 rounded mb-4" />
              <div className="flex items-center gap-3 mb-3">
                <div className="h-3 w-20 bg-surface-3 rounded" />
                <div className="h-3 w-12 bg-surface-3 rounded" />
              </div>
              <div className="h-8 w-full bg-surface-3 rounded-full mb-3" />
              <div className="h-1.5 w-full bg-surface-3 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {!loading && referenda.length === 0 && (
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

      {hasMore && referenda.length > 0 && !loading && (
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

      {loading && referenda.length > 0 && (
        <div className="mt-6 text-center">
          <Loader2 className="w-5 h-5 text-polkadot-pink mx-auto animate-spin" />
        </div>
      )}
    </div>
  );
}
