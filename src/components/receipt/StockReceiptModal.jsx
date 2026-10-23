import React, { useState, useCallback } from 'react';
import { useStore } from '../../context/store';
import { ACTION_TYPES } from '../../context/actions';
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
  X, 
  PlusCircle, 
  PackagePlus, 
  CheckCircle, 
  ShieldCheck,
  Building2,
  FileSpreadsheet
} from 'lucide-react';

export const StockReceiptModal = React.memo(function StockReceiptModal({ isOpen, onClose }) {
  const { state, dispatch, refreshServerState } = useStore();
  const [commodity, setCommodity] = useState('Wheat');
  const [supplier, setSupplier] = useState(SUPPLIERS[0]);
  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [batchId, setBatchId] = useState('');
  const [bay, setBay] = useState('A1');
  const [quantity, setQuantity] = useState('50');
  const [qualityStatus, setQualityStatus] = useState(QUALITY_STATUS.ELIGIBLE);
  const [isSubmitting, setIsSubmitting] = useState(false);

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


    // Check duplicate batchId
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
      };

      const genesisHash = await createBatchGenesisHash(batchData);
      const batchWithHash = {
        ...batchData,
        sha256Hash: genesisHash,
      };

      // Previous event hash from top audit log
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
        details: `Received ${qtyNum} Qtl from ${supplier} into Bay ${bay}. Status: ${qualityStatus}`,
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
          console.warn('Backend API batch create failed, falling back to local action:', apiErr);
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

      setIsSubmitting(false);
      onClose();
    } catch (err) {
      console.error('Failed to submit stock receipt:', err);
      setIsSubmitting(false);
      alert('Error creating receipt: ' + err.message);
    }
  }, [quantity, batchId, state.batches, state.auditLogs, state.networkMode, state.backendConnected, commodity, bay, receiptDate, supplier, qualityStatus, refreshServerState, dispatch, onClose]);

  if (!isOpen) return null;

  return (

    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
      <div className="bg-white border-2 border-[#1e3a8a] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-[#1e3a8a] text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 text-white rounded-lg">
              <PackagePlus className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase text-blue-200">
                FORM-A (e-PDS INWARD CONSIGNMENT REGISTRATION)
              </div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Inward Stock Receipt & Bay Allocation</span>
                <span className="font-hind text-xs font-normal text-blue-100">
                  (स्टॉक प्राप्ति पंजीकरण)
                </span>
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-blue-200 hover:text-white p-1 rounded-lg hover:bg-blue-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3.5">
            {/* Commodity */}
            <div>
              <label className="block text-slate-800 font-bold mb-1">
                Commodity (खाद्यान्न) <span className="text-red-600">*</span>
              </label>
              <select
                id="receipt-commodity-select"
                value={commodity}
                onChange={(e) => setCommodity(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-700 font-medium"
              >
                {COMMODITIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Supplier */}
            <div>
              <label className="block text-slate-800 font-bold mb-1">
                Supplier Agency (आपूर्तिकर्ता) <span className="text-red-600">*</span>
              </label>
              <select
                id="receipt-supplier-select"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-700 font-medium"
              >
                {SUPPLIERS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Receipt Date */}
            <div>
              <label className="block text-slate-800 font-bold mb-1">
                Inward Receipt Date (प्राप्ति दिनांक) <span className="text-red-600">*</span>
              </label>
              <input
                id="receipt-date-input"
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-blue-700 font-medium"
              />
            </div>

            {/* Batch ID */}
            <div>
              <label className="block text-slate-800 font-bold mb-1">
                Unique Batch ID (बैच कोड) <span className="text-red-600">*</span>
              </label>
              <input
                id="receipt-batch-input"
                type="text"
                placeholder="e.g., WH-118"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-blue-700 font-bold uppercase placeholder:normal-case"
              />
            </div>

            {/* Bay Allocation */}
            <div>
              <label className="block text-slate-800 font-bold mb-1">
                Designated Bay (गोदाम बे) <span className="text-red-600">*</span>
              </label>
              <select
                id="receipt-bay-select"
                value={bay}
                onChange={(e) => setBay(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-blue-700 font-bold"
              >
                {BAYS.map(b => (
                  <option key={b} value={b}>Bay {b}</option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-slate-800 font-bold mb-1 flex items-center justify-between">
                <span>Quantity (Quintals) <span className="text-red-600">*</span></span>
                <span className="text-[10px] text-slate-500 font-mono">मात्रा</span>
              </label>
              <input
                id="receipt-qty-input"
                type="number"
                min="1"
                step="0.5"
                placeholder="50"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 font-mono text-xs font-bold focus:outline-none focus:border-blue-700"
              />
            </div>
          </div>

          {/* Quality Status */}
          <div>
            <label className="block text-slate-800 font-bold mb-1">
              Initial Quality Status (गुणवत्ता परीक्षण स्थिति) <span className="text-red-600">*</span>
            </label>
            <select
              id="receipt-quality-select"
              value={qualityStatus}
              onChange={(e) => setQualityStatus(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-700 font-medium"
            >
              <option value={QUALITY_STATUS.ELIGIBLE}>
                Eligible for FIFO Dispatch (मानक अनुरूप / योग्य)
              </option>
              <option value={QUALITY_STATUS.HOLD_HIGH_MOISTURE}>
                Hold - High Moisture (आर्द्रता अधिक - प्रयोगशाला जांच लंबित)
              </option>
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              Batches with moisture &gt;14.5% will be placed on hold and bypassed by the automated FIFO allocator until cleared.
            </p>
          </div>

          {/* Security Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded p-2.5 flex items-start gap-2 text-slate-700">
            <ShieldCheck className="h-4 w-4 text-blue-700 mt-0.5 flex-shrink-0" />
            <div className="text-[11px] leading-relaxed">
              Upon submission, a cryptographic <strong>SHA-256 Genesis Hash</strong> will be chained into the godown ledger for immutable government audit compliance.
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              id="receipt-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-md bg-[#15803d] hover:bg-[#166534] text-white font-bold transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <PlusCircle className="h-4 w-4" />
              <span>{isSubmitting ? 'Registering...' : 'Register Consignment & Generate Hash'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

