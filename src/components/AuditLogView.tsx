import React from 'react';
import { AuditLogEntry } from '../types';
import { History, CheckCircle2, ShieldCheck, DollarSign, AlertTriangle, FileSpreadsheet } from 'lucide-react';

interface AuditLogViewProps {
  logs: AuditLogEntry[];
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ logs }) => {
  if (logs.length === 0) {
    return (
      <div className="bg-white border border-slate-300 rounded-xl p-12 text-center text-slate-600 shadow-sm">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
          <History className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-slate-800">No audit events recorded yet.</p>
        <p className="text-xs text-slate-500 mt-1">Actions such as Department Approval, Bank Verification, and Authorisation will appear here.</p>
      </div>
    );
  }

  const getIcon = (action: string) => {
    if (action.includes('Approval')) return <CheckCircle2 className="w-4 h-4 text-amber-600" />;
    if (action.includes('Bank') || action.includes('Verify')) return <ShieldCheck className="w-4 h-4 text-indigo-600" />;
    if (action.includes('Authoris')) return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    if (action.includes('Payment') || action.includes('Paid')) return <DollarSign className="w-4 h-4 text-teal-600" />;
    if (action.includes('Exception') || action.includes('Hold') || action.includes('Due-Date')) return <AlertTriangle className="w-4 h-4 text-orange-600" />;
    return <FileSpreadsheet className="w-4 h-4 text-slate-500" />;
  };

  return (
    <div className="bg-white border border-slate-300 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-slate-900 flex items-center">
          <History className="w-4 h-4 mr-2 text-indigo-600" />
          Gatekeeper Audit Trail ({logs.length} Events)
        </h3>
        <span className="text-xs text-slate-500 font-bold">Sorted by most recent</span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-300 font-extrabold text-slate-700 uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Invoice # / Supplier</th>
              <th className="py-3 px-4">Action Recorded</th>
              <th className="py-3 px-4">Performed By</th>
              <th className="py-3 px-4">Details & Comment</th>
              <th className="py-3 px-4">Status After</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-800">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4 font-mono text-slate-600 text-[11px] whitespace-nowrap">
                  {log.timestamp}
                </td>
                <td className="py-3 px-4">
                  <span className="font-bold text-slate-900 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 text-[11px] mr-2">
                    {log.invoiceNumber}
                  </span>
                  <span className="font-semibold text-slate-700">{log.supplierName}</span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center space-x-2">
                    {getIcon(log.action)}
                    <span className="font-bold text-slate-900">{log.action}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-slate-700 font-medium">
                  {log.user}
                </td>
                <td className="py-3 px-4 max-w-md text-slate-600 leading-relaxed">
                  {log.details}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300 font-mono">
                    {log.statusAfter}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
