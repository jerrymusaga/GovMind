"use client";

import { useState, useEffect, useMemo } from "react";
import { useAccount, useReadContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  ADDRESSES,
  IDENTITY_VAULT_ABI,
  PREFERENCE_AXES,
  COLLECTIVES,
  Collective,
} from "@/lib/contracts";
import {
  Users,
  Fingerprint,
  CheckCircle2,
  ArrowRight,
  Brain,
  Target,
  Sparkles,
  Shield,
  TrendingUp,
  Zap,
  Lock,
  Server,
  Leaf,
  Rocket,
  ShieldCheck,
  Coins,
  UserPlus,
  LogOut,
  Crown,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

// ─── Icons Map ───

const COLLECTIVE_ICONS: Record<string, typeof Shield> = {
  Leaf,
  Rocket,
  ShieldCheck,
  Coins,
};

const AXIS_ICONS = [Shield, TrendingUp, Zap, Lock, Users, Server];

// ─── Alignment Scoring (mirrors AlignmentScorer PVM) ───

function computeAlignment(a: number[], b: number[]): number {
  if (a.length !== 6 || b.length !== 6) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < 6; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return Math.round((dot / (Math.sqrt(magA) * Math.sqrt(magB))) * 100);
}

// ─── Collective Card ───

function CollectiveCard({
  collective,
  userWeights,
  isJoined,
  onJoin,
  onLeave,
}: {
  collective: Collective;
  userWeights: number[] | null;
  isJoined: boolean;
  onJoin: (id: string) => void;
  onLeave: () => void;
}) {
  const Icon = COLLECTIVE_ICONS[collective.icon] || Shield;
  const alignment = userWeights
    ? computeAlignment(userWeights, collective.axes)
    : null;

  return (
    <div
      className={clsx(
        "p-6 rounded-2xl border transition-all",
        isJoined
          ? `bg-surface-1/80 ${collective.borderColor} border-2 shadow-lg`
          : "bg-surface-1/50 border-white/5 hover:border-white/10"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              "w-12 h-12 rounded-xl flex items-center justify-center",
              collective.bgColor
            )}
          >
            <Icon className={clsx("w-6 h-6", collective.color)} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              {collective.name}
            </h3>
            <p className="text-[11px] text-gray-500">
              {collective.memberCount} members
            </p>
          </div>
        </div>
        {alignment !== null && (
          <div
            className={clsx(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border",
              alignment >= 80
                ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                : alignment >= 60
                ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                : "text-red-400 bg-red-500/10 border-red-500/20"
            )}
          >
            <Target className="w-3 h-3" />
            {alignment}%
          </div>
        )}
      </div>

      {/* Joined badge */}
      {isJoined && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 mb-3 w-fit">
          <Crown className="w-3 h-3" />
          Your Collective
        </div>
      )}

      {/* Description */}
      <p className="text-xs text-gray-400 leading-relaxed mb-4">
        {collective.description}
      </p>

      {/* Focus areas */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {collective.focusAreas.map((area) => (
          <span
            key={area}
            className={clsx(
              "px-2 py-0.5 rounded-md text-[10px] font-medium border",
              collective.bgColor,
              collective.borderColor,
              collective.color
            )}
          >
            {area}
          </span>
        ))}
      </div>

      {/* Axes comparison */}
      {userWeights && (
        <div className="mb-4 p-3 rounded-xl bg-surface-2/30 border border-white/5">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
            Governance Profile Comparison
          </p>
          <div className="space-y-2">
            {PREFERENCE_AXES.map((axis, i) => {
              const AxisIcon = AXIS_ICONS[i];
              return (
                <div key={axis.id} className="flex items-center gap-2">
                  <AxisIcon
                    className="w-3 h-3 shrink-0"
                    style={{ color: axis.color }}
                  />
                  <span className="text-[10px] text-gray-500 w-16 shrink-0">
                    {axis.name.split(" ").pop()}
                  </span>
                  <div className="flex-1 flex items-center gap-1">
                    <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full opacity-50"
                        style={{
                          width: `${userWeights[i]}%`,
                          background: axis.color,
                        }}
                      />
                    </div>
                    <span className="text-[9px] text-gray-600 w-5 text-right">
                      {userWeights[i]}
                    </span>
                  </div>
                  <div className="flex-1 flex items-center gap-1">
                    <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${collective.axes[i]}%`,
                          background: axis.color,
                        }}
                      />
                    </div>
                    <span className="text-[9px] text-gray-600 w-5 text-right">
                      {collective.axes[i]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-2 text-[9px] text-gray-600">
            <span>Your Profile</span>
            <span>Collective Profile</span>
          </div>
        </div>
      )}

      {/* Philosophy */}
      <p className="text-[11px] text-gray-500 italic mb-4">
        &ldquo;{collective.philosophy}&rdquo;
      </p>

      {/* Join/Leave button */}
      {isJoined ? (
        <button
          onClick={onLeave}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-surface-2 border border-white/10 text-gray-400 hover:text-red-400 hover:border-red-500/20 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          Leave Collective
        </button>
      ) : (
        <button
          onClick={() => onJoin(collective.id)}
          className={clsx(
            "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium border transition-all hover:scale-[1.02]",
            collective.bgColor,
            collective.borderColor,
            collective.color
          )}
        >
          <UserPlus className="w-3.5 h-3.5" />
          Join Collective
        </button>
      )}
    </div>
  );
}

// ─── Collectives Page ───

export default function CollectivesPage() {
  const { address, isConnected } = useAccount();
  const [joinedCollective, setJoinedCollective] = useState<string | null>(null);

  // Load joined collective from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("govmind_collective");
    if (stored) {
      try {
        const { collectiveId } = JSON.parse(stored);
        setJoinedCollective(collectiveId);
      } catch {}
    }
  }, []);

  const handleJoin = (id: string) => {
    setJoinedCollective(id);
    localStorage.setItem(
      "govmind_collective",
      JSON.stringify({ collectiveId: id, joinedAt: Date.now() })
    );
  };

  const handleLeave = () => {
    setJoinedCollective(null);
    localStorage.removeItem("govmind_collective");
  };

  // Read user identity
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

  // Sort collectives by alignment
  const sortedCollectives = useMemo(() => {
    if (!userWeights) return COLLECTIVES;
    return [...COLLECTIVES].sort((a, b) => {
      const alignA = computeAlignment(userWeights, a.axes);
      const alignB = computeAlignment(userWeights, b.axes);
      return alignB - alignA;
    });
  }, [userWeights]);

  const activeCollective = COLLECTIVES.find((c) => c.id === joinedCollective);

  if (!isConnected) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-polkadot-purple/20 to-polkadot-pink/20 flex items-center justify-center">
          <Users className="w-10 h-10 text-polkadot-purple" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">
          AI Voting Collectives
        </h1>
        <p className="text-gray-400 mb-8">
          Connect your wallet to join a governance collective and vote with your tribe
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
              AI Voting Collectives
            </h1>
            <p className="text-sm text-gray-400">
              Join a governance tribe aligned with your values &mdash; vote with one click
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
                  Set up your 6-axis governance profile so GovMind can match you
                  to the right collective. Without an identity, alignment scores
                  won&apos;t be shown.
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
                  Identity loaded &mdash; collectives are ranked by alignment with your profile
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

      {/* How it works */}
      <div className="p-4 rounded-xl bg-surface-1/30 border border-white/5 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-polkadot-pink" />
          <span className="text-xs font-semibold text-white">
            How AI Voting Collectives Work
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
          <span className="px-2 py-1 rounded-lg bg-surface-2 border border-white/5">
            Choose a Collective
          </span>
          <ArrowRight className="w-3 h-3 text-gray-600" />
          <span className="px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            AI Analyzes Proposals
          </span>
          <ArrowRight className="w-3 h-3 text-gray-600" />
          <span className="px-2 py-1 rounded-lg bg-surface-2 border border-white/5">
            Collective Recommendation
          </span>
          <ArrowRight className="w-3 h-3 text-gray-600" />
          <span className="px-2 py-1 rounded-lg bg-polkadot-pink/10 border border-polkadot-pink/20 text-polkadot-pink">
            One-Click Vote via XCM
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Collective cards */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedCollectives.map((collective) => (
            <CollectiveCard
              key={collective.id}
              collective={collective}
              userWeights={userWeights}
              isJoined={joinedCollective === collective.id}
              onJoin={handleJoin}
              onLeave={handleLeave}
            />
          ))}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Active Collective */}
          <div className="p-5 rounded-2xl bg-surface-1/50 border border-white/5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Crown className="w-4 h-4 text-polkadot-pink" />
              Your Collective
            </h3>
            {activeCollective ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {(() => {
                    const CIcon = COLLECTIVE_ICONS[activeCollective.icon] || Shield;
                    return (
                      <CIcon
                        className={clsx("w-4 h-4", activeCollective.color)}
                      />
                    );
                  })()}
                  <span className={clsx("text-sm font-medium", activeCollective.color)}>
                    {activeCollective.name}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  You&apos;ll see this collective&apos;s recommendation on every
                  proposal page, with a one-click vote button.
                </p>
                <Link
                  href="/proposals"
                  className="inline-flex items-center gap-1.5 text-xs text-polkadot-pink hover:underline"
                >
                  Browse proposals <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                Join a collective to get AI-powered voting recommendations
                aligned with a shared governance philosophy.
              </p>
            )}
          </div>

          {/* About */}
          <div className="p-5 rounded-2xl bg-surface-1/50 border border-white/5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Brain className="w-4 h-4 text-polkadot-pink" />
              About Collectives
            </h3>
            <div className="space-y-3 text-xs text-gray-400">
              <p>
                AI Voting Collectives are like <strong className="text-gray-300">governance tribes</strong> &mdash;
                groups that share a philosophy on how Polkadot should be governed.
              </p>
              <p>
                Each collective has a{" "}
                <strong className="text-cyan-400">6-axis governance profile</strong>{" "}
                that the AI uses to generate recommendations. When you join a
                collective, proposals are scored against its values.
              </p>
              <p>
                Your tokens stay in your wallet. You still decide whether to
                vote &mdash; the collective just tells you what it would do.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-polkadot-pink/5 to-polkadot-purple/5 border border-polkadot-pink/10">
            <h3 className="text-sm font-semibold text-white mb-2">
              Prefer Individual Voting?
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              You can always vote based on your personal governance identity
              instead. Create or update your identity to get personalized
              recommendations.
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
    </div>
  );
}
