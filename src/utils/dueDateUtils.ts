import { InvoiceRecord, DueDateCategory, MainStatus } from '../types';

/**
 * Formats current time or Date object as YYYY-MM-DD HH:mm:ss in Singapore local time.
 */
export function formatSingaporeTimestamp(dateInput?: Date | string | null): string {
  const d = dateInput ? (typeof dateInput === 'string' ? new Date(dateInput) : dateInput) : new Date();
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 19).replace('T', ' ');

  // Format explicitly as Singapore timezone (Asia/Singapore)
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

  const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(d);
  const partMap: Record<string, string> = {};
  parts.forEach(p => { partMap[p.type] = p.value; });

  const year = partMap.year || '2026';
  const month = partMap.month || '07';
  const day = partMap.day || '29';
  const hour = partMap.hour || '00';
  const minute = partMap.minute || '00';
  const second = partMap.second || '00';

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/**
 * Ensures calendar date string is formatted strictly as YYYY-MM-DD.
 */
export function formatCalendarDateString(dateInput?: string | null): string {
  const parsed = parseCalendarDate(dateInput);
  if (!parsed) return dateInput && dateInput !== 'Not stated' ? dateInput : 'Not stated';
  const y = String(parsed.year).padStart(4, '0');
  const m = String(parsed.month).padStart(2, '0');
  const d = String(parsed.day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Normalises date strings to local calendar date integers { year, month, day }.
 * Prevents timezone errors by avoiding full timestamp comparison.
 */
export function parseCalendarDate(dateInput: string | undefined | null): { year: number; month: number; day: number } | null {
  if (!dateInput || typeof dateInput !== 'string') return null;
  const trimmed = dateInput.trim();
  if (!trimmed || trimmed === 'Not stated' || trimmed === 'None' || trimmed === 'N/A' || trimmed === '') return null;

  // Check if it's an Excel serial date number (e.g. "45885" or "46000")
  if (/^\d{4,5}(\.\d+)?$/.test(trimmed)) {
    const serial = parseFloat(trimmed);
    if (!isNaN(serial) && serial > 1000 && serial < 100000) {
      // Excel date epoch is Dec 30, 1899
      const utcDays = Math.floor(serial - 25569);
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      return {
        year: dateInfo.getUTCFullYear(),
        month: dateInfo.getUTCMonth() + 1,
        day: dateInfo.getUTCDate()
      };
    }
  }

  // Try standard ISO YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year > 1900 && year < 2100) {
      return { year, month, day };
    }
  }

  // Try DD/MM/YYYY or MM/DD/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const first = parseInt(dmyMatch[1], 10);
    const second = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (year > 1900 && year < 2100) {
      // If first > 12, it MUST be DD/MM/YYYY
      if (first > 12 && second <= 12) {
        return { year, month: second, day: first };
      }
      // If second > 12, it MUST be MM/DD/YYYY
      if (second > 12 && first <= 12) {
        return { year, month: first, day: second };
      }
      // Otherwise assume DD/MM/YYYY (Singapore / UK accounting standard)
      if (first <= 31 && second <= 12) {
        return { year, month: second, day: first };
      }
    }
  }

  // Fallback to JS Date parser using UTC methods
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return {
      year: parsed.getFullYear(),
      month: parsed.getMonth() + 1,
      day: parsed.getDate()
    };
  }

  return null;
}

/**
 * Calculates exact Days Remaining = Due Date minus As-of Date using UTC midnight calendar days.
 */
