import React from 'react';
import { InvoiceRecord } from '../types';
import { calculateDaysRemaining, formatDaysRemainingDisplay } from '../utils/dueDateUtils';
import { AlertTriangle, Clock, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface UrgentWarningSectionProps {
  invoices: InvoiceRecord[];
  asOfDate: string;
  onReviewUrgent: () => void;
  onOpenReview: (invoice: InvoiceRecord) => void;
}

export const UrgentWarningSection: React.FC<UrgentWarningSectionProps> = ({
  invoices,
  asOfDate,
  onReviewUrgent,
  onOpenReview
}) => {
  // Filter for active invoices with 1 to 5 days remaining
  const urgentInvoices = invoices.filter((inv) => {
    if (inv.paymentStatus === 'Paid' || inv.paymentStatus === 'Rejected' || inv.authorisationStatus === 'Rejected') {
      return false;
    }
    const days = calculateDaysRemaining(inv.dueDate, asOfDate);
    return days !== null && days >= 1 && days <= 5;
  });

  if (urgentInvoices.length === 0) return null;

  // Sort section by: 1. Earliest due date 2. Highest invoice amount when due dates are the same
  const sortedUrgent = [...urgentInvoices].sort((a, b) => {
    const daysA = calculateDaysRemaining(a.dueDate, asOfDate) ?? 999;
    const daysB = calculateDaysRemaining(b.dueDate, asOfDate) ?? 999;
    if (daysA !== daysB) {
      return daysA - daysB; // Earliest due date first
    }
    return (b.invoiceAmount || 0) - (a.invoiceAmount || 0); // Highest invoice amount second
  });

  return (
    <div className="bg-amber-50/90 border-2 border-amber-400 rounded-2xl p-6 shadow-md mb-6">
      {/* Warning Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-amber-200/80 pb-4 mb-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl shadow-sm shrink-0 mt-0.5">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 bg-amber-600 text-white font-extrabold text-[11px] rounded uppercase tracking-wider shadow-sm">
                URGENT PAYMENT WARNING
              </span>
              <span className="text-xs font-bold text-amber-900 bg-amber-200/60 px-2 py-0.5 rounded">
                {sortedUrgent.length} {sortedUrgent.length === 1 ? 'Invoice' : 'Invoices'}
              </span>
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mt-1">
              Urgent – Due Within 5 Days
            </h3>
            <p className="text-xs font-semibold text-amber-950 mt-0.5 max-w-2xl leading-relaxed">
              This invoice is due within 5 days. Complete the required approval and bank verification checks immediately to avoid a late payment.
            </p>
          </div>
        </div>

        <div className="shrink-0">
          <button
            onClick={onReviewUrgent}
            className="inline-flex items-center px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer"
          >
            <span>Review Urgent Invoices</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>

      {/* Mini Table of Urgent Invoices */}
      <div className="overflow-x-auto bg-white rounded-xl border border-amber-200 shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-amber-100/70 border-b border-amber-200 text-[11px] font-bold text-amber-950 uppercase tracking-wider">
              <th className="py-2.5 px-4">Invoice & Supplier</th>
              <th className="py-2.5 px-4">Due Date</th>
              <th className="py-2.5 px-4">Days Remaining</th>
              <th className="py-2.5 px-4 text-right">Amount</th>
              <th className="py-2.5 px-4">Status & Controls</th>
              <th className="py-2.5 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100">
            {sortedUrgent.map((inv) => {
              const days = calculateDaysRemaining(inv.dueDate, asOfDate);
              const isOnHold = inv.paymentStatus === 'On Hold' || inv.exceptionStatus === 'Unresolved' || inv.authorisationStatus === 'Blocked';
              const isApproved = inv.departmentApprovalStatus === 'Approved';
              const isVerified = inv.bankVerificationStatus === 'Verified';

              return (
                <tr key={inv.id} className="hover:bg-amber-50/50 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-bold font-mono text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 mr-2 text-[11px]">
                      {inv.invoiceNumber}
                    </span>
                    <span className="font-semibold text-slate-800">{inv.supplierName}</span>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-700">
                    {inv.dueDate}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-amber-100 text-amber-900 font-extrabold rounded border border-amber-300">
                      {formatDaysRemainingDisplay(days)}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-900 text-right">
                    ${(inv.invoiceAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4">
                    {isOnHold ? (
                      <span className="inline-flex items-center px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded text-[10px] font-bold">
                        <ShieldAlert className="w-3 h-3 mr-1 text-rose-600" />
                        On Hold — Exception
                      </span>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${isApproved ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
                          Dept: {inv.departmentApprovalStatus}
                        </span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${isVerified ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'}`}>
                          Bank: {inv.bankVerificationStatus}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => onOpenReview(inv)}
                      className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-900 text-[11px] font-bold rounded border border-slate-300 shadow-xs cursor-pointer"
                    >
                      Inspect →
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
