"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { Brain, LayoutDashboard, Fingerprint, Vote, Users, Menu, X, Shield } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/proposals", label: "Proposals", icon: Vote },
  { href: "/collectives", label: "Collectives", icon: Shield },
  { href: "/delegation", label: "Delegation", icon: Users },
  { href: "/identity", label: "Identity", icon: Fingerprint },
];

export function Navbar() {
  const pathname = usePathname();
  const { isConnected } = useAccount();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-surface-0/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-polkadot-pink to-polkadot-purple flex items-center justify-center shadow-lg shadow-polkadot-pink/20 group-hover:shadow-polkadot-pink/40 transition-shadow">
                <Brain className="w-5 h-5 text-white" />
              </div>
              {isConnected && (
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-surface-0 live-dot" />
              )}
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight">
                Gov<span className="gradient-text">Mind</span>
              </span>
              <span className="hidden sm:block text-[10px] text-gray-500 -mt-1 tracking-wider uppercase">
                AI Governance Layer
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                    active
                      ? "bg-polkadot-pink/10 text-polkadot-pink"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </div>

          {/* Wallet + Mobile Toggle */}
          <div className="flex items-center gap-3">
            <ConnectButton
              showBalance={false}
              chainStatus="icon"
              accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
            />
            <button
              className="md:hidden p-2 text-gray-400 hover:text-white"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/5 bg-surface-1/95 backdrop-blur-xl">
          <div className="px-4 py-3 space-y-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                    active
                      ? "bg-polkadot-pink/10 text-polkadot-pink"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
