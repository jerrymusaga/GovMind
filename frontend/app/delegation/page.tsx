"use client";

import { useState, useMemo } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  ADDRESSES,
  IDENTITY_VAULT_ABI,
  PREFERENCE_AXES,
  TRACK_NAMES,
} from "@/lib/contracts";
import {
  Users,
  Fingerprint,
  CheckCircle2,
  Loader2,
  Shield,
  TrendingUp,
  Zap,
  Lock,
  Server,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Brain,
  Target,
  ToggleLeft,
  Sparkles,
  Crown,
  Award,
  Star,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import DelegationChatAgent from "@/components/DelegationChatAgent";

// ─── Types ───

interface DelegateProfile {
  address: string;
  name: string;
  identity: number[];
  tracks: number[];
  totalVotes: number;
  alignmentScore?: number;
  description: string;
  badge: string;
}

// ─── Mock Delegate Data (would be fetched from on-chain/indexer in production) ───

const MOCK_DELEGATES: DelegateProfile[] = [
  {
    address: "0x1234567890abcdef1234567890abcdef12345678",
    name: "PolkadotPhilosopher",
    identity: [80, 30, 70, 60, 90, 50],
    tracks: [0, 1, 11, 30, 31, 32, 33, 34],
    totalVotes: 142,
    description: "Community-first delegate focused on decentralization and grassroots proposals. Active voter across treasury and governance tracks.",
    badge: "Community Champion",
  },
  {
    address: "0xabcdef1234567890abcdef1234567890abcdef12",
    name: "TechValidator",
    identity: [40, 70, 95, 20, 30, 85],
    tracks: [0, 2, 10, 12, 14],
    totalVotes: 89,
    description: "Technical delegate specializing in runtime upgrades, staking operations, and infrastructure funding. Strong focus on protocol security.",
    badge: "Technical Expert",
  },
  {
    address: "0x7890abcdef1234567890abcdef1234567890abcd",
    name: "TreasuryHawk",
    identity: [90, 20, 50, 80, 40, 60],
    tracks: [11, 30, 31, 32, 33, 34],
    totalVotes: 203,
    description: "Conservative treasury delegate. Scrutinizes every spend proposal for value delivery and ROI. Advocates for fiscal responsibility.",
    badge: "Treasury Guardian",
  },
  {
    address: "0xdef1234567890abcdef1234567890abcdef123456",
    name: "EcosystemBuilder",
    identity: [30, 90, 60, 30, 70, 80],
    tracks: [11, 14, 32, 33, 34],
    totalVotes: 167,
    description: "Growth-oriented delegate backing ecosystem expansion, tooling, and developer onboarding initiatives.",
    badge: "Growth Catalyst",
  },
  {
    address: "0x567890abcdef1234567890abcdef1234567890ab",
    name: "SecurityFirst",
    identity: [70, 40, 85, 90, 25, 75],
    tracks: [0, 2, 10, 20, 21],
    totalVotes: 56,
    description: "Security-focused delegate. Votes on root-level referenda, runtime upgrades, and cancellation/kill tracks. Prioritizes chain safety above all.",
    badge: "Security Sentinel",
  },
];

const AXIS_ICONS = [Shield, TrendingUp, Zap, Lock, Users, Server];

const BADGE_COLORS: Record<string, string> = {
  "Community Champion": "text-pink-400 bg-pink-500/10 border-pink-500/20",
  "Technical Expert": "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  "Treasury Guardian": "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "Growth Catalyst": "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  "Security Sentinel": "text-purple-400 bg-purple-500/10 border-purple-500/20",
};

const BADGE_ICONS: Record<string, typeof Crown> = {
  "Community Champion": Crown,
  "Technical Expert": Zap,
  "Treasury Guardian": Shield,
  "Growth Catalyst": TrendingUp,
  "Security Sentinel": Lock,
};

// ─── Alignment Scoring (mirrors AlignmentScorer PVM contract logic) ───

function computeAlignment(userWeights: number[], delegateWeights: number[]): number {
  if (userWeights.length !== 6 || delegateWeights.length !== 6) return 0;

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < 6; i++) {
    dotProduct += userWeights[i] * delegateWeights[i];
    magA += userWeights[i] * userWeights[i];
    magB += delegateWeights[i] * delegateWeights[i];
  }

  if (magA === 0 || magB === 0) return 0;
  const cosine = dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
  return Math.round(cosine * 100);
}

