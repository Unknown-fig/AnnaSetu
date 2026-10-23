import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/store';
import { FAIR_PRICE_SHOPS } from '../../types/models';
import { useI18n } from '../../i18n/I18nContext';
import { Store, Truck, Calendar, Hash, FileSpreadsheet, Download } from 'lucide-react';

export const FpsView = React.memo(function FpsView() {
  const { state } = useStore();
  const { isHindi } = useI18n();
  const { auditLogs } = state;

  const [selectedFpsId, setSelectedFpsId] = useState('FPS-GN-101'); // Default Kasna

  const currentFps = FAIR_PRICE_SHOPS.find(f => f.id === selectedFpsId) || FAIR_PRICE_SHOPS[0];

  // Find all dispatches to this FPS
  const fpsDispatches = useMemo(() => {
    return auditLogs.filter(
      l => l.type === 'DISPATCH_COMPLETED' && (l.fpsId === selectedFpsId || l.fpsName?.includes(currentFps.name))
    );
  }, [auditLogs, selectedFpsId, currentFps]);

  // Aggregate totals per commodity
  const commodityTotals = useMemo(() => {
    const totals = {};
    fpsDispatches.forEach((d) => {
      const comm = d.commodity || 'Unknown';
      totals[comm] = (totals[comm] || 0) + (d.quantity || 0);
    });
    return totals;
  }, [fpsDispatches]);

  const totalAllCommodities = Object.values(commodityTotals).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      {/* FPS Selector Card */}
      <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label htmlFor="fps-view-select" className="font-bold text-xs text-slate-700">
            {isHindi ? 'उचित दर दुकान (FPS) चुनें:' : 'Select Fair Price Shop:'}
          </label>
          <select
            id="fps-view-select"
            value={selectedFpsId}
            onChange={(e) => setSelectedFpsId(e.target.value)}
            className="py-1.5 px-3 border border-slate-300 rounded-md font-mono text-xs font-bold bg-white text-slate-900"
          >
            {FAIR_PRICE_SHOPS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.id} • {f.name} ({f.licenseNo})
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs font-mono text-slate-600">
          Dealer: <strong className="text-slate-900">{currentFps.dealerName || 'Authorized PDS Dealer'}</strong>
        </div>
      </div>

      {/* Per-Commodity Totals KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl font-mono">
          <div className="text-[10px] font-bold text-blue-800 uppercase">
            Total Dispatches
          </div>
          <div className="text-xl font-black text-blue-900 mt-1">
            {fpsDispatches.length} Orders
          </div>
          <div className="text-[10px] text-blue-700 mt-0.5">
            {totalAllCommodities} Qtl total stock
          </div>
        </div>

        {Object.entries(commodityTotals).map(([comm, qty]) => (
          <div key={comm} className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono">
            <div className="text-[10px] font-bold text-slate-600 uppercase">
              {comm}
            </div>
            <div className="text-xl font-black text-slate-900 mt-1">
              {qty} Qtl
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Verified deliveries
            </div>
          </div>
        ))}
      </div>

      {/* Dispatches Table for Selected FPS */}
      <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800 font-mono">
            Dispatches to {currentFps.name} ({fpsDispatches.length} records)
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            Location: {currentFps.address || 'Gautam Buddha Nagar'}
          </span>
        </div>

        {fpsDispatches.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-mono text-xs">
            No deliveries registered for this Fair Price Shop yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 border-b border-slate-300 text-[11px] uppercase">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Challan No.</th>
                  <th className="py-2.5 px-3">Commodity</th>
                  <th className="py-2.5 px-3">Allocated Batches</th>
                  <th className="py-2.5 px-3 text-right">Quantity (Qtl)</th>
                  <th className="py-2.5 px-3">Token Prefix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {fpsDispatches.map((d) => (
                  <tr key={d.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-2.5 px-3 text-slate-600">
                      {new Date(d.timestamp).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {d.challanNo}
                    </td>
                    <td className="py-2.5 px-3 text-blue-900 font-semibold font-sans">
                      {d.commodity}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-bold border">
                        #{d.batchId} (Bay {d.bay})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900 text-sm">
                      {d.quantity} Qtl
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-bold">
                      {d.token ? d.token.substring(0, 16) : 'OFFL-TOK'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
});
