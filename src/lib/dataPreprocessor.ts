/**
 * dataPreprocessor.ts
 *
 * Generates a compact, AI-safe summary of uploaded datasets.
 * NEVER sends raw rows to the AI — only structured statistics.
 */

export interface NumericStat {
  name: string;
  min: number;
  max: number;
  mean: number;
  sum: number;
  nonNullCount: number;
}

export interface CategoryStat {
  name: string;
  topValues: { value: string; count: number }[];
  uniqueCount: number;
}

export interface KeyAggregation {
  groupBy: string;
  metric: string;
  topGroups: { label: string; value: number }[];
}

export interface TableSummary {
  name: string;
  rows: number;
  rowsAnalyzed: number;
  numericColumns: NumericStat[];
  categoricalColumns: CategoryStat[];
  dateRange?: { column: string; from: string; to: string };
  keyAggregations: KeyAggregation[];
}

export interface DataSummary {
  totalRows: number;
  totalTables: number;
  domain: string;
  tables: TableSummary[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isNumericCol = (values: any[]): boolean => {
  const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
  if (nonNull.length === 0) return false;
  return nonNull.filter(v => !isNaN(Number(v))).length / nonNull.length > 0.8;
};

const looksLikeCalendarYear = (value: any): boolean => {
  const text = String(value).trim();
  if (!/^\d{4}$/.test(text)) return false;
  const year = Number(text);
  return year >= 1900 && year <= 2100;
};

const looksLikeDateValue = (value: any): boolean => {
  const text = String(value).trim();
  if (!text) return false;
  if (looksLikeCalendarYear(text)) return true;
  return !isNaN(Date.parse(text)) && text.length > 6;
};

const isDateCol = (name: string, values: any[]): boolean => {
  const sample = values.filter(v => v !== null && v !== undefined && v !== '').slice(0, 20);
  if (sample.length === 0) return false;

  const dateLikeCount = sample.filter(looksLikeDateValue).length;
  const strongDateName = /(date|time|timestamp|created|updated|dob|birth|deadline|quarter)/i.test(name);
  const weakDateName = /(^|_)(year|month|day|period)(_|$)/i.test(name);

  if (strongDateName) return dateLikeCount >= Math.max(1, Math.ceil(sample.length * 0.4));
  if (weakDateName) return dateLikeCount >= Math.max(1, Math.ceil(sample.length * 0.7));
  return dateLikeCount > sample.length * 0.7;
};

const getDateRange = (col: string, values: any[]): { column: string; from: string; to: string } | undefined => {
  const dates = values
    .filter(v => v !== null && v !== undefined && v !== '')
    .map(v => new Date(String(v)))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length < 2) return undefined;
  return {
    column: col,
    from: dates[0].toISOString().split('T')[0],
    to: dates[dates.length - 1].toISOString().split('T')[0],
  };
};

const summarizeNumeric = (name: string, values: any[]): NumericStat => {
  const nums = values
    .map(v => Number(v))
    .filter(n => !isNaN(n) && isFinite(n));
  if (nums.length === 0) return { name, min: 0, max: 0, mean: 0, sum: 0, nonNullCount: 0 };
  const sum = nums.reduce((a, b) => a + b, 0);
  return {
    name,
    // Use reduce, NOT Math.min/max spread — spread crashes on 1M+ element arrays
    min: nums.reduce((a, b) => a < b ? a : b, Infinity),
    max: nums.reduce((a, b) => a > b ? a : b, -Infinity),
    mean: Math.round((sum / nums.length) * 100) / 100,
    sum: Math.round(sum * 100) / 100,
    nonNullCount: nums.length,
  };
};

const summarizeCategorical = (name: string, values: any[]): CategoryStat => {
  const counts: Record<string, number> = {};
  for (const v of values) {
    if (v === null || v === undefined || v === '') continue;
    const key = String(v).trim();
    counts[key] = (counts[key] || 0) + 1;
  }
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([value, count]) => ({ value, count }));
  return { name, topValues: sorted, uniqueCount: Object.keys(counts).length };
};

