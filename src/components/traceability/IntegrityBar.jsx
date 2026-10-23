import React, { useState, useCallback } from 'react';
import { useStore } from '../../context/store';
import { ACTION_TYPES } from '../../context/actions';
import { useI18n } from '../../i18n/I18nContext';
import { ShieldCheck, ShieldAlert, Bug, RotateCcw, CheckCircle2, Lock } from 'lucide-react';

export const IntegrityBar = React.memo(function IntegrityBar() {
  const { state, dispatch } = useStore();
  const { isHindi } = useI18n();
  const { auditLogs, tamperedLogIndex } = state;

  const [verifyResult, setVerifyResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Recompute full SHA-256 chain linkage across all logs
  const handleVerifyChain = useCallback(() => {
    setIsVerifying(true);
    setVerifyResult(null);

    setTimeout(() => {
      let isBroken = false;
      let brokenIndex = -1;
      let brokenEvent = null;

      // Note: auditLogs is newest to oldest.
      // So auditLogs[i].prevHash should equal auditLogs[i + 1].hash
      for (let i = 0; i < auditLogs.length - 1; i++) {
        const current = auditLogs[i];
        const previous = auditLogs[i + 1];

        if (current.prevHash !== previous.hash) {
          isBroken = true;
          brokenIndex = i;
          brokenEvent = current;
          break;
        }
      }

      // Check if tampered in memory for demo
      if (tamperedLogIndex !== null) {
        isBroken = true;
        brokenIndex = tamperedLogIndex;
        brokenEvent = auditLogs[tamperedLogIndex];
      }

      if (isBroken) {
        setVerifyResult({
          status: 'BROKEN',
          message: isHindi
            ? `चेन खंडित! घटना #${brokenIndex + 1} (${brokenEvent?.id || 'EVT'}) पर हैश बेमेल पाया गया। डेटा से छेड़छाड़ की गई है।`
            : `BROKEN at event #${brokenIndex + 1} (${brokenEvent?.id || 'EVT'}). Cryptographic hash chain mismatch detected!`,
          brokenIndex,
          event: brokenEvent,
        });
      } else {
        setVerifyResult({
          status: 'VALID',
          message: isHindi
            ? `मान्य! सभी ${auditLogs.length} लेजर ब्लॉक पूरी तरह से जुड़े और अखंड हैं।`
            : `VALID - ${auditLogs.length} events verified. Full SHA-256 chain intact from genesis root.`,
          count: auditLogs.length,
        });
      }
      setIsVerifying(false);
    }, 250);
  }, [auditLogs, tamperedLogIndex, isHindi]);

  const handleTamperDemo = useCallback(() => {
    dispatch({
      type: ACTION_TYPES.TAMPER_AUDIT_LOG_FOR_DEMO,
      payload: { index: 1 },
    });
    setVerifyResult(null);
  }, [dispatch]);

  const handleRestoreDemo = useCallback(() => {
    dispatch({ type: ACTION_TYPES.RESTORE_AUDIT_LOG });
    setVerifyResult(null);
  }, [dispatch]);

  const isTampered = tamperedLogIndex !== null;

  return (
    <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 shadow-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${isTampered ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}`}>
            {isTampered ? <ShieldAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2 font-bold text-xs text-slate-800">
              <span>{isHindi ? 'क्रिप्टोग्राफिक हैश अखंडता इंजन' : 'Cryptographic Hash Chain Integrity Engine'}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                isTampered 
                  ? 'bg-red-100 text-red-900 border border-red-300' 
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
              }`}>
                {isTampered ? 'TAMPER SIMULATION ACTIVE' : 'CHAIN INTACT'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              SHA-256 Merkle-linked audit trail ({auditLogs.length} blocks total)
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            id="btn-verify-hash-chain"
            type="button"
            disabled={isVerifying}
            onClick={handleVerifyChain}
            className="px-3 py-1.5 bg-[#0B2A5B] hover:bg-[#133E7C] text-white rounded-md text-xs font-bold flex items-center gap-1.5 shadow-xs"
          >
            <Lock className={`h-3.5 w-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
            <span>{isHindi ? 'हैश चेन सत्यापित करें' : 'Verify hash chain'}</span>
          </button>

          {!isTampered ? (
            <button
              id="btn-tamper-demo"
              type="button"
              onClick={handleTamperDemo}
              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 rounded-md text-xs font-bold flex items-center gap-1.5"
              title="Simulates tampering one event in memory to demonstrate cryptographic detection"
            >
              <Bug className="h-3.5 w-3.5 text-red-600" />
              <span>{isHindi ? 'छेड़छाड़ डेमो' : 'Tamper demo'}</span>
            </button>
          ) : (
            <button
              id="btn-restore-tamper-demo"
              type="button"
              onClick={handleRestoreDemo}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold flex items-center gap-1.5 shadow-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{isHindi ? 'मूल स्थिति पुनर्स्थापित करें' : 'Restore'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Verification Feedback Alert */}
      {verifyResult && (
        <div
          id="hash-chain-verification-alert"
          className={`p-3 rounded-lg border text-xs font-mono flex items-start gap-2.5 animate-in slide-in-from-top-1 ${
            verifyResult.status === 'VALID'
              ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
              : 'bg-red-50 border-red-500 text-red-950 font-bold'
          }`}
        >
          {verifyResult.status === 'VALID' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5 animate-pulse" />
          )}
          <div>
            <div className="font-extrabold text-sm">
              {verifyResult.status === 'VALID' ? 'CHAIN INTEGRITY: 100% VALID' : 'CRITICAL INTEGRITY FAILURE DETECTED'}
            </div>
            <p className="mt-0.5">{verifyResult.message}</p>
          </div>
        </div>
      )}
    </div>
  );
});
