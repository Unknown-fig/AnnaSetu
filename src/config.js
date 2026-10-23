/**
 * System-wide configuration for AnnaSetu 3D GovTech iPDS Portal (Phase 3)
 */

// Dual-OTP Approval configuration
// Setting this to 1 allows single-approver mode if required by authority
export const REQUIRED_OTP_APPROVERS = 2;

// OTP Validity & Security Limits
export const OTP_EXPIRY_SECONDS = 120; // 120 seconds countdown
export const OTP_MAX_ATTEMPTS = 3;     // 3 wrong attempts
export const OTP_LOCKOUT_SECONDS = 30; // 30 seconds lockout after 3 fails

// Animation Timing
export const WATERFALL_STEP_INTERVAL_MS = 400; // 400ms per step reveal
