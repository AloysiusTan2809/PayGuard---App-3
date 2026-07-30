import React, { useState, useEffect } from 'react';
import { InvoiceRecord, DepartmentApprovalStatus, BankVerificationStatus, BankVerificationMethod, ExceptionStatus } from '../types';
import { 
  X, CheckCircle2, ShieldCheck, AlertTriangle, Clock, CreditCard, DollarSign, 
  FileText, Building2, Calendar, User, MessageSquare, ArrowRight, Lock, 
  ShieldAlert, Check, HelpCircle, CheckSquare, Sparkles 
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
  formatSingaporeDate 
} from '../utils/authorisationUtils';
import { formatInvoiceTotal } from '../utils/excelUtils';

interface ReviewModalProps {
  invoice: InvoiceRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateInvoice: (updatedInvoice: InvoiceRecord, auditAction: string, auditDetails: string) => void;
  initialSection?: 'OVERVIEW' | 'DEPT_APPROVAL' | 'BANK_VERIFICATION' | 'EXCEPTION_RESOLVE' | 'AUTHORISE' | 'MANUAL_PAYMENT';
  asOfDate?: string;
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
  asOfDate = new Date().toISOString().split('T')[0]
}) => {
  if (!isOpen || !invoice) return null;

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'DEPT_APPROVAL' | 'BANK_VERIFICATION' | 'EXCEPTION_RESOLVE' | 'AUTHORISE' | 'MANUAL_PAYMENT'>(initialSection);

  // Step 1: Department approval local form state
  const [deptStatus, setDeptStatus] = useState<DepartmentApprovalStatus>(invoice.departmentApprovalStatus);
  const [deptBy, setDeptBy] = useState(invoice.departmentApprovedBy || 'Madam Lim (AP Lead)');
  const [deptDate, setDeptDate] = useState(invoice.departmentApprovalDate || new Date().toISOString().split('T')[0]);
  const [deptComment, setDeptComment] = useState(invoice.departmentApprovalComment || '');
  const [deptError, setDeptError] = useState('');

  // Step 2: Bank verification local form state
  const [bankStatus, setBankStatus] = useState<BankVerificationStatus>(invoice.bankVerificationStatus);
  const [bankBy, setBankBy] = useState(invoice.bankVerifiedBy || 'Madam Lim (AP Lead)');
  const [bankDate, setBankDate] = useState(invoice.bankVerificationDate || new Date().toISOString().split('T')[0]);
  const [bankMethod, setBankMethod] = useState<BankVerificationMethod>((invoice.bankVerificationMethod as BankVerificationMethod) || 'Approved supplier master record');
  const [bankComment, setBankComment] = useState(invoice.bankVerificationComment || '');
  const [bankError, setBankError] = useState('');

  // Exception resolution local form state
  const [excStatus, setExcStatus] = useState<ExceptionStatus>(invoice.exceptionStatus);
  const [excBy, setExcBy] = useState(invoice.exceptionResolvedBy || 'Madam Lim (AP Lead)');
  const [excDate, setExcDate] = useState(invoice.exceptionResolutionDate || new Date().toISOString().split('T')[0]);
  const [excExplanation, setExcExplanation] = useState(invoice.exceptionResolutionExplanation || '');
  const [excRef, setExcRef] = useState(invoice.exceptionSupportingReference || '');
  const [excError, setExcError] = useState('');

  // Step 3: Authorise for payment local form state
  const [authBy, setAuthBy] = useState(invoice.authorisedBy || 'Madam Lim (AP Lead)');
  const [authDate, setAuthDate] = useState(invoice.authorisationDate || formatSingaporeTimestamp());
  const [authComment, setAuthComment] = useState(invoice.authorisationComment || 'All matching results, department approvals, and bank accounts verified per protocol.');
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  // Step 4: Record manual payment local form state
  const [payDate, setPayDate] = useState(invoice.paymentDate || formatSingaporeDate());
  const [payRef, setPayRef] = useState(invoice.paymentReference || '');
  const [payComment, setPayComment] = useState(invoice.paymentComment || '');
  const [payError, setPayError] = useState('');

  useEffect(() => {
    if (invoice) {
      setDeptStatus(invoice.departmentApprovalStatus);
      setDeptBy(invoice.departmentApprovedBy || 'Madam Lim (AP Lead)');
      setDeptDate(invoice.departmentApprovalDate || formatSingaporeDate());
      setDeptComment(invoice.departmentApprovalComment || '');

      setBankStatus(invoice.bankVerificationStatus);
      setBankBy(invoice.bankVerifiedBy || 'Madam Lim (AP Lead)');
      setBankDate(invoice.bankVerificationDate || formatSingaporeDate());
      setBankMethod((invoice.bankVerificationMethod as BankVerificationMethod) || 'Approved supplier master record');
      setBankComment(invoice.bankVerificationComment || '');

      setExcStatus(invoice.exceptionStatus);
      setExcBy(invoice.exceptionResolvedBy || 'Madam Lim (AP Lead)');
      setExcDate(invoice.exceptionResolutionDate || formatSingaporeDate());
      setExcExplanation(invoice.exceptionResolutionExplanation || '');
      setExcRef(invoice.exceptionSupportingReference || '');

      setAuthBy(invoice.authorisedBy || 'Madam Lim (AP Lead)');
      setAuthDate(invoice.authorisationDate || formatSingaporeTimestamp());
      setAuthComment(invoice.authorisationComment || 'All matching results, department approvals, and bank accounts verified per protocol.');
      setConfirmCheckbox(false);
      setIsConfirmationOpen(false);

      setPayDate(invoice.paymentDate || formatSingaporeDate());
      setPayRef(invoice.paymentReference || '');
      setPayComment(invoice.paymentComment || '');

      setActiveTab(initialSection);
    }
  }, [invoice, initialSection]);

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
    notAlreadyAuthorised,
    requiredFieldsPresent
  } = authCheck;

  // Handler: Save Department Approval
  const handleSaveDeptApproval = (e: React.FormEvent) => {
    e.preventDefault();
    if (deptStatus === 'Approved' && (!deptBy.trim() || !deptDate.trim())) {
      setDeptError('Approver Name and Approval Date are required when Approved is selected.');
      return;
    }
    setDeptError('');

    const updated: InvoiceRecord = {
      ...invoice,
      departmentApprovalStatus: deptStatus,
      departmentApprovedBy: deptBy,
      departmentApprovalDate: deptDate,
      departmentApprovalComment: deptComment,
      lastUpdatedDate: formatSingaporeTimestamp()
    };

    onUpdateInvoice(
      updated,
      'Department Approval Recorded',
      `Status: ${deptStatus} by ${deptBy} on ${deptDate}. Comment: ${deptComment || 'None'}`
    );
    setActiveTab('OVERVIEW');
  };

  // Handler: Save Bank Verification
  const handleSaveBankVerification = (e: React.FormEvent) => {
    e.preventDefault();
    if (bankStatus === 'Verified' && (!bankBy.trim() || !bankDate.trim() || !bankMethod)) {
      setBankError('Verified By, Verification Date, and Verification Method are required.');
      return;
    }
    setBankError('');

    const updated: InvoiceRecord = {
      ...invoice,
      bankVerificationStatus: bankStatus,
      bankVerifiedBy: bankBy,
      bankVerificationDate: bankDate,
      bankVerificationMethod: bankMethod,
      bankVerificationComment: bankComment,
      lastUpdatedDate: formatSingaporeTimestamp()
    };

    onUpdateInvoice(
      updated,
      'Bank Details Verified',
      `Status: ${bankStatus} using method "${bankMethod}" by ${bankBy}. Comment: ${bankComment || 'None'}`
    );
    setActiveTab('OVERVIEW');
  };

  // Handler: Save Exception Resolution
  const handleSaveExceptionResolution = (e: React.FormEvent) => {
    e.preventDefault();
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
      // If resolved, remove On Hold block so it can be evaluated for approval
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
    const timestamp = formatSingaporeTimestamp();
    const updated: InvoiceRecord = {
      ...invoice,
      authorisationStatus: 'Authorised',
      paymentStatus: 'Authorised – Ready for Manual Payment',
      authorisedBy: authBy,
      authorisationDate: authDate || timestamp,
      authorisationComment: authComment,
      lastUpdatedDate: timestamp
    };

    onUpdateInvoice(
      updated,
      'Invoice Authorised',
      `Madam Lim authorised invoice ${invoice.invoiceNumber} ($${(invoice.invoiceAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) for manual payment. Comment: ${authComment}`
    );

    setIsConfirmationOpen(false);
  };

  // Handler: Confirm Authorisation for Payment
  const handleConfirmAuthorisation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmCheckbox) {
      setAuthError('You must check the confirmation box stating you reviewed all matching, approval, and verification controls.');
      return;
    }
    if (!authBy.trim()) {
      setAuthError('Authorised By is required.');
      return;
    }
    setAuthError('');

    const updated: InvoiceRecord = {
      ...invoice,
      authorisationStatus: 'Authorised',
      paymentStatus: 'Authorised – Ready for Manual Payment',
      authorisedBy: authBy,
      authorisationDate: authDate || new Date().toLocaleString(),
      authorisationComment: authComment,
      lastUpdatedDate: new Date().toLocaleString()
    };

    onUpdateInvoice(
      updated,
      'Authorised for Payment',
      `Madam Lim authorised invoice ${invoice.invoiceNumber} ($${invoice.invoiceAmount}) for external bank transfer. Comment: ${authComment}`
    );
    setActiveTab('MANUAL_PAYMENT');
  };

  // Handler: Record Manual Payment
  const handleRecordManualPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payRef.trim()) {
      setPayError('Payment Reference (e.g. Bank Transfer TRF number or Cheque number) cannot be blank.');
      return;
    }
    if (!payDate.trim()) {
      setPayError('Payment Date is required.');
      return;
    }
    setPayError('');

    const updated: InvoiceRecord = {
      ...invoice,
      paymentStatus: 'Paid',
      paymentDate: payDate,
      paymentReference: payRef,
      paymentComment: payComment,
      lastUpdatedDate: new Date().toLocaleString()
    };

    onUpdateInvoice(
      updated,
      'Manual Payment Recorded',
      `Payment reference "${payRef}" recorded on ${payDate}. Comment: ${payComment || 'None'}`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-6 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
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
                {invoice.invoiceNumber === 'AA-2026-208' && (
                  <span className="px-2 py-0.5 bg-indigo-500 text-white rounded text-[10px] font-extrabold uppercase">
                    Mandatory Test Case
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Supplier: <strong className="text-white">{invoice.supplierName}</strong> • Due: <strong className="text-white">{invoice.dueDate}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

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

              {/* Grid of the 13 required fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* Supplier & Invoice */}
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
                    <Building2 className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                    Supplier & Document Info
                  </h5>
                  <div className="text-xs space-y-1 text-slate-300">
                    <div><span className="text-slate-500 font-medium">Supplier Name:</span> <strong className="text-white">{invoice.supplierName}</strong></div>
                    <div><span className="text-slate-500 font-medium">Invoice Number:</span> <strong className="text-white font-mono">{invoice.invoiceNumber}</strong></div>
                    <div><span className="text-slate-500 font-medium">Due Date:</span> <strong className="text-white">{invoice.dueDate}</strong></div>
                  </div>
                </div>

                {/* PO & GRN Match */}
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
                    <FileText className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                    PO & GRN Matching
                  </h5>
                  <div className="text-xs space-y-1 text-slate-300 font-mono">
                    <div><span className="text-slate-500 font-sans">PO Number:</span> <strong className="text-white">{invoice.poNumber || 'None'}</strong></div>
                    <div><span className="text-slate-500 font-sans">GRN Number:</span> <strong className="text-white">{invoice.grnNumber || 'None'}</strong></div>
                    <div className="pt-1 font-sans">
                      <span className="text-slate-500">Overall Match Status:</span>
                      <div className="mt-1 font-semibold text-emerald-300 bg-emerald-950/80 px-2 py-1 rounded border border-emerald-800 w-max">
                        {invoice.overallMatchStatus}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bank Details & Status */}
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                    Bank & Verification
                  </h5>
                  <div className="text-xs space-y-1 text-slate-300">
                    <div><span className="text-slate-500 font-medium">Bank Details:</span> <span className="text-slate-200 line-clamp-1">{invoice.bankDetails}</span></div>
                    <div><span className="text-slate-500 font-medium">Account Number:</span> <strong className="text-white font-mono">{invoice.bankAccountNumber}</strong></div>
                    <div className="pt-1">
                      <span className="text-slate-500 font-medium">Verification Status:</span>
                      <div className="mt-1 flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${invoice.bankVerificationStatus === 'Verified' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'}`}>
                          {invoice.bankVerificationStatus || 'Not Verified'}
                        </span>
                        <button
                          onClick={() => setActiveTab('BANK_VERIFICATION')}
                          className="text-[11px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                        >
                          Verify now
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Department Approval Status Card */}
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                    Department Approval
                  </h5>
                  <div className="text-xs space-y-1.5 text-slate-300">
                    <div>
                      <span className="text-slate-500 font-medium">Status:</span>
                      <span className={`ml-2 px-2 py-0.5 rounded text-[11px] font-bold ${invoice.departmentApprovalStatus === 'Approved' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'}`}>
                        {invoice.departmentApprovalStatus || 'Pending'}
                      </span>
                    </div>
                    {invoice.departmentApprovedBy && (
                      <div><span className="text-slate-500">Approved By:</span> {invoice.departmentApprovedBy}</div>
                    )}
                    {invoice.departmentApprovalDate && (
                      <div><span className="text-slate-500">Date:</span> {invoice.departmentApprovalDate}</div>
                    )}
                  </div>
                </div>

                {/* Exception Summary Card */}
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                    Exception Summary
                  </h5>
                  <div className="text-xs space-y-1 text-slate-300">
                    <div>
                      <span className="text-slate-500">Status:</span>
                      <span className={`ml-2 px-2 py-0.5 rounded text-[11px] font-bold ${invoice.exceptionStatus === 'Resolved' ? 'bg-emerald-950 text-emerald-300' : invoice.exceptionStatus === 'Unresolved' ? 'bg-rose-950 text-rose-300' : 'bg-slate-800 text-slate-300'}`}>
                        {invoice.exceptionStatus || 'None'}
                      </span>
                    </div>
                    <p className="text-slate-200 mt-1 bg-slate-900 p-2 rounded border border-slate-800/80 text-[11px] leading-relaxed">
                      {invoice.exceptionSummary || 'No discrepancies detected during App 2 3-way match.'}
                    </p>
                  </div>
                </div>

                {/* Gatekeeper / Payment Status Card */}
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
                    <CreditCard className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                    Gatekeeper & Payment
                  </h5>
                  <div className="text-xs space-y-1.5 text-slate-300">
                    <div>
                      <span className="text-slate-500 font-medium">Madam Lim Auth:</span>
                      <span className={`ml-2 px-2 py-0.5 rounded text-[11px] font-bold ${invoice.authorisationStatus === 'Authorised' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-300'}`}>
                        {invoice.authorisationStatus || 'Pending'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Payment Status:</span>
                      <span className={`ml-2 px-2 py-0.5 rounded text-[11px] font-bold ${isPaid ? 'bg-teal-950 text-teal-300 border border-teal-800' : isAuthorised ? 'bg-blue-950 text-blue-300 border border-blue-800' : 'bg-slate-800 text-slate-300'}`}>
                        {invoice.paymentStatus || 'Pending'}
                      </span>
                    </div>
                    {invoice.paymentReference && (
                      <div className="font-mono text-[11px] text-teal-400">Ref: {invoice.paymentReference}</div>
                    )}
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
                  <strong className="text-white ml-1">Do not automatically approve the invoice.</strong>
                </p>
              </div>

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
                        onClick={() => setDeptStatus(st)}
                        className={`py-3 px-4 rounded-xl border text-sm font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                          deptStatus === st
                            ? st === 'Approved'
                              ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg'
                              : st === 'Rejected'
                              ? 'bg-rose-600 border-rose-500 text-white shadow-lg'
                              : 'bg-amber-600 border-amber-500 text-white shadow-lg'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                        }`}
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
                      value={deptBy}
                      onChange={(e) => setDeptBy(e.target.value)}
                      placeholder="e.g. Madam Lim or Dept Manager Name"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      Department Approval Date <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={deptDate}
                      onChange={(e) => setDeptDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    Department Approval Comment (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={deptComment}
                    onChange={(e) => setDeptComment(e.target.value)}
                    placeholder="Enter any notes or department sign-off reference code..."
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
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold shadow-lg transition-all cursor-pointer flex items-center"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Save Department Approval Record
                </button>
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
                    <span className="text-slate-500">Account No:</span> <strong className="text-emerald-400 font-mono">{invoice.bankAccountNumber}</strong>
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
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center">
                    <Lock className="w-3 h-3 mr-1 text-slate-400" />
                    Notice: "Invoice itself" is strictly blocked by PayGuard protocol.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    Verification Comment / Audit Note (Optional)
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
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold shadow-lg transition-all cursor-pointer flex items-center"
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
                  className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-bold shadow-lg transition-all cursor-pointer flex items-center"
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
                <div className="bg-emerald-950/90 border-2 border-emerald-500 p-4 rounded-xl text-xs text-emerald-100 flex items-center space-x-3 shadow-lg">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <strong className="text-white text-sm block font-extrabold mb-0.5">Invoice Authorised</strong>
                    <span>Invoice successfully authorised and ready for manual payment.</span>
                  </div>
                </div>
              )}

              {authError && (
                <div className="bg-rose-950 border border-rose-500/50 p-3 rounded-lg text-xs text-rose-200 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {/* Authorisation form */}
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

                <div className="text-[11px] text-slate-500 flex items-center space-x-2 pt-1">
                  <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Notice: Authorisation updates status to “Authorised – Ready for Manual Payment”. PayGuard does not initiate automated bank transfers.</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="text-xs text-slate-400">
                  {!canAuthorise ? (
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
                  ) : invoice.authorisationStatus === 'Authorised' ? (
                    <span className="text-emerald-400 font-semibold flex items-center">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 shrink-0" />
                      Authorisation completed
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
                      if (!canAuthorise) {
                        setAuthError('Prerequisite controls are not met.');
                        return;
                      }
                      if (!authBy.trim()) {
                        setAuthError('Authorised By is required.');
                        return;
                      }
                      if (!authComment.trim()) {
                        setAuthError('Authorisation Comment / Audit Memo is required.');
                        return;
                      }
                      if (!confirmCheckbox) {
                        setAuthError('Please tick the confirmation checkbox.');
                        return;
                      }
                      setAuthError('');
                      setIsConfirmationOpen(true);
                    }}
                    disabled={!canAuthorise || !authBy.trim() || !authComment.trim() || !confirmCheckbox || invoice.authorisationStatus === 'Authorised'}
                    className={`px-6 py-2.5 rounded-xl text-sm font-extrabold shadow-lg transition-all flex items-center ${
                      !canAuthorise || !authBy.trim() || !authComment.trim() || !confirmCheckbox || invoice.authorisationStatus === 'Authorised'
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 cursor-pointer'
                    }`}
                  >
                    <CheckSquare className="w-4 h-4 mr-2" />
                    AUTHORISE FOR PAYMENT
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: STEP 4 — RECORD MANUAL PAYMENT */}
          {activeTab === 'MANUAL_PAYMENT' && (
            <form onSubmit={handleRecordManualPayment} className="space-y-6 animate-fade-in max-w-3xl mx-auto">
              
              {/* Mandatory warning banner per prompt */}
              <div className="bg-teal-950/60 border-2 border-teal-500/60 rounded-xl p-4 text-xs text-teal-200 space-y-1 shadow-md">
                <div className="font-extrabold flex items-center space-x-2 text-sm text-teal-300">
                  <DollarSign className="w-5 h-5 text-teal-400 shrink-0" />
                  <span>EXTERNAL MANUAL PAYMENT RECORDING</span>
                </div>
                <p className="text-slate-200 text-sm font-bold bg-slate-950 p-2.5 rounded border border-teal-800/80">
                  “PayGuard records a payment completed outside the application. PayGuard does not transfer money.”
                </p>
              </div>

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
                    <span className="text-slate-500">Amount to Pay:</span> <strong className="text-emerald-400 font-extrabold text-sm">${(invoice.invoiceAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      Payment Date <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="date"
                      disabled={isPaid || !isAuthorised}
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
                      disabled={isPaid || !isAuthorised}
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
                    Payment Comment (Optional)
                  </label>
                  <textarea
                    rows={2}
                    disabled={isPaid || !isAuthorised}
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
                  disabled={isPaid || !isAuthorised}
                  className={`px-6 py-2.5 rounded-lg text-sm font-extrabold shadow-lg transition-all flex items-center ${
                    isPaid || !isAuthorised
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

        {/* Modal Footer (if needed for general navigation) */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center space-x-2">
            <User className="w-3.5 h-3.5 text-indigo-400" />
            <span>Gatekeeper User: <strong className="text-white">Madam Lim (AP Lead)</strong></span>
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
          <div className="bg-slate-900 border-2 border-emerald-500 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-0">
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
                  <span className="text-emerald-300 font-bold">{invoice.exceptionStatus || 'None'}</span>
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
                  <span className="text-slate-400 block font-semibold">Bank Account / IBAN</span>
                  <span className="text-white font-mono">{invoice.bankAccountNumber || 'Not stated'}</span>
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

            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsConfirmationOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFinalAuthorisationCommit}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-extrabold shadow-lg shadow-emerald-600/30 flex items-center cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Confirm Authorisation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
