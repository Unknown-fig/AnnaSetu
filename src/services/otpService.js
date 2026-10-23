import { 
  REQUIRED_OTP_APPROVERS, 
  OTP_EXPIRY_SECONDS, 
  OTP_MAX_ATTEMPTS, 
  OTP_LOCKOUT_SECONDS 
} from '../config';

/**
 * Generates a cryptographically secure random 6-digit decimal string
 */
export function generateSecureOtp() {
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  // Guarantee 6 digits between 100000 and 999999
  const code = 100000 + (array[0] % 900000);
  return code.toString();
}

/**
 * Generates a random cryptographic salt
 */
export function generateSalt() {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Computes SHA-256 hash of (salt + otpCode)
 */
export async function hashOtp(salt, otpCode) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${otpCode.trim()}`);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies an entered OTP against salt and target hash
 */
export async function verifyOtp(salt, enteredCode, targetHash) {
  if (!enteredCode || enteredCode.trim().length !== 6) return false;
  const computedHash = await hashOtp(salt, enteredCode.trim());
  return computedHash.toLowerCase() === targetHash.toLowerCase();
}

/**
 * Creates a new dual-OTP approval request record
 */
export async function createApprovalRequest({
  requestId,
  challanNo,
  fpsName,
  commodity,
  reason,
  remarks,
  operatorName,
  skippedBatches,
  chosenBatches,
}) {
  const now = Date.now();
  const expiresAt = now + OTP_EXPIRY_SECONDS * 1000;

  // Generate for Supervisor
  const supervisorOtp = generateSecureOtp();
  const supervisorSalt = generateSalt();
  const supervisorHash = await hashOtp(supervisorSalt, supervisorOtp);

  // Generate for DSO
  const dsoOtp = generateSecureOtp();
  const dsoSalt = generateSalt();
  const dsoHash = await hashOtp(dsoSalt, dsoOtp);

  return {
    requestId,
    challanNo,
    fpsName,
    commodity,
    reason,
    remarks,
    operatorName,
    skippedBatches,
    chosenBatches,
    createdAt: now,
    expiresAt,
    isVerified: false,
    isRejected: false,
    failedAttempts: 0,
    lockoutUntil: null,
    approvers: [
      {
        id: 'supervisor',
        role: 'Godown Supervisor',
        roleHi: 'गोदाम पर्यवेक्षक',
        name: 'Shri A. K. Verma (Supervisor, Surajpur)',
        salt: supervisorSalt,
        otpHash: supervisorHash,
        plaintextCode: supervisorOtp, // Shown ONLY in simulated SMS Approver view
        isRevealed: false,
        isVerified: false,
      },
      {
        id: 'dso',
        role: 'District Supply Officer (DSO)',
        roleHi: 'जिला पूर्ति अधिकारी (DSO)',
        name: 'Smt. R. K. Sharma (DSO, Gautam Buddha Nagar)',
        salt: dsoSalt,
        otpHash: dsoHash,
        plaintextCode: dsoOtp, // Shown ONLY in simulated SMS Approver view
        isRevealed: false,
        isVerified: false,
      },
    ],
  };
}
