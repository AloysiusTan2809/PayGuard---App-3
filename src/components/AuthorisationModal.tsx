import React, { useState, useEffect } from 'react';
import { InvoiceRecord, UserRole } from '../types';
import { 
  X, CheckSquare, ShieldCheck, AlertTriangle, CheckCircle2, Lock, Shield, 
  ArrowLeft, Loader2
} from 'lucide-react';
import { 
  checkAuthorisationEligibility, 
  formatSingaporeTimestamp, 
  checkSegregationOfDuties 
} from '../utils/authorisationUtils';
import { formatInvoiceTotal } from '../utils/excelUtils';

interface AuthorisationModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceRecord | null;
  allInvoices?: InvoiceRecord[];
  asOfDate?: string;
  currentRole?: UserRole;
  currentUser?: string;
  onAuthoriseSuccess: (updatedInvoice: InvoiceRecord, auditAction: string, auditDetails: string) => void;
  onRecordAudit: (
    action: string,
    userIdentifier: string,
    userRole: string,
    details: string,
    invoiceNumber?: string,
    supplierName?: string,
    statusAfter?: string
  ) => void;
  onShowReceipt?: (invoice: InvoiceRecord) => void;
}

// Safe property getters
const getSafePoNumber = (invoice: InvoiceRecord | null | undefined): string => {
  if (!invoice) return '';
  const val = (invoice as any)['PO Number(s)'] ?? (invoice as any)['PO Number'] ?? invoice.poNumber ?? (invoice as any).poNumbers ?? '';
  return String(val || '').trim();
};

const getSafeGrnNumber = (invoice: InvoiceRecord | null | undefined): string => {
  if (!invoice) return '';
  const val = (invoice as any)['GRN Number(s)'] ?? (invoice as any)['GRN Number'] ?? invoice.grnNumber ?? (invoice as any).grnNumbers ?? '';
  return String(val || '').trim();
};

