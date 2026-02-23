"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther } from "viem";
import {
  ADDRESSES,
  AI_ORACLE_ABI,
  GOVMIND_CORE_ABI,
  IDENTITY_VAULT_ABI,
  TRACK_NAMES,
  CATEGORY_NAMES,
  PREFERENCE_AXES,
} from "@/lib/contracts";
import {
  ArrowLeft,
  Brain,
  Shield,
  TrendingUp,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Fingerprint,
  Zap,
  BarChart3,
  Clock,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

const KNOWN_TITLES: Record<number, string> = {
  1836: "Polkadot-API 2026 Development Funding",
  1831: "Polkadot Staking Dashboard: Protocol-Aligned Development",
  1772: "Staking Dashboard: Improvements & DeFi Integration",
  1766: "Polkawatch Decentralization Analytics Maintenance",
  1703: "Polkadot Staking Dashboard: Sept 2025 - March 2026",
};

function RecommendationDisplay({
  value,
  confidence,
  label,
}: {
  value: number;
  confidence: number;
  label: string;
}) {
  const config = {
    1: {
      icon: ThumbsUp,
      text: "Aye",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      ring: "ring-emerald-500/20",
    },
    "-1": {
      icon: ThumbsDown,
      text: "Nay",
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      ring: "ring-red-500/20",
    },
    0: {
      icon: Minus,
      text: "Abstain",
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      ring: "ring-amber-500/20",
    },
  }[value] ?? {
    icon: Minus,
    text: "Abstain",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    ring: "ring-amber-500/20",
  };

  const Icon = config.icon;

  return (
    <div
      className={clsx(
        "rounded-2xl p-6 border ring-1",
        config.bg,
        config.border,
        config.ring
      )}
    >
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-3 font-medium">
        {label}
      </p>
      <div className="flex items-center gap-4">
        <div
          className={clsx(
            "w-14 h-14 rounded-xl flex items-center justify-center",
            config.bg
          )}
        >
          <Icon className={clsx("w-7 h-7", config.color)} />
        </div>
        <div>
          <p className={clsx("text-3xl font-bold", config.color)}>
            {config.text}
          </p>
          <p className="text-sm text-gray-400 mt-0.5">
            {confidence}% confidence
          </p>
        </div>
      </div>
    </div>
  );
}

function AlignmentBar({ score }: { score: number }) {
  const color =
    score >= 60
      ? { bar: "bg-emerald-500", text: "text-emerald-400", label: "Aligned" }
      : score >= 40
      ? { bar: "bg-amber-500", text: "text-amber-400", label: "Neutral" }
      : { bar: "bg-red-500", text: "text-red-400", label: "Opposed" };

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-white flex items-center gap-2">
          <Fingerprint className="w-4 h-4 text-polkadot-pink" />
          Alignment Score
        </p>
        <span className={clsx("text-xs font-semibold", color.text)}>
          {color.label}
        </span>
      </div>
      <div className="relative h-3 bg-surface-3 rounded-full overflow-hidden mb-2">
        {/* Gradient background showing the spectrum */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 via-amber-500/20 to-emerald-500/20" />
        {/* Score indicator */}
        <div
          className={clsx(
            "absolute top-0 h-full rounded-full transition-all duration-700",
            color.bar
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="flex justify-between">
        <span className="text-[10px] text-gray-600">Opposed (0)</span>
        <span className={clsx("text-sm font-bold", color.text)}>{score}/100</span>
        <span className="text-[10px] text-gray-600">Aligned (100)</span>
      </div>
    </div>
  );
}

function RiskGauge({ score }: { score: number }) {
  const angle = (score / 100) * 180 - 90;
  const color = score <= 30 ? "#10B981" : score <= 60 ? "#F59E0B" : "#EF4444";
  const label = score <= 30 ? "Low Risk" : score <= 60 ? "Medium Risk" : "High Risk";

  return (
    <div className="glass-card p-5">
      <p className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" style={{ color }} />
        Risk Assessment
      </p>
      <div className="flex justify-center mb-2">
        <svg width="140" height="80" viewBox="0 0 140 80">
          {/* Background arc */}
          <path
            d="M 10 70 A 60 60 0 0 1 130 70"
            fill="none"
            stroke="#232333"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Colored arc */}
          <path
            d="M 10 70 A 60 60 0 0 1 130 70"
            fill="none"
            stroke="url(#riskGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 188} 188`}
          />
          <defs>
            <linearGradient id="riskGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#EF4444" />
            </linearGradient>
          </defs>
          {/* Needle */}
          <line
            x1="70"
            y1="70"
            x2={70 + 45 * Math.cos((angle * Math.PI) / 180)}
            y2={70 + 45 * Math.sin((angle * Math.PI) / 180)}
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="70" cy="70" r="4" fill={color} />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold" style={{ color }}>
          {score}/100
        </p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

function VotePanel({ referendumIndex }: { referendumIndex: number }) {
  const { address, isConnected } = useAccount();
  const [conviction, setConviction] = useState(1);
  const [amount, setAmount] = useState("10");

  const { data: alreadyVoted } = useReadContract({
    address: ADDRESSES.govMindCore,
    abi: GOVMIND_CORE_ABI,
    functionName: "hasVoted",
    args: address ? [address, BigInt(referendumIndex)] : undefined,
    query: { enabled: isConnected && !!address },
  });

  const { writeContract: castVote, data: voteTxHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: voteTxHash,
  });

  const handleVote = (aye: boolean) => {
    castVote({
      address: ADDRESSES.govMindCore,
      abi: GOVMIND_CORE_ABI,
      functionName: "vote",
      args: [
        BigInt(referendumIndex),
        aye,
        BigInt(conviction),
        parseEther(amount || "0"),
      ],
    });
  };

  if (!isConnected) return null;

  if (alreadyVoted) {
    return (
      <div className="glass-card p-5">
        <div className="flex items-center gap-3 text-emerald-400">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-semibold">You have voted on this proposal</span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <Zap className="w-4 h-4 text-polkadot-pink" />
        Cast Your Vote
      </h3>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">Amount (PAS)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input-field"
            placeholder="10"
            min="0"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">
            Conviction ({conviction}x)
          </label>
          <input
            type="range"
            min="0"
            max="6"
            value={conviction}
            onChange={(e) => setConviction(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-gray-600">0.1x (no lock)</span>
            <span className="text-[10px] text-gray-600">6x (896 days)</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleVote(true)}
            disabled={isPending || isConfirming}
            className="py-3 rounded-xl font-semibold text-sm bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPending || isConfirming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ThumbsUp className="w-4 h-4" />
            )}
            Vote Aye
          </button>
          <button
            onClick={() => handleVote(false)}
            disabled={isPending || isConfirming}
            className="py-3 rounded-xl font-semibold text-sm bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPending || isConfirming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ThumbsDown className="w-4 h-4" />
            )}
            Vote Nay
          </button>
        </div>

        {isSuccess && (
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Vote recorded on-chain!
          </div>
        )}
      </div>
    </div>
  );
}

function GovMindStats({ referendumIndex }: { referendumIndex: number }) {
  const { data: stats } = useReadContract({
    address: ADDRESSES.govMindCore,
    abi: GOVMIND_CORE_ABI,
    functionName: "getReferendumStats",
    args: [BigInt(referendumIndex)],
  });

  const totalAye = stats ? Number(stats[0]) : 0;
  const totalNay = stats ? Number(stats[1]) : 0;
  const voterCount = stats ? Number(stats[2]) : 0;
  const aiVoterCount = stats ? Number(stats[3]) : 0;
  const total = totalAye + totalNay || 1;

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-polkadot-purple" />
        GovMind Votes
      </h3>
      <div className="space-y-3">
        {/* Aye/Nay bar */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-emerald-400">Aye</span>
            <span className="text-red-400">Nay</span>
          </div>
          <div className="h-2.5 bg-surface-3 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 rounded-l-full transition-all duration-500"
              style={{ width: `${(totalAye / total) * 100}%` }}
            />
            <div
              className="bg-red-500 rounded-r-full transition-all duration-500"
              style={{ width: `${(totalNay / total) * 100}%` }}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="p-3 rounded-xl bg-surface-2">
            <p className="text-lg font-bold text-white">{voterCount}</p>
            <p className="text-[10px] text-gray-500 uppercase">Voters</p>
          </div>
          <div className="p-3 rounded-xl bg-surface-2">
            <p className="text-lg font-bold text-polkadot-pink">{aiVoterCount}</p>
            <p className="text-[10px] text-gray-500 uppercase">AI Votes</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProposalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const referendumIndex = Number(params.id);
  const { address, isConnected } = useAccount();

  const { data: analysis } = useReadContract({
    address: ADDRESSES.aiOracle,
    abi: AI_ORACLE_ABI,
    functionName: "getAnalysis",
    args: [BigInt(referendumIndex)],
  });

  const { data: insight } = useReadContract({
    address: ADDRESSES.govMindCore,
    abi: GOVMIND_CORE_ABI,
    functionName: "getPersonalizedInsight",
    args: isConnected && address ? [address, BigInt(referendumIndex)] : undefined,
    query: { enabled: isConnected && !!address },
  });

  const { data: hasIdentity } = useReadContract({
    address: ADDRESSES.identityVault,
    abi: IDENTITY_VAULT_ABI,
    functionName: "hasIdentity",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address },
  });

  const hasAnalysis = analysis?.exists ?? false;
  const trackNum = analysis ? Number(analysis.track) : 0;
  const categoryId = analysis ? Number(analysis.categoryId) : 0;
  const baseRec = analysis ? Number(analysis.recommendation) : 0;
  const baseConf = analysis ? Number(analysis.confidence) : 0;
  const riskScore = analysis ? Number(analysis.riskScore) : 0;

  const persRec = insight ? Number(insight[0]) : baseRec;
  const persConf = insight ? Number(insight[1]) : baseConf;
  const alignment = insight ? Number(insight[3]) : 50;

  const title = KNOWN_TITLES[referendumIndex] || `Referendum #${referendumIndex}`;
  const analyzedAt = analysis?.analyzedAt
    ? new Date(Number(analysis.analyzedAt) * 1000).toLocaleDateString()
    : null;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>

      {/* Proposal Header */}
      <div className="glass-card p-6 mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="px-3 py-1 text-xs font-semibold bg-polkadot-pink/10 text-polkadot-pink rounded-lg">
            #{referendumIndex}
          </span>
          <span className="px-3 py-1 text-xs font-medium text-gray-400 bg-surface-3 rounded-lg">
            {TRACK_NAMES[trackNum] || `Track ${trackNum}`}
          </span>
          {hasAnalysis && (
            <span className="px-3 py-1 text-xs font-medium text-polkadot-purple bg-polkadot-purple/10 rounded-lg flex items-center gap-1">
              <Brain className="w-3 h-3" />
              {CATEGORY_NAMES[categoryId]}
            </span>
          )}
          {analyzedAt && (
            <span className="px-3 py-1 text-xs text-gray-500 bg-surface-3 rounded-lg flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Analyzed {analyzedAt}
            </span>
          )}
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">{title}</h1>

        <div className="flex flex-wrap gap-3">
          <a
            href={`https://polkadot.polkassembly.io/referenda/${referendumIndex}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-polkadot-pink flex items-center gap-1 transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> Polkassembly
          </a>
          <a
            href={`https://blockscout-testnet.polkadot.io/address/${ADDRESSES.aiOracle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-polkadot-pink flex items-center gap-1 transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> On-Chain Analysis
          </a>
        </div>
      </div>

      {!hasAnalysis ? (
        <div className="glass-card p-12 text-center">
          <Brain className="w-16 h-16 text-gray-600 mx-auto mb-4 animate-pulse" />
          <h2 className="text-xl font-bold text-gray-400 mb-2">
            Awaiting AI Analysis
          </h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            This proposal hasn&apos;t been analyzed yet. Run the AI backend to
            generate risk scores, recommendations, and personalized insights.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recommendations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <RecommendationDisplay
                value={baseRec}
                confidence={baseConf}
                label="AI Base Recommendation"
              />
              {isConnected && hasIdentity ? (
                <RecommendationDisplay
                  value={persRec}
                  confidence={persConf}
                  label="Your Personalized Rec"
                />
              ) : (
                <div className="rounded-2xl p-6 border border-dashed border-white/10 flex flex-col items-center justify-center text-center">
                  <Fingerprint className="w-8 h-8 text-gray-600 mb-3" />
                  <p className="text-xs text-gray-500 mb-3">
                    {isConnected
                      ? "Create a governance identity to see personalized recommendations"
                      : "Connect wallet for personalized recommendations"}
                  </p>
                  {isConnected && (
                    <Link
                      href="/identity"
                      className="text-xs text-polkadot-pink hover:underline"
                    >
                      Create Identity →
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Personalization comparison highlight */}
            {isConnected && hasIdentity && baseRec !== persRec && (
              <div className="p-4 rounded-xl bg-polkadot-purple/10 border border-polkadot-purple/20">
                <p className="text-sm text-polkadot-purple-light flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  <strong>Personalization active:</strong> Your governance
                  identity changed the recommendation from{" "}
                  {baseRec === 1 ? "Aye" : baseRec === -1 ? "Nay" : "Abstain"}{" "}
                  to{" "}
                  {persRec === 1 ? "Aye" : persRec === -1 ? "Nay" : "Abstain"}
                </p>
              </div>
            )}

            {/* Alignment */}
            {isConnected && hasIdentity && <AlignmentBar score={alignment} />}

            {/* Vote Panel */}
            <VotePanel referendumIndex={referendumIndex} />

            {/* Treasury info if relevant */}
            {analysis && Number(analysis.requestedAmountDOT) > 0 && (
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-white mb-4">
                  Treasury Impact
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-surface-2 text-center">
                    <p className="text-xs text-gray-500 mb-1">Requested</p>
                    <p className="text-xl font-bold text-white">
                      {Number(analysis.requestedAmountDOT).toLocaleString()} DOT
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-surface-2 text-center">
                    <p className="text-xs text-gray-500 mb-1">Treasury Impact</p>
                    <p className="text-xl font-bold text-amber-400">
                      {(Number(analysis.treasuryImpactBps) / 100).toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <RiskGauge score={riskScore} />
            <GovMindStats referendumIndex={referendumIndex} />
          </div>
        </div>
      )}
    </div>
  );
}
