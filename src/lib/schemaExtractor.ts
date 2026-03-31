import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface ColumnMeta {
  name: string;
  type: 'number' | 'string' | 'date' | 'boolean';
  sampleValues: any[];
  uniqueSampleCount: number;
  nullCount: number;
  looksLikeDate: boolean;
  looksLikeCurrency: boolean;
  looksLikePercentage: boolean;
  looksLikeId: boolean;
  min?: number;
  max?: number;
}

export interface TableSchema {
  tableName: string;
  role: 'fact' | 'dimension' | 'unknown';
  rowCount: number;
  columns: ColumnMeta[];
}

export interface DatasetSchema {
  tables: TableSchema[];
  relationships: Relationship[];
  detectedDomain: string; 
  primaryMetricColumns: string[]; 
  primaryDateColumns: string[];   
}

export interface Relationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  confidence: 'high' | 'medium';
}

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}/,
  /^\d{1,2}\/\d{1,2}\/\d{4}/,
  /^\d{1,2}-[A-Za-z]{3}-\d{4}/,
];

function looksLikeCalendarYear(value: unknown): boolean {
  const text = String(value).trim();
  if (!/^\d{4}$/.test(text)) return false;
  const year = Number(text);
  return year >= 1900 && year <= 2100;
}

function looksLikeDateValue(value: unknown): boolean {
  const text = String(value).trim();
  if (!text) return false;
  if (looksLikeCalendarYear(text)) return true;
  return DATE_PATTERNS.some((pattern) => pattern.test(text)) || (!isNaN(Date.parse(text)) && text.length > 6);
}

function scoreMetricName(name: string): number {
  const normalized = name.toLowerCase();
  let score = 0;

  if (/(score|index|risk|burnout|stress|anxiety|depression|health|dropout|satisfaction|engagement|conversion|churn|retention)/i.test(normalized)) score += 70;
  if (/(revenue|sales|profit|cost|amount|price|value|margin|income|expense|budget|balance|count|quantity|volume)/i.test(normalized)) score += 50;
  if (/(rate|ratio|percent|percentage|growth|trend|performance|usage|pressure|hours|duration|frequency)/i.test(normalized)) score += 20;
  if (/(age|year|month|day|week|quarter|hour|minute)/i.test(normalized)) score -= 20;

  return score;
}

function detectColumnType(values: any[]): ColumnMeta['type'] {
  const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
  if (nonNull.length === 0) return 'string';
  const numericCount = nonNull.filter(v => !isNaN(Number(v))).length;
  if (numericCount / nonNull.length > 0.8) return 'number';
  const dateCount = nonNull.filter((v) => looksLikeDateValue(v)).length;
  if (dateCount / nonNull.length > 0.7) return 'date';
  if (nonNull.every(v => v === true || v === false || v === 'true' || v === 'false' || v === 0 || v === 1)) return 'boolean';
  return 'string';
}

