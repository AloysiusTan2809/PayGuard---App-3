import React from 'react';
import { UploadMetadata } from '../types';
import { AuthenticatedUser } from '../services/authService';
import { Download, RefreshCw, Upload, ShieldCheck, Calendar, Sparkles, Clock, AlertTriangle, CheckCircle2, Shield, LogOut, UserCheck } from 'lucide-react';

interface HeaderProps {
  metadata: UploadMetadata;
  onOpenUploadModal: () => void;
  onExportExcel: () => void;
  onStartNewDatasetModal: () => void;
  asOfDate: string;
  isDemoDateMode: boolean;
  onToggleDemoMode: () => void;
  onChangeAsOfDate: (newDate: string) => void;
  onRunDueDateCheck: () => void;
  onOpenWalkthroughModal?: () => void;
  currentUser: AuthenticatedUser;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  metadata,
  onOpenUploadModal,
  onExportExcel,
  onStartNewDatasetModal,
  asOfDate,
  isDemoDateMode,
  onToggleDemoMode,
  onChangeAsOfDate,
  onRunDueDateCheck,
  onOpenWalkthroughModal,
  currentUser,
  onSignOut
}) => {
  return (
    <header className="bg-white text-slate-900 border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        
        {/* Top bar: Brand & Primary Actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Title & Brand */}
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
                  PayGuard <span className="text-indigo-600 font-bold">— App 3</span>
                </h1>
                <span className="px-2 py-0.5 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
                  Authorisation & Payment Guard
                </span>
                {metadata.totalRowsImported === 0 ? (
                  <span className="px-2 py-0.5 text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 rounded">
                    No data uploaded
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 rounded">
                    Dataset Loaded ({metadata.totalRowsImported} Invoices)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Supplier Payment Reminder & Manual Authorisation Assistant • Boon Huat Hardware & Supplies Pte Ltd
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {onOpenWalkthroughModal && (
              <button
                onClick={onOpenWalkthroughModal}
                className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg border border-slate-300 transition-all cursor-pointer"
                title="Open Requirement 27 Walkthrough Checklist"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                <span>Walkthrough Test</span>
              </button>
            )}

            <button
              onClick={onRunDueDateCheck}
              className="inline-flex items-center px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold rounded-lg shadow-xs transition-all cursor-pointer border border-amber-400"
              title="Recalculate urgency categories and produce reminder drafts"
            >
              <Clock className="w-4 h-4 mr-1.5" />
              <span>Due-Date Check</span>
            </button>

            <button
              onClick={onOpenUploadModal}
              className="inline-flex items-center px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer"
              title="Upload Excel Workbook containing App 3 Handoff worksheet"
            >
              <Upload className="w-4 h-4 mr-1.5" />
              <span>Upload App 2 Excel</span>
            </button>

            {metadata.totalRowsImported > 0 && (
              <button
                onClick={onExportExcel}
                className="inline-flex items-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                title="Export Current App 3 Handoff worksheet with all updates"
              >
                <Download className="w-4 h-4 mr-1.5" />
                <span>Export Excel</span>
              </button>
            )}

            <button
              onClick={onStartNewDatasetModal}
              className="inline-flex items-center px-3 py-2 bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold rounded-lg border border-rose-200 hover:border-rose-300 transition-colors cursor-pointer"
              title="Start New Dataset with double confirmation"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1 text-rose-600" />
              <span>Start New Dataset</span>
            </button>
          </div>
        </div>

        {/* Secure User Access & As-of Date Bar */}
        <div className="mt-3 pt-2.5 border-t border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 text-xs bg-slate-50 p-2.5 rounded-xl border">
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Secure User Access Info */}
            <div className="flex flex-wrap items-center space-x-2.5 bg-slate-900 text-white px-3 py-1.5 rounded-lg shadow-xs border border-indigo-700">
              <div className="flex items-center space-x-1.5">
                <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-extrabold text-indigo-300 text-xs whitespace-nowrap">Secure User Access:</span>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <span>Signed in as: <strong className="text-white font-extrabold underline">{currentUser.name}</strong></span>
                <span className="text-slate-500">•</span>
                <span>Role: <strong className="text-amber-300 font-extrabold">{currentUser.role}</strong></span>
                <span className="text-slate-500">•</span>
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-300 font-mono text-[11px] font-bold">Session: Active</span>
                </div>
              </div>
              <button
                onClick={onSignOut}
                className="ml-2 inline-flex items-center px-2.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded border border-rose-500 shadow-xs transition-colors cursor-pointer"
                title="Sign out of current PayGuard session"
              >
                <LogOut className="w-3 h-3 mr-1" />
                <span>Sign Out</span>
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="font-bold text-slate-800">As-of Date:</span>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => onChangeAsOfDate(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold shadow-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs"
              />
            </div>

            <button
              onClick={onToggleDemoMode}
              className={`inline-flex items-center px-2.5 py-1 rounded-lg font-bold text-xs border transition-all cursor-pointer ${
                isDemoDateMode
                  ? 'bg-amber-100 text-amber-900 border-amber-400 shadow-xs ring-2 ring-amber-400/30'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 mr-1 ${isDemoDateMode ? 'text-amber-600' : 'text-slate-400'}`} />
              <span>Demo Mode: {isDemoDateMode ? 'ON (Simulated Date)' : 'OFF (Current Local Date)'}</span>
            </button>
          </div>

          <div className="flex items-center space-x-3 text-slate-500 font-medium text-[11px]">
            <span><strong>Worksheet Source:</strong> <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">{metadata.sourceSheet}</code></span>
            <span><strong>Filename:</strong> {metadata.filename}</span>
          </div>
        </div>

        {/* Human Control Notice */}
        <div className="mt-2 text-[11px] text-slate-600 bg-indigo-50/90 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="font-medium text-slate-700">
              <strong>Control Notice:</strong> PayGuard records authorisation and external payment information only. It does not transfer money.
            </span>
          </div>
          <span className="text-[10px] text-indigo-800 font-mono font-bold">Assigned Account Role: {currentUser.role}</span>
        </div>

        {/* Demo Date Mode Banner */}
        {isDemoDateMode && (
          <div className="mt-2 p-2 bg-amber-500/15 border border-amber-300 rounded-lg text-xs font-bold text-amber-950 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>DEMO MODE ACTIVE:</strong> Evaluating payment urgency using simulated date: <strong className="font-mono underline">{asOfDate}</strong>
              </span>
            </div>
            <button
              onClick={onToggleDemoMode}
              className="text-[10px] bg-white hover:bg-amber-100 px-2 py-0.5 rounded font-extrabold text-amber-900 border border-amber-300 uppercase cursor-pointer"
            >
              Reset Date
            </button>
          </div>
        )}

      </div>
    </header>
  );
};
