import React, { useState, useEffect } from 'react';
import { Send, FileText, AlertTriangle, CheckCircle2, Clock, Truck, ShieldCheck, X } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { useI18n } from '../../i18n/I18nContext';
import { getCommodityDisplayName } from './StockView';

const COMMODITY_OPTIONS = [
  'Wheat',
  'Rice',
  'Sugar',
  'Salt',
  'Edible Oil',
  'Chana',
  'Tuvar Dal',
];

export function IndentForm({ fpsCode, indents = [], initialCommodity = 'Wheat', initialQty = 50, onIndentCreated }) {
  const { isHindi } = useI18n();

  const [commodity, setCommodity] = useState(initialCommodity);
  const [requestedQty, setRequestedQty] = useState(initialQty);
  const [priority, setPriority] = useState('NORMAL');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorToast, setErrorToast] = useState(null);
  const [successToast, setSuccessToast] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // Sync initial values when shortcut is clicked from Module 1
  useEffect(() => {
    if (initialCommodity) setCommodity(initialCommodity);
    if (initialQty) setRequestedQty(initialQty);
  }, [initialCommodity, initialQty]);

  const handleSubmit = async (e, force = false) => {
    if (e) e.preventDefault();
    setErrorToast(null);
    setSuccessToast(null);
    setDuplicateWarning(null);

    const qty = parseFloat(requestedQty);
    if (isNaN(qty) || qty <= 0 || qty > 500) {
      setErrorToast(isHindi ? 'कृपया 0.1 से 500 क्विंटल के बीच वैध मात्रा दर्ज करें' : 'Please enter a valid quantity between 0.1 and 500 Qtl');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.createIndent({
        fpsCode,
        commodity,
        requestedQty: qty,
        priority,
        remarks,
        force,
      });

      setSuccessToast({
        indentNo: res.indent_no,
        message: isHindi 
          ? `मांग पत्र ${res.indent_no} अन्नसेतु गोदाम को सफलतापूर्वक प्रेषित किया गया!`
          : `Indent ${res.indent_no} successfully submitted to AnnaSetu Godown!`,
      });
      setRemarks('');
      if (onIndentCreated) onIndentCreated(res);
    } catch (err) {
      if (err.code === 'DUPLICATE_PENDING') {
        setDuplicateWarning(err.message || 'A pending indent already exists for this commodity.');
      } else {
        setErrorToast(err.message || (isHindi ? 'मांग पत्र जमा करने में विफल' : 'Failed to submit indent'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Requisition Form Card */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs">
        <div className="border-b border-slate-200 pb-3 mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#0B2A5B]" />
              <span>{isHindi ? 'नया राशन मांग पत्र प्रेषित करें (Raise Indent)' : 'Raise Commodity Indent to Central Godown'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isHindi 
                ? 'सूरजपुर केंद्रीय अन्नसेतु गोदाम से राशन की त्वरित आपूर्ति हेतु मांग दर्ज करें'
                : 'Submit electronic requisition to Surajpur Central Godown for FIFO dispatch'}
            </p>
          </div>
          <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
            {fpsCode}
          </span>
        </div>

        {/* Success / Error Toasts */}
        {successToast && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 rounded-md text-xs text-emerald-900 font-bold flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{successToast.message}</span>
            </div>
            <button type="button" onClick={() => setSuccessToast(null)} className="text-emerald-700 hover:text-emerald-950">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {errorToast && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-300 rounded-md text-xs text-rose-900 font-bold flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{errorToast}</span>
            </div>
            <button type="button" onClick={() => setErrorToast(null)} className="text-rose-700 hover:text-rose-950">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Duplicate Pending Indent Warning Modal / Banner */}
        {duplicateWarning && (
          <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-400 rounded-md text-xs space-y-2 animate-in fade-in">
            <div className="font-bold text-amber-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
              <span>{isHindi ? 'चेतावनी: पहले से लंबित मांग पत्र मौजूद है' : 'Warning: Duplicate Pending Indent Exists'}</span>
            </div>
            <p className="text-slate-700">{duplicateWarning}</p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleSubmit(null, true)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded shadow-xs transition-colors"
              >
                {isHindi ? 'पुष्टि करें और फिर भी जमा करें (Force Submit)' : 'Confirm & Submit Anyway (Force)'}
              </button>
              <button
                type="button"
                onClick={() => setDuplicateWarning(null)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded transition-colors"
              >
                {isHindi ? 'रद्द करें' : 'Cancel'}
              </button>
            </div>
          </div>
        )}

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 1. Commodity */}
            <div>
              <label htmlFor="indent-commodity-select" className="block text-xs font-bold text-slate-700 mb-1">
                {isHindi ? 'जिंस (Commodity):' : 'Commodity:'}
              </label>
              <select
                id="indent-commodity-select"
                value={commodity}
                onChange={(e) => setCommodity(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 font-semibold text-xs rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-[#0B2A5B]"
              >
                {COMMODITY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {getCommodityDisplayName(c, isHindi)}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Required Quantity */}
            <div>
              <label htmlFor="indent-quantity-input" className="block text-xs font-bold text-slate-700 mb-1">
                {isHindi ? 'आवश्यक मात्रा (Quantity in Qtl):' : 'Required Quantity (Qtl):'}
              </label>
              <input
                id="indent-quantity-input"
                type="number"
                min="0.1"
                max="500"
                step="0.1"
                value={requestedQty}
                onChange={(e) => setRequestedQty(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 font-bold text-xs rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                required
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {isHindi ? 'अधिकतम 500.00 क्विंटल प्रति मांग' : 'Max 500.00 Qtl per requisition'}
              </span>
            </div>

            {/* 3. Priority */}
            <div>
              <label htmlFor="indent-priority-select" className="block text-xs font-bold text-slate-700 mb-1">
                {isHindi ? 'प्राथमिकता (Priority):' : 'Priority Level:'}
              </label>
              <select
                id="indent-priority-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 font-semibold text-xs rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-[#0B2A5B]"
              >
                <option value="NORMAL">{isHindi ? 'सामान्य (Normal)' : 'Normal'}</option>
                <option value="HIGH">{isHindi ? 'उच्च (High)' : 'High'}</option>
                <option value="URGENT">{isHindi ? 'अति आवश्यक (Urgent)' : 'Urgent'}</option>
              </select>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label htmlFor="indent-remarks-input" className="block text-xs font-bold text-slate-700 mb-1">
              {isHindi ? 'टिप्पणी / मांग का कारण (Remarks - Optional):' : 'Remarks / Reason for Requisition (Optional):'}
            </label>
            <input
              id="indent-remarks-input"
              type="text"
              placeholder={isHindi ? 'उदा. त्योहार राशन कोटा अथवा अंत्योदय कार्डधारक आपूर्ति' : 'e.g. Festival distribution quota or Antyodaya replenishment'}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-xs rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-[#0B2A5B]"
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-xs font-bold text-white shadow-xs transition-all ${
                isSubmitting
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-[#0B2A5B] hover:bg-[#133c7a] active:scale-[0.99]'
              }`}
            >
              <Send className="h-4 w-4" />
              <span>
                {isSubmitting
                  ? (isHindi ? 'प्रेषित किया जा रहा है...' : 'Transmitting to Godown...')
                  : (isHindi ? 'अन्नसेतु गोदाम को मांग पत्र भेजें' : 'Submit Indent to AnnaSetu Godown')}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* Indents History Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-600" />
            <span>{isHindi ? 'इस दुकान के मांग पत्रों का इतिहास' : 'Requisition History for this FPS'}</span>
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            {indents.length} {isHindi ? 'अभिलेख' : 'records'}
          </span>
        </div>

        {indents.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            {isHindi ? 'कोई पूर्व मांग पत्र दर्ज नहीं है' : 'No previous indents found for this shop'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                  <th className="py-2.5 px-3"># Indent No</th>
                  <th className="py-2.5 px-3">Commodity</th>
                  <th className="py-2.5 px-3 text-right">Quantity</th>
                  <th className="py-2.5 px-3 text-center">Priority</th>
                  <th className="py-2.5 px-3 text-center">Live Status</th>
                  <th className="py-2.5 px-3 text-right">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {indents.map((ind) => {
                  const isPending = ind.status === 'PENDING_AT_GODOWN';
                  const isIssued = ind.status === 'CHALLAN_ISSUED';
                  const isDelivered = ind.status === 'DELIVERED_TO_FPS';

                  return (
                    <tr key={ind.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 font-bold text-slate-900">{ind.indent_no}</td>
                      <td className="py-2 px-3 font-sans font-medium text-slate-800">
                        {getCommodityDisplayName(ind.commodity, isHindi)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-[#0B2A5B] font-mono">
                        {ind.requested_qty} Qtl
                      </td>
                      <td className="py-2 px-3 text-center font-sans">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ind.priority === 'URGENT'
                            ? 'bg-rose-100 text-rose-800'
                            : ind.priority === 'HIGH'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {ind.priority}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center font-sans">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <Clock className="h-3 w-3 animate-spin text-amber-700" />
                            <span>{isHindi ? 'गोदाम में लंबित' : 'Pending at Godown'}</span>
                          </span>
                        )}
                        {isIssued && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
                            <Truck className="h-3 w-3 text-blue-700" />
                            <span>{isHindi ? 'चालान जारी (In-Transit)' : 'Challan Issued'}</span>
                          </span>
                        )}
                        {isDelivered && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                            <ShieldCheck className="h-3 w-3 text-emerald-700" />
                            <span>{isHindi ? 'दुकान पर प्राप्त' : 'Delivered to FPS'}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-500 font-mono text-[10px]">
                        {new Date(ind.created_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