function analyzeColumn(name: string, values: any[]): ColumnMeta {
  const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
  const type = detectColumnType(nonNull);
  const sample = nonNull.slice(0, 5);
  const strSample = sample.map(String);

  const looksLikeCurrency =
    strSample.some(v => /[$€£₹¥]/.test(v) || /,\d{3}/.test(v)) ||
    /(price|cost|revenue|sales|amount|salary|wage|fee|charge|budget|profit|loss|income|spend|earning)/i.test(name);

  const looksLikePercentage =
    strSample.some(v => v.includes('%')) ||
    /(rate|ratio|pct|percent|share|margin|growth|churn|conversion)/i.test(name);

  const dateLikeSampleCount = nonNull.filter((v) => looksLikeDateValue(v)).length;
  const strongDateName = /(date|time|timestamp|created|updated|dob|birth|deadline|quarter)/i.test(name);
  const weakDateName = /(^|_)(year|month|day|period)(_|$)/i.test(name);
  const looksLikeDate =
    type === 'date' ||
    (strongDateName && dateLikeSampleCount >= Math.max(1, Math.ceil(nonNull.length * 0.4))) ||
    (weakDateName && dateLikeSampleCount >= Math.max(1, Math.ceil(nonNull.length * 0.7)));

  const uniqueRatio = nonNull.length > 0 ? new Set(nonNull.map(String)).size / nonNull.length : 0;
  const integerLikeRatio = nonNull.length > 0
    ? nonNull.filter((v) => {
        const num = Number(v);
        return !isNaN(num) && Number.isInteger(num);
      }).length / nonNull.length
    : 0;
  const looksLikeId =
    /(^id$|_id$|_key$|^key$|^code$|_code$|identifier|serial)/i.test(name) ||
    (
      type === 'number' &&
      uniqueRatio >= 0.98 &&
      nonNull.length > 10 &&
      integerLikeRatio >= 0.95 &&
      !looksLikeDate &&
      !looksLikeCurrency &&
      !looksLikePercentage &&
      !/(score|index|risk|rate|ratio|percent|percentage|amount|revenue|sales|profit|cost|value|pressure|performance|stress|anxiety|depression|health|burnout|dropout|usage|hours|duration)/i.test(name)
    );

  const meta: ColumnMeta = {
    name,
    type,
    sampleValues: sample,
    uniqueSampleCount: new Set(nonNull.map(String)).size,
    nullCount: values.length - nonNull.length,
    looksLikeDate,
    looksLikeCurrency,
    looksLikePercentage,
    looksLikeId,
  };

  if (type === 'number') {
    const nums = nonNull.map(Number).filter(n => !isNaN(n));
    if (nums.length > 0) {
      // Use reduce instead of spread to avoid "Maximum call stack size exceeded" on large arrays
      meta.min = nums.reduce((a, b) => a < b ? a : b, Infinity);
      meta.max = nums.reduce((a, b) => a > b ? a : b, -Infinity);
    }
  }

  return meta;
}

function inferTableRole(tableName: string, columns: ColumnMeta[]): TableSchema['role'] {
  const nameL = tableName.toLowerCase();
  if (/(fact|transaction|order|sale|event|log|record|activ)/i.test(nameL)) return 'fact';
  if (/(dim|dimension|lookup|master|ref|product|customer|employee|category|region)/i.test(nameL)) return 'dimension';
  const numericCols = columns.filter(c => c.type === 'number' && !c.looksLikeId).length;
  const idCols = columns.filter(c => c.looksLikeId).length;
  if (numericCols >= 3 && idCols >= 1) return 'fact';
  if (idCols >= 2 && numericCols <= 1) return 'dimension';
  return 'unknown';
}

function detectRelationships(tables: TableSchema[]): Relationship[] {
  const relationships: Relationship[] = [];
  for (let i = 0; i < tables.length; i++) {
    for (let j = 0; j < tables.length; j++) {
      if (i === j) continue;
      for (const colA of tables[i].columns) {
        for (const colB of tables[j].columns) {
          const nameA = colA.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          const nameB = colB.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (nameA === nameB && colA.looksLikeId && colB.looksLikeId) {
            relationships.push({
              fromTable: tables[i].tableName,
              fromColumn: colA.name,
              toTable: tables[j].tableName,
              toColumn: colB.name,
              confidence: 'high',
            });
          } else if (
            (nameA.endsWith('key') || nameA.endsWith('id')) &&
            (nameB.endsWith('key') || nameB.endsWith('id')) &&
            nameA.replace(/(key|id)$/, '') === nameB.replace(/(key|id)$/, '')
          ) {
            relationships.push({
              fromTable: tables[i].tableName,
              fromColumn: colA.name,
              toTable: tables[j].tableName,
              toColumn: colB.name,
              confidence: 'medium',
            });
          }
        }
      }
    }
  }
  // Deduplicate
  return relationships.filter((r, i, arr) =>
    arr.findIndex(x =>
      ((x.fromTable === r.fromTable && x.fromColumn === r.fromColumn && x.toTable === r.toTable) ||
       (x.fromTable === r.toTable && x.fromColumn === r.toColumn && x.toTable === r.fromTable))
    ) === i
  );
}

