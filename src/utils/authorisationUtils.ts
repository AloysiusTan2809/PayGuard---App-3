import { InvoiceRecord } from '../types';

export const normalizeStatus = (val?: string | number | null): string => {
  if (val === undefined || val === null) return '';
  return val
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-');
};

export interface AuthorisationCheckResult {
  canAuthorise: boolean;
  reasons: string[];
  matchPassed: boolean;
  noUnresolvedException: boolean;
  deptApproved: boolean;
  bankVerified: boolean;
  paymentMethodPresent: boolean;
  poNumberPresent: boolean;
  grnNumberPresent: boolean;
  invoiceTotalValid: boolean;
  paymentStatusValid: boolean;
  notAlreadyAuthorised: boolean;
  requiredFieldsPresent: boolean;
}

export const checkAuthorisationEligibility = (invoice: InvoiceRecord | null): AuthorisationCheckResult => {
  if (!invoice) {
    return {
      canAuthorise: false,
      reasons: ['No invoice selected.'],
      matchPassed: false,
      noUnresolvedException: false,
      deptApproved: false,
      bankVerified: false,
      paymentMethodPresent: false,
      poNumberPresent: false,
      grnNumberPresent: false,
      invoiceTotalValid: false,
      paymentStatusValid: false,
      notAlreadyAuthorised: false,
      requiredFieldsPresent: false,
    };
  }

  const rawReasons: string[] = [];

  // 1. Overall Match Status
  const matchStr = normalizeStatus(invoice.overallMatchStatus);
  const matchPassed = 
    matchStr === 'matched' ||
    matchStr === 'matched - awaiting department approval' ||
    matchStr === 'pass' ||
    matchStr === 'resolved' ||
    (matchStr.startsWith('matched') && !matchStr.includes('mismatch')) ||
    matchStr.includes('pass') ||
    matchStr.includes('resolved');

  if (!matchPassed) {
    rawReasons.push(`Overall Match Status is "${invoice.overallMatchStatus || 'Pending'}" (must be Matched, Pass, or Resolved).`);
  }

  // 2. No Unresolved Exception
  const excStatusStr = normalizeStatus(invoice.exceptionStatus);
  const excSummaryStr = normalizeStatus(invoice.exceptionSummary);
  const isExceptionResolved = excStatusStr === 'resolved';
  const hasBlockingSummary = Boolean(
    excSummaryStr && 
    excSummaryStr !== 'none' && 
    excSummaryStr !== 'no discrepancies detected during app 2 3-way match.'
  );

  const noUnresolvedException = excStatusStr !== 'unresolved' && (!hasBlockingSummary || isExceptionResolved);
  if (!noUnresolvedException) {
    rawReasons.push(`Invoice has an unresolved exception ("${invoice.exceptionSummary || 'Unresolved Exception'}").`);
  }

  // 3. Department Approval Status is "Approved"
  const deptStatusStr = normalizeStatus(invoice.departmentApprovalStatus);
  const deptApproved = deptStatusStr === 'approved';
  if (!deptApproved) {
    rawReasons.push(`Department Approval Status is "${invoice.departmentApprovalStatus || 'Pending'}" (must be Approved).`);
  }

  // 4. Bank Details Verification Status is "Verified"
  const bankStatusStr = normalizeStatus(invoice.bankVerificationStatus);
  const bankVerified = bankStatusStr === 'verified';
  if (!bankVerified) {
    rawReasons.push(`Bank Details Verification Status is "${invoice.bankVerificationStatus || 'Not Verified'}" (must be Verified).`);
  }

  // 5. Accepted Payment Method is present
  const payMethodStr = normalizeStatus(invoice.acceptedPaymentMethod);
  const paymentMethodPresent = Boolean(payMethodStr && payMethodStr !== 'not stated' && payMethodStr !== 'none');
  if (!paymentMethodPresent) {
    rawReasons.push('Accepted Payment Method is missing.');
  }

  // 6. PO Number is present
  const poStr = normalizeStatus(invoice.poNumber);
  const poNumberPresent = Boolean(
    poStr &&
    poStr !== 'not stated' &&
    poStr !== 'none' &&
    poStr !== 'missing po' &&
    poStr !== 'missing'
  );
  if (!poNumberPresent) {
    rawReasons.push('PO Number is missing or invalid.');
  }

  // 7. GRN Number is present
  const grnStr = normalizeStatus(invoice.grnNumber);
  const grnNumberPresent = Boolean(
    grnStr &&
    grnStr !== 'not stated' &&
    grnStr !== 'none' &&
    grnStr !== 'missing grn' &&
    grnStr !== 'missing'
  );
  if (!grnNumberPresent) {
    rawReasons.push('GRN Number is missing or invalid.');
  }

  // 8. Invoice Total is numeric and valid
  const numAmt = typeof invoice.invoiceTotal === 'number' && !isNaN(invoice.invoiceTotal) && invoice.invoiceTotal > 0
    ? invoice.invoiceTotal 
    : invoice.invoiceAmount;
  const invoiceTotalValid = typeof numAmt === 'number' && !isNaN(numAmt) && numAmt > 0;
  if (!invoiceTotalValid) {
    rawReasons.push('Invoice Total is missing or invalid.');
  }

  // Payment Status is not: Paid, Authorised – Ready for Manual Payment, Rejected, Blocked
  const payStatusStr = normalizeStatus(invoice.paymentStatus);
  const paymentStatusValid = 
    payStatusStr !== 'paid' &&
    payStatusStr !== 'authorised - ready for manual payment' &&
    payStatusStr !== 'authorised' &&
    payStatusStr !== 'rejected' &&
    payStatusStr !== 'blocked';
  
  if (!paymentStatusValid) {
    rawReasons.push(`Payment Status is "${invoice.paymentStatus || 'Blocked'}".`);
  }

  // Madam Lim Authorisation Status is not already "Authorised"
  const authStatusStr = normalizeStatus(invoice.authorisationStatus);
  const notAlreadyAuthorised = authStatusStr !== 'authorised';
  if (!notAlreadyAuthorised) {
    rawReasons.push('Invoice Madam Lim Authorisation Status is already "Authorised".');
  }

  // Required supplier & number fields
  const hasSupplier = Boolean(invoice.supplierName && invoice.supplierName.trim().length > 0 && normalizeStatus(invoice.supplierName) !== 'not stated');
  const hasInvNumber = Boolean(invoice.invoiceNumber && invoice.invoiceNumber.trim().length > 0 && normalizeStatus(invoice.invoiceNumber) !== 'not stated');
  const hasDueDate = Boolean(invoice.dueDate && invoice.dueDate.trim().length > 0 && normalizeStatus(invoice.dueDate) !== 'not stated');

  const requiredFieldsPresent = hasSupplier && hasInvNumber && hasDueDate && poNumberPresent && grnNumberPresent && invoiceTotalValid;
  if (!hasSupplier || !hasInvNumber || !hasDueDate) {
    const missing: string[] = [];
    if (!hasSupplier) missing.push('Supplier Name');
    if (!hasInvNumber) missing.push('Invoice Number');
    if (!hasDueDate) missing.push('Due Date');
    rawReasons.push(`Required invoice details (${missing.join(', ')}) are missing.`);
  }

  const canAuthorise = 
    matchPassed &&
    noUnresolvedException &&
    deptApproved &&
    bankVerified &&
    paymentMethodPresent &&
    poNumberPresent &&
    grnNumberPresent &&
    invoiceTotalValid &&
    paymentStatusValid &&
    notAlreadyAuthorised &&
    requiredFieldsPresent;

  // Deduplicate repeated blocking reasons
  const reasons = Array.from(new Set(rawReasons));

  return {
    canAuthorise,
    reasons,
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
    requiredFieldsPresent,
  };
};

export const formatSingaporeTimestamp = (dateInput?: Date | string | null): string => {
  const d = dateInput ? new Date(dateInput) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };

  const formatter = new Intl.DateTimeFormat('sv-SE', options);
  return formatter.format(validDate).replace('T', ' ');
};

export const formatSingaporeDate = (dateInput?: Date | string | null): string => {
  const d = dateInput ? new Date(dateInput) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };

  const formatter = new Intl.DateTimeFormat('sv-SE', options);
  return formatter.format(validDate);
};
