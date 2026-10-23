import React, { useState } from 'react';
import { 
  Truck, CheckCircle2, ShieldAlert, QrCode, AlertTriangle, 
  Copy, ExternalLink, Calendar, MapPin, Layers, ChevronDown, ChevronUp 
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { getCommodityDisplayName } from './StockView';

export function ChallanCard({ challan, onOpenScanDialog, onReportDiscrepancy }) {
  const { isHindi } = useI18n();
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedToken, setCopiedToken] = useState(false);

  const isInTransit = challan.status === 'IN_TRANSIT';
  const isReceived = challan.status === 'RECEIVED_AT_FPS';
  const allocations = Array.isArray(challan.allocated_batches) ? challan.allocated_batches : [];

  const handleCopyToken = () => {
    if (challan.crypto_token) {
      navigator.clipboard.writeText(challan.crypto_token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  return (
    <div className={`bg-white rounded-lg border transition-all shadow-xs overflow-hidden ${
      isInTransit 
        ? 'border-blue-300 ring-1 ring-blue-200' 
        : 'border-slate-200'
    }`}>
      {/* Header bar */}
      <div className={`p-4 flex flex-wrap items-center justify-between gap-3 border-b ${
        isInTransit ? 'bg-blue-50/50 border-blue-200' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center gap-2.5">
          {isInTransit ? (
            <div className="p-2 bg-blue-100 text-blue-800 rounded-lg">
              <Truck className="h-5 w-5 animate-pulse" />
            </div>
          ) : (
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm text-slate-900">
                {challan.challan_no}
              </span>
              {isInTransit ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300 uppercase">
                  {isHindi ? 'परिवहन में (In-Transit)' : 'In-Transit'}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 uppercase">
                  {isHindi ? 'दुकान पर प्राप्त (Received)' : 'Received at FPS'}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5 font-sans">
              <Calendar className="h-3 w-3" />
              <span>{isHindi ? 'जारी समय:' : 'Issued:'} {new Date(challan.issued_at).toLocaleString()}</span>
              {challan.received_at && (
                <span>• {isHindi ? 'प्राप्ति:' : 'Delivered:'} {new Date(challan.received_at).toLocaleTimeString()}</span>
              )}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          {isInTransit && (
            <>
              <button
                type="button"
                onClick={() => onOpenScanDialog(challan)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0B2A5B] hover:bg-[#133c7a] text-white text-xs font-bold rounded-md shadow-xs transition-colors"
              >
                <QrCode className="h-3.5 w-3.5 text-amber-300" />
                <span>{isHindi ? 'ई-पॉस क्यूआर सत्यापन' : 'Scan Challan QR & Confirm'}</span>
              </button>
              <button
                type="button"
                onClick={() => onReportDiscrepancy(challan)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs font-bold rounded-md transition-colors"
                title={isHindi ? 'विसंगति दर्ज करें' : 'Report Discrepancy'}
              >
                <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                <span className="hidden sm:inline">{isHindi ? 'विसंगति' : 'Dispute'}</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(v => !v)}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors"
            aria-label="Toggle details"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Body */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Top Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Commodity & Quantity */}
            <div className="bg-slate-50 border border-slate-200 rounded-md p-2.5">
              <span className="text-slate-500 text-[11px] block">{isHindi ? 'आवंटित जिंस:' : 'Commodity & Total:'}</span>
              <div className="font-bold text-sm text-slate-900 mt-0.5">
                {getCommodityDisplayName(challan.commodity, isHindi)}
              </div>
              <div className="font-mono font-black text-base text-[#0B2A5B]">
                {challan.total_qty} Qtl
              </div>
            </div>

            {/* FIFO Compliance Status */}
            <div className="bg-slate-50 border border-slate-200 rounded-md p-2.5">
              <span className="text-slate-500 text-[11px] block">{isHindi ? 'वैधानिक FIFO स्थिति:' : 'FIFO Status:'}</span>
              {challan.is_fifo_compliant ? (
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold mt-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{isHindi ? 'पूर्णतः अनुपालन (FIFO Compliant)' : 'Strict FIFO Compliant'}</span>
                </div>
              ) : (
                <div className="text-amber-900 font-bold mt-1">
                  <div className="flex items-center gap-1 text-xs">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                    <span>{isHindi ? 'अधिकृत अपवाद (Exception Approved)' : 'Authorized Statutory Exception'}</span>
                  </div>
                  {challan.exception_reason && (
                    <span className="text-[10px] text-slate-600 font-normal block mt-0.5">
                      {challan.exception_reason}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Cryptographic Token */}
            <div className="bg-slate-50 border border-slate-200 rounded-md p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[11px]">{isHindi ? 'क्रिप्टोग्राफ़िक टोकन:' : 'SHA-256 Token:'}</span>
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-[10px] font-bold"
                  title="Copy full 64-char token"
                >
                  <Copy className="h-3 w-3" />
                  <span>{copiedToken ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <div className="font-mono font-bold text-slate-800 text-xs mt-1 truncate" title={challan.crypto_token}>
                {challan.crypto_token ? challan.crypto_token.slice(0, 20) + '...' : 'N/A'}
              </div>
              <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
                Chained Merkle Hash
              </span>
            </div>
          </div>

          {/* Visual Multi-Batch Waterfall Breakdown */}
          <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-[#0B2A5B]" />
              <span>{isHindi ? 'बहु-बैच वाटरफॉल आवंटन (Batch Allocation Breakdown):' : 'Multi-Batch Waterfall Allocation:'}</span>
            </span>

            {allocations.length === 0 ? (
              <span className="text-xs text-slate-500">{isHindi ? 'बैच विवरण उपलब्ध नहीं' : 'Single batch allocation'}</span>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {allocations.map((a, idx) => {
                    const bcode = a.batch_code || a.batchId || a.batch_id;
                    const qty = a.allocated_qty || a.take;
                    const bay = a.stack_bay || a.bay;
                    const age = a.batch_age_days || a.ageDays || 0;

                    const isCrit = age >= 60;
                    const isMod = age >= 21 && age < 60;

                    return (
                      <div
                        key={idx}
                        className="bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs shadow-2xs flex items-center gap-2"
                      >
                        <span className="font-bold text-slate-900 font-mono">#{bcode}</span>
                        <span className="text-slate-400">•</span>
                        <span className="font-mono font-bold text-[#0B2A5B]">{qty} Qtl</span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-600 font-medium font-sans">Bay {bay}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          isCrit
                            ? 'bg-rose-100 text-rose-800'
                            : isMod
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {age}d
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Text summary formula */}
                <div className="text-[11px] font-mono text-slate-600 pt-1 border-t border-slate-200">
                  {allocations.map(a => `${a.allocated_qty || a.take} Qtl from #${a.batch_code || a.batchId}`).join(' + ')} = <strong className="text-slate-900">{challan.total_qty} Qtl Total</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
