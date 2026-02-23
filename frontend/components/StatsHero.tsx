"use client";

import { useReadContract } from "wagmi";
import { ADDRESSES, AI_ORACLE_ABI, GOVMIND_CORE_ABI, IDENTITY_VAULT_ABI } from "@/lib/contracts";
import { Brain, Vote, Users, Activity } from "lucide-react";

function StatCard({
  icon: Icon,
  label,
  value,
  gradient,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  gradient: string;
}) {
  return (
    <div className="glass-card p-5 relative overflow-hidden group">
      <div
        className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${gradient}`}
      />
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
            <Icon className="w-5 h-5 text-gray-400" />
          </div>
          <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">
            {label}
          </span>
        </div>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

export function StatsHero() {
  const { data: totalAnalyses } = useReadContract({
    address: ADDRESSES.aiOracle,
    abi: AI_ORACLE_ABI,
    functionName: "totalAnalyses",
  });

  const { data: totalVotes } = useReadContract({
    address: ADDRESSES.govMindCore,
    abi: GOVMIND_CORE_ABI,
    functionName: "totalVotesCast",
  });

  const { data: totalAIVotes } = useReadContract({
    address: ADDRESSES.govMindCore,
    abi: GOVMIND_CORE_ABI,
    functionName: "totalAIVotes",
  });

  const { data: totalIdentities } = useReadContract({
    address: ADDRESSES.identityVault,
    abi: IDENTITY_VAULT_ABI,
    functionName: "totalIdentities",
  });

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={Brain}
        label="AI Analyses"
        value={totalAnalyses?.toString() || "0"}
        gradient="bg-gradient-to-br from-polkadot-purple/10 to-transparent"
      />
      <StatCard
        icon={Vote}
        label="Total Votes"
        value={totalVotes?.toString() || "0"}
        gradient="bg-gradient-to-br from-polkadot-pink/10 to-transparent"
      />
      <StatCard
        icon={Activity}
        label="AI Votes"
        value={totalAIVotes?.toString() || "0"}
        gradient="bg-gradient-to-br from-emerald-500/10 to-transparent"
      />
      <StatCard
        icon={Users}
        label="Identities"
        value={totalIdentities?.toString() || "0"}
        gradient="bg-gradient-to-br from-amber-500/10 to-transparent"
      />
    </div>
  );
}
