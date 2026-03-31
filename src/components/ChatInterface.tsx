"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import type { DataSummary } from "@/lib/dataPreprocessor";

interface Message {
  role: "user" | "ai";
  text: string;
}

interface ChatInterfaceProps {
  context: DataSummary | null;
  suggestedQuestions?: string[];
}

const normalizeQuestion = (question: string) => question.trim().replace(/\s+/g, " ");

const buildFallbackQuestions = (context: DataSummary | null): string[] => {
  if (!context?.tables?.length) {
    return [
      "What stands out most in this dataset?",
      "What should I investigate first?",
      "Which pattern matters most here?",
      "What action would you recommend first?",
    ];
  }

  const primaryTable = context.tables[0];
  const topMetric = primaryTable.numericColumns[0]?.name;
  const topCategory = primaryTable.categoricalColumns[0]?.name;
  const topBreakdown = primaryTable.keyAggregations[0];

  const questions = [
    topMetric ? `What drives ${topMetric.replace(/_/g, " ")} the most?` : "",
    topCategory ? `Which ${topCategory.replace(/_/g, " ")} stands out most?` : "",
    topBreakdown ? `How does ${topBreakdown.metric.replace(/_/g, " ")} vary by ${topBreakdown.groupBy.replace(/_/g, " ")}?` : "",
    "What should I investigate first?",
    "What action would you recommend first?",
    "What is the biggest hidden risk here?",
  ];

  return questions
    .map(normalizeQuestion)
    .filter(Boolean)
    .filter((question, index, list) => list.indexOf(question) === index)
    .slice(0, 5);
};

export default function ChatInterface({ context, suggestedQuestions }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [usedSuggestions, setUsedSuggestions] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const questionOptions = useMemo(() => {
    const llmSuggestions = (suggestedQuestions || [])
      .map(normalizeQuestion)
      .filter(Boolean);

    const source = llmSuggestions.length > 0
      ? llmSuggestions
      : buildFallbackQuestions(context);

    return source
      .filter((question, index, list) => list.indexOf(question) === index)
      .slice(0, 5);
  }, [context, suggestedQuestions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setMessages([]);
    setInput("");
    setUsedSuggestions([]);
  }, [context, suggestedQuestions]);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isLoading) return;
    setInput("");

    const normalizedMessage = normalizeQuestion(msg);
    if (questionOptions.includes(normalizedMessage)) {
      setUsedSuggestions((prev) =>
        prev.includes(normalizedMessage) ? prev : [...prev, normalizedMessage]
      );
    }

    const userMsg: Message = { role: "user", text: msg };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, context }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to get answer.");
      setMessages(prev => [...prev, { role: "ai", text: json.answer }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: "ai", text: `⚠️ ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] flex flex-col h-[600px] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/5 flex items-center gap-3 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/30 to-indigo-500/30 border border-violet-500/20 flex items-center justify-center text-lg">💬</div>
        <div>
          <h3 className="text-white font-bold text-sm">Chat with your data</h3>
          <p className="text-white/40 text-xs">Ask anything in plain English</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {questionOptions.length > 0 && (
          <div className={`flex flex-col gap-3 ${messages.length === 0 ? "mt-4" : ""}`}>
            <div className="flex items-center justify-between">
              <p className="text-white/30 text-xs uppercase tracking-[0.22em]">
                {messages.length === 0 ? "Try asking" : "Suggested follow-ups"}
              </p>
              {usedSuggestions.length > 0 && (
                <p className="text-white/20 text-[11px]">
                  {usedSuggestions.length} asked
                </p>
              )}
            </div>
            {questionOptions.map((question, index) => {
              const isUsed = usedSuggestions.includes(question);
              return (
                <motion.button
                  key={question}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.07 }}
                  onClick={() => sendMessage(question)}
                  disabled={!context || isLoading || isUsed}
                  className={`group text-left rounded-2xl border px-4 py-3.5 transition-all ${
                    isUsed
                      ? "border-white/5 bg-white/[0.02] text-white/25 cursor-not-allowed"
                      : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:text-white/95"
                  } disabled:opacity-100`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm leading-relaxed">{question}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-[0.22em] ${
                      isUsed ? "text-white/20" : "text-indigo-300/70"
                    }`}>
                      {isUsed ? "Asked" : "Prompt"}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}

        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "ai" && (
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500/30 to-indigo-500/30 flex items-center justify-center text-xs mr-2 flex-shrink-0 mt-1">✨</div>
            )}
            <div
              className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-indigo-600/30 border border-indigo-500/30 text-white/90 rounded-tr-sm"
                  : "bg-white/[0.04] border border-white/10 text-white/80 rounded-tl-sm"
              }`}
            >
              {msg.text}
            </div>
          </motion.div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 ml-8">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-indigo-400"
                animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
              />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-4 border-t border-white/5 flex-shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder={context ? "Ask about your data..." : "Upload a file to start chatting"}
            disabled={!context || isLoading}
            className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all disabled:opacity-40"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || !context || isLoading}
            className="w-11 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
