import * as XLSX from 'xlsx';
import { InvoiceRecord, UploadMetadata, DepartmentApprovalStatus, BankVerificationStatus, ExceptionStatus, AuthorisationStatus, PaymentStatus } from '../types';

export const formatInvoiceTotal = (amount?: number | null, currency?: string): string => {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return 'Not stated';
  }
  const curr = currency && currency.trim() ? currency.trim() : 'SGD';
  const numStr = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  if (curr === '$') {
    return `$${numStr}`;
  }
  return `${curr} ${numStr}`;
};

export interface ParseExcelResult {
  success: boolean;
  error?: string;
  invoices: InvoiceRecord[];
  metadata: UploadMetadata;
}

const COLUMN_HEADERS_33 = [
  'Invoice Number',
  'Supplier Name',
  'PO Number',
  'GRN Number',
  'Invoice Amount',
  'Due Date',
  'Overall Match Status',
  'Exception Summary',
  'Exception Status',
  'Department Approval Status',
  'Department Approved By',
  'Department Approval Date',
  'Department Approval Comment',
  'Bank Details',
  'Bank Account Number',
  'Bank Verification Status',
  'Verified By',
  'Verification Date',
  'Verification Method',
  'Verification Comment',
  'Payment Status',
  'Authorisation Status',
  'Authorised By',
  'Authorisation Date and Time',
  'Authorisation Comment',
  'Payment Date',
  'Payment Reference',
  'Payment Comment',
  'Exception Resolved By',
  'Exception Resolution Date',
  'Exception Resolution Explanation',
  'Exception Supporting Reference',
  'Last Updated Date'
];

