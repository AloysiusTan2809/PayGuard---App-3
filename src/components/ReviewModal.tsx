import React, { useState, useEffect } from 'react';
import { InvoiceRecord, DepartmentApprovalStatus, BankVerificationStatus, BankVerificationMethod, ExceptionStatus, UserRole } from '../types';
import { 
  X, CheckCircle2, ShieldCheck, AlertTriangle, Clock, CreditCard, DollarSign, 
  FileText, Building2, Calendar, User, MessageSquare, ArrowRight, Lock, Shield,
  ShieldAlert, Check, HelpCircle, CheckSquare, Sparkles, AlertCircle, CopyCheck
} from 'lucide-react';
import {
  calculateDaysRemaining,
  getDueDateCategory,
  computeMainStatus,
  formatDaysRemainingDisplay,
  formatDetailedMainStatus,
  getRecommendedAction
} from '../utils/dueDateUtils';
import { DueDateDetailsPanel } from './DueDateDetailsPanel';
import { 
  checkAuthorisationEligibility, 
  formatSingaporeTimestamp, 
  formatSingaporeDate,
  maskBankAccount,
  checkSupplierBankAccountChange,
  getCleanExceptionWording,
  checkSegregationOfDuties
} from '../utils/authorisationUtils';
import { formatInvoiceTotal } from '../utils/excelUtils';

interface ReviewModalProps {
  invoice: InvoiceRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateInvoice: (updatedInvoice: InvoiceRecord, auditAction: string, auditDetails: string) => void;
  initialSection?: 'OVERVIEW' | 'DEPT_APPROVAL' | 'BANK_VERIFICATION' | 'EXCEPTION_RESOLVE' | 'AUTHORISE' | 'MANUAL_PAYMENT';
  asOfDate?: string;
  allInvoices?: InvoiceRecord[];
  currentRole?: UserRole;
  currentUser?: string;
  onShowReceipt?: (invoice: InvoiceRecord) => void;
  onOpenAuthorisationModal?: (invoice: InvoiceRecord) => void;
}

const BANK_VERIFY_METHODS: BankVerificationMethod[] = [
  'Approved supplier master record',
  'Existing verified phone number',
  'Existing verified email address',
  'Authorised supplier representative',
  'Other independently verified source'
];

