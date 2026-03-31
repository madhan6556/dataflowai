/**
 * preAggregate.ts
 *
 * Runs all dashboard aggregations at SAVE TIME, producing a compact snapshot
 * of chart-ready data (~10–50KB) instead of storing raw rows (several MB).
 *
 * The output shape exactly mirrors what DashboardCharts.tsx needs to render,
 * so a saved dashboard loads via `preAggregatedSnapshot` instead of live `datasets`.
 */

import type { ConfigChart, KpiCard } from "@/components/DashboardCharts";

export interface ChartSnapshot {
  id: string;
  data: any[];            // The aggregated data array ready for Recharts
  xAxisDataKey: string;   // Normalised (no table prefixes)
  yAxisDataKeys: string[]; // Normalised
}

export interface KpiSnapshot {
  id: string;
  calculatedValue: number;
}

export interface DashboardSnapshot {
  kpis: KpiSnapshot[];
  charts: ChartSnapshot[];
}

// ─── Helpers (mirrors DashboardCharts.tsx exactly) ───────────────────────────

const getFuzzyValue = (row: any, key: string): any => {
  if (!row) return undefined;
  if (row[key] !== undefined) return row[key];
  const searchK = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const k of Object.keys(row)) {
    if (k.toLowerCase().replace(/[^a-z0-9]/g, "") === searchK) return row[k];
  }
  return undefined;
};

const findDataset = (datasets: Record<string, any[]>, name: string): any[] => {
  if (!name) return Object.values(datasets)[0] || [];
  if (datasets[name]) return datasets[name];
  const lc = name.toLowerCase();
  for (const k of Object.keys(datasets)) {
    const klc = k.toLowerCase();
    if (klc === lc || klc.replace(/\.[^.]+$/, "") === lc || lc.replace(/\.[^.]+$/, "") === klc) {
      return datasets[k];
    }
  }
  return Object.values(datasets)[0] || [];
};

const resolveJoinedData = (
  chartConfig: ConfigChart,
  datasets: Record<string, any[]>
): any[] => {
  const primaryTable = chartConfig.tableName;
  const rawPrimary = findDataset(datasets, primaryTable);

  let result = rawPrimary.map((row) => {
    const newRow = { ...row };
    if (primaryTable) {
      for (const k in row) newRow[`${primaryTable}.${k}`] = row[k];
    }
    return newRow;
  });

  if (chartConfig.requiresJoin && chartConfig.joinPath) {
    try {
      const parts = chartConfig.joinPath.split(/->|→|=>|=|==/).map((s) => s.trim());
      if (parts.length === 2) {
        const leftParts = parts[0].split(".");
        const rightParts = parts[1].split(".");

        const leftCol = leftParts.pop()!;
        const leftTable = leftParts.join(".") || null;
        const rightCol = rightParts.pop()!;
        const rightTable = rightParts.join(".") || null;

        let fromCol = "", toTable: string | null = null, toCol = "";

        if (leftTable && rightTable) {
          if (
            leftTable.toLowerCase() === primaryTable.toLowerCase() ||
            primaryTable.toLowerCase().includes(leftTable.toLowerCase())
          ) {
            fromCol = leftCol; toTable = rightTable; toCol = rightCol;
          } else {
            fromCol = rightCol; toTable = leftTable; toCol = leftCol;
          }
        } else {
          fromCol = leftCol; toTable = rightTable; toCol = rightCol;
        }

        const targetData = toTable ? findDataset(datasets, toTable) : null;
        if (toTable && targetData && targetData !== rawPrimary) {
          const idx = new Map(targetData.map((r) => [String(getFuzzyValue(r, toCol)), r]));
          result = result.map((row) => {
            const match = idx.get(String(getFuzzyValue(row, fromCol)));
            if (match) {
              const enriched: any = { ...row, ...match };
              for (const k in match) enriched[`${toTable}.${k}`] = match[k];
              return enriched;
            }
            return row;
          });
        }
      }
    } catch (_) {}
  }
  return result;
};

