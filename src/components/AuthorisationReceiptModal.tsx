import React from 'react';
import { InvoiceRecord } from '../types';
import { formatInvoiceTotal } from '../utils/excelUtils';
import { maskBankAccount, getCleanExceptionWording } from '../utils/authorisationUtils';
import { ShieldCheck, Printer, Download, X, CheckCircle2, FileText, AlertCircle } from 'lucide-react';

interface AuthorisationReceiptModalProps {
  invoice: InvoiceRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AuthorisationReceiptModal: React.FC<AuthorisationReceiptModalProps> = ({
  invoice,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !invoice) return null;

  const receiptId = invoice.receiptId || `ACR-2026-${invoice.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '')}`;
  const datasetSource = invoice.sourceWorkbook || invoice.sourceFile || 'App 3 Handoff.xlsx';

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const textContent = `
===================================================================
                  PAYGUARD AUTHORISATION CONTROL RECEIPT
===================================================================
Receipt ID:                 ${receiptId}
Dataset Source:             ${datasetSource}
Generated Timestamp:        ${invoice.authorisationDate || new Date().toISOString()}

INVOICE & SUPPLIER DETAILS
-------------------------------------------------------------------
Supplier Name:              ${invoice.supplierName}
Invoice Number:             ${invoice.invoiceNumber}
PO Number(s):               ${invoice.poNumber || 'Not stated'}
GRN Number(s):              ${invoice.grnNumber || 'Not stated'}
Invoice Total:              ${formatInvoiceTotal(invoice.invoiceTotal || invoice.invoiceAmount, invoice.currency)}
Currency:                   ${invoice.currency || 'SGD'}
Accepted Payment Method:    ${invoice.acceptedPaymentMethod || 'Not stated'}
Due Date:                   ${invoice.dueDate}
Due-Date Category:          ${invoice.computedDueDateCategory || 'DUE LATER'}

CONTROL & MATCHING STATUS
-------------------------------------------------------------------
App 2 Match Status:         ${invoice.overallMatchStatus}
Exception Status:           ${getCleanExceptionWording(invoice)}
Department Approval:        ${invoice.departmentApprovalStatus} (By: ${invoice.departmentApprovedBy || 'Not stated'})
Bank Details Verification:  ${invoice.bankVerificationStatus} (By: ${invoice.bankVerifiedBy || 'Not stated'})
Masked Bank Account:        ${maskBankAccount(invoice.bankAccountNumber)}

AUTHORISATION RECORD
-------------------------------------------------------------------
Authorised By:              ${invoice.authorisedBy || 'Madam Lim'}
Authorisation Date & Time:  ${invoice.authorisationDate}
Authorisation Comment:      ${invoice.authorisationComment || 'No comment provided'}
Final Status:               Authorised – Ready for Manual Payment

NOTICE:
This receipt confirms authorisation only. It does not prove that a bank payment was completed.
PayGuard records authorisation and external payment information only. It does not transfer money.
===================================================================
`;

    const blob = new Blob([textContent.trim()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Authorisation_Receipt_${receiptId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-emerald-500/40 rounded-xl shadow-2xl text-slate-100 my-8 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border-b border-emerald-800/50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">Authorisation Control Receipt</h3>
              <p className="text-xs text-emerald-300 font-mono">Receipt ID: {receiptId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 text-sm">

          {/* Verification Badge */}
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg flex items-center justify-between text-emerald-300 text-xs">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="font-semibold">Authorisation Confirmed & Locked</span>
            </div>
            <span className="font-mono text-slate-400">{invoice.authorisationDate}</span>
          </div>

          {/* Invoice Summary Grid */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-950/60 border border-slate-800 rounded-lg text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Supplier Name</span>
              <strong className="text-white text-sm font-semibold">{invoice.supplierName}</strong>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Invoice Number</span>
              <strong className="text-indigo-300 text-sm font-mono font-bold">{invoice.invoiceNumber}</strong>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">PO Number(s)</span>
              <span className="text-slate-200 font-mono">{invoice.poNumber || 'Not stated'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">GRN Number(s)</span>
              <span className="text-slate-200 font-mono">{invoice.grnNumber || 'Not stated'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Invoice Total</span>
              <strong className="text-emerald-400 text-base font-extrabold">
                {formatInvoiceTotal(invoice.invoiceTotal || invoice.invoiceAmount, invoice.currency)}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Currency</span>
              <span className="text-slate-200 font-bold">{invoice.currency || 'SGD'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Due Date</span>
              <span className="text-slate-200 font-mono">{invoice.dueDate}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Payment Method</span>
              <span className="text-slate-200 font-medium">{invoice.acceptedPaymentMethod || 'Not stated'}</span>
            </div>
          </div>

          {/* Control Verification Grid */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Control & Audit Summary</span>
            </h4>
            
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-800/40 rounded-lg text-xs border border-slate-700/50">
              <div>
                <span className="text-slate-400 block">App 2 Match Status</span>
                <span className="text-emerald-300 font-bold">{invoice.overallMatchStatus}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Exception Status</span>
                <span className="text-indigo-300 font-medium">{getCleanExceptionWording(invoice)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Department Approved By</span>
                <span className="text-white font-medium">{invoice.departmentApprovedBy || 'Not stated'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Bank Details Verified By</span>
                <span className="text-white font-medium">{invoice.bankVerifiedBy || 'Not stated'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Masked Bank Account</span>
                <span className="text-slate-300 font-mono">{maskBankAccount(invoice.bankAccountNumber)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Dataset Source</span>
                <span className="text-slate-300 font-mono text-[11px] truncate block">{datasetSource}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Authorised By</span>
                <span className="text-emerald-400 font-bold">{invoice.authorisedBy || 'Madam Lim'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Final Status</span>
                <span className="text-emerald-400 font-bold">Authorised – Ready for Manual Payment</span>
              </div>
            </div>
          </div>

          {/* Authorisation Comment */}
          <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700/60 text-xs">
            <span className="text-slate-400 block font-semibold mb-1">Authorisation Comment / Audit Note</span>
            <p className="text-slate-200 italic font-mono bg-slate-950/60 p-2.5 rounded border border-slate-800">
              "{invoice.authorisationComment || 'Reviewed and authorised for payment compliance.'}"
            </p>
          </div>

          {/* Human Control Disclaimer */}
          <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-lg flex items-start space-x-2.5 text-amber-300 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-200">
                This receipt confirms authorisation only. It does not prove that a bank payment was completed.
              </p>
              <p className="text-slate-400 text-[11px]">
                PayGuard records authorisation and external payment information only. It does not transfer money.
              </p>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-mono">
            Audit Trail Appended • Non-Transferring Control
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleDownload}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-slate-700"
            >
              <Download className="w-4 h-4" />
              <span>Download Copy</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Print Receipt</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
