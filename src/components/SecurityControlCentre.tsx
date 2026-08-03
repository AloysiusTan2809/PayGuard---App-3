import React, { useState } from 'react';
import { InvoiceRecord, AuditLogEntry, UserRole } from '../types';
import { formatInvoiceTotal } from '../utils/excelUtils';
import { maskBankAccount, checkSupplierBankAccountChange } from '../utils/authorisationUtils';
import { 
  ShieldAlert, 
  UserCheck, 
  CopyCheck, 
  AlertTriangle, 
  Building2, 
  CheckSquare, 
  Clock, 
  History, 
  ExternalLink,
  Search,
  CheckCircle2,
  XCircle
} from 'lucide-react';

interface SecurityControlCentreProps {
  invoices: InvoiceRecord[];
  auditLogs: AuditLogEntry[];
  currentRole: UserRole;
  currentUser: string;
  onSelectInvoice: (invoice: InvoiceRecord) => void;
}

type SecurityCategory = 
  | 'BANK_CHANGES'
  | 'SOD_WARNINGS'
  | 'DUP_AUTH_ATTEMPTS'
  | 'DUP_PAY_REFS'
  | 'UNVERIFIED_BANK'
  | 'AWAITING_CONFIRM'
  | 'AUTH_NOT_PAID'
  | 'HIGH_RISK_AUDIT';

