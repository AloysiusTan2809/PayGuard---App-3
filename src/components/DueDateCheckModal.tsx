import React, { useState } from 'react';
import { InvoiceRecord, DueDateCategory } from '../types';
import { 
  calculateDaysRemaining, 
  getDueDateCategory, 
  computeMainStatus, 
  formatDaysRemainingDisplay 
} from '../utils/dueDateUtils';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Download, 
  Copy, 
  X, 
  ShieldAlert, 
  FileText, 
  Calendar,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface DueDateCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: InvoiceRecord[];
  asOfDate: string;
  isDemoDateMode: boolean;
  onSelectCategory?: (tab: any) => void;
  onRecordAudit: (action: string, details: string) => void;
}

interface ReminderDraft {
  id: string;
  invoiceNumber: string;
  supplierName: string;
  amount: number;
  dueDate: string;
  daysRemaining: number | null;
  category: DueDateCategory;
  thresholdLabel: string;
  type: 'REMINDER' | 'FOLLOW_UP';
  subject: string;
  body: string;
}

export const DueDateCheckModal: React.FC<DueDateCheckModalProps> = ({
  isOpen,
  onClose,
  invoices,
  asOfDate,
  isDemoDateMode,
  onSelectCategory,
  onRecordAudit
}) => {
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'DRAFTS' | 'FOLLOW_UPS'>('SUMMARY');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Generate reminder drafts and exception follow-ups
  const drafts: ReminderDraft[] = [];
  const followUps: ReminderDraft[] = [];

  invoices.forEach((inv) => {
    // Only evaluate active (not Paid, not Rejected)
    if (inv.paymentStatus === 'Paid' || inv.paymentStatus === 'Rejected' || inv.authorisationStatus === 'Rejected') {
      return;
    }

    const days = calculateDaysRemaining(inv.dueDate, asOfDate);
    const cat = getDueDateCategory(days);
    const mainStatus = computeMainStatus(inv, cat);
    const isOnHold = mainStatus === 'On Hold / Review Required';

    let thresholdLabel = '';
    if (cat === 'OVERDUE') thresholdLabel = 'Overdue Notice';
    else if (cat === 'DUE TODAY') thresholdLabel = 'Due Today Reminder';
    else if (cat === 'URGENT – DUE WITHIN 5 DAYS') thresholdLabel = 'Urgent Payment Reminder';
    else if (cat === 'DUE WITHIN 15 DAYS') thresholdLabel = '15-Day Approaching Reminder';
    else if (cat === 'DUE WITHIN 30 DAYS') thresholdLabel = '30-Day Notice';
    else return; // Only thresholds: 30, 15, 5, Due Today, Overdue

    const formattedDays = formatDaysRemainingDisplay(days);
    const formattedAmount = `$${(inv.invoiceAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (isOnHold) {
      // Rule: For an on-hold invoice approaching its due date, use: "Urgent Exception Follow-Up"
      const reason = inv.exceptionSummary && inv.exceptionSummary !== 'None' ? inv.exceptionSummary : inv.overallMatchStatus;
      followUps.push({
        id: `followup-${inv.invoiceNumber}`,
        invoiceNumber: inv.invoiceNumber,
        supplierName: inv.supplierName,
        amount: inv.invoiceAmount,
        dueDate: inv.dueDate,
        daysRemaining: days,
        category: cat,
        thresholdLabel: 'Urgent Exception Follow-Up',
        type: 'FOLLOW_UP',
        subject: `[Urgent Exception Follow-Up] Invoice ${inv.invoiceNumber} (${inv.supplierName}) - ${thresholdLabel}`,
        body: `This invoice is due within ${days !== null && days > 0 ? `${days} days` : 'soon'} but remains on hold because of an unresolved discrepancy (${reason}). Resolve the exception before payment can be authorised.\n\nInvoice Details:\n- Invoice Number: ${inv.invoiceNumber}\n- Supplier: ${inv.supplierName}\n- Amount: ${formattedAmount}\n- Due Date: ${inv.dueDate} (${formattedDays})\n- Hold Reason: ${reason}`
      });
    } else {
      // Normal reminder draft
      drafts.push({
        id: `draft-${inv.invoiceNumber}`,
        invoiceNumber: inv.invoiceNumber,
        supplierName: inv.supplierName,
        amount: inv.invoiceAmount,
        dueDate: inv.dueDate,
        daysRemaining: days,
        category: cat,
        thresholdLabel,
        type: 'REMINDER',
        subject: `[${thresholdLabel}] Invoice ${inv.invoiceNumber} (${inv.supplierName}) - Due ${inv.dueDate}`,
        body: `Please note that invoice ${inv.invoiceNumber} from ${inv.supplierName} for the amount of ${formattedAmount} is currently classified as "${cat}" (${formattedDays}).\n\nPlease ensure all required Department Approval and Bank Verification controls are completed promptly so payment can be authorised by Madam Lim without delay.`
      });
    }
  });

  // Summary counts
  const overdueCount = drafts.filter(d => d.category === 'OVERDUE').length;
  const dueTodayCount = drafts.filter(d => d.category === 'DUE TODAY').length;
  const urgent5Count = drafts.filter(d => d.category === 'URGENT – DUE WITHIN 5 DAYS').length;
  const due15Count = drafts.filter(d => d.category === 'DUE WITHIN 15 DAYS').length;
  const due30Count = drafts.filter(d => d.category === 'DUE WITHIN 30 DAYS').length;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadAllDrafts = () => {
    const allItems = [...drafts, ...followUps];
    if (allItems.length === 0) return;

    let content = `PAYGUARD DUE-DATE REMINDER & EXCEL EXCEPTION FOLLOW-UP DRAFTS\n`;
    content += `As-of Date: ${asOfDate} ${isDemoDateMode ? '(Simulated Demo Mode)' : '(Current Local Date)'}\n`;
    content += `Generated on: ${new Date().toLocaleString()}\n`;
    content += `${'='.repeat(70)}\n\n`;

    allItems.forEach((item, i) => {
      content += `--- DRAFT #${i + 1}: ${item.thresholdLabel} (${item.type}) ---\n`;
      content += `SUBJECT: ${item.subject}\n\n`;
      content += `${item.body}\n`;
      content += `${'='.repeat(70)}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `PayGuard_Reminder_Drafts_${asOfDate}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onRecordAudit('Reminder Drafts Produced', `Generated and downloaded ${drafts.length} normal reminders and ${followUps.length} exception follow-up drafts for As-of Date ${asOfDate}.`);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-300 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Due-Date Check & Reminder Generator
                {isDemoDateMode && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold bg-amber-500 text-slate-950 rounded uppercase">
                    Demo Mode
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-300">
                Evaluating urgency against As-of Date: <strong className="text-indigo-300 font-mono">{asOfDate}</strong>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Urgent Warning Banner inside Modal */}
        {(urgent5Count > 0 || overdueCount > 0 || dueTodayCount > 0) && (
          <div className="bg-amber-50 border-b border-amber-200 p-4 flex items-start space-x-3 text-amber-900">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <h4 className="font-bold uppercase tracking-wider text-amber-800 mb-0.5">Urgent Payment Warning</h4>
              <p className="text-amber-800">
                There are <strong className="font-bold">{overdueCount + dueTodayCount + urgent5Count} invoices</strong> due today, overdue, or due within 5 days. Complete the required approval and bank verification checks immediately to avoid late payment penalties.
              </p>
            </div>
          </div>
        )}

        {/* Modal Tabs */}
        <div className="border-b border-slate-200 bg-slate-50 px-6 pt-3 flex space-x-4">
          <button
            onClick={() => setActiveTab('SUMMARY')}
            className={`pb-3 px-2 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'SUMMARY'
                ? 'border-indigo-600 text-indigo-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Urgency Summary</span>
          </button>
          <button
            onClick={() => setActiveTab('DRAFTS')}
            className={`pb-3 px-2 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'DRAFTS'
                ? 'border-indigo-600 text-indigo-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Payment Reminders</span>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-extrabold">
              {drafts.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('FOLLOW_UPS')}
            className={`pb-3 px-2 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'FOLLOW_UPS'
                ? 'border-indigo-600 text-indigo-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span>Urgent Exception Follow-Ups</span>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-extrabold">
              {followUps.length}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'SUMMARY' && (
            <div className="space-y-6">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-slate-900 mb-4">Urgency Distribution & Review List</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                  <div className="bg-white p-3 rounded-lg border border-red-200 shadow-sm">
                    <div className="text-xs font-bold text-red-700 uppercase">Overdue</div>
                    <div className="text-2xl font-extrabold text-red-700 mt-1">{overdueCount}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-orange-200 shadow-sm">
                    <div className="text-xs font-bold text-orange-800 uppercase">Due Today</div>
                    <div className="text-2xl font-extrabold text-orange-800 mt-1">{dueTodayCount}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-amber-200 shadow-sm">
                    <div className="text-xs font-bold text-amber-800 uppercase">Due Within 5 Days</div>
                    <div className="text-2xl font-extrabold text-amber-800 mt-1">{urgent5Count}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-blue-200 shadow-sm">
                    <div className="text-xs font-bold text-blue-700 uppercase">Due Within 15 Days</div>
                    <div className="text-2xl font-extrabold text-blue-700 mt-1">{due15Count}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-teal-200 shadow-sm">
                    <div className="text-xs font-bold text-teal-700 uppercase">Due Within 30 Days</div>
                    <div className="text-2xl font-extrabold text-teal-700 mt-1">{due30Count}</div>
                  </div>
                </div>
              </div>

              {/* Exception Follow-Up Spotlight */}
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 text-rose-900">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold flex items-center">
                    <ShieldAlert className="w-4 h-4 mr-2 text-rose-600" />
                    On-Hold Exception Follow-Ups Required ({followUps.length})
                  </h4>
                  <button
                    onClick={() => setActiveTab('FOLLOW_UPS')}
                    className="text-xs font-bold text-rose-700 underline hover:text-rose-900 cursor-pointer"
                  >
                    View Follow-Up Drafts →
                  </button>
                </div>
                <p className="text-xs text-rose-800 leading-relaxed">
                  Invoices approaching their due dates that remain blocked by App 2 discrepancies or missing POs cannot generate normal payment reminders. They require urgent exception resolution follow-ups with the supplier or procurement team.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'DRAFTS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Normal Payment Reminder Drafts ({drafts.length})</h3>
                <span className="text-xs text-slate-500">For invoices with no unresolved hold exceptions</span>
              </div>
              {drafts.length === 0 ? (
                <div className="p-12 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-xs font-medium">
                  No normal reminder drafts required for the current urgency thresholds.
                </div>
              ) : (
                <div className="space-y-3">
                  {drafts.map((draft) => (
                    <div key={draft.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-indigo-300 transition-all">
                      <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-3">
                        <div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {draft.thresholdLabel}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 mt-1">{draft.subject}</h4>
                        </div>
                        <button
                          onClick={() => handleCopy(`${draft.subject}\n\n${draft.body}`, draft.id)}
                          className="inline-flex items-center px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded border border-slate-300 cursor-pointer shrink-0"
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          {copiedId === draft.id ? 'Copied!' : 'Copy Draft'}
                        </button>
                      </div>
                      <pre className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg font-sans whitespace-pre-wrap leading-relaxed border border-slate-200">
                        {draft.body}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'FOLLOW_UPS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-rose-900">Urgent Exception Follow-Ups ({followUps.length})</h3>
                <span className="text-xs text-rose-700">For on-hold invoices approaching their due dates</span>
              </div>
              {followUps.length === 0 ? (
                <div className="p-12 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-xs font-medium">
                  No urgent exception follow-ups required at this time.
                </div>
              ) : (
                <div className="space-y-3">
                  {followUps.map((item) => (
                    <div key={item.id} className="bg-rose-50/50 border border-rose-200 rounded-xl p-4 shadow-sm">
                      <div className="flex items-start justify-between border-b border-rose-200/60 pb-3 mb-3">
                        <div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
                            {item.thresholdLabel}
                          </span>
                          <h4 className="text-xs font-bold text-rose-950 mt-1">{item.subject}</h4>
                        </div>
                        <button
                          onClick={() => handleCopy(`${item.subject}\n\n${item.body}`, item.id)}
                          className="inline-flex items-center px-2.5 py-1.5 bg-white hover:bg-rose-100 text-rose-800 text-[11px] font-semibold rounded border border-rose-300 cursor-pointer shrink-0"
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          {copiedId === item.id ? 'Copied!' : 'Copy Follow-Up'}
                        </button>
                      </div>
                      <pre className="text-xs text-rose-950 bg-white p-3 rounded-lg font-sans whitespace-pre-wrap leading-relaxed border border-rose-200">
                        {item.body}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Audit trail event automatically recorded upon check execution.
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleDownloadAllDrafts}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Download All Drafts (.txt)
            </button>
            <button
              onClick={() => {
                if (onSelectCategory && urgent5Count > 0) {
                  onSelectCategory('DUE_WITHIN_5_DAYS');
                }
                onClose();
              }}
              className="inline-flex items-center px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-all cursor-pointer"
            >
              <span>Close & View Dashboard</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
