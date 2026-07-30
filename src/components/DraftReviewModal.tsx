import React, { useState, useEffect } from 'react';
import { DraftReviewData } from '../types';
import { X, Sparkles, Send, Copy, RefreshCw, FileText, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';

interface DraftReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftData: DraftReviewData | null;
  onConfirmDraft: (confirmedSubject: string, confirmedBody: string, draftType: string) => void;
  onRegenerateWording?: () => void;
}

export const DraftReviewModal: React.FC<DraftReviewModalProps> = ({
  isOpen,
  onClose,
  draftData,
  onConfirmDraft,
  onRegenerateWording
}) => {
  if (!isOpen || !draftData) return null;

  const [subject, setSubject] = useState(draftData.subject);
  const [messageBody, setMessageBody] = useState(draftData.messageBody);
  const [recipient, setRecipient] = useState(draftData.recipient || 'Madam Lim (AP Lead) / Requisitioning Dept');
  const [copied, setCopied] = useState(false);
  const [confirmedSuccess, setConfirmedSuccess] = useState(false);

  useEffect(() => {
    if (draftData) {
      setSubject(draftData.subject);
      setMessageBody(draftData.messageBody);
      setRecipient(draftData.recipient || 'Madam Lim (AP Lead) / Requisitioning Dept');
      setConfirmedSuccess(false);
    }
  }, [draftData]);

  const handleCopy = () => {
    const fullText = `RECIPIENT: ${recipient}\nSUBJECT: ${subject}\n\n${messageBody}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirm = () => {
    onConfirmDraft(subject, messageBody, draftData.draftType);
    setConfirmedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const isExceptionFollowUp = draftData.draftType === 'EXCEPTION_FOLLOW_UP';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white border border-slate-300 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className={`p-5 flex items-center justify-between border-b ${
          isExceptionFollowUp ? 'bg-rose-50 border-rose-200' : 'bg-indigo-50 border-indigo-200'
        }`}>
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-xl text-white ${isExceptionFollowUp ? 'bg-rose-600' : 'bg-indigo-600'}`}>
              {isExceptionFollowUp ? <ShieldAlert className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">
                  {isExceptionFollowUp ? 'Human Review: Internal Exception Follow-Up' : 'Human Review: Payment Reminder Draft'}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                  isExceptionFollowUp ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                }`}>
                  {isExceptionFollowUp ? 'Exception Hold' : 'Payment Reminder'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Related Invoice: <strong className="text-slate-900 font-mono">{draftData.invoiceNumber}</strong> ({draftData.supplierName})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Confirmation Success Alert */}
        {confirmedSuccess && (
          <div className="bg-emerald-50 border-b border-emerald-200 p-4 flex items-center space-x-3 text-emerald-900 animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="text-xs font-bold">
              Draft confirmed! Reminder status updated in PayGuard and logged to audit trail.
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* Metadata Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
              <span className="text-slate-500 font-medium">Reason for Draft:</span>
              <p className="font-semibold text-slate-800 leading-snug">{draftData.reasonForDraft}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
              <span className="text-slate-500 font-medium">Recommended Action:</span>
              <p className="font-semibold text-slate-800 leading-snug">{draftData.recommendedAction}</p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Recipient
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Subject Line
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Message Body (Human Editable)
                </label>
                {onRegenerateWording && (
                  <button
                    type="button"
                    onClick={onRegenerateWording}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3 mr-0.5" />
                    <span>Regenerate Wording</span>
                  </button>
                )}
              </div>
              <textarea
                rows={8}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs font-sans text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
              />
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-[11px] text-amber-900 flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Human Review Mandatory:</strong> PayGuard does not automatically send emails. Confirming this draft records the reminder in PayGuard and copies text for Madam Lim's review.
            </span>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={handleCopy}
            className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 flex items-center cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 mr-1.5" />
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Text Only'}</span>
          </button>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className={`px-5 py-2 text-xs font-bold text-white rounded-lg shadow-sm transition-all cursor-pointer flex items-center space-x-1.5 ${
                isExceptionFollowUp ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 mr-1" />
              <span>Confirm & Save Draft Record</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
