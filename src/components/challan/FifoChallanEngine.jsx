import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useStore } from '../../context/store';
import { ACTION_TYPES } from '../../context/actions';
import { useI18n } from '../../i18n/I18nContext';
import { 
  COMMODITIES, 
  FAIR_PRICE_SHOPS, 
  QUALITY_STATUS, 
  calculateAgeDays, 
  getAgeCategory,
  round2 
} from '../../types/models';
import { allocateFIFO, checkManualFifoViolation } from '../../services/fifoEngine';
import { playWarningBeep } from '../../services/audioService';
import { createChainedEventHash } from '../../services/cryptoService';
import { BatchSplitDiagram } from './BatchSplitDiagram';
import { WaterfallBreakdown } from './WaterfallBreakdown';
import { ExceptionGate } from './ExceptionGate';
import { PrintableChallan } from './PrintableChallan';
import { FormGChallanView } from './FormGChallanView';
import { VoiceMic } from './VoiceMic';
import { BayGrid } from '../locator/BayGrid';
import { formatChallanNo, computeChallanHash } from '../../services/challanService';
import { computeOfflineToken, formatTokenPrefix, getOrCreateDeviceId } from '../../services/offlineService';
import { apiClient } from '../../services/apiClient';
import { 
  Send, 
  AlertTriangle, 
  SlidersHorizontal, 
  ShieldCheck, 
  Store, 
  Sparkles, 
  XCircle,
  FileText,
  Warehouse,
  Printer,
  KeyRound,
  Copy,
  Check,
  Truck,
  CheckCircle2
} from 'lucide-react';

