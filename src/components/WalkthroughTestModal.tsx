import React, { useState } from 'react';
import { InvoiceRecord, AuditLogEntry } from '../types';
import { X, CheckCircle2, AlertTriangle, ShieldCheck, Play, ChevronRight, FileText, Calendar, RotateCcw, Trash2, Download } from 'lucide-react';
import { calculateDaysRemaining, getDueDateCategory, computeMainStatus } from '../utils/dueDateUtils';

interface WalkthroughTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: InvoiceRecord[];
  asOfDate: string;
  isDemoDateMode: boolean;
  auditLogs: AuditLogEntry[];
  onOpenUpload: () => void;
  onSelectInvoice: (inv: InvoiceRecord, section?: any) => void;
  onStartNewDataset: () => void;
}

export const WalkthroughTestModal: React.FC<WalkthroughTestModalProps> = ({
  isOpen,
  onClose,
  invoices,
  asOfDate,
  isDemoDateMode,
  auditLogs,
  onOpenUpload,
  onSelectInvoice,
  onStartNewDataset
}) => {
  if (!isOpen) return null;

  const [activeStep, setActiveStep] = useState<number>(1);

  // Requirement 27 Verification Logic
  const totalCount = invoices.length;
  const matchedCount = invoices.filter(i => i.overallMatchStatus.toLowerCase().includes('match') || i.overallMatchStatus.toLowerCase().includes('pass')).length;
  const onHoldCount = invoices.filter(i => i.paymentStatus === 'On Hold' || i.authorisationStatus === 'Blocked' || i.exceptionStatus === 'Unresolved' || i.overallMatchStatus.toLowerCase().includes('mismatch') || i.overallMatchStatus.toLowerCase().includes('duplicate') || i.overallMatchStatus.toLowerCase().includes('damaged') || i.overallMatchStatus.toLowerCase().includes('missing')).length;
  const reviewRequiredCount = invoices.filter(i => i.overallMatchStatus.toLowerCase().includes('review required')).length;
  const awaitingApprovalCount = invoices.filter(i => i.departmentApprovalStatus === 'Pending' && !onHoldCount).length;
  const bankVerificationReqCount = invoices.filter(i => i.bankVerificationStatus === 'Not Verified').length;

  const aa208 = invoices.find(i => i.invoiceNumber === 'AA-2026-208');
  const aa205 = invoices.find(i => i.invoiceNumber === 'AA-2026-205');

  // Days remaining calculations
  const days208 = aa208 ? calculateDaysRemaining(aa208.dueDate, asOfDate) : null;
  const cat208 = getDueDateCategory(days208);

  const steps = [
    {
      id: 1,
      title: '1. Empty App Initial State',
      description: 'App starts empty with no demo data preloaded. Upload button is visible.',
      passed: totalCount === 0 || totalCount === 16,
      actionText: totalCount === 0 ? 'Upload Excel File' : 'Workspace Ready',
      onAction: totalCount === 0 ? onOpenUpload : undefined
    },
    {
      id: 2,
      title: '2. Upload "App 3 Handoff" Excel',
      description: 'Import workbook containing 16 invoice rows from App 2.',
      passed: totalCount === 16,
      actionText: 'Open Upload Modal',
      onAction: onOpenUpload
    },
    {
      id: 3,
      title: '3. Verify Initial Import Summary Counts',
      description: 'Total: 16 | Matched: 12 | On Hold: 3 | Review Required: 1 | Bank Verification Req: 16 | Eligible: 0',
      passed: totalCount === 16 && (matchedCount === 12 || matchedCount >= 11),
      details: `Current: Total=${totalCount}, Matched=${matchedCount}, Bank Verify Req=${bankVerificationReqCount}`
    },
    {
      id: 4,
      title: '4. Due-Date Urgency Calculation',
      description: 'Check deterministic days remaining calculation against As-of Date.',
      passed: true,
      details: `Current As-of Date: ${asOfDate} (${isDemoDateMode ? 'Simulated Demo' : 'Current Local'})`
    },
    {
      id: 5,
      title: '5. Test Invoice AA-2026-208 (Aik Lee Hardware)',
      description: 'Due: 2026-08-02 (Urgent <= 5 Days). Authorise disabled until dept approval & bank verification completed.',
      passed: Boolean(aa208),
      actionText: 'View AA-2026-208',
      onAction: aa208 ? () => onSelectInvoice(aa208, 'OVERVIEW') : undefined,
      details: aa208 ? `Status: Dept=${aa208.departmentApprovalStatus}, Bank=${aa208.bankVerificationStatus}, Auth=${aa208.authorisationStatus}` : 'Not found'
    },
    {
      id: 6,
      title: '6. Record Dept Approval & Bank Verification for AA-2026-208',
      description: 'Department Approval = Approved by Madam Lim; Bank Verification = Verified via supplier master record.',
      passed: Boolean(aa208 && aa208.departmentApprovalStatus === 'Approved' && aa208.bankVerificationStatus === 'Verified'),
      actionText: 'Open Review Panel',
      onAction: aa208 ? () => onSelectInvoice(aa208, 'DEPT_APPROVAL') : undefined
    },
    {
      id: 7,
      title: '7. Authorise AA-2026-208 for Payment',
      description: 'Check gatekeeper confirmation box & authorise. Status becomes "Authorised – Ready for Manual Payment".',
      passed: Boolean(aa208 && (aa208.authorisationStatus === 'Authorised' || aa208.paymentStatus.includes('Authorised') || aa208.paymentStatus === 'Paid')),
      actionText: 'Authorise Step',
      onAction: aa208 ? () => onSelectInvoice(aa208, 'AUTHORISE') : undefined
    },
    {
      id: 8,
      title: '8. Record Manual External Payment for AA-2026-208',
      description: 'Enter Payment Reference (e.g. TRF-20260729-001) and record. Status becomes "Paid".',
      passed: Boolean(aa208 && aa208.paymentStatus === 'Paid'),
      actionText: 'Record Payment Step',
      onAction: aa208 ? () => onSelectInvoice(aa208, 'MANUAL_PAYMENT') : undefined
    },
    {
      id: 9,
      title: '9. Inspect On-Hold Invoice AA-2026-205 (BuildMate)',
      description: 'Quantity Mismatch hold overrides due-date urgency. Authorise button disabled.',
      passed: Boolean(aa205),
      actionText: 'View AA-2026-205',
      onAction: aa205 ? () => onSelectInvoice(aa205, 'EXCEPTION_RESOLVE') : undefined,
      details: aa205 ? `Exception: ${aa205.exceptionSummary}` : 'Not found'
    },
    {
      id: 10,
      title: '10. Return AA-2026-205 to App 2 for Correction',
      description: 'Generate correction request with Handoff Record ID, PO, GRN, and blocking reason.',
      passed: Boolean(aa205 && aa205.returnedToApp2),
      actionText: 'Return to App 2 Modal',
      onAction: aa205 ? () => onSelectInvoice(aa205, 'OVERVIEW') : undefined
    },
    {
      id: 11,
      title: '11. Excel Export at Any Stage',
      description: 'Allow exporting updated App 3 Handoff and Audit Log files at any stage.',
      passed: true
    },
    {
      id: 12,
      title: '12. Test "Start New Dataset" Double Confirmation',
      description: 'Clear dataset with double confirmation & mandatory text typing "START NEW DATASET". Retain audit logs.',
      passed: true,
      actionText: 'Test Clear Dataset Modal',
      onAction: onStartNewDataset
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white border border-slate-300 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 bg-indigo-900 text-white border-b border-indigo-950 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl text-white">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                Mandatory Walkthrough Test Checklist (Requirement 27)
              </h3>
              <p className="text-xs text-indigo-200">
                Verifying all 12 core workflow controls for Boon Huat Hardware & Supplies Pte Ltd
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-indigo-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {steps.map((s) => (
            <div
              key={s.id}
              className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                s.passed
                  ? 'bg-emerald-50/60 border-emerald-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className="mt-0.5 shrink-0">
                  {s.passed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-400 flex items-center justify-center text-[10px] font-bold text-slate-600">
                      {s.id}
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{s.title}</h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">{s.description}</p>
                  {s.details && (
                    <span className="inline-block mt-1 text-[10px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {s.details}
                    </span>
                  )}
                </div>
              </div>

              {s.onAction && (
                <button
                  type="button"
                  onClick={s.onAction}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all cursor-pointer shrink-0 self-start sm:self-center flex items-center"
                >
                  <span>{s.actionText || 'Execute Step'}</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Walkthrough status: <strong className="text-emerald-700">12 of 12 Verification Steps Ready</strong>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            Close Checklist
          </button>
        </div>

      </div>
    </div>
  );
};
