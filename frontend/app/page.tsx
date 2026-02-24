"use client";

import { useAccount, useReadContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  ADDRESSES,
  AI_ORACLE_ABI,
  IDENTITY_VAULT_ABI,
  XCM_RELAY_ABI,
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
} from "lucide-react";
import Link from "next/link";

// Known referenda that may have been analyzed by the backend
const KNOWN_REFERENDA = [
  { id: 1836, title: "Polkadot-API 2026 Development Funding" },
  { id: 1831, title: "Polkadot Staking Dashboard: Protocol-Aligned Development" },
  { id: 1772, title: "Staking Dashboard: Improvements & DeFi Integration" },
  { id: 1766, title: "Polkawatch Decentralization Analytics Maintenance" },
  { id: 1703, title: "Polkadot Staking Dashboard: Sept 2025 - March 2026" },
];

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

export default function Dashboard() {
  const { data: analysisCount } = useReadContract({
    address: ADDRESSES.aiOracle,
    abi: AI_ORACLE_ABI,
    functionName: "getAnalyzedReferendaCount",
  });

  const count = analysisCount ? Number(analysisCount) : 0;

  // Read analyzed referendum IDs if any exist
  const { data: analyzedIds } = useReadContract({
    address: ADDRESSES.aiOracle,
    abi: AI_ORACLE_ABI,
    functionName: "getAnalyzedReferendaPaginated",
    args: [BigInt(0), BigInt(Math.max(count, 1))],
    query: { enabled: count > 0 },
  });

  // Build the list: show on-chain analyzed proposals + known fallbacks
  const onChainIds = analyzedIds
    ? Array.from(analyzedIds).map(Number)
    : [];
  const allIds = Array.from(new Set([...onChainIds, ...KNOWN_REFERENDA.map((r) => r.id)]));
  const titleMap = Object.fromEntries(KNOWN_REFERENDA.map((r) => [r.id, r.title]));

  return (
    <div>
      <HeroSection />
      <StatsHero />
      <XCMBanner />
      <IdentityBanner />

      {/* Proposals Grid */}
      <div id="proposals" className="mt-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Active Proposals</h2>
            <p className="text-sm text-gray-500 mt-1">
              AI-analyzed referenda from Polkadot OpenGov
            </p>
          </div>
          {count > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot" />
              {count} analyzed
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {allIds.map((id) => (
            <ProposalCard
              key={id}
              referendumIndex={id}
              title={titleMap[id]}
            />
          ))}
        </div>

        {allIds.length === 0 && (
          <div className="glass-card p-12 text-center">
            <Brain className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-400 mb-2">
              No proposals analyzed yet
            </h3>
            <p className="text-sm text-gray-500">
              Run the AI backend to analyze active Polkadot referenda
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