const getSafeInvoiceTotal = (invoice: InvoiceRecord | null | undefined): number => {
  if (!invoice) return 0;
  const raw = (invoice as any)['Invoice Total'] ?? (invoice as any)['Invoice Amount'] ?? invoice.invoiceTotal ?? invoice.invoiceAmount;
  if (typeof raw === 'number' && !isNaN(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = parseFloat(raw.replace(/[^0-9.-]/g, ''));
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
};

export const AuthorisationModal: React.FC<AuthorisationModalProps> = ({
  isOpen,
  onClose,
  invoice,
  allInvoices = [],
  asOfDate = new Date().toISOString().split('T')[0],
  currentRole = 'AP Lead – Madam Lim',
  currentUser = 'Madam Lim',
  onAuthoriseSuccess,
  onRecordAudit,
  onShowReceipt
}) => {
  // --- ALL REACT HOOKS AT TOP LEVEL (UNCONDITIONAL) ---
  const [authBy, setAuthBy] = useState<string>('Madam Lim');
  const [authComment, setAuthComment] = useState<string>(
    'All matching results, department approvals, and bank accounts verified per protocol.'
  );
  const [confirmCheckbox, setConfirmCheckbox] = useState<boolean>(false);
  const [typedInvoiceNumber, setTypedInvoiceNumber] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [pinLockoutUntil, setPinLockoutUntil] = useState<number | null>(null);
  const [lockoutTimerSec, setLockoutTimerSec] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isConfirmationStep, setIsConfirmationStep] = useState<boolean>(false);

  // Sync state whenever modal opens or invoice changes
  useEffect(() => {
    if (isOpen && invoice) {
      setAuthBy(invoice.authorisedBy || currentUser || 'Madam Lim');
      setAuthComment(
        invoice.authorisationComment || 'All matching results, department approvals, and bank accounts verified per protocol.'
      );
      setConfirmCheckbox(false);
      setTypedInvoiceNumber('');
      setPin('');
      setShowPin(false);
      setFailedAttempts(invoice.failedPinAttempts || 0);
      setPinLockoutUntil(invoice.pinLockoutUntilTimestamp || null);
      setErrorMessage('');
      setSuccessMessage('');
      setIsLoading(false);
      setIsConfirmationStep(false);
    }
  }, [isOpen, invoice, currentUser]);

  // Lockout Countdown Timer
  useEffect(() => {
    if (!pinLockoutUntil) {
      setLockoutTimerSec(0);
      return;
    }
    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((pinLockoutUntil - Date.now()) / 1000));
      setLockoutTimerSec(remaining);
      if (remaining === 0) {
        setPinLockoutUntil(null);
        setFailedAttempts(0);
      }
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [pinLockoutUntil]);

  // --- EARLY RETURNS AFTER HOOKS ---
  if (!isOpen) return null;

  if (!invoice) {
    return (
      <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in text-slate-100 font-sans">
        <div className="bg-slate-900 border-2 border-amber-500/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
          <div className="flex items-center space-x-3 text-amber-400">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <h3 className="text-base font-extrabold text-white">Authorisation</h3>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed font-semibold">
            Please select an invoice before authorising.
          </p>
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer border border-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Safe Property Validations
  const supplierName = invoice.supplierName || 'Not stated';
  const invoiceNumber = invoice.invoiceNumber || 'Not stated';
  const poNumber = getSafePoNumber(invoice) || 'Not stated';
  const grnNumber = getSafeGrnNumber(invoice) || 'Not stated';
  const invoiceTotal = getSafeInvoiceTotal(invoice);
  const currency = invoice.currency || 'SGD';
  const deptStatus = invoice.departmentApprovalStatus || 'Pending';
  const bankStatus = invoice.bankVerificationStatus || 'Not Verified';
  const paymentMethod = invoice.acceptedPaymentMethod || 'Not stated';
  const paymentStatus = invoice.paymentStatus || 'Pending';

  // Calculate Eligibility via safe helper
  const eligibility = checkAuthorisationEligibility(invoice);
  const canAuthorise = eligibility.canAuthorise;
  const sodCheck = checkSegregationOfDuties('AUTHORISE', invoice, currentRole as UserRole, currentUser);

  // Submit PIN & Proceed
  const handleSubmitPin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (sodCheck.blockAction) {
      setErrorMessage(`Incompatible Duty Blocked: Role "${currentRole}" is not permitted to perform payment authorisation.`);
      return;
    }

    if (!canAuthorise) {
      setErrorMessage('Prerequisite controls are not met. Authorisation is blocked.');
      return;
    }

    if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setErrorMessage('Please enter the 6-digit Authorisation PIN.');
      return;
    }

    if (pinLockoutUntil && Date.now() < pinLockoutUntil) {
      setErrorMessage(`Authorisation temporarily locked. Please try again in ${lockoutTimerSec} seconds.`);
      return;
    }

    // PIN Verification (Classroom Demo PIN 482615)
    if (pin !== '482615') {
      const newCount = failedAttempts + 1;
      setFailedAttempts(newCount);

      if (newCount < 3) {
        setErrorMessage('Incorrect Authorisation PIN. Please try again.');
        onRecordAudit(
          'Incorrect Authorisation PIN Attempt',
          currentUser || 'Madam Lim',
          currentRole || 'AP Lead – Madam Lim',
          `Incorrect PIN attempt on invoice ${invoiceNumber}. Attempt ${newCount} of 3.`,
          invoiceNumber,
          supplierName,
          paymentStatus
        );
      } else {
        const lockUntil = Date.now() + 60000;
        setPinLockoutUntil(lockUntil);
        setLockoutTimerSec(60);
        setErrorMessage('Authorisation temporarily locked. Please try again in 60 seconds.');
        onRecordAudit(
          'Temporary Authorisation Lock Triggered',
          currentUser || 'Madam Lim',
          currentRole || 'AP Lead – Madam Lim',
          `3 consecutive incorrect PIN attempts on invoice ${invoiceNumber}. 60-second lockout applied.`,
          invoiceNumber,
          supplierName,
          paymentStatus
        );
      }
      return;
    }

    // PIN is correct — proceed to confirmation step
    setIsConfirmationStep(true);
  };

  // Final Commit
  const handleFinalCommit = async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      await new Promise(res => setTimeout(res, 300));

      const timestamp = formatSingaporeTimestamp();
      const receiptId = `ACR-2026-${invoiceNumber.replace(/[^a-zA-Z0-9]/g, '')}`;

      const updatedInvoice: InvoiceRecord = {
        ...invoice,
        authorisationStatus: 'Authorised',
        paymentStatus: 'Authorised – Ready for Manual Payment',
        authorisedBy: authBy || 'Madam Lim',
        authorisationDate: timestamp,
        authorisationComment: authComment || 'All matching results, department approvals, and bank accounts verified per protocol.',
        receiptId: receiptId,
        lastUpdatedDate: timestamp
      };

      onAuthoriseSuccess(
        updatedInvoice,
        'Invoice Authorised',
        `Madam Lim authorised invoice ${invoiceNumber} (${formatInvoiceTotal(invoiceTotal, currency)}) for manual payment. Receipt ID: ${receiptId}. Comment: ${authComment}`
      );

      if (onShowReceipt) {
        onShowReceipt(updatedInvoice);
      }

      onClose();
    } catch (err: any) {
      onRecordAudit(
        'Authorisation Error',
        currentUser || 'Madam Lim',
        currentRole || 'AP Lead – Madam Lim',
        `Error during authorisation commit: ${err?.message || 'Unknown error'}`,
        invoiceNumber,
        supplierName,
        paymentStatus
      );
      setErrorMessage('Authorisation could not be completed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fade-in text-slate-100 font-sans">
      <div className="bg-slate-900 border-2 border-emerald-500/80 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl space-y-0 text-xs">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-950/90 border border-emerald-500/50 rounded-xl text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Final Payment Authorisation</h2>
              <p className="text-xs text-slate-400">AP Lead Gatekeeper Control — {invoiceNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inline Error Notification Banner inside Modal */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-rose-950/90 border border-rose-500/80 rounded-xl text-rose-200 text-xs font-semibold flex items-center space-x-2 animate-shake">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: Main Security Input Form */}
        {!isConfirmationStep ? (
          <form onSubmit={handleSubmitPin} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            
            {/* Required Display Fields Grid */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-400 block font-semibold text-[11px]">Supplier Name</span>
                <strong className="text-white text-xs font-bold line-clamp-1" title={supplierName}>{supplierName}</strong>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[11px]">Invoice Number</span>
                <strong className="text-indigo-300 font-mono text-xs">{invoiceNumber}</strong>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[11px]">Invoice Total</span>
                <strong className="text-emerald-400 font-extrabold text-sm">
                  {formatInvoiceTotal(invoiceTotal, currency)}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[11px]">Currency</span>
                <span className="text-white font-bold text-xs">{currency}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[11px]">Department Approval Status</span>
                <span className={`font-bold text-xs ${deptStatus === 'Approved' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {deptStatus}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[11px]">Bank Verification Status</span>
                <span className={`font-bold text-xs ${bankStatus === 'Verified' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {bankStatus}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[11px]">PO Number</span>
                <span className="text-white font-mono text-xs">{poNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[11px]">GRN Number</span>
                <span className="text-white font-mono text-xs">{grnNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[11px]">Current Payment Status</span>
                <span className="text-indigo-300 font-bold text-xs">{paymentStatus}</span>
              </div>
            </div>

            {/* Instruction Banner */}
            <div className="p-3 bg-indigo-950/60 border border-indigo-500/50 rounded-xl text-indigo-200 text-xs font-semibold">
              Enter your six-digit Authorisation PIN to confirm that you have reviewed this invoice.
            </div>

            {/* Masked 6-Digit Authorisation PIN Input */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-indigo-300">
                  Six-digit Authorisation PIN <span className="text-rose-400">*</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">DEMO PIN: <strong className="text-amber-300 font-bold">482615</strong></span>
              </div>

              <div className="relative flex items-center max-w-xs">
                <input
                  type={showPin ? "text" : "password"}
                  maxLength={6}
                  disabled={!canAuthorise || isLoading || Boolean(pinLockoutUntil && lockoutTimerSec > 0)}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit PIN"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-10 py-2.5 text-sm font-mono tracking-widest text-white focus:outline-none focus:border-indigo-400 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-2 text-slate-400 hover:text-white p-1"
                  title={showPin ? "Hide PIN" : "Show PIN"}
                >
                  {showPin ? <Lock className="w-4 h-4 text-amber-400" /> : <Shield className="w-4 h-4 text-indigo-400" />}
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  !canAuthorise || 
                  pin.length !== 6 || 
                  isLoading ||
                  Boolean(pinLockoutUntil && lockoutTimerSec > 0)
                }
                className={`px-6 py-2.5 rounded-xl text-xs font-extrabold shadow-lg transition-all flex items-center space-x-1.5 ${
                  !canAuthorise || 
                  pin.length !== 6 || 
                  isLoading ||
                  Boolean(pinLockoutUntil && lockoutTimerSec > 0)
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 cursor-pointer'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                <span>Confirm Authorisation</span>
              </button>
            </div>

          </form>
        ) : (
          /* STEP 2: Confirmation Screen */
          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            
            <div className="bg-amber-950/60 border border-amber-500/60 p-3.5 rounded-xl text-amber-200 text-xs font-semibold flex items-start space-x-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                You are authorising invoice {invoiceNumber} for {currency} {formatInvoiceTotal(invoiceTotal, currency)}. PayGuard does not transfer money.
              </span>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block font-semibold text-[11px]">Supplier Name</span>
                <strong className="text-white text-sm">{supplierName}</strong>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[11px]">Invoice Number</span>
                <strong className="text-indigo-300 font-mono text-sm">{invoiceNumber}</strong>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[11px]">Invoice Total</span>
                <strong className="text-emerald-400 font-extrabold text-base">
                  {formatInvoiceTotal(invoiceTotal, currency)}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[11px]">PO Number</span>
                <span className="text-white font-mono">{poNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[11px]">GRN Number</span>
                <span className="text-white font-mono">{grnNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[11px]">Authorised By</span>
                <span className="text-white font-bold">{authBy}</span>
              </div>
            </div>

            {/* Confirmation Actions */}
            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setIsConfirmationStep(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Go Back</span>
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={handleFinalCommit}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Authorisation...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Authorisation</span>
                  </>
                )}
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
