import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../context/store';
import { useI18n } from '../../i18n/I18nContext';
import { apiClient } from '../../services/apiClient';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  KeyRound, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  FileText,
  UserCheck,
  Building2,
  Lock
} from 'lucide-react';

export function DsoApprovalsView({ onNavigateToExceptions, onNavigateToTraceability }) {
  const { state, refreshServerState } = useStore();
  const { isHindi } = useI18n();

  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [decisionFeedback, setDecisionFeedback] = useState(null);

  const loadApprovals = useCallback(async () => {
    setLoading(true);
    try {
      if (state.backendConnected) {
        const data = await apiClient.getPendingApprovals();
        setPendingApprovals(Array.isArray(data) ? data : []);
      } else {
        // Fallback to local store
        const local = (state.approvals || []).filter(a => !a.isVerified && !a.isRejected);
        setPendingApprovals(local);
      }
    } catch (err) {
      console.warn('Failed to fetch pending approvals, using local state:', err);
      const local = (state.approvals || []).filter(a => !a.isVerified && !a.isRejected);
      setPendingApprovals(local);
    } finally {
      setLoading(false);
    }
  }, [state.backendConnected, state.approvals]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const handleDecision = async (id, decision) => {
    try {
      setLoading(true);
      if (state.backendConnected) {
        const res = await apiClient.decideApproval(id, decision);
        setDecisionFeedback({
          type: 'success',
          message: decision === 'APPROVE'
            ? (isHindi 
                ? `अपवाद स्वीकृत! सिम्युलेटेड ओटीपी: ${res?.simulated_otp || '603847'}` 
                : `Exception Approved! Simulated DSO OTP: ${res?.simulated_otp || '603847'}`)
            : (isHindi ? 'अपवाद अस्वीकृत कर दिया गया।' : 'Exception rejected by DSO.'),
        });
        if (refreshServerState) await refreshServerState();
      } else {
        setDecisionFeedback({
          type: 'success',
          message: decision === 'APPROVE'
            ? (isHindi ? 'स्थानीय सत्र में अपवाद स्वीकृत।' : 'Exception approved in offline session.')
            : (isHindi ? 'स्थानीय सत्र में अपवाद अस्वीकृत।' : 'Exception rejected in offline session.'),
        });
      }
      await loadApprovals();
    } catch (err) {
      setDecisionFeedback({
        type: 'error',
        message: err.message || 'Action failed',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* DSO Header Banner */}
      <div className="bg-amber-900/90 text-white p-4 sm:p-5 rounded-lg border border-amber-700 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-400 text-slate-950">
              {isHindi ? 'अधिकारी नियंत्रण कक्ष' : 'Executive Authority'}
            </span>
            <span className="text-xs text-amber-200 font-mono">
              Role: District Supply Officer (DSO)
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black mt-1">
            {isHindi 
              ? 'वैधानिक FIFO अपवाद अनुमोदन एवं सतर्कता डैशबोर्ड' 
              : 'Statutory FIFO Exception Approval & Vigilance Queue'}
          </h2>
          <p className="text-xs text-amber-100/90 mt-1 max-w-2xl">
            {isHindi 
              ? 'सार्वजनिक वितरण प्रणाली (PDS) नियमों के तहत गैर-FIFO बैच प्रेषण के लिए जिला पूर्ति अधिकारी का 2-चरणीय डिजिटल अनुमोदन अनिवार्य है।'
              : 'DSO dual-OTP authorization is statutorily mandated to override chronological FIFO grain allocations in Gautam Buddha Nagar.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadApprovals}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-700/80 hover:bg-amber-600 text-white rounded text-xs font-bold transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{isHindi ? 'ताज़ा करें' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {decisionFeedback && (
        <div className={`p-3 rounded-lg text-xs font-bold border flex items-center justify-between ${
          decisionFeedback.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border-emerald-300' 
            : 'bg-rose-50 text-rose-900 border-rose-300'
        }`}>
          <span>{decisionFeedback.message}</span>
          <button 
            type="button" 
            onClick={() => setDecisionFeedback(null)} 
            className="text-xs underline ml-2 cursor-pointer"
          >
            {isHindi ? 'बंद करें' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* Pending Queue List */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <span>{isHindi ? 'लंबित वैधानिक अनुमोदन मांग' : 'Pending Authorization Requests'}</span>
            <span className="bg-amber-100 text-amber-900 text-xs px-2 py-0.5 rounded-full font-mono">
              {pendingApprovals.length}
            </span>
          </h3>
        </div>

        {pendingApprovals.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h4 className="text-base font-bold text-slate-800">
              {isHindi ? 'कोई लंबित वैधानिक अपवाद नहीं है' : 'All Statutory Allocations Fully Compliant'}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mt-1">
              {isHindi 
                ? 'वर्तमान में सूरजपुर बेस गोदाम में कोई भी गैर-FIFO उल्लंघन अनुमोदन हेतु लंबित नहीं है।'
                : 'Zero statutory FIFO bypass requests pending. All dispatched consignments adhere to oldest-first grain rotation.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            {pendingApprovals.map((req) => (
              <div 
                key={req.id || req.requestId} 
                className="p-4 rounded-lg border border-amber-300 bg-amber-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white uppercase">
                      FIFO Violation Override
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-700">
                      Challan #{req.challan_id || req.challanId || 'CHL-DEMO'}
                    </span>
                    <span className="text-xs text-slate-500">
                      Role: {req.role || 'DSO'}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-slate-900">
                    {isHindi ? 'उचित दर दुकान चालान हेतु नवीन बैच प्रेषण अनुमति अनुरोध' : 'Fresh Batch Allocation Exception Request'}
                  </p>
                  <p className="text-xs text-slate-600 font-mono">
                    Created: {new Date(req.created_at || req.timestamp || Date.now()).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDecision(req.id || req.requestId, 'APPROVE')}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-xs transition-colors"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{isHindi ? 'स्वीकारें व ओटीपी जारी करें' : 'Approve & Reveal OTP'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDecision(req.id || req.requestId, 'REJECT')}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold shadow-xs transition-colors"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>{isHindi ? 'अस्वीकार करें' : 'Reject'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
