"use client";

import Link from "next/link";
import { useAccount, useReadContract } from "wagmi";
import {
  ADDRESSES,
  GOVMIND_CORE_ABI,
  AI_ORACLE_ABI,
  TRACK_NAMES,
  CATEGORY_NAMES,
} from "@/lib/contracts";
import {
  ArrowUpRight,
  Shield,
  TrendingUp,
  Brain,
  ChevronRight,
  User,
  ExternalLink,
} from "lucide-react";
import clsx from "clsx";

interface ProposalCardProps {
  referendumIndex: number;
  title?: string;
  track?: number;
  proposer?: string;
  state?: string;
  createdAt?: string;
}

function RecommendationBadge({ value }: { value: number }) {
  if (value === 1)
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold badge-aye">
        <TrendingUp className="w-3 h-3" /> Aye
      </span>
    );
  if (value === -1)
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold badge-nay">
        <Shield className="w-3 h-3" /> Nay
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold badge-abstain">
      <Brain className="w-3 h-3" /> Abstain
    </span>
  );
}

function RiskMeter({ score }: { score: number }) {
  const color =
    score <= 30
      ? "bg-emerald-500"
      : score <= 60
      ? "bg-amber-500"
      : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
        <div
          className={clsx("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right">{score}%</span>
    </div>
  );
}

function AlignmentRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 60 ? "#10B981" : score >= 40 ? "#F59E0B" : "#EF4444";

  return (
    <div className="relative w-12 h-12">
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="18" fill="none" stroke="#232333" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r="18"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold" style={{ color }}>
          {score}
        </span>
      </div>
    </div>
  );
}

function StatusBadge({ state }: { state: string }) {
  const colors: Record<string, string> = {
    Deciding: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    Confirming: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    Approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    Rejected: "bg-red-500/10 text-red-400 border-red-500/20",
    Cancelled: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    TimedOut: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    Executed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };
  const cls = colors[state] || "bg-gray-500/10 text-gray-400 border-gray-500/20";

  return (
    <span className={clsx("px-2 py-0.5 text-[10px] font-medium rounded-md border", cls)}>
      {state}
    </span>
  );
}

function truncateAddr(addr: string) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function ProposalCard({ referendumIndex, title, track, proposer, state, createdAt }: ProposalCardProps) {
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
    args: isConnected && address
      ? [address, BigInt(referendumIndex)]
      : undefined,
    query: { enabled: isConnected && !!address },
  });

  const trackNum = analysis ? Number(analysis.track) : track ?? 0;
  const categoryId = analysis ? Number(analysis.categoryId) : 0;
  const riskScore = insight ? Number(insight[2]) : analysis ? Number(analysis.riskScore) : 0;
  const recommendation = insight ? Number(insight[0]) : analysis ? Number(analysis.recommendation) : 0;
  const confidence = insight ? Number(insight[1]) : analysis ? Number(analysis.confidence) : 0;
  const alignment = insight ? Number(insight[3]) : 50;
  const hasAnalysis = analysis?.exists ?? false;

  return (
    <Link href={`/proposals/${referendumIndex}`}>
      <div className="glass-card-hover p-5 group cursor-pointer">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-polkadot-pink/10 text-polkadot-pink rounded-md">
                #{referendumIndex}
              </span>
              <span className="px-2 py-0.5 text-[10px] font-medium text-gray-400 bg-surface-3 rounded-md">
                {TRACK_NAMES[trackNum] || `Track ${trackNum}`}
              </span>
              {state && state !== "Unknown" && (
                <StatusBadge state={state} />
              )}
              {hasAnalysis && (
                <span className="px-2 py-0.5 text-[10px] font-medium text-polkadot-purple bg-polkadot-purple/10 rounded-md flex items-center gap-1">
                  <Brain className="w-2.5 h-2.5" /> AI
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-polkadot-pink-light transition-colors">
              {title || `Referendum #${referendumIndex}`}
            </h3>
          </div>
          <ArrowUpRight className="w-4 h-4 text-gray-500 group-hover:text-polkadot-pink transition-colors flex-shrink-0 mt-1" />
        </div>

        {/* Proposer & date row */}
        {(proposer || createdAt) && (
          <div className="flex items-center gap-3 mb-3 text-[11px] text-gray-500">
            {proposer && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {truncateAddr(proposer)}
              </span>
            )}
            {createdAt && (
              <span>{timeAgo(createdAt)}</span>
            )}
          </div>
        )}

        {/* AI Analysis Section */}
        {hasAnalysis ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <RecommendationBadge value={recommendation} />
                <span className="text-xs text-gray-400">
                  {confidence}% confidence
                </span>
              </div>
              {isConnected && <AlignmentRing score={alignment} />}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-gray-500">
                  Risk Level
                </span>
                <span className="text-[10px] text-gray-500">
                  {CATEGORY_NAMES[categoryId] || "Unknown"}
                </span>
              </div>
              <RiskMeter score={riskScore} />
            </div>

            {isConnected && alignment !== 50 && (
              <p className="text-[11px] text-gray-500 leading-relaxed">
                {alignment >= 60
                  ? "This proposal aligns with your governance values"
                  : alignment <= 40
                  ? "This proposal conflicts with your governance values"
                  : "Neutral alignment with your governance profile"}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-4 justify-center text-gray-500">
            <Brain className="w-4 h-4 animate-pulse" />
            <span className="text-xs">Awaiting AI analysis...</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
          <a
            href={`https://polkadot.subsquare.io/referenda/${referendumIndex}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] text-gray-600 hover:text-polkadot-pink transition-colors flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" /> Subsquare
          </a>
          <span className="text-[10px] text-gray-500 group-hover:text-polkadot-pink transition-colors flex items-center gap-1">
            View details <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}
