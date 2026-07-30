import React from 'react';
import { ShieldCheck, Info, AlertTriangle, Lock, FileText, CheckCircle2 } from 'lucide-react';

export const ResponsibleUseView: React.FC = () => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 max-w-5xl mx-auto my-4 animate-fade-in">
      
      {/* Title Header */}
      <div className="border-b border-slate-200 pb-4 flex items-center space-x-3">
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">
            PayGuard Responsible Use & System Scope
          </h2>
          <p className="text-xs text-slate-500">
            Official System Operating Parameters & Governance Rules for Boon Huat Hardware & Supplies Pte Ltd
          </p>
        </div>
      </div>

      {/* Grid of Scope Statements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
          <div className="font-bold text-slate-900 flex items-center">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-extrabold flex items-center justify-center mr-2">1</span>
            System Architecture Context
          </div>
          <p className="text-slate-600 leading-relaxed pl-7">
            PayGuard is <strong>App 3</strong> in Boon Huat Hardware & Supplies Pte Ltd’s connected Accounts Payable workflow (App 1: Invoice Extraction, App 2: 3-Way Matching & Exceptions, App 3: Payment Authorisation & Due Date Tracking).
          </p>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
          <div className="font-bold text-slate-900 flex items-center">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-extrabold flex items-center justify-center mr-2">2</span>
            No Raw Document OCR Parsing
          </div>
          <p className="text-slate-600 leading-relaxed pl-7">
            App 3 does not perform optical character recognition (OCR) or raw invoice PDF parsing. PDF extraction and document analysis are performed upstream in App 1.
          </p>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
          <div className="font-bold text-slate-900 flex items-center">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-extrabold flex items-center justify-center mr-2">3</span>
            Source of Truth Integrity
          </div>
          <p className="text-slate-600 leading-relaxed pl-7">
            PayGuard relies entirely on the structured <strong>“App 3 Handoff”</strong> outputs supplied by App 2. It strictly validates handoff file structure upon upload.
          </p>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
          <div className="font-bold text-slate-900 flex items-center">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-extrabold flex items-center justify-center mr-2">4</span>
            No Real Money Transfer
          </div>
          <p className="text-slate-600 leading-relaxed pl-7">
            PayGuard does not hold real money, execute bank transactions or connect to live banking networks. The app never initiates automatic funds transfer.
          </p>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
          <div className="font-bold text-slate-900 flex items-center">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-extrabold flex items-center justify-center mr-2">5</span>
            External Banking Execution
          </div>
          <p className="text-slate-600 leading-relaxed pl-7">
            All actual payment execution occurs through external corporate banking portals (e.g. DBS IDEAL / UOB BIB) after manual sign-off by Madam Lim.
          </p>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
          <div className="font-bold text-slate-900 flex items-center">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-extrabold flex items-center justify-center mr-2">6</span>
            Administrative AI Assistance
          </div>
          <p className="text-slate-600 leading-relaxed pl-7">
            Urgent alerts, due-date notices and AI-generated drafts provide administrative assistance only and do not replace human review and approval.
          </p>
        </div>

      </div>

      {/* Human Responsibility Card */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-amber-950 text-xs flex items-start space-x-3">
        <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-extrabold text-amber-950 text-sm">7. Mandatory Human Governance & Account Verification</h4>
          <p className="text-amber-900 leading-relaxed">
            Madam Lim retains full responsibility for verifying supplier bank details against approved master records and manually authorising payments in accordance with internal financial controls.
          </p>
        </div>
      </div>

    </div>
  );
};
