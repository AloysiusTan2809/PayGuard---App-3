import React, { useState, useEffect } from 'react';
import { InvoiceRecord, UploadMetadata, FilterViewTab, AuditLogEntry } from './types';
// Removed preloaded demo data per prompt requirements
import { exportUpdatedApp3Handoff } from './utils/excelUtils';
import { calculateDaysRemaining, getDueDateCategory, computeMainStatus } from './utils/dueDateUtils';
import { checkAuthorisationEligibility } from './utils/authorisationUtils';
import { Header } from './components/Header';
import { MandatoryTestBanner } from './components/MandatoryTestBanner';
import { SummaryCards } from './components/SummaryCards';
import { NavigationTabs } from './components/NavigationTabs';
import { InvoiceTable } from './components/InvoiceTable';
import { ReviewModal } from './components/ReviewModal';
import { UploadModal } from './components/UploadModal';
import { AuditLogView } from './components/AuditLogView';
import { UrgentWarningSection } from './components/UrgentWarningSection';
import { DueDateCheckModal } from './components/DueDateCheckModal';
import { ShieldCheck, Layers, Sparkles } from 'lucide-react';

const emptyUploadMetadata: UploadMetadata = {
  filename: 'None',
  importDate: 'N/A',
  sourceSheet: 'No data uploaded',
  detectedWorksheets: [],
  totalRowsImported: 0
};