export const SecurityControlCentre: React.FC<SecurityControlCentreProps> = ({
  invoices,
  auditLogs,
  currentRole,
  currentUser,
  onSelectInvoice,
}) => {
  const [activeCategory, setActiveCategory] = useState<SecurityCategory>('BANK_CHANGES');

  // 1. Bank Account Changes Detected
  const bankChangedInvoices = invoices.filter(inv => {
    const res = checkSupplierBankAccountChange(inv, invoices);
    return res.hasChanged || inv.bankAccountChanged;
  });

  // 2. Segregation-of-Duties Warnings (e.g. Dept Approved By === Authorised By or audit logs containing SoD)
  const sodAuditLogs = auditLogs.filter(log => 
    log.action.includes('Segregation-of-Duties') || 
    log.details.includes('Segregation-of-Duties') ||
    log.action.includes('SoD')
  );
  const sodInvoiceNumbers = new Set(sodAuditLogs.map(l => l.invoiceNumber).filter(Boolean));
  const sodInvoices = invoices.filter(inv => 
    sodInvoiceNumbers.has(inv.invoiceNumber) ||
    (inv.departmentApprovedBy && inv.authorisedBy && inv.departmentApprovedBy.trim().toLowerCase() === inv.authorisedBy.trim().toLowerCase()) ||
    (inv.authorisedBy && inv.paymentDate && inv.authorisedBy.trim().toLowerCase() === inv.departmentApprovedBy?.trim().toLowerCase())
  );

  // 3. Duplicate Authorisation Attempts (From audit log)
  const dupAuthLogs = auditLogs.filter(log => 
    log.action.includes('Duplicate Action Blocked') || 
    log.action.includes('Duplicate Authorisation') ||
    log.details.includes('already been authorised')
  );
  const dupAuthInvoiceNumbers = new Set(dupAuthLogs.map(l => l.invoiceNumber).filter(Boolean));
  const dupAuthInvoices = invoices.filter(inv => dupAuthInvoiceNumbers.has(inv.invoiceNumber));

  // 4. Duplicate Payment Reference Warnings
  const dupPayRefLogs = auditLogs.filter(log => 
    log.action.includes('Duplicate Payment Reference') || 
    log.details.includes('Duplicate payment reference')
  );
  const dupPayRefInvoiceNumbers = new Set(dupPayRefLogs.map(l => l.invoiceNumber).filter(Boolean));
  const dupPayRefInvoices = invoices.filter(inv => dupPayRefInvoiceNumbers.has(inv.invoiceNumber));

  // 5. Unverified Bank Accounts
  const unverifiedBankInvoices = invoices.filter(inv => 
    inv.bankVerificationStatus !== 'Verified'
  );

  // 6. Invoices Awaiting Human Confirmation (Eligible for authorization or awaiting review)
  const awaitingConfirmInvoices = invoices.filter(inv => 
    inv.departmentApprovalStatus === 'Approved' && 
    inv.bankVerificationStatus === 'Verified' && 
    inv.authorisationStatus !== 'Authorised'
  );

  // 7. Authorised but Not Yet Paid
  const authNotPaidInvoices = invoices.filter(inv => 
    inv.authorisationStatus === 'Authorised' && 
    inv.paymentStatus !== 'Paid'
  );

  // 8. Recent High-Risk Audit Events
  const highRiskAuditLogs = auditLogs.filter(log => 
    log.action.includes('Blocked') || 
    log.action.includes('Warning') || 
    log.action.includes('Role Changed') ||
    log.action.includes('Security') ||
    log.action.includes('Changed')
  );

  const cardConfigs = [
    {
      id: 'BANK_CHANGES' as SecurityCategory,
      title: 'Bank Account Changes Detected',
      count: bankChangedInvoices.length,
      icon: ShieldAlert,
      badgeColor: bankChangedInvoices.length > 0 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-slate-800 text-slate-400',
      description: 'Suppliers with different bank accounts across imported records.',
      statusText: bankChangedInvoices.length > 0 ? 'Requires Verification' : 'No Changes Detected',
    },
    {
      id: 'SOD_WARNINGS' as SecurityCategory,
      title: 'Segregation-of-Duties Warnings',
      count: sodInvoices.length,
      icon: UserCheck,
      badgeColor: sodInvoices.length > 0 ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-slate-800 text-slate-400',
      description: 'Records where maker/checker duty overlap occurred.',
      statusText: sodInvoices.length > 0 ? 'Control Conflict' : 'Clean Segregation',
    },
    {
      id: 'DUP_AUTH_ATTEMPTS' as SecurityCategory,
      title: 'Duplicate Authorisation Attempts',
      count: dupAuthInvoices.length,
      icon: CopyCheck,
      badgeColor: dupAuthInvoices.length > 0 ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-slate-800 text-slate-400',
      description: 'Prevented duplicate authorisation actions.',
      statusText: dupAuthInvoices.length > 0 ? 'Possible Duplicate' : 'No Blocked Re-auth',
    },
    {
      id: 'DUP_PAY_REFS' as SecurityCategory,
      title: 'Duplicate Payment Ref Warnings',
      count: dupPayRefInvoices.length,
      icon: AlertTriangle,
      badgeColor: dupPayRefInvoices.length > 0 ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-slate-800 text-slate-400',
      description: 'Payment references used on multiple invoices.',
      statusText: dupPayRefInvoices.length > 0 ? 'Human Review Required' : 'Unique References',
    },
    {
      id: 'UNVERIFIED_BANK' as SecurityCategory,
      title: 'Unverified Bank Accounts',
      count: unverifiedBankInvoices.length,
      icon: Building2,
      badgeColor: unverifiedBankInvoices.length > 0 ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' : 'bg-slate-800 text-slate-400',
      description: 'Invoices pending independent bank verification.',
      statusText: unverifiedBankInvoices.length > 0 ? 'Pending Verification' : 'All Verified',
    },
    {
      id: 'AWAITING_CONFIRM' as SecurityCategory,
      title: 'Awaiting Human Confirmation',
      count: awaitingConfirmInvoices.length,
      icon: CheckSquare,
      badgeColor: awaitingConfirmInvoices.length > 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400',
      description: 'Invoices fully approved & pending Madam Lim authorisation.',
      statusText: awaitingConfirmInvoices.length > 0 ? 'Ready for Authorisation' : 'None Pending',
    },
    {
      id: 'AUTH_NOT_PAID' as SecurityCategory,
      title: 'Authorised but Not Yet Paid',
      count: authNotPaidInvoices.length,
      icon: Clock,
      badgeColor: authNotPaidInvoices.length > 0 ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-slate-800 text-slate-400',
      description: 'Authorised records awaiting external manual payment.',
      statusText: authNotPaidInvoices.length > 0 ? 'Pending Manual Payment' : 'No Queue',
    },
    {
      id: 'HIGH_RISK_AUDIT' as SecurityCategory,
      title: 'Recent High-Risk Audit Events',
      count: highRiskAuditLogs.length,
      icon: History,
      badgeColor: highRiskAuditLogs.length > 0 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-slate-800 text-slate-400',
      description: 'Audit logs of role shifts, blocks, and overrides.',
      statusText: highRiskAuditLogs.length > 0 ? 'Security Events Logged' : 'Normal Log Flow',
    },
  ];

  const renderActiveList = () => {
    let activeInvoices: InvoiceRecord[] = [];
    let isAuditLogMode = false;

    switch (activeCategory) {
      case 'BANK_CHANGES':
        activeInvoices = bankChangedInvoices;
        break;
      case 'SOD_WARNINGS':
        activeInvoices = sodInvoices;
        break;
      case 'DUP_AUTH_ATTEMPTS':
        activeInvoices = dupAuthInvoices;
        break;
      case 'DUP_PAY_REFS':
        activeInvoices = dupPayRefInvoices;
        break;
      case 'UNVERIFIED_BANK':
        activeInvoices = unverifiedBankInvoices;
        break;
      case 'AWAITING_CONFIRM':
        activeInvoices = awaitingConfirmInvoices;
        break;
      case 'AUTH_NOT_PAID':
        activeInvoices = authNotPaidInvoices;
        break;
      case 'HIGH_RISK_AUDIT':
        isAuditLogMode = true;
        break;
    }

    if (isAuditLogMode) {
      return (
        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/60">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-semibold">
              <tr>
                <th className="py-3 px-4">Event ID / Time</th>
                <th className="py-3 px-4">User & Role</th>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {highRiskAuditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 italic">
                    No high-risk security audit events logged yet.
                  </td>
                </tr>
              ) : (
                highRiskAuditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      <div className="font-bold text-indigo-300">{log.id}</div>
                      <div>{log.timestamp}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{log.user}</div>
                      <div className="text-[10px] text-slate-400">{log.role || 'System'}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                      {log.invoiceNumber || 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-800/60">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/60">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-semibold">
            <tr>
              <th className="py-3 px-4">Supplier & Invoice</th>
              <th className="py-3 px-4">PO / GRN</th>
              <th className="py-3 px-4 text-right">Invoice Total</th>
              <th className="py-3 px-4">Due Date</th>
              <th className="py-3 px-4">Bank Account</th>
              <th className="py-3 px-4">Match & Status</th>
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {activeInvoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                  No records matching this security control category.
                </td>
              </tr>
            ) : (
              activeInvoices.map(inv => {
                const bankChange = checkSupplierBankAccountChange(inv, invoices);
                return (
                  <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white text-sm">{inv.supplierName}</div>
                      <div className="font-mono text-indigo-400 text-xs font-semibold">{inv.invoiceNumber}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      <div>PO: {inv.poNumber || '—'}</div>
                      <div>GRN: {inv.grnNumber || '—'}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-400 text-sm">
                      {formatInvoiceTotal(inv.invoiceTotal || inv.invoiceAmount, inv.currency)}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300 text-[11px]">
                      {inv.dueDate}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px]">
                      <div className="text-slate-300">{maskBankAccount(inv.bankAccountNumber)}</div>
                      {bankChange.hasChanged && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/80">
                          Bank Details Changed
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[11px]">
                      <div className="font-semibold text-slate-200">{inv.overallMatchStatus}</div>
                      <div className="text-slate-400 text-[10px]">
                        Dept: {inv.departmentApprovalStatus} | Bank: {inv.bankVerificationStatus}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onSelectInvoice(inv)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center space-x-1 mx-auto transition-colors shadow-sm"
                      >
                        <span>Review</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 rounded-xl border border-indigo-500/30 shadow-xl">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-6 h-6 text-indigo-400" />
              <h2 className="text-xl font-bold text-white tracking-tight">Security & Control Centre</h2>
            </div>
            <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
              Monitors bank account changes, Maker–Checker segregation of duties, duplicate authorisation locks, and high-risk control warnings in real-time.
            </p>
          </div>
          <div className="px-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg text-xs font-mono text-slate-300 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Role: <strong className="text-white">{currentRole}</strong></span>
          </div>
        </div>

        {/* Human Control Guarantee Disclaimer */}
        <div className="mt-4 p-2.5 bg-slate-950/60 border border-indigo-900/50 rounded-lg text-[11px] text-indigo-200 flex items-center justify-between">
          <span>
            🔒 <strong>PayGuard Security Notice:</strong> PayGuard records authorisation and external payment information only. It does not transfer money.
          </span>
          <span className="text-slate-400 text-[10px]">Append-Only Audit Active</span>
        </div>
      </div>

      {/* 8 Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cardConfigs.map(card => {
          const IconComponent = card.icon;
          const isSelected = activeCategory === card.id;

          return (
            <button
              key={card.id}
              onClick={() => setActiveCategory(card.id)}
              className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                isSelected 
                  ? 'bg-slate-800 border-indigo-500 shadow-lg ring-1 ring-indigo-500/50 scale-[1.01]' 
                  : 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg border ${card.badgeColor}`}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <span className="text-2xl font-extrabold text-white font-mono">
                    {card.count}
                  </span>
                </div>

                <h3 className="text-xs font-bold text-slate-200 line-clamp-1 mb-1">
                  {card.title}
                </h3>
                <p className="text-[11px] text-slate-400 leading-tight mb-3">
                  {card.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                <span className="font-semibold text-slate-400">{card.statusText}</span>
                <span className={`font-mono font-bold ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`}>
                  {isSelected ? 'Viewing' : 'Click to View →'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Category Review Section */}
      <div className="space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {cardConfigs.find(c => c.id === activeCategory)?.title} Details
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Showing records matching neutral control criteria
          </span>
        </div>

        {renderActiveList()}
      </div>

    </div>
  );
};
