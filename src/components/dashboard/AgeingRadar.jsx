import React, { useMemo } from 'react';
import { useStore } from '../../context/store';
import { useI18n } from '../../i18n/I18nContext';
import { 
  calculateAgeDays, 
  getAgeCategory, 
  CRITICAL_AGE_DAYS, 
  QUALITY_STATUS 
} from '../../types/models';
import { 
  Radar, 
  Warehouse, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles,
  Lock,
  ArrowRight
} from 'lucide-react';

export const AgeingRadar = React.memo(function AgeingRadar({ onNavigateToChallan }) {
  const { state } = useStore();
  const { batches } = state;
  const { t, tCommodity } = useI18n();

  // 1. Identify the oldest ELIGIBLE batch for each commodity to grant the "Dispatch first" chip
  const oldestEligiblePerCommodity = useMemo(() => {
    const map = new Map();
    batches
      .filter(b => b.remainingQtl > 0 && b.qualityStatus === QUALITY_STATUS.ELIGIBLE)
      .forEach(b => {
        const age = calculateAgeDays(b.receiptDate);
        if (!map.has(b.commodity) || age > map.get(b.commodity).age) {
          map.set(b.commodity, { batchId: b.batchId, age });
        }
      });
    return map;
  }, [batches]);

  // 2. Extract top 5 oldest batches that still have stock, sorted by age descending
  const topOldestBatches = useMemo(() => {
    return [...batches]
      .filter(b => b.remainingQtl > 0)
      .map(b => ({
        ...b,
        ageDays: calculateAgeDays(b.receiptDate),
      }))
      .sort((a, b) => b.ageDays - a.ageDays)
      .slice(0, 5);
  }, [batches]);

  return (
    <div className="bg-white border border-slate-300 rounded-lg p-4 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-slate-200 gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-red-50 text-red-700 border border-red-200">
            <Radar className="h-4 w-4 animate-spin-slow" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0B2A5B] flex items-center gap-2">
              <span>{t('radar.title')}</span>
              <span className="text-[10px] px-2 py-0.2 rounded font-mono font-bold bg-red-100 text-red-800 border border-red-300">
                CRITICAL THRESHOLD: {CRITICAL_AGE_DAYS}+ DAYS
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              {t('radar.subtitle')}
            </p>
          </div>
        </div>

        {onNavigateToChallan && (
          <button
            type="button"
            onClick={onNavigateToChallan}
            className="flex items-center gap-1 text-xs text-blue-800 hover:text-blue-900 font-bold hover:underline self-start sm:self-center"
          >
            <span>{t('nav.deliveryChallan')}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Radar Cards / List */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {topOldestBatches.length === 0 ? (
          <div className="col-span-5 text-center py-6 text-xs text-slate-500 font-mono">
            {t('radar.noBatches')}
          </div>
        ) : (
          topOldestBatches.map((batch, index) => {
            const isHold = batch.qualityStatus === QUALITY_STATUS.HOLD_HIGH_MOISTURE;
            const isCritical = !isHold && batch.ageDays >= CRITICAL_AGE_DAYS;
            const isOldestEligibleForComm = 
              !isHold && oldestEligiblePerCommodity.get(batch.commodity)?.batchId === batch.batchId;

            return (
              <div
                key={batch.batchId}
                className={`p-3 rounded-lg border transition-all flex flex-col justify-between relative ${
                  isCritical 
                    ? 'border-red-300 bg-red-50/60 shadow-xs' 
                    : isHold 
                    ? 'border-purple-300 bg-purple-50/60' 
                    : 'border-amber-300 bg-amber-50/50'
                }`}
              >
                {/* Ranking Tag & Bay */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-800">
                    #{index + 1} Oldest
                  </span>
                  <span className="text-xs font-mono font-extrabold text-[#0B2A5B] bg-white px-1.5 py-0.5 rounded border border-slate-300 flex items-center gap-1">
                    <Warehouse className="h-3 w-3 text-amber-600" />
                    Bay {batch.bay}
                  </span>
                </div>

                {/* Batch ID & Commodity */}
                <div className="mt-1">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {tCommodity(batch.commodity)}
                  </div>
                  <div className="text-[11px] font-mono font-semibold text-slate-600">
                    #{batch.batchId}
                  </div>
                </div>

                {/* Age Badge & Flashing Pulse */}
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-[10px] text-slate-500 font-medium">
                    {t('common.batchAge')}:
                  </div>
                  <span
                    title={`${t('common.batchAge')}: ${batch.ageDays} ${t('common.days')}`}
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded inline-flex items-center gap-1 ${
                      isHold
                        ? 'bg-purple-100 text-purple-900 border border-purple-300'
                        : isCritical
                        ? 'bg-red-600 text-white animate-pulse-critical shadow-xs'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {isCritical && <AlertTriangle className="h-2.5 w-2.5" />}
                    {isHold && <Lock className="h-2.5 w-2.5" />}
                    <span>{batch.ageDays} {t('common.daysOld')}</span>
                  </span>
                </div>

                {/* Remaining Quantity */}
                <div className="mt-2 pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-500">{t('radar.remainingStock')}:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {batch.remainingQtl} <span className="text-[10px] text-slate-500 font-sans">{t('common.qtl')}</span>
                  </span>
                </div>

                {/* "Dispatch first" Chip */}
                {isOldestEligibleForComm ? (
                  <div className="mt-2.5 text-center">
                    <span className="w-full inline-flex items-center justify-center gap-1 px-2 py-1 rounded bg-[#138808] text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
                      <Sparkles className="h-2.5 w-2.5 text-amber-300" />
                      <span>{t('common.dispatchFirst')}</span>
                    </span>
                  </div>
                ) : isHold ? (
                  <div className="mt-2.5 text-center">
                    <span className="w-full inline-flex items-center justify-center gap-1 px-2 py-1 rounded bg-purple-700 text-white text-[10px] font-bold uppercase tracking-wider">
                      <Lock className="h-2.5 w-2.5" />
                      <span>{t('common.holdShort')}</span>
                    </span>
                  </div>
                ) : (
                  <div className="mt-2.5 text-center">
                    <span className="w-full inline-flex items-center justify-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-medium">
                      <span>FIFO Sequence</span>
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});
