import React, { useState, useCallback } from 'react';
import { useStore } from '../../context/store';
import { ACTION_TYPES } from '../../context/actions';
import { useI18n } from '../../i18n/I18nContext';
import { apiClient } from '../../services/apiClient';
import { 
  COMMODITIES, 
  SUPPLIERS, 
  BAYS, 
  QUALITY_STATUS 
} from '../../types/models';
import { 
  createBatchGenesisHash, 
  createChainedEventHash 
} from '../../services/cryptoService';
import { 
  PackagePlus, 
  CheckCircle, 
  ShieldCheck, 
  Building2, 
  History, 
  PlusCircle,
  FileSpreadsheet
} from 'lucide-react';

export const StockReceiptView = React.memo(function StockReceiptView() {
  const { state, dispatch, refreshServerState } = useStore();
  const { t, tCommodity } = useI18n();

  const [commodity, setCommodity] = useState('Wheat');
  const [supplier, setSupplier] = useState(SUPPLIERS[0]);
  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [batchId, setBatchId] = useState('');
  const [bay, setBay] = useState('A1');
  const [quantity, setQuantity] = useState('50');
  const [qualityStatus, setQualityStatus] = useState(QUALITY_STATUS.ELIGIBLE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const qtyNum = parseFloat(quantity);
    if (!batchId.trim()) {
      alert('Please enter a valid Batch ID (e.g., WH-118).');
      return;
    }
    if (isNaN(qtyNum) || qtyNum <= 0) {
      alert('Please enter a positive quantity in Quintals.');
      return;
    }

    if (state.batches.some(b => b.batchId.toLowerCase() === batchId.trim().toLowerCase())) {
      alert(`Batch ID ${batchId.trim()} already exists in godown inventory!`);
      return;
    }

    setIsSubmitting(true);

    try {
      const trimmedBatchId = batchId.trim().toUpperCase();
      const batchData = {
        batchId: trimmedBatchId,
        commodity,
        supplier,
        receiptDate,
        bay,
        qtyReceivedQtl: qtyNum,
        remainingQtl: qtyNum,
        qualityStatus,
        stackPosition: 0,
      };

      const genesisHash = await createBatchGenesisHash(batchData);
      const batchWithHash = {
        ...batchData,
        sha256Hash: genesisHash,
      };

      const prevHash = state.auditLogs[0]?.hash || '0000000000000000000000000000000000000000000000000000000000000000';
      const timestamp = new Date().toISOString();
      const eventHash = await createChainedEventHash(
        prevHash,
        timestamp,
        'STOCK_RECEIPT',
        {
          batchId: trimmedBatchId,
          commodity,
          bay,
          quantity: qtyNum,
          supplier,
          qualityStatus,
        }
      );

      const auditLog = {
        id: `EVT-RCP-${Date.now()}`,
        timestamp,
        type: 'STOCK_RECEIPT',
        title: `Inward Stock Receipt: ${commodity} (${trimmedBatchId})`,
        actor: 'Godown Inward Inspector',
        details: `Received ${qtyNum} Qtl from ${supplier} into Bay ${bay}. Quality: ${qualityStatus}`,
        batchId: trimmedBatchId,
        commodity,
        bay,
        quantity: qtyNum,
        prevHash,
        hash: eventHash,
      };

      if (state.networkMode === 'ONLINE' || state.backendConnected) {
        try {
          await apiClient.createBatch({
            batch_code: trimmedBatchId,
            commodity,
            supplier,
            receipt_date: receiptDate,
            stack_bay: bay,
            initial_qty: qtyNum,
            status: qualityStatus === QUALITY_STATUS.HOLD ? 'QUALITY_HOLD' : 'ELIGIBLE',
            moisture_pct: qualityStatus === QUALITY_STATUS.HOLD ? 15.5 : 11.5,
          });
          if (refreshServerState) await refreshServerState();
        } catch (apiErr) {
          console.warn('Backend API batch create failed, falling back to local store dispatch:', apiErr);
          dispatch({
            type: ACTION_TYPES.RECEIVE_STOCK,
            payload: {
              batch: batchWithHash,
              auditLog,
            },
          });
        }
      } else {
        dispatch({
          type: ACTION_TYPES.RECEIVE_STOCK,
          payload: {
            batch: batchWithHash,
            auditLog,
          },
        });
      }

      setSuccessMsg(`Successfully registered Batch #${trimmedBatchId} (${qtyNum} Qtl ${tCommodity(commodity)}) into Bay ${bay}!`);
      setBatchId('');
      setIsSubmitting(false);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      console.error('Failed to submit stock receipt:', err);
      setIsSubmitting(false);
      alert('Error creating receipt: ' + err.message);
    }
  }, [batchId, quantity, commodity, supplier, receiptDate, bay, qualityStatus, state.batches, state.auditLogs, state.networkMode, state.backendConnected, refreshServerState, dispatch, tCommodity]);

  // Filter receipt event logs from store
  const receiptLogs = state.auditLogs.filter(l => l.type === 'STOCK_RECEIPT').slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Page Card: Inward Registration Form */}
      <div className="bg-white border border-slate-300 rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
          <div className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-[#0B2A5B]" />
            <div>
              <h2 className="text-base font-bold text-[#0B2A5B]">
                {t('receipt.modalTitle')}
              </h2>
              <p className="text-xs text-slate-500">
                {t('receipt.subtitle')}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-900 border border-blue-200 text-xs font-mono font-bold self-start sm:self-center">
            PDS Gate Inward Register
          </span>
        </div>

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-900 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle className="h-4 w-4 text-emerald-700 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Inward Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Commodity */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('receipt.commodityLabel')} *
              </label>
              <select
                id="receipt-commodity-select"
                value={commodity}
                onChange={(e) => setCommodity(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
              >
                {COMMODITIES.map(c => (
                  <option key={c} value={c}>{tCommodity(c)}</option>
                ))}
              </select>
            </div>

            {/* Batch ID */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Batch ID (e.g. WH-118, RC-120) *
              </label>
              <input
                id="receipt-batch-id-input"
                type="text"
                placeholder="Enter unique Batch ID"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white uppercase placeholder:normal-case placeholder:font-sans"
              />
            </div>

            {/* Target Bay */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('receipt.bayLabel')} *
              </label>
              <select
                id="receipt-bay-select"
                value={bay}
                onChange={(e) => setBay(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
              >
                {BAYS.map(b => (
                  <option key={b} value={b}>Bay {b}</option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('receipt.qtyLabel')} *
              </label>
              <input
                id="receipt-quantity-input"
                type="number"
                min="1"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            {/* Supplier */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('receipt.supplierLabel')} *
              </label>
              <select
                id="receipt-supplier-select"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
              >
                {SUPPLIERS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Quality Status */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('receipt.qualityLabel')} *
              </label>
              <select
                id="receipt-quality-select"
                value={qualityStatus}
                onChange={(e) => setQualityStatus(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
              >
                <option value={QUALITY_STATUS.ELIGIBLE}>{t('common.eligible')}</option>
                <option value={QUALITY_STATUS.HOLD_HIGH_MOISTURE}>{t('common.holdMoisture')}</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-200">
            <button
              id="btn-submit-receipt"
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-lg bg-[#138808] hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
            >
              <PlusCircle className="h-4 w-4" />
              <span>{t('receipt.submitBtn')}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Recent Receipts Inward Register Table */}
      <div className="bg-white border border-slate-300 rounded-lg p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
          <History className="h-4 w-4 text-[#0B2A5B]" />
          <h3 className="text-sm font-bold text-[#0B2A5B]">
            Recent Inward Receipts (Surajpur Depot Gate Log)
          </h3>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-md">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-[11px] uppercase font-bold border-b border-slate-300">
                <th className="py-2.5 px-3">Batch ID</th>
                <th className="py-2.5 px-3">Commodity</th>
                <th className="py-2.5 px-3">Storage Bay</th>
                <th className="py-2.5 px-3 text-right">Received Qtl</th>
                <th className="py-2.5 px-3">Quality Status</th>
                <th className="py-2.5 px-3 font-mono">SHA-256 Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans">
              {receiptLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400 font-mono">
                    No inward receipts recorded yet.
                  </td>
                </tr>
              ) : (
                receiptLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      #{log.batchId}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {tCommodity(log.commodity)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-amber-800 font-bold">
                      Bay {log.bay}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {log.quantity} Qtl
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-[#138808] border border-emerald-200">
                        {t('common.eligible')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">
                      {log.hash?.slice(0, 18)}...
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});
