"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
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
  XCM_RELAY_ABI,
  PVM_STATUS_ABI,
  TRACK_NAMES,
  CATEGORY_NAMES,
  COLLECTIVES,
  Collective,
} from "@/lib/contracts";
import {
  ArrowLeft,
  Brain,
  Shield,
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
  DollarSign,
  MessageSquare,
  History,
  Activity,
  Scale,
  Globe,
  Link2,
  ChevronDown,
  ChevronUp,
  Code2,
  FileCode,
  Copy,
  Check,
  XCircle,
  Cpu,
  ArrowRightLeft,
  Users,
  Leaf,
  Rocket,
  ShieldCheck,
  Coins,
  Crown,
} from "lucide-react";
import ChatAgent from "@/components/ChatAgent";
import ReactMarkdown from "react-markdown";
import Link from "next/link";
import clsx from "clsx";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const KNOWN_TITLES: Record<number, string> = {
  1836: "Polkadot-API 2026 Development Funding",
  1831: "Polkadot Staking Dashboard: Protocol-Aligned Development",
  1772: "Staking Dashboard: Improvements & DeFi Integration",
  1766: "Polkawatch Decentralization Analytics Maintenance",
  1703: "Polkadot Staking Dashboard: Sept 2025 - March 2026",
};

// ─── Deep Analysis Types ───
interface DeepAnalysis {
  verdict: string;
  treasuryBreakdown: {
    requestedDOT: number;
    requestedUSD: number;
    treasuryPercent: number;
    costPerMonth: number;
    durationMonths: number;
    valueAssessment: string;
  };
  riskFactors: Array<{
    factor: string;
    severity: string;
    detail: string;
  }>;
  communitySentiment: {
    overallSignal: string;
    weightedScore: number;
    keyTakeaway: string;
    notableConcerns: string[];
    notableEndorsements: string[];
  };
  votingMomentum: {
    trend: string;
    ayePercent: number;
    totalStakeDOT: number;
    conviction: string;
  };
  historicalContext: {
    hasHistoricalData: boolean;
    similarProposals: string;
    proposerTrackRecord: string;
    precedentAnalysis: string;
  };
  strengthsAndWeaknesses: {
    strengths: string[];
    weaknesses: string[];
  };
}

interface ApiAnalysis {
  riskScore: number;
  categoryId: number;
  recommendation: number;
  confidence: number;
  requestedAmountDOT: number;
  treasuryImpactBps: number;
  summary: string;
  deepAnalysis?: DeepAnalysis;
  proposal?: {
    title: string;
    tally: { ayes: number; nays: number; support: number; ayePercent: number };
    commentAnalysis: {
      total: number;
      sentiments: { positive: number; negative: number; neutral: number };
    };
    spendingInfo: { totalAmountDOT: number };
  };
}

// ─── Chart Components ───

function TreasuryDonut({
  percent,
  requestedDOT,
}: {
  percent: number;
  requestedDOT: number;
}) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const filled = Math.min(percent, 100);
  const offset = circumference - (filled / 100) * circumference;

  return (
    <div className="flex items-center gap-5">
      <div className="relative">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="#1a1a2e"
            strokeWidth="10"
          />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="url(#treasuryGrad)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 60 60)"
            className="transition-all duration-1000"
          />
          <defs>
            <linearGradient id="treasuryGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#E6007A" />
              <stop offset="100%" stopColor="#6D3AEE" />
            </linearGradient>
          </defs>
          <text
            x="60"
            y="56"
            textAnchor="middle"
            className="fill-white text-lg font-bold"
            style={{ fontSize: "16px" }}
          >
            {percent.toFixed(2)}%
          </text>
          <text
            x="60"
            y="72"
            textAnchor="middle"
            className="fill-gray-500"
            style={{ fontSize: "10px" }}
          >
            of treasury
          </text>
        </svg>
      </div>
      <div className="space-y-1.5">
        <p className="text-2xl font-bold text-white">
          {requestedDOT.toLocaleString()} DOT
        </p>
        <p className="text-sm text-gray-400">
          ~${(requestedDOT * 5).toLocaleString()} USD
        </p>
      </div>
    </div>
  );
}

