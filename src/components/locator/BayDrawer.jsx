import React, { useState, useCallback } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { calculateAgeDays, CRITICAL_AGE_DAYS, QUALITY_STATUS } from '../../types/models';
import { 
  X, 
  Warehouse, 
  Layers, 
  Copy, 
  Check, 
  AlertTriangle, 
  Lock, 
  CheckCircle2, 
  ArrowUp
} from 'lucide-react';

export const BayDrawer = React.memo(function BayDrawer({
  isOpen,
  bayId,
  batches = [],
  onClose,
}) {
  const { t, tCommodity } = useI18n();
  const [copiedBatchId, setCopiedBatchId] = useState(null);

  const handleCopyHash = useCallback((hash, batchId) => {
    navigator.clipboard?.writeText(hash);
    setCopiedBatchId(batchId);
    setTimeout(() => setCopiedBatchId(null), 2000);
  }, []);

  if (!isOpen) return null;

  // Filter batches with remaining stock > 0
  const activeBatches = batches.filter(b => (b.remainingQtl || 0) > 0);
  const totalQty = activeBatches.reduce((acc, b) => acc + (b.remainingQtl || 0), 0);

  // Check if older stock is behind newer stock
  const sortedLayers = [...activeBatches].sort((a, b) => {
    if (a.stackPosition !== undefined && b.stackPosition !== undefined) {
      return a.stackPosition - b.stackPosition;
    }
    return new Date(b.receiptDate) - new Date(a.receiptDate);
  });

  const isBlocked = sortedLayers.length > 1 && 
    calculateAgeDays(sortedLayers[1].receiptDate) > calculateAgeDays(sortedLayers[0].receiptDate);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-900/40 backdrop-blur-xs select-none">
      <div 
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between border-l border-slate-300 animate-slide-left"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-[#0B2A5B] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-white/10 text-white">
              <Warehouse className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h3 id="drawer-title" className="text-base font-extrabold font-mono tracking-tight text-white">
                {t('locator.inspectBayTitle', { bay: bayId })}
              </h3>
              <p className="text-[11px] text-blue-200">
                Surajpur Central Godown • {totalQty} {t('common.qtl')} total stock
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs text-slate-800">
          {/* Blocked Access Banner if applicable */}
          {isBlocked && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-amber-950 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-xs text-red-700">
                <ArrowUp className="h-4 w-4" />
                <span>{t('common.olderStockAtBack')}</span>
              </div>
              <p className="text-[11px] text-slate-700 leading-relaxed font-sans">
                Notice: An older batch in this bay is stacked behind a newer batch. Forklift operators must safely de-stack the front bags before picking the older batch to maintain FIFO compliance.
              </p>
            </div>
          )}

          {/* Batches in Bay */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#0B2A5B] uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-amber-600" />
              <span>{t('locator.stackedLayers')} ({activeBatches.length} Batches)</span>
            </h4>

            {activeBatches.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-mono text-xs border border-dashed border-slate-300 rounded-lg">
                {t('common.empty')}
              </div>
            ) : (
              sortedLayers.map((batch, idx) => {
                const ageDays = calculateAgeDays(batch.receiptDate);
                const isHold = batch.qualityStatus === QUALITY_STATUS.HOLD_HIGH_MOISTURE;
                const isCritical = !isHold && ageDays >= CRITICAL_AGE_DAYS;
                const isFront = idx === 0;

                return (
                  <div
                    key={batch.batchId}
                    className={`p-3.5 rounded-lg border transition-all space-y-2 ${
                      isCritical
                        ? 'border-red-300 bg-red-50/50'
                        : isHold
                        ? 'border-purple-300 bg-purple-50/50'
                        : 'border-slate-300 bg-slate-50'
                    }`}
                  >
                    {/* Layer & Batch ID */}
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-slate-200 text-slate-800">
                          {isFront ? t('common.frontAisle') : t('common.backLayer')}
                        </span>
                        <span className="font-mono font-black text-sm text-slate-900">
                          #{batch.batchId}
                        </span>
                      </div>

                      {/* Age Badge */}
                      <span
                        title="Batch Age / बैच की आयु"
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                          isHold
                            ? 'bg-purple-100 text-purple-900 border border-purple-300'
                            : isCritical
                            ? 'bg-red-600 text-white animate-pulse-critical'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        }`}
                      >
                        {isCritical && <AlertTriangle className="h-2.5 w-2.5" />}
                        {isHold && <Lock className="h-2.5 w-2.5" />}
                        <span>{ageDays} {t('common.daysOld')}</span>
                      </span>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                      <div>
                        <span className="text-slate-500 block text-[10px]">{t('radar.commodity')}:</span>
                        <span className="font-bold text-slate-900 text-xs">
                          {tCommodity(batch.commodity)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">{t('common.stockBalance')}:</span>
                        <span className="font-mono font-extrabold text-slate-900 text-xs">
                          {batch.remainingQtl} <span className="font-normal text-slate-500">{t('common.qtl')}</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">{t('common.supplier')}:</span>
                        <span className="text-slate-800 font-medium">
                          {batch.supplier}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">{t('common.receiptDate')}:</span>
                        <span className="font-mono text-slate-800">
                          {batch.receiptDate}
                        </span>
                      </div>
                    </div>

                    {/* SHA-256 Genesis Hash */}
                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px] font-mono">
                      <span className="text-slate-500">Hash: {batch.sha256Hash?.slice(0, 18)}...</span>
                      <button
                        type="button"
                        onClick={() => handleCopyHash(batch.sha256Hash, batch.batchId)}
                        className="text-blue-700 hover:text-blue-900 flex items-center gap-1 font-semibold"
                      >
                        {copiedBatchId === batch.batchId ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span>{t('common.copied')}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>{t('common.copy')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors shadow-xs"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
});