export const ReviewModal: React.FC<ReviewModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onUpdateInvoice,
  initialSection = 'OVERVIEW',
  asOfDate = new Date().toISOString().split('T')[0],
  allInvoices = [],
  currentRole = 'AP Lead – Madam Lim',
  currentUser = 'Madam Lim',
  onShowReceipt,
  onOpenAuthorisationModal
}) => {
  if (!isOpen || !invoice) return null;

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'DEPT_APPROVAL' | 'BANK_VERIFICATION' | 'EXCEPTION_RESOLVE' | 'AUTHORISE' | 'MANUAL_PAYMENT'>(initialSection);

  // Step 1: Department approval local form state
  const [deptStatus, setDeptStatus] = useState<DepartmentApprovalStatus>(invoice.departmentApprovalStatus);
  const [deptBy, setDeptBy] = useState(invoice.departmentApprovedBy || (currentRole === 'Department Approver' ? 'John Tan' : 'Madam Lim'));
  const [approversDepartment, setApproversDepartment] = useState(invoice.approversDepartment || 'Purchasing & Facilities');
  const [deptDate, setDeptDate] = useState(invoice.departmentApprovalDate || formatSingaporeDate());
  const [deptComment, setDeptComment] = useState(invoice.departmentApprovalComment || '');
  const [supportingEvidenceRef, setSupportingEvidenceRef] = useState(invoice.supportingEvidenceReference || '');
  const [isDeptApprovalLocked, setIsDeptApprovalLocked] = useState<boolean>(
    Boolean(invoice.isDeptApprovalLocked || invoice.departmentApprovalStatus === 'Approved')
  );
  const [showDeptAmendModal, setShowDeptAmendModal] = useState(false);
  const [deptAmendReason, setDeptAmendReason] = useState('');
  const [deptError, setDeptError] = useState('');

  // Step 2: Bank verification local form state
  const [bankStatus, setBankStatus] = useState<BankVerificationStatus>(invoice.bankVerificationStatus);
  const [bankBy, setBankBy] = useState(invoice.bankVerifiedBy || 'Madam Lim');
  const [bankDate, setBankDate] = useState(invoice.bankVerificationDate || formatSingaporeDate());
  const [bankMethod, setBankMethod] = useState<BankVerificationMethod>((invoice.bankVerificationMethod as BankVerificationMethod) || 'Approved supplier master record');
  const [bankComment, setBankComment] = useState(invoice.bankVerificationComment || '');
  const [bankTrustedContact, setBankTrustedContact] = useState(invoice.bankAccountVerificationTrustedContact || false);
  const [bankSourceConfirmed, setBankSourceConfirmed] = useState(invoice.bankAccountVerificationSourceConfirmed || false);
  const [bankError, setBankError] = useState('');

  // Exception resolution local form state
  const [excStatus, setExcStatus] = useState<ExceptionStatus>(invoice.exceptionStatus);
  const [excBy, setExcBy] = useState(invoice.exceptionResolvedBy || 'Madam Lim');
  const [excDate, setExcDate] = useState(invoice.exceptionResolutionDate || formatSingaporeDate());
  const [excExplanation, setExcExplanation] = useState(invoice.exceptionResolutionExplanation || '');
  const [excRef, setExcRef] = useState(invoice.exceptionSupportingReference || '');
  const [excError, setExcError] = useState('');

  // Step 3: Authorise for payment local form state & 6-digit PIN Control
  const [authBy, setAuthBy] = useState(invoice.authorisedBy || 'Madam Lim');
  const [authDate, setAuthDate] = useState(invoice.authorisationDate || formatSingaporeTimestamp());
  const [authComment, setAuthComment] = useState(invoice.authorisationComment || 'All matching results, department approvals, and bank accounts verified per protocol.');
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);
  const [typedInvoiceNumber, setTypedInvoiceNumber] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(invoice.failedPinAttempts || 0);
  const [pinLockoutUntil, setPinLockoutUntil] = useState<number | null>(invoice.pinLockoutUntilTimestamp || null);
  const [lockoutTimerSec, setLockoutTimerSec] = useState(0);
  const [authError, setAuthError] = useState('');
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  // Step 4: Record manual payment local form state
  const [payDate, setPayDate] = useState(invoice.paymentDate || formatSingaporeDate());
  const [actualPayMethod, setActualPayMethod] = useState(invoice.actualPaymentMethod || invoice.acceptedPaymentMethod || 'Bank Transfer');
  const [payRef, setPayRef] = useState(invoice.paymentReference || '');
  const [payComment, setPayComment] = useState(invoice.paymentComment || '');
  const [payError, setPayError] = useState('');

  // Segregation of Duties Justification State (for Moderate risk overrides)
  const [sodJustification, setSodJustification] = useState('');
  const [sodAcknowledged, setSodAcknowledged] = useState(false);

  // Bank Account Change Detection
  const bankChangeInfo = checkSupplierBankAccountChange(invoice, allInvoices);

  // Lockout Timer Countdown Effect
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

  useEffect(() => {
    if (invoice) {
      setDeptStatus(invoice.departmentApprovalStatus);
      setDeptBy(invoice.departmentApprovedBy || (currentRole === 'Department Approver' ? 'John Tan' : 'Madam Lim'));
      setApproversDepartment(invoice.approversDepartment || 'Purchasing & Facilities');
      setDeptDate(invoice.departmentApprovalDate || formatSingaporeDate());
      setDeptComment(invoice.departmentApprovalComment || '');
      setSupportingEvidenceRef(invoice.supportingEvidenceReference || '');
      setIsDeptApprovalLocked(Boolean(invoice.isDeptApprovalLocked || invoice.departmentApprovalStatus === 'Approved'));
      setShowDeptAmendModal(false);
      setDeptAmendReason('');

      setBankStatus(invoice.bankVerificationStatus);
      setBankBy(invoice.bankVerifiedBy || 'Madam Lim');
      setBankDate(invoice.bankVerificationDate || formatSingaporeDate());
      setBankMethod((invoice.bankVerificationMethod as BankVerificationMethod) || 'Approved supplier master record');
      setBankComment(invoice.bankVerificationComment || '');
      setBankTrustedContact(invoice.bankAccountVerificationTrustedContact || false);
      setBankSourceConfirmed(invoice.bankAccountVerificationSourceConfirmed || false);

      setExcStatus(invoice.exceptionStatus);
      setExcBy(invoice.exceptionResolvedBy || 'Madam Lim');
      setExcDate(invoice.exceptionResolutionDate || formatSingaporeDate());
      setExcExplanation(invoice.exceptionResolutionExplanation || '');
      setExcRef(invoice.exceptionSupportingReference || '');

      setAuthBy(invoice.authorisedBy || 'Madam Lim');
      setAuthDate(invoice.authorisationDate || formatSingaporeTimestamp());
      setAuthComment(invoice.authorisationComment || 'All matching results, department approvals, and bank accounts verified per protocol.');
      setConfirmCheckbox(false);
      setTypedInvoiceNumber('');
      setPin('');
      setShowPin(false);
      setFailedAttempts(invoice.failedPinAttempts || 0);
      setPinLockoutUntil(invoice.pinLockoutUntilTimestamp || null);
      setAuthError('');
      setIsConfirmationOpen(false);

      setPayDate(invoice.paymentDate || formatSingaporeDate());
      setActualPayMethod(invoice.actualPaymentMethod || invoice.acceptedPaymentMethod || 'Bank Transfer');
      setPayRef(invoice.paymentReference || '');
      setPayComment(invoice.paymentComment || '');
      setPayRef(invoice.paymentReference || '');
      setPayComment(invoice.paymentComment || '');

      setSodJustification('');
      setSodAcknowledged(false);

      setActiveTab(initialSection);
    }
  }, [invoice, initialSection, currentRole]);

  const isMatched = invoice.overallMatchStatus.toLowerCase().startsWith('match') || invoice.overallMatchStatus.toLowerCase().includes('pass') || invoice.overallMatchStatus.toLowerCase().includes('resolved');
  const isException = invoice.exceptionStatus === 'Unresolved' || invoice.paymentStatus === 'On Hold' || invoice.authorisationStatus === 'Blocked';
  const isPaid = invoice.paymentStatus === 'Paid';
  const isAuthorised = invoice.paymentStatus === 'Authorised – Ready for Manual Payment' || invoice.authorisationStatus === 'Authorised';

  // Compute single, reliable canAuthorise boolean directly from latest invoice state
  const authCheck = checkAuthorisationEligibility(invoice);
  const {
    canAuthorise,
    reasons: blockingReasons,
    matchPassed,
    noUnresolvedException,
    deptApproved,
    bankVerified,
    paymentMethodPresent,
    poNumberPresent,
    grnNumberPresent,
    invoiceTotalValid,
    paymentStatusValid,
    notAlreadyAuthorised
  } = authCheck;

  // Handler: Save Department Approval
  const handleSaveDeptApproval = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check SoD
    const sod = checkSegregationOfDuties('APPROVE_DEPT', invoice, currentRole as UserRole, currentUser);
    if (sod.blockAction) {
      setDeptError(`Incompatible Duty Blocked: Role "${currentRole}" is not permitted to record Department Approval.`);
      return;
    }
    if (sod.riskLevel === 'MODERATE' && (!sodAcknowledged || !sodJustification.trim())) {
      setDeptError('Segregation-of-Duties Warning: Written justification and conflict acknowledgement are required to proceed.');
      return;
    }

    if (deptStatus === 'Approved') {
      if (!deptBy.trim()) {
        setDeptError('Department Approved By is required.');
        return;
      }
      if (!approversDepartment.trim()) {
        setDeptError("Approver's Department is required.");
        return;
      }
      if (!deptDate.trim()) {
        setDeptError('Department Approval Date is required.');
        return;
      }
      if (!deptComment.trim()) {
        setDeptError('Approval Comment or Reference is required when Approved is selected.');
        return;
      }
    }
    setDeptError('');

    const updated: InvoiceRecord = {
      ...invoice,
      departmentApprovalStatus: deptStatus,
      departmentApprovedBy: deptBy,
      approversDepartment: approversDepartment,
      departmentApprovalDate: deptDate,
      departmentApprovalComment: deptComment + (sodJustification ? ` [SoD Justification: ${sodJustification}]` : ''),
      supportingEvidenceReference: supportingEvidenceRef,
      isDeptApprovalLocked: true,
      originalDeptApprovalRecord: invoice.originalDeptApprovalRecord || {
        status: deptStatus,
        approvedBy: deptBy,
        department: approversDepartment,
        approvalDate: deptDate,
        comment: deptComment,
        evidenceRef: supportingEvidenceRef
      },
      lastUpdatedDate: formatSingaporeTimestamp()
    };

    onUpdateInvoice(
      updated,
      'Department Approval Evidence Recorded',
      `Recorded department approval evidence for invoice ${invoice.invoiceNumber}: Status=${deptStatus}, ApprovedBy=${deptBy}, Department=${approversDepartment}. Record locked.`
    );
    setIsDeptApprovalLocked(true);
  };

  // Handler: Amend Department Approval
  const handleAmendDeptApproval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptAmendReason.trim()) {
      setDeptError('Reason for amendment is required.');
      return;
    }

    const history = invoice.departmentApprovalHistory || [];
    const updatedHistory = [
      ...history,
      {
        status: invoice.departmentApprovalStatus,
        approvedBy: invoice.departmentApprovedBy,
        department: invoice.approversDepartment || 'Purchasing',
        approvalDate: invoice.departmentApprovalDate,
        comment: invoice.departmentApprovalComment || '',
        evidenceRef: invoice.supportingEvidenceReference,
        amendedBy: currentUser || 'Madam Lim',
        amendedDate: formatSingaporeTimestamp(),
        reason: deptAmendReason
      }
    ];

    const updated: InvoiceRecord = {
      ...invoice,
      departmentApprovalStatus: deptStatus,
      departmentApprovedBy: deptBy,
      approversDepartment: approversDepartment,
      departmentApprovalDate: deptDate,
      departmentApprovalComment: deptComment,
      supportingEvidenceReference: supportingEvidenceRef,
      isDeptApprovalLocked: true,
      departmentApprovalHistory: updatedHistory,
      lastUpdatedDate: formatSingaporeTimestamp()
    };

    onUpdateInvoice(
      updated,
      'Department Approval Amended',
      `Amended department approval record for invoice ${invoice.invoiceNumber}. Reason: "${deptAmendReason}". Previous Status: ${invoice.departmentApprovalStatus}, New Status: ${deptStatus}.`
    );

    setShowDeptAmendModal(false);
    setDeptAmendReason('');
  };

  // Handler: Save Bank Verification
  const handleSaveBankVerification = (e: React.FormEvent) => {
    e.preventDefault();

    // Check SoD
    const sod = checkSegregationOfDuties('VERIFY_BANK', invoice, currentRole as UserRole, currentUser);
    if (sod.blockAction) {
      setBankError(`Incompatible Duty Blocked: Role "${currentRole}" is not permitted to perform Bank Verification.`);
      return;
    }

    if (bankStatus === 'Verified') {
      if (!bankBy.trim() || !bankDate.trim() || !bankMethod) {
        setBankError('Verified By, Verification Date, and Verification Method are required.');
        return;
      }
      if ((bankChangeInfo.hasChanged || invoice.bankAccountChanged) && (!bankTrustedContact || !bankSourceConfirmed)) {
        setBankError('SECURITY ALERT: Independent verification using an existing trusted contact and non-invoice source confirmation are strictly required when bank details have changed.');
        return;
      }
    }
    setBankError('');

    const updated: InvoiceRecord = {
      ...invoice,
      bankVerificationStatus: bankStatus,
      bankVerifiedBy: bankBy,
      bankVerificationDate: bankDate,
      bankVerificationMethod: bankMethod,
      bankAccountVerificationTrustedContact: bankTrustedContact,
      bankAccountVerificationSourceConfirmed: bankSourceConfirmed,
      bankVerificationComment: bankComment + (sodJustification ? ` [SoD Justification: ${sodJustification}]` : ''),
      lastUpdatedDate: formatSingaporeTimestamp()
    };

    onUpdateInvoice(
      updated,
      'Bank Details Verified',
      `Status: ${bankStatus} using method "${bankMethod}" by ${bankBy}. Bank Account: ${maskBankAccount(invoice.bankAccountNumber)}. Changed: ${bankChangeInfo.hasChanged ? 'YES' : 'NO'}`
    );
    setActiveTab('OVERVIEW');
  };

  // Handler: Save Exception Resolution
  const handleSaveExceptionResolution = (e: React.FormEvent) => {
    e.preventDefault();

    // Check SoD
    const sod = checkSegregationOfDuties('RESOLVE_EXCEPTION', invoice, currentRole as UserRole, currentUser);
    if (sod.blockAction) {
      setExcError(`Incompatible Duty Blocked: Role "${currentRole}" is not permitted to resolve exceptions.`);
      return;
    }

    if (excStatus === 'Resolved' && (!excBy.trim() || !excExplanation.trim())) {
      setExcError('Resolved By and Resolution Explanation are required to resolve an exception.');
      return;
    }
    setExcError('');

    const updated: InvoiceRecord = {
      ...invoice,
      exceptionStatus: excStatus,
      exceptionResolvedBy: excBy,
      exceptionResolutionDate: excDate,
      exceptionResolutionExplanation: excExplanation,
      exceptionSupportingReference: excRef,
      paymentStatus: excStatus === 'Resolved' && invoice.paymentStatus === 'On Hold' ? 'Pending' : invoice.paymentStatus,
      authorisationStatus: excStatus === 'Resolved' && invoice.authorisationStatus === 'Blocked' ? 'Pending' : invoice.authorisationStatus,
      lastUpdatedDate: formatSingaporeTimestamp()
    };

    onUpdateInvoice(
      updated,
      'Exception Resolution Recorded',
      `Status changed to ${excStatus} by ${excBy}. Reason: ${excExplanation}. Ref: ${excRef || 'None'}`
    );
    setActiveTab('OVERVIEW');
  };

  // Handler: Final Authorisation Commit after Confirmation Modal
  const handleFinalAuthorisationCommit = () => {
    try {
      if (!invoice) return;
      const timestamp = formatSingaporeTimestamp();
      const invNum = invoice.invoiceNumber || 'UNKNOWN';
      const receiptId = `ACR-2026-${invNum.replace(/[^a-zA-Z0-9]/g, '')}`;

      const updated: InvoiceRecord = {
        ...invoice,
        authorisationStatus: 'Authorised',
        paymentStatus: 'Authorised – Ready for Manual Payment',
        authorisedBy: authBy,
        authorisationDate: authDate || timestamp,
        authorisationComment: authComment,
        receiptId: receiptId,
        lastUpdatedDate: timestamp
      };

      onUpdateInvoice(
        updated,
        'Invoice Authorised',
        `Madam Lim authorised invoice ${invNum} (${formatInvoiceTotal(invoice.invoiceTotal || invoice.invoiceAmount, invoice.currency)}) for manual payment. Receipt ID: ${receiptId}. Comment: ${authComment}`
      );

      setIsConfirmationOpen(false);
      if (onShowReceipt) {
        onShowReceipt(updated);
      }
    } catch (err: any) {
      setAuthError('Authorisation could not be opened. No changes were made. Please try again.');
      setIsConfirmationOpen(false);
    }
  };

  // Handler: Record Manual Payment
  const handleRecordManualPayment = (e: React.FormEvent) => {
    e.preventDefault();

    if (isPaid) {
      setPayError('Duplicate Action Blocked – This invoice has already been recorded as paid.');
      return;
    }

    // Check SoD
    const sod = checkSegregationOfDuties('RECORD_PAYMENT', invoice, currentRole as UserRole, currentUser);
    if (sod.blockAction) {
      setPayError(`Incompatible Duty Blocked: Role "${currentRole}" is not permitted to record manual payments.`);
      return;
    }

    if (!payRef.trim()) {
      setPayError('Payment Reference (e.g. Bank Transfer TRF number or Cheque number) cannot be blank.');
      return;
    }
    if (!payDate.trim()) {
      setPayError('Payment Date is required.');
      return;
    }

    // Check Duplicate Payment Reference across all invoices
    const duplicateRefInvoice = allInvoices.find(inv => 
      inv.id !== invoice.id && 
      inv.paymentReference && 
      inv.paymentReference.trim().toLowerCase() === payRef.trim().toLowerCase()
    );

    if (duplicateRefInvoice && !payComment.trim()) {
      setPayError(`Duplicate Payment Reference Warning: Reference "${payRef}" was already recorded on invoice ${duplicateRefInvoice.invoiceNumber}. Please provide a comment explaining why this reference is reused.`);
      return;
    }

    setPayError('');

    const timestamp = formatSingaporeTimestamp();
    const updated: InvoiceRecord = {
      ...invoice,
      paymentStatus: 'Paid',
      paymentDate: payDate,
      paymentReference: payRef,
      paymentComment: payComment + (duplicateRefInvoice ? ` [Duplicate Reference Warning: Reused from invoice ${duplicateRefInvoice.invoiceNumber}]` : ''),
      lastUpdatedDate: timestamp
    };

    onUpdateInvoice(
      updated,
      'Manual Payment Recorded',
      `Payment reference "${payRef}" recorded on ${payDate} by ${currentUser} (Role: ${currentRole}). Comment: ${payComment || 'None'}`
    );
    onClose();
  };

  // Compute SoD status for current tab
  const getSoDForTab = () => {
    switch (activeTab) {
      case 'DEPT_APPROVAL': return checkSegregationOfDuties('APPROVE_DEPT', invoice, currentRole as UserRole, currentUser);
      case 'BANK_VERIFICATION': return checkSegregationOfDuties('VERIFY_BANK', invoice, currentRole as UserRole, currentUser);
      case 'EXCEPTION_RESOLVE': return checkSegregationOfDuties('RESOLVE_EXCEPTION', invoice, currentRole as UserRole, currentUser);
      case 'AUTHORISE': return checkSegregationOfDuties('AUTHORISE', invoice, currentRole as UserRole, currentUser);
      case 'MANUAL_PAYMENT': return checkSegregationOfDuties('RECORD_PAYMENT', invoice, currentRole as UserRole, currentUser);
      default: return { isAllowed: true, riskLevel: 'NONE' as const, warningMessage: '', blockAction: false, requiresReason: false };
    }
  };

  const currentSoD = getSoDForTab();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-6 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-extrabold text-white">Review Panel: Authorisation Control</h3>
                <span className="font-mono px-2 py-0.5 bg-slate-800 text-indigo-300 rounded border border-slate-700 text-xs font-bold">
                  {invoice.invoiceNumber}
                </span>
                {invoice.invoiceNumber === 'CHT-2026-204' && (
                  <span className="px-2 py-0.5 bg-indigo-500 text-white rounded text-[10px] font-extrabold uppercase">
                    Requirement 27 Test Case
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Supplier: <strong className="text-white">{invoice.supplierName}</strong> • Due: <strong className="text-white">{invoice.dueDate}</strong>
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <span className="text-xs bg-slate-800 border border-slate-700 text-indigo-300 font-mono px-2.5 py-1 rounded">
              Role: <strong>{currentRole}</strong>
            </span>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Segregation of Duties Warning Banner (if present) */}
        {currentSoD.blockAction && activeTab !== 'OVERVIEW' && (
          <div className="bg-rose-950/90 border-b border-rose-800 px-6 py-2.5 text-xs text-rose-200 flex items-center space-x-2 shrink-0">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>INCOMPATIBLE DUTY BLOCKED:</strong> Role <strong className="underline">{currentRole}</strong> is not permitted to perform this action. Switch role in top header to simulate another user.
            </span>
          </div>
        )}

        {/* Navigation / Section Tabs */}
        <div className="bg-slate-950/60 border-b border-slate-800 px-6 pt-2 overflow-x-auto shrink-0">
          <div className="flex space-x-2 min-w-max">
            <button
              onClick={() => setActiveTab('OVERVIEW')}
              className={`py-2.5 px-4 text-xs font-bold rounded-t-lg border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'OVERVIEW'
                  ? 'border-indigo-500 text-white bg-slate-800'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>13-Field Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('DEPT_APPROVAL')}
              className={`py-2.5 px-4 text-xs font-bold rounded-t-lg border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'DEPT_APPROVAL'
                  ? 'border-amber-500 text-white bg-slate-800'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Clock className={`w-3.5 h-3.5 ${invoice.departmentApprovalStatus === 'Approved' ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span>Step 1: Dept Approval</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${invoice.departmentApprovalStatus === 'Approved' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300'}`}>
                {invoice.departmentApprovalStatus}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('BANK_VERIFICATION')}
              className={`py-2.5 px-4 text-xs font-bold rounded-t-lg border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'BANK_VERIFICATION'
                  ? 'border-indigo-500 text-white bg-slate-800'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <ShieldAlert className={`w-3.5 h-3.5 ${invoice.bankVerificationStatus === 'Verified' ? 'text-emerald-400' : 'text-rose-400'}`} />
              <span>Step 2: Bank Verify</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${invoice.bankVerificationStatus === 'Verified' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300'}`}>
                {invoice.bankVerificationStatus}
              </span>
            </button>

            {(isException || invoice.exceptionSummary !== 'None') && (
              <button
                onClick={() => setActiveTab('EXCEPTION_RESOLVE')}
                className={`py-2.5 px-4 text-xs font-bold rounded-t-lg border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'EXCEPTION_RESOLVE'
                    ? 'border-orange-500 text-white bg-slate-800'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <AlertTriangle className={`w-3.5 h-3.5 ${invoice.exceptionStatus === 'Resolved' ? 'text-emerald-400' : 'text-orange-400'}`} />
                <span>On-Hold Exception</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${invoice.exceptionStatus === 'Resolved' ? 'bg-emerald-950 text-emerald-300' : 'bg-orange-950 text-orange-300'}`}>
                  {invoice.exceptionStatus}
                </span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('AUTHORISE')}
              className={`py-2.5 px-4 text-xs font-bold rounded-t-lg border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'AUTHORISE'
                  ? 'border-emerald-500 text-white bg-slate-800'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <CheckSquare className={`w-3.5 h-3.5 ${invoice.authorisationStatus === 'Authorised' ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>Step 3: Authorise for Payment</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${invoice.authorisationStatus === 'Authorised' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-300'}`}>
                {invoice.authorisationStatus}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('MANUAL_PAYMENT')}
              className={`py-2.5 px-4 text-xs font-bold rounded-t-lg border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'MANUAL_PAYMENT'
                  ? 'border-teal-500 text-white bg-slate-800'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <DollarSign className={`w-3.5 h-3.5 ${isPaid ? 'text-teal-400' : 'text-slate-400'}`} />
              <span>Record Manual Payment</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${isPaid ? 'bg-teal-950 text-teal-300 border border-teal-800' : 'bg-slate-800 text-slate-400'}`}>
                {isPaid ? 'PAID' : 'Pending'}
              </span>
            </button>
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* TAB 1: 13-FIELD OVERVIEW */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-6 animate-fade-in">
              <DueDateDetailsPanel invoice={invoice} asOfDate={asOfDate} />
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-400 font-bold text-lg">
                    $
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-medium">Total Invoice Amount</div>
                    <div className="text-2xl font-extrabold text-white">
                      {formatInvoiceTotal(invoice.invoiceTotal || invoice.invoiceAmount, invoice.currency)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveTab('DEPT_APPROVAL')}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold border border-slate-700 transition-colors cursor-pointer flex items-center"
                  >
                    <span>1. Dept Approval</span>
                    <ArrowRight className="w-3 h-3 ml-1 text-slate-400" />
                  </button>
                  <button
                    onClick={() => setActiveTab('BANK_VERIFICATION')}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold border border-slate-700 transition-colors cursor-pointer flex items-center"
                  >
                    <span>2. Bank Verify</span>
                    <ArrowRight className="w-3 h-3 ml-1 text-slate-400" />
                  </button>
                  <button
                    onClick={() => setActiveTab('AUTHORISE')}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold shadow transition-colors cursor-pointer flex items-center"
                  >
                    <span>3. Authorise</span>
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </button>
                </div>
              </div>

              {/* Grid of 13 fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* 1-3. Supplier & Document Info */}
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
                    <Building2 className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                    1. Supplier & Document Info
                  </h5>
                  <div className="text-xs space-y-1.5 text-slate-300">
                    <div><span className="text-slate-500 font-medium">Supplier Name:</span> <strong className="text-white block">{invoice.supplierName}</strong></div>
                    <div><span className="text-slate-500 font-medium">Invoice Number:</span> <strong className="text-indigo-300 font-mono text-sm block">{invoice.invoiceNumber}</strong></div>
                    <div><span className="text-slate-500 font-medium">Supplier Address:</span> <span className="text-slate-300 text-[11px] block">{invoice.supplierAddress || 'Not stated'}</span></div>
                    <div><span className="text-slate-500 font-medium">Supplier Contact:</span> <span className="text-slate-300 text-[11px] block">{invoice.supplierContactDetails || 'Not stated'}</span></div>
                  </div>
                </div>

                {/* 4-7. Dates & Amounts */}
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                    2. Order & Dates
                  </h5>
                  <div className="text-xs space-y-1.5 text-slate-300 font-mono">
                    <div><span className="text-slate-500 font-sans font-medium">PO Number(s):</span> <strong className="text-white block">{invoice.poNumber || 'Not stated'}</strong></div>
                    <div><span className="text-slate-500 font-sans font-medium">GRN Number(s):</span> <strong className="text-white block">{invoice.grnNumber || 'Not stated'}</strong></div>
                    <div><span className="text-slate-500 font-sans font-medium">Invoice Date:</span> <span className="text-slate-300 block">{invoice.invoiceDate || 'Not stated'}</span></div>
                    <div><span className="text-slate-500 font-sans font-medium">Payment Due Date:</span> <strong className="text-amber-300 block">{invoice.dueDate}</strong></div>
                  </div>
                </div>

                {/* 8-10. Terms & Amount Details */}
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
                    <CreditCard className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                    3. Terms & Amounts
                  </h5>
                  <div className="text-xs space-y-1.5 text-slate-300">
                    <div><span className="text-slate-500 font-medium">Currency:</span> <strong className="text-white">{invoice.currency || 'SGD'}</strong></div>
                    <div><span className="text-slate-500 font-medium">Payment Terms:</span> <span className="text-slate-300">{invoice.paymentTerms || 'Not stated'}</span></div>
                    <div><span className="text-slate-500 font-medium">Accepted Method:</span> <strong className="text-indigo-300">{invoice.acceptedPaymentMethod || 'Not stated'}</strong></div>
                    <div><span className="text-slate-500 font-medium">Invoice Total:</span> <strong className="text-emerald-400 font-mono text-sm block">{formatInvoiceTotal(invoice.invoiceTotal || invoice.invoiceAmount, invoice.currency)}</strong></div>
                  </div>
                </div>

                {/* 11-13. Matching, Bank & Authorisation */}
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2 col-span-1 md:col-span-2 lg:col-span-3">
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                    4. Matching, Bank Details & Governance
                  </h5>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-1">
                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block">App 2 Match Status</span>
                      <strong className="text-emerald-400 font-bold text-sm">{invoice.overallMatchStatus}</strong>
                    </div>

                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block">Exception Status</span>
                      <strong className="text-indigo-300 font-bold text-sm">{getCleanExceptionWording(invoice)}</strong>
                    </div>

                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block">Department Approval</span>
                      <strong className="text-white font-bold text-sm">{invoice.departmentApprovalStatus}</strong>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">By: {invoice.departmentApprovedBy || 'Pending'}</div>
                    </div>

                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block">Bank Account (Masked)</span>
                      <strong className="text-slate-200 font-mono text-sm">{maskBankAccount(invoice.bankAccountNumber)}</strong>
                      <div className="text-[10px] text-slate-400 mt-0.5">Status: {invoice.bankVerificationStatus}</div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: STEP 1 — DEPARTMENT APPROVAL */}
          {activeTab === 'DEPT_APPROVAL' && (
            <form onSubmit={handleSaveDeptApproval} className="space-y-6 animate-fade-in max-w-3xl mx-auto">
              <div className="bg-amber-950/30 border border-amber-600/40 rounded-xl p-4 text-xs text-amber-200 space-y-1">
                <div className="font-bold flex items-center space-x-2 text-sm text-amber-300">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>STEP 1 — DEPARTMENT APPROVAL CONTROL</span>
                </div>
                <p className="text-slate-300">
                  Per AP protocol, document-matched invoices await department approval. Record sign-off from the requisitioning department head. 
                  <strong className="text-white ml-1">Madam Lim records approval evidence received from the department; she does not approve on behalf of the department.</strong>
                </p>
              </div>

              {isDeptApprovalLocked && (
                <div className="bg-emerald-950/90 border-2 border-emerald-500/80 p-4 rounded-xl text-xs text-emerald-100 flex items-center justify-between shadow-md">
                  <div className="flex items-center space-x-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <strong className="text-white text-sm block font-bold">Department Approval Record Locked</strong>
                      <span>Department approval evidence recorded and locked.</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDeptAmendModal(true)}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Amend Department Approval Record
                  </button>
                </div>
              )}

              {deptError && (
                <div className="bg-rose-950 border border-rose-500/50 p-3 rounded-lg text-xs text-rose-200 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{deptError}</span>
                </div>
              )}

              <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Department Approval Status
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['Approved', 'Rejected', 'Pending'] as DepartmentApprovalStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        disabled={isDeptApprovalLocked}
                        onClick={() => setDeptStatus(st)}
                        className={`py-3 px-4 rounded-xl border text-sm font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                          deptStatus === st
                            ? st === 'Approved'
                              ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg'
                              : st === 'Rejected'
                              ? 'bg-rose-600 border-rose-500 text-white shadow-lg'
                              : 'bg-amber-600 border-amber-500 text-white shadow-lg'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                      >
                        {st === 'Approved' && <CheckCircle2 className="w-4 h-4" />}
                        {st === 'Rejected' && <X className="w-4 h-4" />}
                        {st === 'Pending' && <Clock className="w-4 h-4" />}
                        <span>{st}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      Department Approved By <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      disabled={isDeptApprovalLocked}
                      value={deptBy}
                      onChange={(e) => setDeptBy(e.target.value)}
                      placeholder="e.g. John Tan"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      Approver's Department <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      disabled={isDeptApprovalLocked}
                      value={approversDepartment}
                      onChange={(e) => setApproversDepartment(e.target.value)}
                      placeholder="e.g. Purchasing & Facilities"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      Department Approval Date <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="date"
                      disabled={isDeptApprovalLocked}
                      value={deptDate}
                      onChange={(e) => setDeptDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      Supporting Evidence Reference
                    </label>
                    <input
                      type="text"
                      disabled={isDeptApprovalLocked}
                      value={supportingEvidenceRef}
                      onChange={(e) => setSupportingEvidenceRef(e.target.value)}
                      placeholder="e.g. Email Approval Ref #EMAIL-2026-0881"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    Department Approval Comment / Reference <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    disabled={isDeptApprovalLocked}
                    value={deptComment}
                    onChange={(e) => setDeptComment(e.target.value)}
                    placeholder="Enter approval details or sign-off memo..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('OVERVIEW')}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
                >
                  Back to Overview
                </button>
                {!isDeptApprovalLocked && (
                  <button
                    type="submit"
                    disabled={currentSoD.blockAction}
                    className={`px-6 py-2.5 rounded-lg text-sm font-bold shadow-lg transition-all flex items-center ${
                      currentSoD.blockAction ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Save Department Approval Record
                  </button>
                )}
              </div>
            </form>
          )}

          {/* TAB 3: STEP 2 — BANK VERIFICATION */}
          {activeTab === 'BANK_VERIFICATION' && (
            <form onSubmit={handleSaveBankVerification} className="space-y-6 animate-fade-in max-w-3xl mx-auto">
              <div className="bg-indigo-950/40 border border-indigo-500/40 rounded-xl p-4 text-xs text-indigo-200 space-y-1">
                <div className="font-bold flex items-center space-x-2 text-sm text-indigo-300">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <span>STEP 2 — INDEPENDENT BANK VERIFICATION CONTROL</span>
                </div>
                <p className="text-slate-300">
                  To prevent CEO/supplier impersonation fraud, Madam Lim must independently verify the supplier bank account.
                  <strong className="text-rose-300 ml-1">Do not allow “Invoice itself” as the only verification method.</strong>
                </p>
              </div>

              {/* Security Alert Banner for Bank Account Changes */}
              {(bankChangeInfo.hasChanged || invoice.bankAccountChanged) && (
                <div className="p-4 bg-rose-950/90 border-2 border-rose-500 rounded-xl space-y-2 text-xs text-rose-100 shadow-xl animate-pulse">
                  <div className="flex items-center space-x-2 font-extrabold text-sm text-white">
                    <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                    <span>SECURITY ALERT – SUPPLIER BANK DETAILS CHANGED</span>
                  </div>
                  <p className="leading-relaxed font-semibold">
                    The bank account ({invoice.bankAccountNumber}) differs from another imported invoice for the same supplier (previous account: {bankChangeInfo.previousAccount || 'different account'}). Independent verification using an existing trusted contact is required.
                  </p>
                </div>
              )}

              {bankError && (
                <div className="bg-rose-950 border border-rose-500/50 p-3 rounded-lg text-xs text-rose-200 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{bankError}</span>
                </div>
              )}

              <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 space-y-4">
                
                {/* Account info preview */}
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row justify-between text-xs gap-2">
                  <div>
                    <span className="text-slate-500">Supplier:</span> <strong className="text-white">{invoice.supplierName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Bank Details:</span> <strong className="text-white">{invoice.bankDetails}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Account No (Masked):</span> <strong className="text-emerald-400 font-mono">{maskBankAccount(invoice.bankAccountNumber)}</strong>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Bank Verification Status
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['Verified', 'Rejected', 'Not Verified'] as BankVerificationStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setBankStatus(st)}
                        className={`py-3 px-4 rounded-xl border text-sm font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                          bankStatus === st
                            ? st === 'Verified'
                              ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg'
                              : st === 'Rejected'
                              ? 'bg-rose-600 border-rose-500 text-white shadow-lg'
                              : 'bg-slate-700 border-slate-600 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        {st === 'Verified' && <ShieldCheck className="w-4 h-4" />}
                        {st === 'Rejected' && <X className="w-4 h-4" />}
                        <span>{st}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      Verified By <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={bankBy}
                      onChange={(e) => setBankBy(e.target.value)}
                      placeholder="e.g. Madam Lim (AP Lead)"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      Verification Date <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={bankDate}
                      onChange={(e) => setBankDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    Independent Verification Method <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={bankMethod}
                    onChange={(e) => setBankMethod(e.target.value as BankVerificationMethod)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium cursor-pointer"
                  >
                    {BANK_VERIFY_METHODS.map((m) => (
                      <option key={m} value={m} className="bg-slate-900 text-white py-1">
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Additional Checkboxes for Changed Bank Account Security Verification */}
                {(bankChangeInfo.hasChanged || invoice.bankAccountChanged) && (
                  <div className="p-4 bg-slate-900 rounded-xl border border-amber-800/60 space-y-3 text-xs">
                    <h5 className="font-bold text-amber-300 uppercase tracking-wider text-[11px] flex items-center">
                      <Lock className="w-3.5 h-3.5 mr-1 text-amber-400" />
                      Required Independent Verification Confirmations
                    </h5>
                    
                    <label className="flex items-start space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bankTrustedContact}
                        onChange={(e) => setBankTrustedContact(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-indigo-600 rounded"
                      />
                      <span className="text-slate-200 font-medium">
                        Contacted supplier using existing trusted contact/phone number (NOT number printed on new invoice).
                      </span>
                    </label>

                    <label className="flex items-start space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bankSourceConfirmed}
                        onChange={(e) => setBankSourceConfirmed(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-indigo-600 rounded"
                      />
                      <span className="text-slate-200 font-medium">
                        I confirm that the invoice itself was NOT the only verification source.
                      </span>
                    </label>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    Verification Comment / Audit Note
                  </label>
                  <textarea
                    rows={2}
                    value={bankComment}
                    onChange={(e) => setBankComment(e.target.value)}
                    placeholder="e.g. Confirmed bank account via supplier master database ID #4829..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('OVERVIEW')}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
                >
                  Back to Overview
                </button>
                <button
                  type="submit"
                  disabled={currentSoD.blockAction}
                  className={`px-6 py-2.5 rounded-lg text-sm font-bold shadow-lg transition-all flex items-center ${
                    currentSoD.blockAction ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Save Bank Verification Record
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: EXCEPTION RESOLUTION (For On Hold Invoices) */}
          {activeTab === 'EXCEPTION_RESOLVE' && (
            <form onSubmit={handleSaveExceptionResolution} className="space-y-6 animate-fade-in max-w-3xl mx-auto">
              <div className="bg-orange-950/40 border border-orange-500/40 rounded-xl p-4 text-xs text-orange-200 space-y-1">
                <div className="font-bold flex items-center space-x-2 text-sm text-orange-300">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  <span>ON-HOLD / EXCEPTION RESOLUTION WORKFLOW</span>
                </div>
                <p className="text-slate-300">
                  This invoice is blocked due to an App 2 matching exception or hold. You cannot bypass an App 2 hold without recording a formal resolution. 
                  <strong className="text-white ml-1">Both original exception and resolution record will be retained.</strong>
                </p>
              </div>

              {excError && (
                <div className="bg-rose-950 border border-rose-500/50 p-3 rounded-lg text-xs text-rose-200 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{excError}</span>
                </div>
              )}

              {/* Original Exception Display */}
              <div className="bg-slate-950 p-4 rounded-xl border border-orange-900/60 space-y-2">
                <div className="text-xs font-bold uppercase text-orange-400 flex items-center">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                  Original App 2 Blocking Exception
                </div>
                <div className="text-sm font-semibold text-white bg-slate-900 p-3 rounded border border-slate-800">
                  {invoice.exceptionSummary || invoice.overallMatchStatus}
                </div>
              </div>

              <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Resolution Status
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['Resolved', 'Unresolved', 'Rejected'] as ExceptionStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setExcStatus(st)}
                        className={`py-3 px-4 rounded-xl border text-sm font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                          excStatus === st
                            ? st === 'Resolved'
                              ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg'
                              : st === 'Rejected'
                              ? 'bg-rose-600 border-rose-500 text-white shadow-lg'
                              : 'bg-orange-600 border-orange-500 text-white shadow-lg'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        {st === 'Resolved' && <CheckCircle2 className="w-4 h-4" />}
                        {st === 'Rejected' && <X className="w-4 h-4" />}
                        <span>{st}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      Resolved By <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={excBy}
                      onChange={(e) => setExcBy(e.target.value)}
                      placeholder="e.g. Madam Lim (AP Lead)"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      Resolution Date <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={excDate}
                      onChange={(e) => setExcDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    Resolution Explanation <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={excExplanation}
                    onChange={(e) => setExcExplanation(e.target.value)}
                    placeholder="Explain why the exception is cleared (e.g., Received Credit Note CN-881 for damaged units, price difference approved by Director)..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    Supporting Reference (Optional)
                  </label>
                  <input
                    type="text"
                    value={excRef}
                    onChange={(e) => setExcRef(e.target.value)}
                    placeholder="e.g. Credit Note CN-881, Email confirmation from Supplier dated 18 July"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('OVERVIEW')}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
                >
                  Back to Overview
                </button>
                <button
                  type="submit"
                  disabled={currentSoD.blockAction}
                  className={`px-6 py-2.5 rounded-lg text-sm font-bold shadow-lg transition-all flex items-center ${
                    currentSoD.blockAction ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : 'bg-orange-600 hover:bg-orange-500 text-white cursor-pointer'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Record Exception Resolution
                </button>
              </div>
            </form>
          )}

          {/* TAB 5: STEP 3 — AUTHORISE FOR PAYMENT */}
          {activeTab === 'AUTHORISE' && (
            <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
              
              {/* Gatekeeper Checklist Box */}
              <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 space-y-4">
                <h4 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center">
                  <CheckSquare className="w-4 h-4 mr-2 text-indigo-400" />
                  Step 3: Gatekeeper Authorisation Prerequisites
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  
                  <div className={`p-3 rounded-lg border flex items-center space-x-2 ${matchPassed ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300' : 'bg-rose-950/50 border-rose-800 text-rose-300'}`}>
                    {matchPassed ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <X className="w-4 h-4 text-rose-400 shrink-0" />}
                    <div>
                      <div className="font-bold">App 2 Match Status</div>
                      <div className="text-[11px] opacity-80">{invoice.overallMatchStatus}</div>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg border flex items-center space-x-2 ${noUnresolvedException ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300' : 'bg-rose-950/50 border-rose-800 text-rose-300'}`}>
                    {noUnresolvedException ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <X className="w-4 h-4 text-rose-400 shrink-0" />}
                    <div>
                      <div className="font-bold">No Unresolved Exceptions</div>
                      <div className="text-[11px] opacity-80">{invoice.exceptionStatus === 'Resolved' ? 'Resolved by user' : (invoice.exceptionSummary || 'None')}</div>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg border flex items-center space-x-2 ${deptApproved ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300' : 'bg-amber-950/50 border-amber-800 text-amber-300'}`}>
                    {deptApproved ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <Clock className="w-4 h-4 text-amber-400 shrink-0" />}
                    <div>
                      <div className="font-bold">Department Approval</div>
                      <div className="text-[11px] opacity-80">Status: {invoice.departmentApprovalStatus}</div>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg border flex items-center space-x-2 ${bankVerified ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300' : 'bg-rose-950/50 border-rose-800 text-rose-300'}`}>
                    {bankVerified ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
                    <div>
                      <div className="font-bold">Bank Verification</div>
                      <div className="text-[11px] opacity-80">Status: {invoice.bankVerificationStatus}</div>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg border flex items-center space-x-2 ${paymentMethodPresent ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300' : 'bg-rose-950/50 border-rose-800 text-rose-300'}`}>
                    {paymentMethodPresent ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <X className="w-4 h-4 text-rose-400 shrink-0" />}
                    <div>
                      <div className="font-bold">Accepted Payment Method</div>
                      <div className="text-[11px] opacity-80">{invoice.acceptedPaymentMethod || 'Missing'}</div>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg border flex items-center space-x-2 ${poNumberPresent ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300' : 'bg-rose-950/50 border-rose-800 text-rose-300'}`}>
                    {poNumberPresent ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <X className="w-4 h-4 text-rose-400 shrink-0" />}
                    <div>
                      <div className="font-bold">PO Number</div>
                      <div className="text-[11px] opacity-80 font-mono">{invoice.poNumber || 'Missing'}</div>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg border flex items-center space-x-2 ${grnNumberPresent ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300' : 'bg-rose-950/50 border-rose-800 text-rose-300'}`}>
                    {grnNumberPresent ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <X className="w-4 h-4 text-rose-400 shrink-0" />}
                    <div>
                      <div className="font-bold">GRN Number</div>
                      <div className="text-[11px] opacity-80 font-mono">{invoice.grnNumber || 'Missing'}</div>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg border flex items-center space-x-2 ${invoiceTotalValid ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300' : 'bg-rose-950/50 border-rose-800 text-rose-300'}`}>
                    {invoiceTotalValid ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <X className="w-4 h-4 text-rose-400 shrink-0" />}
                    <div>
                      <div className="font-bold">Invoice Total</div>
                      <div className="text-[11px] opacity-80 font-bold">{formatInvoiceTotal(invoice.invoiceTotal || invoice.invoiceAmount, invoice.currency)}</div>
                    </div>
                  </div>

                </div>

                {canAuthorise ? (
                  <div className="bg-emerald-950/80 border-2 border-emerald-500/80 p-4 rounded-xl text-xs text-emerald-200 flex items-start space-x-3 shadow-md">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white text-sm block font-bold mb-0.5">Prerequisite Controls Completed</strong>
                      <p className="text-emerald-100 font-semibold leading-relaxed">
                        Prerequisite controls completed. This invoice is ready for Madam Lim’s final authorisation.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-rose-950/80 border border-rose-600/60 p-4 rounded-xl text-xs text-rose-200 space-y-2">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                      <strong className="text-white text-sm font-bold">Authorisation Blocked: Prerequisite Controls Not Met</strong>
                    </div>
                    <ul className="space-y-1 text-xs text-rose-200 pl-7 list-disc">
                      {blockingReasons.map((reason, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {invoice.authorisationStatus === 'Authorised' && (
                <div className="bg-emerald-950/90 border-2 border-emerald-500 p-4 rounded-xl text-xs text-emerald-100 flex items-center justify-between shadow-lg">
                  <div className="flex items-center space-x-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                    <div>
                      <strong className="text-white text-sm block font-extrabold mb-0.5">Invoice Authorised</strong>
                      <span>Invoice successfully authorised and ready for manual payment.</span>
                    </div>
                  </div>
                  {onShowReceipt && (
                    <button
                      onClick={() => onShowReceipt(invoice)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                      View Control Receipt
                    </button>
                  )}
                </div>
              )}

              {authError && (
                <div className="bg-rose-950 border border-rose-500/50 p-3 rounded-lg text-xs text-rose-200 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {/* Authorisation Form */}
              <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      Authorised By <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      disabled={!canAuthorise || invoice.authorisationStatus === 'Authorised'}
                      value={authBy}
                      onChange={(e) => setAuthBy(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      Authorisation Date & Time
                    </label>
                    <input
                      type="text"
                      disabled={!canAuthorise || invoice.authorisationStatus === 'Authorised'}
                      value={authDate}
                      onChange={(e) => setAuthDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    Authorisation Comment / Audit Memo <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={2}
                    disabled={!canAuthorise || invoice.authorisationStatus === 'Authorised'}
                    value={authComment}
                    onChange={(e) => setAuthComment(e.target.value)}
                    placeholder="Enter audit memo for authorisation..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                </div>

                {/* Mandatory Confirmation Checkbox */}
                <div className={`p-4 rounded-xl border transition-colors ${confirmCheckbox ? 'bg-emerald-950/30 border-emerald-500/50' : 'bg-slate-900 border-slate-800'}`}>
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!canAuthorise || invoice.authorisationStatus === 'Authorised'}
                      checked={confirmCheckbox}
                      onChange={(e) => setConfirmCheckbox(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer disabled:opacity-50"
                    />
                    <span className="text-xs text-slate-200 leading-relaxed font-semibold">
                      I confirm that I reviewed the invoice, PO, GRN, invoice total, matching result, department approval, accepted payment method and independently verified bank details.
                    </span>
                  </label>
                </div>

                {/* Requirement 6: Typed Invoice Number Confirmation Step-Up */}
                {canAuthorise && invoice.authorisationStatus !== 'Authorised' && (
                  <div className="p-4 bg-slate-900 rounded-xl border border-indigo-500/50 space-y-2">
                    <label className="block text-xs font-bold text-indigo-300">
                      Step-Up Security Confirmation: Type the invoice number to confirm authorisation.
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="text"
                        value={typedInvoiceNumber}
                        onChange={(e) => setTypedInvoiceNumber(e.target.value)}
                        placeholder={`Type exact invoice number: ${invoice.invoiceNumber}`}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-400"
                      />
                      {typedInvoiceNumber.trim() === invoice.invoiceNumber.trim() ? (
                        <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[11px] font-bold flex items-center">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Matched
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-slate-800 text-slate-400 rounded text-[11px] font-mono">
                          Unmatched
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Requirement: Six-Digit Authorisation PIN Input */}
                <div className="p-4 bg-slate-900 rounded-xl border border-indigo-500/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-indigo-300">
                      Six-Digit Authorisation PIN <span className="text-rose-400">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">DEMO PIN: <strong className="text-amber-300 font-bold">482615</strong></span>
                  </div>

                  <div className="relative flex items-center max-w-xs">
                    <input
                      type={showPin ? "text" : "password"}
                      maxLength={6}
                      value={pin}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setPin(val);
                      }}
                      disabled={!canAuthorise || invoice.authorisationStatus === 'Authorised' || Boolean(pinLockoutUntil && lockoutTimerSec > 0)}
                      placeholder="Enter 6-digit PIN"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-3.5 pr-10 py-2.5 text-sm font-mono tracking-widest text-white focus:outline-none focus:border-indigo-400 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-2.5 text-slate-400 hover:text-white p-1"
                      title={showPin ? "Hide PIN" : "Show PIN"}
                    >
                      {showPin ? <Lock className="w-4 h-4 text-amber-400" /> : <Shield className="w-4 h-4 text-indigo-400" />}
                    </button>
                  </div>

                  {pinLockoutUntil && lockoutTimerSec > 0 && (
                    <div className="p-3 bg-rose-950/90 border border-rose-500 rounded-lg text-xs text-rose-200 flex items-center space-x-2 animate-pulse">
                      <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                      <div>
                        <strong className="block font-bold">Authorisation Temporarily Locked</strong>
                        <span>Authorisation temporarily locked after repeated incorrect PIN attempts. Lockout expires in <strong className="text-white font-mono">{lockoutTimerSec}s</strong>.</span>
                      </div>
                    </div>
                  )}

                  {failedAttempts > 0 && failedAttempts < 3 && !pinLockoutUntil && (
                    <div className="p-2.5 bg-amber-950/80 border border-amber-500/80 rounded-lg text-xs text-amber-200 flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Incorrect Authorisation PIN. {3 - failedAttempts} attempt(s) remaining.</span>
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-slate-500 flex items-center space-x-2 pt-1">
                  <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Notice: Authorisation updates status to “Authorised – Ready for Manual Payment”. PayGuard does not initiate automated bank transfers.</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="text-xs text-slate-400">
                  {currentSoD.blockAction ? (
                    <span className="text-rose-400 font-semibold flex items-center">
                      <AlertTriangle className="w-3.5 h-3.5 mr-1 shrink-0" />
                      Incompatible Role Blocked
                    </span>
                  ) : !canAuthorise ? (
                    <span className="text-rose-400 font-semibold flex items-center">
                      <AlertTriangle className="w-3.5 h-3.5 mr-1 shrink-0" />
                      Prerequisite controls not met
                    </span>
                  ) : !authComment.trim() ? (
                    <span className="text-amber-400 font-semibold">
                      * Enter authorisation comment
                    </span>
                  ) : !confirmCheckbox ? (
                    <span className="text-amber-400 font-semibold">
                      * Select confirmation checkbox
                    </span>
                  ) : typedInvoiceNumber.trim() !== invoice.invoiceNumber.trim() ? (
                    <span className="text-amber-400 font-semibold">
                      * Type matching invoice number
                    </span>
                  ) : (!pin || pin.length !== 6) ? (
                    <span className="text-amber-400 font-semibold">
                      * Enter 6-digit PIN
                    </span>
                  ) : Boolean(pinLockoutUntil && lockoutTimerSec > 0) ? (
                    <span className="text-rose-400 font-semibold">
                      * Authorisation locked ({lockoutTimerSec}s)
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-semibold flex items-center">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 shrink-0" />
                      Ready to authorise
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('OVERVIEW')}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Back to Overview
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (currentSoD.blockAction) {
                        setAuthError(`Incompatible Duty Blocked: Role "${currentRole}" is not permitted to perform payment authorisation.`);
                        return;
                      }
                      if (!canAuthorise) {
                        setAuthError('Prerequisite controls are not met.');
                        return;
                      }
                      if (onOpenAuthorisationModal) {
                        onOpenAuthorisationModal(invoice);
                      }
                    }}
                    disabled={currentSoD.blockAction || !canAuthorise || invoice.authorisationStatus === 'Authorised'}
                    className={`px-6 py-2.5 rounded-xl text-sm font-extrabold shadow-lg transition-all flex items-center ${
                      currentSoD.blockAction || !canAuthorise || invoice.authorisationStatus === 'Authorised'
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 cursor-pointer'
                    }`}
                  >
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Authorise for Payment
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: STEP 4 — RECORD MANUAL PAYMENT */}
          {activeTab === 'MANUAL_PAYMENT' && (
            <form onSubmit={handleRecordManualPayment} className="space-y-6 animate-fade-in max-w-3xl mx-auto">
              
              {/* Mandatory warning banner */}
              <div className="bg-teal-950/60 border-2 border-teal-500/60 rounded-xl p-4 text-xs text-teal-200 space-y-1 shadow-md">
                <div className="font-extrabold flex items-center space-x-2 text-sm text-teal-300">
                  <DollarSign className="w-5 h-5 text-teal-400 shrink-0" />
                  <span>EXTERNAL MANUAL PAYMENT RECORDING</span>
                </div>
                <p className="text-slate-200 text-sm font-bold bg-slate-950 p-2.5 rounded border border-teal-800/80">
                  “PayGuard records a payment completed outside the application. PayGuard does not transfer money.”
                </p>
              </div>

              {isPaid && (
                <div className="bg-rose-950/90 border border-rose-600 p-4 rounded-xl text-xs text-rose-200 flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                  <div>
                    <strong className="text-white block font-bold">Duplicate Action Blocked</strong>
                    <span>This invoice has already been recorded as paid. Re-recording payment is locked.</span>
                  </div>
                </div>
              )}

              {!isAuthorised && !isPaid && (
                <div className="bg-amber-950/80 border border-amber-600 p-4 rounded-xl text-xs text-amber-200 flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <strong className="text-white block font-bold">Payment Recording Blocked</strong>
                    <span>This invoice must first be Authorised for Payment by Madam Lim before an external payment reference can be recorded.</span>
                  </div>
                </div>
              )}

              {payError && (
                <div className="bg-rose-950 border border-rose-500/50 p-3 rounded-lg text-xs text-rose-200 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{payError}</span>
                </div>
              )}

              <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 space-y-4">
                <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 flex flex-col sm:flex-row justify-between text-xs gap-2">
                  <div>
                    <span className="text-slate-500">Invoice:</span> <strong className="text-white font-mono">{invoice.invoiceNumber}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Supplier:</span> <strong className="text-white">{invoice.supplierName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Amount to Pay:</span> <strong className="text-emerald-400 font-extrabold text-sm">{formatInvoiceTotal(invoice.invoiceTotal || invoice.invoiceAmount, invoice.currency)}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      Payment Date <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="date"
                      disabled={isPaid || !isAuthorised || currentSoD.blockAction}
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      Payment Reference (Bank TRF / Cheque No) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      disabled={isPaid || !isAuthorised || currentSoD.blockAction}
                      value={payRef}
                      onChange={(e) => setPayRef(e.target.value)}
                      placeholder="e.g. TRF-20260815-9921 or CHQ-004182"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono font-bold disabled:opacity-50"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Must not be blank per PayGuard audit requirements.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    Payment Comment (Optional / Required if Duplicate Reference)
                  </label>
                  <textarea
                    rows={2}
                    disabled={isPaid || !isAuthorised || currentSoD.blockAction}
                    value={payComment}
                    onChange={(e) => setPayComment(e.target.value)}
                    placeholder="e.g. Paid via DBS Corporate banking portal by Finance team..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('OVERVIEW')}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
                >
                  Back to Overview
                </button>
                <button
                  type="submit"
                  disabled={isPaid || !isAuthorised || currentSoD.blockAction}
                  className={`px-6 py-2.5 rounded-lg text-sm font-extrabold shadow-lg transition-all flex items-center ${
                    isPaid || !isAuthorised || currentSoD.blockAction
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-teal-600 hover:bg-teal-500 text-white shadow-teal-600/30 cursor-pointer'
                  }`}
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Record Manual Payment
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center space-x-2">
            <User className="w-3.5 h-3.5 text-indigo-400" />
            <span>Active Role: <strong className="text-white">{currentRole}</strong></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold transition-colors cursor-pointer"
          >
            Close Panel
          </button>
        </div>

      </div>

      {/* FINAL CONFIRMATION MODAL */}
      {isConfirmationOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border-2 border-emerald-500 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-0 text-slate-100">
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-600 rounded-lg text-white">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Confirm Payment Authorisation</h3>
                  <p className="text-xs text-slate-400">Madam Lim (AP Lead) Gatekeeper Sign-off</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmationOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs text-slate-200">
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-400 block font-semibold">Supplier Name</span>
                  <strong className="text-white text-sm">{invoice.supplierName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Invoice Number</span>
                  <strong className="text-indigo-300 font-mono text-sm">{invoice.invoiceNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">PO Number</span>
                  <span className="text-white font-mono">{invoice.poNumber || 'Not stated'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">GRN Number</span>
                  <span className="text-white font-mono">{invoice.grnNumber || 'Not stated'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Invoice Total</span>
                  <strong className="text-emerald-400 font-extrabold text-base">
                    {formatInvoiceTotal(invoice.invoiceTotal || invoice.invoiceAmount, invoice.currency)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Currency</span>
                  <span className="text-white font-bold">{invoice.currency || 'SGD'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Due Date</span>
                  <span className="text-white font-mono">{invoice.dueDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Due-Date Category</span>
                  <span className="text-indigo-300 font-bold">{getDueDateCategory(calculateDaysRemaining(invoice.dueDate, asOfDate))}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Overall Match Status</span>
                  <span className="text-emerald-300 font-bold">{invoice.overallMatchStatus}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Exception Status</span>
                  <span className="text-emerald-300 font-bold">{getCleanExceptionWording(invoice)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Department Approval Status</span>
                  <span className="text-emerald-300 font-bold">{invoice.departmentApprovalStatus}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Accepted Payment Method</span>
                  <span className="text-indigo-300 font-bold">{invoice.acceptedPaymentMethod || 'Not stated'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Bank Verification Status</span>
                  <span className="text-emerald-300 font-bold">{invoice.bankVerificationStatus}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Bank Account (Masked)</span>
                  <span className="text-white font-mono">{maskBankAccount(invoice.bankAccountNumber)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block font-semibold">Bank Details</span>
                  <span className="text-white font-mono">{invoice.bankDetails}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Authorised By</span>
                  <span className="text-white font-bold">{authBy}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block font-semibold">Authorisation Comment</span>
                  <p className="text-slate-300 italic bg-slate-900 p-2 rounded border border-slate-800 mt-1">"{authComment}"</p>
                </div>
              </div>

              <div className="bg-amber-950/80 border border-amber-500/60 p-3.5 rounded-xl text-amber-200 text-xs font-semibold leading-relaxed flex items-start space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <span>PayGuard records authorisation only. The actual bank payment must be completed manually outside the application.</span>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsConfirmationOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel & Edit
              </button>
              <button
                type="button"
                onClick={handleFinalAuthorisationCommit}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-extrabold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <CheckSquare className="w-4 h-4" />
                <span>Confirm & Issue Authorisation Receipt</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* DEPARTMENT APPROVAL AMENDMENT MODAL */}
      {showDeptAmendModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
          <form onSubmit={handleAmendDeptApproval} className="bg-slate-900 border-2 border-amber-500 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl space-y-0 text-slate-100">
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-amber-600/30 border border-amber-500/50 rounded-lg text-amber-300">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Amend Department Approval Record</h3>
                  <p className="text-xs text-slate-400">Invoice {invoice.invoiceNumber} — Audit Override</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeptAmendModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-200">
              <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl text-amber-200">
                <p className="font-semibold">
                  Note: All amendments are permanently logged in the audit trail with the reason provided and previous record retained for audit compliance.
                </p>
              </div>

              {deptError && (
                <div className="bg-rose-950 border border-rose-500/50 p-2.5 rounded-lg text-xs text-rose-200 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{deptError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-amber-300 mb-1">
                  Reason for Amendment <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={deptAmendReason}
                  onChange={(e) => setDeptAmendReason(e.target.value)}
                  placeholder="Explain why this department approval record is being amended (e.g. Received updated email authorization from HOD)..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Status</label>
                  <select
                    value={deptStatus}
                    onChange={(e) => setDeptStatus(e.target.value as DepartmentApprovalStatus)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Approved By</label>
                  <input
                    type="text"
                    value={deptBy}
                    onChange={(e) => setDeptBy(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Approver's Department</label>
                  <input
                    type="text"
                    value={approversDepartment}
                    onChange={(e) => setApproversDepartment(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Approval Date</label>
                  <input
                    type="date"
                    value={deptDate}
                    onChange={(e) => setDeptDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Supporting Evidence Ref</label>
                <input
                  type="text"
                  value={supportingEvidenceRef}
                  onChange={(e) => setSupportingEvidenceRef(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Approval Comment</label>
                <textarea
                  rows={2}
                  value={deptComment}
                  onChange={(e) => setDeptComment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowDeptAmendModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-extrabold shadow-lg cursor-pointer flex items-center space-x-1"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                <span>Save Amended Record & Log Audit Trail</span>
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
