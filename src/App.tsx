import React, { useState, useEffect, useRef, useCallback } from 'react';
import { InvoiceRecord, UploadMetadata, FilterViewTab, AuditLogEntry, UserRole } from './types';
import { exportUpdatedApp3Handoff } from './utils/excelUtils';
import { calculateDaysRemaining, getDueDateCategory, computeMainStatus } from './utils/dueDateUtils';
import { checkAuthorisationEligibility, checkSupplierBankAccountChange, formatSingaporeTimestamp } from './utils/authorisationUtils';
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
import { SecurityControlCentre } from './components/SecurityControlCentre';
import { AuthorisationReceiptModal } from './components/AuthorisationReceiptModal';
import { AuthorisationModal } from './components/AuthorisationModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginScreen } from './components/LoginScreen';
import { InactivityWarningModal } from './components/InactivityWarningModal';
import { AuthenticatedUser } from './services/authService';
import { ShieldCheck } from 'lucide-react';

const emptyUploadMetadata: UploadMetadata = {
  filename: 'None',
  importDate: 'N/A',
  sourceSheet: 'No data uploaded',
  detectedWorksheets: [],
  totalRowsImported: 0
};

// Inactivity limits: Warning at 4.5 minutes (270s), Auto-logout at 5 minutes (300s)
const INACTIVITY_WARNING_MS = 270 * 1000;
const INACTIVITY_LOGOUT_MS = 300 * 1000;

