export type DepartmentApprovalStatus = 'Pending' | 'Approved' | 'Rejected';
export type BankVerificationStatus = 'Not Verified' | 'Verified' | 'Rejected';
export type ExceptionStatus = 'None' | 'Unresolved' | 'Resolved' | 'Rejected';
export type AuthorisationStatus = 'Pending' | 'Authorised' | 'Blocked' | 'Rejected';
export type PaymentStatus = 'Pending' | 'Authorised – Ready for Manual Payment' | 'Paid' | 'On Hold' | 'Rejected';

export type BankVerificationMethod =
  | 'Approved supplier master record'
  | 'Existing verified phone number'
  | 'Existing verified email address'
  | 'Authorised supplier representative'
  | 'Other independently verified source';

export interface InvoiceRecord {
  // Core 33 Columns from "App 3 Handoff"
  id: string; // Unique identifier (Handoff Record ID or Invoice Number)
  handoffRecordId?: string;
  invoiceNumber: string;
  supplierName: string;
  supplierContactDetails?: string;
  businessRegTaxId?: string;
  invoiceDate?: string;
  dueDate: string;
  poNumber: string;
  grnNumber: string;
  invoiceAmount: number; // Stored as numeric for math, formatted for display
  invoiceTotal?: number; // Alias for invoiceAmount
  currency?: string;
  paymentTerms?: string;
  acceptedPaymentMethod?: string;
  bankDetails: string;
  bankAccountNumber: string;
  paymentReference: string;
  latePaymentTerms?: string;
  sourceFile?: string;
  sourceWorkbook?: string;
  overallMatchStatus: string;
  exceptionSummary: string;
  departmentApprovalStatus: DepartmentApprovalStatus;
  departmentApprovedBy: string;
  departmentApprovalDate: string;
  departmentApprovalComment?: string;
  app3IntakeStatus?: string;
  paymentEligibility?: string;
  blockingReason?: string;
  suggestedNextAction?: string;
  bankVerificationStatus: BankVerificationStatus;
  bankVerifiedBy: string;
  bankVerificationDate: string;
  bankVerificationMethod: string;
  bankVerificationComment?: string;
  authorisationStatus: AuthorisationStatus;
  authorisedBy: string;
  authorisationDate: string;
  authorisationComment?: string;
  reminderStatus?: string;
  paymentStatus: PaymentStatus;
  lastUpdatedDate: string;

  // Step 4: Manual Payment Recording
  paymentDate: string;
  actualPaymentMethod?: string;
  paymentComment?: string;

  // Exception Resolution (if any)
  exceptionStatus: ExceptionStatus;
  exceptionResolvedBy?: string;
  exceptionResolutionDate?: string;
  exceptionResolutionExplanation?: string;
  exceptionSupportingReference?: string;

  // Return to App 2 tracking
  returnedToApp2?: boolean;
  returnedToApp2Date?: string;
  returnedToApp2By?: string;
  returnedToApp2Reason?: string;

  // Metadata & Audit
  importValidationErrors?: string[];

  // Computed due-date urgency fields
  computedDaysRemaining?: number | null;
  computedDueDateCategory?: DueDateCategory;
  computedMainStatus?: MainStatus;
}

export type DueDateCategory =
  | 'OVERDUE'
  | 'DUE TODAY'
  | 'URGENT – DUE WITHIN 5 DAYS'
  | 'DUE WITHIN 15 DAYS'
  | 'DUE WITHIN 30 DAYS'
  | 'DUE LATER'
  | 'NEEDS REVIEW';

export type MainStatus =
  | 'Paid'
  | 'Authorised – Ready for Manual Payment'
  | 'Rejected'
  | 'On Hold / Review Required'
  | 'Needs Review'
  | 'Overdue'
  | 'Due Today'
  | 'Urgent – Due Within 5 Days'
  | 'Due Within 15 Days'
  | 'Due Within 30 Days'
  | 'Due Later';

export type FilterViewTab =
  | 'ALL_IMPORTED'
  | 'OVERDUE'
  | 'DUE_TODAY'
  | 'DUE_WITHIN_5_DAYS'
  | 'DUE_WITHIN_15_DAYS'
  | 'DUE_WITHIN_30_DAYS'
  | 'DUE_LATER'
  | 'AWAITING_DEPT_APPROVAL'
  | 'BANK_VERIFICATION_REQ'
  | 'ON_HOLD_REVIEW_REQ'
  | 'ELIGIBLE_FOR_AUTH'
  | 'AUTHORISED_READY_PAYMENT'
  | 'PAID'
  | 'IMPORT_EXPORT'
  | 'AUDIT_LOGS'
  | 'RESPONSIBLE_USE'
  | 'SETTINGS';

export interface AuditLogEntry {
  id: string;
  timestamp: string; // YYYY-MM-DD HH:mm:ss format
  invoiceNumber: string;
  supplierName: string;
  action: string;
  user: string;
  details: string;
  statusAfter: string;
}

export interface UploadMetadata {
  filename: string;
  importDate: string;
  sourceSheet: string;
  detectedWorksheets: string[];
  totalRowsImported: number;
}

export interface DraftReviewData {
  draftType: 'PAYMENT_REMINDER' | 'EXCEPTION_FOLLOW_UP';
  recipient: string;
  subject: string;
  messageBody: string;
  invoiceNumber: string;
  supplierName: string;
  reasonForDraft: string;
  recommendedAction: string;
}

