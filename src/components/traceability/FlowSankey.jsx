import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/store';
import { COMMODITIES } from '../../types/models';
import { useI18n } from '../../i18n/I18nContext';
import { ArrowRight, Package, Warehouse, Store, Layers } from 'lucide-react';

export const FlowSankey = React.memo(function FlowSankey() {
  const { state } = useStore();
  const { isHindi, tCommodity } = useI18n();
  const { batches, auditLogs } = state;

  const [selectedCommodity, setSelectedCommodity] = useState('Rice');

  // Compute flow links: Supplier -> Batch -> FPS
  const flowData = useMemo(() => {
    const commodityBatches = batches.filter(b => b.commodity === selectedCommodity);
    const batchMap = new Map();

    commodityBatches.forEach(b => {
      batchMap.set(b.batchId, {
        batchId: b.batchId,
        supplier: b.supplier,
        received: b.qtyReceivedQtl,
        remaining: b.remainingQtl,
        dispatches: [],
      });
    });

    auditLogs.forEach(log => {
      if (log.type === 'DISPATCH_COMPLETED' && log.commodity === selectedCommodity) {
        if (batchMap.has(log.batchId)) {
          batchMap.get(log.batchId).dispatches.push({
            fpsName: log.fpsName || 'Fair Price Shop',
            fpsId: log.fpsId,
            qty: log.quantity,
            challanNo: log.challanNo,
          });
        }
      }
    });

    return Array.from(batchMap.values());
  }, [batches, auditLogs, selectedCommodity]);

  return (
    <div className="bg-white border border-slate-300 rounded-xl p-5 shadow-xs space-y-4">
      {/* Header and Commodity Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h3 className="font-bold text-sm text-[#0B2A5B] flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#0B2A5B]" />
            <span>{isHindi ? 'खाद्यान्न आपूर्ति प्रवाह (सप्लायर ➜ बैच ➜ कोटेदार)' : 'Grain Supply Flow (Supplier ➜ Batch ➜ FPS)'}</span>
          </h3>
          <p className="text-xs text-slate-500">
            End-to-end multi-hop movement for selected commodity
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="flow-commodity-select" className="text-xs font-bold text-slate-600">
            {isHindi ? 'वस्तु' : 'Commodity'}:
          </label>
          <select
            id="flow-commodity-select"
            value={selectedCommodity}
            onChange={(e) => setSelectedCommodity(e.target.value)}
            className="py-1 px-3 border border-slate-300 rounded-md font-bold text-xs bg-white text-slate-900"
          >
            {COMMODITIES.map(c => (
              <option key={c} value={c}>{c} {isHindi ? `(${tCommodity(c)})` : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Visual Flow Network (Adaptive Node Columns) */}
      <div className="space-y-4">
        {flowData.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-mono text-xs">
            No active batches or dispatches found for {selectedCommodity}.
          </div>
        ) : (
          <div className="space-y-3">
            {flowData.map((flow) => (
              <div
                key={flow.batchId}
                className="p-3.5 bg-slate-50 border border-slate-300 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-mono"
              >
                {/* 1. Supplier Node */}
                <div className="flex items-center gap-2 md:w-1/4">
                  <div className="p-2 bg-blue-100 text-blue-900 rounded-md">
                    <Package className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Supplier</div>
                    <div className="font-bold text-slate-900 font-sans">{flow.supplier}</div>
                    <div className="text-[10px] text-blue-800 font-bold">Inward: {flow.received} Qtl</div>
                  </div>
                </div>

                <ArrowRight className="hidden md:block h-4 w-4 text-slate-400 shrink-0" />

                {/* 2. Depot Batch Node */}
                <div className="flex items-center gap-2 md:w-1/4 bg-white p-2.5 rounded border border-slate-200">
                  <div className="p-2 bg-amber-100 text-amber-900 rounded-md">
                    <Warehouse className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Depot Batch</div>
                    <div className="font-bold text-[#0B2A5B] font-mono text-sm">#{flow.batchId}</div>
                    <div className="text-[10px] text-slate-600">Balance: <strong>{flow.remaining} Qtl</strong></div>
                  </div>
                </div>

                <ArrowRight className="hidden md:block h-4 w-4 text-slate-400 shrink-0" />

                {/* 3. Dispatched FPS Outward Nodes */}
                <div className="md:w-5/12 space-y-1.5">
                  <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">
                    Fair Price Shop Destinations ({flow.dispatches.length})
                  </div>
                  {flow.dispatches.length === 0 ? (
                    <div className="text-[11px] text-slate-400 italic">
                      In godown storage (no outward dispatches yet)
                    </div>
                  ) : (
                    flow.dispatches.map((d, i) => (
                      <div
                        key={i}
                        className="bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded flex items-center justify-between text-[11px]"
                      >
                        <span className="font-sans font-semibold text-emerald-950">
                          {d.fpsName} ({d.fpsId})
                        </span>
                        <strong className="text-emerald-800 font-mono">
                          {d.qty} Qtl
                        </strong>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