export function App() {
  // Application starts with an entirely empty invoice database per prompt requirements
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [metadata, setMetadata] = useState<UploadMetadata>(emptyUploadMetadata);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Due-Date System & Demo Mode state
  const [asOfDate, setAsOfDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [isDemoDateMode, setIsDemoDateMode] = useState<boolean>(false);
  const [isDueDateCheckOpen, setIsDueDateCheckOpen] = useState<boolean>(false);

  // Clear any old stored data on boot so nothing is automatically restored per prompt requirement
  useEffect(() => {
    localStorage.removeItem('payguard_app3_invoices');
    localStorage.removeItem('payguard_upload_meta');
    localStorage.removeItem('payguard_audit_logs');
  }, []);

  const [activeTab, setActiveTab] = useState<FilterViewTab>('ALL_IMPORTED');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewSection, setReviewSection] = useState<'OVERVIEW' | 'DEPT_APPROVAL' | 'BANK_VERIFICATION' | 'EXCEPTION_RESOLVE' | 'AUTHORISE' | 'MANUAL_PAYMENT'>('OVERVIEW');
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Persist state changes
  useEffect(() => {
    localStorage.setItem('payguard_app3_invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('payguard_upload_meta', JSON.stringify(metadata));
  }, [metadata]);

  useEffect(() => {
    localStorage.setItem('payguard_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  // Update an individual invoice record and create audit trail entry
  const handleUpdateInvoice = (updatedInvoice: InvoiceRecord, auditAction: string, auditDetails: string) => {
    setInvoices(prev => prev.map(inv => (inv.id === updatedInvoice.id ? updatedInvoice : inv)));

    const newLog: AuditLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toLocaleString(),
      invoiceNumber: updatedInvoice.invoiceNumber,
      supplierName: updatedInvoice.supplierName,
      action: auditAction,
      user: 'Madam Lim (AP Lead)',
      details: auditDetails,
      statusAfter: updatedInvoice.paymentStatus === 'Paid' 
        ? 'Paid' 
        : updatedInvoice.authorisationStatus === 'Authorised' 
        ? 'Authorised – Ready for Manual Payment' 
        : updatedInvoice.departmentApprovalStatus === 'Approved' && updatedInvoice.bankVerificationStatus === 'Verified'
        ? 'Eligible / Ready'
        : updatedInvoice.paymentStatus || 'Updated'
    };

    setAuditLogs(prev => [newLog, ...prev]);
    setSelectedInvoice(updatedInvoice);
  };

  // Handle importing a new workbook (only App 3 Handoff)
  const handleConfirmImport = (importedInvoices: InvoiceRecord[], uploadMeta: UploadMetadata) => {
    setInvoices(importedInvoices);
    setMetadata(uploadMeta);
    setActiveTab('ALL_IMPORTED');

    const importLog: AuditLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleString(),
      invoiceNumber: `BATCH (${importedInvoices.length} rows)`,
      supplierName: 'Excel Import',
      action: 'Uploaded Excel – App 3 Handoff Imported',
      user: 'Madam Lim (AP Lead)',
      details: `Imported ${importedInvoices.length} invoices from worksheet "${uploadMeta.sourceSheet}". Worksheets Match Results, Exception Log, and Input & Extraction Log skipped per protocol.`,
      statusAfter: 'Imported'
    };
    setAuditLogs(prev => [importLog, ...prev]);
  };

  // Clear all imported data and return application to empty starting state
  const handleClearData = () => {
    setInvoices([]);
    setMetadata(emptyUploadMetadata);
    setAuditLogs([]);
    setActiveTab('ALL_IMPORTED');
    setSelectedInvoice(null);
    localStorage.removeItem('payguard_app3_invoices');
    localStorage.removeItem('payguard_upload_meta');
    localStorage.removeItem('payguard_audit_logs');
  };

  // Export updated App 3 Handoff Excel worksheet
  const handleExportExcel = () => {
    exportUpdatedApp3Handoff(invoices, `Updated_${metadata.filename || 'App_3_Handoff.xlsx'}`);
    const exportLog: AuditLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleString(),
      invoiceNumber: `ALL (${invoices.length})`,
      supplierName: 'Excel Export',
      action: 'Exported Updated App 3 Handoff',
      user: 'Madam Lim (AP Lead)',
      details: `Downloaded updated Excel file with 33 columns including dept approval, bank verification, authorisation, and payment records.`,
      statusAfter: 'Exported'
    };
    setAuditLogs(prev => [exportLog, ...prev]);
  };

  // Toggle Demo Date Mode
  const handleToggleDemoMode = () => {
    const nextMode = !isDemoDateMode;
    setIsDemoDateMode(nextMode);
    if (!nextMode) {
      // Reset As-of Date back to today
      const today = new Date().toISOString().split('T')[0];
      setAsOfDate(today);
      const log: AuditLogEntry = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleString(),
        invoiceNumber: 'ALL',
        supplierName: 'System Control',
        action: 'Demo Date Mode Disabled',
        user: 'Madam Lim (AP Lead)',
        details: `Reset active As-of Date to current local calendar date (${today}).`,
        statusAfter: 'Normal Mode'
      };
      setAuditLogs(prev => [log, ...prev]);
    } else {
      const log: AuditLogEntry = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleString(),
        invoiceNumber: 'ALL',
        supplierName: 'System Control',
        action: 'Demo Date Mode Enabled',
        user: 'Madam Lim (AP Lead)',
        details: `Enabled simulated date testing mode. Active As-of Date set to ${asOfDate}.`,
        statusAfter: 'Demo Mode'
      };
      setAuditLogs(prev => [log, ...prev]);
    }
  };

  // Run Due-Date Check feature
  const handleRunDueDateCheck = () => {
    setIsDueDateCheckOpen(true);
    const log: AuditLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleString(),
      invoiceNumber: `BATCH (${invoices.length} rows)`,
      supplierName: 'Due-Date Engine',
      action: 'Run Due-Date Check Executed',
      user: 'Madam Lim (AP Lead)',
      details: `Recalculated urgency categories against As-of Date ${asOfDate}. Generated reminder drafts and exception follow-ups.`,
      statusAfter: 'Checked'
    };
    setAuditLogs(prev => [log, ...prev]);
  };

  // Open Review Panel for an invoice
  const handleOpenReview = (
    inv: InvoiceRecord, 
    initialSection: 'OVERVIEW' | 'DEPT_APPROVAL' | 'BANK_VERIFICATION' | 'EXCEPTION_RESOLVE' | 'AUTHORISE' | 'MANUAL_PAYMENT' = 'OVERVIEW'
  ) => {
    setSelectedInvoice(inv);
    setReviewSection(initialSection);
    setIsReviewOpen(true);
  };

  // Open mandatory test case AA-2026-208 directly
  const handleOpenTestInvoice = (inv: InvoiceRecord) => {
    handleOpenReview(inv, 'OVERVIEW');
  };

  // Active eligible subset for due-date category tab counting (excludes Paid, Rejected, and On-Hold)
  const activeEligible = invoices.filter(i => {
    if (i.paymentStatus === 'Paid' || i.paymentStatus === 'Rejected' || i.authorisationStatus === 'Rejected') return false;
    const days = calculateDaysRemaining(i.dueDate, asOfDate);
    const cat = getDueDateCategory(days);
    const main = computeMainStatus(i, cat);
    return main !== 'On Hold / Review Required';
  });

  // Calculate tab counts
  const counts: Record<FilterViewTab, number> = {
    ALL_IMPORTED: invoices.length,
    OVERDUE: activeEligible.filter(i => getDueDateCategory(calculateDaysRemaining(i.dueDate, asOfDate)) === 'OVERDUE').length,
    DUE_TODAY: activeEligible.filter(i => getDueDateCategory(calculateDaysRemaining(i.dueDate, asOfDate)) === 'DUE TODAY').length,
    DUE_WITHIN_5_DAYS: activeEligible.filter(i => getDueDateCategory(calculateDaysRemaining(i.dueDate, asOfDate)) === 'URGENT – DUE WITHIN 5 DAYS').length,
    DUE_WITHIN_15_DAYS: activeEligible.filter(i => getDueDateCategory(calculateDaysRemaining(i.dueDate, asOfDate)) === 'DUE WITHIN 15 DAYS').length,
    DUE_WITHIN_30_DAYS: activeEligible.filter(i => getDueDateCategory(calculateDaysRemaining(i.dueDate, asOfDate)) === 'DUE WITHIN 30 DAYS').length,
    DUE_LATER: activeEligible.filter(i => {
      const cat = getDueDateCategory(calculateDaysRemaining(i.dueDate, asOfDate));
      return cat === 'DUE LATER' || cat === 'NEEDS REVIEW';
    }).length,
    AWAITING_DEPT_APPROVAL: invoices.filter(i => 
      i.overallMatchStatus.toLowerCase().includes('match') && 
      i.departmentApprovalStatus === 'Pending' && 
      i.exceptionStatus === 'None' &&
      i.paymentStatus !== 'On Hold' &&
      i.authorisationStatus !== 'Blocked'
    ).length,
    BANK_VERIFICATION_REQ: invoices.filter(i => i.bankVerificationStatus === 'Not Verified').length,
    ON_HOLD_REVIEW_REQ: invoices.filter(i => {
      const days = calculateDaysRemaining(i.dueDate, asOfDate);
      const cat = getDueDateCategory(days);
      return computeMainStatus(i, cat) === 'On Hold / Review Required';
    }).length,
    ELIGIBLE_FOR_AUTH: invoices.filter(i => checkAuthorisationEligibility(i).canAuthorise).length,
    AUTHORISED_READY_PAYMENT: invoices.filter(i => i.paymentStatus === 'Authorised – Ready for Manual Payment' || (i.authorisationStatus === 'Authorised' && i.paymentStatus !== 'Paid')).length,
    PAID: invoices.filter(i => i.paymentStatus === 'Paid').length,
    AUDIT_LOGS: auditLogs.length,
    IMPORT_EXPORT: 0,
    RESPONSIBLE_USE: 0,
    SETTINGS: 0
  };

  // Filter invoices for current tab
  const getFilteredInvoices = (): InvoiceRecord[] => {
    switch (activeTab) {
      case 'ALL_IMPORTED':
        return invoices;
      case 'OVERDUE':
        return activeEligible.filter(i => getDueDateCategory(calculateDaysRemaining(i.dueDate, asOfDate)) === 'OVERDUE');
      case 'DUE_TODAY':
        return activeEligible.filter(i => getDueDateCategory(calculateDaysRemaining(i.dueDate, asOfDate)) === 'DUE TODAY');
      case 'DUE_WITHIN_5_DAYS':
        return activeEligible.filter(i => getDueDateCategory(calculateDaysRemaining(i.dueDate, asOfDate)) === 'URGENT – DUE WITHIN 5 DAYS');
      case 'DUE_WITHIN_15_DAYS':
        return activeEligible.filter(i => getDueDateCategory(calculateDaysRemaining(i.dueDate, asOfDate)) === 'DUE WITHIN 15 DAYS');
      case 'DUE_WITHIN_30_DAYS':
        return activeEligible.filter(i => getDueDateCategory(calculateDaysRemaining(i.dueDate, asOfDate)) === 'DUE WITHIN 30 DAYS');
      case 'DUE_LATER':
        return activeEligible.filter(i => {
          const cat = getDueDateCategory(calculateDaysRemaining(i.dueDate, asOfDate));
          return cat === 'DUE LATER' || cat === 'NEEDS REVIEW';
        });
      case 'AWAITING_DEPT_APPROVAL':
        return invoices.filter(i => 
          i.overallMatchStatus.toLowerCase().includes('match') && 
          i.departmentApprovalStatus === 'Pending' && 
          i.exceptionStatus === 'None' &&
          i.paymentStatus !== 'On Hold' &&
          i.authorisationStatus !== 'Blocked'
        );
      case 'BANK_VERIFICATION_REQ':
        return invoices.filter(i => i.bankVerificationStatus === 'Not Verified');
      case 'ON_HOLD_REVIEW_REQ':
        return invoices.filter(i => {
          const days = calculateDaysRemaining(i.dueDate, asOfDate);
          const cat = getDueDateCategory(days);
          return computeMainStatus(i, cat) === 'On Hold / Review Required';
        });
      case 'ELIGIBLE_FOR_AUTH':
        return invoices.filter(i => {
          const isMatched = i.overallMatchStatus.toLowerCase().startsWith('match') || i.overallMatchStatus.toLowerCase().includes('pass');
          const noException = i.exceptionStatus !== 'Unresolved' && i.paymentStatus !== 'On Hold';
          const deptOk = i.departmentApprovalStatus === 'Approved';
          const bankOk = i.bankVerificationStatus === 'Verified';
          const notDone = i.authorisationStatus !== 'Authorised' && i.paymentStatus !== 'Paid';
          return isMatched && noException && deptOk && bankOk && notDone;
        });
      case 'AUTHORISED_READY_PAYMENT':
        return invoices.filter(i => i.paymentStatus === 'Authorised – Ready for Manual Payment' || (i.authorisationStatus === 'Authorised' && i.paymentStatus !== 'Paid'));
      case 'PAID':
        return invoices.filter(i => i.paymentStatus === 'Paid');
      default:
        return invoices;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Clean White Professional Accounting Header */}
      <Header
        metadata={metadata}
        onOpenUploadModal={() => setIsUploadOpen(true)}
        onExportExcel={handleExportExcel}
        onClearData={handleClearData}
        asOfDate={asOfDate}
        isDemoDateMode={isDemoDateMode}
        onToggleDemoMode={handleToggleDemoMode}
        onChangeAsOfDate={setAsOfDate}
        onRunDueDateCheck={handleRunDueDateCheck}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Mandatory Test Case Banner (AA-2026-208) - only rendered if data is uploaded */}
        {invoices.length > 0 && (
          <MandatoryTestBanner
            invoices={invoices}
            onOpenTestInvoice={handleOpenTestInvoice}
          />
        )}

        {/* Separate Urgent 5-Day Warning Dashboard Section per Requirement 3 & 6 */}
        {invoices.length > 0 && (
          <UrgentWarningSection
            invoices={invoices}
            asOfDate={asOfDate}
            onReviewUrgent={() => setActiveTab('DUE_WITHIN_5_DAYS')}
            onOpenReview={(inv) => handleOpenReview(inv, 'OVERVIEW')}
          />
        )}

        {/* Statistical Summary Cards */}
        <SummaryCards
          invoices={invoices}
          activeCategory={activeTab}
          onSelectCategory={(cat) => setActiveTab(cat as FilterViewTab)}
          asOfDate={asOfDate}
        />

        {/* Navigation Tabs */}
        <NavigationTabs
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          counts={counts}
        />

        {/* Main Tab View (Invoices Table or Audit Log) */}
        {invoices.length === 0 ? (
          <InvoiceTable
            invoices={[]}
            totalInvoicesCount={0}
            onOpenReview={handleOpenReview}
            onOpenUploadModal={() => setIsUploadOpen(true)}
            asOfDate={asOfDate}
            activeTab={activeTab}
          />
        ) : activeTab === 'AUDIT_LOGS' ? (
          <AuditLogView logs={auditLogs} />
        ) : (
          <InvoiceTable
            invoices={getFilteredInvoices()}
            totalInvoicesCount={invoices.length}
            onOpenReview={handleOpenReview}
            onOpenUploadModal={() => setIsUploadOpen(true)}
            emptyMessage={`No invoices found in tab "${activeTab.replace(/_/g, ' ')}".`}
            asOfDate={asOfDate}
            activeTab={activeTab}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-300 py-6 mt-12 text-center text-xs text-slate-600 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span className="font-extrabold text-slate-900">PayGuard — App 3 Gatekeeper</span>
            <span>• Hardware Company Accounts Payable Control Suite</span>
          </div>
          <div className="text-slate-500 font-medium">
            Source-of-Truth Rule enforced: Only <strong className="text-slate-800">“App 3 Handoff”</strong> worksheet is processed.
          </div>
        </div>
      </footer>

      {/* Review Modal Panel for Madam Lim */}
      <ReviewModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        invoice={selectedInvoice}
        onUpdateInvoice={handleUpdateInvoice}
        initialSection={reviewSection}
        asOfDate={asOfDate}
      />

      {/* Upload Excel Workbook Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onConfirmImport={handleConfirmImport}
      />

      {/* Due-Date Check Modal & Reminder Draft Generator */}
      <DueDateCheckModal
        isOpen={isDueDateCheckOpen}
        onClose={() => setIsDueDateCheckOpen(false)}
        invoices={invoices}
        asOfDate={asOfDate}
        isDemoDateMode={isDemoDateMode}
        onSelectCategory={(tab) => setActiveTab(tab)}
        onRecordAudit={(action, details) => {
          const log: AuditLogEntry = {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            timestamp: new Date().toLocaleString(),
            invoiceNumber: 'BATCH',
            supplierName: 'Due-Date Engine',
            action,
            user: 'Madam Lim (AP Lead)',
            details,
            statusAfter: 'Checked'
          };
          setAuditLogs(prev => [log, ...prev]);
        }}
      />

    </div>
  );
}

export default App;
