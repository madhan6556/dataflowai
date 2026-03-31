"use client";

import { motion, AnimatePresence } from "framer-motion";
import React, { useState, useEffect, useCallback } from "react";
import FileUploader from "@/components/FileUploader";
import DashboardCharts from "@/components/DashboardCharts";
import InsightPanel from "@/components/InsightPanel";
import ChatInterface from "@/components/ChatInterface";
import { ExtractResult } from "@/lib/schemaExtractor";
import { preprocessDatasets, type DataSummary } from "@/lib/dataPreprocessor";
import { buildSnapshot, type DashboardSnapshot } from "@/lib/preAggregate";
import type { InsightResult } from "@/app/api/generate-insights/route";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, serverTimestamp,
} from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LZString from "lz-string";

interface SavedDashboard {
  id: string;
  file_name: string;
  dashboard_config: any;
  insights?: InsightResult;
  snapshot?: DashboardSnapshot;
  dataSummary?: DataSummary;
  preview_data?: Record<string, any[]>;
  preview_data_compressed?: string;
  created_at: any;
}

const CHART_START_DELAY_MS = 4000;

export default function Dashboard() {
  const router = useRouter();
  const analysisRunIdRef = React.useRef(0);
  const chartQueueTimeoutRef = React.useRef<number | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Data state
  const [parsedData, setParsedData] = useState<ExtractResult | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [dataSummary, setDataSummary] = useState<DataSummary | null>(null);

  // Insight state
  const [insights, setInsights] = useState<InsightResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  // Chart state
  const [dashboardConfig, setDashboardConfig] = useState<any>(null);
  const [isGeneratingCharts, setIsGeneratingCharts] = useState(false);
  const [isChartQueued, setIsChartQueued] = useState(false);
  const [snapshotData, setSnapshotData] = useState<DashboardSnapshot | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<"workspace" | "saved">("workspace");
  const [savedDashboards, setSavedDashboards] = useState<SavedDashboard[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Auth ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
      if (firebaseUser) {
        loadSavedDashboards(firebaseUser.uid);
      } else {
        document.cookie = "firebase_session=; path=/; max-age=0";
        router.replace("/auth");
      }
    });
    return () => unsub();
  }, []);

  // ── Saved dashboards ─────────────────────────────────────────────────────
  const loadSavedDashboards = async (uid: string) => {
    try {
      const q = query(collection(db, "users", uid, "dashboards"), orderBy("created_at", "desc"));
      const snap = await getDocs(q);
      setSavedDashboards(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedDashboard)));
    } catch (err) {
      console.error("Failed to load dashboards:", err);
    }
  };

  const deleteDashboard = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "dashboards", id));
    loadSavedDashboards(user.uid);
  };

  const clearQueuedChartGeneration = useCallback(() => {
    if (chartQueueTimeoutRef.current !== null) {
      window.clearTimeout(chartQueueTimeoutRef.current);
      chartQueueTimeoutRef.current = null;
    }
    setIsChartQueued(false);
  }, []);

  useEffect(() => () => clearQueuedChartGeneration(), [clearQueuedChartGeneration]);

  // ── File parsed ──────────────────────────────────────────────────────────
  const handleFileParsed = async (result: ExtractResult, file: File) => {
    analysisRunIdRef.current += 1;
    const runId = analysisRunIdRef.current;

    clearQueuedChartGeneration();
    setParsedData(result);
    setFileName(file.name);
    setDashboardConfig(null);
    setInsights(null);
    setInsightError(null);
    setSnapshotData(null);
    setSaveSuccess(false);
    setSaveError(null);
    setIsGeneratingCharts(false);

    // Step 1: Build compact data summary for AI
    const summary = preprocessDatasets(result.datasets, result.schema.detectedDomain);
    setDataSummary(summary);

    // Step 2: Auto-generate AI insights first.
    // Step 3: Queue charts only after insights succeed.
    void generateInsights(summary, result, runId, true);
  };

  // ── AI Insights (PRIMARY) ────────────────────────────────────────────────
  const queueChartGeneration = useCallback((result: ExtractResult, runId: number) => {
    clearQueuedChartGeneration();
    setIsChartQueued(true);
    chartQueueTimeoutRef.current = window.setTimeout(() => {
      if (analysisRunIdRef.current !== runId) return;
      setIsChartQueued(false);
      void generateCharts(result, runId);
    }, CHART_START_DELAY_MS);
  }, [clearQueuedChartGeneration]);

  const generateInsights = async (
    summary: DataSummary,
    result?: ExtractResult,
    runId: number = analysisRunIdRef.current,
    autoQueueCharts: boolean = false
  ) => {
    setIsAnalyzing(true);
    setInsightError(null);
    try {
      const res = await fetch("/api/generate-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate insights.");
      if (analysisRunIdRef.current !== runId) return;
      setInsights(json.insights);
      if (autoQueueCharts && result) {
        queueChartGeneration(result, runId);
      }
    } catch (err: any) {
      if (analysisRunIdRef.current !== runId) return;
      clearQueuedChartGeneration();
      setInsightError(err.message || "Analysis failed.");
    } finally {
      if (analysisRunIdRef.current === runId) {
        setIsAnalyzing(false);
      }
    }
  };

  // ── Charts (SECONDARY) ───────────────────────────────────────────────────
  const generateCharts = async (
    result: ExtractResult,
    runId: number = analysisRunIdRef.current
  ) => {
    if (analysisRunIdRef.current !== runId) return;
    setIsGeneratingCharts(true);
    try {
      const res = await fetch("/api/generate-dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema: result.schema }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Chart generation failed.");
      if (analysisRunIdRef.current !== runId) return;
      setDashboardConfig(json.config);
    } catch (err) {
      // Charts failing silently is acceptable — insights are still shown
      console.warn("Chart generation failed:", err);
    } finally {
      if (analysisRunIdRef.current === runId) {
        setIsGeneratingCharts(false);
      }
    }
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const saveDashboard = async () => {
    if (!user || (!insights && !dashboardConfig)) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const snapshot = dashboardConfig && parsedData
        ? buildSnapshot(dashboardConfig, parsedData.datasets)
        : undefined;

      await addDoc(collection(db, "users", user.uid, "dashboards"), {
        file_name: fileName,
        dashboard_config: dashboardConfig || null,
        insights: insights || null,
        dataSummary: dataSummary || null,
        snapshot: snapshot || null,
        created_at: serverTimestamp(),
      });
      setSaveSuccess(true);
      loadSavedDashboards(user.uid);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError("Save failed: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Load saved ───────────────────────────────────────────────────────────
  const loadDashboard = (saved: SavedDashboard) => {
    analysisRunIdRef.current += 1;
    setFileName(saved.file_name);
    setInsights(saved.insights || null);
    setDashboardConfig(saved.dashboard_config || null);
    setDataSummary(saved.dataSummary || null);
    setSnapshotData(saved.snapshot || null);
    setInsightError(null);
    setSaveSuccess(false);
    clearQueuedChartGeneration();
    setIsGeneratingCharts(false);
    setActiveTab("workspace");

    // Legacy: decompress old LZString saves
    if (!saved.insights && saved.preview_data_compressed) {
      try {
        const jsonText = LZString.decompressFromUTF16(saved.preview_data_compressed);
        const datasets = jsonText ? JSON.parse(jsonText) : {};
        setParsedData({
          schema: { tables: [], relationships: [], detectedDomain: "unknown", primaryMetricColumns: [], primaryDateColumns: [] },
          datasets,
        });
      } catch (_) {}
    } else {
      setParsedData(null);
    }
  };

  // ── PDF Export ───────────────────────────────────────────────────────────
  const exportPDF = () => {
    window.print();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const hasContent = insights || isAnalyzing;

  return (
    <div className="min-h-screen bg-[#050505] text-white print:bg-white print:text-black">
      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 border-b border-white/5 bg-black/80 backdrop-blur-xl print:hidden">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="text-lg font-bold tracking-tighter flex-shrink-0">
            DataFlow<span className="text-indigo-400">AI</span>
          </Link>

          {/* Tabs */}
          <div className="flex bg-white/[0.04] rounded-lg p-1 border border-white/[0.06]">
            {(["workspace", "saved"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-widest transition-all ${
                  activeTab === tab ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                }`}
              >
                {tab === "workspace" ? "Workspace" : `Saved (${savedDashboards.length})`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {hasContent && (
              <>
                <button
                  onClick={exportPDF}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-white/60 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:text-white transition-all"
                >
                  📄 Export PDF
                </button>
                <button
                  onClick={saveDashboard}
                  disabled={isSaving}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    saveSuccess
                      ? "bg-green-500/20 border-green-500/30 text-green-400 border"
                      : "bg-indigo-600 hover:bg-indigo-500 text-white"
                  } disabled:opacity-50`}
                >
                  {isSaving ? (
                    <><span className="w-3 h-3 border border-white/50 border-t-transparent rounded-full animate-spin" />Saving…</>
                  ) : saveSuccess ? "✓ Saved!" : "💾 Save"}
                </button>
              </>
            )}
            <button
              onClick={() => signOut(auth)}
              className="text-xs text-white/30 hover:text-white/60 transition-colors px-2"
            >
              Sign Out
            </button>
          </div>
        </div>
        {saveError && (
          <div className="bg-red-500/10 border-t border-red-500/20 px-6 py-2 text-red-400 text-xs">{saveError}</div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">

          {/* ── SAVED TAB ────────────────────────────────────────────────── */}
          {activeTab === "saved" && (
            <motion.div key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="text-2xl font-black tracking-tight mb-6">Saved Analyses</h2>
              {savedDashboards.length === 0 ? (
                <div className="text-center py-20 text-white/30">
                  <div className="text-4xl mb-4">📂</div>
                  <p className="text-lg font-medium">No saved analyses yet.</p>
                  <p className="text-sm mt-2">Upload a file and save your insights to see them here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedDashboards.map((saved) => (
                    <motion.div
                      key={saved.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="text-3xl">📊</div>
                        <button
                          onClick={() => deleteDashboard(saved.id)}
                          className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all text-xs"
                        >
                          🗑
                        </button>
                      </div>
                      <h3 className="font-bold text-white text-sm mb-1 truncate">{saved.file_name}</h3>
                      {saved.insights?.summary && (
                        <p className="text-white/40 text-xs line-clamp-2 leading-relaxed mb-4">
                          {saved.insights.summary}
                        </p>
                      )}
                      <div className="text-white/20 text-xs mb-3">
                        {saved.created_at?.seconds
                          ? new Date(saved.created_at.seconds * 1000).toLocaleDateString()
                          : "Recently saved"}
                      </div>
                      <button
                        onClick={() => loadDashboard(saved)}
                        className="w-full py-2 rounded-xl text-xs font-bold bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30 transition-all"
                      >
                        Load Analysis →
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── WORKSPACE TAB ────────────────────────────────────────────── */}
          {activeTab === "workspace" && (
            <motion.div key="workspace" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-8">

              {/* Upload area — shown when no content */}
              {!hasContent && !isGeneratingCharts && !isChartQueued && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
                  <div className="text-center pb-2">
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">
                      Upload your data. <span className="text-indigo-400">Get instant insights.</span>
                    </h1>
                    <p className="text-white/40 text-base">Your AI analyst is ready. Drop any CSV or Excel file to begin.</p>
                  </div>
                  <FileUploader onFileParsed={handleFileParsed} />
                </motion.div>
              )}

              {/* File uploaded but no results yet — show uploader smaller + loading state */}
              {(hasContent || isGeneratingCharts || isChartQueued) && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-base">📁</div>
                    <div>
                      <p className="text-white font-bold text-sm">{fileName}</p>
                      <p className="text-white/40 text-xs">
                        {dataSummary ? `${dataSummary.totalRows.toLocaleString()} rows · ${dataSummary.domain} dataset` : "Analyzing…"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      analysisRunIdRef.current += 1;
                      clearQueuedChartGeneration();
                      setParsedData(null); setInsights(null); setDashboardConfig(null);
                      setDataSummary(null); setSnapshotData(null); setFileName("");
                      setInsightError(null);
                      setIsGeneratingCharts(false);
                    }}
                    className="text-xs text-white/30 hover:text-white/60 border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-all"
                  >
                    ↑ Upload new file
                  </button>
                </div>
              )}

              {/* ── PRIMARY: INSIGHT PANEL ──────────────────────────── */}
              {(isAnalyzing || insights || insightError) && (
                <div>
                  {insightError ? (
                    <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-6 text-center">
                      <p className="text-red-400 mb-3 text-sm">{insightError}</p>
                      <button
                        onClick={() => {
                          if (!dataSummary || !parsedData) return;
                          analysisRunIdRef.current += 1;
                          const runId = analysisRunIdRef.current;
                          clearQueuedChartGeneration();
                          setDashboardConfig(null);
                          void generateInsights(dataSummary, parsedData, runId, true);
                        }}
                        className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-all"
                      >
                        Retry Analysis
                      </button>
                    </div>
                  ) : (
                    <InsightPanel insights={insights} isLoading={isAnalyzing} fileName={fileName} />
                  )}
                </div>
              )}

              {/* ── SECONDARY: CHARTS + CHAT ────────────────────────── */}
              {(dashboardConfig || isGeneratingCharts || isChartQueued || snapshotData) && (
                <div>
                  <div className="flex items-center gap-4 mb-6 print:hidden">
                    <div className="h-px w-8 bg-white/20" />
                    <span className="text-white/50 font-bold text-sm uppercase tracking-widest">Visual Overview</span>
                    <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
                    {isChartQueued && !isGeneratingCharts && (
                      <span className="text-white/30 text-xs">
                        Preparing charts after insights…
                      </span>
                    )}
                    {isGeneratingCharts && (
                      <span className="flex items-center gap-2 text-white/30 text-xs">
                        <span className="w-3 h-3 border border-white/30 border-t-transparent rounded-full animate-spin" />
                        Loading charts…
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Charts — 2/3 width */}
                    <div className="xl:col-span-2">
                      {dashboardConfig && (
                        <DashboardCharts
                          config={dashboardConfig}
                          datasets={parsedData?.datasets || {}}
                          snapshot={snapshotData ?? undefined}
                        />
                      )}
                    </div>

                    {/* Chat — 1/3 width */}
                    <div className="print:hidden">
                      <ChatInterface context={dataSummary} />
                    </div>
                  </div>
                </div>
              )}

              {/* Chat only — when insights loaded but no charts yet */}
              {insights && !dashboardConfig && !isGeneratingCharts && !isChartQueued && dataSummary && (
                <div className="print:hidden">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-px w-8 bg-white/20" />
                    <span className="text-white/50 font-bold text-sm uppercase tracking-widest">Ask Questions</span>
                    <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
                  </div>
                  <div className="max-w-2xl">
                    <ChatInterface context={dataSummary} />
                  </div>
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
