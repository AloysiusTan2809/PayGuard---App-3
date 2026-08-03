import { InvoiceRecord, UserRole } from '../types';

export const normalizeStatus = (val?: string | number | null): string => {
  if (val === undefined || val === null) return '';
  return val
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-');
};

export const maskBankAccount = (accNum?: string | null): string => {
  if (!accNum || accNum.trim() === '' || normalizeStatus(accNum) === 'not stated') {
    return 'Not stated';
  }
  const clean = accNum.trim();
  if (clean.length <= 4) {
    return '••••' + clean;
  }
  const last4 = clean.slice(-4);
  const bulletCount = Math.max(4, clean.length - 4);
  return '•'.repeat(bulletCount) + last4;
};

export interface SupplierBankChangeResult {
  hasChanged: boolean;
  previousAccount?: string;
  currentAccount?: string;
  message?: string;
}

export const checkSupplierBankAccountChange = (
  invoice: InvoiceRecord,
  allInvoices: InvoiceRecord[]
): SupplierBankChangeResult => {
  if (!invoice || !invoice.supplierName || !invoice.bankAccountNumber) {
    return { hasChanged: false };
  }

  const normSupplier = normalizeStatus(invoice.supplierName);
  const currentAcc = invoice.bankAccountNumber.trim();
  const normCurrentAcc = currentAcc.toLowerCase();

  // Find other invoices for the same supplier that have a different bank account
  const conflictingInvoice = allInvoices.find(other => {
    if (other.id === invoice.id || other.invoiceNumber === invoice.invoiceNumber) return false;
    if (normalizeStatus(other.supplierName) !== normSupplier) return false;
    if (!other.bankAccountNumber || other.bankAccountNumber.trim() === '') return false;
    return other.bankAccountNumber.trim().toLowerCase() !== normCurrentAcc;
  });

  if (conflictingInvoice) {
    const prevAcc = conflictingInvoice.bankAccountNumber.trim();
    return {
      hasChanged: true,
      previousAccount: maskBankAccount(prevAcc),
      currentAccount: maskBankAccount(currentAcc),
      message: `The bank account (${maskBankAccount(currentAcc)}) differs from another imported invoice ${conflictingInvoice.invoiceNumber} (${maskBankAccount(prevAcc)}) for supplier ${invoice.supplierName}. Independent verification using an existing trusted contact is required.`,
    };
  }

  return { hasChanged: false };
};

export const getCleanStatusWording = (invoice: InvoiceRecord): string => {
  if (!invoice) return 'Unknown';
  
  const payStatusStr = normalizeStatus(invoice.paymentStatus);
  if (payStatusStr === 'paid') {
    return 'Paid';
  }

  const authStatusStr = normalizeStatus(invoice.authorisationStatus);
  if (payStatusStr === 'authorised - ready for manual payment' || authStatusStr === 'authorised') {
    return 'Authorised – Ready for Manual Payment';
  }

  // App 2 Exception check
  const excStatusStr = normalizeStatus(invoice.exceptionStatus);
  const excSummaryStr = normalizeStatus(invoice.exceptionSummary);
  const matchStr = normalizeStatus(invoice.overallMatchStatus);
  
  const hasGenuineException = 
    excStatusStr === 'unresolved' ||
    (excSummaryStr && excSummaryStr !== 'none' && !excSummaryStr.includes('no discrepancies') && excStatusStr !== 'resolved') ||
    matchStr.includes('mismatch') ||
    matchStr.includes('exception') ||
    matchStr.includes('review required');

  if (hasGenuineException) {
    return 'On Hold – App 2 Exception';
  }

  // Dept approval check
  const deptApproved = normalizeStatus(invoice.departmentApprovalStatus) === 'approved';
  if (!deptApproved) {
    return 'Awaiting Department Approval';
  }

  // Bank verification check
  const bankVerified = normalizeStatus(invoice.bankVerificationStatus) === 'verified';
  if (!bankVerified) {
    return 'Pending Bank Verification';
  }

  return 'Eligible for Authorisation';
};