const aggregate = (
  data: any[],
  xKey: string,
  yKeys: string[],
  limit = 20,
  sort = true
): any[] => {
  const grouped = data.reduce((acc: any, curr: any) => {
    let cat = getFuzzyValue(curr, xKey);
    if (cat === undefined && xKey.includes(".")) cat = getFuzzyValue(curr, xKey.split(".").pop()!);
    if (cat === undefined || cat === null || cat === "") return acc;
    cat = String(cat);
    if (!acc[cat]) {
      acc[cat] = { [xKey]: cat, _total: 0 };
      yKeys.forEach((k) => (acc[cat][k] = 0));
    }
    yKeys.forEach((k) => {
      let v = getFuzzyValue(curr, k);
      if (v === undefined && k.includes(".")) v = getFuzzyValue(curr, k.split(".").pop()!);
      acc[cat][k] += Number(v) || 0;
      acc[cat]._total += Number(v) || 0;
    });
    return acc;
  }, {});

  let rows = Object.values(grouped) as any[];
  if (sort) rows.sort((a, b) => b._total - a._total);
  if (limit) rows = rows.slice(0, limit);
  rows.forEach((r) => delete r._total);
  return rows;
};

// ─── Normalise dot-prefixed keys so Recharts can read them ───────────────────
const stripPrefix = (key: string): string =>
  key.includes(".") ? key.split(".").pop()! : key;

const normaliseRow = (row: any, yKeys: string[], xKey: string): any => {
  const clean: any = {};
  const normX = stripPrefix(xKey);
  clean[normX] = row[xKey] ?? row[normX];
  for (const k of yKeys) {
    const normK = stripPrefix(k);
    clean[normK] = row[k] ?? row[normK] ?? 0;
  }
  return clean;
};

// ─── Main export ─────────────────────────────────────────────────────────────

export function buildSnapshot(
  config: { charts: ConfigChart[]; kpiCards?: KpiCard[] },
  datasets: Record<string, any[]>
): DashboardSnapshot {
  // 1. KPIs
  const kpis: KpiSnapshot[] = (config.kpiCards || []).map((kpi) => {
    const data = findDataset(datasets, kpi.tableName);
    let col = kpi.column;
    if (data.length > 0 && getFuzzyValue(data[0], col) === undefined && col.includes(".")) {
      col = col.split(".").pop()!;
    }
    let val = 0;
    switch (kpi.aggregation) {
      case "sum":          val = data.reduce((a, b) => a + (Number(getFuzzyValue(b, col)) || 0), 0); break;
      case "avg":          val = data.reduce((a, b) => a + (Number(getFuzzyValue(b, col)) || 0), 0) / (data.length || 1); break;
      case "max":          val = data.reduce((a, d) => { const v = Number(getFuzzyValue(d, col)) || 0; return v > a ? v : a; }, -Infinity); break;
      case "min":          val = data.reduce((a, d) => { const v = Number(getFuzzyValue(d, col)) || 0; return v < a ? v : a; }, Infinity); break;
      case "count":        val = data.filter((d) => getFuzzyValue(d, col) != null).length; break;
      case "count_distinct": val = new Set(data.map((d) => getFuzzyValue(d, col))).size; break;
    }
    return { id: kpi.id, calculatedValue: val };
  });

  // 2. Charts — aggregate then normalise keys
  const charts: ChartSnapshot[] = (config.charts || []).map((chart) => {
    const joined = resolveJoinedData(chart, datasets);
    const xKey = chart.xAxisDataKey;
    const yKeys = chart.yAxisDataKeys;

    let rows: any[];
    if (chart.type === "scatter") {
      rows = joined.slice(0, 500).map((r) => normaliseRow(r, yKeys, xKey));
    } else {
      const agg = aggregate(joined, xKey, yKeys, chart.type === "pie" ? 10 : 20);
      rows = agg.map((r) => normaliseRow(r, yKeys, xKey));
    }

    return {
      id: chart.id,
      data: rows,
      xAxisDataKey: stripPrefix(xKey),
      yAxisDataKeys: yKeys.map(stripPrefix),
    };
  });

  return { kpis, charts };
}
