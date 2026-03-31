import Papa from "papaparse";
import * as XLSX from "xlsx";

export type ColumnSchema = {
  name: string;
  type: "string" | "number" | "date" | "boolean" | "unknown";
  sampleValues: any[]; 
  uniqueSampleCount: number;
  looksLikeDate: boolean;
  looksLikeCurrency: boolean;
  looksLikePercentage: boolean;
};

export type ParsedDataResult = {
  schema: ColumnSchema[];
  previewData: any[]; // Small chunk for the UI and AI context
  rowCount: number;
};

// Extremely fast schema detection helper
function detectColumnType(values: any[]): "string" | "number" | "date" | "boolean" | "unknown" {
  const sample = values.find(v => v !== null && v !== undefined && v !== "");
  if (sample === undefined) return "unknown";

  if (typeof sample === "number") return "number";
  if (typeof sample === "boolean") return "boolean";

  if (typeof sample === "string") {
    // Clean string for numeric check (remove currency, commas, percent)
    const cleanStr = sample.replace(/[$€£₹%,]/g, "").trim();
    if (cleanStr !== "" && !isNaN(Number(cleanStr))) return "number";
    
    const lower = sample.toLowerCase();
    if (lower === "true" || lower === "false") return "boolean";

    if (/^\d{4}-\d{2}-\d{2}/.test(sample) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(sample)) {
      return "date";
    }

    return "string";
  }

  return "unknown";
}

export async function parseFile(file: File): Promise<ParsedDataResult> {
  return new Promise((resolve, reject) => {
    const isCsv = file.name.endsWith(".csv");
    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

    if (!isCsv && !isExcel) {
      reject(new Error("Unsupported file type. Please upload a CSV or Excel file."));
      return;
    }

    if (isCsv) {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data;
          const schema = extractSchema(data);
          resolve({
            schema,
            previewData: data.slice(0, 50),
            rowCount: data.length
          });
        },
        error: (error) => reject(error)
      });
    } else if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          
          const firstSheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheetName];
          
          let jsonData = XLSX.utils.sheet_to_json(sheet);
          
          // INTELLIGENT FIX: Check if CSV was accidentally squashed into a single Excel column
          if (jsonData.length > 0) {
            const keys = Object.keys(jsonData[0] as object);
            if (keys.length === 1 && keys[0].includes(',')) {
              console.log("Detected squashed CSV inside Excel column A. Auto-repairing...");
              // Reconstruct the raw CSV text
              const rawCsvHeader = keys[0];
              const rawRows = jsonData.map((row: any) => row[keys[0]]);
              const combinedCsvText = [rawCsvHeader, ...rawRows].join('\n');
              
              // Parse the recovered text properly
              const recovered = Papa.parse(combinedCsvText, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
              });
              jsonData = recovered.data;
            }
          }

          const schema = extractSchema(jsonData);
          
          resolve({
             schema,
             previewData: jsonData.slice(0, 50),
             rowCount: jsonData.length
          });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    }
  });
}

function extractSchema(data: any[]): ColumnSchema[] {
  if (!data || data.length === 0) return [];

  const headers = Object.keys(data[0]);
  return headers.map(header => {
    // Extract a larger column values map to determine the type and counts accurately
    const sampleLimit = Math.min(data.length, 100);
    const columnValues = data.slice(0, sampleLimit).map(row => row[header]);
    
    // Filter out nulls/undefined for accurate metrics
    const validValues = columnValues.filter(v => v !== null && v !== undefined && v !== "");
    
    // Calculate unique count
    const uniqueValues = new Set(validValues.map(v => String(v)));
    
    // Profile formatting traits
    const looksLikeDate = validValues.some(v => 
      typeof v === "string" && (/^\d{4}-\d{2}-\d{2}/.test(v) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(v)) || v instanceof Date
    );
    
    const looksLikeCurrency = validValues.some(v => 
      typeof v === "string" && /[$€£₹]/.test(v)
    );
    
    const looksLikePercentage = validValues.some(v => 
      typeof v === "string" && /%$/.test(v.trim())
    );

    return {
      name: header,
      type: detectColumnType(validValues.slice(0, 10)),
      sampleValues: validValues.slice(0, 4), // 4 explicit samples as requested by user
      uniqueSampleCount: uniqueValues.size,
      looksLikeDate,
      looksLikeCurrency,
      looksLikePercentage
    };
  });
}