export function calculateDaysRemaining(dueDateStr: string | undefined | null, asOfDateStr: string): number | null {
  const due = parseCalendarDate(dueDateStr);
  const asOf = parseCalendarDate(asOfDateStr);
  if (!due || !asOf) return null;

  const dueUtc = Date.UTC(due.year, due.month - 1, due.day);
  const asOfUtc = Date.UTC(asOf.year, asOf.month - 1, asOf.day);

  const diffMs = dueUtc - asOfUtc;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Maps Days Remaining into non-overlapping payment urgency categories.
 */
export function getDueDateCategory(daysRemaining: number | null): DueDateCategory {
  if (daysRemaining === null || daysRemaining === undefined || isNaN(daysRemaining)) {
    return 'NEEDS REVIEW';
  }
  if (daysRemaining < 0) return 'OVERDUE';
  if (daysRemaining === 0) return 'DUE TODAY';
  if (daysRemaining >= 1 && daysRemaining <= 5) return 'URGENT – DUE WITHIN 5 DAYS';
  if (daysRemaining >= 6 && daysRemaining <= 15) return 'DUE WITHIN 15 DAYS';
  if (daysRemaining >= 16 && daysRemaining <= 30) return 'DUE WITHIN 30 DAYS';
  return 'DUE LATER';
}

/**
 * Computes Main Status adhering strictly to the Status Hierarchy where financial controls override due date urgency.
 */
export function computeMainStatus(invoice: InvoiceRecord, dueDateCategory: DueDateCategory): MainStatus {
  if (invoice.paymentStatus === 'Paid') {
    return 'Paid';
  }
  if (invoice.authorisationStatus === 'Authorised' || invoice.paymentStatus === 'Authorised – Ready for Manual Payment') {
    return 'Authorised – Ready for Manual Payment';
  }
  if (
    invoice.paymentStatus === 'Rejected' ||
    invoice.authorisationStatus === 'Rejected' ||
    invoice.departmentApprovalStatus === 'Rejected' ||
    invoice.bankVerificationStatus === 'Rejected'
  ) {
    return 'Rejected';
  }
  if (
    invoice.paymentStatus === 'On Hold' ||
    invoice.exceptionStatus === 'Unresolved' ||
    invoice.authorisationStatus === 'Blocked' ||
    invoice.overallMatchStatus.toLowerCase().includes('mismatch') ||
    invoice.overallMatchStatus.toLowerCase().includes('duplicate') ||
    invoice.overallMatchStatus.toLowerCase().includes('damaged') ||
    invoice.overallMatchStatus.toLowerCase().includes('missing po') ||
    invoice.overallMatchStatus.toLowerCase().includes('review required') ||
    invoice.overallMatchStatus.toLowerCase().includes('on hold')
  ) {
    return 'On Hold / Review Required';
  }
  if (dueDateCategory === 'NEEDS REVIEW') return 'Needs Review';
  if (dueDateCategory === 'OVERDUE') return 'Overdue';
  if (dueDateCategory === 'DUE TODAY') return 'Due Today';
  if (dueDateCategory === 'URGENT – DUE WITHIN 5 DAYS') return 'Urgent – Due Within 5 Days';
  if (dueDateCategory === 'DUE WITHIN 15 DAYS') return 'Due Within 15 Days';
  if (dueDateCategory === 'DUE WITHIN 30 DAYS') return 'Due Within 30 Days';
  return 'Due Later';
}

/**
 * Formats Main Status with exception details if on hold.
 */
export function formatDetailedMainStatus(invoice: InvoiceRecord, dueDateCategory: DueDateCategory): string {
  const main = computeMainStatus(invoice, dueDateCategory);
  if (main === 'On Hold / Review Required') {
    let reason = 'Review Required';
    if (invoice.exceptionSummary && invoice.exceptionSummary !== 'None' && invoice.exceptionSummary !== '') {
      reason = invoice.exceptionSummary;
    } else if (!invoice.overallMatchStatus.toLowerCase().includes('match') && !invoice.overallMatchStatus.toLowerCase().includes('ok')) {
      reason = invoice.overallMatchStatus;
    }
    
    let urgencySub = '';
    if (dueDateCategory === 'OVERDUE') urgencySub = '. Overdue';
    else if (dueDateCategory === 'DUE TODAY') urgencySub = '. Due today';
    else if (dueDateCategory === 'URGENT – DUE WITHIN 5 DAYS') urgencySub = '. Due within 5 days';
    else if (dueDateCategory === 'DUE WITHIN 15 DAYS') urgencySub = '. Due within 15 days';
    else if (dueDateCategory === 'DUE WITHIN 30 DAYS') urgencySub = '. Due within 30 days';
    
    return `On Hold – ${reason}${urgencySub}`;
  }
  return main;
}

/**
 * Formats Days Remaining text for clear presentation.
 */
export function formatDaysRemainingDisplay(daysRemaining: number | null): string {
  if (daysRemaining === null || daysRemaining === undefined || isNaN(daysRemaining)) {
    return 'Not stated / Invalid';
  }
  if (daysRemaining < 0) {
    const absDays = Math.abs(daysRemaining);
    return `${daysRemaining} days — Overdue by ${absDays} ${absDays === 1 ? 'day' : 'days'}`;
  }
  if (daysRemaining === 0) {
    return '0 days — Due Today';
  }
  if (daysRemaining === 1) {
    return '1 day remaining';
  }
  return `${daysRemaining} days remaining`;
}

/**
 * Sort rank for default table sorting order.
 */
export function getSortRank(mainStatus: MainStatus): number {
  switch (mainStatus) {
    case 'Overdue': return 1;
    case 'Due Today': return 2;
    case 'Urgent – Due Within 5 Days': return 3;
    case 'Due Within 15 Days': return 4;
    case 'Due Within 30 Days': return 5;
    case 'Due Later': return 6;
    case 'Needs Review': return 6.5;
    case 'On Hold / Review Required': return 7;
    case 'Authorised – Ready for Manual Payment': return 8;
    case 'Paid': return 9;
    case 'Rejected': return 10;
    default: return 99;
  }
}

/**
 * Recommended Next Action for the Due-Date Details Panel.
 */
export function getRecommendedAction(invoice: InvoiceRecord, dueDateCategory: DueDateCategory): string {
  if (invoice.paymentStatus === 'Paid') {
    return 'No further action required. Payment completed.';
  }
  if (invoice.paymentStatus === 'Authorised – Ready for Manual Payment' || invoice.authorisationStatus === 'Authorised') {
    return 'Proceed to record manual bank payment details.';
  }
  const main = computeMainStatus(invoice, dueDateCategory);
  if (main === 'On Hold / Review Required') {
    return 'Resolve the stated exception before payment authorisation.';
  }
  if (dueDateCategory === 'OVERDUE') {
    return 'Review immediately. This invoice has passed its due date.';
  }
  if (dueDateCategory === 'DUE TODAY') {
    return 'Complete all remaining checks today.';
  }
  if (dueDateCategory === 'URGENT – DUE WITHIN 5 DAYS') {
    return 'Urgent: complete approval and bank verification immediately.';
  }
  if (dueDateCategory === 'DUE WITHIN 15 DAYS') {
    return 'Review the invoice and complete outstanding controls soon.';
  }
  if (dueDateCategory === 'DUE WITHIN 30 DAYS') {
    return 'Monitor and complete the required checks before the due date.';
  }
  if (dueDateCategory === 'NEEDS REVIEW') {
    return 'Obtain and verify missing or invalid invoice due date.';
  }
  return 'Normal monitoring. Complete required Gatekeeper controls when due date approaches.';
}
