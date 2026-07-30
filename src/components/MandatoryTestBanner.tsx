import React from 'react';
import { CheckCircle2, Play, AlertCircle, Sparkles } from 'lucide-react';
import { InvoiceRecord } from '../types';

interface MandatoryTestBannerProps {
  invoices: InvoiceRecord[];
  onOpenTestInvoice: (invoice: InvoiceRecord) => void;
}

export const MandatoryTestBanner: React.FC<MandatoryTestBannerProps> = ({ invoices, onOpenTestInvoice }) => {
  const testInvoice = invoices.find(inv => inv.invoiceNumber === 'AA-2026-208');

  return (
    <div className="bg-gradient-to-r from-indigo-900/90 via-slate-900 to-indigo-950/90 border border-indigo-500/40 rounded-xl p-5 text-white shadow-lg mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-2 max-w-3xl">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-indigo-500 text-white rounded-lg">
              <Sparkles className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold tracking-wide text-indigo-300 uppercase">
              Mandatory Workflow Verification Case
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full">
              AA-2026-208
            </span>
          </div>
          <p className="text-sm text-slate-200 leading-relaxed">
            Test the strict 3-step Gatekeeper sequence using invoice <strong className="text-white font-mono bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-800">AA-2026-208</strong> ($12,450.00 from Apex Alloys & Hardware Ltd):
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-300 pt-1">
            <div className="flex items-center space-x-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700 flex items-center justify-center font-bold text-[10px]">1</span>
              <span>Imports as <strong className="text-amber-300">Awaiting Dept Approval</strong></span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700 flex items-center justify-center font-bold text-[10px]">2</span>
              <span>Initial Authorisation <strong className="text-rose-400">Blocked</strong></span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700 flex items-center justify-center font-bold text-[10px]">3</span>
              <span>Record <strong className="text-indigo-300">Dept Approval</strong></span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700 flex items-center justify-center font-bold text-[10px]">4</span>
              <span>Record <strong className="text-indigo-300">Bank Verification</strong></span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700 flex items-center justify-center font-bold text-[10px]">5</span>
              <span>Confirm <strong className="text-emerald-400">Authorise for Payment</strong></span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700 flex items-center justify-center font-bold text-[10px]">6</span>
              <span>Record <strong className="text-emerald-400">Manual Payment Ref</strong></span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          {testInvoice ? (
            <button
              onClick={() => onOpenTestInvoice(testInvoice)}
              className="inline-flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-indigo-500/20 transition-all border border-indigo-400/30 cursor-pointer"
            >
              <Play className="w-4 h-4 mr-2 text-indigo-200 fill-indigo-200" />
              Open AA-2026-208 Test Case
            </button>
          ) : (
            <div className="flex items-center space-x-2 px-3 py-2 bg-rose-950/80 text-rose-300 border border-rose-800 rounded-lg text-xs">
              <AlertCircle className="w-4 h-4" />
              <span>AA-2026-208 not found in current dataset</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
