import React from 'react';
import { InvoiceRecord } from '../types';
import { 
  calculateDaysRemaining, 
  getDueDateCategory, 
  computeMainStatus 
} from '../utils/dueDateUtils';
import { checkAuthorisationEligibility } from '../utils/authorisationUtils';
import { 
  Layers, 
  Clock, 
  ShieldAlert, 
  CheckCircle, 
  AlertTriangle, 
  CreditCard, 
  DollarSign, 
  Calendar,
  AlertCircle,
  ArrowRight
} from 'lucide-react';

interface SummaryCardsProps {
  invoices: InvoiceRecord[];
  onSelectCategory: (category: string) => void;
  activeCategory: string;
  asOfDate: string;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ 
  invoices, 
  onSelectCategory, 
  activeCategory,
  asOfDate
}) => {
  // Helper to calculate total value of a subset of invoices
  const sumAmount = (list: InvoiceRecord[]) => list.reduce((acc, inv) => acc + (inv.invoiceAmount || 0), 0);
  const formatVal = (val: number) => `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // 1. Total Imported Invoices
  const totalCount = invoices.length;
  const totalValue = sumAmount(invoices);

  // Classify each invoice for urgency and main status
  const activeEligible = invoices.filter(i => {
    if (i.paymentStatus === 'Paid' || i.paymentStatus === 'Rejected' || i.authorisationStatus === 'Rejected') return false;
    const days = calculateDaysRemaining(i.dueDate, asOfDate);
    const cat = getDueDateCategory(days);
    const main = computeMainStatus(i, cat);
    return main !== 'On Hold / Review Required';
  });

  // 2. Overdue (active non-hold only per rule: "Do not include Paid, Rejected or On-Hold invoices in the eligible outstanding amount")
  const overdueList = activeEligible.filter(i => getDueDateCategory(calculateDaysRemaining(i.dueDate, asOfDate)) === 'OVERDUE');
  
  // 3. Due Today
  const dueTodayList = activeEligible.filter(i => getDueDateCategory(calculateDaysRemaining(i.dueDate, asOfDate)) === 'DUE TODAY');

  // 4. Urgent – Due Within 5 Days
  const urgent5List = activeEligible.filter(i => getDueDateCategory(calculateDaysRemaining(i.dueDate, asOfDate)) === 'URGENT – DUE WITHIN 5 DAYS');

  // 5. Due Within 15 Days
  const due15List = activeEligible.filter(i => getDueDateCategory(calculateDaysRemaining(i.dueDate, asOfDate)) === 'DUE WITHIN 15 DAYS');

  // 6. Due Within 30 Days
  const due30List = activeEligible.filter(i => getDueDateCategory(calculateDaysRemaining(i.dueDate, asOfDate)) === 'DUE WITHIN 30 DAYS');

  // 7. Due Later
  const dueLaterList = activeEligible.filter(i => {
    const cat = getDueDateCategory(calculateDaysRemaining(i.dueDate, asOfDate));
    return cat === 'DUE LATER' || cat === 'NEEDS REVIEW';
  });

  // 8. On Hold / Review Required
  const onHoldList = invoices.filter(i => {
    const days = calculateDaysRemaining(i.dueDate, asOfDate);
    const cat = getDueDateCategory(days);
    return computeMainStatus(i, cat) === 'On Hold / Review Required';
  });

  // 9. Awaiting Department Approval
  const awaitingDeptList = invoices.filter(i => 
    i.overallMatchStatus.toLowerCase().includes('match') && 
    i.departmentApprovalStatus === 'Pending' && 
    i.exceptionStatus === 'None' &&
    i.paymentStatus !== 'On Hold' &&
    i.authorisationStatus !== 'Blocked'
  );

  // 10. Bank Verification Required
  const bankReqList = invoices.filter(i => i.bankVerificationStatus === 'Not Verified');

  // 11. Eligible for Authorisation
  const eligibleList = invoices.filter(i => checkAuthorisationEligibility(i).canAuthorise);

  // 12. Authorised – Ready for Manual Payment
  const authorisedList = invoices.filter(i => i.paymentStatus === 'Authorised – Ready for Manual Payment' || (i.authorisationStatus === 'Authorised' && i.paymentStatus !== 'Paid'));

  // 13. Paid
  const paidList = invoices.filter(i => i.paymentStatus === 'Paid');

  const cards = [
    {
      id: 'ALL_IMPORTED',
      title: 'Total Imported Invoices',
      count: totalCount,
      amount: totalValue,
      icon: Layers,
      accentClass: 'border-slate-300 hover:border-slate-400 bg-white',
      badgeBg: 'bg-slate-100 text-slate-800 border-slate-300',
      iconColor: 'text-slate-600'
    },
    {
      id: 'OVERDUE',
      title: 'Overdue',
      count: overdueList.length,
      amount: sumAmount(overdueList),
      icon: AlertCircle,
      accentClass: 'border-red-200 hover:border-red-400 bg-red-50/40',
      badgeBg: 'bg-red-100 text-red-800 border-red-300 font-extrabold',
      iconColor: 'text-red-600'
    },
    {
      id: 'DUE_TODAY',
      title: 'Due Today',
      count: dueTodayList.length,
      amount: sumAmount(dueTodayList),
      icon: Clock,
      accentClass: 'border-orange-200 hover:border-orange-400 bg-orange-50/40',
      badgeBg: 'bg-orange-100 text-orange-800 border-orange-300 font-extrabold',
      iconColor: 'text-orange-600'
    },
    {
      id: 'DUE_WITHIN_5_DAYS',
      title: 'Urgent – Due Within 5 Days',
      count: urgent5List.length,
      amount: sumAmount(urgent5List),
      icon: AlertTriangle,
      accentClass: 'border-amber-300 hover:border-amber-500 bg-amber-50/60 shadow-sm',
      badgeBg: 'bg-amber-100 text-amber-900 border-amber-400 font-extrabold',
      iconColor: 'text-amber-600'
    },
    {
      id: 'DUE_WITHIN_15_DAYS',
      title: 'Due Within 15 Days',
      count: due15List.length,
      amount: sumAmount(due15List),
      icon: Calendar,
      accentClass: 'border-blue-200 hover:border-blue-400 bg-blue-50/40',
      badgeBg: 'bg-blue-100 text-blue-800 border-blue-300',
      iconColor: 'text-blue-600'
    },
    {
      id: 'DUE_WITHIN_30_DAYS',
      title: 'Due Within 30 Days',
      count: due30List.length,
      amount: sumAmount(due30List),
      icon: Calendar,
      accentClass: 'border-teal-200 hover:border-teal-400 bg-teal-50/40',
      badgeBg: 'bg-teal-100 text-teal-800 border-teal-300',
      iconColor: 'text-teal-600'
    },
    {
      id: 'DUE_LATER',
      title: 'Due Later (> 30d)',
      count: dueLaterList.length,
      amount: sumAmount(dueLaterList),
      icon: Calendar,
      accentClass: 'border-slate-200 hover:border-slate-300 bg-slate-50/60',
      badgeBg: 'bg-slate-200 text-slate-700 border-slate-300',
      iconColor: 'text-slate-500'
    },
    {
      id: 'ON_HOLD_REVIEW_REQ',
      title: 'On Hold / Review Req',
      count: onHoldList.length,
      amount: sumAmount(onHoldList),
      icon: ShieldAlert,
      accentClass: 'border-rose-200 hover:border-rose-400 bg-rose-50/50',
      badgeBg: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
      iconColor: 'text-rose-600'
    },
    {
      id: 'AWAITING_DEPT_APPROVAL',
      title: 'Awaiting Dept Approval',
      count: awaitingDeptList.length,
      amount: sumAmount(awaitingDeptList),
      icon: Clock,
      accentClass: 'border-amber-200 hover:border-amber-400 bg-white',
      badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
      iconColor: 'text-amber-500'
    },
    {
      id: 'BANK_VERIFICATION_REQ',
      title: 'Bank Verification Req',
      count: bankReqList.length,
      amount: sumAmount(bankReqList),
      icon: ShieldAlert,
      accentClass: 'border-purple-200 hover:border-purple-400 bg-white',
      badgeBg: 'bg-purple-100 text-purple-800 border-purple-300',
      iconColor: 'text-purple-600'
    },
    {
      id: 'ELIGIBLE_FOR_AUTH',
      title: 'Eligible for Authorisation',
      count: eligibleList.length,
      amount: sumAmount(eligibleList),
      icon: CheckCircle,
      accentClass: 'border-emerald-200 hover:border-emerald-400 bg-emerald-50/30',
      badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
      iconColor: 'text-emerald-600'
    },
    {
      id: 'AUTHORISED_READY_PAYMENT',
      title: 'Authorised – Ready',
      count: authorisedList.length,
      amount: sumAmount(authorisedList),
      icon: CreditCard,
      accentClass: 'border-blue-200 hover:border-blue-400 bg-white',
      badgeBg: 'bg-blue-100 text-blue-800 border-blue-300 font-bold',
      iconColor: 'text-blue-600'
    },
    {
      id: 'PAID',
      title: 'Paid Invoices',
      count: paidList.length,
      amount: sumAmount(paidList),
      icon: DollarSign,
      accentClass: 'border-teal-200 hover:border-teal-400 bg-teal-50/30',
      badgeBg: 'bg-teal-100 text-teal-800 border-teal-300 font-bold',
      iconColor: 'text-teal-600'
    }
  ];

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-extrabold text-slate-800 tracking-tight uppercase">
          Gatekeeper Dashboard Summary Cards
        </h3>
        <span className="text-xs text-slate-500 font-medium">
          Click any card to filter the payment table view
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {cards.map((card) => {
          const IconComponent = card.icon;
          const isActive = activeCategory === card.id;
          return (
            <div
              key={card.id}
              onClick={() => onSelectCategory(card.id)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between shadow-xs hover:shadow-md ${
                isActive 
                  ? 'border-indigo-600 ring-2 ring-indigo-600/20 bg-indigo-50/30 shadow-md' 
                  : card.accentClass
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 line-clamp-1" title={card.title}>
                    {card.title}
                  </span>
                  <IconComponent className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : card.iconColor}`} />
                </div>
                
                <div className="mt-2.5 flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold tracking-tight text-slate-900 font-mono">
                    {card.count}
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${card.badgeBg}`}>
                    {card.count === 1 ? '1 inv' : `${card.count} invs`}
                  </span>
                </div>

                <div className="mt-1.5 text-[11px] font-bold text-slate-600 font-mono">
                  {formatVal(card.amount)} total
                </div>
              </div>

              {/* View Relevant Invoices Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCategory(card.id);
                }}
                className={`mt-3 w-full py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center space-x-1 border cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs hover:bg-indigo-700'
                    : 'bg-white text-slate-700 hover:text-slate-900 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                <span>View Invoices</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
