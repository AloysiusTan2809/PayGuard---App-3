import React, { useState } from 'react';
import { InvoiceRecord } from '../types';
import { X, ExternalLink, Download, Copy, RotateCcw, AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { formatSingaporeTimestamp } from '../utils/dueDateUtils';

interface ReturnToApp2ModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceRecord | null;
  onMarkReturned: (invoiceNumber: string, comment: string, date: string, user: string) => void;
  app2Link?: string;
}

export const ReturnToApp2Modal: React.FC<ReturnToApp2ModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onMarkReturned,
  app2Link = 'https://app2.boonhuat.com.sg/corrections'
}) => {
  if (!isOpen || !invoice) return null;

  const [userComment, setUserComment] = useState('');
  const [returnedBy, setReturnedBy] = useState('Madam Lim (AP Lead)');
  const [copied, setCopied] = useState(false);
  const [marked, setMarked] = useState(false);

  const returnTimestamp = formatSingaporeTimestamp();

  const correctionRequestPayload = {
    handoffRecordId: invoice.handoffRecordId || invoice.id || invoice.invoiceNumber,
    invoiceNumber: invoice.invoiceNumber,
    supplierName: invoice.supplierName,
    poNumber: invoice.poNumber || 'Not stated',
    grnNumber: invoice.grnNumber || 'Not stated',
    invoiceAmount: `$${(invoice.invoiceAmount || 0).toFixed(2)}`,
    dueDate: invoice.dueDate,
    originalApp2Status: invoice.overallMatchStatus,
    originalException: invoice.exceptionSummary || 'None',
    blockingReason: invoice.blockingReason || invoice.exceptionSummary || invoice.overallMatchStatus,
    userComment: userComment || 'Please re-examine PO matching discrepancy in App 2 and issue corrected handoff file.',
    dateReturned: returnTimestamp,
    returnedBy
  };

  const formattedDetailsText = `--- APP 3 RETURN TO APP 2 CORRECTION REQUEST ---
Date Returned: ${returnTimestamp}
Returned By: ${returnedBy}
Handoff Record ID: ${correctionRequestPayload.handoffRecordId}
Invoice Number: ${correctionRequestPayload.invoiceNumber}
Supplier Name: ${correctionRequestPayload.supplierName}
PO Number: ${correctionRequestPayload.poNumber}
GRN Number: ${correctionRequestPayload.grnNumber}
Invoice Amount: ${correctionRequestPayload.invoiceAmount}
Due Date: ${correctionRequestPayload.dueDate}
Original App 2 Status: ${correctionRequestPayload.originalApp2Status}
Original Exception: ${correctionRequestPayload.originalException}
Blocking Reason: ${correctionRequestPayload.blockingReason}
User Comment: ${correctionRequestPayload.userComment}`;

  const handleCopyDetails = () => {
    navigator.clipboard.writeText(formattedDetailsText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    const jsonStr = JSON.stringify(correctionRequestPayload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Correction_Request_${invoice.invoiceNumber}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenApp2 = () => {
    window.open(app2Link, '_blank', 'noopener,noreferrer');
  };

  const handleConfirmMarkReturned = () => {
    onMarkReturned(invoice.invoiceNumber, userComment || 'Returned to App 2 for discrepancy resolution', returnTimestamp, returnedBy);
    setMarked(true);
    setTimeout(() => {
      setMarked(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white border border-slate-300 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 bg-orange-50 border-b border-orange-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-orange-600 rounded-xl text-white">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-orange-950">
                Return to App 2 for Correction
              </h3>
              <p className="text-xs text-orange-800">
                Invoice: <strong className="text-orange-950 font-mono">{invoice.invoiceNumber}</strong> ({invoice.supplierName})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-orange-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Confirmation Banner */}
        {marked && (
          <div className="bg-emerald-50 border-b border-emerald-200 p-4 flex items-center space-x-3 text-emerald-900">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="text-xs font-bold">
              Invoice record marked as "Returned to App 2". Audit entry logged.
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2 text-xs">
            <h4 className="font-bold text-slate-900 flex items-center">
              <AlertTriangle className="w-4 h-4 text-orange-600 mr-1.5" />
              Original Exception Blocking Information
            </h4>
            <div className="grid grid-cols-2 gap-2 text-slate-700 pt-1">
              <div><span className="text-slate-500">App 2 Status:</span> <strong className="text-slate-900">{invoice.overallMatchStatus}</strong></div>
              <div><span className="text-slate-500">PO Number:</span> <strong className="text-slate-900 font-mono">{invoice.poNumber || 'Not stated'}</strong></div>
              <div><span className="text-slate-500">GRN Number:</span> <strong className="text-slate-900 font-mono">{invoice.grnNumber || 'Not stated'}</strong></div>
              <div><span className="text-slate-500">Exception:</span> <strong className="text-rose-700">{invoice.exceptionSummary || 'Discrepancy detected'}</strong></div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Returned By
              </label>
              <input
                type="text"
                value={returnedBy}
                onChange={(e) => setReturnedBy(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Correction Instructions / User Comment
              </label>
              <textarea
                rows={3}
                value={userComment}
                onChange={(e) => setUserComment(e.target.value)}
                placeholder="Explain what needs correction in App 2 (e.g., Re-verify PO quantity with procurement; vendor sent amended invoice)..."
                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Action Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <button
              type="button"
              onClick={handleOpenApp2}
              className="p-3 bg-white border border-slate-300 hover:border-orange-500 hover:bg-orange-50/50 rounded-xl text-left text-xs font-bold text-slate-800 transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between text-orange-600 mb-2">
                <ExternalLink className="w-4 h-4" />
                <span className="text-[10px] uppercase font-extrabold text-orange-700">App 2 Portal</span>
              </div>
              <span>Open Configured App 2 Link</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadFile}
              className="p-3 bg-white border border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/50 rounded-xl text-left text-xs font-bold text-slate-800 transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between text-indigo-600 mb-2">
                <Download className="w-4 h-4" />
                <span className="text-[10px] uppercase font-extrabold text-indigo-700">JSON Request</span>
              </div>
              <span>Download Correction Request File</span>
            </button>

            <button
              type="button"
              onClick={handleCopyDetails}
              className="p-3 bg-white border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/50 rounded-xl text-left text-xs font-bold text-slate-800 transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between text-emerald-600 mb-2">
                <Copy className="w-4 h-4" />
                <span className="text-[10px] uppercase font-extrabold text-emerald-700">{copied ? 'Copied!' : 'Text Payload'}</span>
              </div>
              <span>Copy Invoice Details & Exception</span>
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmMarkReturned}
            className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer flex items-center"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            <span>Mark Record as Returned to App 2</span>
          </button>
        </div>

      </div>
    </div>
  );
};
