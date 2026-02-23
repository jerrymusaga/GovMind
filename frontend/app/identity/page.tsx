"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ADDRESSES, IDENTITY_VAULT_ABI, PREFERENCE_AXES } from "@/lib/contracts";
import {
  Fingerprint,
  Shield,
  TrendingUp,
  Zap,
  Lock,
  Users,
  Server,
  Save,
  CheckCircle2,
  Loader2,
  Brain,
  ToggleLeft,
  ToggleRight,
  Settings,
} from "lucide-react";
import clsx from "clsx";

const AXIS_ICONS = [Shield, TrendingUp, Zap, Lock, Users, Server];

function PreferenceSlider({
  axis,
  value,
  onChange,
}: {
  axis: (typeof PREFERENCE_AXES)[number];
  value: number;
  onChange: (v: number) => void;
}) {
  const Icon = AXIS_ICONS[axis.id];

  return (
    <div className="glass-card p-5 group hover:border-white/10 transition-all">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${axis.color}15` }}
        >
          <Icon className="w-5 h-5" style={{ color: axis.color }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{axis.name}</p>
          <p className="text-xs text-gray-500">{axis.description}</p>
        </div>
        <div
          className="text-lg font-bold min-w-[3ch] text-right"
          style={{ color: axis.color }}
        >
          {value}
        </div>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={
          {
            "--thumb-color": axis.color,
          } as React.CSSProperties
        }
      />
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-gray-600">Low priority</span>
        <span className="text-[10px] text-gray-600">High priority</span>
      </div>
    </div>
  );
}

function PreferenceRadar({ weights }: { weights: number[] }) {
  const size = 200;
  const center = size / 2;
  const radius = 75;
  const angles = weights.map((_, i) => (Math.PI * 2 * i) / 6 - Math.PI / 2);

  const points = weights
    .map((w, i) => {
      const r = (w / 100) * radius;
      const x = center + r * Math.cos(angles[i]);
      const y = center + r * Math.sin(angles[i]);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="glass-card p-6">
      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <Brain className="w-4 h-4 text-polkadot-pink" />
        Your Governance Profile
      </h3>
      <div className="flex justify-center">
        <svg width={size} height={size} className="overflow-visible">
          {/* Grid rings */}
          {[25, 50, 75, 100].map((pct) => (
            <circle
              key={pct}
              cx={center}
              cy={center}
              r={(pct / 100) * radius}
              fill="none"
              stroke="#232333"
              strokeWidth="1"
            />
          ))}
          {/* Grid lines */}
          {angles.map((a, i) => (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={center + radius * Math.cos(a)}
              y2={center + radius * Math.sin(a)}
              stroke="#232333"
              strokeWidth="1"
            />
          ))}
          {/* Data polygon */}
          <polygon
            points={points}
            fill="rgba(230, 0, 122, 0.15)"
            stroke="#E6007A"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Data points */}
          {weights.map((w, i) => {
            const r = (w / 100) * radius;
            const x = center + r * Math.cos(angles[i]);
            const y = center + r * Math.sin(angles[i]);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="4"
                fill={PREFERENCE_AXES[i].color}
                stroke="#0A0A0F"
                strokeWidth="2"
              />
            );
          })}
          {/* Labels */}
          {PREFERENCE_AXES.map((axis, i) => {
            const labelR = radius + 25;
            const x = center + labelR * Math.cos(angles[i]);
            const y = center + labelR * Math.sin(angles[i]);
            return (
              <text
                key={i}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-gray-500 text-[9px] font-medium"
              >
                {axis.name.split(" ").pop()}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function IdentityPage() {
  const { address, isConnected } = useAccount();

  const [weights, setWeights] = useState([50, 50, 50, 50, 50, 50]);
  const [riskTolerance, setRiskTolerance] = useState(50);
  const [minConfidence, setMinConfidence] = useState(60);
  const [maxAutoVoteDOT, setMaxAutoVoteDOT] = useState("100");
  const [tab, setTab] = useState<"preferences" | "settings">("preferences");

  // Read existing identity
  const { data: hasIdentity, refetch: refetchIdentity } = useReadContract({
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

  const { data: existingIdentity } = useReadContract({
    address: ADDRESSES.identityVault,
    abi: IDENTITY_VAULT_ABI,
    functionName: "identities",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address && !!hasIdentity },
  });

  // Load existing data
  useEffect(() => {
    if (existingWeights) {
      setWeights(Array.from(existingWeights).map(Number));
    }
  }, [existingWeights]);

  useEffect(() => {
    if (existingIdentity && existingIdentity[0]) {
      setRiskTolerance(Number(existingIdentity[1]));
      setMinConfidence(Number(existingIdentity[2]));
      setMaxAutoVoteDOT(existingIdentity[3].toString());
    }
  }, [existingIdentity]);

  // Write contracts
  const { writeContract: createIdentity, data: createHash, isPending: isCreating } =
    useWriteContract();
  const { writeContract: updatePrefs, data: updateHash, isPending: isUpdating } =
    useWriteContract();
  const { writeContract: toggleAutoVote, isPending: isToggling } =
    useWriteContract();

  const { isLoading: isConfirmingCreate, isSuccess: createSuccess } =
    useWaitForTransactionReceipt({ hash: createHash });
  const { isLoading: isConfirmingUpdate, isSuccess: updateSuccess } =
    useWaitForTransactionReceipt({ hash: updateHash });

  useEffect(() => {
    if (createSuccess || updateSuccess) refetchIdentity();
  }, [createSuccess, updateSuccess, refetchIdentity]);

  const handleSave = () => {
    const axes = weights.map((_, i) => i);
    const w = weights;

    if (hasIdentity) {
      updatePrefs({
        address: ADDRESSES.identityVault,
        abi: IDENTITY_VAULT_ABI,
        functionName: "updatePreferences",
        args: [axes, w],
      });
    } else {
      createIdentity({
        address: ADDRESSES.identityVault,
        abi: IDENTITY_VAULT_ABI,
        functionName: "createIdentity",
        args: [
          riskTolerance,
          minConfidence,
          parseEther(maxAutoVoteDOT || "0"),
          "",
          axes,
          w,
        ],
      });
    }
  };

  const autoVoteEnabled = existingIdentity ? existingIdentity[4] : false;

  const isPending = isCreating || isUpdating || isConfirmingCreate || isConfirmingUpdate;

  if (!isConnected) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-polkadot-pink/20 to-polkadot-purple/20 flex items-center justify-center">
          <Fingerprint className="w-10 h-10 text-polkadot-pink" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">
          Governance Identity
        </h1>
        <p className="text-gray-400 mb-8">
          Connect your wallet to create or manage your on-chain governance identity
        </p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-polkadot-pink to-polkadot-purple flex items-center justify-center">
            <Fingerprint className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {hasIdentity ? "Your Governance Identity" : "Create Identity"}
            </h1>
            <p className="text-sm text-gray-400">
              {hasIdentity
                ? "Update your governance philosophy & preferences"
                : "Define your governance values to get personalized AI recommendations"}
            </p>
          </div>
        </div>

        {hasIdentity && (
          <div className="flex items-center gap-2 mt-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3" /> Identity Active
            </span>
            <button
              onClick={() =>
                toggleAutoVote({
                  address: ADDRESSES.identityVault,
                  abi: IDENTITY_VAULT_ABI,
                  functionName: "toggleAutoVote",
                  args: [!autoVoteEnabled],
                })
              }
              disabled={isToggling}
              className={clsx(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer",
                autoVoteEnabled
                  ? "bg-polkadot-pink/15 text-polkadot-pink border-polkadot-pink/30"
                  : "bg-surface-3 text-gray-400 border-white/10 hover:border-white/20"
              )}
            >
              {autoVoteEnabled ? (
                <ToggleRight className="w-3 h-3" />
              ) : (
                <ToggleLeft className="w-3 h-3" />
              )}
              Auto-Vote {autoVoteEnabled ? "On" : "Off"}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-2 rounded-xl w-fit mb-8">
        {(["preferences", "settings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              tab === t
                ? "bg-surface-4 text-white shadow-sm"
                : "text-gray-500 hover:text-white"
            )}
          >
            {t === "preferences" ? (
              <Brain className="w-3.5 h-3.5" />
            ) : (
              <Settings className="w-3.5 h-3.5" />
            )}
            {t === "preferences" ? "Preferences" : "Settings"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {tab === "preferences" ? (
            <>
              {PREFERENCE_AXES.map((axis) => (
                <PreferenceSlider
                  key={axis.id}
                  axis={axis}
                  value={weights[axis.id]}
                  onChange={(v) => {
                    const next = [...weights];
                    next[axis.id] = v;
                    setWeights(next);
                  }}
                />
              ))}
            </>
          ) : (
            <div className="space-y-4">
              <div className="glass-card p-5">
                <label className="text-sm font-semibold text-white mb-3 block">
                  Risk Tolerance
                </label>
                <p className="text-xs text-gray-500 mb-4">
                  How much risk are you comfortable with in governance proposals?
                </p>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={riskTolerance}
                    onChange={(e) => setRiskTolerance(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-lg font-bold text-polkadot-pink w-10 text-right">
                    {riskTolerance}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-gray-600">Risk averse</span>
                  <span className="text-[10px] text-gray-600">Risk tolerant</span>
                </div>
              </div>

              <div className="glass-card p-5">
                <label className="text-sm font-semibold text-white mb-3 block">
                  Min AI Confidence
                </label>
                <p className="text-xs text-gray-500 mb-4">
                  Minimum AI confidence required before auto-voting
                </p>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={minConfidence}
                    onChange={(e) => setMinConfidence(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-lg font-bold text-polkadot-purple w-10 text-right">
                    {minConfidence}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-gray-600">Low threshold</span>
                  <span className="text-[10px] text-gray-600">High threshold</span>
                </div>
              </div>

              <div className="glass-card p-5">
                <label className="text-sm font-semibold text-white mb-3 block">
                  Max Auto-Vote Amount (PAS)
                </label>
                <p className="text-xs text-gray-500 mb-4">
                  Maximum tokens the AI can commit per vote
                </p>
                <input
                  type="number"
                  value={maxAutoVoteDOT}
                  onChange={(e) => setMaxAutoVoteDOT(e.target.value)}
                  className="input-field"
                  placeholder="100"
                  min="0"
                />
              </div>
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isPending}
            className="btn-primary w-full flex items-center justify-center gap-2 text-base"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isConfirmingCreate || isConfirmingUpdate
                  ? "Confirming..."
                  : "Submitting..."}
              </>
            ) : createSuccess || updateSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {hasIdentity ? "Update Identity" : "Create Identity"}
              </>
            )}
          </button>
        </div>

        {/* Sidebar - Radar Chart */}
        <div className="space-y-4">
          <PreferenceRadar weights={weights} />

          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-3">
              How It Works
            </h3>
            <ol className="space-y-3">
              {[
                "Set your 6 governance preference axes",
                "AI analyzes each proposal on-chain",
                "Your identity modifies the recommendation",
                "Same proposal, different users = different advice",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-polkadot-pink/20 text-polkadot-pink text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-xs text-gray-400">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
