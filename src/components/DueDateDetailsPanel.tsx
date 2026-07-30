import React from 'react';
import { InvoiceRecord } from '../types';
import { 
  calculateDaysRemaining, 
  getDueDateCategory, 
  computeMainStatus, 
  formatDaysRemainingDisplay, 
  formatDetailedMainStatus, 
  getRecommendedAction 
} from '../utils/dueDateUtils';
import { Calendar, Clock, ShieldCheck, AlertTriangle, CheckCircle2, ShieldAlert, ArrowRight, Sparkles } from 'lucide-react';

interface DueDateDetailsPanelProps {
  invoice: InvoiceRecord;
  asOfDate: string;
}

export const DueDateDetailsPanel: React.FC<DueDateDetailsPanelProps> = ({ invoice, asOfDate }) => {
  const days = calculateDaysRemaining(invoice.dueDate, asOfDate);
  const category = getDueDateCategory(days);
  const mainStatus = computeMainStatus(invoice, category);
  const detailedStatus = formatDetailedMainStatus(invoice, category);
  const action = getRecommendedAction(invoice, category);

  // Financial controls complete check
  const isMatched = invoice.overallMatchStatus.toLowerCase().includes('match') || invoice.overallMatchStatus.toLowerCase().includes('pass') || invoice.overallMatchStatus.toLowerCase().includes('ok');
  const noException = invoice.exceptionStatus !== 'Unresolved' && invoice.paymentStatus !== 'On Hold';
  const isApproved = invoice.departmentApprovalStatus === 'Approved';
  const isVerified = invoice.bankVerificationStatus === 'Verified';
  const controlsComplete = isMatched && noException && isApproved && isVerified;

  const isUrgent = category === 'OVERDUE' || category === 'DUE TODAY' || category === 'URGENT – DUE WITHIN 5 DAYS';
  const isOnHold = mainStatus === 'On Hold / Review Required';

  return (
    <div className={`rounded-2xl border-2 p-5 mb-6 shadow-sm transition-all ${
      isOnHold
        ? 'bg-rose-50/80 border-rose-300 text-rose-950'
        : isUrgent
        ? 'bg-amber-50/80 border-amber-400 text-amber-950'
        : 'bg-indigo-50/50 border-indigo-200 text-slate-900'
    }`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-3 mb-4 border-current/15">
        <div className="flex items-center space-x-3">
          <div className={`p-2.5 rounded-xl text-white shadow-sm ${
            isOnHold ? 'bg-rose-600' : isUrgent ? 'bg-amber-600' : 'bg-indigo-600'
          }`}>
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded uppercase tracking-wider ${
                isOnHold ? 'bg-rose-600 text-white' : isUrgent ? 'bg-amber-600 text-white' : 'bg-indigo-600 text-white'
              }`}>
                Due-Date Details & Control Panel
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/80 border border-current/20">
                {invoice.invoiceNumber}
              </span>
            </div>
            <h4 className="text-base font-extrabold mt-1">
              Urgency Classification: <span className="underline font-mono">{category}</span>
            </h4>
          </div>
        </div>

        <div className="text-right sm:text-right">
          <div className="text-[11px] font-bold opacity-75 uppercase">Active As-of Date</div>
          <div className="text-sm font-mono font-extrabold bg-white/90 px-2.5 py-1 rounded border border-current/20 inline-block mt-0.5 shadow-2xs">
            {asOfDate}
          </div>
        </div>
      </div>

      {/* Grid of the 8 required items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {/* 1. Invoice Date */}
        <div className="bg-white/80 p-3 rounded-xl border border-current/15 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">1. Invoice Date</div>
          <div className="text-sm font-mono font-extrabold mt-1">{invoice.invoiceDate || 'Not stated'}</div>
        </div>

        {/* 2. Due Date */}
        <div className="bg-white/80 p-3 rounded-xl border border-current/15 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">2. Due Date</div>
          <div className="text-sm font-mono font-extrabold mt-1">{invoice.dueDate || 'Not stated'}</div>
        </div>

        {/* 3. Days Remaining */}
        <div className="bg-white/80 p-3 rounded-xl border border-current/15 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">3. Days Remaining</div>
          <div className="text-sm font-mono font-extrabold mt-1">
            {formatDaysRemainingDisplay(days)}
          </div>
        </div>

        {/* 4. Due-Date Category */}
        <div className="bg-white/80 p-3 rounded-xl border border-current/15 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">4. Due-Date Category</div>
          <div className="text-xs font-extrabold mt-1 truncate" title={category}>{category}</div>
        </div>

        {/* 5. As-of Date used */}
        <div className="bg-white/80 p-3 rounded-xl border border-current/15 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">5. Calculation Base</div>
          <div className="text-xs font-mono font-bold mt-1">Relative to {asOfDate}</div>
        </div>

        {/* 6. Main Status */}
        <div className="bg-white/80 p-3 rounded-xl border border-current/15 shadow-2xs sm:col-span-2">
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">6. Main Status (Hierarchy Enforced)</div>
          <div className="text-xs font-extrabold mt-1 leading-snug">{detailedStatus}</div>
        </div>

        {/* 7. Controls Complete? */}
        <div className="bg-white/80 p-3 rounded-xl border border-current/15 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">7. Financial Controls</div>
          <div className="mt-1 flex items-center space-x-1.5">
            {controlsComplete ? (
              <span className="inline-flex items-center px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Completed
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 bg-amber-100 text-amber-900 text-xs font-bold rounded border border-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                Pending Controls
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 8. Recommended Next Action */}
      <div className={`p-3.5 rounded-xl border flex items-start space-x-3 ${
        isOnHold
          ? 'bg-rose-100/90 border-rose-300 text-rose-950 font-semibold'
          : isUrgent
          ? 'bg-amber-100/90 border-amber-400 text-amber-950 font-semibold'
          : 'bg-white border-indigo-200 text-indigo-950 font-semibold'
      }`}>
        <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed">
          <span className="font-bold uppercase tracking-wider mr-1.5 opacity-80">8. Recommended Next Action:</span>
          <span>{action}</span>
        </div>
      </div>
    </div>
  );
};
