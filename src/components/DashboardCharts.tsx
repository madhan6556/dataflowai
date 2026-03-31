"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, ScatterChart, Scatter,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ComposedChart
} from "recharts";
import type { DashboardSnapshot } from "@/lib/preAggregate";

export interface ConfigChart {
  id: string;
  type: string;
  title: string;
  description: string;
  tableName: string;
  requiresJoin?: boolean;
  joinPath?: string;
  xAxisDataKey: string;
  yAxisDataKeys: string[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  colors: string[];
  valueFormat?: "number" | "currency" | "percentage" | "none";
  reasoning?: string;
}

export interface KpiCard {
  id: string;
  label: string;
  tableName: string;
  column: string;
  aggregation: "sum" | "count" | "count_distinct" | "avg" | "max" | "min";
  valueFormat: "number" | "currency" | "percentage" | "none";
  icon: string;
}

export interface DashboardChartsProps {
  config: {
    dashboardTitle?: string;
    dashboardSummary?: string;
    kpiCards?: KpiCard[];
    charts: ConfigChart[];
    dataWarnings?: string[];
  };
  datasets: Record<string, any[]>;
  /** When provided (saved dashboard mode), renders from pre-aggregated data — no raw rows needed. */
  snapshot?: DashboardSnapshot;
}

// Smart number formatter — handles k/M/B abbreviations correctly
const formatTick = (val: number) => {
  if (Math.abs(val) >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(val) >= 1_000_000)     return `${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000)         return `${(val / 1_000).toFixed(1)}k`;
  return String(val);
};


// Value display formatter (tooltips/KPIs)
const formatValue = (val: any, format: string = "none") => {
  if (typeof val !== 'number') return val;
  if (format === 'currency') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumSignificantDigits: 4 }).format(val);
  }
  if (format === 'percentage') return `${val.toFixed(1)}%`;
  if (format === 'number')     return val.toLocaleString();
  return val;
};

// Date-grouping helper: collapses individual dates into YYYY-MM buckets if the X-axis column is date-like
const groupByMonth = (data: any[], xKey: string, yKeys: string[]): any[] => {
  const grouped: Record<string, any> = {};
  for (const row of data) {
    let rawDate = String(getFuzzyValue(row, xKey) ?? '');
    // Keep only the YYYY-MM part (works for ISO dates and Excel date strings)
    const m = rawDate.match(/(\d{4})-(\d{2})/);
    const bucket = m ? `${m[1]}-${m[2]}` : rawDate;
    if (!bucket) continue;
    if (!grouped[bucket]) {
      grouped[bucket] = { [xKey]: bucket, _sortTotal: 0 };
      yKeys.forEach(k => grouped[bucket][k] = 0);
    }
    yKeys.forEach(k => {
      const v = Number(getFuzzyValue(row, k) ?? 0) || 0;
      grouped[bucket][k] += v;
      grouped[bucket]._sortTotal += v;
    });
  }
  return Object.values(grouped).sort((a, b) => a[xKey].localeCompare(b[xKey]));
};

// Check if a key name is likely a date/time column
const isDateKey = (key: string) => /(date|time|month|year|day|period)/i.test(key);

const getAggregatedData = (data: any[], xAxisKey: string, yAxisKeys: string[], limit?: number, sortByValue: boolean = false) => {
  if (!xAxisKey || !yAxisKeys || yAxisKeys.length === 0) return data;
  
  const grouped = data.reduce((acc: any, curr: any) => {
    let cat = getFuzzyValue(curr, xAxisKey);
    // Bulletproofing: Fallback to column name stripped of table prefix if Gemini hallucinated a table join on a single flat file
    if (cat === undefined && xAxisKey.includes('.')) {
      cat = getFuzzyValue(curr, xAxisKey.split('.').pop()!);
    }
    if (cat === undefined || cat === null || cat === "") return acc;
    cat = String(cat);

    if (!acc[cat]) {
      acc[cat] = { [xAxisKey]: cat, _sortTotal: 0 };
      yAxisKeys.forEach(k => acc[cat][k] = 0);
    }
    yAxisKeys.forEach(k => {
      let valRaw = getFuzzyValue(curr, k);
      if (valRaw === undefined && k.includes('.')) {
        valRaw = getFuzzyValue(curr, k.split('.').pop()!);
      }
      const val = Number(valRaw) || 0;
      acc[cat][k] += val;
      acc[cat]._sortTotal += val;
    });
    return acc;
  }, {});

  let result = Object.values(grouped);
  
  if (sortByValue) result.sort((a: any, b: any) => b._sortTotal - a._sortTotal);
  if (limit) result = result.slice(0, limit);
  return result;
};

// FUZZY TABLE RESOLVER
const findDataset = (datasets: Record<string, any[]>, name: string | null) => {
  if (!name) return Object.values(datasets)[0] || [];
  if (datasets[name]) return datasets[name];
  const nameLower = name.toLowerCase();
  for (const k of Object.keys(datasets)) {
    const kLower = k.toLowerCase();
    if (kLower === nameLower || kLower.includes(nameLower) || nameLower.includes(kLower)) {
      return datasets[k];
    }
  }
  return Object.values(datasets)[0] || [];
};

// FUZZY COLUMN MATCHER (Solves casing mismatches like 'Product_key' vs 'product_key')
const getFuzzyValue = (row: any, key: string) => {
  if (!row) return undefined;
  if (row[key] !== undefined) return row[key];
  const searchK = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const k of Object.keys(row)) {
    if (k.toLowerCase().replace(/[^a-z0-9]/g, '') === searchK) {
      return row[k];
    }
  }
  return undefined;
};

// RESOLVE JOINS & DATA FOR CHART
function resolveData(chartConfig: ConfigChart, datasets: Record<string, any[]>) {
  const primaryTable = chartConfig.tableName;
  const rawPrimary = findDataset(datasets, primaryTable);

  // 1. Deep clone and map every key so we have both 'col' and 'table.col'
  let result = rawPrimary.map(row => {
    const newRow = { ...row };
    if (primaryTable) {
      for (const k in row) newRow[`${primaryTable}.${k}`] = row[k];
    }
    return newRow;
  });

  if (chartConfig.requiresJoin && chartConfig.joinPath) {
    try {
      const parts = chartConfig.joinPath.split(/->|→|=>|=|==/).map(s => s.trim());
      if (parts.length === 2) {
        // AI outputs e.g., "fact_sales.customer_key -> dim_customers.customer_key"
        const leftParts = parts[0].split('.');
        const rightParts = parts[1].split('.');
        
        let fromCol = '';
        let toTable = null;
        let toCol = '';

        // Safely extract the column (which is always the last segment) entirely irrespective of dots in the table alias
        const leftColExtracted = leftParts.pop()!;
        const leftTableExtracted = leftParts.join('.') || null; // Will be null if AI omitted the table prefix

        const rightColExtracted = rightParts.pop()!;
        const rightTableExtracted = rightParts.join('.') || null;

        // Dynamically figure out which side is the external target table
        if (leftTableExtracted && rightTableExtracted) {
           if (leftTableExtracted.toLowerCase() === primaryTable.toLowerCase() || primaryTable.toLowerCase().includes(leftTableExtracted.toLowerCase())) {
              // Standard layout: [Primary Table].[Column] -> [Target Table].[Column]
              fromCol = leftColExtracted;
              toTable = rightTableExtracted;
              toCol = rightColExtracted;
           } else {
              // Reversed layout by AI: [Target Table].[Column] -> [Primary Table].[Column]
              fromCol = rightColExtracted;
              toTable = leftTableExtracted;
              toCol = leftColExtracted;
           }
        } else {
           // Fallback to strict standard parsing if tables prefixes were forgotten by AI entirely
           fromCol = leftColExtracted;
           toTable = rightTableExtracted; // AI better have put the target table on the right side
           toCol = rightColExtracted;
        }

        const targetData = toTable ? findDataset(datasets, toTable) : null;
        if (toTable && targetData && targetData !== rawPrimary) {
          // Create O(1) lookup based on the target column, aggressively fuzzy matching the key
          const targetIndex = new Map(targetData.map(row => [String(getFuzzyValue(row, toCol)), row]));
          
          result = result.map(row => {
            // lookup using the original column name via fuzzy search
            const match = targetIndex.get(String(getFuzzyValue(row, fromCol)));
            if (match) {
              const enriched: any = { ...row, ...match };
              // Guarantee the "toTable.colName" variations exist since the AI prompt instructs it
              for (const k in match) {
                enriched[`${toTable}.${k}`] = match[k];
              }
              return enriched;
            }
            return row;
          });
        }
      }
    } catch (e) {
      console.warn("Failed to join data for chart", chartConfig.title, e);
    }
  }
  return result;
}

const CustomTooltip = ({ active, payload, label, valueFormat = "number" }: any) => {
  if (active && payload && payload.length) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="px-5 py-4 rounded-xl border border-white/20 shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-2xl bg-black/80 min-w-[180px] z-50">
        <p className="text-white/60 font-medium mb-3 text-xs uppercase tracking-widest border-b border-white/10 pb-2">{label}</p>
        <div className="flex flex-col gap-2.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex justify-between items-center gap-6 text-sm">
              <span className="flex items-center gap-2 text-white/90">
                <span className="w-2.5 h-2.5 rounded-sm block shadow-sm" style={{ backgroundColor: entry.color }}></span>
                {entry.name}
              </span> 
              <span className="font-mono text-white font-bold tracking-tight">{formatValue(entry.value, valueFormat)}</span>
            </div>
          ))}
        </div>
      </motion.div>
    );
  }
  return null;
};

export default function DashboardCharts({ config, datasets, snapshot }: DashboardChartsProps) {
  if (!config || (!config.charts && !config.kpiCards)) return null;

  // ── KPI computation ──────────────────────────────────────────────────────────
  // If a snapshot exists (saved dashboard), use pre-computed values directly.
  // Otherwise run live aggregation against raw datasets.
  const kpis = useMemo(() => {
    if (!config.kpiCards) return [];
    return config.kpiCards.map(kpi => {
      if (snapshot) {
        const snap = snapshot.kpis.find(k => k.id === kpi.id);
        return { ...kpi, calculatedValue: snap?.calculatedValue ?? 0 };
      }
      const data = datasets[kpi.tableName] || Object.values(datasets)[0] || [];
      let col = kpi.column;
      if (data.length > 0 && getFuzzyValue(data[0], col) === undefined && col.includes('.')) {
        col = col.split('.').pop()!;
      }
      let val = 0;
      switch(kpi.aggregation) {
        case "sum": val = data.reduce((a, b) => a + (Number(getFuzzyValue(b, col)) || 0), 0); break;
        case "avg": val = data.reduce((a, b) => a + (Number(getFuzzyValue(b, col)) || 0), 0) / (data.length || 1); break;
        case "max": val = data.reduce((a, d) => { const v = Number(getFuzzyValue(d, col)) || 0; return v > a ? v : a; }, -Infinity); break;
        case "min": val = data.reduce((a, d) => { const v = Number(getFuzzyValue(d, col)) || 0; return v < a ? v : a; }, Infinity); break;
        case "count": val = data.filter(d => getFuzzyValue(d, col) != null).length; break;
        case "count_distinct": val = new Set(data.map(d => getFuzzyValue(d, col))).size; break;
      }
      return { ...kpi, calculatedValue: val };
    });
  }, [config.kpiCards, datasets, snapshot]);

  const renderChart = (originalConfig: ConfigChart) => {
    // ── Step 1: Resolve the data and normalised config keys ──────────────────
    let chartData: any[];
    let chartConfig: ConfigChart;

    if (snapshot) {
      // Saved dashboard: use pre-aggregated snapshot data directly
      const snapshotChart = snapshot.charts.find(c => c.id === originalConfig.id);
      if (!snapshotChart) return null;
      chartData = snapshotChart.data; // already aggregated — pass straight to Recharts
      chartConfig = {
        ...originalConfig,
        xAxisDataKey: snapshotChart.xAxisDataKey,
        yAxisDataKeys: snapshotChart.yAxisDataKeys,
      };
    } else {
      // Live workspace: join + strip dot-prefixes
      const rawData = resolveData(originalConfig, datasets);
      chartConfig = {
        ...originalConfig,
        xAxisDataKey: originalConfig.xAxisDataKey.includes('.') ? originalConfig.xAxisDataKey.split('.').pop()! : originalConfig.xAxisDataKey,
        yAxisDataKeys: originalConfig.yAxisDataKeys.map(k => k.includes('.') ? k.split('.').pop()! : k),
      };
      chartData = rawData; // will be aggregated per-chart-type below
    }

    const format = chartConfig.valueFormat || "number";

    // ── Step 2: Render switch ─────────────────────────────────────────────────
    switch (chartConfig.type) {
      case "BarChart": {
        const barData = snapshot ? chartData : getAggregatedData(chartData, chartConfig.xAxisDataKey, chartConfig.yAxisDataKeys, 15, true);
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey={chartConfig.xAxisDataKey} stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} dx={-5} tickFormatter={formatTick} width={55} />
              <Tooltip content={<CustomTooltip valueFormat={format} />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              {chartConfig.yAxisDataKeys.map((key, idx) => (
                <Bar key={key} dataKey={key} fill={chartConfig.colors[idx] || "#3b82f6"} radius={[4, 4, 0, 0]} maxBarSize={45} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
      }
      case "LineChart": {
        const lineData = snapshot ? chartData : (isDateKey(chartConfig.xAxisDataKey) ? groupByMonth(chartData, chartConfig.xAxisDataKey, chartConfig.yAxisDataKeys) : getAggregatedData(chartData, chartConfig.xAxisDataKey, chartConfig.yAxisDataKeys, 50));
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey={chartConfig.xAxisDataKey} stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} dy={10}/>
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} dx={-5} tickFormatter={formatTick} width={55} />
              <Tooltip content={<CustomTooltip valueFormat={format} />} />
              {chartConfig.yAxisDataKeys.map((key, idx) => (
                <Line key={key} type="monotone" dataKey={key} stroke={chartConfig.colors[idx] || "#8b5cf6"} strokeWidth={3} dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );
      }
      case "ComposedChart": {
        const compData = snapshot ? chartData : getAggregatedData(chartData, chartConfig.xAxisDataKey, chartConfig.yAxisDataKeys);
        return (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={compData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey={chartConfig.xAxisDataKey} stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} dy={10}/>
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} dx={-5} tickFormatter={formatTick} width={55} />
              <Tooltip content={<CustomTooltip valueFormat={format} />} />
              {chartConfig.yAxisDataKeys.map((key, idx) => (
                idx === 0 
                 ? <Bar key={key} dataKey={key} fill={chartConfig.colors[idx] || "#3b82f6"} radius={[4, 4, 0, 0]} maxBarSize={45} />
                 : <Line key={key} type="monotone" dataKey={key} stroke={chartConfig.colors[idx] || "#8b5cf6"} strokeWidth={3} dot={false} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        );
      }
      case "AreaChart": {
        const areaData = snapshot ? chartData : (isDateKey(chartConfig.xAxisDataKey) ? groupByMonth(chartData, chartConfig.xAxisDataKey, chartConfig.yAxisDataKeys) : getAggregatedData(chartData, chartConfig.xAxisDataKey, chartConfig.yAxisDataKeys, 50));
        return (
           <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={areaData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <defs>
                {chartConfig.yAxisDataKeys.map((key, idx) => (
                  <linearGradient key={`color-${key}`} id={`color-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartConfig.colors[idx] || "#0ea5e9"} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={chartConfig.colors[idx] || "#0ea5e9"} stopOpacity={0}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis dataKey={chartConfig.xAxisDataKey} stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} dy={10}/>
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} dx={-5} tickFormatter={formatTick} width={55} />
              <Tooltip content={<CustomTooltip valueFormat={format} />} />
              {chartConfig.yAxisDataKeys.map((key, idx) => (
                <Area key={key} type="monotone" dataKey={key} stroke={chartConfig.colors[idx] || "#0ea5e9"} fillOpacity={1} fill={`url(#color-${key})`} strokeWidth={2} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );
      }
      case "PieChart": {
        const aggData = snapshot
          ? chartData.map((item: any) => ({ name: item[chartConfig.xAxisDataKey], value: item[chartConfig.yAxisDataKeys[0]] }))
          : getAggregatedData(chartData, chartConfig.xAxisDataKey, [chartConfig.yAxisDataKeys[0]], 6, true).map((item: any) => ({
              name: item[chartConfig.xAxisDataKey],
              value: item[chartConfig.yAxisDataKeys[0]]
            }));
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Tooltip content={<CustomTooltip valueFormat={format} />} />
              <Pie data={aggData} cx="50%" cy="50%" innerRadius={70} outerRadius={95} paddingAngle={4} dataKey="value" stroke="rgba(0,0,0,0.2)" strokeWidth={2}>
                {aggData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={chartConfig.colors[index % chartConfig.colors.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );
      }
      case "ScatterChart":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey={chartConfig.xAxisDataKey} type="category" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis dataKey={chartConfig.yAxisDataKeys[0]} type="number" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip valueFormat={format} />} cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.2)' }} />
              <Scatter name={chartConfig.title} data={snapshot ? chartData : chartData.slice(0, 400)} fill={chartConfig.colors[0] || "#8b5cf6"} opacity={0.7} />
            </ScatterChart>
          </ResponsiveContainer>
        );
      case "RadarChart": {
        const radarData = snapshot ? chartData : getAggregatedData(chartData, chartConfig.xAxisDataKey, chartConfig.yAxisDataKeys, 10, true);
        return (
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis dataKey={chartConfig.xAxisDataKey} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
              <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 8 }} />
              <Tooltip content={<CustomTooltip valueFormat={format} />} />
              {chartConfig.yAxisDataKeys.map((key, idx) => (
                <Radar key={key} name={key} dataKey={key} stroke={chartConfig.colors[idx] || "#ec4899"} fill={chartConfig.colors[idx] || "#ec4899"} fillOpacity={0.6} />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        );
      }
      default: {
        const fbData = getAggregatedData(chartData, chartConfig.xAxisDataKey, chartConfig.yAxisDataKeys, 15, true);
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fbData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey={chartConfig.xAxisDataKey} stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} dy={8} interval="preserveStartEnd" />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} dx={-5} tickFormatter={formatTick} width={55} />
              <Tooltip content={<CustomTooltip valueFormat={format} />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              {chartConfig.yAxisDataKeys.map((key, idx) => (
                <Bar key={key} dataKey={key} fill={chartConfig.colors[idx] || "#6366F1"} radius={[4, 4, 0, 0]} maxBarSize={48} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
      }
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Title & Summary */}
      {(config.dashboardTitle || config.dashboardSummary) && (
        <div className="mb-4">
          {config.dashboardTitle && <h2 className="text-4xl font-black text-white tracking-tight mb-3">{config.dashboardTitle}</h2>}
          {config.dashboardSummary && <p className="text-white/50 leading-relaxed max-w-4xl text-sm">{config.dashboardSummary}</p>}
        </div>
      )}

      {/* Warnings */}
      {config.dataWarnings && config.dataWarnings.length > 0 && (
         <div className="flex flex-col gap-2 mb-2">
           {config.dataWarnings.map((warning, i) => (
             <div key={i} className="bg-orange-500/10 border border-orange-500/20 text-orange-400 px-4 py-3 rounded-xl text-xs flex items-center gap-3">
               <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
               {warning}
             </div>
           ))}
         </div>
      )}

      {/* KPIs */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
          {kpis.map((kpi: any, idx) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
              key={idx} className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:bg-white/[0.04] transition-colors"
            >
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors pointer-events-none" />
              <p className="text-white/40 text-[11px] font-bold uppercase tracking-widest mb-1 truncate">{kpi.label}</p>
              <div className="flex items-end gap-3">
                <p className="text-2xl font-black text-white tracking-tight">{formatValue(kpi.calculatedValue, kpi.valueFormat)}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Charts Grid */}
      {config.charts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {config.charts.map((chart, idx) => (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 + 0.1 }}
              key={idx} 
              className={`bg-white/[0.02] border border-white/10 rounded-3xl p-6 relative group ${idx === 0 && config.charts.length % 2 !== 0 ? "lg:col-span-2" : ""}`}
            >
              <div className="mb-6 group" title={chart.reasoning || "AI generated insight"}>
                <div className="flex items-center gap-2 mb-1.5">
                  <h3 className="text-white font-bold text-lg tracking-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-white/50 transition-all">{chart.title}</h3>
                  {chart.requiresJoin && (
                    <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] uppercase font-bold tracking-widest rounded-md">JOIN</span>
                  )}
                </div>
                <p className="text-sm text-white/40 leading-relaxed">{chart.description}</p>
              </div>
              
              {/* Optional Reasoning Tooltip trigger for advanced users */}
              {chart.reasoning && (
                <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                   <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-white/30 text-xs cursor-help" title={chart.reasoning}>?</div>
                </div>
              )}

              <div className={`w-full ${idx === 0 && config.charts.length % 2 !== 0 ? "h-[450px]" : "h-[320px]"}`}>
                {renderChart(chart)}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