export async function parseExcelWorkbook(file: File): Promise<ParseExcelResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const detectedWorksheets = workbook.SheetNames;

        // Source-of-Truth Rule #1 & #2: Search for worksheet named exactly "App 3 Handoff"
        const targetSheetName = detectedWorksheets.find(name => name.trim().toLowerCase() === 'app 3 handoff') ||
                                detectedWorksheets.find(name => name.includes('App 3'));

        if (!targetSheetName) {
          return resolve({
            success: false,
            error: `Worksheet "App 3 Handoff" not found in the uploaded workbook. Detected worksheets: ${detectedWorksheets.join(', ')}. Per the Source-of-Truth rule, only the "App 3 Handoff" worksheet can be imported.`,
            invoices: [],
            metadata: {
              filename: file.name,
              importDate: new Date().toLocaleString(),
              sourceSheet: 'None',
              detectedWorksheets,
              totalRowsImported: 0
            }
          });
        }

        const worksheet = workbook.Sheets[targetSheetName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' });

        if (!rawRows || rawRows.length === 0) {
          return resolve({
            success: false,
            error: `The worksheet "${targetSheetName}" is empty.`,
            invoices: [],
            metadata: {
              filename: file.name,
              importDate: new Date().toLocaleString(),
              sourceSheet: targetSheetName,
              detectedWorksheets,
              totalRowsImported: 0
            }
          });
        }

        // Helper to convert serial dates or preserve clean calendar strings without timezone shift
        const cleanDateStr = (val: string): string => {
          if (!val || val === 'Not stated') return val;
          const trimmed = val.trim();
          if (/^\d{4,5}(\.\d+)?$/.test(trimmed)) {
            const serial = parseFloat(trimmed);
            if (!isNaN(serial) && serial > 1000 && serial < 100000) {
              const utcDays = Math.floor(serial - 25569);
              const utcValue = utcDays * 86400;
              const dateInfo = new Date(utcValue * 1000);
              const y = dateInfo.getUTCFullYear();
              const m = String(dateInfo.getUTCMonth() + 1).padStart(2, '0');
              const d = String(dateInfo.getUTCDate()).padStart(2, '0');
              return `${y}-${m}-${d}`;
            }
          }
          return trimmed;
        };

        // Map columns into PayGuard's 33 field schema
        const invoices: InvoiceRecord[] = rawRows.map((row, index) => {
          // Helper to get value by matching key names flexibly
          const getVal = (possibleKeys: string[]): string => {
            for (const key of possibleKeys) {
              const foundKey = Object.keys(row).find(k => k.trim().toLowerCase() === key.toLowerCase());
              if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') {
                return String(row[foundKey]).trim();
              }
            }
            return '';
          };

          const invoiceNumber = getVal(['Invoice Number', 'InvoiceNo', 'Invoice #', 'Invoice ID', 'ID']) || `IMP-${2026}-${index + 101}`;
          const supplierName = getVal(['Supplier Name', 'Supplier', 'Vendor Name', 'Vendor']) || 'Unknown Supplier';
          const poNumber = getVal(['PO Number(s)', 'PO Number', 'PO No', 'Purchase Order Number', 'PO Reference', 'PO #', 'PO']) || 'Not stated';
          const grnNumber = getVal(['GRN Number(s)', 'GRN Number', 'GRN No', 'Goods Received Note', 'Goods Received Note Number', 'Receipt Number', 'GRN #', 'Goods Receipt Note', 'GRN']) || 'Not stated';
          
          const rawCurrency = getVal(['Currency', 'Currency Code', 'Invoice Currency']);
          const rawAmountStr = getVal(['Invoice Total', 'Total Amount', 'Invoice Amount', 'Amount', 'Amount Payable', 'Gross Amount', 'Total', 'Val']);
          
          let cleanAmount = 0;
          let detectedCurrency = rawCurrency;

          if (rawAmountStr) {
            if (!detectedCurrency) {
              const codeMatch = rawAmountStr.match(/\b([A-Z]{3})\b/i);
              if (codeMatch) {
                detectedCurrency = codeMatch[1].toUpperCase();
              }
            }
            const cleanedNumStr = rawAmountStr
              .replace(/[A-Za-z]/g, '')
              .replace(/[$€£¥,]/g, '')
              .trim();
            const parsed = parseFloat(cleanedNumStr);
            if (!isNaN(parsed)) {
              cleanAmount = parsed;
            }
          }

          if (!detectedCurrency) {
            detectedCurrency = 'SGD';
          }
          
          const invoiceDate = cleanDateStr(getVal(['Invoice Date', 'Date', 'Inv Date'])) || 'Not stated';
          const dueDate = cleanDateStr(getVal(['Due Date', 'Payment Due Date', 'Due'])) || '2026-08-15';
          const overallMatchStatus = getVal(['Overall Match Status', 'Match Status', 'Status', 'App 2 Status']) || 'Matched – Awaiting Department Approval';
          const exceptionSummary = getVal(['Exception Summary', 'Exception', 'Discrepancy Note', 'Blocking Reason']) || 'None';
          
          let exceptionStatusVal = getVal(['Exception Status', 'Exception State']) as ExceptionStatus;
          if (!['None', 'Unresolved', 'Resolved', 'Rejected'].includes(exceptionStatusVal)) {
            exceptionStatusVal = exceptionSummary !== 'None' && exceptionSummary !== '' ? 'Unresolved' : 'None';
          }
          
          let deptStatusVal = getVal(['Department Approval Status', 'Dept Approval Status', 'Dept Approval']) as DepartmentApprovalStatus;
          if (!['Pending', 'Approved', 'Rejected'].includes(deptStatusVal)) {
            deptStatusVal = 'Pending';
          }
          
          let bankStatusVal = getVal(['Bank Verification Status', 'Bank Status', 'Verification Status']) as BankVerificationStatus;
          if (!['Not Verified', 'Verified', 'Rejected'].includes(bankStatusVal)) {
            bankStatusVal = 'Not Verified';
          }

          let authStatusVal = getVal(['Authorisation Status', 'Auth Status', 'Madam Lim Status']) as AuthorisationStatus;
          if (!['Pending', 'Authorised', 'Blocked', 'Rejected'].includes(authStatusVal)) {
            authStatusVal = overallMatchStatus.toLowerCase().includes('match') && exceptionStatusVal === 'None' ? 'Pending' : 'Blocked';
          }

          let paymentStatusVal = getVal(['Payment Status', 'Pay Status']) as PaymentStatus;
          if (!['Pending', 'Authorised – Ready for Manual Payment', 'Paid', 'On Hold', 'Rejected'].includes(paymentStatusVal)) {
            paymentStatusVal = authStatusVal === 'Authorised' ? 'Authorised – Ready for Manual Payment' : (authStatusVal === 'Blocked' ? 'On Hold' : 'Pending');
          }

          // Classify import validation errors / holds per requirements
          const importErrors: string[] = [];
          if (overallMatchStatus.toLowerCase().includes('mismatch') || 
              overallMatchStatus.toLowerCase().includes('duplicate') || 
              overallMatchStatus.toLowerCase().includes('damaged') ||
              overallMatchStatus.toLowerCase().includes('missing po') ||
              overallMatchStatus.toLowerCase().includes('review required') ||
              overallMatchStatus.toLowerCase().includes('on hold')) {
            importErrors.push(`App 2 Exception Hold: ${overallMatchStatus}`);
          }
          if (exceptionStatusVal === 'Unresolved') {
            if (!importErrors.some(e => e.includes('Exception'))) {
              importErrors.push(`Unresolved Exception: ${exceptionSummary}`);
            }
          }

          return {
            id: invoiceNumber,
            invoiceNumber,
            supplierName,
            poNumber,
            grnNumber,
            invoiceAmount: cleanAmount,
            invoiceTotal: cleanAmount,
            currency: detectedCurrency,
            invoiceDate,
            dueDate,
            overallMatchStatus,
            exceptionSummary,
            exceptionStatus: exceptionStatusVal,
            departmentApprovalStatus: deptStatusVal,
            departmentApprovedBy: getVal(['Department Approved By', 'Dept Approved By']),
            departmentApprovalDate: cleanDateStr(getVal(['Department Approval Date', 'Dept Approval Date'])),
            departmentApprovalComment: getVal(['Department Approval Comment', 'Dept Approval Comment']),
            bankDetails: getVal(['Bank Details', 'Bank Name', 'Bank']) || 'Standard Bank details on file',
            bankAccountNumber: getVal(['Bank Account Number', 'Account Number', 'Acct No']) || 'Not stated',
            acceptedPaymentMethod: getVal(['Accepted Payment Method', 'Payment Method', 'Accepted Method', 'Pay Method']) || 'Bank Transfer / GIRO',
            bankVerificationStatus: bankStatusVal,
            bankVerifiedBy: getVal(['Verified By', 'Bank Verified By']),
            bankVerificationDate: cleanDateStr(getVal(['Verification Date', 'Bank Verification Date'])),
            bankVerificationMethod: getVal(['Verification Method', 'Bank Verification Method']),
            bankVerificationComment: getVal(['Verification Comment', 'Bank Verification Comment']),
            paymentStatus: paymentStatusVal,
            authorisationStatus: authStatusVal,
            authorisedBy: getVal(['Authorised By', 'Madam Lim Authorised By']),
            authorisationDate: cleanDateStr(getVal(['Authorisation Date and Time', 'Authorisation Date', 'Auth Date'])),
            authorisationComment: getVal(['Authorisation Comment', 'Auth Comment']),
            paymentDate: cleanDateStr(getVal(['Payment Date', 'Paid Date'])),
            paymentReference: getVal(['Payment Reference', 'Transfer Reference', 'Ref No']),
            paymentComment: getVal(['Payment Comment', 'Paid Comment']),
            exceptionResolvedBy: getVal(['Exception Resolved By', 'Resolved By']),
            exceptionResolutionDate: cleanDateStr(getVal(['Exception Resolution Date', 'Resolution Date'])),
            exceptionResolutionExplanation: getVal(['Exception Resolution Explanation', 'Resolution Explanation']),
            exceptionSupportingReference: getVal(['Exception Supporting Reference', 'Supporting Reference', 'Supporting Ref']),
            lastUpdatedDate: cleanDateStr(getVal(['Last Updated Date', 'Updated Date'])) || new Date().toLocaleString(),
            importValidationErrors: importErrors
          };
        });

        resolve({
          success: true,
          invoices,
          metadata: {
            filename: file.name,
            importDate: new Date().toLocaleString(),
            sourceSheet: 'Uploaded Excel – App 3 Handoff',
            detectedWorksheets,
            totalRowsImported: invoices.length
          }
        });
      } catch (error: any) {
        resolve({
          success: false,
          error: `Failed to parse Excel file: ${error.message || error}`,
          invoices: [],
          metadata: {
            filename: file.name,
            importDate: new Date().toLocaleString(),
            sourceSheet: 'Error',
            detectedWorksheets: [],
            totalRowsImported: 0
          }
        });
      }
    };
    reader.onerror = () => {
      resolve({
        success: false,
        error: 'Failed to read file from disk.',
        invoices: [],
        metadata: {
          filename: file.name,
          importDate: new Date().toLocaleString(),
          sourceSheet: 'Error',
          detectedWorksheets: [],
          totalRowsImported: 0
        }
      });
    };
    reader.readAsArrayBuffer(file);
  });
}

