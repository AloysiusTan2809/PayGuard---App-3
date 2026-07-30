import React from 'react';
import { InvoiceRecord, FilterViewTab } from '../types';
import { 
  calculateDaysRemaining, 
  getDueDateCategory, 
  computeMainStatus, 
  formatDaysRemainingDisplay, 
  getSortRank,
  formatDetailedMainStatus
} from '../utils/dueDateUtils';
import { formatInvoiceTotal } from '../utils/excelUtils';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  DollarSign, 
  ArrowRight, 
  Eye, 
  CreditCard, 
  Upload, 
  FileSpreadsheet,
  AlertCircle,
  Calendar,
  ShieldAlert
} from 'lucide-react';

interface InvoiceTableProps {
  invoices: InvoiceRecord[];
  totalInvoicesCount?: number;
  onOpenReview: (invoice: InvoiceRecord, initialTab?: 'OVERVIEW' | 'DEPT_APPROVAL' | 'BANK_VERIFICATION' | 'EXCEPTION_RESOLVE' | 'AUTHORISE' | 'MANUAL_PAYMENT') => void;
  onOpenUploadModal?: () => void;
  emptyMessage?: string;
  asOfDate?: string;
  activeTab?: FilterViewTab;
}

export const InvoiceTable: React.FC<InvoiceTableProps> = ({ 
  invoices, 
  totalInvoicesCount = invoices.length,
  onOpenReview, 
  onOpenUploadModal,
  emptyMessage = "No invoices found in this category.",
  asOfDate = new Date().toISOString().split('T')[0],
  activeTab = 'ALL_IMPORTED'
}) => {
  if (totalInvoicesCount === 0) {
    return (
      <div className="bg-white border border-slate-300 rounded-2xl p-16 text-center text-slate-800 shadow-sm">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-xs">
          <FileSpreadsheet className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-extrabold text-slate-900 mb-2">No data uploaded</h3>
        <p className="text-sm font-semibold text-slate-700 max-w-md mx-auto mb-6 leading-relaxed">
          No invoice data has been uploaded. Upload the App 2 Excel workbook to begin the due-date review.
        </p>
        {onOpenUploadModal && (
          <button
            onClick={onOpenUploadModal}
            className="inline-flex items-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4 mr-2" />
            UPLOAD APP 2 EXCEL
          </button>
        )}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="bg-white border border-slate-300 rounded-xl p-12 text-center text-slate-600 shadow-sm">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
          <Eye className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-slate-800">{emptyMessage}</p>
        <p className="text-xs text-slate-500 mt-1">Select another tab or filter category to view items.</p>
      </div>
    );
  }

  // Sort default table per Requirement 7:
  // 1. Overdue, 2. Due Today, 3. Due Within 5 Days, 4. Due Within 15 Days, 5. Due Within 30 Days, 6. Due Later, 7. On Hold, 8. Authorised, 9. Paid
  // Within each category, show the earliest due date first.
  const sortedInvoices = [...invoices].sort((a, b) => {
    const daysA = calculateDaysRemaining(a.dueDate, asOfDate);
    const daysB = calculateDaysRemaining(b.dueDate, asOfDate);
    const catA = getDueDateCategory(daysA);
    const catB = getDueDateCategory(daysB);
    const mainA = computeMainStatus(a, catA);
    const mainB = computeMainStatus(b, catB);

    const rankA = getSortRank(mainA);
    const rankB = getSortRank(mainB);

    if (rankA !== rankB) {
      return rankA - rankB;
    }
    // Within same category, sort by earliest due date first
    const valA = daysA ?? 9999;
    const valB = daysB ?? 9999;
    if (valA !== valB) {
      return valA - valB;
    }
    return (b.invoiceAmount || 0) - (a.invoiceAmount || 0);
  });

  const getCategoryBadge = (cat: string, mainStatus: string) => {
    if (mainStatus === 'On Hold / Review Required') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-900 border border-rose-300">
          <ShieldAlert className="w-3 h-3 mr-1 text-rose-600 shrink-0" />
          <span>On Hold</span>
        </span>
      );
    }
    if (mainStatus === 'Paid') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300">
          <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600 shrink-0" />
          <span>Paid</span>
        </span>
      );
    }
    if (mainStatus === 'Authorised – Ready for Manual Payment') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-900 border border-blue-300">
          <CreditCard className="w-3 h-3 mr-1 text-blue-600 shrink-0" />
          <span>Authorised</span>
        </span>
      );
    }
    if (cat === 'OVERDUE') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-100 text-red-900 border border-red-300">
          <AlertCircle className="w-3 h-3 mr-1 text-red-600 shrink-0" />
          <span>Overdue</span>
        </span>
      );
    }
    if (cat === 'DUE TODAY') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-orange-100 text-orange-900 border border-orange-300">
          <Clock className="w-3 h-3 mr-1 text-orange-600 shrink-0" />
          <span>Due Today</span>
        </span>
      );
    }
    if (cat === 'URGENT – DUE WITHIN 5 DAYS') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-950 border border-amber-400">
          <AlertTriangle className="w-3 h-3 mr-1 text-amber-600 shrink-0" />
          <span>Urgent (1–5d)</span>
        </span>
      );
    }
    if (cat === 'DUE WITHIN 15 DAYS') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
          <span>Due 15d</span>
        </span>
      );
    }
    if (cat === 'DUE WITHIN 30 DAYS') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
          <span>Due 30d</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
        <span>Due Later</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* If we are on DUE_WITHIN_5_DAYS tab, show prominent urgent banner per Requirement 6 */}
      {activeTab === 'DUE_WITHIN_5_DAYS' && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 flex items-center space-x-3 text-amber-950 shadow-sm">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
          <div className="text-xs">
            <span className="px-2 py-0.5 bg-amber-600 text-white font-extrabold text-[10px] rounded uppercase mr-2 shadow-xs">
              URGENT PAYMENT WARNING
            </span>
            <span className="font-bold">
              Invoices displayed below are due within 5 days. Complete the required approval and bank verification checks immediately to avoid late payment penalties.
            </span>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-300 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-3">Supplier</th>
                <th className="py-3 px-3">Invoice #</th>
                <th className="py-3 px-3">PO #</th>
                <th className="py-3 px-3">GRN #</th>
                <th className="py-3 px-3 text-right">Invoice Total</th>
                <th className="py-3 px-3">Due Date</th>
                <th className="py-3 px-3">Days Remaining</th>
                <th className="py-3 px-3">Due-Date Category</th>
                <th className="py-3 px-3">Match Status</th>
                <th className="py-3 px-3">Dept Approval</th>
                <th className="py-3 px-3">Bank Verification</th>
                <th className="py-3 px-3">Auth Status</th>
                <th className="py-3 px-3">Payment Status</th>
                <th className="py-3 px-3">Main Status</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-800">
              {sortedInvoices.map((inv) => {
                const isTestInvoice = inv.invoiceNumber === 'AA-2026-208';
                const days = calculateDaysRemaining(inv.dueDate, asOfDate);
                const cat = getDueDateCategory(days);
                const mainStatus = computeMainStatus(inv, cat);
                const detailedStatus = formatDetailedMainStatus(inv, cat);

                const isApproved = inv.departmentApprovalStatus === 'Approved';
                const isVerified = inv.bankVerificationStatus === 'Verified';
                const isAuthorised = inv.authorisationStatus === 'Authorised' || inv.paymentStatus === 'Authorised – Ready for Manual Payment';
                const isPaid = inv.paymentStatus === 'Paid';
                const isOnHold = mainStatus === 'On Hold / Review Required';

                return (
                  <tr
                    key={inv.id || inv.invoiceNumber}
                    className={`transition-colors hover:bg-slate-50 ${
                      isTestInvoice ? 'bg-indigo-50/70 border-l-4 border-l-indigo-600 font-medium' : ''
                    } ${
                      isOnHold ? 'bg-rose-50/30' : ''
                    }`}
                  >
                    {/* 1. Supplier */}
                    <td className="py-3 px-3 font-bold text-slate-900 max-w-[140px] truncate" title={inv.supplierName}>
                      {inv.supplierName}
                    </td>

                    {/* 2. Invoice Number */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="font-bold font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 text-[11px] text-slate-900">
                        {inv.invoiceNumber}
                      </span>
                      {isTestInvoice && (
                        <span className="block mt-1 px-1 py-0.5 text-[8px] font-extrabold bg-indigo-600 text-white rounded uppercase tracking-tighter w-max">
                          Test Case
                        </span>
                      )}
                    </td>

                    {/* 3. PO Number */}
                    <td className="py-3 px-3 font-mono text-slate-600 text-[11px] whitespace-nowrap">
                      {inv.poNumber || '—'}
                    </td>

                    {/* 4. GRN Number */}
                    <td className="py-3 px-3 font-mono text-slate-600 text-[11px] whitespace-nowrap">
                      {inv.grnNumber || '—'}
                    </td>

                    {/* 5. Invoice Total */}
                    <td className="py-3 px-3 font-mono font-extrabold text-slate-900 text-right whitespace-nowrap">
                      {formatInvoiceTotal(inv.invoiceTotal || inv.invoiceAmount, inv.currency)}
                    </td>

                    {/* 5. Due Date */}
                    <td className="py-3 px-3 font-mono font-bold text-slate-700 whitespace-nowrap">
                      {inv.dueDate}
                    </td>

                    {/* 6. Days Remaining */}
                    <td className="py-3 px-3 font-mono text-[11px] whitespace-nowrap">
                      <span className={`px-1.5 py-0.5 rounded font-bold ${
                        days !== null && days < 0 
                          ? 'bg-red-100 text-red-900 border border-red-300' 
                          : days === 0 
                          ? 'bg-orange-100 text-orange-900 border border-orange-300'
                          : days !== null && days <= 5
                          ? 'bg-amber-100 text-amber-950 border border-amber-400 font-extrabold'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {formatDaysRemainingDisplay(days)}
                      </span>
                    </td>

                    {/* 7. Due-Date Category */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getCategoryBadge(cat, mainStatus)}
                    </td>

                    {/* 8. Overall Match Status */}
                    <td className="py-3 px-3 max-w-[150px]">
                      <div className="line-clamp-1 text-[11px] font-semibold text-slate-800" title={inv.overallMatchStatus}>
                        {inv.overallMatchStatus}
                      </div>
                      {inv.exceptionSummary && inv.exceptionSummary !== 'None' && (
                        <div className="text-[10px] text-rose-700 font-bold line-clamp-1" title={inv.exceptionSummary}>
                          Ex: {inv.exceptionSummary}
                        </div>
                      )}
                    </td>

                    {/* 9. Department Approval */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        isApproved
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : inv.departmentApprovalStatus === 'Rejected'
                          ? 'bg-rose-100 text-rose-900 border border-rose-300'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}>
                        {inv.departmentApprovalStatus}
                      </span>
                    </td>

                    {/* 10. Bank Verification */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        isVerified
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : inv.bankVerificationStatus === 'Rejected'
                          ? 'bg-rose-100 text-rose-900 border border-rose-300'
                          : 'bg-rose-100 text-rose-900 border border-rose-300'
                      }`}>
                        {inv.bankVerificationStatus}
                      </span>
                    </td>

                    {/* 11. Authorisation Status */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        isAuthorised
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold'
                          : inv.authorisationStatus === 'Blocked' || isOnHold
                          ? 'bg-rose-100 text-rose-900 border border-rose-300'
                          : 'bg-slate-100 text-slate-700 border border-slate-300'
                      }`}>
                        {inv.authorisationStatus === 'Blocked' && isOnHold ? 'Blocked (Hold)' : inv.authorisationStatus}
                      </span>
                    </td>

                    {/* 12. Payment Status */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        isPaid
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : isAuthorised
                          ? 'bg-blue-100 text-blue-900 border border-blue-300'
                          : inv.paymentStatus === 'On Hold' || isOnHold
                          ? 'bg-rose-100 text-rose-900 border border-rose-300'
                          : 'bg-slate-100 text-slate-700 border border-slate-300'
                      }`}>
                        {inv.paymentStatus}
                      </span>
                    </td>

                    {/* 13. Main Status (Adhering to Hierarchy) */}
                    <td className="py-3 px-3 max-w-[160px]">
                      <div className={`text-[11px] font-extrabold leading-snug line-clamp-2 ${
                        isOnHold ? 'text-rose-800 font-mono' : isPaid ? 'text-emerald-800' : isAuthorised ? 'text-blue-800' : 'text-slate-900'
                      }`} title={detailedStatus}>
                        {mainStatus}
                      </div>
                    </td>

                    {/* 14. Action */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => onOpenReview(inv, isAuthorised && !isPaid ? 'MANUAL_PAYMENT' : 'OVERVIEW')}
                        className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer shadow-xs ${
                          isTestInvoice
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            : isAuthorised && !isPaid
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300'
                        }`}
                      >
                        <span>{isPaid ? 'View' : isAuthorised ? 'Record Pay' : 'Review'}</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
