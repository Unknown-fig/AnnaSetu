import React, { useState, useEffect } from 'react';
import { Download, Search, Table, RefreshCw, AlertCircle, FileSpreadsheet, ShieldAlert } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { useI18n } from '../../i18n/I18nContext';
import { getCommodityDisplayName } from './StockView';

export function TraceMatrix() {
  const { isHindi } = useI18n();

  const [selectedCommodity, setSelectedCommodity] = useState('');
  const [matrixData, setMatrixData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Recall Trace State
  const [recallBatchId, setRecallBatchId] = useState('RC-101');
  const [recallResult, setRecallResult] = useState(null);
  const [isRecallLoading, setIsRecallLoading] = useState(false);

  const fetchMatrix = async (comm) => {
    setIsLoading(true);
    try {
      const data = await apiClient.getBatchFpsMatrix(comm || null);
      setMatrixData(data);
    } catch (err) {
      console.error('Failed to fetch batch FPS matrix:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix(selectedCommodity);
  }, [selectedCommodity]);

  const handleDownloadCsv = () => {
    if (!matrixData) return;
    const fpsCols = matrixData.fps_columns || [];
    let csv = `Batch Code,Commodity,Supplier,Receipt Date,Age (Days),${fpsCols.map(f => f.code).join(',')},Total (Qtl)\n`;

    matrixData.matrix.forEach(row => {
      const fpsVals = fpsCols.map(f => row.fps[f.code] || 0);
      csv += `"${row.batch_code}","${row.commodity}","${row.supplier}","${row.receipt_date}",${row.age_days},${fpsVals.join(',')},${row.total}\n`;
    });

    // Column totals row
    const colTotVals = fpsCols.map(f => matrixData.column_totals[f.code] || 0);
    csv += `"TOTALS","","","",,${colTotVals.join(',')},${matrixData.grand_total}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `AnnaSetu_Batch_FPS_Matrix_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleTraceRecall = async (e) => {
    if (e) e.preventDefault();
    if (!recallBatchId.trim()) return;

    setIsRecallLoading(true);
    try {
      const res = await apiClient.traceBatchRecall(recallBatchId.trim());
      setRecallResult(res);
    } catch (err) {
      alert(err.message || 'Recall trace failed');
    } finally {
      setIsRecallLoading(false);
    }
  };

  const handleExportRecallCsv = () => {
    if (!recallResult) return;
    window.open(`/api/trace/recall/${encodeURIComponent(recallResult.batch_code)}/csv`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* 1. Batch x FPS Matrix Card */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Table className="h-4 w-4 text-[#0B2A5B]" />
              <span>{isHindi ? 'बैच-से-दुकान आपूर्ति मैट्रिक्स (Batch × FPS Traceability Matrix)' : 'Batch-to-FPS Distribution Matrix'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isHindi 
                ? 'गोदाम के सभी बैचों से प्रत्येक उचित दर दुकान को आपूर्ति की गई मात्रा का वास्तविक मिलान'
                : 'Cross-tabulation of godown batches and supplied quantities across all 6 Fair Price Shops'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Commodity Filter */}
            <select
              value={selectedCommodity}
              onChange={(e) => setSelectedCommodity(e.target.value)}
              className="bg-slate-50 border border-slate-300 font-bold text-xs rounded-md px-3 py-1.5 outline-none focus:ring-2 focus:ring-[#0B2A5B]"
            >
              <option value="">{isHindi ? 'सभी जिंस (All Commodities)' : 'All Commodities'}</option>
              <option value="Wheat">Wheat (गेहूं)</option>
              <option value="Rice">Rice (चावल)</option>
              <option value="Sugar">Sugar (चीनी)</option>
              <option value="Salt">Salt (नमक)</option>
              <option value="Edible Oil">Edible Oil (खाद्य तेल)</option>
              <option value="Chana">Chana (चना)</option>
              <option value="Tuvar Dal">Tuvar Dal (तुवर दाल)</option>
            </select>

            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={!matrixData}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded border border-slate-300 transition-colors shadow-2xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isHindi ? 'CSV डाउनलोड' : 'Export Matrix CSV'}</span>
            </button>
          </div>
        </div>

        {/* Matrix Table */}
        {isLoading || !matrixData ? (
          <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-[#0B2A5B]" />
            <span>Loading matrix data...</span>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-md">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-[11px]">
                  <th className="py-2.5 px-3 border-r border-slate-200">Batch Code</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Commodity</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">Age (d)</th>
                  {matrixData.fps_columns.map(f => (
                    <th key={f.code} className="py-2.5 px-3 border-r border-slate-200 text-right font-mono" title={f.name}>
                      {f.code}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 text-right bg-slate-200/60 font-bold">Total (Qtl)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                {matrixData.matrix.map((row) => (
                  <tr key={row.batch_code} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 border-r border-slate-200 font-bold text-slate-900">
                      #{row.batch_code}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-sans font-medium text-slate-800">
                      {getCommodityDisplayName(row.commodity, isHindi)}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        row.is_critical ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {row.age_days}d
                      </span>
                    </td>
                    {matrixData.fps_columns.map(f => {
                      const val = row.fps[f.code] || 0;
                      return (
                        <td
                          key={f.code}
                          className={`py-2 px-3 border-r border-slate-200 text-right ${
                            val > 0 ? 'font-bold text-slate-900 bg-amber-50/30' : 'text-slate-300'
                          }`}
                        >
                          {val > 0 ? `${val.toFixed(1)}` : '—'}
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-right font-black text-[#0B2A5B] bg-slate-100/50">
                      {row.total.toFixed(1)}
                    </td>
                  </tr>
                ))}
                {/* Column Totals Row */}
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td colSpan={3} className="py-2.5 px-3 text-right font-sans uppercase">
                    {isHindi ? 'कुल आपूर्ति (Column Totals):' : 'Total Dispatched:'}
                  </td>
                  {matrixData.fps_columns.map(f => (
                    <td key={f.code} className="py-2.5 px-3 border-r border-slate-200 text-right font-mono text-[#0B2A5B]">
                      {(matrixData.column_totals[f.code] || 0).toFixed(1)}
                    </td>
                  ))}
                  <td className="py-2.5 px-3 text-right font-mono text-sm text-[#0B2A5B] font-black bg-slate-200">
                    {matrixData.grand_total.toFixed(1)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2. Rapid Batch Recall Trace Section */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-600" />
              <span>{isHindi ? 'त्वरित बैच वापसी ट्रेस (Rapid Batch Food Safety Recall)' : 'Rapid Batch Recall Traceability'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isHindi 
                ? 'गुणवत्ता विफलता की स्थिति में किसी भी बैच से आपूर्ति की गई सभी दुकानों की त्वरित पहचान'
                : 'Identify all Fair Price Shops holding stock from a compromised or recalled consignment'}
            </p>
          </div>
        </div>

        {/* Search input */}
        <form onSubmit={handleTraceRecall} className="flex gap-2 max-w-md">
          <input
            type="text"
            placeholder="Enter Batch ID (e.g. RC-101, WH-102)"
            value={recallBatchId}
            onChange={(e) => setRecallBatchId(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-rose-500"
          />
          <button
            type="submit"
            disabled={isRecallLoading || !recallBatchId.trim()}
            className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs rounded transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Search className="h-3.5 w-3.5" />
            <span>{isHindi ? 'ट्रेस करें' : 'Trace Recall'}</span>
          </button>
        </form>

        {/* Recall Result */}
        {recallResult && (
          <div className="space-y-3 pt-2 animate-in fade-in">
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-md text-xs flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-bold text-rose-950">
                  Batch #{recallResult.batch_code} ({recallResult.commodity}):
                </span>
                <span className="ml-2 text-rose-800">
                  Distributed across <strong>{recallResult.affected_fps_count} Fair Price Shops</strong> ({recallResult.total_recalled_qty} Qtl total)
                </span>
              </div>
              <button
                type="button"
                onClick={handleExportRecallCsv}
                className="flex items-center gap-1 px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs rounded shadow-xs transition-colors"
              >
                <Download className="h-3 w-3" />
                <span>Export Recall CSV</span>
              </button>
            </div>

            {/* Affected Stores List */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {recallResult.fps_summary?.map((fps) => (
                <div key={fps.fps_code} className="bg-slate-50 border border-slate-200 rounded p-3 text-xs">
                  <div className="font-bold text-slate-900 font-mono">{fps.fps_code}</div>
                  <div className="text-slate-700 font-medium">{fps.fps_name}</div>
                  <div className="font-mono font-bold text-rose-700 mt-1">
                    Supplied: {fps.total_qty} Qtl ({fps.challan_count} challans)
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