export function exportUpdatedApp3Handoff(invoices: InvoiceRecord[], filename = 'Updated_App_3_Handoff.xlsx'): void {
  const exportRows = invoices.map(inv => ({
    'Invoice Number': inv.invoiceNumber,
    'Supplier Name': inv.supplierName,
    'PO Number': inv.poNumber,
    'GRN Number': inv.grnNumber,
    'Invoice Amount': `$${inv.invoiceAmount.toFixed(2)}`,
    'Due Date': inv.dueDate,
    'Overall Match Status': inv.overallMatchStatus,
    'Exception Summary': inv.exceptionSummary,
    'Exception Status': inv.exceptionStatus,
    'Department Approval Status': inv.departmentApprovalStatus,
    'Department Approved By': inv.departmentApprovedBy,
    'Department Approval Date': inv.departmentApprovalDate,
    'Department Approval Comment': inv.departmentApprovalComment,
    'Bank Details': inv.bankDetails,
    'Bank Account Number': inv.bankAccountNumber,
    'Bank Verification Status': inv.bankVerificationStatus,
    'Verified By': inv.bankVerifiedBy,
    'Verification Date': inv.bankVerificationDate,
    'Verification Method': inv.bankVerificationMethod,
    'Verification Comment': inv.bankVerificationComment,
    'Payment Status': inv.paymentStatus,
    'Authorisation Status': inv.authorisationStatus,
    'Authorised By': inv.authorisedBy,
    'Authorisation Date and Time': inv.authorisationDate,
    'Authorisation Comment': inv.authorisationComment,
    'Payment Date': inv.paymentDate,
    'Payment Reference': inv.paymentReference,
    'Payment Comment': inv.paymentComment,
    'Exception Resolved By': inv.exceptionResolvedBy,
    'Exception Resolution Date': inv.exceptionResolutionDate,
    'Exception Resolution Explanation': inv.exceptionResolutionExplanation,
    'Exception Supporting Reference': inv.exceptionSupportingReference,
    'Last Updated Date': inv.lastUpdatedDate || new Date().toLocaleString()
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows, { header: COLUMN_HEADERS_33 });
  
  // Set column widths for readability
  const colWidths = COLUMN_HEADERS_33.map(header => ({ wch: Math.max(header.length + 4, 15) }));
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'App 3 Handoff');

  XLSX.writeFile(workbook, filename);
}
