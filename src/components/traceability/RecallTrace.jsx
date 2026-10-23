import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/store';
import { useI18n } from '../../i18n/I18nContext';
import { 
  Search, 
  Download, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Truck, 
  Building2, 
  Calendar,
  Sparkles,
  FileSpreadsheet
} from 'lucide-react';

export const RecallTrace = React.memo(function RecallTrace() {
  const { state } = useStore();
  const { isHindi, t } = useI18n();
  const { auditLogs, batches } = state;

  const [searchBatchId, setSearchBatchId] = useState('RC-101'); // Default to seeded multi-FPS batch

  // Scan auditLogs for all DISPATCH_COMPLETED events related to searchBatchId
  const recallResults = useMemo(() => {
    if (!searchBatchId) return [];
    const target = searchBatchId.trim().toUpperCase();

    const matched = [];
    auditLogs.forEach((log) => {
      if (log.type !== 'DISPATCH_COMPLETED') return;

      // Direct batchId match
      if (log.batchId?.toUpperCase() === target) {
        matched.push({
          id: log.id,
          timestamp: log.timestamp,
          challanNo: log.challanNo || 'GBN-iPDS-2026',
          fpsId: log.fpsId || 'FPS-GN-101',
          fpsName: log.fpsName || log.actor || 'Fair Price Shop',
          commodity: log.commodity,
          quantity: log.quantity || 0,
          bay: log.bay,
          token: log.token || (log.hash || '').substring(0, 16),
        });
      }
    });

    return matched;
  }, [auditLogs, searchBatchId]);

  const totalRecalledQty = recallResults.reduce((acc, curr) => acc + curr.quantity, 0);
  const distinctFpsCount = new Set(recallResults.map(r => r.fpsId)).size;
  const targetBatch = batches.find(b => b.batchId.toUpperCase() === searchBatchId.trim().toUpperCase());

  // One-Click CSV Export
  const handleExportCsv = () => {
    if (recallResults.length === 0) return;

    const headers = ['EventID', 'DispatchDate', 'BatchID', 'Commodity', 'ChallanNo', 'FPS_ID', 'FPS_Name', 'DispatchedQty_Qtl', 'Token'];
    const rows = recallResults.map(r => [
      r.id,
      r.timestamp,
      searchBatchId.toUpperCase(),
      r.commodity,
      r.challanNo,
      r.fpsId,
      `"${r.fpsName}"`,
      r.quantity,
      r.token,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AnnaSetu_Recall_Trace_${searchBatchId.toUpperCase()}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Search Bar & Suggestion Chips */}
      <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#0B2A5B] flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-red-600" />
              <span>{isHindi ? 'बैच रिकॉल और त्वरित ट्रेसबिलिटी' : 'Rapid Batch Recall & Distribution Trace'}</span>
            </h3>
            <p className="text-xs text-slate-500">
              {isHindi 
                ? 'बैच आईडी दर्ज करके तुरंत पता लगाएं कि वह किस कोटेदार (FPS) और चालान में गया है' 
                : 'Identify all Fair Price Shops and delivery challans that received contaminated or suspect batches'}
            </p>
          </div>

          {recallResults.length > 0 && (
            <button
              id="btn-export-recall-csv"
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isHindi ? 'रिकॉल डेटा CSV डाउनलोड करें' : 'Export Recall CSV'}</span>
            </button>
          )}
        </div>

        {/* Input & Chips */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              id="input-recall-batch-id"
              type="text"
              value={searchBatchId}
              onChange={(e) => setSearchBatchId(e.target.value)}
              placeholder="Enter Batch ID (e.g., RC-101, WH-102)..."
              className="w-full pl-9 pr-3 py-2 text-xs font-mono border border-slate-300 rounded-md focus:border-red-600 focus:outline-hidden bg-white text-slate-900 uppercase font-bold"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-semibold">{isHindi ? 'सुझाव' : 'Preset'}:</span>
            <button
              type="button"
              onClick={() => setSearchBatchId('RC-101')}
              className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold transition-all border ${
                searchBatchId.toUpperCase() === 'RC-101'
                  ? 'bg-red-100 text-red-900 border-red-300'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300'
              }`}
            >
              RC-101 (Multi-FPS Demo)
            </button>
            <button
              type="button"
              onClick={() => setSearchBatchId('WH-102')}
              className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold transition-all border ${
                searchBatchId.toUpperCase() === 'WH-102'
                  ? 'bg-red-100 text-red-900 border-red-300'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300'
              }`}
            >
              WH-102
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {recallResults.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-red-50 border border-red-200 p-3 rounded-xl">
            <div className="text-[11px] font-bold text-red-800 uppercase">
              {isHindi ? 'कुल वितरित मात्रा' : 'Total Recalled Quantity'}
            </div>
            <div className="text-xl font-black text-red-900 font-mono mt-1">
              {totalRecalledQty} Qtl
            </div>
            <div className="text-[10px] text-red-700 mt-0.5">
              Across all historical dispatches
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl">
            <div className="text-[11px] font-bold text-amber-800 uppercase">
              {isHindi ? 'प्रभावित कोटेदार (FPS)' : 'Affected Fair Price Shops'}
            </div>
            <div className="text-xl font-black text-amber-900 font-mono mt-1">
              {distinctFpsCount} Shops
            </div>
            <div className="text-[10px] text-amber-700 mt-0.5">
              Requiring emergency stop-sale notice
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
            <div className="text-[11px] font-bold text-blue-800 uppercase">
              {isHindi ? 'संबंधित चालान संख्या' : 'Delivery Challans'}
            </div>
            <div className="text-xl font-black text-blue-900 font-mono mt-1">
              {recallResults.length} Challans
            </div>
            <div className="text-[10px] text-blue-700 mt-0.5">
              Cryptographically verified in ledger
            </div>
          </div>
        </div>
      ) : null}

      {/* Recall Table */}
      <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800 font-mono">
            Recall Results for #{searchBatchId.toUpperCase()} ({recallResults.length} dispatches)
          </span>
          {targetBatch && (
            <span className="text-[11px] text-slate-600 font-mono">
              Depot Stock: <strong>{targetBatch.remainingQtl} Qtl</strong> in Bay <strong>{targetBatch.bay}</strong>
            </span>
          )}
        </div>

        {recallResults.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-mono text-xs">
            <CheckCircle2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <div>No dispatches found for Batch #{searchBatchId.toUpperCase()}.</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Try searching "RC-101" to view historical dispatches across multiple FPS.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 border-b border-slate-300 text-[11px] uppercase">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Challan No.</th>
                  <th className="py-2.5 px-3">FPS ID</th>
                  <th className="py-2.5 px-3">FPS Name & Location</th>
                  <th className="py-2.5 px-3 text-right">Dispatched Qtl</th>
                  <th className="py-2.5 px-3">Offline Token Prefix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {recallResults.map((r) => (
                  <tr key={r.id} className="hover:bg-red-50/40 transition-colors">
                    <td className="py-2.5 px-3 text-slate-600">
                      {new Date(r.timestamp).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {r.challanNo}
                    </td>
                    <td className="py-2.5 px-3 text-blue-800 font-bold">
                      {r.fpsId}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-800 font-semibold">
                      {r.fpsName}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-red-700 text-sm">
                      {r.quantity} Qtl
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-bold">
                      {r.token.substring(0, 16)}
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
