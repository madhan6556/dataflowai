import fs from 'fs';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import fetch from 'node-fetch';
import { buildDashboardPrompt } from './src/lib/buildPrompt.js';
import { GoogleGenerativeAI } from "@google/generative-ai";

async function e2e() {
   console.log("Reading XLSX...");
   const buffer = fs.readFileSync('Dataanalysis_sql_data.xlsx');
   const workbook = XLSX.read(buffer, { type: 'buffer' });
   
   const datasets = {};
   for(const sheetName of workbook.SheetNames) {
      let raw = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
      if (raw.length > 0) {
        const keys = Object.keys(raw[0]);
        if (keys.length === 1 && keys[0].includes(',')) {
           const combinedCsvText = [keys[0], ...raw.map(r => r[keys[0]])].join('\n');
           const recovered = Papa.parse(combinedCsvText, { header: true, dynamicTyping: true, skipEmptyLines: true });
           raw = recovered.data;
        }
      }
      datasets[sheetName] = raw;
   }

   // Manually mock the schema payload for Gemini exactly as schemaExtractor does it
   console.log("Mocking schema...");
   const schema = { tables: [], relationships: [], primaryMetricColumns: [], detectedDomain: "retail" };
   
   for (const [name, rows] of Object.entries(datasets)) {
       const keys = Object.keys(rows[0] || {});
       schema.tables.push({
           tableName: name,
           role: name.includes('dim') ? 'dimension' : 'fact',
           rowCount: rows.length,
           columns: keys.map(k => ({ name: k, type: 'string', sampleValues: [], uniqueSampleCount: 0, nullCount: 0, looksLikeDate: false, looksLikeCurrency: false, looksLikeId: k.toLowerCase().includes('id') || k.toLowerCase().includes('key') }))
       });
   }
   
   console.log("Calling Gemini via API route simulator...");
   const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
   const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });

   try {
     const p = buildDashboardPrompt(schema);
     const result = await model.generateContent(p);
     const text = result.response.text();
     const obj = JSON.parse(text);
     
     console.log("--- Gemini output ---");
     for(let c of obj.charts) {
        console.log(`Chart: ${c.title} | Join: ${c.joinPath || 'none'}`);
     }
     
     fs.writeFileSync('test-out.json', JSON.stringify(obj, null, 2));
     console.log('Saved to test-out.json');
   } catch(e) {
     console.error(e);
   }
}

e2e();
