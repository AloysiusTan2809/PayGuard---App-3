import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Eye, EyeOff, AlertCircle, Info, Sparkles, User, Key, CheckCircle2, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';
import { authenticateUser, getPresenterDemoAccounts, AuthenticatedUser, TECHNICAL_SECURITY_LIMITATION_STATEMENT } from '../services/authService';

interface LoginScreenProps {
  onLoginSuccess: (user: AuthenticatedUser) => void;
  onRecordAudit: (action: string, user: string, role: string, details: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onRecordAudit
}) => {
  const [userIdOrEmail, setUserIdOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Validation and Error states
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutCountdown, setLockoutCountdown] = useState(0);

  // Presenter Helper Drawer
  const [showPresenterHelper, setShowPresenterHelper] = useState(false);
  const [showTechNotice, setShowTechNotice] = useState(false);

  // Lockout countdown timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLocked && lockoutCountdown > 0) {
      timer = setInterval(() => {
        setLockoutCountdown(prev => {
          if (prev <= 1) {
            setIsLocked(false);
            setErrorMessage(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isLocked, lockoutCountdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isLocked) return;

    if (!userIdOrEmail.trim() || !password) {
      setErrorMessage('User ID / Email and Password are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    // Short processing delay for security UX and preventing rapid brute-force
    await new Promise(res => setTimeout(res, 400));

    const result = await authenticateUser(userIdOrEmail, password);

    setIsSubmitting(false);

    if (result.success && result.user) {
      // Clear password field
      setPassword('');
      onLoginSuccess(result.user);
    } else {
      // Clear password field on failure per prompt requirement
      setPassword('');

      if (result.isLocked) {
        setIsLocked(true);
        setLockoutCountdown(result.lockoutSecondsRemaining || 30);
        setErrorMessage(result.errorMessage || 'Account temporarily locked due to 5 failed attempts.');
        
        // Log temporary lockout in security audit
        onRecordAudit(
          'Temporary Login Lock Activated',
          userIdOrEmail.trim() || 'UNKNOWN_USER',
          'Unauthenticated',
          `Security Lockout triggered after 5 consecutive failed login attempts. Locked for ${result.lockoutSecondsRemaining || 30} seconds.`
        );
      } else {
        setErrorMessage(result.errorMessage || 'Invalid user ID or password.');
        
        // Log failed login attempt
        onRecordAudit(
          'Failed Login Attempt',
          userIdOrEmail.trim() || 'UNKNOWN_USER',
          'Unauthenticated',
          `Failed login attempt for identifier "${userIdOrEmail.trim()}". ${result.attemptsRemaining !== undefined ? `${result.attemptsRemaining} attempt(s) remaining.` : ''}`
        );
      }
    }
  };

  const handleSelectDemoAccount = (acc: ReturnType<typeof getPresenterDemoAccounts>[0]) => {
    setUserIdOrEmail(acc.username);
    setPassword(acc.demoPass);
    setErrorMessage(null);
  };

  const demoAccounts = getPresenterDemoAccounts();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white font-sans relative overflow-hidden">
      
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-0 -left-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar Logo */}
      <header className="p-6 max-w-7xl w-full mx-auto flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="font-extrabold text-lg text-white tracking-wide">PayGuard <span className="text-indigo-400 font-semibold">— App 3</span></span>
            <span className="block text-xs text-slate-400 font-medium">Boon Huat Hardware & Supplies Pte Ltd</span>
          </div>
        </div>

        <button
          onClick={() => setShowPresenterHelper(!showPresenterHelper)}
          className="inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 shadow-sm transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
          <span>Demo Login Details</span>
          {showPresenterHelper ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
        </button>
      </header>

      {/* Main Login Form Container */}
      <main className="flex-1 flex items-center justify-center p-4 z-10">
        <div className="w-full max-w-md space-y-6">
          
          {/* Presenter Demo Accounts Helper (Drawer/Panel) */}
          {showPresenterHelper && (
            <div className="bg-slate-800/90 backdrop-blur border border-indigo-500/40 rounded-2xl p-5 shadow-2xl space-y-3 text-xs animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <div className="flex items-center space-x-2 text-indigo-300 font-extrabold">
                  <User className="w-4 h-4 text-amber-400" />
                  <span>Demo Login Details</span>
                </div>
                <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700 font-mono">1-Click Auto-Fill</span>
              </div>
              
              {/* Mandatory Classroom Notice Disclaimer */}
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 font-extrabold text-[11px] text-center">
                Classroom Demonstration Accounts – Not for production use.
              </div>

              <p className="text-slate-300 text-[11px] leading-relaxed">
                Click an account below to reveal and automatically fill credentials for classroom testing:
              </p>
              <div className="space-y-2">
                {demoAccounts.map((acc, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectDemoAccount(acc)}
                    className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-indigo-950/80 border border-slate-700 hover:border-indigo-500 transition-all cursor-pointer group flex items-start justify-between"
                  >
                    <div className="space-y-0.5">
                      <div className="font-extrabold text-slate-100 group-hover:text-indigo-300 flex items-center space-x-1.5">
                        <span>{acc.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-indigo-900/60 text-indigo-300 rounded font-semibold border border-indigo-700/50">
                          {acc.role}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-300 font-mono">
                        User ID: <strong className="text-white">{acc.username}</strong> • Password: <strong className="text-amber-300">{acc.demoPass}</strong>
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-1">{acc.description}</p>
                    </div>
                    <span className="text-[10px] bg-indigo-600 group-hover:bg-indigo-500 text-white font-bold px-2 py-1 rounded shadow-xs shrink-0 ml-2">
                      Use
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Login Card */}
          <div className="bg-slate-800/95 backdrop-blur border border-slate-700 rounded-3xl p-8 shadow-2xl space-y-6">
            
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30 mb-1">
                <Lock className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white">PayGuard Sign In</h2>
              <p className="text-xs text-slate-400 font-medium">
                Hardware Accounts Payable Authorisation Suite
              </p>
            </div>

            {/* Authorised Notice */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs text-center font-bold flex items-center justify-center space-x-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Authorised users only. All access and actions are recorded.</span>
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-start space-x-2 border ${
                isLocked
                  ? 'bg-rose-950/80 border-rose-600 text-rose-200'
                  : 'bg-rose-900/40 border-rose-500/50 text-rose-300'
              }`}>
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <div className="space-y-1">
                  <div>{errorMessage}</div>
                  {isLocked && lockoutCountdown > 0 && (
                    <div className="text-[11px] font-mono text-rose-300">
                      Lockout countdown: <strong>{lockoutCountdown} seconds remaining</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  User ID or Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    disabled={isLocked || isSubmitting}
                    value={userIdOrEmail}
                    onChange={(e) => setUserIdOrEmail(e.target.value)}
                    placeholder="e.g. madam.lim, department.approver or mr.boon"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Key className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={isLocked || isSubmitting}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLocked || isSubmitting}
                className={`w-full py-3 px-4 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center space-x-2 ${
                  (isLocked || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isSubmitting ? (
                  <span>Authenticating...</span>
                ) : isLocked ? (
                  <span>Account Locked ({lockoutCountdown}s)</span>
                ) : (
                  <>
                    <span>Sign In</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Technical Security Limitation Accordion */}
            <div className="border-t border-slate-700/80 pt-4">
              <button
                type="button"
                onClick={() => setShowTechNotice(!showTechNotice)}
                className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-300 font-medium cursor-pointer"
              >
                <div className="flex items-center space-x-1.5">
                  <Info className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Technical Security Notice</span>
                </div>
                {showTechNotice ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showTechNotice && (
                <div className="mt-2.5 p-3 bg-slate-900/90 border border-slate-700/80 rounded-xl text-[11px] text-slate-300 font-mono leading-relaxed animate-in fade-in">
                  {TECHNICAL_SECURITY_LIMITATION_STATEMENT}
                </div>
              )}
            </div>

          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-slate-500 z-10 border-t border-slate-800">
        PayGuard — Hardware Company Accounts Payable Control Suite • Confidential Internal Application
      </footer>

    </div>
  );
};
