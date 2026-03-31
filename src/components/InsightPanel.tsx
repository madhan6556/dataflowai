"use client";
import { motion, AnimatePresence } from "framer-motion";
import type { InsightResult } from "@/app/api/generate-insights/route";

interface InsightPanelProps {
  insights: InsightResult | null;
  isLoading: boolean;
  fileName?: string;
}

const Section = ({ icon, title, items, color }: { icon: string; title: string; items: string[]; color: string }) => (
  <div className="flex flex-col gap-3">
    <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${color}`}>
      <span>{icon}</span>{title}
    </h3>
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => (
        <motion.li
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06 }}
          className="flex items-start gap-3 text-sm text-white/80 leading-relaxed"
        >
          <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${color.replace('text-', 'bg-')}`} />
          {item}
        </motion.li>
      ))}
    </ul>
  </div>
);

const SkeletonLine = ({ w = "100%" }: { w?: string }) => (
  <div className="h-3.5 rounded-full bg-white/5 animate-pulse" style={{ width: w }} />
);

export default function InsightPanel({ insights, isLoading, fileName }: InsightPanelProps) {
  if (isLoading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 flex flex-col gap-8">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-xl animate-pulse">✨</div>
          <div className="flex flex-col gap-2 flex-1">
            <SkeletonLine w="40%" />
            <SkeletonLine w="25%" />
          </div>
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="flex flex-col gap-3">
            <SkeletonLine w="20%" />
            <SkeletonLine />
            <SkeletonLine w="85%" />
            <SkeletonLine w="90%" />
          </div>
        ))}
        <p className="text-white/30 text-xs text-center animate-pulse">
          🧠 AI analyst is reviewing your data...
        </p>
      </div>
    );
  }

  if (!insights) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden"
    >
      {/* Header */}
      <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-indigo-500/20 flex items-center justify-center text-xl">✨</div>
          <div>
            <h2 className="text-white font-bold text-lg tracking-tight">AI Analysis</h2>
            {fileName && <p className="text-white/40 text-xs mt-0.5">{fileName}</p>}
          </div>
        </div>
        <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Analysis Complete
        </span>
      </div>

      <div className="p-8 flex flex-col gap-8">
        {/* Summary */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-white/70 leading-relaxed text-base border-l-2 border-indigo-500/50 pl-4"
        >
          {insights.summary}
        </motion.p>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Section
            icon="💡"
            title="Key Insights"
            color="text-amber-400"
            items={insights.keyInsights}
          />
          <Section
            icon="📈"
            title="Trends"
            color="text-blue-400"
            items={insights.trends}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Section
            icon="⚠️"
            title="Anomalies & Outliers"
            color="text-orange-400"
            items={insights.anomalies}
          />
          <Section
            icon="🚨"
            title="Risk Areas"
            color="text-red-400"
            items={insights.riskAreas}
          />
        </div>

        {/* Recommendations — full width, highlighted */}
        <div className="rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 p-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2 mb-4">
            <span>✅</span> Actionable Recommendations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.recommendations.map((rec, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="flex items-start gap-3 bg-white/5 rounded-xl p-4"
              >
                <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-white/80 leading-relaxed">{rec}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