// ─── Delegate Card ───

function DelegateCard({
  delegate,
  userWeights,
  onDelegate,
  isDelegating,
  expandedTrack,
  onToggleTrack,
}: {
  delegate: DelegateProfile;
  userWeights: number[] | null;
  onDelegate: (address: string, track: number) => void;
  isDelegating: boolean;
  expandedTrack: string | null;
  onToggleTrack: (id: string) => void;
}) {
  const alignment = userWeights
    ? computeAlignment(userWeights, delegate.identity)
    : null;

  const cardId = delegate.address;
  const isExpanded = expandedTrack === cardId;
  const BadgeIcon = BADGE_ICONS[delegate.badge] || Star;
  const badgeColor = BADGE_COLORS[delegate.badge] || "text-gray-400 bg-gray-500/10 border-gray-500/20";

  return (
    <div className="p-5 rounded-2xl bg-surface-1/50 border border-white/5 hover:border-white/10 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-polkadot-pink/20 to-polkadot-purple/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-polkadot-pink" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{delegate.name}</h3>
            <p className="text-[11px] text-gray-500 font-mono">
              {delegate.address.slice(0, 6)}...{delegate.address.slice(-4)}
            </p>
          </div>
        </div>
        {alignment !== null && (
          <div className={clsx(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border",
            alignment >= 80
              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              : alignment >= 60
              ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
              : "text-red-400 bg-red-500/10 border-red-500/20"
          )}>
            <Target className="w-3 h-3" />
            {alignment}%
          </div>
        )}
      </div>

      {/* Badge */}
      <div className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border mb-3", badgeColor)}>
        <BadgeIcon className="w-3 h-3" />
        {delegate.badge}
      </div>

      {/* Description */}
      <p className="text-xs text-gray-400 leading-relaxed mb-4">{delegate.description}</p>

      {/* Mini identity comparison */}
      {userWeights && (
        <div className="grid grid-cols-6 gap-1 mb-4">
          {PREFERENCE_AXES.map((axis, i) => {
            const diff = Math.abs(userWeights[i] - delegate.identity[i]);
            return (
              <div key={axis.id} className="text-center">
                <div
                  className="w-full h-1.5 rounded-full mb-1"
                  style={{
                    background: `linear-gradient(90deg, ${axis.color}40, ${axis.color})`,
                    opacity: 1 - diff / 100,
                  }}
                />
                <span className="text-[9px] text-gray-600">
                  {axis.name.split(" ").pop()?.slice(0, 4)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-4 text-[11px] text-gray-500">
        <span>{delegate.totalVotes} votes cast</span>
        <span>{delegate.tracks.length} tracks</span>
      </div>

      {/* Expand tracks */}
      <button
        onClick={() => onToggleTrack(cardId)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-surface-2/50 border border-white/5 text-xs text-gray-400 hover:text-white transition-colors"
      >
        <span>Delegate on specific tracks</span>
        {isExpanded ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {delegate.tracks.map((trackId) => (
            <div
              key={trackId}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-2/30 border border-white/5"
            >
              <div>
                <span className="text-xs text-white font-medium">
                  {TRACK_NAMES[trackId] || `Track ${trackId}`}
                </span>
                <span className="text-[10px] text-gray-600 ml-2">#{trackId}</span>
              </div>
              <button
                onClick={() => onDelegate(delegate.address, trackId)}
                disabled={isDelegating}
                className="px-3 py-1 rounded-lg bg-polkadot-pink/10 border border-polkadot-pink/20 text-[11px] text-polkadot-pink font-medium hover:bg-polkadot-pink/20 transition-colors disabled:opacity-50"
              >
                {isDelegating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  "Delegate"
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Active Delegations ───

function ActiveDelegations() {
  const trackIds = [0, 1, 2, 10, 11, 14, 30, 31, 32, 33, 34];

  return (
    <div className="p-5 rounded-2xl bg-surface-1/50 border border-white/5">
      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <Award className="w-4 h-4 text-polkadot-purple" />
        Your Active Delegations
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        Delegations are managed on-chain via the IdentityVault contract.
        Configure which tracks you want to delegate and set limits per track.
      </p>
      <div className="space-y-2">
        {trackIds.slice(0, 5).map((trackId) => (
          <div
            key={trackId}
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-2/30 border border-white/5"
          >
            <span className="text-xs text-gray-400">
              {TRACK_NAMES[trackId] || `Track ${trackId}`}
            </span>
            <span className="text-[10px] text-gray-600 flex items-center gap-1">
              <ToggleLeft className="w-3 h-3" />
              Not configured
            </span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-600 mt-3">
        Delegate to a community member above to activate per-track delegation.
      </p>
    </div>
  );
}

// ─── Delegation Page ───

export default function DelegationPage() {
  const { address, isConnected } = useAccount();
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"alignment" | "votes">("alignment");
  const [trackFilter, setTrackFilter] = useState<string>("all");

  // Read user's identity weights
  const { data: hasIdentity } = useReadContract({
    address: ADDRESSES.identityVault,
    abi: IDENTITY_VAULT_ABI,
    functionName: "hasIdentity",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address },
  });

  const { data: existingWeights } = useReadContract({
    address: ADDRESSES.identityVault,
    abi: IDENTITY_VAULT_ABI,
    functionName: "getPreferenceWeights",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address && !!hasIdentity },
  });

  const userWeights = existingWeights
    ? Array.from(existingWeights).map(Number)
    : null;

  // Delegation write
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const handleDelegate = (_delegateAddress: string, trackId: number) => {
    writeContract({
      address: ADDRESSES.identityVault,
      abi: IDENTITY_VAULT_ABI,
      functionName: "configureTrackDelegation",
      args: [trackId, true, BigInt(0), 1],
    });
  };

  // Score and sort delegates
  const scoredDelegates = useMemo(() => {
    let delegates = MOCK_DELEGATES.map((d) => ({
      ...d,
      alignmentScore: userWeights
        ? computeAlignment(userWeights, d.identity)
        : undefined,
    }));

    // Filter by track
    if (trackFilter !== "all") {
      const tid = Number(trackFilter);
      delegates = delegates.filter((d) => d.tracks.includes(tid));
    }

    // Sort
    if (sortBy === "alignment" && userWeights) {
      delegates.sort(
        (a, b) => (b.alignmentScore || 0) - (a.alignmentScore || 0)
      );
    } else {
      delegates.sort((a, b) => b.totalVotes - a.totalVotes);
    }

    return delegates;
  }, [userWeights, sortBy, trackFilter]);

  if (!isConnected) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-polkadot-purple/20 to-polkadot-pink/20 flex items-center justify-center">
          <Users className="w-10 h-10 text-polkadot-purple" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">
          AI-Powered Delegation
        </h1>
        <p className="text-gray-400 mb-8">
          Connect your wallet to find delegates aligned with your governance
          identity
        </p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-polkadot-purple to-polkadot-pink flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              AI-Powered Delegation
            </h1>
            <p className="text-sm text-gray-400">
              Find delegates whose governance philosophy aligns with yours
            </p>
          </div>
        </div>

        {/* Identity status */}
        {hasIdentity === false && (
          <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-start gap-3">
              <Fingerprint className="w-5 h-5 text-amber-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-400">
                  Create your Governance Identity first
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Set up your 6-axis governance profile so GovMind can score
                  delegates based on your values. Without an identity, delegates
                  are sorted by vote count only.
                </p>
                <Link
                  href="/identity"
                  className="inline-flex items-center gap-1.5 mt-3 text-xs text-polkadot-pink hover:underline"
                >
                  Create Identity <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {hasIdentity && userWeights && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <p className="text-xs text-emerald-400">
                  Identity loaded — delegates are ranked by alignment with your governance profile
                </p>
              </div>
              <Link
                href="/identity"
                className="text-[10px] text-emerald-400/70 hover:text-emerald-400 hover:underline shrink-0 ml-3"
              >
                Update identity
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-6 gap-2">
              {PREFERENCE_AXES.map((axis, i) => {
                const Icon = AXIS_ICONS[i];
                return (
                  <div key={axis.id} className="text-center">
                    <Icon
                      className="w-3.5 h-3.5 mx-auto mb-1"
                      style={{ color: axis.color }}
                    />
                    <div
                      className="text-xs font-bold"
                      style={{ color: axis.color }}
                    >
                      {userWeights[i]}
                    </div>
                    <div className="text-[9px] text-gray-600">
                      {axis.name.split(" ").pop()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Success notification */}
      {isSuccess && (
        <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-emerald-400">
            Track delegation configured on-chain
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-1 p-1 bg-surface-2 rounded-xl">
          <button
            onClick={() => setSortBy("alignment")}
            className={clsx(
              "px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
              sortBy === "alignment"
                ? "bg-surface-4 text-white shadow-sm"
                : "text-gray-500 hover:text-white"
            )}
          >
            <Target className="w-3 h-3" />
            By Alignment
          </button>
          <button
            onClick={() => setSortBy("votes")}
            className={clsx(
              "px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
              sortBy === "votes"
                ? "bg-surface-4 text-white shadow-sm"
                : "text-gray-500 hover:text-white"
            )}
          >
            <Award className="w-3 h-3" />
            By Activity
          </button>
        </div>

        <div className="relative">
          <select
            value={trackFilter}
            onChange={(e) => { setTrackFilter(e.target.value); setExpandedCard(null); }}
            className="appearance-none pl-4 pr-8 py-2.5 rounded-xl bg-surface-2 border border-white/10 text-xs text-white focus:outline-none focus:border-polkadot-pink/40 transition-colors cursor-pointer"
          >
            <option value="all">All Tracks</option>
            {Object.entries(TRACK_NAMES).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {/* How it works banner */}
      <div className="p-4 rounded-xl bg-surface-1/30 border border-white/5 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-polkadot-pink" />
          <span className="text-xs font-semibold text-white">
            How AI Delegation Matching Works
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
          <span className="px-2 py-1 rounded-lg bg-surface-2 border border-white/5">
            Your 6-Axis Identity
          </span>
          <ArrowRight className="w-3 h-3 text-gray-600" />
          <span className="px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            AlignmentScorer PVM (Rust)
          </span>
          <ArrowRight className="w-3 h-3 text-gray-600" />
          <span className="px-2 py-1 rounded-lg bg-surface-2 border border-white/5">
            Cosine Similarity Score
          </span>
          <ArrowRight className="w-3 h-3 text-gray-600" />
          <span className="px-2 py-1 rounded-lg bg-polkadot-pink/10 border border-polkadot-pink/20 text-polkadot-pink">
            Ranked Delegates
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Delegates list */}
        <div className="lg:col-span-2 space-y-4">
          {scoredDelegates.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-surface-1/50 border border-white/5">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-400 mb-2">
                No delegates found
              </h3>
              <p className="text-sm text-gray-500">
                Try adjusting your track filter
              </p>
            </div>
          ) : (
            scoredDelegates.map((delegate) => (
              <DelegateCard
                key={delegate.address}
                delegate={delegate}
                userWeights={userWeights}
                onDelegate={handleDelegate}
                isDelegating={isPending || isConfirming}
                expandedTrack={expandedCard}
                onToggleTrack={setExpandedCard}
              />
            ))
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <ActiveDelegations />

          <div className="p-5 rounded-2xl bg-surface-1/50 border border-white/5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Brain className="w-4 h-4 text-polkadot-pink" />
              About Delegation
            </h3>
            <div className="space-y-3 text-xs text-gray-400">
              <p>
                In Polkadot OpenGov, you can delegate your voting power to
                trusted community members — <strong className="text-gray-300">per track</strong>.
              </p>
              <p>
                GovMind uses the <strong className="text-cyan-400">AlignmentScorer PVM contract</strong> to
                compute cosine similarity between your governance identity and
                each delegate&apos;s voting profile, giving you a personalized
                alignment score.
              </p>
              <p>
                Delegation is executed on-chain via{" "}
                <code className="text-[10px] bg-surface-3 px-1.5 py-0.5 rounded">
                  convictionVoting.delegate
                </code>{" "}
                relayed through XCM to the relay chain.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-polkadot-pink/5 to-polkadot-purple/5 border border-polkadot-pink/10">
            <h3 className="text-sm font-semibold text-white mb-2">
              Become a Delegate
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              Create your governance identity and start voting consistently.
              GovMind will automatically surface you as a delegate candidate to
              aligned voters.
            </p>
            <Link
              href="/identity"
              className="inline-flex items-center gap-1.5 text-xs text-polkadot-pink hover:underline"
            >
              Set up identity <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      <DelegationChatAgent
        userIdentity={
          userWeights
            ? { axes: userWeights, riskTolerance: 50 }
            : null
        }
        delegates={scoredDelegates.map((d) => ({
          name: d.name,
          badge: d.badge,
          identity: d.identity,
          tracks: d.tracks,
          totalVotes: d.totalVotes,
          alignmentScore: d.alignmentScore,
          description: d.description,
        }))}
        hasIdentity={!!hasIdentity}
      />
    </div>
  );
}
