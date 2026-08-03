import React, { useEffect, useState } from 'react';
import { Clock, AlertTriangle, ShieldCheck } from 'lucide-react';

interface InactivityWarningModalProps {
  isOpen: boolean;
  secondsRemaining: number;
  onExtendSession: () => void;
  onSignOut: () => void;
}

export const InactivityWarningModal: React.FC<InactivityWarningModalProps> = ({
  isOpen,
  secondsRemaining,
  onExtendSession,
  onSignOut
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full border border-amber-300 shadow-2xl p-6 space-y-5 text-slate-900">
        
        <div className="flex items-center space-x-3 text-amber-600">
          <div className="p-2.5 bg-amber-100 rounded-xl border border-amber-300">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">Session Inactivity Warning</h3>
            <p className="text-xs text-slate-500 font-medium">Automatic Security Logout Protection</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs space-y-2">
          <p className="font-semibold text-amber-900">
            Your PayGuard session is about to expire due to inactivity.
          </p>
          <div className="flex items-center justify-center space-x-2 py-2">
            <span className="text-3xl font-black font-mono text-amber-700">{secondsRemaining}s</span>
          </div>
          <p className="text-[11px] text-amber-800 text-center font-medium">
            Click <strong>Stay Signed In</strong> to continue working. All previously saved invoice records remain safely stored.
          </p>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            onClick={onSignOut}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition-colors cursor-pointer"
          >
            Sign Out Now
          </button>
          <button
            onClick={onExtendSession}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md transition-colors cursor-pointer flex items-center space-x-1.5"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Stay Signed In</span>
          </button>
        </div>

      </div>
    </div>
  );
};
