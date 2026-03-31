"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { extractDatasetSchema, ExtractResult } from "@/lib/schemaExtractor";

interface FileUploaderProps {
  onFileParsed: (result: ExtractResult, file: File) => void;
}

export default function FileUploader({ onFileParsed }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const processFile = async (file: File) => {
    try {
      setError(null);
      setLoading(true);

      // Friendly warning for very large files (>500MB)
      const fileMB = file.size / (1024 * 1024);
      if (fileMB > 500) {
        setError(`Large file detected (${fileMB.toFixed(0)}MB). Files over 500MB may crash the browser memory. Consider splitting your dataset for faster results.`);
        setLoading(false);
        return;
      }

      const result = await extractDatasetSchema(file);
      onFileParsed(result, file);
    } catch (err: any) {
      setError(err.message || "Failed to process file.");
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative group rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-300 ease-out ${
          isDragging 
            ? "border-green-500 bg-white/5 shadow-[0_0_30px_rgba(34,197,94,0.2)] scale-[1.02]" 
            : "border-white/10 hover:border-white/30 bg-white/[0.02] hover:bg-white/5"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="pointer-events-none relative z-10 flex flex-col items-center justify-center">
          <div className="mb-4 rounded-full bg-white/5 p-4 text-white/60 group-hover:text-white transition-colors duration-300 shadow-xl border border-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <h3 className="mb-2 text-xl font-semibold text-white">Upload your raw data</h3>
          <p className="mb-6 text-sm text-secondary">Drag & drop your .csv or .xlsx file here, entirely secure & private.</p>
          
          <label className="relative cursor-pointer pointer-events-auto rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black shadow-sm transition-all hover:bg-gray-200">
            <span>Browse files</span>
            <input 
              type="file" 
              className="sr-only" 
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleFileChange}
            />
          </label>
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/80 backdrop-blur-sm">
             <div className="flex flex-col items-center gap-3">
               <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
               <p className="text-sm font-medium text-white/80 animate-pulse">Parsing file...</p>
               <p className="text-xs text-white/40">Large files may take a few seconds</p>
             </div>
          </div>
        )}
      </motion.div>

      {error && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-4 font-mono text-sm text-red-400">
          Error: {error}
        </motion.div>
      )}
    </div>
  );
}