export const FifoChallanEngine = React.memo(function FifoChallanEngine({ demoTrigger, preFillData }) {
  const { state, dispatch, refreshServerState } = useStore();
  const { batches, activeChallan } = state;
  const { t, tCommodity } = useI18n();

  const [selectedFpsId, setSelectedFpsId] = useState(FAIR_PRICE_SHOPS[0].id);
  const [selectedCommodity, setSelectedCommodity] = useState('Wheat');
  const [requestedQty, setRequestedQty] = useState('120'); // 120 Qtl tests multi-split across 3 batches
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualPicks, setManualPicks] = useState({});
  const [activeViolation, setActiveViolation] = useState(null);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [showFormGPreview, setShowFormGPreview] = useState(false);
  const [showPrintableChallan, setShowPrintableChallan] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // External trigger for "Load Demo Scenario"
  useEffect(() => {
    if (demoTrigger && demoTrigger.timestamp) {
      setSelectedFpsId('FPS-GN-101');
      setSelectedCommodity('Wheat');
      setRequestedQty('120');
      setIsManualMode(false);
      setManualPicks({});
      setActiveViolation(null);
      setShowFormGPreview(false);
    }
  }, [demoTrigger]);

  // External trigger for Pre-filling from FPS Indents
  useEffect(() => {
    if (preFillData) {
      if (preFillData.fpsId) setSelectedFpsId(preFillData.fpsId);
      if (preFillData.commodity) setSelectedCommodity(preFillData.commodity);
      if (preFillData.quantity) setRequestedQty(String(preFillData.quantity));
      setIsManualMode(false);
      setManualPicks({});
      setActiveViolation(null);
    }
  }, [preFillData]);

  const selectedFps = useMemo(() => {
    return FAIR_PRICE_SHOPS.find(f => f.id === selectedFpsId) || FAIR_PRICE_SHOPS[0];
  }, [selectedFpsId]);

  // Active reservations from staged (uncompleted) challans
  const activeReservations = useMemo(() => {
    return (state.challans || [])
      .filter(c => c.status === 'STAGED')
      .flatMap(c => c.reservedBatches || (c.allocations || []).map(a => ({ batchId: a.batchId, qty: a.take })));
  }, [state.challans]);

  // Compute Auto-FIFO Allocation via pure function with active reservations
  const fifoResult = useMemo(() => {
    const qtyNum = parseFloat(requestedQty);
    return allocateFIFO(batches, selectedCommodity, qtyNum, activeReservations);
  }, [batches, selectedCommodity, requestedQty, activeReservations]);

  // Batches eligible for manual allocation
  const eligibleCommodityBatches = useMemo(() => {
    return batches
      .filter(b => b.commodity === selectedCommodity && b.qualityStatus === QUALITY_STATUS.ELIGIBLE && b.remainingQtl > 0)
      .sort((a, b) => {
        const diff = new Date(a.receiptDate) - new Date(b.receiptDate);
        if (diff !== 0) return diff;
        return a.batchId.localeCompare(b.batchId);
      });
  }, [batches, selectedCommodity]);

  // Handle manual quantity input for a batch
  const handleManualQtyChange = useCallback((batchId, valueStr) => {
    const val = round2(Math.max(0, parseFloat(valueStr) || 0));
    setManualPicks(prev => {
      const updated = {
        ...prev,
        [batchId]: val,
      };

      // Validate FIFO violation with strict definition
      const violationCheck = checkManualFifoViolation(batches, selectedCommodity, updated, parseFloat(requestedQty));
      if (violationCheck.isViolation) {
        playWarningBeep();
        setActiveViolation(violationCheck);
        setIsOverrideModalOpen(true);
      } else {
        setActiveViolation(null);
      }

      return updated;
    });
  }, [batches, selectedCommodity, requestedQty]);

  // Stage Challan & Transmit to Mobile Handset (Auto-FIFO)
  const handleStageAutoChallan = useCallback(async () => {
    if (!fifoResult.success) return;

    if (state.backendConnected) {
      try {
        await apiClient.stageChallan({
          fpsCode: selectedFps.id,
          commodity: selectedCommodity,
          requestedQty: fifoResult.requestedQty,
          indentId: preFillData?.indentId,
          deviceId: state.deviceId,
          localSeq: state.localSeq,
          prevTokenHash: state.prevTokenHash,
        });
        if (refreshServerState) await refreshServerState();
        return;
      } catch (err) {
        console.warn('Backend staging failed, falling back to local action:', err);
      }
    }

    const challanNo = formatChallanNo(state.challanCounter);
    const prevHash = state.auditLogs[0]?.hash || '0000000000000000000000000000000000000000000000000000000000000000';
    const timestamp = new Date().toISOString();

    const challanData = {
      challanId: challanNo,
      challanNo,
      fps: selectedFps,
      commodity: selectedCommodity,
      requestedQty: fifoResult.requestedQty,
      allocations: fifoResult.allocations,
      currentStepIndex: 0,
      completedScans: [],
      isManualOverride: false,
      status: 'STAGED',
      stagedAt: timestamp,
      issuedAt: timestamp,
      hash: '',
    };

    const hash = await computeChallanHash(challanData, prevHash);
    challanData.hash = hash;

    const deviceId = state.deviceId || getOrCreateDeviceId();
    const localSeq = state.localSeq || 1;
    const prevTokenHash = state.prevTokenHash || '0000000000000000000000000000000000000000000000000000000000000000';
    const offlineToken = await computeOfflineToken({
      challanNo,
      fps: selectedFps,
      commodity: selectedCommodity,
      requestedQty: challanData.requestedQty,
      allocations: challanData.allocations,
      issuedAt: timestamp,
      deviceId,
      localSeq,
      prevTokenHash,
    });
    challanData.offlineToken = offlineToken;
    challanData.deviceId = deviceId;
    challanData.localSeq = localSeq;
    challanData.prevTokenHash = prevTokenHash;

    dispatch({
      type: ACTION_TYPES.STAGE_CHALLAN,
      payload: challanData,
    });
  }, [fifoResult, selectedFps, selectedCommodity, state.challanCounter, state.auditLogs, state.deviceId, state.localSeq, state.prevTokenHash, state.backendConnected, preFillData, refreshServerState, dispatch]);

  const handleMarkReceivedAtFps = useCallback(async () => {
    if (!activeChallan) return;
    try {
      if (state.backendConnected && activeChallan.id) {
        await apiClient.receiveAtFps(activeChallan.id);
        if (refreshServerState) await refreshServerState();
      }
      dispatch({ type: ACTION_TYPES.CANCEL_CHALLAN });
      alert(t('challan.receivedSuccess') || 'Marked received at FPS! Inventory updated.');
    } catch (err) {
      alert('Error updating receipt: ' + err.message);
    }
  }, [activeChallan, state.backendConnected, refreshServerState, dispatch, t]);

  const handleOpenFormG = useCallback(() => setShowFormGPreview(true), []);
  const handleCloseFormG = useCallback(() => setShowFormGPreview(false), []);

  const handleSetModeAuto = useCallback(() => {
    setIsManualMode(false);
    setManualPicks({});
    setActiveViolation(null);
  }, []);

  const handleSetModeManual = useCallback(() => {
    setIsManualMode(true);
  }, []);

  const handleOpenOverrideModal = useCallback(() => {
    setIsOverrideModalOpen(true);
  }, []);

  const handleCloseOverrideModal = useCallback(() => {
    setIsOverrideModalOpen(false);
    setIsManualMode(false);
    setManualPicks({});
    setActiveViolation(null);
  }, []);

  // Submit approved exception and stage manual challan
  const handleApproveExceptionAndDispatch = useCallback(async ({ reason, operatorName, remarks, activeApproval, auditLog }) => {
    const totalManualAllocated = round2(Object.entries(manualPicks).reduce((sum, [, qty]) => sum + qty, 0));
    const qtyNum = round2(parseFloat(requestedQty));

    if (totalManualAllocated !== qtyNum) {
      alert(`Total manually picked stock (${totalManualAllocated} Qtl) must sum exactly to required quantity (${qtyNum} Qtl).`);
      return;
    }

    const allocations = eligibleCommodityBatches
      .filter(b => (manualPicks[b.batchId] || 0) > 0)
      .map(b => {
        const take = round2(manualPicks[b.batchId]);
        const remBefore = round2(b.remainingQtl);
        const remAfter = round2(remBefore - take);
        return {
          batchId: b.batchId,
          bay: b.bay,
          supplier: b.supplier,
          receiptDate: b.receiptDate,
          ageDays: calculateAgeDays(b.receiptDate),
          take,
          remainingBefore: remBefore,
          remainingAfter: remAfter,
          isExhausted: remAfter === 0,
        };
      });

    const challanNo = activeApproval?.challanNo || formatChallanNo(state.challanCounter);
    const timestamp = new Date().toISOString();
    const prevHash = state.auditLogs[0]?.hash || '0000000000000000000000000000000000000000000000000000000000000000';

    const challanData = {
      challanId: challanNo,
      challanNo,
      fps: selectedFps,
      commodity: selectedCommodity,
      requestedQty: totalManualAllocated,
      allocations,
      currentStepIndex: 0,
      completedScans: [],
      isManualOverride: true,
      exceptionReason: reason,
      approvedBy: `${operatorName} (Supervisor + DSO Dual-Approved)`,
      status: 'STAGED',
      stagedAt: timestamp,
      issuedAt: timestamp,
      hash: '',
    };

    const hash = await computeChallanHash(challanData, prevHash);
    challanData.hash = hash;

    const deviceId = state.deviceId || getOrCreateDeviceId();
    const localSeq = state.localSeq || 1;
    const prevTokenHash = state.prevTokenHash || '0000000000000000000000000000000000000000000000000000000000000000';
    const offlineToken = await computeOfflineToken({
      challanNo,
      fps: selectedFps,
      commodity: selectedCommodity,
      requestedQty: challanData.requestedQty,
      allocations: challanData.allocations,
      issuedAt: timestamp,
      deviceId,
      localSeq,
      prevTokenHash,
    });
    challanData.offlineToken = offlineToken;
    challanData.deviceId = deviceId;
    challanData.localSeq = localSeq;
    challanData.prevTokenHash = prevTokenHash;

    const exceptionRecord = {
      id: `EXC-${Date.now().toString().slice(-6)}`,
      challanId: challanNo,
      fpsName: selectedFps.name,
      commodity: selectedCommodity,
      reason,
      officerName: operatorName,
      remarks,
      timestamp,
      allocations,
    };

    dispatch({
      type: ACTION_TYPES.SUBMIT_EXCEPTION_OVERRIDE,
      payload: {
        exception: exceptionRecord,
        auditLog: auditLog || {
          id: `EVT-EXC-${Date.now()}`,
          timestamp,
          type: 'EXCEPTION_APPROVED',
          title: `Statutory FIFO Override Approved: ${selectedFps.name}`,
          actor: operatorName,
          details: `Non-FIFO dispatch authorized for ${totalManualAllocated} Qtl of ${selectedCommodity}. Reason: ${reason}. Remarks: ${remarks}`,
          batchId: allocations.map(a => a.batchId).join(', '),
          commodity: selectedCommodity,
          bay: allocations.map(a => a.bay).join(', '),
          quantity: totalManualAllocated,
          prevHash,
          hash,
        },
      },
    });

    dispatch({
      type: ACTION_TYPES.STAGE_CHALLAN,
      payload: challanData,
    });

    setIsOverrideModalOpen(false);
  }, [manualPicks, requestedQty, eligibleCommodityBatches, selectedFps, selectedCommodity, state.challanCounter, state.auditLogs, dispatch]);

  const handleStageManualChallan = useCallback(async () => {
    const allocations = eligibleCommodityBatches
      .filter(b => (manualPicks[b.batchId] || 0) > 0)
      .map(b => ({
        batchId: b.batchId,
        bay: b.bay,
        supplier: b.supplier,
        receiptDate: b.receiptDate,
        ageDays: calculateAgeDays(b.receiptDate),
        take: manualPicks[b.batchId],
        remainingBefore: b.remainingQtl,
        remainingAfter: round2(b.remainingQtl - manualPicks[b.batchId]),
      }));

    const challanNo = formatChallanNo(state.challanCounter);
    const prevHash = state.auditLogs[0]?.hash || '0000000000000000000000000000000000000000000000000000000000000000';
    const timestamp = new Date().toISOString();

    const challanData = {
      challanId: challanNo,
      challanNo,
      fps: selectedFps,
      commodity: selectedCommodity,
      requestedQty: round2(Object.entries(manualPicks).reduce((sum, [, qty]) => sum + qty, 0)),
      allocations,
      currentStepIndex: 0,
      completedScans: [],
      isManualOverride: false,
      status: 'STAGED',
      stagedAt: timestamp,
      issuedAt: timestamp,
      hash: '',
    };

    const hash = await computeChallanHash(challanData, prevHash);
    challanData.hash = hash;

    const deviceId = state.deviceId || getOrCreateDeviceId();
    const localSeq = state.localSeq || 1;
    const prevTokenHash = state.prevTokenHash || '0000000000000000000000000000000000000000000000000000000000000000';
    const offlineToken = await computeOfflineToken({
      challanNo,
      fps: selectedFps,
      commodity: selectedCommodity,
      requestedQty: challanData.requestedQty,
      allocations: challanData.allocations,
      issuedAt: timestamp,
      deviceId,
      localSeq,
      prevTokenHash,
    });
    challanData.offlineToken = offlineToken;
    challanData.deviceId = deviceId;
    challanData.localSeq = localSeq;
    challanData.prevTokenHash = prevTokenHash;

    if (state.backendConnected) {
      try {
        const totalQty = round2(Object.entries(manualPicks).reduce((sum, [, qty]) => sum + qty, 0));
        const picks = Object.entries(manualPicks)
          .filter(([, qty]) => qty > 0)
          .map(([batchCode, qty]) => ({ batch_code: batchCode, qty }));
        await apiClient.stageManualChallan({
          fpsCode: selectedFps.id || selectedFps.fps_code,
          commodity: selectedCommodity,
          requestedQty: totalQty,
          selectedPicks: picks,
          indentId: preFillData?.indentId,
          deviceId: state.deviceId,
          localSeq: state.localSeq,
          prevTokenHash: state.prevTokenHash,
        });
        if (refreshServerState) await refreshServerState();
        return;
      } catch (err) {
        console.warn('Backend manual staging failed, falling back to local action:', err);
      }
    }

    dispatch({
      type: ACTION_TYPES.STAGE_CHALLAN,
      payload: challanData,
    });
  }, [eligibleCommodityBatches, manualPicks, selectedFps, selectedCommodity, state.challanCounter, state.auditLogs, state.deviceId, state.localSeq, state.prevTokenHash, state.backendConnected, preFillData, refreshServerState, dispatch]);

  const manualTotalAllocated = round2(Object.entries(manualPicks).reduce((sum, [, qty]) => sum + qty, 0));

  if (showPrintableChallan) {
    const currentOrPreview = activeChallan || {
      challanNo: formatChallanNo(state.challanCounter),
      fps: selectedFps,
      commodity: selectedCommodity,
      requestedQty: fifoResult.requestedQty || parseFloat(requestedQty),
      allocations: fifoResult.allocations || [],
      stagedAt: new Date().toISOString(),
      issuedAt: new Date().toISOString(),
      status: 'STAGED',
    };
    return (
      <PrintableChallan
        challan={currentOrPreview}
        prevHash={state.auditLogs[0]?.hash}
        onBack={() => setShowPrintableChallan(false)}
      />
    );
  }

  if (showFormGPreview) {
    return (
      <FormGChallanView
        challan={activeChallan}
        onBack={handleCloseFormG}
      />
    );
  }

  return (
    <div className="bg-white border border-slate-300 rounded-lg p-4 sm:p-5 space-y-4 shadow-sm">
      {/* Engine Header & Mode Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#0B2A5B] flex items-center gap-2">
              <Send className="h-5 w-5 text-[#0B2A5B]" />
              <span>{t('challan.title')}</span>
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-[#138808] border border-emerald-300 font-mono font-bold">
              Pure Algorithmic Allocation
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('challan.subtitle')}
          </p>
        </div>

        {/* Mode Toggle Buttons + Form-G Preview Button */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Form-G Challan Preview Button */}
          <button
            type="button"
            onClick={handleOpenFormG}
            title="Preview Official Form-G Delivery Challan"
            className="px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 bg-blue-50 text-[#0B2A5B] border border-blue-300 hover:bg-blue-100 transition-colors shadow-xs"
          >
            <FileText className="h-3.5 w-3.5 text-[#0B2A5B]" />
            <span>{t('challan.formGButton')}</span>
          </button>

          {/* Guided Picking Slip & A4 Printable Challan (Phase 3) */}
          <button
            id="btn-print-challan-top"
            type="button"
            onClick={() => setShowPrintableChallan(true)}
            title="Generate Official Delivery Challan and Guided Picking Slip with QR"
            className="px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 bg-[#0B2A5B] text-white hover:bg-blue-900 transition-colors shadow-xs"
          >
            <Printer className="h-3.5 w-3.5 text-amber-300" />
            <span>{t('challan.generateChallanBtn')}</span>
          </button>

          <div className="flex items-center gap-1 bg-slate-100 border border-slate-300 p-1 rounded-lg">
            <button
              id="btn-mode-auto"
              type="button"
              onClick={handleSetModeAuto}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors ${
                !isManualMode 
                  ? 'bg-[#138808] text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{t('challan.autoModeBtn')}</span>
            </button>

            <button
              id="btn-mode-manual"
              type="button"
              onClick={handleSetModeManual}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors ${
                isManualMode 
                  ? 'bg-[#b45309] text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>{t('challan.manualModeBtn')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Staged Challan Token Card with Copy Action */}
      {activeChallan && activeChallan.status === 'STAGED' && (
        <div id="active-challan-token-card" className="p-3 bg-blue-50/80 border-2 border-blue-300 rounded-lg text-xs flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2 font-mono">
            <span className="font-bold text-slate-900 text-sm">{activeChallan.challanNo}</span>
            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-300">
              STAGED & RESERVED
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono">
            <span className="text-slate-600 font-sans font-semibold">Offline Token:</span>
            <span className="font-bold text-[#0B2A5B] bg-white px-2.5 py-1 rounded border border-blue-200 shadow-2xs">
              {activeChallan.offlineToken ? activeChallan.offlineToken.substring(0, 16).toUpperCase() : 'OFFL-GENESIS-TOK'}
            </span>
            <button
              id="btn-copy-full-token"
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(activeChallan.offlineToken || activeChallan.hash || '');
                setCopiedToken(true);
                setTimeout(() => setCopiedToken(false), 2000);
              }}
              className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded text-[11px] font-sans font-bold flex items-center gap-1 text-slate-700 shadow-2xs transition-all"
              title="Copy 64-character SHA-256 token"
            >
              {copiedToken ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedToken ? 'Copied' : 'Copy full token'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Active In-Transit Challan Card with Mark Received at FPS Button */}
      {activeChallan && activeChallan.status === 'IN_TRANSIT' && (
        <div id="active-in-transit-challan-card" className="p-3.5 bg-amber-50 border-2 border-amber-400 rounded-lg text-xs flex flex-wrap items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5 font-mono">
            <span className="font-bold text-slate-900 text-sm">{activeChallan.challanNo}</span>
            <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10px] border border-amber-600 flex items-center gap-1 shadow-2xs">
              <Truck className="h-3 w-3" />
              IN_TRANSIT TO FPS
            </span>
            <span className="text-slate-600 font-sans text-xs">
              ({activeChallan.commodity} — {activeChallan.requestedQty || activeChallan.total_qty} Qtl)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-mark-received-fps"
              type="button"
              onClick={handleMarkReceivedAtFps}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow flex items-center gap-1.5 transition-all focus:ring-2 focus:ring-emerald-400"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Mark received at FPS (e-PoS Receipt)</span>
            </button>
          </div>
        </div>
      )}

      {/* Voice-Assisted Challan Mic Assistant (Hindi & English) */}
      <VoiceMic
        onApplyParsed={({ commodity, quantity, fpsId }) => {
          if (commodity) setSelectedCommodity(commodity);
          if (quantity) setRequestedQty(quantity.toString());
          if (fpsId) setSelectedFpsId(fpsId);
        }}
        onConfirmStage={handleStageAutoChallan}
        onQueryOldestBatch={(commodity) => {
          if (commodity) setSelectedCommodity(commodity);
        }}
      />

      {/* Input Parameters Form */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
        {/* Fair Price Shop (FPS) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
            <Store className="h-3.5 w-3.5 text-amber-600" />
            <span>{t('challan.destFps')}</span>
          </label>
          <select
            id="challan-fps-select"
            value={selectedFpsId}
            onChange={(e) => setSelectedFpsId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-600 font-mono font-medium shadow-xs"
          >
            {FAIR_PRICE_SHOPS.map(fps => (
              <option key={fps.id} value={fps.id}>
                {fps.id} - {fps.name} ({fps.sector})
              </option>
            ))}
          </select>
        </div>

        {/* Commodity */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {t('challan.selectCommodity')}
          </label>
          <select
            id="challan-commodity-select"
            value={selectedCommodity}
            onChange={(e) => {
              setSelectedCommodity(e.target.value);
              setManualPicks({});
              setActiveViolation(null);
            }}
            className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-600 font-semibold shadow-xs"
          >
            {COMMODITIES.map(c => (
              <option key={c} value={c}>{tCommodity(c)}</option>
            ))}
          </select>
        </div>

        {/* Required Quantity (Quintals) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
            <span>{t('challan.requiredQty')}</span>
            <span className="text-[10px] text-slate-500 font-mono">1 Qtl = 100 Kg</span>
          </label>
          <input
            id="challan-qty-input"
            type="number"
            min="1"
            step="1"
            value={requestedQty}
            onChange={(e) => {
              setRequestedQty(e.target.value);
              setManualPicks({});
              setActiveViolation(null);
            }}
            className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 font-mono font-extrabold focus:outline-none focus:border-blue-600 shadow-xs"
          />
        </div>
      </div>

      {/* Mode A: Smart Auto-FIFO View */}
      {!isManualMode && (
        <div className="space-y-4">
          {!fifoResult.success ? (
            <div className="bg-red-50 border border-red-300 rounded-lg p-4 text-red-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-red-800">
                <XCircle className="h-5 w-5 text-red-600" />
                <span>{t('challan.shortfallAlert')}</span>
              </div>
              <p className="text-xs text-red-800 leading-relaxed font-mono">
                {fifoResult.error}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono pt-1 text-red-900">
                <span>Requested: <strong>{requestedQty} Qtl</strong></span>
                <span>Available Eligible: <strong>{fifoResult.totalAvailable} Qtl</strong></span>
                <span>Shortfall: <strong className="text-white bg-red-700 px-1.5 py-0.5 rounded">{fifoResult.shortfall} Qtl</strong></span>
              </div>
            </div>
          ) : (
            <>
              {/* Visual Multi-Batch Waterfall Allocation + Split Diagram beside steps */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <WaterfallBreakdown
                  waterfallSteps={fifoResult.waterfallSteps}
                  skippedHoldBatches={fifoResult.skippedHoldBatches}
                  requestedQty={fifoResult.requestedQty}
                  commodity={fifoResult.commodity}
                />
                <BatchSplitDiagram 
                  allocations={fifoResult.allocations} 
                  requestedQty={fifoResult.requestedQty}
                  commodity={fifoResult.commodity}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t border-slate-200 gap-3">
                <div className="text-xs text-slate-600 flex items-center gap-2 font-medium">
                  <ShieldCheck className="h-4 w-4 text-[#138808]" />
                  <span>Verified 100% FIFO Compliant. Stock reserved on staging.</span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    id="btn-print-challan"
                    type="button"
                    onClick={() => setShowPrintableChallan(true)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    <Printer className="h-4 w-4 text-amber-300" />
                    <span>{t('challan.generateChallanBtn')}</span>
                  </button>

                  <button
                    id="btn-stage-challan"
                    type="button"
                    onClick={handleStageAutoChallan}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#138808] hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
                  >
                    <Send className="h-4 w-4" />
                    <span>{t('challan.stageChallanBtn')}</span>
                  </button>
                </div>
              </div>

              {/* Compact Stack Bay Locator View for Challan Screen */}
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-2">
                  <Warehouse className="h-4 w-4 text-[#0B2A5B]" />
                  <h3 className="text-xs font-bold text-[#0B2A5B] uppercase tracking-wider">
                    {t('locator.title')} — Route Preview
                  </h3>
                </div>
                <BayGrid compact={true} />
              </div>
            </>
          )}
        </div>
      )}

      {/* Mode B: Manual Override Selection */}
      {isManualMode && (
        <div className="space-y-4 pt-1">
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-3.5 text-amber-950 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700 flex-shrink-0" />
              <span>
                <strong>Manual Override Mode Active:</strong> Any selection skipping older eligible stock will immediately trigger a statutory FIFO VIOLATION alarm and require approved officer authorization.
              </span>
            </div>
            <span className="font-mono text-xs font-bold text-amber-950 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 flex-shrink-0">
              Allocated: {manualTotalAllocated} / {requestedQty} Qtl
            </span>
          </div>

          {/* Table of Batches for manual picking */}
          <div className="overflow-x-auto border border-slate-300 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-[11px] uppercase font-bold border-b border-slate-300">
                  <th className="py-2.5 px-3">Batch ID (बैच सं.)</th>
                  <th className="py-2.5 px-3">Bay Location (गोदाम बे)</th>
                  <th className="py-2.5 px-3">Receipt Date (आवक दिनांक)</th>
                  <th className="py-2.5 px-3">Stock Age (भंडारण अवधि)</th>
                  <th className="py-2.5 px-3">Available Balance (उपलब्ध स्टॉक)</th>
                  <th className="py-2.5 px-3 text-right">Pick Quantity (Qtl)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans">
                {eligibleCommodityBatches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500 font-mono">
                      No eligible batches with stock balance available for {tCommodity(selectedCommodity)}.
                    </td>
                  </tr>
                ) : (
                  eligibleCommodityBatches.map(batch => {
                    const ageDays = calculateAgeDays(batch.receiptDate);
                    const ageCat = getAgeCategory(ageDays);
                    const currentPick = manualPicks[batch.batchId] || '';

                    return (
                      <tr key={batch.batchId} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          #{batch.batchId}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-amber-800 font-semibold">
                          Bay {batch.bay}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {batch.receiptDate}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                            ageCat.category === 'critical'
                              ? 'bg-red-50 text-[#b91c1c] border-red-300'
                              : ageCat.category === 'moderate'
                              ? 'bg-amber-50 text-[#b45309] border-amber-300'
                              : 'bg-emerald-50 text-[#138808] border-emerald-300'
                          }`}>
                            {ageDays}d old
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                          {batch.remainingQtl} Qtl
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            id={`manual-pick-input-${batch.batchId}`}
                            type="number"
                            min="0"
                            max={batch.remainingQtl}
                            placeholder="0"
                            value={currentPick}
                            onChange={(e) => handleManualQtyChange(batch.batchId, e.target.value)}
                            className="w-24 bg-white border border-slate-300 text-slate-900 font-mono text-right rounded px-2 py-1 text-xs font-bold focus:outline-none focus:border-amber-600 shadow-xs"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t border-slate-200 gap-3">
            <span className="text-xs text-slate-600 font-mono font-medium">
              Status:{' '}
              {activeViolation ? (
                <span className="text-[#b91c1c] font-bold">LOCKED: Statutory FIFO Violation Detected</span>
              ) : manualTotalAllocated === parseFloat(requestedQty) ? (
                <span className="text-[#138808] font-bold">Valid Allocation Ready</span>
              ) : (
                <span>Pick {round2(parseFloat(requestedQty) - manualTotalAllocated)} Qtl more to match target</span>
              )}
            </span>

            {activeViolation ? (
              <button
                id="btn-open-exception-modal"
                type="button"
                onClick={handleOpenOverrideModal}
                className="px-4 py-2 rounded-lg bg-[#b91c1c] hover:bg-red-800 text-white font-bold text-xs flex items-center gap-2 shadow-sm animate-pulse"
              >
                <AlertTriangle className="h-4 w-4" />
                <span>Complete Approved Exception Form to Dispatch</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={manualTotalAllocated !== parseFloat(requestedQty)}
                onClick={handleStageManualChallan}
                className="px-5 py-2.5 rounded-lg bg-[#138808] hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 disabled:opacity-40 shadow-xs"
              >
                <Send className="h-4 w-4" />
                <span>{t('challan.stageManualBtn')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Statutory Skip Audit Gate with DSO Dual-OTP Approval (Phase 3) */}
      <ExceptionGate
        isOpen={isOverrideModalOpen}
        violationDetails={activeViolation}
        onCancel={handleCloseOverrideModal}
        onApproveException={handleApproveExceptionAndDispatch}
        commodity={selectedCommodity}
        targetQty={parseFloat(requestedQty) || 0}
      />
    </div>
  );
});
