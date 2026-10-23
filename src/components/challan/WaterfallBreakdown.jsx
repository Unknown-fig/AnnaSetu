import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { WATERFALL_STEP_INTERVAL_MS } from '../../config';
import { 
  ArrowRight, 
  CheckCircle2, 
  Layers, 
  Warehouse, 
  Lock, 
  Sparkles,
  Info
} from 'lucide-react';

export const WaterfallBreakdown = React.memo(function WaterfallBreakdown({
  waterfallSteps = [],
  skippedHoldBatches = [],
  requestedQty = 0,
  commodity = '',
}) {
  const { t, tCommodity } = useI18n();
  const [visibleStepCount, setVisibleStepCount] = useState(0);

  // Check prefers-reduced-motion
  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Progressive reveal effect (400ms per step, or instant if reduced motion)
  useEffect(() => {
    if (prefersReducedMotion) {
      setVisibleStepCount(waterfallSteps.length);
      return;
    }

    setVisibleStepCount(0);
    if (waterfallSteps.length === 0) return;

    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      setVisibleStepCount(current);
      if (current >= waterfallSteps.length) {
        clearInterval(interval);
      }
    }, WATERFALL_STEP_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [waterfallSteps, requestedQty, commodity, prefersReducedMotion]);

  const totalAllocated = waterfallSteps
    .slice(0, visibleStepCount)
    .reduce((sum, s) => sum + s.take, 0);

  const isComplete = visibleStepCount >= waterfallSteps.length && waterfallSteps.length > 0;

  return (
    <div className="bg-slate-50 border border-slate-300 rounded-lg p-4 space-y-3">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200 gap-1">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-[#0B2A5B]" />
          <h3 className="text-xs font-bold text-[#0B2A5B] uppercase tracking-wider">
            Waterfall Split Breakdown (क्रमिक आवंटन विवरण)
          </h3>
        </div>
        <div className="text-xs font-mono font-bold text-slate-700">
          Target: <span className="text-[#0B2A5B]">{requestedQty} {t('common.qtl')}</span> {tCommodity(commodity)}
        </div>
      </div>

      {/* Skipped Informational Rows (in grey) */}
      {skippedHoldBatches.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Info className="h-3 w-3 text-purple-600" />
            <span>Informational: Quality Hold Batches Bypassed</span>
          </div>
          {skippedHoldBatches.map(b => (
            <div
              key={b.batchId}
              className="p-2.5 rounded bg-slate-100/80 border border-dashed border-slate-300 text-slate-500 text-xs font-mono flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-purple-100 text-purple-800">
                  <Lock className="h-3 w-3" />
                </span>
                <span className="font-bold text-slate-700">#{b.batchId}</span>
                <span>(Bay {b.bay}, {b.ageDays}d old)</span>
                <span className="text-purple-700 font-semibold">• {b.reason}</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-800 font-bold border border-purple-200">
                0 Qtl taken (Bypassed)
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Sequential Waterfall Steps */}
      <div className="space-y-2">
        {waterfallSteps.slice(0, visibleStepCount).map((step) => {
          return (
            <div
              key={step.stepNumber}
              className="p-3 rounded-lg border border-slate-300 bg-white shadow-xs transition-all animate-in fade-in slide-in-from-left-2 duration-300 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-amber-100 text-amber-900 border border-amber-300">
                    Step {step.stepNumber}
                  </span>
                  <span className="font-mono font-black text-xs text-slate-900">
                    Batch #{step.batchId}
                  </span>
                  <span className="text-[11px] font-mono text-amber-800 font-semibold flex items-center gap-0.5">
                    <Warehouse className="h-3 w-3" />
                    Bay {step.bay}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    ({step.ageDays} days old)
                  </span>
                </div>

                <div className="font-mono text-xs font-bold text-slate-900">
                  Take: <span className="text-[#138808] font-black">{step.take} Qtl</span>
                </div>
              </div>

              {/* Cascade Equation Representation */}
              <div className="p-2 rounded bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between text-xs font-mono text-slate-700 gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Balance:</span>
                  <span className="font-bold text-slate-900">{step.balanceBefore} Qtl</span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-slate-500">Take:</span>
                  <span className="font-bold text-[#138808]">{step.take} Qtl</span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-slate-500">Batch Balance:</span>
                  <span className={`font-bold ${step.balanceAfter === 0 ? 'text-red-700' : 'text-slate-900'}`}>
                    {step.balanceAfter} Qtl {step.balanceAfter === 0 ? '(Exhausted)' : ''}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-slate-500">Still needed: </span>
                  <span className={`font-black ${step.stillNeeded === 0 ? 'text-[#138808]' : 'text-amber-800'}`}>
                    {step.stillNeeded} Qtl
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Waterfall Completion Summary Banner */}
      {isComplete && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-950 text-xs font-mono flex items-center justify-between shadow-xs animate-in zoom-in-95">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#138808]" />
            <span className="font-bold">
              Total allocated: {totalAllocated} / {requestedQty} Qtl OK
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
            100% FIFO Compliant
          </span>
        </div>
      )}
    </div>
  );
});
