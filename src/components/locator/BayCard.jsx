import React, { useMemo } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { calculateAgeDays, CRITICAL_AGE_DAYS, QUALITY_STATUS } from '../../types/models';
import { 
  ArrowUp, 
  ArrowDown, 
  AlertTriangle, 
  Lock, 
  Layers, 
  CheckCircle2,
  Sparkles
} from 'lucide-react';

export const BayCard = React.memo(function BayCard({
  bayId,
  batches = [],
  isSelected = false,
  onSelectBay,
  pickOrder = null,     // number 1, 2, 3 if in active challan
  isNextPick = false,    // true if this bay is the current step target
  hasActiveChallan = false, // true if challan is staged (to dim non-pick bays)
  compact = false,       // compact mode for challan preview or handset
}) {
  const { t, tCommodity } = useI18n();

  // Filter batches with remaining stock > 0
  const activeBatches = useMemo(() => {
    return batches.filter(b => (b.remainingQtl || 0) > 0);
  }, [batches]);

  // Sort batches by stackPosition: 0 (FRONT) -> 1 (BACK)
  // If stackPosition is missing, newer stock is in front (receiptDate descending)
  const sortedLayers = useMemo(() => {
    return [...activeBatches].sort((a, b) => {
      if (a.stackPosition !== undefined && b.stackPosition !== undefined) {
        return a.stackPosition - b.stackPosition;
      }
      return new Date(b.receiptDate) - new Date(a.receiptDate);
    });
  }, [activeBatches]);

  // Determine oldest batch with stock for bay coloring
  const oldestBatch = useMemo(() => {
    if (activeBatches.length === 0) return null;
    return [...activeBatches].sort((a, b) => {
      return calculateAgeDays(b.receiptDate) - calculateAgeDays(a.receiptDate);
    })[0];
  }, [activeBatches]);

  const oldestAgeDays = oldestBatch ? calculateAgeDays(oldestBatch.receiptDate) : 0;
  const hasHold = activeBatches.some(b => b.qualityStatus === QUALITY_STATUS.HOLD_HIGH_MOISTURE);
  const isCritical = oldestAgeDays >= CRITICAL_AGE_DAYS && !hasHold;
  const isModerate = oldestAgeDays >= 21 && oldestAgeDays < CRITICAL_AGE_DAYS && !hasHold;
  const isFresh = oldestAgeDays < 21 && !hasHold && activeBatches.length > 0;
  const isEmpty = activeBatches.length === 0;

  // Blocked-Access Warning Detection:
  // If a batch at a back layer (index > 0) is older than a front batch (index === 0)
  const isBlockedAccess = useMemo(() => {
    if (sortedLayers.length < 2) return false;
    const frontBatch = sortedLayers[0];
    const frontAge = calculateAgeDays(frontBatch.receiptDate);
    
    // Check if any subsequent layer (BACK) is older than front layer
    for (let i = 1; i < sortedLayers.length; i++) {
      const backAge = calculateAgeDays(sortedLayers[i].receiptDate);
      if (backAge > frontAge) {
        return true;
      }
    }
    return false;
  }, [sortedLayers]);

  // Compute Card Color and Styling
  let borderStyle = 'border-slate-300 bg-white';
  let headerBg = 'bg-slate-100 text-slate-800';

  if (isEmpty) {
    borderStyle = 'border-dashed border-slate-300 bg-slate-50/70 text-slate-400';
    headerBg = 'bg-slate-100/60 text-slate-500';
  } else if (hasHold) {
    borderStyle = 'border-purple-400 bg-hatched-hold';
    headerBg = 'bg-purple-100 text-purple-900';
  } else if (isCritical) {
    borderStyle = 'border-red-500 bg-red-50/70';
    headerBg = 'bg-red-600 text-white animate-pulse-critical';
  } else if (isModerate) {
    borderStyle = 'border-amber-400 bg-amber-50/60';
    headerBg = 'bg-amber-100 text-amber-900';
  } else if (isFresh) {
    borderStyle = 'border-emerald-400 bg-emerald-50/60';
    headerBg = 'bg-emerald-100 text-emerald-900';
  }

  // Active Challan Dimming and Next Pick Pulsing
  const isDimmed = hasActiveChallan && !pickOrder;
  const nextPickRing = isNextPick ? 'ring-4 ring-amber-500 animate-pulse scale-[1.02] shadow-lg' : '';

  return (
    <div
      onClick={() => onSelectBay && onSelectBay(bayId)}
      className={`rounded-lg border-2 transition-all relative flex flex-col justify-between overflow-hidden cursor-pointer select-none ${borderStyle} ${
        isSelected ? 'ring-2 ring-[#0B2A5B] shadow-md scale-[1.01]' : 'hover:shadow-sm'
      } ${nextPickRing} ${isDimmed ? 'opacity-35 grayscale-[50%]' : 'opacity-100'}`}
    >
      {/* Active Challan Pick Badge (1, 2, 3 in FIFO order) */}
      {pickOrder !== null && (
        <div className="absolute top-1.5 right-1.5 z-20 flex items-center gap-1 bg-amber-500 text-slate-950 font-black text-[11px] px-2 py-0.5 rounded-full shadow-md border border-amber-300">
          <Sparkles className="h-3 w-3" />
          <span>PICK #{pickOrder}</span>
        </div>
      )}

      {/* Bay Header */}
      <div className={`px-2.5 py-1.5 flex items-center justify-between text-xs font-bold ${headerBg}`}>
        <span className="font-mono text-sm tracking-tight flex items-center gap-1.5">
          <span>{bayId}</span>
          {hasHold && (
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-700 text-white uppercase font-bold">
              {t('common.holdShort')}
            </span>
          )}
        </span>

        {!isEmpty && (
          <span 
            title="Batch Age / बैच की आयु"
            className="text-[10px] font-mono px-1.5 py-0.2 rounded font-bold"
          >
            {hasHold ? 'HOLD' : `${oldestAgeDays}d old`}
          </span>
        )}
      </div>

      {/* Bay Body: Layered Depth Stacks (Front to Back) */}
      <div className="p-2 space-y-1.5 flex-1 flex flex-col justify-center">
        {isEmpty ? (
          <div className="text-center py-4 text-[11px] font-mono text-slate-400">
            {t('common.empty')}
          </div>
        ) : (
          <div className="space-y-1.5">
            {sortedLayers.map((layerBatch, idx) => {
              const layerAge = calculateAgeDays(layerBatch.receiptDate);
              const layerIsCrit = layerAge >= CRITICAL_AGE_DAYS && layerBatch.qualityStatus !== QUALITY_STATUS.HOLD_HIGH_MOISTURE;
              const isFront = idx === 0;

              return (
                <div
                  key={layerBatch.batchId}
                  className={`p-1.5 rounded border text-[11px] font-mono transition-colors flex items-center justify-between gap-1 ${
                    isFront 
                      ? 'bg-white border-slate-300 shadow-xs' 
                      : 'bg-slate-100/90 border-slate-300/80'
                  }`}
                >
                  <div className="truncate">
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] px-1 py-0.1 rounded bg-slate-200 text-slate-700 font-bold uppercase">
                        {isFront ? t('common.frontAisle') : t('common.backLayer')}
                      </span>
                      <span className="font-bold text-slate-900 truncate">
                        #{layerBatch.batchId}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-600 truncate mt-0.5 font-sans font-medium">
                      {tCommodity(layerBatch.commodity)}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-slate-900">
                      {layerBatch.remainingQtl} <span className="text-[9px] font-sans text-slate-500">{t('common.qtl')}</span>
                    </div>
                    <span 
                      title="Batch Age / बैच की आयु"
                      className={`text-[9px] font-bold px-1 rounded ${
                        layerIsCrit 
                          ? 'bg-red-600 text-white animate-pulse-critical' 
                          : 'text-slate-600 bg-slate-200'
                      }`}
                    >
                      {layerAge}d
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Blocked Access Warning Notification */}
      {isBlockedAccess && (
        <div className="bg-amber-100 border-t border-amber-300 p-1.5 text-amber-950 text-[10px] font-bold flex items-center gap-1.5 leading-tight animate-pulse">
          <ArrowUp className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
          <span className="truncate" title={t('common.olderStockAtBack')}>
            {t('common.olderStockAtBack')}
          </span>
        </div>
      )}
    </div>
  );
});
