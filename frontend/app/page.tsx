"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  ADDRESSES,
  AI_ORACLE_ABI,
  XCM_RELAY_ABI,
  PVM_STATUS_ABI,
  GOVMIND_CORE_ADMIN_ABI,
  XCM_RELAY_ADMIN_ABI,
} from "@/lib/contracts";
import {
  Brain,
  Sparkles,
  ArrowRight,
  Fingerprint,
  ShieldCheck,
  Globe,
  Layers,
  Cpu,
  ArrowRightLeft,
  Zap,
  BarChart3,
  Vote,
  Code2,
  CheckCircle2,
  Loader2,
  Settings,
  Users,
  Shield,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";

// ─── Hero Section ───

function HeroSection() {
  const { isConnected } = useAccount();

  return (
    <div className="relative py-16 text-center max-w-4xl mx-auto">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full bg-polkadot-pink/10 border border-polkadot-pink/20">
        <Sparkles className="w-3.5 h-3.5 text-polkadot-pink" />
        <span className="text-xs font-medium text-polkadot-pink">
          AI-Powered Governance · Live on Testnet
        </span>
      </div>

      <h1 className="text-5xl sm:text-6xl font-bold mb-6 tracking-tight leading-tight">
        Your{" "}
        <span className="gradient-text">AI Governance</span>
        <br />
        Co-Pilot for OpenGov
      </h1>

      <p className="text-gray-400 text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
        GovMind uses AI to analyze Polkadot governance proposals, match them to your
        personal values, and execute votes cross-chain via XCM &mdash; all from a single
        interface on Polkadot Hub EVM.
      </p>

      {!isConnected ? (
        <div className="flex flex-col items-center gap-4">
          <ConnectButton />
          <p className="text-xs text-gray-500">
            Connect your wallet to get started
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/proposals" className="btn-primary flex items-center gap-2 text-base px-6 py-3">
            <Vote className="w-5 h-5" />
            Browse Proposals
          </Link>
          <Link href="/collectives" className="btn-secondary flex items-center gap-2 text-base px-6 py-3">
            <Shield className="w-5 h-5" />
            Join a Collective
          </Link>
          <Link href="/identity" className="btn-secondary flex items-center gap-2 text-base px-6 py-3">
            <Fingerprint className="w-5 h-5" />
            Set Up Identity
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── How It Works ───

function HowItWorks() {
  const steps = [
    {
      num: "01",
      icon: Fingerprint,
      title: "Create Your Identity",
      desc: "Define your governance philosophy across 6 axes: decentralization, treasury, technical, community, security, and ecosystem growth.",
    },
    {
      num: "02",
      icon: Brain,
      title: "AI Analyzes Proposals",
      desc: "Our AI oracle reads each referendum, scores risk, and generates personalized alignment scores based on your identity.",
    },
    {
      num: "03",
      icon: Vote,
      title: "Vote with Confidence",
      desc: "See clear recommendations, understand the tradeoffs, and cast your vote directly from the interface.",
    },
    {
      num: "04",
      icon: Globe,
      title: "Cross-Chain Execution",
      desc: "Your vote is SCALE-encoded, wrapped in an XCM V5 message, and relayed to Polkadot Relay Chain — seamlessly.",
    },
  ];

  return (
    <div className="py-16">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-white mb-3">How GovMind Works</h2>
        <p className="text-gray-400 max-w-lg mx-auto">
          From identity setup to cross-chain vote execution in four steps.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {steps.map(({ num, icon: Icon, title, desc }) => (
          <div key={num} className="relative p-6 rounded-2xl bg-surface-1/50 border border-white/5 hover:border-polkadot-pink/20 transition-colors group">
            <span className="text-4xl font-black text-white/5 absolute top-4 right-4 group-hover:text-polkadot-pink/10 transition-colors">
              {num}
            </span>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-polkadot-pink/20 to-polkadot-purple/20 flex items-center justify-center mb-4">
              <Icon className="w-5 h-5 text-polkadot-pink" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Architecture Section ───

function ArchitectureSection() {
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

  const { data: pvmAggregatorEnabled } = useReadContract({
    address: ADDRESSES.collectiveRegistry,
    abi: [{
      name: "usePVMAggregator",
      type: "function",
      stateMutability: "view",
      inputs: [],
      outputs: [{ name: "", type: "bool" }],
    }] as const,
    functionName: "usePVMAggregator",
  });

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

  const { data: analysisCount } = useReadContract({
    address: ADDRESSES.aiOracle,
    abi: AI_ORACLE_ABI,
    functionName: "getAnalyzedReferendaCount",
  });

  return (
    <div className="py-16">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-white mb-3">Architecture</h2>
        <p className="text-gray-400 max-w-lg mx-auto">
          Built on Polkadot Hub with EVM + PVM cross-VM and XCM cross-chain capabilities.
        </p>
      </div>

      {/* Live stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {[
          { label: "AI Analyses", value: analysisCount ? Number(analysisCount) : 0, color: "text-polkadot-pink" },
          { label: "XCM Relayed", value: totalRelayed ? Number(totalRelayed) : 0, color: "text-polkadot-purple" },
          { label: "Relay Status", value: relayEnabled ? "Live" : "Ready", color: "text-emerald-400" },
          { label: "PVM Modules", value: `${(pvmScorerEnabled ? 1 : 0) + (pvmAggregatorEnabled ? 1 : 0)}/2`, color: "text-cyan-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-4 rounded-xl bg-surface-1/50 border border-white/5 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Cross-VM + XCM flow */}
      <div className="p-6 rounded-2xl bg-surface-1/30 border border-white/5">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6 text-center">
          Vote Execution Pipeline
        </h3>
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
          {[
            { icon: Code2, label: "GovMindCore", sub: "EVM Solidity", color: "border-polkadot-pink/30", iconColor: "text-polkadot-pink" },
            { icon: Cpu, label: "AlignmentScorer", sub: "PVM Rust · 690B", color: "border-cyan-500/30", iconColor: "text-cyan-400" },
            { icon: Cpu, label: "ScaleCodecPVM", sub: "PVM Rust · 1,523B", color: "border-cyan-500/30", iconColor: "text-cyan-400" },
            { icon: Cpu, label: "Aggregator", sub: "PVM Rust · 1,148B", color: "border-cyan-500/30", iconColor: "text-cyan-400" },
            { icon: Layers, label: "XCM Precompile", sub: "0x0A0000", color: "border-polkadot-purple/30", iconColor: "text-polkadot-purple" },
            { icon: Globe, label: "Relay Chain", sub: "convictionVoting", color: "border-emerald-500/30", iconColor: "text-emerald-400" },
          ].map(({ icon: Icon, label, sub, color, iconColor }, i, arr) => (
            <div key={label} className="flex items-center gap-3">
              <div className={`px-4 py-3 rounded-xl bg-surface-2 border ${color} text-center min-w-[100px]`}>
                <Icon className={`w-5 h-5 ${iconColor} mx-auto mb-1.5`} />
                <span className="text-gray-300 font-medium block">{label}</span>
                <span className="text-[10px] text-gray-500">{sub}</span>
              </div>
              {i < arr.length - 1 && (
                <ArrowRight className="w-4 h-4 text-gray-600 shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* PVM status pills */}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] ${
            pvmCodecEnabled
              ? "bg-cyan-500/10 border border-cyan-500/20"
              : "bg-surface-2 border border-white/10"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${pvmCodecEnabled ? "bg-cyan-400 animate-pulse" : "bg-gray-600"}`} />
            <span className="text-gray-400">ScaleCodecPVM</span>
            <span className={`font-medium ${pvmCodecEnabled ? "text-cyan-400" : "text-gray-500"}`}>
              {pvmCodecEnabled ? "Active" : "Deployed"}
            </span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] ${
            pvmScorerEnabled
              ? "bg-cyan-500/10 border border-cyan-500/20"
              : "bg-surface-2 border border-white/10"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${pvmScorerEnabled ? "bg-cyan-400 animate-pulse" : "bg-gray-600"}`} />
            <span className="text-gray-400">AlignmentScorer</span>
            <span className={`font-medium ${pvmScorerEnabled ? "text-cyan-400" : "text-gray-500"}`}>
              {pvmScorerEnabled ? "Active" : "Deployed"}
            </span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] ${
            pvmAggregatorEnabled
              ? "bg-cyan-500/10 border border-cyan-500/20"
              : "bg-surface-2 border border-white/10"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${pvmAggregatorEnabled ? "bg-cyan-400 animate-pulse" : "bg-gray-600"}`} />
            <span className="text-gray-400">CollectiveAggregator</span>
            <span className={`font-medium ${pvmAggregatorEnabled ? "text-cyan-400" : "text-gray-500"}`}>
              {pvmAggregatorEnabled ? "Active" : "Deployed"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Features Grid ───

function FeaturesGrid() {
  const features = [
    {
      icon: Brain,
      title: "AI Oracle",
      desc: "On-chain AI analysis with risk scores, category detection, and personalized alignment recommendations stored immutably.",
      color: "from-polkadot-pink/20 to-polkadot-purple/20",
      iconColor: "text-polkadot-pink",
    },
    {
      icon: Fingerprint,
      title: "Governance Identity",
      desc: "6-axis identity profile that captures your governance philosophy — used by the AI to match proposals to your values.",
      color: "from-polkadot-purple/20 to-blue-500/20",
      iconColor: "text-polkadot-purple",
    },
    {
      icon: Globe,
      title: "XCM Cross-Chain Voting",
      desc: "Vote on Polkadot Relay Chain referenda directly from Hub EVM. SCALE-encoded, XCM V5 wrapped, and relayed cross-chain.",
      color: "from-polkadot-purple/20 to-emerald-500/20",
      iconColor: "text-polkadot-purple",
    },
    {
      icon: Cpu,
      title: "Cross-VM (EVM + PVM)",
      desc: "Rust PVM contracts for SCALE encoding and alignment scoring run on RISC-V alongside EVM via pallet-revive cross-VM dispatch.",
      color: "from-cyan-500/20 to-polkadot-purple/20",
      iconColor: "text-cyan-400",
    },
    {
      icon: ShieldCheck,
      title: "On-Chain Proofs",
      desc: "Every AI analysis is stored on-chain with its hash, ensuring full transparency and auditability of all recommendations.",
      color: "from-emerald-500/20 to-cyan-500/20",
      iconColor: "text-emerald-400",
    },
    {
      icon: BarChart3,
      title: "Risk Scoring",
      desc: "Each proposal gets a 0-100 risk score with category breakdown — treasury impact, technical complexity, governance weight.",
      color: "from-amber-500/20 to-polkadot-pink/20",
      iconColor: "text-amber-400",
    },
    {
      icon: Users,
      title: "AI Voting Collectives",
      desc: "Join governance tribes with shared philosophies. Each collective has AI-generated recommendations — pick your tribe, vote in one click.",
      color: "from-violet-500/20 to-polkadot-pink/20",
      iconColor: "text-violet-400",
    },
  ];

  return (
    <div className="py-16">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-white mb-3">Features</h2>
        <p className="text-gray-400 max-w-lg mx-auto">
          Everything you need to participate in Polkadot governance intelligently.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map(({ icon: Icon, title, desc, color, iconColor }) => (
          <div key={title} className="p-6 rounded-2xl bg-surface-1/50 border border-white/5 hover:border-white/10 transition-colors">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-4`}>
              <Icon className={`w-6 h-6 ${iconColor}`} />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Smart Contracts Section ───

function ContractsSection() {
  const contracts = [
    { name: "GovMindCore", addr: ADDRESSES.govMindCore, type: "EVM" },
    { name: "AIOracle", addr: ADDRESSES.aiOracle, type: "EVM" },
    { name: "IdentityVault", addr: ADDRESSES.identityVault, type: "EVM" },
    { name: "XCMRelay", addr: ADDRESSES.xcmRelay, type: "EVM" },
    { name: "ScaleCodecPVM", addr: ADDRESSES.scaleCodecPVM, type: "PVM" },
    { name: "AlignmentScorerPVM", addr: ADDRESSES.alignmentScorerPVM, type: "PVM" },
    { name: "CollectiveAggregator", addr: ADDRESSES.collectiveAggregatorPVM, type: "PVM" },
    { name: "CollectiveRegistry", addr: ADDRESSES.collectiveRegistry, type: "EVM" },
  ];

  return (
    <div className="py-16">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-3">Deployed Contracts</h2>
        <p className="text-gray-400 max-w-lg mx-auto">
          All contracts are live on Polkadot Hub Testnet (Chain ID 420420417).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto">
        {contracts.map(({ name, addr, type }) => (
          <div key={name} className="flex items-center gap-3 p-3 rounded-xl bg-surface-1/50 border border-white/5">
            <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              type === "PVM"
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                : "bg-polkadot-pink/10 text-polkadot-pink border border-polkadot-pink/20"
            }`}>
              {type}
            </div>
            <a
              href={`https://blockscout-testnet.polkadot.io/address/${addr}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-0 group/link"
            >
              <p className="text-sm font-medium text-white group-hover/link:text-polkadot-pink transition-colors">{name}</p>
              <p className="text-[11px] text-gray-500 truncate font-mono group-hover/link:text-gray-400 transition-colors">{addr}</p>
            </a>
            <a
              href={`https://blockscout-testnet.polkadot.io/address/${addr}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-4 h-4 text-emerald-400 shrink-0 hover:text-polkadot-pink transition-colors" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PVM Admin Panel (owner only) ───

function PVMAdminPanel() {
  const { address, isConnected } = useAccount();

  const { data: coreOwner } = useReadContract({
    address: ADDRESSES.govMindCore,
    abi: GOVMIND_CORE_ADMIN_ABI,
    functionName: "owner",
  });

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

  const { data: xcmRelayEnabled } = useReadContract({
    address: ADDRESSES.govMindCore,
    abi: GOVMIND_CORE_ADMIN_ABI,
    functionName: "xcmRelayEnabled",
  });

  const isOwner = isConnected && address && coreOwner && address.toLowerCase() === (coreOwner as string).toLowerCase();

  const { writeContract: wireScorer, data: scorerTx, isPending: scorerPending } = useWriteContract();
  const { writeContract: wireCodec, data: codecTx, isPending: codecPending } = useWriteContract();
  const { writeContract: enableXcm, data: xcmTx, isPending: xcmPending } = useWriteContract();
  const { isSuccess: scorerSuccess } = useWaitForTransactionReceipt({ hash: scorerTx });
  const { isSuccess: codecSuccess } = useWaitForTransactionReceipt({ hash: codecTx });
  const { isSuccess: xcmSuccess } = useWaitForTransactionReceipt({ hash: xcmTx });

  if (!isOwner || (pvmCodecEnabled && pvmScorerEnabled && xcmRelayEnabled)) return null;

  return (
    <div className="py-8">
      <div className="p-6 rounded-2xl bg-surface-1/50 border border-cyan-500/20">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">PVM Admin Panel</h3>
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded">
            Owner Only
          </span>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Wire the PVM Rust contracts and enable XCM relay for cross-chain vote execution.
        </p>
        <div className="flex flex-wrap gap-3">
          {!pvmScorerEnabled && (
            <button
              onClick={() => wireScorer({
                address: ADDRESSES.govMindCore,
                abi: GOVMIND_CORE_ADMIN_ABI,
                functionName: "setPVMScorer",
                args: [ADDRESSES.alignmentScorerPVM, true],
              })}
              disabled={scorerPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 transition-all disabled:opacity-50"
            >
              {scorerPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
              {scorerSuccess ? "AlignmentScorer Wired" : "Wire AlignmentScorer"}
            </button>
          )}
          {!pvmCodecEnabled && (
            <button
              onClick={() => wireCodec({
                address: ADDRESSES.xcmRelay,
                abi: XCM_RELAY_ADMIN_ABI,
                functionName: "setPVMCodec",
                args: [ADDRESSES.scaleCodecPVM, true],
              })}
              disabled={codecPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 transition-all disabled:opacity-50"
            >
              {codecPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
              {codecSuccess ? "ScaleCodecPVM Wired" : "Wire ScaleCodecPVM"}
            </button>
          )}
          {!xcmRelayEnabled && (
            <button
              onClick={() => enableXcm({
                address: ADDRESSES.govMindCore,
                abi: GOVMIND_CORE_ADMIN_ABI,
                functionName: "toggleXCMRelay",
                args: [true],
              })}
              disabled={xcmPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-polkadot-purple/15 text-polkadot-purple border border-polkadot-purple/30 hover:bg-polkadot-purple/25 transition-all disabled:opacity-50"
            >
              {xcmPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              {xcmSuccess ? "XCM Relay Enabled" : "Enable XCM Relay"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CTA Section ───

function CTASection() {
  const { isConnected } = useAccount();

  return (
    <div className="py-16 text-center">
      <div className="p-10 rounded-2xl bg-gradient-to-r from-polkadot-pink/10 via-surface-1 to-polkadot-purple/10 border border-polkadot-pink/20">
        <Zap className="w-10 h-10 text-polkadot-pink mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-3">
          Ready to govern smarter?
        </h2>
        <p className="text-gray-400 mb-6 max-w-md mx-auto">
          Set up your governance identity and start getting AI-powered recommendations
          tailored to your values.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/proposals" className="btn-primary flex items-center gap-2 px-6 py-3">
            <Vote className="w-5 h-5" />
            Browse Proposals
          </Link>
          {isConnected && (
            <Link href="/identity" className="btn-secondary flex items-center gap-2 px-6 py-3">
              <Fingerprint className="w-5 h-5" />
              Create Identity
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Home Page ───

export default function HomePage() {
  return (
    <div>
      <HeroSection />
      <HowItWorks />
      <FeaturesGrid />
      <ArchitectureSection />
      <ContractsSection />
      <PVMAdminPanel />
      <CTASection />
    </div>
  );
}