export const getCleanExceptionWording = (invoice: InvoiceRecord): string => {
  if (!invoice) return 'No Exception';
  const excStatusStr = normalizeStatus(invoice.exceptionStatus);
  const excSummaryStr = normalizeStatus(invoice.exceptionSummary);

  if (excStatusStr === 'resolved') {
    return 'Resolved Exception';
  }

  if (
    !excSummaryStr || 
    excSummaryStr === 'none' || 
    excSummaryStr.includes('no discrepancies') ||
    excStatusStr === 'none'
  ) {
    return 'No Exception';
  }

  return invoice.exceptionSummary || 'App 2 Exception';
};

export interface SoDCheckResult {
  isAllowed: boolean;
  riskLevel: 'NONE' | 'MODERATE' | 'HIGH';
  conflictReason?: string;
  requiresReason: boolean;
  blockAction: boolean;
}

export const checkSegregationOfDuties = (
  action: 'APPROVE_DEPT' | 'VERIFY_BANK' | 'AUTHORISE' | 'RECORD_PAYMENT' | 'RESOLVE_EXCEPTION',
  invoice: InvoiceRecord,
  currentRole: UserRole,
  currentUser: string
): SoDCheckResult => {
  // 1. Role-based permission checks
  if (currentRole === 'Read-Only Reviewer') {
    return {
      isAllowed: false,
      riskLevel: 'HIGH',
      conflictReason: 'Access Denied – Your assigned role (Read-Only Reviewer) does not permit modifying records.',
      requiresReason: false,
      blockAction: true,
    };
  }

  if (action === 'APPROVE_DEPT' && currentRole !== 'Department Approver') {
    return {
      isAllowed: false,
      riskLevel: 'HIGH',
      conflictReason: `Access Denied – Your assigned role (${currentRole}) does not permit this action. Only the Department Approver may complete Step 1 (Department Approval).`,
      requiresReason: false,
      blockAction: true,
    };
  }

  if ((action === 'VERIFY_BANK' || action === 'AUTHORISE' || action === 'RESOLVE_EXCEPTION') && currentRole !== 'AP Lead – Madam Lim') {
    return {
      isAllowed: false,
      riskLevel: 'HIGH',
      conflictReason: `Access Denied – Your assigned role (${currentRole}) does not permit this action. Only the AP Lead may verify bank details and authorise payment.`,
      requiresReason: false,
      blockAction: true,
    };
  }

  if (action === 'RECORD_PAYMENT' && currentRole !== 'AP Lead – Madam Lim') {
    return {
      isAllowed: false,
      riskLevel: 'HIGH',
      conflictReason: `Access Denied – Your assigned role (${currentRole}) does not permit this action. Only the AP Lead may record manual payments completed outside PayGuard.`,
      requiresReason: false,
      blockAction: true,
    };
  }

  // 2. Conflict of Duties (Same person performing incompatible controls)
  const normUser = normalizeStatus(currentUser);
  const normDeptApprovedBy = normalizeStatus(invoice.departmentApprovedBy);
  const normAuthorisedBy = normalizeStatus(invoice.authorisedBy);

  // Moderate conflict: Same user approved dept and now authorising
  if (action === 'AUTHORISE' && normDeptApprovedBy && normDeptApprovedBy === normUser) {
    return {
      isAllowed: true,
      riskLevel: 'MODERATE',
      conflictReason: 'Segregation-of-Duties Warning: The same user recorded Department Approval and is now performing Final Payment Authorisation. Justification required.',
      requiresReason: true,
      blockAction: false,
    };
  }

  // Moderate conflict: Same user authorised and now recording payment
  if (action === 'RECORD_PAYMENT' && normAuthorisedBy && normAuthorisedBy === normUser) {
    return {
      isAllowed: true,
      riskLevel: 'MODERATE',
      conflictReason: 'Segregation-of-Duties Warning: The same user authorised this invoice and is now recording manual payment. Justification required.',
      requiresReason: true,
      blockAction: false,
    };
  }

  return {
    isAllowed: true,
    riskLevel: 'NONE',
    requiresReason: false,
    blockAction: false,
  };
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

  // 3. Department Approval Status is "Approved" and approver details are recorded
  const deptStatusVal = (invoice as any)['Department Approval Status'] ?? invoice.departmentApprovalStatus;
  const deptStatusStr = normalizeStatus(deptStatusVal);
  const hasDeptApprovedBy = Boolean(invoice.departmentApprovedBy && invoice.departmentApprovedBy.trim().length > 0 && normalizeStatus(invoice.departmentApprovedBy) !== 'not stated');
  const deptApproved = deptStatusStr === 'approved' && hasDeptApprovedBy;
  if (deptStatusStr !== 'approved') {
    rawReasons.push(`Department Approval Status is "${deptStatusVal || 'Pending'}" (must be Approved).`);
  } else if (!hasDeptApprovedBy) {
    rawReasons.push('Department Approved By details must be recorded.');
  }

  // 4. Bank Details Verification Status is "Verified"
  const bankStatusVal = (invoice as any)['Bank Details Verification Status'] ?? (invoice as any)['Bank Verification Status'] ?? invoice.bankVerificationStatus;
  const bankStatusStr = normalizeStatus(bankStatusVal);
  const bankVerified = bankStatusStr === 'verified';
  if (!bankVerified) {
    rawReasons.push(`Bank Details Verification Status is "${bankStatusVal || 'Not Verified'}" (must be Verified).`);
  }

  // 5. Accepted Payment Method is present
  const payMethodVal = (invoice as any)['Accepted Payment Method'] ?? invoice.acceptedPaymentMethod;
  const payMethodStr = normalizeStatus(payMethodVal);
  const paymentMethodPresent = Boolean(payMethodStr && payMethodStr !== 'not stated' && payMethodStr !== 'none');
  if (!paymentMethodPresent) {
    rawReasons.push('Accepted Payment Method is missing.');
  }

  // 6. PO Number is present
  const poVal = (invoice as any)['PO Number(s)'] ?? (invoice as any)['PO Number'] ?? invoice.poNumber ?? (invoice as any).poNumbers ?? '';
  const poStr = normalizeStatus(poVal);
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
  const grnVal = (invoice as any)['GRN Number(s)'] ?? (invoice as any)['GRN Number'] ?? invoice.grnNumber ?? (invoice as any).grnNumbers ?? '';
  const grnStr = normalizeStatus(grnVal);
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
  const rawTotal = (invoice as any)['Invoice Total'] ?? (invoice as any)['Invoice Amount'] ?? invoice.invoiceTotal ?? invoice.invoiceAmount;
  let numAmt = 0;
  if (typeof rawTotal === 'number' && !isNaN(rawTotal)) {
    numAmt = rawTotal;
  } else if (typeof rawTotal === 'string') {
    numAmt = parseFloat(rawTotal.replace(/[^0-9.-]/g, '')) || 0;
  }
  const invoiceTotalValid = numAmt > 0;
  if (!invoiceTotalValid) {
    rawReasons.push('Invoice Total is missing or invalid.');
  }

  // Payment Status is not: Paid, Authorised – Ready for Manual Payment, Rejected, Blocked
  const payStatusVal = (invoice as any)['Payment Status'] ?? invoice.paymentStatus;
  const payStatusStr = normalizeStatus(payStatusVal);
  const paymentStatusValid = 
    payStatusStr !== 'paid' &&
    payStatusStr !== 'authorised - ready for manual payment' &&
    payStatusStr !== 'authorised' &&
    payStatusStr !== 'rejected' &&
    payStatusStr !== 'blocked';
  
  if (!paymentStatusValid) {
    rawReasons.push(`Payment Status is "${payStatusVal || 'Blocked'}".`);
  }

  // Madam Lim Authorisation Status is not already "Authorised"
  const authStatusVal = (invoice as any)['Madam Lim Authorisation Status'] ?? (invoice as any)['Authorisation Status'] ?? invoice.authorisationStatus;
  const authStatusStr = normalizeStatus(authStatusVal);
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
