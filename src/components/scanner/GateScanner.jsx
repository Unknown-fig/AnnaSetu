import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../context/store';
import { ACTION_TYPES } from '../../context/actions';
import { useI18n } from '../../i18n/I18nContext';
import { validateBatchScan } from '../../services/scanService';
import { playSuccessChime, playEmergencySiren } from '../../services/audioService';
import { createChainedEventHash } from '../../services/cryptoService';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { 
  Camera, 
  QrCode, 
  CheckCircle2, 
  AlertOctagon, 
  AlertTriangle, 
  RefreshCw, 
  Send, 
  Printer, 
  ShieldCheck, 
  X,
  FileSpreadsheet,
  Layers,
  ArrowRight
} from 'lucide-react';

export const GateScanner = React.memo(function GateScanner() {
  const { state, dispatch } = useStore();
  const { isHindi, t } = useI18n();
  const { activeChallan, batches, isAlarmActive } = state;

  const [scanMode, setScanMode] = useState('simulated'); // 'webcam' | 'simulated' | 'paste'
  const [selectedSimBatchId, setSelectedSimBatchId] = useState('');
  const [pastedJson, setPastedJson] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [completedLines, setCompletedLines] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [cameraError, setCameraError] = useState(null);
  const [showBatchLabelsModal, setShowBatchLabelsModal] = useState(false);
  const [batchQrDataUrls, setBatchQrDataUrls] = useState({});

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // Sync with active challan step index or completed scans
  useEffect(() => {
    setCurrentStepIndex(activeChallan?.currentStepIndex || 0);
    setCompletedLines(activeChallan?.completedScans || []);
    setFeedback(null);
  }, [activeChallan?.challanId, activeChallan?.currentStepIndex]);

  // Set default simulated batch
  useEffect(() => {
    if (batches.length > 0 && !selectedSimBatchId) {
      setSelectedSimBatchId(batches[0].batchId);
    }
  }, [batches, selectedSimBatchId]);

  // Generate batch QR data URLs for label printing
  useEffect(() => {
    async function genLabels() {
      const map = {};
      for (const b of batches) {
        const payload = JSON.stringify({
          t: 'BATCH',
          batchId: b.batchId,
          bay: b.bay,
          commodity: b.commodity,
          hashPrefix: (b.sha256Hash || '').substring(0, 10),
        });
        try {
          map[b.batchId] = await QRCode.toDataURL(payload, {
            errorCorrectionLevel: 'M',
            margin: 1,
            width: 160,
          });
        } catch (e) {}
      }
      setBatchQrDataUrls(map);
    }
    genLabels();
  }, [batches]);

  // Webcam scanning logic with BarcodeDetector + jsQR fallback
  useEffect(() => {
    if (scanMode !== 'webcam') {
      stopCamera();
      return;
    }

    let isSubscribed = true;

    async function initCamera() {
      setCameraError(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera API not available in this browser');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        });

        if (!isSubscribed) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Start scanning frames
        startFrameScanning();
      } catch (err) {
        console.warn('Webcam initiation failed:', err);
        setCameraError('Camera access unavailable or permission denied. Switched to Simulated Scan mode.');
        setScanMode('simulated');
      }
    }

    initCamera();

    return () => {
      isSubscribed = false;
      stopCamera();
    };
  }, [scanMode]);

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startFrameScanning = () => {
    const hasBarcodeDetector = 'BarcodeDetector' in window;
    let detector = null;
    if (hasBarcodeDetector) {
      try {
        detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) {
        detector = null;
      }
    }

    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      let detectedText = null;

      if (detector) {
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0) {
            detectedText = codes[0].rawValue;
          }
        } catch (e) {}
      }

      // jsQR fallback if BarcodeDetector didn't find anything
      if (!detectedText && canvas.width > 0 && canvas.height > 0) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qr = jsQR(imageData.data, imageData.width, imageData.height);
        if (qr && qr.data) {
          detectedText = qr.data;
        }
      }

      if (detectedText) {
        handleExecuteScan(detectedText);
      }
    }, 450);
  };

  // Main Execution Function for All 3 Scanning Modes
  const handleExecuteScan = useCallback(async (payload) => {
    const result = validateBatchScan({
      qrPayload: payload,
      activeChallan,
      batches,
      currentStepIndex,
      completedScans: completedLines,
    });

    const timestamp = new Date().toISOString();
    const prevHash = state.auditLogs[0]?.hash || '0000000000000000000000000000000000000000000000000000000000000000';

    if (result.status === 'VERIFIED') {
      playSuccessChime();
      const nextCompleted = [...completedLines, result.batchId];
      setCompletedLines(nextCompleted);
      setFeedback({ type: 'success', message: result.message, timestamp: Date.now() });

      const auditHash = await createChainedEventHash(prevHash, timestamp, 'SCAN_VERIFIED', {
        batchId: result.batchId,
        bay: result.bay,
        qty: result.takeQty,
        step: `${result.currentStep}/${result.totalSteps}`,
        challanNo: activeChallan.challanNo,
      });

      const auditLog = {
        id: `EVT-SCAN-OK-${Date.now()}`,
        timestamp,
        type: 'SCAN_VERIFIED',
        title: `Gate Scan Verified: Batch #${result.batchId}`,
        actor: 'Loading Gate Scanner',
        details: result.message,
        batchId: result.batchId,
        commodity: activeChallan.commodity,
        bay: result.bay,
        quantity: result.takeQty,
        token: auditHash.substring(0, 16).toUpperCase(),
        syncStatus: state.networkMode === 'OFFLINE' ? 'PENDING_SYNC' : 'SYNCED',
        prevHash,
        hash: auditHash,
      };

      dispatch({
        type: ACTION_TYPES.RECORD_SCAN_LOG,
        payload: {
          scanRecord: {
            id: `SCAN-${Date.now()}`,
            timestamp,
            batchId: result.batchId,
            result: 'VERIFIED',
            message: result.message,
          },
          auditLog,
        },
      });

      // Advance step or complete dispatch if last step
      if (result.isComplete) {
        // Dispatch completion (Phase 3 flow)
        const dspHash = await createChainedEventHash(auditHash, timestamp, 'DISPATCH_COMPLETED', {
          challanNo: activeChallan.challanNo,
          fps: activeChallan.fps?.name,
          allocations: activeChallan.allocations,
        });

        const dspLog = {
          id: `EVT-DSP-${Date.now()}`,
          timestamp,
          type: 'DISPATCH_COMPLETED',
          title: `All Lines Verified: Dispatched ${activeChallan.commodity} to ${activeChallan.fps?.name}`,
          actor: 'Loading Gate Officer',
          details: `All ${result.totalSteps} allocation lines cryptographically scanned and loaded. Offline Token: ${(activeChallan.offlineToken || dspHash).substring(0, 16).toUpperCase()}`,
          commodity: activeChallan.commodity,
          quantity: activeChallan.requestedQty,
          fpsName: activeChallan.fps?.name,
          token: (activeChallan.offlineToken || dspHash).substring(0, 16).toUpperCase(),
          syncStatus: state.networkMode === 'OFFLINE' ? 'PENDING_SYNC' : 'SYNCED',
          prevHash: auditHash,
          hash: dspHash,
        };

        dispatch({
          type: ACTION_TYPES.CONFIRM_PICKING_SUCCESS,
          payload: { auditLog: dspLog },
        });
      } else {
        dispatch({ type: ACTION_TYPES.ADVANCE_PICKING_STEP });
        setCurrentStepIndex(idx => idx + 1);
      }
    } else if (result.status === 'WRONG_LINE') {
      playEmergencySiren();
      setFeedback({ type: 'violation', message: result.message, timestamp: Date.now() });

      const auditHash = await createChainedEventHash(prevHash, timestamp, 'SCAN_REJECTED', {
        scannedBatchId: result.batchId,
        expectedBatchId: result.expectedBatchId,
        message: result.message,
      });

      const auditLog = {
        id: `EVT-SCAN-REJ-${Date.now()}`,
        timestamp,
        type: 'SCAN_REJECTED',
        title: `Gate FIFO Violation Blocked: Scanned #${result.batchId}`,
        actor: 'Loading Gate Scanner',
        details: result.message,
        batchId: result.batchId,
        commodity: activeChallan?.commodity,
        bay: result.scannedBatch?.bay,
        token: auditHash.substring(0, 16).toUpperCase(),
        syncStatus: state.networkMode === 'OFFLINE' ? 'PENDING_SYNC' : 'SYNCED',
        prevHash,
        hash: auditHash,
      };

      dispatch({
        type: ACTION_TYPES.TRIGGER_SCAN_VIOLATION,
        payload: {
          auditLog,
          message: result.message,
          scannedBatchId: result.batchId,
          expectedBatchId: result.expectedBatchId,
        },
      });

      dispatch({
        type: ACTION_TYPES.RECORD_SCAN_LOG,
        payload: {
          scanRecord: {
            id: `SCAN-${Date.now()}`,
            timestamp,
            batchId: result.batchId,
            result: 'REJECTED_FIFO',
            message: result.message,
          },
          auditLog: null,
        },
      });
    } else if (result.status === 'DUPLICATE') {
      setFeedback({ type: 'warning', message: result.message, timestamp: Date.now() });
    } else {
      // INVALID / TAMPERED
      playEmergencySiren();
      setFeedback({ type: 'invalid', message: result.message, timestamp: Date.now() });

      dispatch({
        type: ACTION_TYPES.RECORD_SCAN_LOG,
        payload: {
          scanRecord: {
            id: `SCAN-${Date.now()}`,
            timestamp,
            batchId: result.batchId || 'UNKNOWN',
            result: 'INVALID_QR',
            message: result.message,
          },
          auditLog: null,
        },
      });
    }
  }, [activeChallan, batches, currentStepIndex, completedLines, state.auditLogs, state.networkMode, dispatch]);

  const allocations = activeChallan?.allocations || [];
  const currentAlloc = allocations[currentStepIndex];
  const scanLogs = state.scanLog || [];

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <QrCode className="h-6 w-6 text-[#0B2A5B]" />
            <h2 className="text-lg font-extrabold text-[#0B2A5B] tracking-tight">
              {isHindi ? 'लोडिंग गेट बारकोड/क्यूआर स्कैनर' : 'Loading Gate Barcode/QR Scanner'}
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            {isHindi 
              ? 'गोदाम निकासी द्वार पर भौतिक बोरियों/बैचों का डिजिटल सत्यापन' 
              : 'Physical bag & pallet verification at Godown Bay Exit Gate'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-print-batch-labels"
            type="button"
            onClick={() => setShowBatchLabelsModal(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-xs font-bold flex items-center gap-1.5 shadow-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>{isHindi ? 'बैच लेबल प्रिंट करें (A4)' : 'Print Batch Labels (A4)'}</span>
          </button>
        </div>
      </div>

      {/* Active Delivery Challan Context Bar */}
      {activeChallan && activeChallan.status === 'STAGED' ? (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[#0B2A5B] font-mono">
                {activeChallan.challanNo}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                ACTIVE GATE DIRECTIVE
              </span>
            </div>
            <div className="text-xs font-mono text-slate-700">
              Progress: <strong className="text-blue-900 text-sm">{currentStepIndex} / {allocations.length}</strong> Lines Verified
            </div>
          </div>

          {/* Allocation Stepper */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {allocations.map((alloc, idx) => {
              const isPast = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <div
                  key={alloc.batchId}
                  className={`p-2.5 rounded-lg border text-xs font-mono transition-all ${
                    isPast
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                      : isCurrent
                      ? 'bg-white border-blue-500 shadow-sm ring-2 ring-blue-300'
                      : 'bg-slate-100 border-slate-200 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold mb-1">
                    <span>Line #{idx + 1}</span>
                    {isPast ? (
                      <span className="flex items-center gap-1 text-emerald-700 text-[11px]">
                        <CheckCircle2 className="h-3.5 w-3.5" /> LOADED
                      </span>
                    ) : isCurrent ? (
                      <span className="text-blue-700 font-extrabold text-[11px] animate-pulse">
                        CURRENT TARGET
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">WAITING</span>
                    )}
                  </div>
                  <div className="text-sm font-black text-slate-900">
                    #{alloc.batchId} ({alloc.take} Qtl)
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Bay: <strong>{alloc.bay}</strong> • Age: <strong>{alloc.ageDays}d</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs text-amber-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">No Active Staged Challan at Loading Gate.</span>
              <p className="text-[11px] text-amber-800">
                Stage a delivery challan in the Challan tab to test loading gate scanner validation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Scanner Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Scanner Input Panel (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-xs space-y-4">
            {/* Mode Tabs */}
            <div className="flex items-center border-b border-slate-200 pb-2 gap-2 text-xs">
              <button
                id="btn-scan-mode-simulated"
                type="button"
                onClick={() => setScanMode('simulated')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  scanMode === 'simulated'
                    ? 'bg-[#0B2A5B] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                1. {isHindi ? 'सिम्युलेटेड स्कैनर (डेमो)' : 'Simulated Scanner'}
              </button>
              <button
                id="btn-scan-mode-webcam"
                type="button"
                onClick={() => setScanMode('webcam')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                  scanMode === 'webcam'
                    ? 'bg-[#0B2A5B] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Camera className="h-3.5 w-3.5" />
                <span>2. {isHindi ? 'वेबकैम लाइव' : 'Webcam Live (jsQR)'}</span>
              </button>
              <button
                id="btn-scan-mode-paste"
                type="button"
                onClick={() => setScanMode('paste')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  scanMode === 'paste'
                    ? 'bg-[#0B2A5B] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                3. {isHindi ? 'पेलोड पेस्ट करें' : 'Paste Payload JSON'}
              </button>
            </div>

            {/* Mode A: Simulated Scanner */}
            {scanMode === 'simulated' && (
              <div className="space-y-4 text-xs">
                {cameraError && (
                  <div className="p-2.5 bg-amber-50 border border-amber-300 rounded text-amber-950 text-xs">
                    {cameraError}
                  </div>
                )}

                {/* Quick Scan Active Challan Lines */}
                {activeChallan && currentAlloc && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg space-y-2">
                    <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                      <span>{isHindi ? 'सही अगला बैच त्वरित स्कैन करें' : 'One-Click Correct Line Scan'}:</span>
                    </div>
                    <button
                      id="btn-gate-scan-correct-line"
                      type="button"
                      onClick={() => {
                        const target = batches.find(b => b.batchId === currentAlloc.batchId);
                        const payload = JSON.stringify({
                          t: 'BATCH',
                          batchId: currentAlloc.batchId,
                          bay: currentAlloc.bay,
                          commodity: activeChallan.commodity,
                          hashPrefix: (target?.sha256Hash || '').substring(0, 10),
                        });
                        handleExecuteScan(payload);
                      }}
                      className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md font-bold text-xs shadow-xs flex items-center justify-center gap-2"
                    >
                      <QrCode className="h-4 w-4" />
                      <span>
                        Scan Correct Batch #{currentAlloc.batchId} ({currentAlloc.take} Qtl in Bay {currentAlloc.bay})
                      </span>
                    </button>
                  </div>
                )}

                {/* General Batch Dropdown Simulator */}
                <div className="space-y-2">
                  <label htmlFor="sim-batch-select" className="font-bold text-slate-700">
                    {isHindi ? 'गोदाम में उपलब्ध किसी भी बैच का क्यूआर चुनें:' : 'Select Any Batch QR to Simulate Gate Scan:'}
                  </label>
                  <div className="flex gap-2">
                    <select
                      id="sim-batch-select"
                      value={selectedSimBatchId}
                      onChange={(e) => setSelectedSimBatchId(e.target.value)}
                      className="flex-1 py-1.5 px-3 border border-slate-300 rounded-md font-mono text-xs bg-white text-slate-900"
                    >
                      {batches.map((b) => (
                        <option key={b.batchId} value={b.batchId}>
                          #{b.batchId} • {b.commodity} • Bay {b.bay} ({b.remainingQtl} Qtl) [{b.qualityStatus}]
                        </option>
                      ))}
                    </select>

                    <button
                      id="btn-gate-scan-selected-batch"
                      type="button"
                      onClick={() => {
                        const target = batches.find(b => b.batchId === selectedSimBatchId);
                        if (!target) return;
                        const payload = JSON.stringify({
                          t: 'BATCH',
                          batchId: target.batchId,
                          bay: target.bay,
                          commodity: target.commodity,
                          hashPrefix: (target.sha256Hash || '').substring(0, 10),
                        });
                        handleExecuteScan(payload);
                      }}
                      className="px-4 py-1.5 bg-[#0B2A5B] hover:bg-[#133E7C] text-white rounded-md font-bold text-xs shadow-xs flex items-center gap-1.5"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      <span>{isHindi ? 'स्कैन करें' : 'Scan this QR'}</span>
                    </button>
                  </div>
                </div>

                {/* Test Tampered QR */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-sans">
                    {isHindi ? 'सुरक्षा परीक्षण: विकृत या फर्जी क्यूआर' : 'Security Test: Scan tampered or fake QR payload'}
                  </span>
                  <button
                    id="btn-gate-scan-tampered"
                    type="button"
                    onClick={() => {
                      const payload = JSON.stringify({
                        t: 'BATCH',
                        batchId: 'WH-102',
                        bay: 'A2',
                        commodity: 'Wheat',
                        hashPrefix: 'TAMPERED99', // Mismatched prefix
                      });
                      handleExecuteScan(payload);
                    }}
                    className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 rounded text-[11px] font-bold"
                  >
                    {isHindi ? 'फर्जी क्यूआर टेस्ट' : 'Test Tampered QR'}
                  </button>
                </div>
              </div>
            )}

            {/* Mode B: Live Webcam */}
            {scanMode === 'webcam' && (
              <div className="space-y-3">
                <div className="relative rounded-lg overflow-hidden bg-slate-950 aspect-video flex items-center justify-center border-2 border-slate-700">
                  <video ref={videoRef} playsInline className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Target Scanner Reticle */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-48 border-2 border-dashed border-emerald-400 rounded-lg animate-pulse flex items-center justify-center">
                      <div className="h-2 w-2 bg-emerald-500 rounded-full" />
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 text-center font-sans">
                  {isHindi 
                    ? 'कैमरे के सामने बैच का क्यूआर कोड रखें। BarcodeDetector और jsQR स्वतः पहचानेंगे।' 
                    : 'Hold Batch QR in front of camera. BarcodeDetector & jsQR will decode automatically.'}
                </p>
              </div>
            )}

            {/* Mode C: Paste Payload JSON */}
            {scanMode === 'paste' && (
              <div className="space-y-3 text-xs">
                <textarea
                  id="input-gate-paste-payload"
                  value={pastedJson}
                  onChange={(e) => setPastedJson(e.target.value)}
                  placeholder='{"t":"BATCH","batchId":"WH-102","bay":"A2","commodity":"Wheat","hashPrefix":"..."}'
                  rows={4}
                  className="w-full p-2.5 border border-slate-300 rounded-md font-mono text-xs bg-white text-slate-900 focus:outline-hidden focus:border-blue-600"
                />
                <button
                  id="btn-gate-submit-paste"
                  type="button"
                  onClick={() => {
                    if (pastedJson.trim()) handleExecuteScan(pastedJson.trim());
                  }}
                  className="px-4 py-1.5 bg-[#0B2A5B] hover:bg-[#133E7C] text-white rounded-md font-bold text-xs shadow-xs flex items-center gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{isHindi ? 'सत्यापित करें' : 'Verify Pasted Payload'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Feedback Display Box */}
          {feedback && (
            <div
              className={`p-4 rounded-xl border-2 text-xs transition-all ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-950'
                  : feedback.type === 'violation'
                  ? 'bg-red-50 border-red-500 text-red-950 animate-shake'
                  : feedback.type === 'warning'
                  ? 'bg-amber-50 border-amber-500 text-amber-950'
                  : 'bg-red-100 border-red-600 text-red-950'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : feedback.type === 'violation' ? (
                  <AlertOctagon className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="font-bold text-sm">
                    {feedback.type === 'success'
                      ? 'SCAN VERIFIED'
                      : feedback.type === 'violation'
                      ? 'GATE LOADING BLOCKED'
                      : feedback.type === 'warning'
                      ? 'DUPLICATE SCAN'
                      : 'INVALID / TAMPERED'}
                  </h4>
                  <p className="mt-1 font-mono text-xs">{feedback.message}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Gate Scan Activity Log (5 Cols) */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-xs h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
              <h3 className="font-bold text-sm text-[#0B2A5B] flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-[#0B2A5B]" />
                <span>{isHindi ? 'लोडिंग गेट स्कैन लॉग' : 'Gate Scan Audit Log'}</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                {scanLogs.length} events
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 max-h-[460px] pr-1">
              {scanLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-mono text-xs">
                  No scan events recorded yet in this session.
                </div>
              ) : (
                scanLogs.map((log) => {
                  const isOk = log.result === 'VERIFIED';
                  const isRej = log.result === 'REJECTED_FIFO';
                  return (
                    <div
                      key={log.id}
                      className={`p-2.5 rounded-lg border text-xs font-mono transition-all ${
                        isOk
                          ? 'bg-emerald-50/50 border-emerald-200 text-slate-800'
                          : isRej
                          ? 'bg-red-50/70 border-red-300 text-red-950'
                          : 'bg-amber-50/50 border-amber-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-slate-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded font-bold ${
                          isOk
                            ? 'bg-emerald-100 text-emerald-800'
                            : isRej
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {log.result}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900">
                        Batch #{log.batchId}
                      </div>
                      <div className="text-[11px] text-slate-600 line-clamp-2">
                        {log.message}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* A4 Batch QR Labels Modal */}
      {showBatchLabelsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 bg-[#0B2A5B] text-white flex items-center justify-between no-print">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-amber-400" />
                <h3 className="font-bold text-sm">
                  {isHindi ? 'बैच बारकोड और क्यूआर लेबल शीट (A4)' : 'Official Batch Barcode & QR Label Sheet (A4)'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded text-xs font-bold shadow-xs"
                >
                  {isHindi ? 'प्रिंट करें' : 'Print Sheet'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBatchLabelsModal(false)}
                  className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-4 print:p-0">
              <div className="text-center border-b pb-3 no-print">
                <h4 className="text-xs font-bold text-slate-700 uppercase">
                  Government of India • Department of Food & Public Distribution
                </h4>
                <p className="text-[11px] text-slate-500">
                  Surajpur Central Godown — Pallet & Stack Identification QR Tags
                </p>
              </div>

              {/* 3x4 Grid of Batch Labels */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {batches.map((b) => (
                  <div
                    key={b.batchId}
                    className="p-3 border-2 border-slate-800 rounded-lg bg-white flex flex-col justify-between text-xs font-mono space-y-2 page-break-inside-avoid"
                  >
                    <div className="border-b border-slate-300 pb-1 flex items-center justify-between">
                      <strong className="text-sm text-[#0B2A5B]">#{b.batchId}</strong>
                      <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-700">
                        Bay {b.bay}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-0.5 text-[10px] text-slate-700">
                        <div>Commodity: <strong>{b.commodity}</strong></div>
                        <div>Received: <strong>{b.receiptDate}</strong></div>
                        <div>Initial: <strong>{b.qtyReceivedQtl} Qtl</strong></div>
                        <div>Status: <strong className="text-slate-900">{b.qualityStatus}</strong></div>
                      </div>

                      {batchQrDataUrls[b.batchId] ? (
                        <img
                          src={batchQrDataUrls[b.batchId]}
                          alt={`QR ${b.batchId}`}
                          className="h-20 w-20 border border-slate-300 p-1 rounded"
                        />
                      ) : (
                        <div className="h-20 w-20 bg-slate-100 flex items-center justify-center text-[10px] text-slate-400">
                          QR
                        </div>
                      )}
                    </div>

                    <div className="text-[9px] text-slate-400 truncate border-t pt-1 font-mono">
                      Hash: {(b.sha256Hash || '').substring(0, 16)}...
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
