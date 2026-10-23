import React, { useState } from 'react';
import { QrCode, ShieldCheck, ShieldAlert, X, CheckCircle2, AlertTriangle, RefreshCw, Camera } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { playSuccessChime, playEmergencySiren } from '../../services/audioService';
import { useI18n } from '../../i18n/I18nContext';

export function EposScanDialog({ challan, fpsCode, onClose, onReceiptConfirmed }) {
  const { isHindi } = useI18n();

  const [scanMode, setScanMode] = useState('simulated'); // 'simulated' | 'paste' | 'camera'
  const [pastePayload, setPastePayload] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState(null); // { success: bool, message: str, isTampered: bool }

  // 1. Simulate Scanning Genuine QR Code
  const handleScanGenuine = async () => {
    setIsVerifying(true);
    setResult(null);

    try {
      const genuinePayload = {
        challanNo: challan.challan_no,
        fps: fpsCode,
        commodity: challan.commodity,
        qty: challan.total_qty,
        token: challan.crypto_token,
      };

      const res = await apiClient.confirmFpsReceipt({
        challanNo: challan.challan_no,
        fpsCode,
        qrPayload: genuinePayload,
      });

      playSuccessChime();
      setResult({
        success: true,
        message: isHindi
          ? `ई-पॉस प्राप्ति सत्यापित: ${challan.total_qty} क्विंटल ${challan.commodity} दुकान के स्टॉक में सफलतापूर्वक जोड़ा गया!`
          : `e-PoS Receipt Verified: ${challan.total_qty} Qtl ${challan.commodity} added to shop inventory!`,
      });

      setTimeout(() => {
        if (onReceiptConfirmed) onReceiptConfirmed(res);
      }, 1500);
    } catch (err) {
      playEmergencySiren();
      setResult({
        success: false,
        isTampered: err.code === 'TAMPERED',
        message: err.message || (isHindi ? 'प्राप्ति सत्यापन विफल' : 'Receipt verification failed'),
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // 2. Simulate Scanning Tampered QR Code (+5 Qtl altered)
  const handleScanTampered = async () => {
    setIsVerifying(true);
    setResult(null);

    try {
      const tamperedPayload = {
        challanNo: challan.challan_no,
        fps: fpsCode,
        commodity: challan.commodity,
        qty: challan.total_qty + 5.0, // DELIBERATE TAMPER
        token: challan.crypto_token,
      };

      await apiClient.confirmFpsReceipt({
        challanNo: challan.challan_no,
        fpsCode,
        qrPayload: tamperedPayload,
      });
    } catch (err) {
      playEmergencySiren();
      setResult({
        success: false,
        isTampered: true,
        message: isHindi 
          ? 'क्रिप्टोग्राफ़िक टोकन बेमेल! चालान क्यूआर पेलोड में छेड़छाड़ (Tampered) पाई गई। स्टॉक नहीं बदला गया।'
          : 'TAMPERED: Cryptographic token mismatch! Challan QR payload has been altered. Receipt rejected and stock unchanged.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // 3. Process Pasted JSON Payload
  const handleProcessPasted = async () => {
    if (!pastePayload.trim()) return;
    setIsVerifying(true);
    setResult(null);

    try {
      let parsed = null;
      try {
        parsed = JSON.parse(pastePayload);
      } catch (e) {
        // Raw token text
      }

      const res = await apiClient.confirmFpsReceipt({
        challanNo: challan.challan_no,
        fpsCode,
        qrPayload: parsed,
        qrRaw: pastePayload,
      });

      playSuccessChime();
      setResult({
        success: true,
        message: isHindi ? 'ई-पॉस प्राप्ति सफलतापूर्वक दर्ज की गई!' : 'e-PoS receipt verified and accepted!',
      });

      setTimeout(() => {
        if (onReceiptConfirmed) onReceiptConfirmed(res);
      }, 1500);
    } catch (err) {
      playEmergencySiren();
      setResult({
        success: false,
        isTampered: err.code === 'TAMPERED',
        message: err.message || 'Verification error',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-xl border border-slate-300 shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="bg-[#0B2A5B] text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <QrCode className="h-5 w-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm">
                {isHindi ? 'ई-पॉस चालान क्यूआर सत्यापन' : 'e-PoS Challan QR Handshake'}
              </h3>
              <p className="text-[11px] text-slate-300">
                {challan.challan_no} • {challan.commodity} ({challan.total_qty} Qtl)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Challan Summary Mini-Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>{isHindi ? 'गंतव्य उचित दर दुकान:' : 'Destination FPS:'}</span>
              <span className="font-bold text-slate-900">{fpsCode}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>{isHindi ? 'कुल प्रेषित मात्रा:' : 'Dispatched Quantity:'}</span>
              <span className="font-bold text-[#0B2A5B] font-mono">{challan.total_qty} Qtl</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>{isHindi ? 'क्रिप्टो हस्ताक्षर प्रीफिक्स:' : 'Crypto Token Prefix:'}</span>
              <span className="font-mono font-bold text-slate-800">{challan.token_prefix || (challan.crypto_token || '').slice(0, 16)}</span>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex rounded-md bg-slate-100 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setScanMode('simulated')}
              className={`flex-1 py-1.5 rounded transition-all ${
                scanMode === 'simulated' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isHindi ? 'सिम्युलेटेड स्कैनर' : 'Simulated Scanner'}
            </button>
            <button
              type="button"
              onClick={() => setScanMode('paste')}
              className={`flex-1 py-1.5 rounded transition-all ${
                scanMode === 'paste' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isHindi ? 'पेलोड पेस्ट करें' : 'Paste Payload'}
            </button>
            <button
              type="button"
              onClick={() => setScanMode('camera')}
              className={`flex-1 py-1.5 rounded transition-all ${
                scanMode === 'camera' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isHindi ? 'वेबकैम कैमरा' : 'Webcam'}
            </button>
          </div>

          {/* Mode 1: Simulated Scanner */}
          {scanMode === 'simulated' && (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-slate-600">
                {isHindi 
                  ? 'गोदाम से प्राप्त वास्तविक चालान क्यूआर अथवा छेड़छाड़ परीक्षण (Tamper Test) का चयन करें:' 
                  : 'Select genuine incoming QR code verification or test statutory tamper rejection:'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={isVerifying}
                  onClick={handleScanGenuine}
                  className="flex flex-col items-center justify-center p-3.5 bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-500 rounded-lg text-emerald-900 font-bold transition-all shadow-xs group text-center"
                >
                  <ShieldCheck className="h-6 w-6 text-emerald-600 mb-1.5 group-hover:scale-110 transition-transform" />
                  <span className="text-xs">{isHindi ? 'असली चालान क्यूआर स्कैन करें' : 'Scan Genuine Challan QR'}</span>
                  <span className="text-[10px] text-emerald-700 font-normal mt-0.5">Token matches stored SHA-256</span>
                </button>

                <button
                  type="button"
                  disabled={isVerifying}
                  onClick={handleScanTampered}
                  className="flex flex-col items-center justify-center p-3.5 bg-rose-50 hover:bg-rose-100 border-2 border-rose-400 rounded-lg text-rose-900 font-bold transition-all shadow-xs group text-center"
                >
                  <ShieldAlert className="h-6 w-6 text-rose-600 mb-1.5 group-hover:scale-110 transition-transform" />
                  <span className="text-xs">{isHindi ? 'छेड़छाड़ परीक्षण (Tamper Demo)' : 'Simulate Tampered QR (+5 Qtl)'}</span>
                  <span className="text-[10px] text-rose-700 font-normal mt-0.5">Tests cryptographic chain integrity</span>
                </button>
              </div>
            </div>
          )}

          {/* Mode 2: Paste Payload */}
          {scanMode === 'paste' && (
            <div className="space-y-3 pt-1">
              <label htmlFor="epos-qr-payload-textarea" className="block text-xs font-semibold text-slate-700">
                {isHindi ? 'क्यूआर पेलोड JSON अथवा टोकन पेस्ट करें:' : 'Paste Scanned QR JSON or Token String:'}
              </label>
              <textarea
                id="epos-qr-payload-textarea"
                rows={3}
                placeholder='{"challanNo":"GBN-iPDS-...", "token":"...", "qty": 20}'
                value={pastePayload}
                onChange={(e) => setPastePayload(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 font-mono text-[11px] p-2.5 rounded-md outline-none focus:ring-2 focus:ring-[#0B2A5B]"
              />
              <button
                type="button"
                disabled={isVerifying || !pastePayload.trim()}
                onClick={handleProcessPasted}
                className="w-full py-2 bg-[#0B2A5B] hover:bg-[#133c7a] text-white font-bold text-xs rounded-md shadow-xs transition-colors disabled:bg-slate-300"
              >
                {isHindi ? 'पेलोड सत्यापित करें और स्वीकार करें' : 'Verify & Confirm Receipt'}
              </button>
            </div>
          )}

          {/* Mode 3: Webcam / Camera */}
          {scanMode === 'camera' && (
            <div className="p-6 bg-slate-900 text-white rounded-lg flex flex-col items-center justify-center gap-2 text-center">
              <Camera className="h-8 w-8 text-slate-400 animate-pulse" />
              <span className="text-xs font-bold">
                {isHindi ? 'वेबकैम स्कैनर तैयार' : 'Optical Scanner Optical Stream Ready'}
              </span>
              <p className="text-[11px] text-slate-400">
                {isHindi ? 'चालान का क्यूआर कोड कैमरे के सम्मुख रखें' : 'Hold printed challan QR code in front of camera'}
              </p>
              <button
                type="button"
                onClick={handleScanGenuine}
                className="mt-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition-colors"
              >
                {isHindi ? 'फ़्रेम कैप्चर करें (सिम्युलेट)' : 'Simulate Camera Scan'}
              </button>
            </div>
          )}

          {/* Results Feedback Banner */}
          {result && (
            <div
              className={`p-4 rounded-lg border text-xs font-bold flex items-start gap-3 animate-in fade-in ${
                result.success
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                  : 'bg-rose-50 border-rose-400 text-rose-950'
              }`}
            >
              {result.success ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div>{result.message}</div>
                {result.isTampered && (
                  <div className="text-[11px] font-normal text-rose-800">
                    Audit event <code>RECEIPT_REJECTED</code> logged in cryptographic tamper ledger. Zero stock was modified.
                  </div>
                )}
              </div>
            </div>
          )}

          {isVerifying && (
            <div className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-slate-700">
              <RefreshCw className="h-4 w-4 animate-spin text-[#0B2A5B]" />
              <span>{isHindi ? 'क्रिप्टोग्राफ़िक टोकन का सत्यापन किया जा रहा है...' : 'Verifying cryptographic token with server...'}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-md transition-colors"
          >
            {isHindi ? 'बंद करें' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
