import React from 'react';
import { ArrowDown, CheckCircle2, ShieldCheck, Warehouse } from 'lucide-react';
import { getAgeCategory } from '../../types/models';

export const BatchSplitDiagram = React.memo(function BatchSplitDiagram({ allocations, requestedQty, commodity }) {

  if (!allocations || allocations.length === 0) return null;

  return (
    <div className="bg-slate-50 border border-slate-300 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200 gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-emerald-100 text-[#15803d]">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wider block">
              Smart FIFO Batch Split Waterfall ({allocations.length} {allocations.length === 1 ? 'Batch' : 'Batches'} Allocated)
            </span>
            <span className="text-[10px] text-slate-500 font-hind">
              स्वचालित फीफो बैच विभाजन एवं बे आवंटन
            </span>
          </div>
        </div>
        <div className="text-[11px] font-mono text-[#15803d] font-bold flex items-center gap-1.5 bg-emerald-100/70 px-2 py-0.5 rounded border border-emerald-300">
          <CheckCircle2 className="h-3 w-3" />
          <span>Strict Oldest-First Sequence</span>
        </div>
      </div>

      {/* Waterfall Split Cascade */}
      <div className="space-y-2 pt-1">
        {allocations.map((alloc, idx) => {
          const ageCat = getAgeCategory(alloc.ageDays);
          const isLast = idx === allocations.length - 1;
          const pctOfBatchTaken = alloc.remainingBefore > 0 
            ? Math.round((alloc.take / alloc.remainingBefore) * 100) 
            : 100;

          const isCritical = alloc.ageDays >= 60;
          const isModerate = alloc.ageDays >= 21 && alloc.ageDays < 60;

          return (
            <div key={alloc.batchId} className="relative">
              <div className="bg-white border border-slate-300 rounded-lg p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-blue-400 transition-colors shadow-xs">
                {/* Step & Batch Info */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-50 border border-blue-300 text-blue-800 font-mono text-xs font-extrabold">
                    #{idx + 1}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        Batch #{alloc.batchId}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-300 font-mono text-[11px] text-amber-900 font-bold flex items-center gap-1">
                        <Warehouse className="h-3 w-3" />
                        Bay {alloc.bay}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        isCritical
                          ? 'bg-red-50 text-[#b91c1c] border-red-300'
                          : isModerate
                          ? 'bg-amber-50 text-[#b45309] border-amber-300'
                          : 'bg-emerald-50 text-[#15803d] border-emerald-300'
                      }`}>
                        {alloc.ageDays}d old
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      Supplier: <span className="font-medium text-slate-800">{alloc.supplier}</span> • Received on {alloc.receiptDate}
                    </div>
                  </div>
                </div>

                {/* Allocation Action & Balance */}
                <div className="flex items-center gap-4 self-end md:self-center">
                  {/* Take Quantity */}
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500 uppercase font-mono font-semibold">Allocating</div>
                    <div className="text-base font-extrabold font-mono text-[#15803d]">
                      +{alloc.take} <span className="text-xs text-slate-600 font-sans font-normal">Qtl</span>
                    </div>
                  </div>

                  {/* Remaining Balance Indicator */}
                  <div className="bg-slate-50 border border-slate-300 rounded p-2 text-right min-w-[130px]">
                    <div className="text-[10px] text-slate-600 flex justify-between font-mono">
                      <span>Balance:</span>
                      <span className="font-bold text-slate-900">{alloc.remainingAfter} Qtl</span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden mt-1">
                      <div 
                        className={`h-full ${alloc.remainingAfter === 0 ? 'bg-slate-400' : 'bg-[#15803d]'}`}
                        style={{ width: `${100 - pctOfBatchTaken}%` }}
                      />
                    </div>
                    <div className="text-[9px] font-mono text-slate-500 mt-0.5 text-right font-medium">
                      {alloc.remainingAfter === 0 ? 'Batch Exhausted (पूर्ण निकासी)' : 'Partial Balance Kept'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Connecting arrow if multiple batches */}
              {!isLast && (
                <div className="flex justify-center my-1 text-slate-400">
                  <ArrowDown className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Footer */}
      <div className="bg-blue-50 border border-blue-200 rounded p-3 flex flex-wrap items-center justify-between text-xs font-mono">
        <span className="text-blue-900 font-semibold">Total Challan Fulfillment:</span>
        <span className="font-bold text-blue-950 text-sm">
          {requestedQty} Qtl of {commodity} (100% Oldest Stock Utilized)
        </span>
      </div>
    </div>
  );
});

