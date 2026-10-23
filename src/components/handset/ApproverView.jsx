import React, { useCallback } from 'react';
import { useStore } from '../../context/store';
import { ACTION_TYPES } from '../../context/actions';
import { useI18n } from '../../i18n/I18nContext';
import { createChainedEventHash } from '../../services/cryptoService';
import { 
  Building2, 
  KeyRound, 
  CheckCircle, 
  XCircle, 
  Clock, 
  MessageSquare, 
  AlertTriangle,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

export const ApproverView = React.memo(function ApproverView() {
  const { state, dispatch } = useStore();
  const { t, tCommodity } = useI18n();

  // Find the latest pending or active approval request
  const pendingRequests = state.approvals.filter(a => !a.isVerified && !a.isRejected);
  const activeRequest = pendingRequests[0] || state.approvals[0] || null;

  // Handle Approver unlocking their OTP
  const handleApproveRole = useCallback((requestId, approverId) => {
    dispatch({
      type: ACTION_TYPES.APPROVE_OTP_ROLE,
      payload: { requestId, approverId },
    });
  }, [dispatch]);

  // Handle Approver rejecting the override request
  const handleRejectRequest = useCallback(async (requestId, approverRole) => {
    const timestamp = new Date().toISOString();
    const prevHash = state.auditLogs[0]?.hash || '0000000000000000000000000000000000000000000000000000000000000000';
    
    const eventHash = await createChainedEventHash(
      prevHash,
      timestamp,
      'EXCEPTION_REJECTED',
      {
        requestId,
        rejectedBy: approverRole,
      }
    );

    const auditLog = {
      id: `EVT-REJ-${Date.now()}`,
      timestamp,
      type: 'EXCEPTION_REJECTED',
      title: `FIFO Exception Rejected by ${approverRole}`,
      actor: approverRole,
      details: `Statutory override request ${requestId} explicitly rejected. Dispatch remains locked.`,
      prevHash,
      hash: eventHash,
    };

    dispatch({
      type: ACTION_TYPES.REJECT_OTP_ROLE,
      payload: {
        requestId,
        auditLog,
      },
    });
  }, [state.auditLogs, dispatch]);

  if (!activeRequest) {
    return (
      <div className="py-16 text-center space-y-3 px-4 text-slate-700">
        <div className="h-12 w-12 rounded-full bg-slate-100 border border-slate-300 text-slate-400 flex items-center justify-center mx-auto">
          <KeyRound className="h-6 w-6 text-[#0B2A5B]" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-slate-800">
            No Pending Approvals
          </h4>
          <p className="text-[10px] text-slate-500 max-w-[200px] mx-auto mt-1">
            When an operator requests a FIFO override, dual approval requests will appear here for Supervisor and DSO.
          </p>
        </div>
        <div className="text-[10px] font-mono text-blue-800 bg-blue-50 p-2 rounded border border-blue-200">
          DSO & Supervisor Terminal Mesh Ready
        </div>
      </div>
    );
  }

  const isExpired = Date.now() > activeRequest.expiresAt;

  return (
    <div className="space-y-3 p-1">
      {/* Simulated SMS Tag or Offline Notice */}
      {state.networkMode === 'OFFLINE' ? (
        <div className="p-2 rounded bg-amber-100 border border-amber-400 text-amber-950 text-[10px] space-y-0.5 font-bold">
          <div className="flex items-center gap-1 text-amber-800">
            <AlertTriangle className="h-3 w-3 text-amber-700" />
            <span>Needs network (Simulated SMS gateway offline)</span>
          </div>
          <div className="text-[9px] text-amber-900 font-normal">
            Role: <strong>Offline approval - verified on sync</strong>
          </div>
        </div>
      ) : (
        <div className="p-2 rounded bg-amber-50 border border-amber-300 text-amber-950 text-[10px] flex items-center justify-between font-bold">
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3 text-amber-600" />
            <span>SIMULATED SMS - DEMO ONLY</span>
          </span>
          <span className="font-mono text-slate-600">REQ #{activeRequest.requestId}</span>
        </div>
      )}

      {/* Override Request Context Card */}
      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
        <div className="flex items-center justify-between font-mono text-[10px]">
          <span className="font-bold text-slate-900">{activeRequest.challanNo}</span>
          <span className={`px-1.5 py-0.2 rounded font-bold ${
            activeRequest.isRejected 
              ? 'bg-red-100 text-red-900' 
              : activeRequest.isVerified
              ? 'bg-emerald-100 text-emerald-900'
              : 'bg-amber-100 text-amber-900'
          }`}>
            {activeRequest.isRejected ? 'REJECTED' : activeRequest.isVerified ? 'APPROVED' : 'PENDING'}
          </span>
        </div>

        <div className="text-[11px] font-medium text-slate-800">
          Reason: <strong className="text-red-700">{activeRequest.reason}</strong>
        </div>

        <div className="text-[10px] text-slate-600 italic bg-white p-1.5 rounded border border-slate-200">
          "{activeRequest.remarks}"
        </div>

        {/* Skipped vs Chosen */}
        <div className="text-[10px] font-mono flex items-center justify-between pt-1 border-t border-slate-200">
          <span className="text-red-700 font-semibold">
            Skip: #{activeRequest.skippedBatches?.[0]?.batchId} ({activeRequest.skippedBatches?.[0]?.ageDays}d)
          </span>
          <ArrowRight className="h-3 w-3 text-slate-400" />
          <span className="text-amber-800 font-semibold">
            Pick: #{activeRequest.chosenBatches?.[0]?.batchId} ({activeRequest.chosenBatches?.[0]?.ageDays}d)
          </span>
        </div>
      </div>

      {/* Approver Cards: Supervisor & DSO */}
      <div className="space-y-2">
        {activeRequest.approvers.map((app) => (
          <div
            key={app.id}
            className={`p-2.5 rounded-lg border space-y-2 transition-all ${
              app.isVerified
                ? 'bg-emerald-50 border-emerald-300'
                : 'bg-white border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-[11px] text-slate-900 flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-amber-600" />
                  <span>{app.role}</span>
                </div>
                <div className="text-[9px] text-slate-500 font-mono">
                  {app.name}
                </div>
              </div>

              {app.isVerified ? (
                <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-emerald-100 text-emerald-900 flex items-center gap-0.5">
                  <CheckCircle className="h-2.5 w-2.5 text-emerald-700" />
                  <span>VERIFIED</span>
                </span>
              ) : app.isRevealed ? (
                <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-blue-100 text-blue-900">
                  CODE SENT
                </span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-slate-100 text-slate-600">
                  AWAITING REVIEW
                </span>
              )}
            </div>

            {/* Revealed Simulated SMS Bubble */}
            {app.isRevealed ? (
              <div className="p-2 rounded bg-blue-50 border border-blue-300 text-center space-y-1">
                <div className="text-[9px] text-blue-800 uppercase font-bold tracking-wider">
                  Official 6-Digit Approval OTP:
                </div>
                <div className="text-lg font-mono font-black tracking-widest text-[#0B2A5B] bg-white py-1 rounded border border-blue-200 shadow-inner">
                  {app.plaintextCode}
                </div>
                <div className="text-[9px] text-slate-500 font-mono">
                  Enter this code in the Exception Modal
                </div>
              </div>
            ) : !activeRequest.isRejected && (
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  id={`btn-approver-reveal-${app.id}`}
                  type="button"
                  onClick={() => handleApproveRole(activeRequest.requestId, app.id)}
                  className="flex-1 py-1.5 rounded bg-[#138808] hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center justify-center gap-1 shadow-xs"
                >
                  <CheckCircle className="h-3 w-3" />
                  <span>Approve & Reveal OTP</span>
                </button>

                <button
                  id={`btn-approver-reject-${app.id}`}
                  type="button"
                  onClick={() => handleRejectRequest(activeRequest.requestId, app.role)}
                  className="py-1.5 px-2 rounded bg-red-100 hover:bg-red-200 text-red-800 font-bold text-[10px] flex items-center justify-center gap-1 border border-red-300"
                >
                  <XCircle className="h-3 w-3" />
                  <span>Reject</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
