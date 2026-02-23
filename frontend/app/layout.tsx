"use client";

import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { config } from "@/lib/wagmi";
import { Navbar } from "@/components/Navbar";

const queryClient = new QueryClient();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>GovMind - AI Governance Intelligence for Polkadot</title>
        <meta
          name="description"
          content="AI-powered personalized governance recommendations for Polkadot OpenGov"
        />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🧠</text></svg>" />
      </head>
      <body className="min-h-screen bg-surface-0 antialiased">
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider
              theme={darkTheme({
                accentColor: "#E6007A",
                accentColorForeground: "white",
                borderRadius: "large",
                overlayBlur: "small",
              })}
            >
              {/* Background ambient glow */}
              <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-polkadot-pink/5 rounded-full blur-[128px]" />
                <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-polkadot-purple/5 rounded-full blur-[128px]" />
              </div>

              <div className="relative z-10">
                <Navbar />
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                  {children}
                </main>
              </div>
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
