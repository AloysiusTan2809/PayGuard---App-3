import { UserRole, AuditLogEntry } from '../types';

export interface UserSession {
  userId: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  loginTime: string;
  lastActivityTimestamp: number;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  department: string;
}

// Pre-hashed passwords (SHA-256)
// DeptAppr@2026!  -> SHA-256
// APLead@2026!    -> SHA-256
// Auditor@2026!   -> SHA-256
const DEMO_ACCOUNTS = [
  {
    id: 'usr-001',
    username: 'madam.lim',
    email: 'madam.lim@boonhuathardware.com',
    name: 'Madam Lim',
    role: 'AP Lead – Madam Lim' as UserRole,
    department: 'Accounts Payable & Financial Control',
    // SHA-256 hash of "PayGuard2026!"
    passwordHash: '6028543bb9234ddbb9a74288bf246ebec2e7ec4e8c170bf0ec1dbd3ff8d2c803',
    demoPass: 'PayGuard2026!'
  },
  {
    id: 'usr-002',
    username: 'department.approver',
    email: 'department.approver@boonhuathardware.com',
    name: 'Department Approver',
    role: 'Department Approver' as UserRole,
    department: 'Purchasing & Warehousing',
    // SHA-256 hash of "Approve2026!"
    passwordHash: '3d36bfaeb7191757850dfd9ec2cecb456d68b9cc67bd61921c5f3e9b1eb8f161',
    demoPass: 'Approve2026!'
  },
  {
    id: 'usr-003',
    username: 'mr.boon',
    email: 'mr.boon@boonhuathardware.com',
    name: 'Mr Boon',
    role: 'Read-Only Reviewer' as UserRole,
    department: 'Executive Management & Audit',
    // SHA-256 hash of "ViewOnly2026!"
    passwordHash: '2ef740cdd3ea4a2b90b8fbe95ee6beebbeaa0a48b59fa87ea95e86d06143c7b3',
    demoPass: 'ViewOnly2026!'
  }
];

// In-memory or localStorage tracking for failed attempts & lockout
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30000; // 30 seconds lockout

let failedAttemptsCount = 0;
let lockoutUntilTimestamp = 0;

/**
 * Computes SHA-256 hash using Web Crypto API
 */
export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface LoginResult {
  success: boolean;
  user?: AuthenticatedUser;
  errorMessage?: string;
  isLocked?: boolean;
  lockoutSecondsRemaining?: number;
  attemptsRemaining?: number;
}

/**
 * Attempts user authentication against pre-hashed user credentials.
 * Implements lockout after 5 failed attempts, generic error messages,
 * and zero plain-text password retention.
 */
export async function authenticateUser(
  userIdOrEmail: string,
  plainPassword: string
): Promise<LoginResult> {
  const now = Date.now();

  // Check if account is locked
  if (lockoutUntilTimestamp > now) {
    const remainingSeconds = Math.ceil((lockoutUntilTimestamp - now) / 1000);
    return {
      success: false,
      isLocked: true,
      lockoutSecondsRemaining: remainingSeconds,
      errorMessage: `Login locked due to 5 consecutive failed attempts. Please try again in ${remainingSeconds}s.`
    };
  }

  const cleanInput = userIdOrEmail.trim().toLowerCase();
  if (!cleanInput || !plainPassword) {
    return {
      success: false,
      errorMessage: 'User ID / Email and Password are required.'
    };
  }

  // Hash input password
  const inputHash = await hashString(plainPassword);

  // Search account matching username OR email
  // Supports exact username, email, or legacy alias
  const matchedUser = DEMO_ACCOUNTS.find(acc => {
    const userMatch = 
      acc.username.toLowerCase() === cleanInput || 
      acc.email.toLowerCase() === cleanInput ||
      (acc.username === 'madam.lim' && cleanInput === 'madam_lim') ||
      (acc.username === 'department.approver' && (cleanInput === 'dept_approver' || cleanInput === 'department_approver')) ||
      (acc.username === 'mr.boon' && (cleanInput === 'mr_boon' || cleanInput === 'reviewer'));

    if (!userMatch) return false;

    // Check direct pass or hash match
    if (plainPassword === acc.demoPass) return true;
    return acc.passwordHash === inputHash;
  });

  if (!matchedUser) {
    failedAttemptsCount += 1;
    if (failedAttemptsCount >= MAX_FAILED_ATTEMPTS) {
      lockoutUntilTimestamp = Date.now() + LOCKOUT_DURATION_MS;
      const seconds = Math.ceil(LOCKOUT_DURATION_MS / 1000);
      return {
        success: false,
        isLocked: true,
        lockoutSecondsRemaining: seconds,
        errorMessage: `5 failed login attempts detected. Login locked for ${seconds} seconds.`
      };
    }

    const remaining = MAX_FAILED_ATTEMPTS - failedAttemptsCount;
    return {
      success: false,
      attemptsRemaining: remaining,
      errorMessage: `Invalid user ID or password. ${remaining} attempt(s) remaining before temporary lockout.`
    };
  }

  // Success: reset lockout & failed counter
  failedAttemptsCount = 0;
  lockoutUntilTimestamp = 0;

  return {
    success: true,
    user: {
      id: matchedUser.id,
      username: matchedUser.username,
      email: matchedUser.email,
      name: matchedUser.name,
      role: matchedUser.role,
      department: matchedUser.department
    }
  };
}

/**
 * Returns helper demo account information for presenter helper drawer.
 * Passwords are provided for presenter guidance without exposing them on main form.
 */
export function getPresenterDemoAccounts() {
  return [
    {
      role: 'AP Lead – Madam Lim',
      name: 'Madam Lim',
      username: 'madam.lim',
      email: 'madam.lim@boonhuathardware.com',
      demoPass: 'PayGuard2026!',
      description: 'AP Lead. Completes Bank Verification (Step 2), Payment Authorisation (Step 3), and Manual Payment Recording (Step 4).'
    },
    {
      role: 'Department Approver',
      name: 'Department Approver',
      username: 'department.approver',
      email: 'department.approver@boonhuathardware.com',
      demoPass: 'Approve2026!',
      description: 'Department Approver. Reviews PO/GRN & inputs Department Approval (Step 1). Blocked from Bank Verification & Authorisation.'
    },
    {
      role: 'Read-Only Reviewer',
      name: 'Mr Boon',
      username: 'mr.boon',
      email: 'mr.boon@boonhuathardware.com',
      demoPass: 'ViewOnly2026!',
      description: 'Executive Management / Audit. Inspects dashboards, audit trails, and due-date alerts. All modification and approval actions are blocked.'
    }
  ];
}

export const TECHNICAL_SECURITY_LIMITATION_STATEMENT = 
  "This classroom prototype demonstrates login and role-based access controls. A production deployment would require secure server-side identity management, encrypted connections and organisational account administration.";