export function App() {
  // Authentication & Session State
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);

  // Application Invoices, Metadata & Audit Logs — loaded from localStorage if present
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(() => {
    try {
      const saved = localStorage.getItem('payguard_app3_invoices');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [metadata, setMetadata] = useState<UploadMetadata>(() => {
    try {
      const saved = localStorage.getItem('payguard_upload_meta');
      return saved ? JSON.parse(saved) : emptyUploadMetadata;
    } catch {
      return emptyUploadMetadata;
    }
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem('payguard_audit_logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Session Inactivity Tracking
  const lastActivityRef = useRef<number>(Date.now());
  const [showInactivityModal, setShowInactivityModal] = useState(false);
  const [inactivitySecondsLeft, setInactivitySecondsLeft] = useState(30);

  // Receipt Modal State
  const [receiptInvoice, setReceiptInvoice] = useState<InvoiceRecord | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Authorisation Modal State
  const [isAuthorisationModalOpen, setIsAuthorisationModalOpen] = useState(false);

  // Due-Date System & Demo Mode state
  const [asOfDate, setAsOfDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [isDemoDateMode, setIsDemoDateMode] = useState<boolean>(false);
  const [isDueDateCheckOpen, setIsDueDateCheckOpen] = useState<boolean>(false);

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

  // Helper to append security or action audit log
  const handleRecordAudit = useCallback((
    action: string,
    userIdentifier: string,
    userRole: string,
    details: string,
    invoiceNumber?: string,
    supplierName?: string,
    statusAfter?: string
  ) => {
    const newLog: AuditLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: formatSingaporeTimestamp(),
      invoiceNumber: invoiceNumber || 'SYSTEM',
      supplierName: supplierName || 'System Security',
      action,
      user: userIdentifier,
      role: userRole,
      details,
      statusAfter: statusAfter || 'Logged'
    };
    setAuditLogs(prev => [newLog, ...prev]);
  }, []);

  // Track User Activity for Inactivity Auto-Logout
  const resetActivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showInactivityModal) {
      setShowInactivityModal(false);
    }
  }, [showInactivityModal]);

  useEffect(() => {
    if (!currentUser) return;

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const handleUserActivity = () => {
      lastActivityRef.current = Date.now();
    };

    events.forEach(evt => window.addEventListener(evt, handleUserActivity));

    // Periodic timer to check session elapsed time
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= INACTIVITY_LOGOUT_MS) {
        // Automatic logout due to inactivity
        const userName = currentUser.name;
        const userRole = currentUser.role;

        handleRecordAudit(
          'Session Expired (Inactivity)',
          userName,
          userRole,
          'Automatic security sign-out triggered due to 5 minutes of inactivity.'
        );

        setCurrentUser(null);
        setShowInactivityModal(false);
      } else if (elapsed >= INACTIVITY_WARNING_MS) {
        // Show 30-second warning countdown
        const remaining = Math.max(0, Math.ceil((INACTIVITY_LOGOUT_MS - elapsed) / 1000));
        setInactivitySecondsLeft(remaining);
        setShowInactivityModal(true);
      } else {
        if (showInactivityModal) {
          setShowInactivityModal(false);
        }
      }
    }, 1000);

    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleUserActivity));
      clearInterval(interval);
    };
  }, [currentUser, showInactivityModal, handleRecordAudit]);

  // Login handler
  const handleLoginSuccess = (authenticatedUser: AuthenticatedUser) => {
    setCurrentUser(authenticatedUser);
    lastActivityRef.current = Date.now();

    handleRecordAudit(
      'Successful Login',
      authenticatedUser.name,
      authenticatedUser.role,
      `User "${authenticatedUser.name}" signed into PayGuard as ${authenticatedUser.role}. (ID: ${authenticatedUser.username})`
    );
  };

  // Sign out handler
  const handleSignOut = () => {
    if (currentUser) {
      handleRecordAudit(
        'User Signed Out',
        currentUser.name,
        currentUser.role,
        `User "${currentUser.name}" manually signed out of PayGuard.`
      );
    }
    setCurrentUser(null);
    setShowInactivityModal(false);
  };

  // Update an individual invoice record and create audit trail entry
  const handleUpdateInvoice = (updatedInvoice: InvoiceRecord, auditAction: string, auditDetails: string) => {
    setInvoices(prev => prev.map(inv => (inv.id === updatedInvoice.id ? updatedInvoice : inv)));

    const userName = currentUser ? currentUser.name : 'Unknown User';
    const userRole = currentUser ? currentUser.role : 'Unauthenticated';

    const statusAfter = updatedInvoice.paymentStatus === 'Paid' 
      ? 'Paid' 
      : updatedInvoice.authorisationStatus === 'Authorised' 
      ? 'Authorised – Ready for Manual Payment' 
      : updatedInvoice.departmentApprovalStatus === 'Approved' && updatedInvoice.bankVerificationStatus === 'Verified'
      ? 'Eligible / Ready'
      : updatedInvoice.paymentStatus || 'Updated';

    handleRecordAudit(
      auditAction,
      userName,
      userRole,
      auditDetails,
      updatedInvoice.invoiceNumber,
      updatedInvoice.supplierName,
      statusAfter
    );

    setSelectedInvoice(updatedInvoice);
  };

  // Handle importing a new workbook (only App 3 Handoff)
  const handleConfirmImport = (importedInvoices: InvoiceRecord[], uploadMeta: UploadMetadata) => {
    setInvoices(importedInvoices);
    setMetadata(uploadMeta);
    setActiveTab('ALL_IMPORTED');

    const userName = currentUser ? currentUser.name : 'Unknown User';
    const userRole = currentUser ? currentUser.role : 'Unauthenticated';

    handleRecordAudit(
      'Uploaded Excel – App 3 Handoff Imported',
      userName,
      userRole,
      `Imported ${importedInvoices.length} invoices from worksheet "${uploadMeta.sourceSheet}". Worksheets Match Results, Exception Log, and Input & Extraction Log skipped per protocol.`,
      `BATCH (${importedInvoices.length} rows)`,
      'Excel Import',
      'Imported'
    );
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
    
    const userName = currentUser ? currentUser.name : 'Unknown User';
    const userRole = currentUser ? currentUser.role : 'Unauthenticated';

    handleRecordAudit(
      'Exported Updated App 3 Handoff',
      userName,
      userRole,
      `Downloaded updated Excel file with 33 columns including dept approval, bank verification, authorisation, and payment records.`,
      `ALL (${invoices.length})`,
      'Excel Export',
      'Exported'
    );
  };

  // Toggle Demo Date Mode
  const handleToggleDemoMode = () => {
    const nextMode = !isDemoDateMode;
    setIsDemoDateMode(nextMode);
    const userName = currentUser ? currentUser.name : 'Unknown User';
    const userRole = currentUser ? currentUser.role : 'Unauthenticated';

    if (!nextMode) {
      const today = new Date().toISOString().split('T')[0];
      setAsOfDate(today);
      handleRecordAudit(
        'Demo Date Mode Disabled',
        userName,
        userRole,
        `Reset active As-of Date to current local calendar date (${today}).`,
        'ALL',
        'System Control',
        'Normal Mode'
      );
    } else {
      handleRecordAudit(
        'Demo Date Mode Enabled',
        userName,
        userRole,
        `Enabled simulated date testing mode. Active As-of Date set to ${asOfDate}.`,
        'ALL',
        'System Control',
        'Demo Mode'
      );
    }
  };

  // Run Due-Date Check feature
  const handleRunDueDateCheck = () => {
    setIsDueDateCheckOpen(true);
    const userName = currentUser ? currentUser.name : 'Unknown User';
    const userRole = currentUser ? currentUser.role : 'Unauthenticated';

    handleRecordAudit(
      'Run Due-Date Check Executed',
      userName,
      userRole,
      `Recalculated urgency categories against As-of Date ${asOfDate}. Generated reminder drafts and exception follow-ups.`,
      `BATCH (${invoices.length} rows)`,
      'Due-Date Engine',
      'Checked'
    );
  };

  // Open Review Panel for an invoice
  const handleOpenReview = (
    inv: InvoiceRecord | null, 
    initialSection: 'OVERVIEW' | 'DEPT_APPROVAL' | 'BANK_VERIFICATION' | 'EXCEPTION_RESOLVE' | 'AUTHORISE' | 'MANUAL_PAYMENT' = 'OVERVIEW'
  ) => {
    if (!inv) {
      handleRecordAudit(
        'Authorisation Screen Error',
        currentUser?.name || 'Madam Lim',
        currentUser?.role || 'AP Lead – Madam Lim',
        'Missing selectedInvoice when attempting to open invoice review. Confirmation: No invoice status was changed.',
        'N/A',
        'System',
        'Unchanged'
      );
      setSelectedInvoice(null);
      return;
    }

    setSelectedInvoice(inv);
    if (initialSection === 'AUTHORISE') {
      setIsAuthorisationModalOpen(true);
    } else {
      setReviewSection(initialSection);
      setIsReviewOpen(true);
    }
  };

  // Dedicated Handler for opening Security Authorisation Modal
  const handleOpenAuthorisationModal = (inv: InvoiceRecord | null) => {
    if (!inv) {
      handleRecordAudit(
        'Authorisation Screen Error',
        currentUser?.name || 'Madam Lim',
        currentUser?.role || 'AP Lead – Madam Lim',
        'Missing selectedInvoice when opening authorisation modal. Confirmation: No invoice status was changed.',
        'N/A',
        'System',
        'Unchanged'
      );
      setSelectedInvoice(null);
      setIsAuthorisationModalOpen(true);
      return;
    }

    setSelectedInvoice(inv);
    setIsAuthorisationModalOpen(true);
  };

  // Open mandatory test case CHT-2026-204 directly
  const handleOpenTestInvoice = (inv: InvoiceRecord) => {
    handleOpenReview(inv, 'OVERVIEW');
  };

  // IF NOT AUTHENTICATED: Show Login Screen FIRST (No data visible before sign in)
  if (!currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        onRecordAudit={handleRecordAudit}
      />
    );
  }

  // Active eligible subset for due-date category tab counting (excludes Paid, Rejected, and On-Hold)
  const activeEligible = invoices.filter(i => {
    if (i.paymentStatus === 'Paid' || i.paymentStatus === 'Rejected' || i.authorisationStatus === 'Rejected') return false;
    const days = calculateDaysRemaining(i.dueDate, asOfDate);
    const cat = getDueDateCategory(days);
    const main = computeMainStatus(i, cat);
    return main !== 'On Hold / Review Required';
  });

  // Calculate Security & Control Centre events count
  const bankChangedCount = invoices.filter(i => checkSupplierBankAccountChange(i, invoices).hasChanged || i.bankAccountChanged).length;
  const sodCount = auditLogs.filter(l => l.action.includes('Segregation-of-Duties') || l.details.includes('Segregation-of-Duties') || l.action.includes('SoD')).length;
  const dupAuthCount = auditLogs.filter(l => l.action.includes('Duplicate Action Blocked') || l.action.includes('Duplicate Authorisation')).length;
  const dupPayCount = auditLogs.filter(l => l.action.includes('Duplicate Payment Reference')).length;
  const securityEventsCount = bankChangedCount + sodCount + dupAuthCount + dupPayCount;

  // Calculate tab counts
  const counts: Record<FilterViewTab, number> = {
    ALL_IMPORTED: invoices.length,
    SECURITY_CENTRE: securityEventsCount,
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
        return invoices.filter(i => checkAuthorisationEligibility(i).canAuthorise);
      case 'AUTHORISED_READY_PAYMENT':
        return invoices.filter(i => i.paymentStatus === 'Authorised – Ready for Manual Payment' || (i.authorisationStatus === 'Authorised' && i.paymentStatus !== 'Paid'));
      case 'PAID':
        return invoices.filter(i => i.paymentStatus === 'Paid');
      default:
        return invoices;
    }
  };

  return (
    <ErrorBoundary
      onReset={() => setIsAuthorisationModalOpen(false)}
      onReturnToDashboard={() => {
        setIsAuthorisationModalOpen(false);
        setIsReviewOpen(false);
      }}
    >
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
        
        {/* Session Inactivity Warning Modal */}
        <InactivityWarningModal
          isOpen={showInactivityModal}
          secondsRemaining={inactivitySecondsLeft}
          onExtendSession={resetActivityTimer}
          onSignOut={handleSignOut}
        />

        {/* Header */}
        <Header
          metadata={metadata}
          onOpenUploadModal={() => setIsUploadOpen(true)}
          onExportExcel={handleExportExcel}
          onStartNewDatasetModal={handleClearData}
          asOfDate={asOfDate}
          isDemoDateMode={isDemoDateMode}
          onToggleDemoMode={handleToggleDemoMode}
          onChangeAsOfDate={setAsOfDate}
          onRunDueDateCheck={handleRunDueDateCheck}
          currentUser={currentUser}
          onSignOut={handleSignOut}
        />

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          
          {/* Mandatory Test Case Banner (CHT-2026-204) */}
          {invoices.length > 0 && (
            <MandatoryTestBanner
              invoices={invoices}
              onOpenTestInvoice={handleOpenTestInvoice}
            />
          )}

          {/* Separate Urgent 5-Day Warning Dashboard Section */}
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

          {/* Main Tab View */}
          {activeTab === 'SECURITY_CENTRE' ? (
            <SecurityControlCentre
              invoices={invoices}
              auditLogs={auditLogs}
              currentRole={currentUser.role}
              currentUser={currentUser.name}
              onSelectInvoice={(inv) => handleOpenReview(inv, 'OVERVIEW')}
            />
          ) : invoices.length === 0 ? (
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

        {/* Review Modal Panel */}
        <ReviewModal
          isOpen={isReviewOpen}
          onClose={() => setIsReviewOpen(false)}
          invoice={selectedInvoice}
          onUpdateInvoice={handleUpdateInvoice}
          initialSection={reviewSection}
          asOfDate={asOfDate}
          allInvoices={invoices}
          currentRole={currentUser.role}
          currentUser={currentUser.name}
          onShowReceipt={(inv) => {
            setReceiptInvoice(inv);
            setIsReceiptOpen(true);
          }}
          onOpenAuthorisationModal={(inv) => handleOpenAuthorisationModal(inv)}
        />

        {/* Dedicated Authorisation Modal Overlay */}
        <AuthorisationModal
          isOpen={isAuthorisationModalOpen}
          onClose={() => setIsAuthorisationModalOpen(false)}
          invoice={selectedInvoice}
          allInvoices={invoices}
          asOfDate={asOfDate}
          currentRole={currentUser.role}
          currentUser={currentUser.name}
          onAuthoriseSuccess={(updatedInv, action, details) => {
            handleUpdateInvoice(updatedInv, action, details);
            setIsReviewOpen(false);
          }}
          onRecordAudit={(action, user, role, details, invNum, suppName, status) => {
            handleRecordAudit(action, user, role, details, invNum, suppName, status);
          }}
          onShowReceipt={(inv) => {
            setReceiptInvoice(inv);
            setIsReceiptOpen(true);
          }}
        />

        {/* Upload Excel Workbook Modal */}
        <UploadModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          onConfirmImport={handleConfirmImport}
        />

        {/* Authorisation Control Receipt Modal */}
        <AuthorisationReceiptModal
          isOpen={isReceiptOpen}
          onClose={() => setIsReceiptOpen(false)}
          invoice={receiptInvoice}
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
            handleRecordAudit(
              action,
              currentUser.name,
              currentUser.role,
              details,
              'BATCH',
              'Due-Date Engine',
              'Checked'
            );
          }}
        />

      </div>
    </ErrorBoundary>
  );
}

export default App;
