import React, { useState } from 'react';
import { Truck, CheckCircle2, ShieldAlert, AlertTriangle, X, RefreshCw } from 'lucide-react';
import { ChallanCard } from './ChallanCard';
import { EposScanDialog } from './EposScanDialog';
import { apiClient } from '../../services/apiClient';
import { useI18n } from '../../i18n/I18nContext';

export function ChallanInbox({ fpsCode, incomingChallans = [], deliveredChallans = [], onChallanReceived }) {
  const { isHindi } = useI18n();

  const [activeScanChallan, setActiveScanChallan] = useState(null);
  const [disputeChallan, setDisputeChallan] = useState(null);
  const [disputeRemarks, setDisputeRemarks] = useState('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);
  const [disputeMsg, setDisputeMsg] = useState(null);

  const handleOpenDispute = (challan) => {
    setDisputeChallan(challan);
    setDisputeRemarks('');
    setDisputeMsg(null);
  };

  const handleConfirmDispute = async (e) => {
    e.preventDefault();
    if (!disputeRemarks.trim()) return;

    setIsSubmittingDispute(true);
    try {
      const res = await apiClient.rejectFpsReceipt({
        challanNo: disputeChallan.challan_no,
        fpsCode,
        remarks: disputeRemarks,
      });
      setDisputeMsg({
        success: true,
        message: isHindi ? 'विसंगति रिपोर्ट सतर्कता रजिस्टर में दर्ज की गई!' : 'Discrepancy logged in official vigilance ledger.',
      });
      setTimeout(() => {
        setDisputeChallan(null);
      }, 1500);
    } catch (err) {
      setDisputeMsg({
        success: false,
        message: err.message || 'Failed to submit discrepancy report',
      });
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Incoming In-Transit Challans Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Truck className="h-4 w-4 text-blue-700" />
            <span>{isHindi ? 'आवक राशन चालान (Incoming In-Transit Challans)' : 'Incoming In-Transit Delivery Challans'}</span>
          </h3>
          <span className="text-xs font-bold text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-full border border-blue-200">
            {incomingChallans.length} {isHindi ? 'मार्ग में' : 'Active In-Transit'}
          </span>
        </div>

        {incomingChallans.length === 0 ? (
          <div className="bg-white rounded-lg border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
            <CheckCircle2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">
              {isHindi ? 'कोई सक्रिय आवक चालान मार्ग में नहीं है' : 'No incoming challans currently in transit'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {isHindi ? 'गोदाम द्वारा नया चालान प्रेषित होते ही यहाँ प्रदर्शित होगा।' : 'Challans dispatched from Central Godown will appear here instantly via live sync.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {incomingChallans.map((challan) => (
              <ChallanCard
                key={challan.id || challan.challan_no}
                challan={challan}
                onOpenScanDialog={(c) => setActiveScanChallan(c)}
                onReportDiscrepancy={handleOpenDispute}
              />
            ))}
          </div>
        )}
      </div>

      {/* 2. Delivered / Received Challans Section */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            <span>{isHindi ? 'प्राप्त चालानों का इतिहास (Delivered Challans)' : 'Received Delivery Challans History'}</span>
          </h3>
          <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
            {deliveredChallans.length} {isHindi ? 'प्राप्त' : 'Delivered'}
          </span>
        </div>

        {deliveredChallans.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-6 text-center text-xs text-slate-500">
            {isHindi ? 'कोई पूर्व प्राप्त चालान नहीं मिला' : 'No delivered challans recorded yet for this shop'}
          </div>
        ) : (
          <div className="space-y-3">
            {deliveredChallans.map((challan) => (
              <ChallanCard
                key={challan.id || challan.challan_no}
                challan={challan}
                onOpenScanDialog={(c) => setActiveScanChallan(c)}
                onReportDiscrepancy={handleOpenDispute}
              />
            ))}
          </div>
        )}
      </div>

      {/* e-PoS Scanner Modal */}
      {activeScanChallan && (
        <EposScanDialog
          challan={activeScanChallan}
          fpsCode={fpsCode}
          onClose={() => setActiveScanChallan(null)}
          onReceiptConfirmed={(res) => {
            setActiveScanChallan(null);
            if (onChallanReceived) onChallanReceived(res);
          }}
        />
      )}

      {/* Discrepancy Report Modal */}
      {disputeChallan && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-xl border border-slate-300 shadow-2xl overflow-hidden">
            <div className="bg-rose-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-300" />
                <h3 className="font-bold text-sm">
                  {isHindi ? 'चालान विसंगति रिपोर्ट (Report Discrepancy)' : 'Report Challan Discrepancy'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDisputeChallan(null)}
                className="text-slate-300 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmDispute} className="p-5 space-y-4 text-xs">
              <div>
                <span className="text-slate-500 block mb-1">
                  {isHindi ? 'चालान संख्या:' : 'Challan Number:'}
                </span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {disputeChallan.challan_no}
                </span>
              </div>

              <div>
                <label htmlFor="dispute-remarks-textarea" className="block text-slate-700 font-bold mb-1">
                  {isHindi ? 'विसंगति विवरण / कारण (Remarks - Required):' : 'Discrepancy Details / Reason (Required):'}
                </label>
                <textarea
                  id="dispute-remarks-textarea"
                  rows={3}
                  required
                  placeholder={isHindi ? 'उदा. बोरियों की सील टूटी पाई गई अथवा वजन में 2 क्विंटल की कमी' : 'e.g. Gunny bag seals damaged or physical shortage of 2 Quintals'}
                  value={disputeRemarks}
                  onChange={(e) => setDisputeRemarks(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2.5 outline-none focus:ring-2 focus:ring-rose-500 text-xs"
                />
              </div>

              {disputeMsg && (
                <div className={`p-3 rounded border text-xs font-bold ${
                  disputeMsg.success ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}>
                  {disputeMsg.message}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setDisputeChallan(null)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded"
                >
                  {isHindi ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDispute || !disputeRemarks.trim()}
                  className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded shadow-xs disabled:bg-slate-300"
                >
                  {isSubmittingDispute ? (isHindi ? 'दर्ज किया जा रहा है...' : 'Logging...') : (isHindi ? 'विसंगति दर्ज करें' : 'Submit Dispute')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
