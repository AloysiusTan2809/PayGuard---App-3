import React from 'react';
import { FilterViewTab } from '../types';
import { 
  Layers, 
  Clock, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle, 
  CreditCard, 
  DollarSign, 
  History, 
  AlertCircle, 
  Calendar 
} from 'lucide-react';

interface NavigationTabsProps {
  activeTab: FilterViewTab;
  onSelectTab: (tab: FilterViewTab) => void;
  counts: Record<FilterViewTab, number>;
}

export const NavigationTabs: React.FC<NavigationTabsProps> = ({ activeTab, onSelectTab, counts }) => {
  const tabs: { id: FilterViewTab; label: string; count: number; icon: any; isUrgent?: boolean }[] = [
    { id: 'ALL_IMPORTED', label: 'All Imported Invoices', count: counts.ALL_IMPORTED || 0, icon: Layers },
    { id: 'OVERDUE', label: 'Overdue', count: counts.OVERDUE || 0, icon: AlertCircle },
    { id: 'DUE_TODAY', label: 'Due Today', count: counts.DUE_TODAY || 0, icon: Clock },
    { id: 'DUE_WITHIN_5_DAYS', label: 'Due Within 5 Days', count: counts.DUE_WITHIN_5_DAYS || 0, icon: AlertTriangle, isUrgent: true },
    { id: 'DUE_WITHIN_15_DAYS', label: 'Due Within 15 Days', count: counts.DUE_WITHIN_15_DAYS || 0, icon: Calendar },
    { id: 'DUE_WITHIN_30_DAYS', label: 'Due Within 30 Days', count: counts.DUE_WITHIN_30_DAYS || 0, icon: Calendar },
    { id: 'DUE_LATER', label: 'Due Later', count: counts.DUE_LATER || 0, icon: Calendar },
    { id: 'AWAITING_DEPT_APPROVAL', label: 'Awaiting Approval', count: counts.AWAITING_DEPT_APPROVAL || 0, icon: Clock },
    { id: 'BANK_VERIFICATION_REQ', label: 'Bank Verification Required', count: counts.BANK_VERIFICATION_REQ || 0, icon: ShieldAlert },
    { id: 'ON_HOLD_REVIEW_REQ', label: 'On Hold', count: counts.ON_HOLD_REVIEW_REQ || 0, icon: AlertTriangle },
    { id: 'ELIGIBLE_FOR_AUTH', label: 'Eligible for Authorisation', count: counts.ELIGIBLE_FOR_AUTH || 0, icon: CheckCircle },
    { id: 'AUTHORISED_READY_PAYMENT', label: 'Authorised Payments', count: counts.AUTHORISED_READY_PAYMENT || 0, icon: CreditCard },
    { id: 'PAID', label: 'Paid Invoices', count: counts.PAID || 0, icon: DollarSign },
    { id: 'AUDIT_LOGS', label: 'Audit Log & History', count: counts.AUDIT_LOGS || 0, icon: History }
  ];

  return (
    <div className="border-b border-slate-200 bg-slate-100 rounded-t-xl px-2 pt-2 mb-4 overflow-x-auto">
      <nav className="flex space-x-1 min-w-max" aria-label="Tabs">
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          const isActive = activeTab === tab.id;
          const isUrgent5 = tab.isUrgent;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center space-x-2 py-3 px-3 text-xs font-bold rounded-t-lg transition-all border-b-2 cursor-pointer ${
                isActive
                  ? isUrgent5
                    ? 'border-amber-500 text-amber-950 bg-amber-50/90 shadow-xs ring-1 ring-amber-400/40'
                    : 'border-indigo-600 text-indigo-950 bg-white shadow-xs'
                  : isUrgent5
                  ? 'border-transparent text-amber-900 bg-amber-100/50 hover:bg-amber-100 hover:text-amber-950 font-extrabold'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              {isUrgent5 && !isActive && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              )}
              <IconComponent className={`w-3.5 h-3.5 shrink-0 ${
                isActive 
                  ? isUrgent5 ? 'text-amber-600' : 'text-indigo-600' 
                  : isUrgent5 ? 'text-amber-700' : 'text-slate-500'
              }`} />
              <span>{tab.label}</span>
              <span
                className={`ml-1 py-0.5 px-2 rounded-full text-[10px] font-extrabold border ${
                  isActive
                    ? isUrgent5
                      ? 'bg-amber-600 text-white border-amber-700'
                      : 'bg-indigo-600 text-white border-indigo-700'
                    : isUrgent5
                    ? 'bg-amber-200 text-amber-900 border-amber-300 font-extrabold'
                    : 'bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