function detectDomain(tables: TableSchema[]): string {
  const allNames = tables.flatMap(t =>
    [t.tableName, ...t.columns.map(c => c.name)]
  ).join(' ').toLowerCase();

  if (/(sale|revenue|order|customer|product|purchase|invoice)/i.test(allNames)) return 'sales';
  if (/(employee|hr|salary|department|hire|leave|payroll|headcount)/i.test(allNames)) return 'hr';
  if (/(budget|expense|cost|profit|loss|balance|account|ledger|finance)/i.test(allNames)) return 'finance';
  if (/(inventory|stock|warehouse|sku|supply|shipment|vendor)/i.test(allNames)) return 'inventory';
  if (/(patient|diagnosis|hospital|drug|treatment|clinical)/i.test(allNames)) return 'healthcare';
  if (/(student|course|grade|enrollment|school|exam)/i.test(allNames)) return 'education';
  if (/(click|impression|session|bounce|conversion|traffic|campaign)/i.test(allNames)) return 'marketing';
  return 'general';
}

function detectPrimaryMetrics(tables: TableSchema[]): string[] {
  const factTables = tables.filter(t => t.role === 'fact');
  const target = factTables.length > 0 ? factTables : tables;
  return target
    .flatMap(t => t.columns)
    .filter(c => c.type === 'number' && !c.looksLikeId)
    .map(c => ({
      name: c.name,
      score: scoreMetricName(c.name) + (c.looksLikeCurrency ? 50 : 0) + (c.looksLikePercentage ? 30 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .map(c => c.name)
    .slice(0, 6);
}

function detectPrimaryDates(tables: TableSchema[]): string[] {
  return tables
    .flatMap(t => t.columns)
    .filter(c => c.looksLikeDate)
    .filter(c => !/(study_hours|screen_time|usage|duration|score|index|risk|pressure)/i.test(c.name))
    .map(c => c.name)
    .slice(0, 4);
}

export interface ExtractResult {
  schema: DatasetSchema;
  datasets: Record<string, any[]>;
}

export async function extractDatasetSchema(file: File): Promise<ExtractResult> {
  const buffer = await file.arrayBuffer();
  
  // Also fix the squashed CSV issue that was in the previous fileParser
  const isCsv = file.name.endsWith('.csv');
  let workbook: XLSX.WorkBook;
  
  if (isCsv) {
     const text = await file.text();
     const recovered = Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true });
     
     // Mock a workbook behavior
     const sheetName = file.name.replace('.csv', '');
     return processTables({ [sheetName]: recovered.data });
  } else {
     workbook = XLSX.read(buffer, { type: 'array' });
     const rawDatasets: Record<string, any[]> = {};
     
     for (const sheetName of workbook.SheetNames) {
       let raw = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
       
       // Handle Squashed CSV inside Excel Column A
       if (raw.length > 0) {
         const keys = Object.keys(raw[0] as object);
         if (keys.length === 1 && keys[0].includes(',')) {
           console.log(`Detected squashed CSV in sheet ${sheetName}. Auto-repairing...`);
           const combinedCsvText = [keys[0], ...raw.map((r: any) => r[keys[0]])].join('\n');
           const recovered = Papa.parse(combinedCsvText, { header: true, dynamicTyping: true, skipEmptyLines: true });
           raw = recovered.data;
         }
       }
       rawDatasets[sheetName] = raw;
     }
     
     return processTables(rawDatasets);
  }
}

function processTables(rawDatasets: Record<string, any[]>): ExtractResult {
  const tables: TableSchema[] = [];
  
  for (const [sheetName, raw] of Object.entries(rawDatasets)) {
    if (raw.length === 0) continue;

    const allKeys = Object.keys(raw[0] as object);
    const sampleRows = raw.slice(0, 200); // 200 rows is enough for reliable type inference
    const columns = allKeys.map(key => {
      const values = sampleRows.map((row: any) => row[key]);
      return analyzeColumn(key, values);
    });

    const role = inferTableRole(sheetName, columns);
    tables.push({ tableName: sheetName, role, rowCount: raw.length, columns });
  }

  return {
    schema: {
      tables,
      relationships: detectRelationships(tables),
      detectedDomain: detectDomain(tables),
      primaryMetricColumns: detectPrimaryMetrics(tables),
      primaryDateColumns: detectPrimaryDates(tables),
    },
    datasets: rawDatasets
  };
}
