import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle2, XCircle, Clock, AlertTriangle, Key, Copy, Check } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { useI18n } from '../../i18n/I18nContext';

export function ExceptionQueue({ exceptions = [], onDecisionCompleted }) {
  const { isHindi } = useI18n();

  const [revealedOtps, setRevealedOtps] = useState({}); // { [excId]: otpCode }
  const [copiedId, setCopiedId] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [rejectModalExc, setRejectModalExc] = useState(null);
  const [rejectRemarks, setRejectRemarks] = useState('');

  const handleApprove = async (exc) => {
    setProcessingId(exc.id);
    try {
      // Find pending OTP request ID for this challan
      const pendingReqs = await apiClient.getPendingApprovals();
      const match = pendingReqs.find(p => p.challan_id === exc.id || p.challan_no === exc.challan_no);
      const reqId = match ? match.id : exc.id;

      const res = await apiClient.makeApproverDecision(reqId, 'APPROVE');
      if (res.simulated_sms_otp) {
        setRevealedOtps(prev => ({ ...prev, [exc.id]: res.simulated_sms_otp }));
      }
      if (onDecisionCompleted) onDecisionCompleted();
    } catch (err) {
      alert(err.message || 'Failed to approve exception');
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalExc) return;
    setProcessingId(rejectModalExc.id);

    try {
      const pendingReqs = await apiClient.getPendingApprovals();
      const match = pendingReqs.find(p => p.challan_id === rejectModalExc.id || p.challan_no === rejectModalExc.challan_no);
      const reqId = match ? match.id : rejectModalExc.id;

      await apiClient.makeApproverDecision(reqId, 'REJECT', rejectRemarks);
      setRejectModalExc(null);
      setRejectRemarks('');
      if (onDecisionCompleted) onDecisionCompleted();
    } catch (err) {
      alert(err.message || 'Failed to reject exception');
    } finally {
      setProcessingId(null);
    }
  };

  const copyToClipboard = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <span>{isHindi ? 'लंबित वैधानिक FIFO अपवाद अनुरोध (Pending FIFO Exceptions)' : 'Pending Statutory FIFO Exception Authorizations'}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {isHindi 
              ? 'खाद्य विभाग के नियमों के अनुसार ताज़ा बैच को पहले भेजने हेतु जिला आपूर्ति अधिकारी (DSO) का अनुमोदन अनिवार्य है'
              : 'Statutory override authorization required by District Supply Officer (DSO) for non-FIFO dispatches'}
          </p>
        </div>
        <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
          {exceptions.length} {isHindi ? 'लंबित' : 'Pending Authorization'}
        </span>
      </div>

      {exceptions.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
          <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
          <p className="font-bold text-slate-800 text-sm">
            {isHindi ? 'कोई लंबित FIFO अपवाद अनुरोध नहीं है' : 'No pending exception authorizations'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {isHindi 
              ? 'गोदाम में सभी आवंटन 100% FIFO नियमों का पालन कर रहे हैं।' 
              : 'All godown dispatches currently maintain 100% strict First-In-First-Out compliance.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {exceptions.map((exc) => {
            const revealedOtp = revealedOtps[exc.id];
            const isActing = processingId === exc.id;

            return (
              <div
                key={exc.id || exc.challan_no}
                className="bg-white rounded-lg border-2 border-amber-300 p-4 shadow-xs space-y-3 relative overflow-hidden"
              >
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-slate-900">
                      {exc.challan_no}
                    </span>
                    <span className="text-xs font-sans text-slate-500">➜</span>
                    <span className="font-bold text-xs text-[#0B2A5B]">
                      {exc.fps_name} ({exc.fps_code})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                      <Clock className="h-3 w-3 text-amber-700 animate-spin" />
                      <span>TTL: {exc.expires_in_seconds}s</span>
                    </span>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-amber-50/50 rounded p-2.5 border border-amber-200/60">
                    <span className="text-slate-500 text-[11px] block">{isHindi ? 'जिंस व मात्रा:' : 'Commodity & Quantity:'}</span>
                    <span className="font-bold text-slate-900 text-xs">
                      {exc.ui_commodity || exc.commodity}
                    </span>
                    <span className="font-mono font-black text-amber-950 block text-sm">
                      {exc.requested_qty} Qtl
                    </span>
                  </div>

                  <div className="bg-amber-50/50 rounded p-2.5 border border-amber-200/60">
                    <span className="text-slate-500 text-[11px] block">{isHindi ? 'उल्लंघन प्रकार:' : 'Violation Details:'}</span>
                    <div className="text-[11px] text-slate-800 font-semibold mt-0.5">
                      Chosen newer: <strong className="font-mono text-rose-700">#{exc.chosen_batches?.join(', ')}</strong>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Bypassed older: {exc.skipped_older_batches?.join(', ')}
                    </div>
                  </div>

                  <div className="bg-amber-50/50 rounded p-2.5 border border-amber-200/60">
                    <span className="text-slate-500 text-[11px] block">{isHindi ? 'अपवाद कारण (Statutory Reason):' : 'Reason / Remarks:'}</span>
                    <span className="font-bold text-slate-900 text-[11px] block mt-0.5">
                      {exc.exception_reason}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Approver: {exc.pending_approver_role}
                    </span>
                  </div>
                </div>

                {/* Simulated SMS Box (Revealed upon Approve) */}
                {revealedOtp ? (
                  <div className="bg-emerald-50 border-2 border-emerald-400 rounded-lg p-3.5 space-y-2 animate-in zoom-in-95">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-emerald-700" />
                        <span className="font-bold text-xs text-emerald-950 uppercase tracking-wider">
                          {isHindi ? 'सिम्युलेटेड एसएमएस - केवल डेमो हेतु (Simulated SMS - Demo Only)' : 'SIMULATED SMS - Demo Only'}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-200/60 px-2 py-0.5 rounded">
                        120s Expiry
                      </span>
                    </div>

                    <p className="text-xs text-slate-700">
                      OTP generated server-side via cryptographic secrets. Type this OTP in the AnnaSetu Godown portal to unlock dispatch:
                    </p>

                    <div className="flex items-center gap-3">
                      <div className="font-mono text-2xl font-black tracking-widest text-emerald-950 bg-white px-4 py-1.5 rounded border border-emerald-300 shadow-inner">
                        {revealedOtp}
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(exc.id, revealedOtp)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded transition-colors shadow-xs"
                      >
                        {copiedId === exc.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedId === exc.id ? 'Copied' : 'Copy OTP'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Action Buttons: Approve / Reject */
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-amber-100">
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() => setRejectModalExc(exc)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs font-bold rounded transition-colors"
                    >
                      <XCircle className="h-3.5 w-3.5 text-rose-600" />
                      <span>{isHindi ? 'अस्वीकार करें (Reject)' : 'Reject Exception'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() => handleApprove(exc)}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded shadow-xs transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                      <span>{isHindi ? 'अनुमोदित करें और ओटीपी देखें' : 'Approve & Reveal Simulated OTP'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Confirmation Modal */}
      {rejectModalExc && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-xl border border-slate-300 shadow-2xl p-5 space-y-4 text-xs">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              <span>{isHindi ? 'FIFO अपवाद अस्वीकृति की पुष्टि' : 'Confirm FIFO Exception Rejection'}</span>
            </h4>
            <p className="text-slate-600">
              Rejecting challan <strong>{rejectModalExc.challan_no}</strong> will permanently block dispatch and log <code>EXCEPTION_REJECTED</code> in the vigilance ledger.
            </p>
            <div>
              <label htmlFor="reject-remarks-input" className="block font-bold text-slate-700 mb-1">
                {isHindi ? 'अस्वीकृति का वैधानिक कारण:' : 'Statutory Rejection Reason:'}
              </label>
              <input
                id="reject-remarks-input"
                type="text"
                placeholder="e.g. Mandatory FIFO violation not justified"
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setRejectModalExc(null)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded shadow-xs"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
