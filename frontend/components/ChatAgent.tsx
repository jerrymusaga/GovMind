"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, X, Loader2, Bot, User } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface CollectiveInfo {
  name: string;
  philosophy: string;
  axes: number[];
  riskTolerance: number;
  focusAreas: string[];
}

interface ChatAgentProps {
  referendumIndex: number;
  proposalTitle: string;
  userIdentity?: { axes: number[]; riskTolerance: number } | null;
  analysisExists: boolean;
  collective?: CollectiveInfo | null;
}

export default function ChatAgent({
  referendumIndex,
  proposalTitle,
  userIdentity,
  analysisExists,
  collective,
}: ChatAgentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat/${referendumIndex}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-10),
          userIdentity: userIdentity || undefined,
          collective: collective || undefined,
        }),
      });

      if (!res.ok) throw new Error("Chat request failed");

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I couldn't process that. Make sure the backend is running.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const suggestions = [
    "Should I vote Aye or Nay?",
    "What are the main risks?",
    ...(collective ? ["What would my collective vote?"] : ["Explain the treasury impact"]),
  ];

  return (
    <>
      {/* Floating bubble */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-polkadot-pink to-polkadot-purple flex items-center justify-center shadow-lg shadow-polkadot-pink/25 hover:scale-110 transition-transform"
        >
          <MessageSquare className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Chat overlay */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[520px] flex flex-col rounded-2xl border border-white/10 bg-surface-1/95 backdrop-blur-xl shadow-2xl shadow-black/50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-polkadot-pink to-polkadot-purple flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">GovMind Agent</p>
                <p className="text-[10px] text-gray-500">
                  Ref #{referendumIndex} · {analysisExists ? "Analysis loaded" : "No analysis"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {/* Welcome message */}
            {messages.length === 0 && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-polkadot-pink/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3 h-3 text-polkadot-pink" />
                </div>
                <div className="bg-surface-3 rounded-xl rounded-tl-sm px-3 py-2 text-sm text-gray-300 max-w-[85%]">
                  I&apos;m GovMind&apos;s AI agent. Ask me anything about{" "}
                  <span className="text-white font-medium">{proposalTitle}</span> —
                  risk factors, treasury impact, or whether you should vote Aye or Nay.
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-polkadot-pink/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3 h-3 text-polkadot-pink" />
                  </div>
                )}
                <div
                  className={`rounded-xl px-3 py-2 text-sm max-w-[85%] ${
                    msg.role === "user"
                      ? "bg-polkadot-pink/20 text-white rounded-tr-sm"
                      : "bg-surface-3 text-gray-300 rounded-tl-sm"
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-3 h-3 text-gray-400" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-polkadot-pink/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3 h-3 text-polkadot-pink" />
                </div>
                <div className="bg-surface-3 rounded-xl rounded-tl-sm px-3 py-2">
                  <Loader2 className="w-4 h-4 text-polkadot-pink animate-spin" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick suggestions */}
          <div className="flex flex-wrap gap-1.5 px-3 pt-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setInput(s);
                  setTimeout(() => inputRef.current?.focus(), 0);
                }}
                className="text-[11px] px-2.5 py-1 rounded-full border border-white/10 text-gray-400 hover:text-white hover:border-polkadot-pink/30 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-white/10">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about this proposal..."
                className="flex-1 px-3 py-2 bg-surface-2 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-polkadot-pink/50 transition-colors"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-xl bg-gradient-to-r from-polkadot-pink to-polkadot-purple flex items-center justify-center disabled:opacity-30 hover:scale-105 transition-transform"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