const scoreNumericColumn = (name: string): number => {
  const normalized = name.toLowerCase();
  let score = 0;

  if (/(score|index|risk|burnout|stress|anxiety|depression|health|dropout|satisfaction|engagement|conversion|churn|retention)/i.test(normalized)) {
    score += 70;
  }
  if (/(revenue|sales|profit|cost|amount|price|value|margin|income|expense|budget|balance|count|quantity|volume)/i.test(normalized)) {
    score += 50;
  }
  if (/(rate|ratio|percent|percentage|growth|trend|performance|usage|pressure|hours|duration|frequency)/i.test(normalized)) {
    score += 25;
  }
  if (/(avg|average|mean|median|total|overall|net|gross)/i.test(normalized)) {
    score += 15;
  }
  if (/(id|key|code|zip|postal|phone|rank|sequence|order_number)/i.test(normalized)) {
    score -= 60;
  }
  if (/(age|year|month|day|week|quarter|hour|minute)/i.test(normalized)) {
    score -= 20;
  }

  return score;
};

const scoreCategoricalColumn = (name: string): number => {
  const normalized = name.toLowerCase();
  let score = 0;

  if (/(category|segment|group|type|status|level|risk|region|country|state|department|product|channel|campaign|gender)/i.test(normalized)) {
    score += 30;
  }
  if (/(name|description|comment|notes|address)/i.test(normalized)) {
    score -= 15;
  }
  if (/(id|key|code)/i.test(normalized)) {
    score -= 40;
  }

  return score;
};

const rankColumns = (names: string[], scorer: (name: string) => number): string[] =>
  names
    .map((name, index) => ({ name, index, score: scorer(name) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.name);

const buildKeyAggregations = (
  rows: any[],
  categoricalCols: string[],
  numericCols: string[],
  maxGroups = 5
): KeyAggregation[] => {
  const aggs: KeyAggregation[] = [];
  const primaryMetric = rankColumns(numericCols, scoreNumericColumn)[0];

  if (!primaryMetric) return aggs;

  for (const groupCol of rankColumns(categoricalCols, scoreCategoricalColumn).slice(0, 3)) {
    const grouped: Record<string, number> = {};
    for (const row of rows) {
      const key = String(row[groupCol] ?? 'Unknown').trim();
      const val = Number(row[primaryMetric]) || 0;
      grouped[key] = (grouped[key] || 0) + val;
    }
    const topGroups = Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxGroups)
      .map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }));

    if (topGroups.length > 0) {
      aggs.push({ groupBy: groupCol, metric: primaryMetric, topGroups });
    }
  }
  return aggs;
};

// ─── Main export ─────────────────────────────────────────────────────────────

export function preprocessDatasets(
  datasets: Record<string, any[]>,
  domain: string = 'general'
): DataSummary {
  const tables: TableSummary[] = [];
  let totalRows = 0;

  for (const [name, rawRows] of Object.entries(datasets)) {
    if (!rawRows || rawRows.length === 0) continue;
    totalRows += rawRows.length;

    // Smart sampling: cap at 50k rows to prevent browser freeze on 1M+ row files.
    // Statistical accuracy is maintained — we sample every Nth row proportionally.
    const MAX_ROWS = 50_000;
    const rows = rawRows.length > MAX_ROWS
      ? rawRows.filter((_, i) => i % Math.ceil(rawRows.length / MAX_ROWS) === 0)
      : rawRows;

    const allCols = Object.keys(rows[0] || {});
    const colValues: Record<string, any[]> = {};
    for (const col of allCols) {
      colValues[col] = rows.map(r => r[col]);
    }

    const numericColNames: string[] = [];
    const categoricalColNames: string[] = [];
    let dateRange: TableSummary['dateRange'];

    for (const col of allCols) {
      if (isDateCol(col, colValues[col])) {
        if (!dateRange) dateRange = getDateRange(col, colValues[col]);
      } else if (isNumericCol(colValues[col])) {
        numericColNames.push(col);
      } else {
        categoricalColNames.push(col);
      }
    }

      const rankedNumericColNames = rankColumns(numericColNames, scoreNumericColumn);
      const rankedCategoricalColNames = rankColumns(categoricalColNames, scoreCategoricalColumn);

      const numericColumns = rankedNumericColNames.map(c => summarizeNumeric(c, colValues[c]));
      const categoricalColumns = rankedCategoricalColNames.map(c => summarizeCategorical(c, colValues[c]));
      const keyAggregations = buildKeyAggregations(rows, rankedCategoricalColNames, rankedNumericColNames);

      tables.push({
        name,
        rows: rawRows.length, // report REAL row count, not sampled count
        rowsAnalyzed: rows.length,
        numericColumns,
        categoricalColumns,
        dateRange,
        keyAggregations,
      });
  }

  return { totalRows, totalTables: tables.length, domain, tables };
}
