import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '../../context/store';
import { ACTION_TYPES } from '../../context/actions';
import { useI18n } from '../../i18n/I18nContext';
import { EXCEPTION_REASONS } from '../../types/models';
import { REQUIRED_OTP_APPROVERS } from '../../config';
import { createApprovalRequest, verifyOtp } from '../../services/otpService';
import { createChainedEventHash } from '../../services/cryptoService';
import { OtpBoxesInput } from './OtpBoxesInput';
import { 
  AlertOctagon, 
  AlertTriangle, 
  X, 
  Send, 
  CheckCircle2, 
  Clock, 
  Lock, 
  ShieldCheck, 
  Stamp,
  RotateCcw,
  Building2,
  KeyRound
} from 'lucide-react';

export const ExceptionGate = React.memo(function ExceptionGate({
  isOpen,
  violationDetails,
  onCancel,
  onApproveException,
  commodity,
  targetQty,
}) {
  const { state, dispatch } = useStore();
  const { t, tCommodity } = useI18n();

  const [reason, setReason] = useState(EXCEPTION_REASONS[0]);
  const [operatorName, setOperatorName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [requestId, setRequestId] = useState(null);
  const [otpCodes, setOtpCodes] = useState({ supervisor: '', dso: '' });
  const [errorMessage, setErrorMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Find active approval request from store
  const activeApproval = useMemo(() => {
    return state.approvals.find(a => a.requestId === requestId) || null;
  }, [state.approvals, requestId]);

  // Sync timers
  useEffect(() => {
    if (!activeApproval) {
      setTimeLeft(0);
      setLockoutTimeLeft(0);
      return;
    }

    const timer = setInterval(() => {
      const now = Date.now();
      // Expiry countdown
      const remExpiry = Math.max(0, Math.ceil((activeApproval.expiresAt - now) / 1000));
      setTimeLeft(remExpiry);

      // Lockout countdown
      if (activeApproval.lockoutUntil && activeApproval.lockoutUntil > now) {
        setLockoutTimeLeft(Math.ceil((activeApproval.lockoutUntil - now) / 1000));
      } else {
        setLockoutTimeLeft(0);
        if (activeApproval.lockoutUntil && activeApproval.lockoutUntil <= now) {
          dispatch({
            type: ACTION_TYPES.RESET_OTP_LOCKOUT,
            payload: { requestId: activeApproval.requestId },
          });
        }
      }
    }, 500);

    return () => clearInterval(timer);
  }, [activeApproval, dispatch]);

  // Request new OTPs
  const handleRequestOtps = useCallback(async () => {
    setErrorMessage('');
    const newReqId = `REQ-OTP-${Date.now().toString().slice(-6)}`;
    const challanNo = `GBN-iPDS-2026-${state.challanCounter.toString().padStart(4, '0')}`;

    const skippedBatches = violationDetails ? [{
      batchId: violationDetails.olderBatchId,
      bay: violationDetails.olderBay,
      ageDays: violationDetails.olderAge,
      unpicked: violationDetails.olderUnpicked,
    }] : [];

    const chosenBatches = violationDetails ? [{
      batchId: violationDetails.newerBatchId,
      bay: violationDetails.newerBay,
      ageDays: violationDetails.newerAge,
      pick: violationDetails.newerPick,
    }] : [];

    const requestObj = await createApprovalRequest({
      requestId: newReqId,
      challanNo,
      fpsName: 'Surajpur PDS Dispatch',
      commodity,
      reason,
      remarks,
      operatorName: operatorName.trim() || 'Godown Operator',
      skippedBatches,
      chosenBatches,
    });

    const timestamp = new Date().toISOString();
    const prevHash = state.auditLogs[0]?.hash || '0000000000000000000000000000000000000000000000000000000000000000';
    
    // Hash-chained audit event without plaintext OTP!
    const eventHash = await createChainedEventHash(
      prevHash,
      timestamp,
      'OTP_REQUESTED',
      {
        requestId: newReqId,
        challanNo,
        commodity,
        approvers: requestObj.approvers.map(a => a.role),
        expiresAt: new Date(requestObj.expiresAt).toISOString(),
      }
    );

    const auditLog = {
      id: `EVT-OTP-REQ-${Date.now()}`,
      timestamp,
      type: 'OTP_REQUESTED',
      title: `Dual-OTP Requested: ${challanNo}`,
      actor: operatorName.trim() || 'Godown Operator',
      details: `Generated dual approval codes for ${requestObj.approvers.map(a => a.role).join(' & ')}. Validity: 120s. Plaintext OTPs not logged.`,
      batchId: skippedBatches.map(b => b.batchId).join(', '),
      commodity,
      bay: skippedBatches.map(b => b.bay).join(', '),
      quantity: targetQty,
      prevHash,
      hash: eventHash,
    };

    dispatch({
      type: ACTION_TYPES.CREATE_OTP_REQUEST,
      payload: {
        request: requestObj,
        auditLog,
      },
    });

    setRequestId(newReqId);
    setOtpCodes({ supervisor: '', dso: '' });
  }, [violationDetails, state.challanCounter, state.auditLogs, commodity, reason, remarks, operatorName, targetQty, dispatch]);

  // Verify single approver OTP code
  const handleVerifySingleApprover = useCallback(async (approverId) => {
    if (!activeApproval) return;
    setErrorMessage('');

    if (lockoutTimeLeft > 0) {
      setErrorMessage(`System locked due to failed attempts. Please wait ${lockoutTimeLeft}s.`);
      return;
    }

    if (timeLeft <= 0) {
      setErrorMessage('OTP expired! Please click "Re-request OTPs" to generate fresh codes.');
      // Log expiration
      const timestamp = new Date().toISOString();
      const prevHash = state.auditLogs[0]?.hash || '0000000000000000000000000000000000000000000000000000000000000000';
      const eventHash = await createChainedEventHash(prevHash, timestamp, 'OTP_EXPIRED', { requestId: activeApproval.requestId });
      dispatch({
        type: ACTION_TYPES.RECORD_OTP_FAILED_ATTEMPT,
        payload: {
          requestId: activeApproval.requestId,
          isLockout: false,
          auditLog: {
            id: `EVT-EXP-${Date.now()}`,
            timestamp,
            type: 'OTP_EXPIRED',
            title: `OTP Expired: Request ${activeApproval.requestId}`,
            actor: 'System Security Enforcer',
            details: 'Entered OTP after 120s expiration window. Submission rejected.',
            prevHash,
            hash: eventHash,
          },
        },
      });
      return;
    }

    const enteredCode = otpCodes[approverId] || '';
    const approver = activeApproval.approvers.find(a => a.id === approverId);
    if (!approver) return;

    const isMatch = await verifyOtp(approver.salt, enteredCode, approver.otpHash);
    const timestamp = new Date().toISOString();
    const prevHash = state.auditLogs[0]?.hash || '0000000000000000000000000000000000000000000000000000000000000000';

    if (isMatch) {
      // Check if both will be verified
      const otherApprover = activeApproval.approvers.find(a => a.id !== approverId);
      const isAllVerified = REQUIRED_OTP_APPROVERS === 1 || (otherApprover && otherApprover.isVerified);

      const eventHash = await createChainedEventHash(
        prevHash,
        timestamp,
        'OTP_VERIFIED',
        {
          requestId: activeApproval.requestId,
          approverRole: approver.role,
          isAllVerified,
        }
      );

      const auditLog = {
        id: `EVT-OTP-VER-${Date.now()}`,
        timestamp,
        type: 'OTP_VERIFIED',
        title: `OTP Verified: ${approver.role}`,
        actor: approver.name,
        details: `Cryptographic SHA-256 match confirmed for ${approver.role}.`,
        prevHash,
        hash: eventHash,
      };

      dispatch({
        type: ACTION_TYPES.RECORD_OTP_SUCCESS,
        payload: {
          requestId: activeApproval.requestId,
          approverId,
          isAllVerified,
          auditLog,
        },
      });
    } else {
      // Wrong attempt
      const newAttempts = (activeApproval.failedAttempts || 0) + 1;
      const isLockout = newAttempts >= 3;
      const lockoutUntil = isLockout ? Date.now() + 30000 : null;

      const eventType = isLockout ? 'OTP_LOCKED' : 'OTP_FAILED';
      const eventHash = await createChainedEventHash(
        prevHash,
        timestamp,
        eventType,
        {
          requestId: activeApproval.requestId,
          approverRole: approver.role,
          failedAttempts: newAttempts,
        }
      );

      const auditLog = {
        id: `EVT-OTP-FAIL-${Date.now()}`,
        timestamp,
        type: eventType,
        title: isLockout ? `OTP Gate Locked (3 Failed Attempts)` : `OTP Verification Failed: ${approver.role}`,
        actor: 'Security Enforcer',
        details: isLockout 
          ? `3 consecutive wrong OTP entries. Request locked for 30 seconds.` 
          : `Invalid 6-digit code entered for ${approver.role}. Attempt ${newAttempts}/3.`,
        prevHash,
        hash: eventHash,
      };

      dispatch({
        type: ACTION_TYPES.RECORD_OTP_FAILED_ATTEMPT,
        payload: {
          requestId: activeApproval.requestId,
          isLockout,
          lockoutUntil,
          auditLog,
        },
      });

      if (isLockout) {
        setErrorMessage('3 wrong attempts! Security lockout active for 30 seconds.');
      } else {
        setErrorMessage(`Incorrect 6-digit OTP code (${newAttempts}/3 attempts). Check SMS in Approver view.`);
      }
    }
  }, [activeApproval, lockoutTimeLeft, timeLeft, otpCodes, state.auditLogs, dispatch]);

  // Final submit handler when both OTPs verified
  const handleSubmitApprovedException = useCallback(async (e) => {
    e.preventDefault();
    if (!operatorName.trim()) {
      alert('Operator Name is required.');
      return;
    }
    if (remarks.trim().length < 20) {
      alert('Official Justification Remarks must be at least 20 characters long.');
      return;
    }
    if (!activeApproval || !activeApproval.isVerified) {
      alert('Dual-OTP verification from both Supervisor and DSO is required to unlock dispatch.');
      return;
    }

    setIsSubmitting(true);

    const timestamp = new Date().toISOString();
    const prevHash = state.auditLogs[0]?.hash || '0000000000000000000000000000000000000000000000000000000000000000';
    
    const eventHash = await createChainedEventHash(
      prevHash,
      timestamp,
      'EXCEPTION_APPROVED',
      {
        requestId: activeApproval.requestId,
        reason,
        remarks,
        operatorName,
        approvers: activeApproval.approvers.map(a => a.role),
      }
    );

    const auditLog = {
      id: `EVT-EXC-APP-${Date.now()}`,
      timestamp,
      type: 'EXCEPTION_APPROVED',
      title: `Statutory Exception Approved: ${activeApproval.challanNo}`,
      actor: operatorName,
      details: `Exception granted. Reason: ${reason}. Approvers: ${activeApproval.approvers.map(a => a.role).join(' & ')}. Remarks: ${remarks}`,
      commodity,
      quantity: targetQty,
      prevHash,
      hash: eventHash,
    };

    onApproveException({
      reason,
      operatorName: operatorName.trim(),
      remarks: remarks.trim(),
      activeApproval,
      auditLog,
    });

    setIsSubmitting(false);
  }, [operatorName, remarks, activeApproval, reason, commodity, targetQty, state.auditLogs, onApproveException]);

  if (!isOpen) return null;

  const isFormValidToUnlock = 
    activeApproval?.isVerified && 
    operatorName.trim().length > 0 && 
    remarks.trim().length >= 20;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs select-none overflow-y-auto">
      <div className="bg-white border-2 border-[#b91c1c] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Official Statutory Header */}
        <div className="px-5 py-4 bg-[#b91c1c] text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white text-[#b91c1c] rounded-lg shadow-sm">
              <AlertOctagon className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-red-200">
                UTTAR PRADESH FOOD & CIVIL SUPPLIES DEPARTMENT • STATUTORY SKIP AUDIT GATE
              </div>
              <h3 className="text-base font-extrabold uppercase tracking-wide flex items-center gap-2">
                <span>FIFO VIOLATION DETECTED — DUAL-OTP APPROVAL MANDATORY</span>
              </h3>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-red-200 hover:text-white p-1 rounded-lg hover:bg-red-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs text-slate-800 max-h-[80vh] overflow-y-auto">
          {/* Violation Details Callout */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-950 space-y-1">
            <div className="flex items-center gap-2 font-bold text-xs text-[#b91c1c]">
              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
              <span>Statutory Violation Root Cause: Older Eligible Stock Skipped</span>
            </div>
            <p className="font-mono text-xs text-red-900 leading-relaxed">
              {violationDetails?.message || 'Newer batch chosen out of sequence.'}
            </p>
          </div>

          {/* Read-Only Auto-Filled Skipped Batches Summary */}
          {violationDetails && (
            <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg space-y-2 font-mono text-xs">
              <div className="font-bold text-[#0B2A5B] flex items-center gap-1.5 uppercase text-[11px]">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                <span>Auto-Filled Skipped Batches (Read-Only)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="text-slate-500 block text-[10px]">SKIPPED OLDER BATCH:</span>
                  <span className="font-bold text-red-700">#{violationDetails.olderBatchId}</span>
                  <div className="text-slate-600 text-[10px]">
                    Bay {violationDetails.olderBay} • {violationDetails.olderAge}d old • Unpicked: {violationDetails.olderUnpicked} Qtl
                  </div>
                </div>
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="text-slate-500 block text-[10px]">CHOSEN NEWER BATCH:</span>
                  <span className="font-bold text-amber-800">#{violationDetails.newerBatchId}</span>
                  <div className="text-slate-600 text-[10px]">
                    Bay {violationDetails.newerBay} • {violationDetails.newerAge}d old • Picked: {violationDetails.newerPick} Qtl
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form Fields: Reason, Operator, Remarks */}
          <div className="space-y-3">
            <div>
              <label className="block text-slate-800 font-bold mb-1">
                Statutory Reason for Override (अपवाद कारण) <span className="text-red-600">*</span>
              </label>
              <select
                id="exception-reason-select"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-slate-800 focus:outline-none focus:border-red-600 font-medium"
              >
                {EXCEPTION_REASONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-800 font-bold mb-1">
                Operator / Requester Name (ऑपरेटर का नाम) <span className="text-red-600">*</span>
              </label>
              <input
                id="exception-operator-input"
                type="text"
                placeholder="e.g. Ramesh Chandra (Senior Store Assistant)"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:border-red-600 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-800 font-bold mb-1 flex items-center justify-between">
                <span>Detailed Remarks & Justification (विस्तृत औचित्य - न्यूनतम 20 अक्षर) <span className="text-red-600">*</span></span>
                <span className={`text-[10px] font-mono ${remarks.length >= 20 ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                  {remarks.length} / 20 chars min
                </span>
              </label>
              <textarea
                id="exception-remarks-input"
                rows={2}
                placeholder="Specify inspection report number, moisture meter reading, or specific physical pathway obstruction..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:border-red-600 text-xs"
              />
            </div>
          </div>

          {/* DUAL-OTP SECTION */}
          <div className="p-4 bg-slate-100 rounded-xl border border-slate-300 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200 gap-2">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-[#0B2A5B]" />
                <h4 className="font-extrabold text-[#0B2A5B] uppercase tracking-wider text-xs">
                  Dual-OTP Approval Gate (2-अधिकारी अनुमोदन)
                </h4>
              </div>

              {!activeApproval ? (
                <button
                  id="btn-request-otps"
                  type="button"
                  onClick={handleRequestOtps}
                  className="px-3.5 py-1.5 rounded-lg bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Request Approval OTPs</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  {/* Countdown Timer */}
                  <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold flex items-center gap-1 ${
                    timeLeft > 30 ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-900 animate-pulse'
                  }`}>
                    <Clock className="h-3 w-3" />
                    <span>Expires in {timeLeft}s</span>
                  </span>

                  <button
                    type="button"
                    onClick={handleRequestOtps}
                    title="Invalidate current codes and generate fresh OTPs"
                    className="p-1.5 rounded bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs flex items-center gap-1 font-semibold"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-blue-700" />
                    <span>Re-request</span>
                  </button>
                </div>
              )}
            </div>

            {/* Simulated SMS Notice */}
            <div className="p-2 rounded bg-blue-50 border border-blue-200 text-[11px] text-blue-900 flex items-center justify-between">
              <span>
                <strong>SIMULATED SMS:</strong> Codes sent to handset Approver View (switch handset tab to <strong>Approver</strong> to inspect & approve).
              </span>
              <span className="text-[10px] font-mono font-bold bg-blue-100 px-1.5 py-0.5 rounded text-blue-800">
                {activeApproval ? `REQ #${activeApproval.requestId}` : 'Ready'}
              </span>
            </div>

            {/* Error / Lockout Banner */}
            {errorMessage && (
              <div className="p-2 rounded bg-red-100 border border-red-300 text-red-900 text-xs font-bold animate-pulse">
                {errorMessage}
              </div>
            )}

            {/* Approver OTP Verification Boxes */}
            {activeApproval && (
              <div className="space-y-3 pt-1">
                {activeApproval.approvers.map((app) => {
                  const isVerified = app.isVerified;
                  const isLocked = lockoutTimeLeft > 0;

                  return (
                    <div
                      key={app.id}
                      className={`p-3 rounded-lg border transition-all ${
                        isVerified
                          ? 'bg-emerald-50 border-emerald-400'
                          : 'bg-white border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-amber-600" />
                            <span>{app.role}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {app.name}
                          </div>
                        </div>

                        {isVerified ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold font-mono flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-700" />
                            <span>VERIFIED</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono">
                            Pending 6-digit code
                          </span>
                        )}
                      </div>

                      {!isVerified && (
                        <div className="space-y-2">
                          <OtpBoxesInput
                            idPrefix={app.id}
                            value={otpCodes[app.id] || ''}
                            disabled={isLocked || timeLeft <= 0}
                            onChange={(code) => setOtpCodes(prev => ({ ...prev, [app.id]: code }))}
                          />

                          <div className="flex justify-end pt-1">
                            <button
                              id={`btn-verify-${app.id}`}
                              type="button"
                              disabled={isLocked || timeLeft <= 0 || (otpCodes[app.id] || '').length !== 6}
                              onClick={() => handleVerifySingleApprover(app.id)}
                              className="px-3 py-1 rounded-md bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-1 disabled:opacity-40 transition-colors shadow-xs"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              <span>Verify {app.role.split(' ')[0]} OTP</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-300 transition-colors text-xs"
            >
              Cancel & Revert to FIFO
            </button>

            <button
              id="submit-exception-btn"
              type="button"
              disabled={!isFormValidToUnlock || isSubmitting}
              onClick={handleSubmitApprovedException}
              className={`px-5 py-2.5 rounded-lg font-bold text-xs flex items-center gap-2 shadow-sm transition-all ${
                isFormValidToUnlock
                  ? 'bg-[#138808] hover:bg-emerald-700 text-white shadow-md active:scale-95'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
              }`}
            >
              <Stamp className="h-4 w-4" />
              <span>{isFormValidToUnlock ? 'Authorize Override & Unlock Dispatch' : 'Dispatch Locked (Awaiting Dual-OTP)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
