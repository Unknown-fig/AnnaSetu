import React, { useState, useMemo, useCallback } from 'react';
import { useStore } from '../../context/store';
import { COMMODITIES, FAIR_PRICE_SHOPS } from '../../types/models';
import { useI18n } from '../../i18n/I18nContext';
import { 
  Search, 
  Download, 
  Printer, 
  Copy, 
  Check, 
  Package, 
  Truck, 
  KeyRound, 
  QrCode, 
  Mic, 
  AlertOctagon, 
  FileCheck2, 
  RefreshCw, 
  ShieldAlert,
  Hash,
  Filter
} from 'lucide-react';

const EVENT_TYPES = [
  'ALL',
  'STOCK_RECEIPT',
  'CHALLAN_STAGED',
  'OFFLINE_TOKEN_ISSUED',
  'SCAN_VERIFIED',
  'SCAN_REJECTED',
  'DISPATCH_COMPLETED',
  'VOICE_COMMAND_PARSED',
  'SYNC_COMPLETED',
  'SYNC_CONFLICT',
  'VIOLATION_BLOCKED',
  'EXCEPTION_OVERRIDE',
];

export const LedgerTable = React.memo(function LedgerTable() {
  const { state } = useStore();
  const { isHindi, tCommodity } = useI18n();
  const { auditLogs } = state;

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterCommodity, setFilterCommodity] = useState('ALL');
  const [filterSyncStatus, setFilterSyncStatus] = useState('ALL');
  const [copiedId, setCopiedId] = useState(null);

  const handleCopy = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Filter logs with debounced free-text and field selectors
  const filteredLogs = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return auditLogs.filter((log) => {
      // Free-text match (batch, FPS, challan no, supplier, hash, token)
      if (term) {
        const fullContent = `${log.batchId || ''} ${log.commodity || ''} ${log.details || ''} ${log.actor || ''} ${log.challanNo || ''} ${log.fpsName || ''} ${log.fpsId || ''} ${log.hash || ''} ${log.token || ''} ${log.id || ''}`.toLowerCase();
        if (!fullContent.includes(term)) return false;
      }

      // Event Type filter
      if (filterType !== 'ALL' && log.type !== filterType) {
        return false;
      }

      // Commodity filter
      if (filterCommodity !== 'ALL' && log.commodity !== filterCommodity) {
        return false;
      }

      // Sync status filter
      if (filterSyncStatus !== 'ALL') {
        const logStatus = log.syncStatus || 'SYNCED';
        if (logStatus !== filterSyncStatus) return false;
      }

      return true;
    });
  }, [auditLogs, searchTerm, filterType, filterCommodity, filterSyncStatus]);

  // Export filtered logs to CSV
  const handleExportCsv = () => {
    if (filteredLogs.length === 0) return;

    const headers = ['EventID', 'Timestamp', 'Type', 'Title', 'Commodity', 'BatchID', 'Quantity_Qtl', 'FPS', 'ChallanNo', 'SyncStatus', 'Hash', 'Token'];
    const rows = filteredLogs.map((l) => [
      l.id,
      l.timestamp,
      l.type,
      `"${l.title?.replace(/"/g, '""') || ''}"`,
      l.commodity || '',
      l.batchId || '',
      l.quantity || '',
      `"${l.fpsName || l.fpsId || ''}"`,
      l.challanNo || '',
      l.syncStatus || 'SYNCED',
      l.hash || '',
      l.token || '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AnnaSetu_Ledger_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getEventBadge = (type) => {
    switch (type) {
      case 'STOCK_RECEIPT':
        return { label: 'Stock Receipt', color: 'bg-emerald-50 text-emerald-800 border-emerald-300', icon: Package };
      case 'CHALLAN_STAGED':
        return { label: 'Challan Staged', color: 'bg-blue-50 text-blue-800 border-blue-300', icon: FileCheck2 };
      case 'OFFLINE_TOKEN_ISSUED':
        return { label: 'Offline Token', color: 'bg-purple-50 text-purple-800 border-purple-300', icon: KeyRound };
      case 'SCAN_VERIFIED':
        return { label: 'Scan Verified', color: 'bg-emerald-50 text-emerald-800 border-emerald-300', icon: QrCode };
      case 'SCAN_REJECTED':
        return { label: 'Scan Rejected', color: 'bg-red-50 text-red-800 border-red-300', icon: AlertOctagon };
      case 'DISPATCH_COMPLETED':
        return { label: 'FPS Dispatch', color: 'bg-blue-50 text-[#0B2A5B] border-blue-300', icon: Truck };
      case 'VOICE_COMMAND_PARSED':
        return { label: 'Voice Command', color: 'bg-sky-50 text-sky-800 border-sky-300', icon: Mic };
      case 'SYNC_COMPLETED':
        return { label: 'Server Synced', color: 'bg-emerald-100 text-emerald-900 border-emerald-400', icon: RefreshCw };
      case 'SYNC_CONFLICT':
        return { label: 'Sync Conflict', color: 'bg-red-100 text-red-900 border-red-400', icon: ShieldAlert };
      case 'VIOLATION_BLOCKED':
        return { label: 'FIFO Violation', color: 'bg-red-50 text-red-700 border-red-300', icon: AlertOctagon };
      case 'EXCEPTION_OVERRIDE':
        return { label: 'Exception Approved', color: 'bg-amber-50 text-amber-800 border-amber-300', icon: FileCheck2 };
      default:
        return { label: type, color: 'bg-slate-100 text-slate-700 border-slate-300', icon: Hash };
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-xs space-y-3 no-print">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              id="input-ledger-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Batch, FPS, Challan #, Commodity, Token, or Hash..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:border-blue-600 focus:outline-hidden bg-white text-slate-900"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-export-ledger-csv"
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isHindi ? 'CSV निर्यात' : 'Export CSV'}</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-md text-xs font-bold flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{isHindi ? 'प्रिंट' : 'Print'}</span>
            </button>
          </div>
        </div>

        {/* Dropdown Filters Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200 text-xs">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-500 font-semibold">{isHindi ? 'घटना प्रकार' : 'Event'}:</span>
            <select
              id="filter-ledger-type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="py-1 px-2 border border-slate-300 rounded font-mono text-[11px] bg-white text-slate-800"
            >
              {EVENT_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold">{isHindi ? 'वस्तु' : 'Commodity'}:</span>
            <select
              id="filter-ledger-commodity"
              value={filterCommodity}
              onChange={(e) => setFilterCommodity(e.target.value)}
              className="py-1 px-2 border border-slate-300 rounded font-mono text-[11px] bg-white text-slate-800"
            >
              <option value="ALL">ALL COMMODITIES</option>
              {COMMODITIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold">{isHindi ? 'सिंक स्थिति' : 'Sync Status'}:</span>
            <select
              id="filter-ledger-sync"
              value={filterSyncStatus}
              onChange={(e) => setFilterSyncStatus(e.target.value)}
              className="py-1 px-2 border border-slate-300 rounded font-mono text-[11px] bg-white text-slate-800"
            >
              <option value="ALL">ALL STATUSES</option>
              <option value="SYNCED">SYNCED</option>
              <option value="PENDING_SYNC">PENDING_SYNC</option>
              <option value="CONFLICT">CONFLICT</option>
            </select>
          </div>

          <div className="ml-auto text-[11px] font-mono text-slate-500">
            Showing <strong>{filteredLogs.length}</strong> of <strong>{auditLogs.length}</strong> events
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-mono text-xs">
            No events match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 text-[11px] uppercase">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Event Type</th>
                  <th className="py-2.5 px-3">Details / Narrative</th>
                  <th className="py-2.5 px-3">Batch / Commodity</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Hash & Token</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredLogs.map((log) => {
                  const badge = getEventBadge(log.type);
                  const Icon = badge.icon;
                  const isConflict = log.syncStatus === 'CONFLICT';
                  const isPending = log.syncStatus === 'PENDING_SYNC';

                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isConflict ? 'bg-red-50/50' : isPending ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        <div>{new Date(log.timestamp).toLocaleDateString()}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${badge.color}`}>
                          <Icon className="h-3 w-3" />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      <td className="py-2.5 px-3 font-sans max-w-md">
                        <div className="font-semibold text-slate-900 text-xs">
                          {log.title}
                        </div>
                        <div className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">
                          {log.details}
                        </div>
                        {log.actor && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Actor: {log.actor}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {log.batchId ? (
                          <div>
                            <span className="font-bold text-[#0B2A5B]">#{log.batchId}</span>
                            {log.bay && <span className="ml-1 text-slate-500">(Bay {log.bay})</span>}
                            <div className="text-[11px] text-slate-600 font-sans">
                              {log.commodity} {log.quantity ? `• ${log.quantity} Qtl` : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">N/A</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isConflict
                            ? 'bg-red-100 text-red-800 border border-red-300'
                            : isPending
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                        }`}>
                          {log.syncStatus || 'SYNCED'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap text-[10px]">
                        {/* SHA-256 Hash */}
                        <div className="flex items-center gap-1 font-mono text-slate-700">
                          <span className="text-slate-400">H:</span>
                          <strong>{(log.hash || '').substring(0, 10)}...</strong>
                          <button
                            type="button"
                            onClick={() => handleCopy(log.hash, `h-${log.id}`)}
                            className="text-slate-400 hover:text-slate-800"
                            title="Copy full hash"
                          >
                            {copiedId === `h-${log.id}` ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>

                        {/* Offline Token if present */}
                        {log.token && (
                          <div className="flex items-center gap-1 font-mono text-blue-900 mt-0.5">
                            <span className="text-slate-400">T:</span>
                            <strong className="text-blue-900">{log.token.substring(0, 10)}...</strong>
                            <button
                              type="button"
                              onClick={() => handleCopy(log.token, `t-${log.id}`)}
                              className="text-slate-400 hover:text-slate-800"
                              title="Copy full token"
                            >
                              {copiedId === `t-${log.id}` ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
});
