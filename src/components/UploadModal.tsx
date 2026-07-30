import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, ShieldAlert, Layers, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { parseExcelWorkbook, ParseExcelResult } from '../utils/excelUtils';
import { InvoiceRecord, UploadMetadata } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (invoices: InvoiceRecord[], metadata: UploadMetadata, option?: 'replace' | 'append' | 'start_fresh') => void;
  existingFilename?: string;
  hasExistingData?: boolean;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onConfirmImport,
  existingFilename,
  hasExistingData
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [parseResult, setParseResult] = useState<ParseExcelResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showDuplicateOptions, setShowDuplicateOptions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (file: File) => {
    setSelectedFile(file);
    setIsLoading(true);
    setParseResult(null);
    setShowDuplicateOptions(false);
    try {
      const result = await parseExcelWorkbook(file);
      setParseResult(result);

      // Check if duplicate dataset or existing dataset loaded
      if (result.success && hasExistingData) {
        if (existingFilename && (existingFilename === file.name || existingFilename.toLowerCase() === file.name.toLowerCase())) {
          setShowDuplicateOptions(true);
        } else {
          setShowDuplicateOptions(true); // Offer options when replacing active data
        }
      }
    } catch (e: any) {
      setParseResult({
        success: false,
        error: e.message || 'Error processing workbook',
        invoices: [],
        metadata: {
          filename: file.name,
          importDate: new Date().toLocaleString(),
          sourceSheet: 'Error',
          detectedWorksheets: [],
          totalRowsImported: 0
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImportWithOption = (option: 'replace' | 'append' | 'start_fresh' = 'replace') => {
    if (parseResult && parseResult.success && parseResult.invoices.length > 0) {
      onConfirmImport(parseResult.invoices, parseResult.metadata, option);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white border border-slate-300 text-slate-900 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 text-white rounded-lg">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Upload Excel Workbook</h3>
              <p className="text-xs text-slate-300">Source-of-Truth Import for App 3 PayGuard Gatekeeper</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          
          {/* Source of Truth Notice */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-xs text-indigo-950 space-y-2">
            <div className="flex items-center space-x-2 font-bold text-indigo-900">
              <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>MANDATORY SOURCE-OF-TRUTH RULE:</span>
            </div>
            <p className="text-slate-700 leading-relaxed">
              PayGuard scans for worksheets and imports strictly from <strong className="text-indigo-950 bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200">“App 3 Handoff”</strong>. Worksheets like <em>Match Results</em> or <em>Exception Log</em> are acknowledged but skipped.
            </p>
          </div>

          {/* Upload Area */}
          {!parseResult && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                dragOver ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                className="hidden"
              />
              <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-4 shadow-xs">
                <Upload className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-1">Click to browse or drag & drop workbook</h4>
              <p className="text-xs text-slate-500">Supports .xlsx containing "App 3 Handoff" sheet</p>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="p-8 text-center text-slate-500 space-y-3">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm font-semibold text-slate-800">Scanning workbook worksheets & mapping 33 columns...</p>
            </div>
          )}

          {/* Parse Result Summary */}
          {parseResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center space-x-3 text-xs">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                  <div>
                    <span className="font-bold text-slate-900">{selectedFile?.name}</span>
                    <span className="text-slate-500 ml-2">({((selectedFile?.size || 0) / 1024).toFixed(1)} KB)</span>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedFile(null); setParseResult(null); setShowDuplicateOptions(false); }}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                >
                  Choose another file
                </button>
              </div>

              {/* Detected Worksheets Box */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center">
                  <Layers className="w-4 h-4 mr-1.5 text-indigo-600" />
                  Detected Worksheets in Workbook
                </h5>
                <div className="flex flex-wrap gap-2">
                  {parseResult.metadata.detectedWorksheets.map((sheet, idx) => {
                    const isTarget = sheet.trim().toLowerCase() === 'app 3 handoff' || sheet.includes('App 3');
                    return (
                      <div
                        key={idx}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 ${
                          isTarget
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-xs'
                            : 'bg-white text-slate-500 border-slate-200 opacity-60'
                        }`}
                      >
                        {isTarget ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5 text-slate-400" />}
                        <span>{sheet}</span>
                        {isTarget ? (
                          <span className="text-[9px] bg-emerald-600 text-white px-1 rounded font-extrabold uppercase">Importing</span>
                        ) : (
                          <span className="text-[9px] bg-slate-200 text-slate-600 px-1 rounded">Skipped</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Duplicate Warning & Options */}
              {showDuplicateOptions && parseResult.success && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-3">
                  <div className="flex items-center space-x-2 text-amber-950 font-extrabold text-sm">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>Duplicate Dataset / Active Workspace Data Detected</span>
                  </div>
                  <p className="text-xs text-amber-900">
                    An active workspace dataset already exists. Choose how to handle the new import:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => handleConfirmImportWithOption('replace')}
                      className="p-3 bg-white border border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/50 rounded-xl text-left font-bold text-slate-800 transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <RefreshCw className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>1. Replace existing records</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleConfirmImportWithOption('append')}
                      className="p-3 bg-white border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/50 rounded-xl text-left font-bold text-slate-800 transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <Plus className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>2. Append new records (skip existing)</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleConfirmImportWithOption('start_fresh')}
                      className="p-3 bg-white border border-slate-300 hover:border-rose-500 hover:bg-rose-50/50 rounded-xl text-left font-bold text-slate-800 transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>3. Start fresh dataset from file</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={onClose}
                      className="p-3 bg-white border border-slate-300 hover:border-slate-500 hover:bg-slate-100 rounded-xl text-left font-bold text-slate-700 transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <X className="w-4 h-4 text-slate-500 shrink-0" />
                        <span>4. Keep existing dataset & cancel</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Success Banner if not duplicate modal */}
              {parseResult.success && !showDuplicateOptions && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs space-y-1">
                  <div className="flex items-center space-x-2 text-emerald-900 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Successfully extracted {parseResult.invoices.length} invoices from “App 3 Handoff”</span>
                  </div>
                  <p className="text-slate-600">
                    All 33 columns mapped cleanly. Ready to populate App 3 queues.
                  </p>
                </div>
              )}

              {!parseResult.success && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-900 space-y-1">
                  <div className="flex items-center space-x-2 font-bold text-rose-950 text-sm">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                    <span>Import Failed</span>
                  </div>
                  <p className="text-slate-700">{parseResult.error}</p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          {!showDuplicateOptions && (
            <button
              onClick={() => handleConfirmImportWithOption('replace')}
              disabled={!parseResult || !parseResult.success || parseResult.invoices.length === 0}
              className={`px-5 py-2 rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center ${
                !parseResult || !parseResult.success || parseResult.invoices.length === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Import Dataset Records
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