function SentimentBar({
  positive,
  negative,
  neutral,
}: {
  positive: number;
  negative: number;
  neutral: number;
}) {
  const total = positive + negative + neutral || 1;
  const pP = (positive / total) * 100;
  const nP = (negative / total) * 100;
  const uP = (neutral / total) * 100;

  return (
    <div>
      <div className="flex gap-0.5 h-4 rounded-full overflow-hidden mb-2">
        {pP > 0 && (
          <div
            className="bg-emerald-500 rounded-l-full transition-all duration-700"
            style={{ width: `${pP}%` }}
          />
        )}
        {uP > 0 && (
          <div
            className="bg-gray-500 transition-all duration-700"
            style={{ width: `${uP}%` }}
          />
        )}
        {nP > 0 && (
          <div
            className="bg-red-500 rounded-r-full transition-all duration-700"
            style={{ width: `${nP}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-[11px]">
        <span className="text-emerald-400">{positive} supportive</span>
        <span className="text-gray-500">{neutral} neutral</span>
        <span className="text-red-400">{negative} opposed</span>
      </div>
    </div>
  );
}

function VotingMomentumChart({
  ayePercent,
  totalStake,
  trend,
}: {
  ayePercent: number;
  totalStake: number;
  trend: string;
}) {
  const trendConfig: Record<string, { color: string; label: string }> = {
    strong_aye: { color: "text-emerald-400", label: "Strong Aye" },
    leaning_aye: { color: "text-emerald-300", label: "Leaning Aye" },
    contested: { color: "text-amber-400", label: "Contested" },
    leaning_nay: { color: "text-red-300", label: "Leaning Nay" },
    strong_nay: { color: "text-red-400", label: "Strong Nay" },
    early: { color: "text-gray-400", label: "Early Stage" },
  };
  const tc = trendConfig[trend] || trendConfig.early;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className={clsx("text-sm font-semibold", tc.color)}>
          {tc.label}
        </span>
        <span className="text-xs text-gray-500">
          {totalStake.toLocaleString()} DOT committed
        </span>
      </div>
      <div className="relative h-6 bg-surface-3 rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-emerald-500/80 transition-all duration-700"
          style={{ width: `${ayePercent}%` }}
        />
        <div
          className="absolute right-0 top-0 h-full bg-red-500/80 transition-all duration-700"
          style={{ width: `${100 - ayePercent}%` }}
        />
        {/* Center marker */}
        <div className="absolute left-1/2 top-0 h-full w-px bg-white/30" />
        {/* Percentage labels */}
        <div className="absolute inset-0 flex items-center justify-between px-3">
          <span className="text-[10px] font-bold text-white/90">
            {ayePercent}% Aye
          </span>
          <span className="text-[10px] font-bold text-white/90">
            {100 - ayePercent}% Nay
          </span>
        </div>
      </div>
    </div>
  );
}

function RiskSeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    low: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
    medium: { bg: "bg-amber-500/15", text: "text-amber-400" },
    high: { bg: "bg-red-500/15", text: "text-red-400" },
    critical: { bg: "bg-red-600/20", text: "text-red-300" },
  };
  const c = config[severity] || config.medium;

  return (
    <span
      className={clsx(
        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
        c.bg,
        c.text
      )}
    >
      {severity}
    </span>
  );
}

function StrengthWeaknessPanel({
  strengths,
  weaknesses,
}: {
  strengths: string[];
  weaknesses: string[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> Strengths
        </p>
        {strengths.map((s, i) => (
          <div
            key={i}
            className="text-sm text-gray-300 pl-3 border-l-2 border-emerald-500/30"
          >
            {s}
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> Weaknesses
        </p>
        {weaknesses.map((w, i) => (
          <div
            key={i}
            className="text-sm text-gray-300 pl-3 border-l-2 border-red-500/30"
          >
            {w}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Existing Components (updated) ───

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

function RiskGauge({ score }: { score: number }) {
  const angle = (score / 100) * 180 - 90;
  const color =
    score <= 30 ? "#10B981" : score <= 60 ? "#F59E0B" : "#EF4444";
  const label =
    score <= 30 ? "Low Risk" : score <= 60 ? "Medium Risk" : "High Risk";

  return (
    <div>
      <div className="flex justify-center mb-2">
        <svg width="160" height="90" viewBox="0 0 160 90">
          <path
            d="M 10 80 A 70 70 0 0 1 150 80"
            fill="none"
            stroke="#1a1a2e"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M 10 80 A 70 70 0 0 1 150 80"
            fill="none"
            stroke="url(#riskGradient2)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 220} 220`}
          />
          <defs>
            <linearGradient
              id="riskGradient2"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#EF4444" />
            </linearGradient>
          </defs>
          <line
            x1="80"
            y1="80"
            x2={80 + 52 * Math.cos((angle * Math.PI) / 180)}
            y2={80 + 52 * Math.sin((angle * Math.PI) / 180)}
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="80" cy="80" r="5" fill={color} />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-3xl font-bold" style={{ color }}>
          {score}/100
        </p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

// States where voting is no longer possible
// Only these states allow voting — everything else is either pre-voting or ended
const VOTABLE_STATES = new Set(["Deciding", "Confirming"]);

interface VoteParams {
  aye: boolean;
  conviction: number;
  amount: string;
  txHash?: string;
}

function CrossVMFlowSection({ voteFlowState }: { voteFlowState: "idle" | "pending" | "confirming" | "confirmed" }) {
  const { data: pvmCodecEnabled } = useReadContract({
    address: ADDRESSES.xcmRelay,
    abi: PVM_STATUS_ABI,
    functionName: "usePVMCodec",
  });

  const { data: pvmScorerEnabled } = useReadContract({
    address: ADDRESSES.govMindCore,
    abi: PVM_STATUS_ABI,
    functionName: "usePVMScorer",
  });

  // Animated step progression during vote
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (voteFlowState === "idle") { setActiveStep(0); return; }
    if (voteFlowState === "confirmed") { setActiveStep(5); return; }

    // Animate steps 1→4 during pending/confirming
    setActiveStep(1);
    const timers = [
      setTimeout(() => setActiveStep(2), 800),
      setTimeout(() => setActiveStep(3), 1600),
      setTimeout(() => setActiveStep(4), 2400),
    ];
    return () => timers.forEach(clearTimeout);
  }, [voteFlowState]);

  const isAnimating = voteFlowState !== "idle";
  const allDone = voteFlowState === "confirmed";

  const steps = [
    { num: 1, label: "GovMindCore", sub: "EVM \u00B7 Solidity", detail: "", color: "polkadot-pink", isPvm: false },
    { num: 2, label: "AlignmentScorer", sub: "PVM \u00B7 Rust", detail: "690 bytes", color: "cyan", isPvm: true, enabled: pvmScorerEnabled },
    { num: 3, label: "ScaleCodecPVM", sub: "PVM \u00B7 Rust", detail: "1,523 bytes", color: "cyan", isPvm: true, enabled: pvmCodecEnabled },
    { num: 4, label: "XCM Precompile", sub: "0x0A0000", detail: "Transact", color: "polkadot-purple", isPvm: false },
    { num: 5, label: "Relay Chain", sub: "convictionVoting", detail: "Vote Counted", color: "emerald", isPvm: false },
  ];

  function stepCircleClass(stepNum: number) {
    if (allDone) return "bg-emerald-500/30 ring-2 ring-emerald-400/50";
    if (isAnimating && activeStep === stepNum) return "bg-cyan-500/30 ring-2 ring-cyan-400/50 animate-pulse";
    if (isAnimating && activeStep > stepNum) return "bg-emerald-500/20";
    return `bg-${steps[stepNum - 1].color}-500/20`;
  }

  function stepNumClass(stepNum: number) {
    if (allDone) return "text-emerald-400";
    if (isAnimating && activeStep === stepNum) return "text-cyan-300";
    if (isAnimating && activeStep > stepNum) return "text-emerald-400";
    const c = steps[stepNum - 1].color;
    return c === "polkadot-pink" ? "text-polkadot-pink" : c === "polkadot-purple" ? "text-polkadot-purple" : `text-${c}-400`;
  }

  function stepCardClass(stepNum: number, isPvm: boolean, enabled?: boolean) {
    if (allDone) return "bg-emerald-500/10 border border-emerald-500/30";
    if (isAnimating && activeStep === stepNum) return "bg-cyan-500/15 border border-cyan-400/40 shadow-lg shadow-cyan-500/10";
    if (isAnimating && activeStep > stepNum) return "bg-emerald-500/5 border border-emerald-500/20";
    if (isPvm && enabled) return "bg-cyan-500/10 border border-cyan-500/20";
    return "bg-surface-2 border border-white/10";
  }

  function arrowClass(afterStep: number) {
    if (allDone) return "text-emerald-400";
    if (isAnimating && activeStep > afterStep) return "text-emerald-400";
    if (isAnimating && activeStep === afterStep) return "text-cyan-400 animate-pulse";
    return afterStep <= 2 ? "text-cyan-400/50" : "text-polkadot-purple/50";
  }

  return (
    <div className={clsx(
      "glass-card p-6 transition-all duration-500",
      allDone
        ? "border border-emerald-500/30 bg-gradient-to-r from-emerald-500/5 via-surface-1 to-emerald-500/5"
        : isAnimating
          ? "border border-cyan-400/30 bg-gradient-to-r from-cyan-500/5 via-surface-1 to-polkadot-purple/5"
          : "border border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 via-surface-1 to-polkadot-purple/5"
    )}>
      <div className="flex items-center gap-2 mb-4">
        <Cpu className={clsx("w-5 h-5 transition-colors", allDone ? "text-emerald-400" : isAnimating ? "text-cyan-300 animate-pulse" : "text-cyan-400")} />
        <h3 className="text-sm font-semibold text-white">
          Cross-VM Vote Execution Flow
        </h3>
        <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded">
          EVM + PVM
        </span>
        <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-polkadot-pink/15 text-polkadot-pink rounded">
          XCM V5
        </span>
        {isAnimating && !allDone && (
          <span className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] text-cyan-400 font-medium">
            <Loader2 className="w-3 h-3 animate-spin" />
            Processing vote...
          </span>
        )}
        {allDone && (
          <span className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Vote executed
          </span>
        )}
      </div>

      {/* Visual pipeline */}
      <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
        {steps.map((step, i) => (
          <div key={step.num} className="contents">
            {i > 0 && (
              <div className="flex items-center px-1">
                {step.isPvm || steps[i - 1].isPvm ? (
                  <ArrowRightLeft className={clsx("w-3.5 h-3.5 shrink-0 transition-colors duration-300", arrowClass(step.num - 1))} />
                ) : (
                  <Globe className={clsx("w-3.5 h-3.5 shrink-0 transition-colors duration-300", arrowClass(step.num - 1))} />
                )}
              </div>
            )}
            <div className={clsx("flex flex-col items-center min-w-[100px] transition-all duration-500", isAnimating && activeStep === step.num && "scale-105")}>
              <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center mb-2 transition-all duration-300", stepCircleClass(step.num))}>
                {allDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : isAnimating && activeStep === step.num ? (
                  <Loader2 className="w-4 h-4 text-cyan-300 animate-spin" />
                ) : (
                  <span className={clsx("text-xs font-bold transition-colors duration-300", stepNumClass(step.num))}>{step.num}</span>
                )}
              </div>
              <div className={clsx("px-3 py-2 rounded-lg text-center flex-1 w-full transition-all duration-300", stepCardClass(step.num, step.isPvm, step.enabled))}>
                <span className="text-[10px] text-gray-300 font-medium block">{step.label}</span>
                <span className={clsx("text-[9px] block", step.isPvm ? "text-cyan-400" : step.color === "emerald" ? "text-emerald-400" : step.color === "polkadot-purple" ? "text-polkadot-purple" : "text-gray-500")}>{step.sub}</span>
                {step.detail && <span className="text-[8px] text-gray-600">{step.detail}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Status text */}
      <p className={clsx("text-[11px] mt-3 transition-colors duration-300", allDone ? "text-emerald-400/70" : "text-gray-500")}>
        {allDone
          ? "Vote confirmed on-chain. Traversed EVM \u2192 PVM (Rust RISC-V) \u2192 XCM V5 \u2192 Relay Chain."
          : isAnimating
            ? "Your vote is flowing through the cross-VM pipeline..."
            : "Your vote flows through two VMs on the same chain: EVM Solidity orchestrates the vote, Rust PVM contracts handle SCALE encoding and alignment scoring on RISC-V, then XCM V5 relays to the Relay Chain for execution."}
      </p>
    </div>
  );
}

function VotePanel({
  referendumIndex,
  proposalState,
  onVoteSuccess,
  onFlowStateChange,
}: {
  referendumIndex: number;
  proposalState: string | null;
  onVoteSuccess?: (params: VoteParams) => void;
  onFlowStateChange?: (state: "idle" | "pending" | "confirming" | "confirmed") => void;
}) {
  const { address, isConnected } = useAccount();
  const [conviction, setConviction] = useState(1);
  const [amount, setAmount] = useState("10");
  const [votingAye, setVotingAye] = useState<boolean | null>(null);

  const { data: alreadyVoted } = useReadContract({
    address: ADDRESSES.govMindCore,
    abi: GOVMIND_CORE_ABI,
    functionName: "hasVoted",
    args: address ? [address, BigInt(referendumIndex)] : undefined,
    query: { enabled: isConnected && !!address },
  });

  const {
    writeContract: castVote,
    data: voteTxHash,
    isPending,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: voteTxHash });

  // Drive cross-VM flow animation
  useEffect(() => {
    if (isSuccess) onFlowStateChange?.("confirmed");
    else if (isConfirming) onFlowStateChange?.("confirming");
    else if (isPending) onFlowStateChange?.("pending");
  }, [isPending, isConfirming, isSuccess]);

  // Notify parent when vote is confirmed
  useEffect(() => {
    if (isSuccess && votingAye !== null && onVoteSuccess) {
      onVoteSuccess({ aye: votingAye, conviction, amount, txHash: voteTxHash });
    }
  }, [isSuccess]);

  const handleVote = (aye: boolean) => {
    setVotingAye(aye);
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

  // Only allow voting when proposal is in Deciding or Confirming
  const canVote = proposalState && VOTABLE_STATES.has(proposalState);
  if (proposalState && !canVote) {
    return (
      <div className="glass-card p-5">
        <div className="flex items-center gap-3 text-gray-400">
          <XCircle className="w-5 h-5" />
          <div>
            <span className="text-sm font-semibold block">
              Voting Not Available
            </span>
            <span className="text-xs text-gray-500">
              This proposal is {proposalState.toLowerCase()} — voting is only available during Deciding and Confirming stages
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (alreadyVoted) {
    return (
      <div className="glass-card p-5">
        <div className="flex items-center gap-3 text-emerald-400">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-semibold">
            You have voted on this proposal
          </span>
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
          <label className="text-xs text-gray-400 mb-1.5 block">
            Amount (PAS)
          </label>
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
            {(isPending || isConfirming) && votingAye === true ? (
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
            {(isPending || isConfirming) && votingAye === false ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ThumbsDown className="w-4 h-4" />
            )}
            Vote Nay
          </button>
        </div>
        {isSuccess && voteTxHash && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Vote recorded on-chain!
            </div>
            <a
              href={`https://blockscout-testnet.polkadot.io/tx/${voteTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-polkadot-purple/10 text-polkadot-purple border border-polkadot-purple/20 hover:bg-polkadot-purple/20 transition-all w-fit"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Transaction on Blockscout
            </a>
            <p className="text-[10px] text-gray-600 font-mono break-all">
              TX: {voteTxHash}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section Components for Deep Analysis ───

function SectionHeader({
  icon: Icon,
  title,
  iconColor = "text-polkadot-pink",
}: {
  icon: any;
  title: string;
  iconColor?: string;
}) {
  return (
    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
      <Icon className={clsx("w-4 h-4", iconColor)} />
      {title}
    </h3>
  );
}

// ─── XCM Verification Panel ───

function XCMVerificationPanel({
  referendumIndex,
  voteParams,
}: {
  referendumIndex: number;
  voteParams: VoteParams;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showRawBytes, setShowRawBytes] = useState(false);
  const [copiedXcm, setCopiedXcm] = useState(false);

  const { data: xcmMessage } = useReadContract({
    address: ADDRESSES.xcmRelay,
    abi: XCM_RELAY_ABI,
    functionName: "previewXcmMessage",
    args: [
      referendumIndex,
      voteParams.aye,
      voteParams.conviction,
      parseEther(voteParams.amount || "0"),
    ],
    query: { enabled: expanded },
  });

  const xcmHex = xcmMessage ? xcmMessage as string : null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedXcm(true);
    setTimeout(() => setCopiedXcm(false), 2000);
  };

  return (
    <div className="glass-card border border-polkadot-purple/20 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-polkadot-purple/15 flex items-center justify-center">
            <Code2 className="w-4.5 h-4.5 text-polkadot-purple" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Verify Your XCM Vote</p>
            <p className="text-[11px] text-gray-500">
              Your {voteParams.aye ? "Aye" : "Nay"} vote ({voteParams.amount} PAS, {voteParams.conviction}x conviction) — see how it reaches Relay Chain
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
            On-Chain
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
          {/* Simple visual flow */}
          <div className="p-4 rounded-xl bg-surface-2 border border-white/5">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-4">
              XCM Vote Relay Flow
            </p>

            {/* Step 1: Hub */}
            <div className="mb-3">
              <p className="text-[10px] text-polkadot-pink uppercase tracking-wider font-bold mb-2">
                Polkadot Hub
              </p>
              <div className="flex items-center gap-2 py-1.5">
                <span className="w-5 h-5 rounded-full bg-amber-500/15 text-[10px] font-bold text-amber-400 flex items-center justify-center flex-shrink-0">1</span>
                <span className="text-[11px] text-white">Withdraw 0.1 DOT for XCM fees</span>
              </div>
              <div className="flex items-center gap-2 py-1.5">
                <span className="w-5 h-5 rounded-full bg-pink-500/15 text-[10px] font-bold text-polkadot-pink flex items-center justify-center flex-shrink-0">2</span>
                <span className="text-[11px] text-white">Teleport to Relay Chain with vote instructions</span>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex items-center gap-2 pl-2 mb-3">
              <div className="w-0.5 h-4 bg-polkadot-purple/30" />
              <span className="text-[10px] text-gray-600">XCM V5 message</span>
            </div>

            {/* Step 2: Relay */}
            <div>
              <p className="text-[10px] text-polkadot-purple uppercase tracking-wider font-bold mb-2">
                Relay Chain
              </p>
              <div className="flex items-center gap-2 py-1.5 pl-4 border-l border-polkadot-purple/20">
                <span className="w-5 h-5 rounded-full bg-blue-500/15 text-[10px] font-bold text-blue-400 flex items-center justify-center flex-shrink-0">3</span>
                <span className="text-[11px] text-white">Pay execution fees</span>
              </div>
              <div className="flex items-center gap-2 py-1.5 pl-4 border-l border-polkadot-purple/20">
                <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-[10px] font-bold text-emerald-400 flex items-center justify-center flex-shrink-0">4</span>
                <span className="text-[11px] text-white">
                  Execute <code className="text-polkadot-purple text-[10px]">convictionVoting.vote(#{referendumIndex})</code>
                </span>
              </div>
              <div className="flex items-center gap-2 py-1.5 pl-4 border-l border-polkadot-purple/20">
                <span className="w-5 h-5 rounded-full bg-gray-500/15 text-[10px] font-bold text-gray-400 flex items-center justify-center flex-shrink-0">5</span>
                <span className="text-[11px] text-white">Refund unused fees &amp; deposit remainder</span>
              </div>
            </div>
          </div>

          {/* Block Explorer Link */}
          {voteParams.txHash && (
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-3">
                Transaction Proof
              </p>
              <a
                href={`https://blockscout-testnet.polkadot.io/tx/${voteParams.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-polkadot-purple/10 text-polkadot-purple border border-polkadot-purple/20 hover:bg-polkadot-purple/20 transition-all w-fit"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View on Blockscout Explorer
              </a>
              <p className="text-[10px] text-gray-600 font-mono break-all mt-2">
                {voteParams.txHash}
              </p>
            </div>
          )}

          {/* Raw bytes toggle */}
          <button
            onClick={() => setShowRawBytes(!showRawBytes)}
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors"
          >
            <Code2 className="w-3.5 h-3.5" />
            {showRawBytes ? "Hide" : "Show"} raw XCM bytes
            {showRawBytes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showRawBytes && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-polkadot-purple" />
                  XCM V5 Message (hex)
                </p>
                {xcmHex && (
                  <button
                    onClick={() => copyToClipboard(xcmHex)}
                    className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-white transition-colors"
                  >
                    {copiedXcm ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedXcm ? "Copied" : "Copy"}
                  </button>
                )}
              </div>
              {xcmHex ? (
                <div className="p-3 rounded-lg bg-[#0d0d1a] border border-white/5 font-mono text-[11px] text-polkadot-purple break-all leading-relaxed max-h-32 overflow-y-auto">
                  {xcmHex}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-surface-2 flex items-center justify-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-gray-500 animate-spin" />
                  <span className="text-xs text-gray-500">Fetching from contract...</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Request Analysis Panel ───

function RequestAnalysisPanel({ referendumIndex, onAnalyzed }: { referendumIndex: number; onAnalyzed: () => void }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ recommendation: number; riskScore: number; confidence: number; summary: string } | null>(null);

  const requestAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/analyze/${referendumIndex}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Analysis failed");
      }
      if (data.alreadyExisted) {
        onAnalyzed();
        return;
      }
      setResult(data);
      // Wait a moment for on-chain data to propagate, then refresh
      setTimeout(onAnalyzed, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze");
    } finally {
      setAnalyzing(false);
    }
  };

  if (result) {
    return (
      <div className="glass-card p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Analysis Complete</h2>
        <p className="text-sm text-gray-400 mb-4">{result.summary}</p>
        <div className="flex items-center justify-center gap-6 text-sm">
          <span className={result.recommendation === 1 ? "text-emerald-400 font-bold" : result.recommendation === -1 ? "text-red-400 font-bold" : "text-gray-400 font-bold"}>
            {result.recommendation === 1 ? "AYE" : result.recommendation === -1 ? "NAY" : "ABSTAIN"}
          </span>
          <span className="text-gray-500">Risk: {result.riskScore}/100</span>
          <span className="text-gray-500">Confidence: {result.confidence}%</span>
        </div>
        <p className="text-xs text-gray-600 mt-4">Refreshing page to load on-chain data...</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-8 text-center">
      <Brain className={`w-16 h-16 mx-auto mb-4 ${analyzing ? "text-polkadot-pink animate-pulse" : "text-gray-600"}`} />
      <h2 className="text-xl font-bold text-gray-300 mb-2">
        {analyzing ? "Analyzing Proposal..." : "No AI Analysis Yet"}
      </h2>
      <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
        {analyzing
          ? "Fetching proposal data, running GPT analysis, and publishing results on-chain. This takes about 15-30 seconds."
          : "This proposal hasn\u2019t been analyzed by GovMind AI yet. Request an analysis to get risk scoring, recommendations, and deep intelligence."}
      </p>
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}
      {!analyzing && (
        <button
          onClick={requestAnalysis}
          className="btn-primary inline-flex items-center gap-2 px-6 py-3"
        >
          <Brain className="w-4 h-4" />
          Request AI Analysis
        </button>
      )}
      {analyzing && (
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-polkadot-pink animate-spin" />
          <span className="text-sm text-gray-400">Processing with GPT...</span>
        </div>
      )}
    </div>
  );
}

// ─── Collective Recommendation ───

const COLLECTIVE_ICONS: Record<string, typeof Shield> = {
  Leaf,
  Rocket,
  ShieldCheck,
  Coins,
};

function getCategoryAxes(categoryId: number): { support: number; oppose: number; hasMapping: boolean } {
  if (categoryId === 0 || categoryId === 1 || categoryId === 8) return { support: 1, oppose: 0, hasMapping: true };
  if (categoryId === 2) return { support: 2, oppose: 3, hasMapping: true };
  if (categoryId === 3 || categoryId === 6) return { support: 4, oppose: 5, hasMapping: true };
  if (categoryId === 4 || categoryId === 5 || categoryId === 7) return { support: 5, oppose: 4, hasMapping: true };
  return { support: 0, oppose: 0, hasMapping: false };
}

function computeCollectiveRecommendation(
  collective: Collective,
  categoryId: number,
  riskScore: number,
  baseRec: number,
  baseConf: number
): { recommendation: number; confidence: number; alignment: number } {
  const { support, oppose, hasMapping } = getCategoryAxes(categoryId);
  if (!hasMapping) return { recommendation: baseRec, confidence: baseConf, alignment: 50 };

  const supportWeight = collective.axes[support];
  const opposeWeight = collective.axes[oppose];

  let raw = 50 + (supportWeight - opposeWeight) / 2;
  if (riskScore > collective.riskTolerance) {
    raw -= (riskScore - collective.riskTolerance) / 2;
  }
  const alignment = Math.max(0, Math.min(100, Math.round(raw)));

  let recommendation: number;
  let confidence: number;

  if (alignment >= 60) {
    recommendation = baseRec >= 0 ? 1 : 0;
    confidence = baseRec >= 0
      ? Math.min(100, baseConf + Math.floor((alignment - 50) / 2))
      : Math.min(100, Math.floor(baseConf / 2 + alignment / 2));
  } else if (alignment <= 40) {
    recommendation = baseRec <= 0 ? -1 : 0;
    confidence = baseRec <= 0
      ? Math.min(100, baseConf + Math.floor((50 - alignment) / 2))
      : Math.min(100, Math.floor(baseConf / 2 + (100 - alignment) / 2));
  } else {
    recommendation = baseRec;
    confidence = baseConf;
  }

  return { recommendation, confidence, alignment };
}

function CollectiveRecommendationCard({
  categoryId,
  riskScore,
  baseRec,
  baseConf,
}: {
  categoryId: number;
  riskScore: number;
  baseRec: number;
  baseConf: number;
}) {
  const [collective, setCollective] = useState<Collective | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("govmind_collective");
    if (stored) {
      try {
        const { collectiveId } = JSON.parse(stored);
        const found = COLLECTIVES.find((c) => c.id === collectiveId);
        if (found) setCollective(found);
      } catch {}
    }
  }, []);

  if (!collective) return null;

  const { recommendation, confidence, alignment } = computeCollectiveRecommendation(
    collective,
    categoryId,
    riskScore,
    baseRec,
    baseConf
  );

  const Icon = COLLECTIVE_ICONS[collective.icon] || Shield;
  const recLabel = recommendation === 1 ? "Aye" : recommendation === -1 ? "Nay" : "Abstain";
  const recColor =
    recommendation === 1
      ? "text-emerald-400"
      : recommendation === -1
      ? "text-red-400"
      : "text-amber-400";
  const recBg =
    recommendation === 1
      ? "bg-emerald-500/10 border-emerald-500/20"
      : recommendation === -1
      ? "bg-red-500/10 border-red-500/20"
      : "bg-amber-500/10 border-amber-500/20";
  const RecIcon = recommendation === 1 ? ThumbsUp : recommendation === -1 ? ThumbsDown : Minus;

  return (
    <div className={clsx("glass-card p-5 border", collective.borderColor)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center", collective.bgColor)}>
            <Icon className={clsx("w-4 h-4", collective.color)} />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Crown className="w-3 h-3 text-polkadot-pink" />
              Collective Recommendation
            </h3>
            <p className={clsx("text-[10px]", collective.color)}>
              {collective.name}
            </p>
          </div>
        </div>
        <div className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold border", recBg, recColor)}>
          <RecIcon className="w-4 h-4" />
          {recLabel}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-2.5 rounded-lg bg-surface-2/50 border border-white/5 text-center">
          <p className="text-[10px] text-gray-500 mb-0.5">Alignment</p>
          <p className={clsx(
            "text-lg font-bold",
            alignment >= 60 ? "text-emerald-400" : alignment >= 40 ? "text-amber-400" : "text-red-400"
          )}>
            {alignment}%
          </p>
        </div>
        <div className="p-2.5 rounded-lg bg-surface-2/50 border border-white/5 text-center">
          <p className="text-[10px] text-gray-500 mb-0.5">Confidence</p>
          <p className="text-lg font-bold text-white">{confidence}%</p>
        </div>
      </div>

      <p className="text-[10px] text-gray-500 mt-3 text-center">
        Based on {collective.name}&apos;s governance philosophy and this proposal&apos;s category
      </p>
    </div>
  );
}

// ─── Main Page ───

export default function ProposalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const referendumIndex = Number(params.id);
  const { address, isConnected } = useAccount();

  // On-chain data
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
    args:
      isConnected && address
        ? [address, BigInt(referendumIndex)]
        : undefined,
    query: { enabled: isConnected && !!address },
  });

  const { data: hasIdentity } = useReadContract({
    address: ADDRESSES.identityVault,
    abi: IDENTITY_VAULT_ABI,
    functionName: "hasIdentity",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address },
  });

  // Read identity data for AI agent chat
  const { data: prefWeights } = useReadContract({
    address: ADDRESSES.identityVault,
    abi: IDENTITY_VAULT_ABI,
    functionName: "getPreferenceWeights",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address && !!hasIdentity },
  });

  const { data: identityData } = useReadContract({
    address: ADDRESSES.identityVault,
    abi: IDENTITY_VAULT_ABI,
    functionName: "identities",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address && !!hasIdentity },
  });

  const chatIdentity = hasIdentity && prefWeights && identityData
    ? {
        axes: (prefWeights as readonly number[]).map(Number),
        riskTolerance: Number((identityData as any)[1]),
      }
    : null;

  // Read joined collective for AI chat context
  const [chatCollective, setChatCollective] = useState<{
    name: string;
    philosophy: string;
    axes: number[];
    riskTolerance: number;
    focusAreas: string[];
  } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("govmind_collective");
    if (stored) {
      try {
        const { collectiveId } = JSON.parse(stored);
        const found = COLLECTIVES.find((c) => c.id === collectiveId);
        if (found) {
          setChatCollective({
            name: found.name,
            philosophy: found.philosophy,
            axes: found.axes,
            riskTolerance: found.riskTolerance,
            focusAreas: found.focusAreas,
          });
        }
      } catch {}
    }
  }, []);

  // Proposal metadata from Subsquare (for state / voting guard + content)
  const [proposalState, setProposalState] = useState<string | null>(null);
  const [proposalContent, setProposalContent] = useState<string | null>(null);
  const [contentExpanded, setContentExpanded] = useState(true);

  // Track user's vote for XCM verification panel + cross-VM animation
  const [voteParams, setVoteParams] = useState<VoteParams | null>(null);
  const [voteFlowState, setVoteFlowState] = useState<"idle" | "pending" | "confirming" | "confirmed">("idle");

  // Rich analysis from API
  const [deepData, setDeepData] = useState<ApiAnalysis | null>(null);
  const [apiLoading, setApiLoading] = useState(true);

  useEffect(() => {
    async function fetchDeep() {
      try {
        const res = await fetch(`${API_BASE}/api/analysis/${referendumIndex}`);
        if (res.ok) {
          const data = await res.json();
          setDeepData(data);
        }
      } catch {
        // API not available, that's fine — we still have on-chain data
      } finally {
        setApiLoading(false);
      }
    }
    // Fetch proposal state from Subsquare proxy
    async function fetchState() {
      try {
        const res = await fetch(`/api/referenda/${referendumIndex}`);
        if (res.ok) {
          const data = await res.json();
          setProposalState(data.state || null);
          if (data.content) setProposalContent(data.content);
        }
      } catch {
        // Non-critical
      }
    }
    fetchDeep();
    fetchState();
  }, [referendumIndex]);

  const hasOnChain = analysis?.exists ?? false;
  const trackNum = analysis ? Number(analysis.track) : 0;
  const categoryId = analysis ? Number(analysis.categoryId) : 0;
  const baseRec = analysis ? Number(analysis.recommendation) : 0;
  const baseConf = analysis ? Number(analysis.confidence) : 0;
  const riskScore = analysis ? Number(analysis.riskScore) : 0;

  const persRec = insight ? Number(insight[0]) : baseRec;
  const persConf = insight ? Number(insight[1]) : baseConf;
  const alignment = insight ? Number(insight[3]) : 50;

  const deep = deepData?.deepAnalysis;
  const title =
    deepData?.proposal?.title ||
    KNOWN_TITLES[referendumIndex] ||
    `Referendum #${referendumIndex}`;
  const analyzedAt = analysis?.analyzedAt
    ? new Date(Number(analysis.analyzedAt) * 1000).toLocaleDateString()
    : null;
  const version = analysis?.version ? Number(analysis.version) : 1;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.push("/proposals")}
        className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Proposals
      </button>

      {/* Header */}
      <div className="glass-card p-6 mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="px-3 py-1 text-xs font-semibold bg-polkadot-pink/10 text-polkadot-pink rounded-lg">
            #{referendumIndex}
          </span>
          <span className="px-3 py-1 text-xs font-medium text-gray-400 bg-surface-3 rounded-lg">
            {TRACK_NAMES[trackNum] || `Track ${trackNum}`}
          </span>
          {hasOnChain && (
            <>
              <span className="px-3 py-1 text-xs font-medium text-polkadot-purple bg-polkadot-purple/10 rounded-lg flex items-center gap-1">
                <Brain className="w-3 h-3" />
                {CATEGORY_NAMES[categoryId]}
              </span>
              {version > 1 && (
                <span className="px-3 py-1 text-xs font-medium text-amber-400 bg-amber-500/10 rounded-lg">
                  v{version}
                </span>
              )}
            </>
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
            href={`https://polkadot.subsquare.io/referenda/${referendumIndex}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-polkadot-pink flex items-center gap-1 transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> Subsquare
          </a>
          <a
            href={`https://blockscout-testnet.polkadot.io/address/${ADDRESSES.aiOracle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-polkadot-pink flex items-center gap-1 transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> On-Chain Proof
          </a>
        </div>
      </div>

      {/* Proposal Content */}
      {proposalContent && (
        <div className="glass-card p-6 mb-6">
          <button
            onClick={() => setContentExpanded(!contentExpanded)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileCode className="w-4 h-4 text-polkadot-pink" />
              Proposal Content
            </h3>
            {contentExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>
          {contentExpanded && (
            <div className="mt-4 prose prose-invert prose-sm max-w-none prose-headings:text-white prose-p:text-gray-300 prose-a:text-polkadot-pink prose-strong:text-white prose-li:text-gray-300 prose-code:text-polkadot-purple prose-code:bg-surface-2 prose-code:px-1 prose-code:rounded prose-pre:bg-surface-2 prose-pre:border prose-pre:border-white/5 prose-img:rounded-xl">
              <ReactMarkdown>{proposalContent}</ReactMarkdown>
            </div>
          )}
        </div>
      )}

      {!hasOnChain ? (
        <RequestAnalysisPanel referendumIndex={referendumIndex} onAnalyzed={() => window.location.reload()} />
      ) : (
        <div className="space-y-6">
          {/* ── Row 1: Recommendations + Risk Gauge ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                    ? "Create a governance identity for personalized recommendations"
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
            <div className="glass-card p-5">
              <SectionHeader
                icon={Shield}
                title="Risk Assessment"
                iconColor={
                  riskScore <= 30
                    ? "text-emerald-400"
                    : riskScore <= 60
                    ? "text-amber-400"
                    : "text-red-400"
                }
              />
              <RiskGauge score={riskScore} />
            </div>
          </div>

          {/* Personalization highlight */}
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

          {/* Alignment bar */}
          {isConnected && hasIdentity && (
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-polkadot-pink" />
                  Alignment Score
                </p>
                <span
                  className={clsx(
                    "text-xs font-semibold",
                    alignment >= 60
                      ? "text-emerald-400"
                      : alignment >= 40
                      ? "text-amber-400"
                      : "text-red-400"
                  )}
                >
                  {alignment >= 60
                    ? "Aligned"
                    : alignment >= 40
                    ? "Neutral"
                    : "Opposed"}
                </span>
              </div>
              <div className="relative h-3 bg-surface-3 rounded-full overflow-hidden mb-2">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 via-amber-500/20 to-emerald-500/20" />
                <div
                  className={clsx(
                    "absolute top-0 h-full rounded-full transition-all duration-700",
                    alignment >= 60
                      ? "bg-emerald-500"
                      : alignment >= 40
                      ? "bg-amber-500"
                      : "bg-red-500"
                  )}
                  style={{ width: `${alignment}%` }}
                />
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-gray-600">Opposed (0)</span>
                <span
                  className={clsx(
                    "text-sm font-bold",
                    alignment >= 60
                      ? "text-emerald-400"
                      : alignment >= 40
                      ? "text-amber-400"
                      : "text-red-400"
                  )}
                >
                  {alignment}/100
                </span>
                <span className="text-[10px] text-gray-600">
                  Aligned (100)
                </span>
              </div>
            </div>
          )}

          {/* ── AI Verdict ── */}
          {deep && (
            <div className="glass-card p-6 border-l-4 border-polkadot-pink">
              <SectionHeader icon={Brain} title="AI Verdict" />
              <p className="text-sm text-gray-300 leading-relaxed">
                {deep.verdict}
              </p>
            </div>
          )}

          {/* ── Row 2: Deep Analysis Grid ── */}
          {deep && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Treasury Breakdown */}
              {deep.treasuryBreakdown.requestedDOT > 0 && (
                <div className="glass-card p-6">
                  <SectionHeader icon={DollarSign} title="Treasury Breakdown" />
                  <TreasuryDonut
                    percent={deep.treasuryBreakdown.treasuryPercent}
                    requestedDOT={deep.treasuryBreakdown.requestedDOT}
                  />
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {deep.treasuryBreakdown.durationMonths > 0 && (
                      <div className="p-3 rounded-xl bg-surface-2 text-center">
                        <p className="text-xs text-gray-500 mb-0.5">
                          Duration
                        </p>
                        <p className="text-lg font-bold text-white">
                          {deep.treasuryBreakdown.durationMonths} mo
                        </p>
                      </div>
                    )}
                    {deep.treasuryBreakdown.costPerMonth > 0 && (
                      <div className="p-3 rounded-xl bg-surface-2 text-center">
                        <p className="text-xs text-gray-500 mb-0.5">
                          Cost/Month
                        </p>
                        <p className="text-lg font-bold text-white">
                          {deep.treasuryBreakdown.costPerMonth.toLocaleString()}{" "}
                          DOT
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-3 italic">
                    {deep.treasuryBreakdown.valueAssessment}
                  </p>
                </div>
              )}

              {/* Voting Momentum */}
              <div className="glass-card p-6">
                <SectionHeader
                  icon={Activity}
                  title="Voting Momentum"
                  iconColor="text-polkadot-purple"
                />
                <VotingMomentumChart
                  ayePercent={deep.votingMomentum.ayePercent}
                  totalStake={deep.votingMomentum.totalStakeDOT}
                  trend={deep.votingMomentum.trend}
                />
                <p className="text-xs text-gray-400 mt-3">
                  {deep.votingMomentum.conviction}
                </p>
              </div>

              {/* Community Sentiment */}
              <div className="glass-card p-6">
                <SectionHeader icon={MessageSquare} title="Community Sentiment" />
                {deepData?.proposal?.commentAnalysis && (
                  <SentimentBar
                    positive={
                      deepData.proposal.commentAnalysis.sentiments.positive
                    }
                    negative={
                      deepData.proposal.commentAnalysis.sentiments.negative
                    }
                    neutral={
                      deepData.proposal.commentAnalysis.sentiments.neutral
                    }
                  />
                )}
                <div className="mt-4 flex items-center gap-3">
                  <div
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-xs font-bold uppercase",
                      deep.communitySentiment.overallSignal === "bullish"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : deep.communitySentiment.overallSignal === "bearish"
                        ? "bg-red-500/15 text-red-400"
                        : deep.communitySentiment.overallSignal === "mixed"
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-gray-500/15 text-gray-400"
                    )}
                  >
                    {deep.communitySentiment.overallSignal}
                  </div>
                  <div className="flex-1">
                    <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          "h-full rounded-full transition-all duration-700",
                          deep.communitySentiment.weightedScore >= 0
                            ? "bg-emerald-500"
                            : "bg-red-500"
                        )}
                        style={{
                          width: `${
                            50 + deep.communitySentiment.weightedScore / 2
                          }%`,
                          marginLeft:
                            deep.communitySentiment.weightedScore < 0
                              ? `${
                                  50 +
                                  deep.communitySentiment.weightedScore / 2
                                }%`
                              : "50%",
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-gray-600">-100</span>
                      <span className="text-[10px] text-gray-400 font-semibold">
                        {deep.communitySentiment.weightedScore > 0 ? "+" : ""}
                        {deep.communitySentiment.weightedScore}
                      </span>
                      <span className="text-[10px] text-gray-600">+100</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  {deep.communitySentiment.keyTakeaway}
                </p>
                {deep.communitySentiment.notableConcerns.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[10px] text-red-400 uppercase tracking-wider font-semibold">
                      Concerns
                    </p>
                    {deep.communitySentiment.notableConcerns.map((c, i) => (
                      <p
                        key={i}
                        className="text-xs text-gray-400 pl-2 border-l border-red-500/30"
                      >
                        {c}
                      </p>
                    ))}
                  </div>
                )}
                {deep.communitySentiment.notableEndorsements.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">
                      Endorsements
                    </p>
                    {deep.communitySentiment.notableEndorsements.map((e, i) => (
                      <p
                        key={i}
                        className="text-xs text-gray-400 pl-2 border-l border-emerald-500/30"
                      >
                        {e}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Risk Factors */}
              <div className="glass-card p-6">
                <SectionHeader
                  icon={AlertTriangle}
                  title="Risk Factors"
                  iconColor="text-amber-400"
                />
                <div className="space-y-3">
                  {deep.riskFactors.map((rf, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-surface-2 border border-white/5"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-semibold text-white">
                          {rf.factor}
                        </p>
                        <RiskSeverityBadge severity={rf.severity} />
                      </div>
                      <p className="text-xs text-gray-400">{rf.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Row 3: Historical + Strengths/Weaknesses ── */}
          {deep && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Historical Context */}
              <div className="glass-card p-6">
                <SectionHeader icon={History} title="Historical Precedent" />
                {deep.historicalContext.hasHistoricalData ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-surface-2">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                        Similar Proposals
                      </p>
                      <p className="text-sm text-gray-300">
                        {deep.historicalContext.similarProposals}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-2">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                        Proposer Track Record
                      </p>
                      <p className="text-sm text-gray-300">
                        {deep.historicalContext.proposerTrackRecord}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-2">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                        Precedent Analysis
                      </p>
                      <p className="text-sm text-gray-300">
                        {deep.historicalContext.precedentAnalysis}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <History className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">
                      No historical precedent data available for this proposal.
                    </p>
                  </div>
                )}
              </div>

              {/* Strengths & Weaknesses */}
              <div className="glass-card p-6">
                <SectionHeader
                  icon={Scale}
                  title="Strengths & Weaknesses"
                  iconColor="text-polkadot-purple"
                />
                <StrengthWeaknessPanel
                  strengths={deep.strengthsAndWeaknesses.strengths}
                  weaknesses={deep.strengthsAndWeaknesses.weaknesses}
                />
              </div>
            </div>
          )}

          {/* ── Collective Recommendation ── */}
          {hasOnChain && (
            <CollectiveRecommendationCard
              categoryId={categoryId}
              riskScore={riskScore}
              baseRec={baseRec}
              baseConf={baseConf}
            />
          )}

          {/* ── Row 4: Vote + GovMind Stats ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <VotePanel referendumIndex={referendumIndex} proposalState={proposalState} onVoteSuccess={setVoteParams} onFlowStateChange={setVoteFlowState} />
            <div className="glass-card p-5">
              <SectionHeader
                icon={BarChart3}
                title="GovMind Votes"
                iconColor="text-polkadot-purple"
              />
              <GovMindStatsInline referendumIndex={referendumIndex} />
            </div>
          </div>

          {/* ── Row 5: Cross-VM + XCM Architecture ── */}
          <CrossVMFlowSection voteFlowState={voteFlowState} />

          {/* ── Row 6: Verify XCM Encoding (only after user votes) ── */}
          {voteParams && (
            <XCMVerificationPanel referendumIndex={referendumIndex} voteParams={voteParams} />
          )}

          {/* Loading indicator for deep analysis */}
          {apiLoading && !deep && (
            <div className="glass-card p-6 text-center">
              <Loader2 className="w-6 h-6 text-polkadot-pink animate-spin mx-auto mb-2" />
              <p className="text-xs text-gray-500">
                Loading deep analysis from GovMind API...
              </p>
            </div>
          )}

          {/* No deep analysis available */}
          {!apiLoading && !deep && (
            <div className="glass-card p-6 text-center border border-dashed border-white/10">
              <Brain className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500">
                Deep analysis not available. Run the backend with{" "}
                <code className="text-polkadot-pink">npm start</code> to
                generate treasury breakdowns, risk factors, and community
                sentiment analysis.
              </p>
            </div>
          )}
        </div>
      )}

      {/* AI Agent Chat */}
      <ChatAgent
        referendumIndex={referendumIndex}
        proposalTitle={title}
        userIdentity={chatIdentity}
        analysisExists={hasOnChain}
        collective={chatCollective}
      />
    </div>
  );
}

function GovMindStatsInline({
  referendumIndex,
}: {
  referendumIndex: number;
}) {
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
    <div className="space-y-3">
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
          <p className="text-lg font-bold text-polkadot-pink">
            {aiVoterCount}
          </p>
          <p className="text-[10px] text-gray-500 uppercase">AI Votes</p>
        </div>
      </div>
    </div>
  );
}
