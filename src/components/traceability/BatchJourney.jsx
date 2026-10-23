import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/store';
import { useI18n } from '../../i18n/I18nContext';
import { round2 } from '../../types/models';
import { 
  Package, 
  Warehouse, 
  Split, 
  Truck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowRight,
  ShieldCheck,
  Scale
} from 'lucide-react';

export const BatchJourney = React.memo(function BatchJourney() {
  const { state } = useStore();
  const { isHindi, t } = useI18n();
  const { batches, auditLogs, activeChallan } = state;

  const [selectedBatchId, setSelectedBatchId] = useState(batches[1]?.batchId || 'RC-101');

  const currentBatch = batches.find(b => b.batchId === selectedBatchId) || batches[0];

  // Dispatches from auditLogs for this batch
  const batchDispatches = useMemo(() => {
    if (!currentBatch) return [];
    return auditLogs.filter(
      l => l.type === 'DISPATCH_COMPLETED' && l.batchId === currentBatch.batchId
    );
  }, [auditLogs, currentBatch]);

  // Current reserved quantity if active challan is staged
  const reservedQty = useMemo(() => {
    if (!activeChallan || activeChallan.status !== 'STAGED') return 0;
    const alloc = (activeChallan.allocations || []).find(a => a.batchId === currentBatch?.batchId);
    return alloc ? round2(alloc.take) : 0;
  }, [activeChallan, currentBatch]);

  const totalDispatched = batchDispatches.reduce((sum, d) => sum + (d.quantity || 0), 0);
  const receivedQty = currentBatch?.qtyReceivedQtl || 0;
  const remainingQty = currentBatch?.remainingQtl || 0;

  // Reconciliation Check: received === dispatched + reserved + remaining
  const reconciledSum = round2(totalDispatched + reservedQty + remainingQty);
  const isReconciled = Math.abs(reconciledSum - receivedQty) < 0.05;

  return (
    <div className="space-y-4">
      {/* Batch Selector Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label htmlFor="batch-journey-select" className="font-bold text-xs text-slate-700">
            {isHindi ? 'बैच यात्रा चुनें:' : 'Select Batch Journey:'}
          </label>
          <select
            id="batch-journey-select"
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            className="py-1.5 px-3 border border-slate-300 rounded-md font-mono text-xs font-bold bg-white text-slate-900"
          >
            {batches.map((b) => (
              <option key={b.batchId} value={b.batchId}>
                #{b.batchId} • {b.commodity} ({b.remainingQtl}/{b.qtyReceivedQtl} Qtl) • Bay {b.bay}
              </option>
            ))}
          </select>
        </div>

        {/* Reconciliation Status Pill */}
        <div
          id="batch-reconciliation-status"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold ${
            isReconciled
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-red-50 text-red-900 border-red-300'
          }`}
        >
          {isReconciled ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>✓ RECONCILED: {receivedQty} Qtl = {totalDispatched} Dispatched + {reservedQty} Reserved + {remainingQty} Remaining</span>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-red-600" />
              <span>MISMATCH: Received ({receivedQty} Qtl) ≠ Accounted ({reconciledSum} Qtl)</span>
            </>
          )}
        </div>
      </div>

      {/* Stepper Timeline Visualizer */}
      <div className="bg-white border border-slate-300 rounded-xl p-6 shadow-xs space-y-6">
        <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-black text-[#0B2A5B]">
              BATCH #{currentBatch.batchId}
            </span>
            <span className="text-xs px-2 py-0.5 rounded font-bold bg-blue-100 text-[#0B2A5B]">
              {currentBatch.commodity}
            </span>
            <span className="text-xs font-mono text-slate-500">
              Receipt Date: {currentBatch.receiptDate}
            </span>
          </div>

          <div className="text-xs font-mono text-slate-600">
            Cryptographic Genesis: <strong className="text-slate-900">{(currentBatch.sha256Hash || '').substring(0, 14)}...</strong>
          </div>
        </div>

        {/* 5-Step Stepper Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Step 1: Supplier & Receipt */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-xs font-mono">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Package className="h-4 w-4 text-blue-700" />
              <span>1. Supplier Inward</span>
            </div>
            <div className="text-sm font-black text-[#0B2A5B] font-sans">
              {currentBatch.supplier}
            </div>
            <div className="text-[11px] text-slate-600">
              Qty: <strong className="text-slate-900">{currentBatch.qtyReceivedQtl} Qtl</strong>
            </div>
            <div className="text-[10px] text-slate-400">
              Date: {currentBatch.receiptDate}
            </div>
          </div>

          {/* Step 2: Bay Storage */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-xs font-mono">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Warehouse className="h-4 w-4 text-amber-700" />
              <span>2. Godown Storage</span>
            </div>
            <div className="text-sm font-black text-slate-900">
              Bay {currentBatch.bay}
            </div>
            <div className="text-[11px] text-slate-600">
              Stack Position: <strong>Tier #{currentBatch.stackPosition || 0}</strong>
            </div>
            <div className="text-[10px] text-slate-500 font-sans">
              Status: <strong className="text-emerald-700">{currentBatch.qualityStatus}</strong>
            </div>
          </div>

          {/* Step 3: Waterfall Allocations */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-xs font-mono">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Split className="h-4 w-4 text-purple-700" />
              <span>3. Allocations</span>
            </div>
            <div className="text-sm font-black text-purple-900">
              {batchDispatches.length + (reservedQty > 0 ? 1 : 0)} Total
            </div>
            <div className="text-[11px] text-slate-600">
              Dispatched: <strong>{totalDispatched} Qtl</strong>
            </div>
            <div className="text-[10px] text-slate-500">
              Reserved: <strong>{reservedQty} Qtl</strong>
            </div>
          </div>

          {/* Step 4: Dispatches to FPS */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-1.5 text-xs font-mono">
            <div className="flex items-center gap-1.5 font-bold text-blue-900">
              <Truck className="h-4 w-4 text-blue-700" />
              <span>4. FPS Dispatches</span>
            </div>
            <div className="text-sm font-black text-blue-900">
              {batchDispatches.length} Outward
            </div>
            <div className="text-[11px] text-slate-600">
              Total: <strong>{totalDispatched} Qtl</strong>
            </div>
            <div className="text-[10px] text-blue-700">
              Verified at Gate
            </div>
          </div>

          {/* Step 5: Remaining Balance */}
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg space-y-1.5 text-xs font-mono">
            <div className="flex items-center gap-1.5 font-bold text-emerald-950">
              <Scale className="h-4 w-4 text-emerald-700" />
              <span>5. Depot Balance</span>
            </div>
            <div className="text-lg font-black text-emerald-900">
              {currentBatch.remainingQtl} Qtl
            </div>
            <div className="text-[11px] text-emerald-800">
              Available for FIFO
            </div>
            <div className="text-[10px] text-emerald-700">
              Audit Reconciled ✓
            </div>
          </div>
        </div>

        {/* Detailed Dispatch Breakdown for this Batch */}
        <div className="space-y-2 pt-2 border-t border-slate-200">
          <h4 className="text-xs font-bold text-slate-700 uppercase font-mono">
            Chronological Dispatch Log for Batch #{currentBatch.batchId}
          </h4>

          {batchDispatches.length === 0 ? (
            <div className="p-4 bg-slate-50 rounded-lg text-slate-400 font-mono text-xs text-center">
              No historical dispatches recorded for this batch yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden text-xs font-mono">
              {batchDispatches.map((d) => (
                <div key={d.id} className="p-3 bg-white flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-blue-700" />
                    <div>
                      <strong className="text-slate-900 font-sans">{d.fpsName}</strong>
                      <span className="ml-2 text-slate-500">({d.fpsId})</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-slate-600">
                    <span>Challan: <strong className="text-slate-900">{d.challanNo}</strong></span>
                    <span>Date: {new Date(d.timestamp).toLocaleDateString()}</span>
                    <span className="font-bold text-blue-900 text-sm">{d.quantity} Qtl</span>
                    {d.token && (
                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded border">
                        Token: {d.token.substring(0, 16)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
