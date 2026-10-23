import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../context/store';
import { ACTION_TYPES } from '../../context/actions';
import { useI18n } from '../../i18n/I18nContext';
import { createChainedEventHash } from '../../services/cryptoService';
import { playSuccessChime, playEmergencySiren } from '../../services/audioService';
import { revalidateDispatchAllocations } from '../../services/fifoEngine';
import { calculateAgeDays, QUALITY_STATUS, BAYS } from '../../types/models';
import { ApproverView } from './ApproverView';
import { verifyChallanIntegrity } from '../../services/challanService';
import { 
  Smartphone, 
  QrCode, 
  CheckCircle, 
  AlertOctagon, 
  Warehouse, 
  Truck, 
  Wifi, 
  Battery, 
  X, 
  Layers, 
  Check,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  AlertTriangle,
  WifiOff,
  Copy
} from 'lucide-react';

import { apiClient } from '../../services/apiClient';

export const WorkerSimulator = React.memo(function WorkerSimulator({ onClose }) {
  const { state, dispatch, refreshServerState } = useStore();
  const { activeChallan, mobileScanResult, batches, isAlarmActive } = state;
  const { t, tCommodity } = useI18n();

  const [activeRole, setActiveRole] = useState('worker'); // 'worker' | 'approver'
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stepSuccessMsg, setStepSuccessMsg] = useState(null);
  const [qrVerificationResult, setQrVerificationResult] = useState(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Listen for official role handset mode switch (DSO -> Approver, Godown Manager -> Worker)
  useEffect(() => {
    function handleModeChange(e) {
      if (e?.detail?.mode) {
        setActiveRole(e.detail.mode);
      }
    }
    window.addEventListener('annasetu:handset-mode-change', handleModeChange);
    return () => window.removeEventListener('annasetu:handset-mode-change', handleModeChange);
  }, []);

  // Auto-switch to Approver tab if pending approvals arrive
  const pendingApprovalsCount = (state.approvals || []).filter(a => !a.isVerified && !a.isRejected).length;

  // Reset step index whenever a new challan is staged
  useEffect(() => {
    setCurrentStepIndex(0);
    setStepSuccessMsg(null);
    setQrVerificationResult(null);
  }, [activeChallan?.challanId]);

  // Reset verification result if tamper state changes
  useEffect(() => {
    setQrVerificationResult(null);
  }, [state.isTamperedForTest]);

  const totalSteps = activeChallan?.allocations?.length || 0;
  const currentAlloc = activeChallan?.allocations?.[currentStepIndex];

  // Verify Challan QR with canonical SHA-256 hash
  const handleVerifyChallanQr = useCallback(async () => {
    if (!activeChallan) return;
    setIsProcessing(true);
    try {
      const prevHash = state.auditLogs[0]?.hash || '0000000000000000000000000000000000000000000000000000000000000000';
      const result = await verifyChallanIntegrity(activeChallan, prevHash);
      if (result.isValid) {
        playSuccessChime();
        setQrVerificationResult({
          isValid: true,
          message: `${t('handset.verifiedOk')} (${activeChallan.challanNo || activeChallan.challanId})`,
        });
      } else {
        playEmergencySiren();
        setQrVerificationResult({
          isValid: false,
          message: t('handset.tamperedAlert'),
        });
      }
    } catch (err) {
      console.error('QR verification error:', err);
      setQrVerificationResult({
        isValid: false,
        message: t('handset.tamperedAlert'),
      });
    } finally {
      setIsProcessing(false);
    }
  }, [activeChallan, state.auditLogs, t]);

  // Toggle Tamper Simulation (+5 Qtl delta)
  const handleToggleTamperTest = useCallback(() => {
    dispatch({
      type: ACTION_TYPES.TAMPER_CHALLAN_FOR_TEST,
      payload: { isTampered: !state.isTamperedForTest },
    });
  }, [state.isTamperedForTest, dispatch]);

  // 1. Simulate Scanning Correct Oldest Batch QR (Step-by-step progress #5)
  const handleScanCorrect = useCallback(async () => {
    if (!activeChallan || !currentAlloc || isProcessing) return;
    setIsProcessing(true);

    try {
      playSuccessChime();

      // Check if more steps remain before final dispatch
      if (currentStepIndex < totalSteps - 1) {
        setStepSuccessMsg(`Step ${currentStepIndex + 1}/${totalSteps} Validated: Picked ${currentAlloc.take} Qtl from #${currentAlloc.batchId} in Bay ${currentAlloc.bay}`);
        setCurrentStepIndex(prev => prev + 1);
        dispatch({ type: ACTION_TYPES.ADVANCE_PICKING_STEP });
        setIsProcessing(false);
        return;
      }

      // Final step scan -> Revalidate and finalize dispatch (#2)
      const revalidation = revalidateDispatchAllocations(batches, activeChallan.allocations);
      if (!revalidation.isValid) {
        alert('Dispatch error: ' + revalidation.error);
        setIsProcessing(false);
        return;
      }

      // ASYNC SHA-256 OUTSIDE REDUCER (#1)
      const timestamp = new Date().toISOString();
      const prevHash = state.auditLogs[0]?.hash || '0000000000000000000000000000000000000000000000000000000000000000';
      
      const eventHash = await createChainedEventHash(
        prevHash,
        timestamp,
        'DISPATCH_COMPLETED',
        {
          challanId: activeChallan.challanId,
          fps: activeChallan.fps.name,
          commodity: activeChallan.commodity,
          quantity: activeChallan.requestedQty,
          allocations: activeChallan.allocations,
        }
      );

      const auditLog = {
        id: `EVT-DSP-${Date.now()}`,
        timestamp,
        type: 'DISPATCH_COMPLETED',
        title: `Dispatch Confirmed: ${activeChallan.commodity} ➜ ${activeChallan.fps.name}`,
        actor: 'Worker Handset #W-402 (Ram Kumar)',
        details: `Verified FIFO loading of ${activeChallan.requestedQty} Qtl across ${activeChallan.allocations.length} bays: ${activeChallan.allocations.map(a => `${a.batchId} (${a.take} Qtl in Bay ${a.bay})`).join(', ')}`,
        batchId: activeChallan.allocations.map(a => a.batchId).join(', '),
        commodity: activeChallan.commodity,
        bay: activeChallan.allocations.map(a => a.bay).join(', '),
        quantity: activeChallan.requestedQty,
        prevHash,
        hash: eventHash,
      };

      dispatch({
        type: ACTION_TYPES.CONFIRM_PICKING_SUCCESS,
        payload: { auditLog },
      });

      if (state.backendConnected && activeChallan.id) {
        try {
          await apiClient.dispatchChallan(activeChallan.id);
          if (refreshServerState) await refreshServerState();
        } catch (e) {
          console.warn('Backend dispatch sync error:', e);
        }
      }

      setStepSuccessMsg(null);
      setIsProcessing(false);
    } catch (err) {
      console.error('Scan correct error:', err);
      setIsProcessing(false);
    }
  }, [activeChallan, currentAlloc, isProcessing, currentStepIndex, totalSteps, batches, state.auditLogs, state.backendConnected, refreshServerState, dispatch]);

  // 2. Simulate Worker Scanning Wrong Newer Batch QR (Dynamic Newer Batch #4)
  const handleScanWrong = useCallback(async () => {
    if (!activeChallan || !currentAlloc || isProcessing) return;
    setIsProcessing(true);

    try {
      // Play loud emergency siren via Web Audio API
      playEmergencySiren();

      // DYNAMICALLY pick a newer eligible batch of the same commodity (#4)
      const commodityBatches = batches.filter(
        b => b.commodity === activeChallan.commodity && b.qualityStatus === QUALITY_STATUS.ELIGIBLE
      );
      
      // Find a batch that is newer than currentAlloc
      let wrongBatch = commodityBatches.find(
        b => new Date(b.receiptDate).getTime() > new Date(currentAlloc.receiptDate).getTime()
      );

      // If none newer than currentAlloc, pick freshest batch
      if (!wrongBatch) {
        wrongBatch = commodityBatches[commodityBatches.length - 1];
      }

      const wrongAge = calculateAgeDays(wrongBatch.receiptDate);
      const expectedAge = calculateAgeDays(currentAlloc.receiptDate);

      const violationMsg = `CRITICAL FIFO MISMATCH: Scanned Batch #${wrongBatch.batchId} (${wrongAge}d old in Bay ${wrongBatch.bay}) is ${Math.abs(expectedAge - wrongAge)} days newer than designated Batch #${currentAlloc.batchId} (${expectedAge}d old in Bay ${currentAlloc.bay})! Gate loading blocked.`;

      // ASYNC SHA-256 OUTSIDE REDUCER (#1)
      const timestamp = new Date().toISOString();
      const prevHash = state.auditLogs[0]?.hash || '0000000000000000000000000000000000000000000000000000000000000000';

      const eventHash = await createChainedEventHash(
        prevHash,
        timestamp,
        'VIOLATION_BLOCKED',
        {
          challanId: activeChallan.challanId,
          scannedBatch: wrongBatch.batchId,
          expectedBatch: currentAlloc.batchId,
          message: violationMsg,
        }
      );

      const auditLog = {
        id: `EVT-VIO-${Date.now()}`,
        timestamp,
        type: 'VIOLATION_BLOCKED',
        title: `FIFO Violation Blocked: Scanned #${wrongBatch.batchId}`,
        actor: 'Worker Handset #W-402',
        details: violationMsg,
        batchId: wrongBatch.batchId,
        commodity: activeChallan.commodity,
        bay: wrongBatch.bay,
        quantity: currentAlloc.take,
        prevHash,
        hash: eventHash,
      };

      dispatch({
        type: ACTION_TYPES.TRIGGER_SCAN_VIOLATION,
        payload: {
          auditLog,
          message: violationMsg,
          scannedBatchId: wrongBatch.batchId,
          expectedBatchId: currentAlloc.batchId,
        },
      });

      setIsProcessing(false);
    } catch (err) {
      console.error('Scan wrong error:', err);
      setIsProcessing(false);
    }
  }, [activeChallan, currentAlloc, isProcessing, batches, state.auditLogs, dispatch]);

  const handleDismissFeedback = useCallback(() => {
    dispatch({ type: ACTION_TYPES.DISMISS_MOBILE_FEEDBACK });
  }, [dispatch]);

  const handleCancelChallan = useCallback(() => {
    dispatch({ type: ACTION_TYPES.CANCEL_CHALLAN });
  }, [dispatch]);

  const isSuccessScreen = mobileScanResult?.type === 'success';
  const isViolationScreen = mobileScanResult?.type === 'violation' || isAlarmActive;

  return (
    <div id="handset-simulator-pane" className="w-full flex justify-center select-none">
      {/* Industrial Rugged Handheld Phone Frame (UP e-PDS Official Handset) */}
      <div className={`w-[325px] rounded-[36px] p-3 border-4 shadow-xl relative transition-all duration-300 ${
        isViolationScreen 
          ? 'border-[#b91c1c] bg-[#1a0505] siren-glow animate-flash-red'
          : isSuccessScreen
          ? 'border-[#15803d] bg-[#051c0d] emerald-glow'
          : 'border-slate-800 bg-[#0f172a] shadow-md'
      }`}>
        {/* Top Speaker & Camera Notch */}
        <div className="w-full flex items-center justify-center gap-2 mb-2">
          <div className="h-1.5 w-16 bg-slate-600 rounded-full" />
          <div className="h-2.5 w-2.5 bg-slate-700 rounded-full border border-slate-600" />
        </div>

        {/* Handset Screen Inner Container */}
        <div className={`rounded-[26px] overflow-hidden min-h-[580px] flex flex-col justify-between text-xs transition-colors ${
          isViolationScreen 
            ? 'bg-red-950 text-red-100' 
            : isSuccessScreen 
            ? 'bg-emerald-950 text-emerald-100' 
            : 'bg-white text-slate-800'
        }`}>
          {/* Status Bar */}
          <div className="px-4 py-1.5 bg-slate-900 text-white flex items-center justify-between text-[10px] font-mono">
            <span>09:41 AM IST</span>
            <div className="flex items-center gap-2">
              {state.networkMode === 'OFFLINE' ? (
                <span className="flex items-center gap-0.5 text-amber-400 font-semibold"><WifiOff className="h-2.5 w-2.5" /> OFFLINE</span>
              ) : (
                <span className="flex items-center gap-0.5 text-emerald-400 font-semibold"><Wifi className="h-2.5 w-2.5" /> 4G ePDS</span>
              )}
              <span className="flex items-center gap-0.5"><Battery className="h-2.5 w-2.5" /> 98%</span>
            </div>
          </div>

          {/* App Title Bar */}
          <div className="px-3.5 py-2 border-b border-slate-200 bg-[#0B2A5B] text-white flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-[11px] font-mono tracking-tight text-white">
                {t('handset.deviceTitle')}
              </span>
            </div>
            <span className="text-[10px] text-blue-200 font-mono">
              {activeRole === 'approver' ? 'DSO / Supervisor Terminal' : t('handset.workerTag')}
            </span>
          </div>

          {/* Role Switch Tabs (Worker | Approver) */}
          <div className="flex items-center border-b border-slate-200 bg-slate-100 text-xs font-bold">
            <button
              id="tab-handset-worker"
              type="button"
              onClick={() => setActiveRole('worker')}
              className={`flex-1 py-1.5 px-2 text-center flex items-center justify-center gap-1.5 transition-colors border-b-2 text-[11px] ${
                activeRole === 'worker'
                  ? 'border-[#0B2A5B] bg-white text-[#0B2A5B]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Smartphone className="h-3 w-3" />
              <span>{t('handset.tabWorker')}</span>
            </button>
            <button
              id="tab-handset-approver"
              type="button"
              onClick={() => setActiveRole('approver')}
              className={`flex-1 py-1.5 px-2 text-center flex items-center justify-center gap-1.5 transition-colors border-b-2 text-[11px] relative ${
                activeRole === 'approver'
                  ? 'border-[#0B2A5B] bg-white text-[#0B2A5B]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <KeyRound className="h-3 w-3" />
              <span>{t('handset.tabApprover')}</span>
              {pendingApprovalsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-red-600 text-white font-black animate-pulse">
                  {pendingApprovalsCount}
                </span>
              )}
            </button>
          </div>

          {/* Screen Content Body */}
          <div className="p-3 flex-1 flex flex-col justify-between overflow-y-auto">
            {/* When Approver tab is active */}
            {activeRole === 'approver' ? (
              <ApproverView />
            ) : isViolationScreen ? (
              /* Condition 1: Violation State Alert */
              <div className="space-y-3 py-2 text-center text-white">
                <div className="h-14 w-14 rounded-full bg-[#b91c1c] text-white flex items-center justify-center mx-auto shadow-lg animate-bounce">
                  <AlertOctagon className="h-9 w-9" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold uppercase tracking-wider text-red-100">
                    {t('handset.violationTitle')}
                  </h4>
                  <div className="text-[10px] font-mono text-red-300 mt-1 uppercase font-semibold">
                    {t('handset.violationSub')}
                  </div>
                </div>

                <div className="bg-red-900/90 border border-red-500 rounded-lg p-2.5 text-left text-[11px] text-red-100 font-mono leading-relaxed">
                  {mobileScanResult?.message || 'Newer batch scanned out of turn. Loading blocked.'}
                </div>

                <div className="text-[10px] text-red-200 bg-red-950 p-2 rounded border border-red-800">
                  ⚠️ {t('handset.violationHint')}
                </div>

                <button
                  onClick={handleDismissFeedback}
                  className="w-full py-2 bg-red-700 hover:bg-red-600 text-white font-bold rounded-lg text-xs font-mono transition-colors shadow-xs"
                >
                  {t('handset.clearRetry')}
                </button>
              </div>
            ) : isSuccessScreen ? (
              /* Condition 2: Verified Success State */
              <div className="space-y-3 py-4 text-center text-white">
                <div className="h-14 w-14 rounded-full bg-[#138808] text-white flex items-center justify-center mx-auto shadow-lg animate-pulse">
                  <CheckCircle className="h-9 w-9" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold uppercase tracking-wider text-emerald-100">
                    {t('handset.successTitle')}
                  </h4>
                  <div className="text-[10px] font-mono text-emerald-300 mt-0.5">
                    {t('handset.successSub')}
                  </div>
                </div>

                <div className="bg-emerald-900/80 border border-emerald-600 rounded-lg p-2.5 text-left text-[11px] text-emerald-100 font-mono space-y-1">
                  <div>Status: <strong>Dispatched to FPS</strong></div>
                  <div>Challan: <strong>{activeChallan?.challanId}</strong></div>
                  <div>Ledger: <strong>SHA-256 Chained</strong></div>
                  <div>Bays Cleared: <strong>{activeChallan?.allocations?.length} Storage Bays</strong></div>
                </div>

                <button
                  id="btn-handset-receive-fps"
                  onClick={async () => {
                    try {
                      if (state.backendConnected && activeChallan?.id) {
                        await apiClient.receiveAtFps(activeChallan.id);
                        if (refreshServerState) await refreshServerState();
                      }
                      handleCancelChallan();
                      alert('Successfully recorded e-PoS delivery at Fair Price Shop!');
                    } catch (e) {
                      alert('Receipt error: ' + e.message);
                    }
                  }}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>Mark Received at FPS (e-PoS)</span>
                </button>

                <button
                  onClick={handleCancelChallan}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-xs transition-colors shadow-xs"
                >
                  {t('handset.nextChallan')}
                </button>
              </div>

            ) : activeChallan ? (
              /* Condition 3: Active Challan Multi-Step Picking Ticket */
              <div className="space-y-2.5">
                {/* Challan Header Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mb-1">
                    <span className="font-bold text-slate-800">
                      {t('handset.ticketLabel', { id: activeChallan.challanNo || activeChallan.challanId })}
                    </span>
                    <span className="text-[#138808] font-bold">
                      {t('handset.stagePicking')}
                    </span>
                  </div>
                  <div className="font-bold text-slate-900 text-xs truncate">
                    {activeChallan.fps.name}
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-700 mt-1">
                    <span>{t('radar.commodity')}: <strong className="text-slate-900">{tCommodity(activeChallan.commodity)}</strong></span>
                    <span className="text-amber-800 font-bold">{activeChallan.requestedQty} {t('common.qtl')}</span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono bg-blue-50/80 p-1.5 rounded border border-blue-200 mt-1.5">
                    <span className="text-slate-500 font-sans">Token:</span>
                    <strong className="text-[#0B2A5B] font-bold">
                      {activeChallan.offlineToken ? activeChallan.offlineToken.substring(0, 16).toUpperCase() : (activeChallan.hash || '').substring(0, 16).toUpperCase()}
                    </strong>
                    <button
                      id="btn-handset-copy-token"
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(activeChallan.offlineToken || activeChallan.hash || '');
                        setCopiedToken(true);
                        setTimeout(() => setCopiedToken(false), 2000);
                      }}
                      className="text-slate-500 hover:text-slate-900 ml-1 inline-flex items-center gap-0.5 font-sans"
                      title="Copy full token"
                    >
                      {copiedToken ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      <span className="text-[9px] font-bold">Copy</span>
                    </button>
                  </div>
                </div>

                {/* Cryptographic QR Integrity Verification & Tamper Test (Phase 3) */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      id="btn-verify-challan-qr"
                      type="button"
                      onClick={handleVerifyChallanQr}
                      disabled={isProcessing}
                      className="py-1.5 px-2 rounded-md bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold text-[10px] flex items-center justify-center gap-1 shadow-xs transition-all active:scale-95 disabled:opacity-50"
                    >
                      <QrCode className="h-3 w-3 text-amber-300" />
                      <span>{t('handset.verifyChallanQr')}</span>
                    </button>

                    <button
                      id="btn-tamper-test"
                      type="button"
                      onClick={handleToggleTamperTest}
                      className={`py-1.5 px-2 rounded-md font-bold text-[10px] flex items-center justify-center gap-1 border shadow-xs transition-all active:scale-95 ${
                        state.isTamperedForTest
                          ? 'bg-amber-100 border-amber-400 text-amber-900 hover:bg-amber-200'
                          : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <AlertTriangle className="h-3 w-3 text-amber-600" />
                      <span>{state.isTamperedForTest ? t('handset.revertTamper') : t('handset.tamperTest')}</span>
                    </button>
                  </div>

                  {/* Verification Feedback Badge */}
                  {qrVerificationResult && (
                    <div
                      id="qr-verification-badge"
                      className={`p-1.5 rounded font-mono text-[9px] font-bold border flex items-center gap-1.5 ${
                        qrVerificationResult.isValid
                          ? 'bg-emerald-100 text-emerald-950 border-emerald-400'
                          : 'bg-red-100 text-red-950 border-red-400 animate-pulse'
                      }`}
                    >
                      {qrVerificationResult.isValid ? (
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <AlertOctagon className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
                      )}
                      <span className="break-all">{qrVerificationResult.message}</span>
                    </div>
                  )}
                </div>

                {/* Multi-Step Picking Progress Meter */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-600 font-semibold flex items-center gap-1">
                      <Layers className="h-3 w-3 text-amber-600" />
                      {t('handset.pickingStep', { current: currentStepIndex + 1, total: totalSteps })}
                    </span>
                    <span className="text-[#138808] font-bold">
                      {Math.round(((currentStepIndex) / totalSteps) * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden border border-slate-300">
                    <div 
                      className="h-full bg-[#138808] transition-all duration-300"
                      style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Current Active Step Target Callout */}
                {currentAlloc && (
                  <div className="bg-blue-50 border border-blue-300 rounded-lg p-2.5 text-blue-950 font-mono text-xs space-y-1 shadow-xs">
                    <div className="text-[10px] text-blue-800 uppercase tracking-wider font-bold flex items-center justify-between">
                      <span>{t('handset.currentTarget')}:</span>
                      <span className="text-amber-900 bg-amber-100 px-1 rounded border border-amber-300 font-bold">
                        {currentAlloc.take} {t('common.qtl')}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Warehouse className="h-4 w-4 text-amber-700" />
                      <span>{t('common.bay')} {currentAlloc.bay}</span>
                      <span className="text-[#0B2A5B]">➜ #{currentAlloc.batchId}</span>
                    </div>
                    <div className="text-[10px] text-slate-600 font-sans font-medium">
                      {t('common.batchAge')}: {currentAlloc.ageDays} {t('common.daysOld')}
                    </div>
                  </div>
                )}

                {/* Mini Bay Map Under Picking Ticket */}
                <div className="bg-slate-100 border border-slate-300 rounded-lg p-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-700">
                    <span className="font-bold flex items-center gap-1">
                      <Warehouse className="h-3 w-3 text-amber-700" />
                      {t('handset.miniMapTitle')}
                    </span>
                    {currentAlloc && (
                      <span className="text-amber-900 font-bold bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
                        {t('common.nextPick')}: {t('common.bay')} {currentAlloc.bay}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {BAYS.map((bayId) => {
                      const isTargetBay = currentAlloc?.bay === bayId;
                      return (
                        <div
                          key={bayId}
                          className={`py-1 text-center font-mono rounded text-[10px] transition-all font-bold ${
                            isTargetBay
                              ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-600 font-black shadow-xs scale-105'
                              : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          {bayId}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Step feedback notification if intermediate step completed */}
                {stepSuccessMsg && (
                  <div className="p-1.5 rounded bg-emerald-100 border border-emerald-300 text-emerald-900 text-[10px] font-mono flex items-center gap-1 animate-pulse">
                    <Check className="h-3 w-3 text-emerald-700" />
                    <span className="truncate">{stepSuccessMsg}</span>
                  </div>
                )}

                {/* Viewfinder Barcode Scanner Animation */}
                <div className="relative h-16 bg-slate-900 border border-slate-700 rounded-lg overflow-hidden flex flex-col items-center justify-center p-2 text-white">
                  <div className="barcode-scanline absolute inset-x-0 h-10 pointer-events-none" />
                  <QrCode className="h-6 w-6 text-slate-400 mb-0.5" />
                  <span className="text-[9px] font-mono text-slate-300 text-center">
                    Scanner Active: {t('common.bay')} {currentAlloc?.bay} (#{currentAlloc?.batchId})
                  </span>
                </div>

                {/* The TWO Simulation Buttons */}
                <div className="space-y-1.5 pt-0.5">
                  {/* Button 1: Correct Oldest QR */}
                  <button
                    id="btn-scan-correct-qr"
                    type="button"
                    onClick={handleScanCorrect}
                    disabled={isProcessing}
                    className="w-full py-2 px-3 rounded-lg bg-[#138808] hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>
                      {currentStepIndex < totalSteps - 1
                        ? t('handset.scanCorrectBtn', { current: currentStepIndex + 1, total: totalSteps })
                        : t('handset.scanFinalBtn')}
                    </span>
                  </button>

                  {/* Button 2: Wrong Newer QR */}
                  <button
                    id="btn-scan-wrong-qr"
                    type="button"
                    onClick={handleScanWrong}
                    disabled={isProcessing}
                    className="w-full py-2 px-3 rounded-lg bg-[#b91c1c] hover:bg-red-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 disabled:opacity-50"
                  >
                    <AlertOctagon className="h-4 w-4" />
                    <span>{t('handset.scanWrongBtn')}</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Condition 4: Idle state when no challan staged */
              <div className="py-12 text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-slate-100 border border-slate-300 text-slate-400 flex items-center justify-center mx-auto">
                  <Truck className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    {t('handset.awaitingTitle')}
                  </h4>
                  <p className="text-[10px] text-slate-500 max-w-[200px] mx-auto mt-1">
                    {t('handset.awaitingDesc')}
                  </p>
                </div>
                <div className="text-[10px] font-mono text-emerald-800 bg-emerald-50 p-2 rounded border border-emerald-300 max-w-[220px] mx-auto font-medium">
                  Surajpur Central Depot Mesh Connected
                </div>
              </div>
            )}
          </div>

          {/* Bottom Virtual Home Bar */}
          <div className="py-2 bg-slate-100 border-t border-slate-200 flex justify-center">
            <div className="h-1 w-24 bg-slate-400 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
});
