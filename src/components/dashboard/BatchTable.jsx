import React, { useState, useMemo, useCallback } from 'react';
import { useStore } from '../../context/store';
import { useI18n } from '../../i18n/I18nContext';
import { 
  COMMODITIES, 
  QUALITY_STATUS, 
  calculateAgeDays, 
  getAgeCategory,
  CRITICAL_AGE_DAYS 
} from '../../types/models';
import { 
  Search, 
  CheckCircle, 
  Copy, 
  Check, 
  AlertCircle,
  AlertTriangle,
  Database,
  Lock
} from 'lucide-react';

const BatchRow = React.memo(function BatchRow({ batch, idx, copiedHash, onCopyHash }) {
  const { t, tCommodity } = useI18n();
  const ageDays = calculateAgeDays(batch.receiptDate);
  const isHold = batch.qualityStatus === QUALITY_STATUS.HOLD_HIGH_MOISTURE;
  const isCritical = !isHold && ageDays >= CRITICAL_AGE_DAYS && batch.remainingQtl > 0;
  const isModerate = !isHold && ageDays >= 21 && ageDays < CRITICAL_AGE_DAYS;
  const pct = Math.round((batch.remainingQtl / batch.qtyReceivedQtl) * 100);

  return (
    <tr
      key={batch.batchId}
      className={`transition-colors ${
        isCritical
          ? 'row-highlight-critical'
          : idx % 2 === 0
          ? 'bg-white hover:bg-slate-50'
          : 'bg-slate-50/60 hover:bg-slate-100/60'
      }`}
    >
      {/* Batch ID & Copyable Hash */}
      <td className="py-2.5 px-3 border-r border-slate-200">
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-bold text-slate-900 text-xs">
            #{batch.batchId}
          </span>
          <button
            onClick={() => onCopyHash(batch.sha256Hash, batch.batchId)}
            title="Copy SHA-256 Genesis Hash"
            className="p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-slate-100 transition-colors"
          >
            {copiedHash === batch.batchId ? (
              <Check className="h-3 w-3 text-emerald-600" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </div>
        <div className="text-[10px] font-mono text-slate-400 truncate max-w-[130px]">
          {batch.sha256Hash?.slice(0, 16)}...
        </div>
      </td>

      {/* Commodity */}
      <td className="py-2.5 px-3 border-r border-slate-200 font-semibold text-slate-900">
        {tCommodity(batch.commodity)}
      </td>

      {/* Bay */}
      <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono font-bold text-amber-800">
        <span className="bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
          {t('common.bay')} {batch.bay}
        </span>
      </td>

      {/* Supplier */}
      <td className="py-2.5 px-3 border-r border-slate-200 text-slate-700 text-xs">
        {batch.supplier}
      </td>

      {/* Receipt Date */}
      <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono text-slate-700">
        {batch.receiptDate}
      </td>

      {/* Stock Age Badge titled "Batch Age / बैच की आयु" */}
      <td className="py-2.5 px-3 border-r border-slate-200 text-center">
        <span
          title="Batch Age / बैच की आयु"
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
            isHold
              ? 'bg-purple-100 text-purple-900 border-purple-300'
              : isCritical
              ? 'bg-red-600 text-white border-red-700 animate-pulse-critical shadow-xs'
              : isModerate
              ? 'bg-amber-50 text-[#b45309] border-amber-300'
              : 'bg-emerald-50 text-[#15803d] border-emerald-300'
          }`}
        >
          {isCritical && <AlertTriangle className="h-3 w-3" />}
          {isHold && <Lock className="h-3 w-3" />}
          <span>{ageDays} {t('common.daysOld')}</span>
        </span>
      </td>

      {/* Stock Balance */}
      <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono">
        <div className="font-bold text-slate-900">
          {batch.remainingQtl} <span className="text-[10px] text-slate-500 font-sans">{t('common.qtl')}</span>
        </div>
        <div className="text-[10px] text-slate-500">
          {pct}% of {batch.qtyReceivedQtl} {t('common.qtl')}
        </div>
      </td>

      {/* Quality Status */}
      <td className="py-2.5 px-3 text-right">
        {isHold ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-purple-50 text-purple-800 border border-purple-200">
            <AlertCircle className="h-3 w-3" />
            <span>{t('common.holdMoisture')}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-50 text-[#15803d] border border-emerald-200">
            <CheckCircle className="h-3 w-3" />
            <span>{t('common.eligible')}</span>
          </span>
        )}
      </td>
    </tr>
  );
});

export const BatchTable = React.memo(function BatchTable() {
  const { state } = useStore();
  const { batches } = state;
  const { t, tCommodity } = useI18n();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCommodity, setSelectedCommodity] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState('ALL');
  const [copiedHash, setCopiedHash] = useState(null);

  const handleCopyHash = useCallback((hash, batchId) => {
    navigator.clipboard?.writeText(hash);
    setCopiedHash(batchId);
    setTimeout(() => setCopiedHash(null), 2000);
  }, []);

  const handleSearchChange = useCallback((e) => setSearchTerm(e.target.value), []);
  const handleCommodityChange = useCallback((e) => setSelectedCommodity(e.target.value), []);
  const handleStatusChange = useCallback((e) => setSelectedStatus(e.target.value), []);
  const handleAgeChange = useCallback((e) => setSelectedAgeGroup(e.target.value), []);

  const filteredBatches = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return batches.filter(batch => {
      const matchesSearch = !term ||
        batch.batchId.toLowerCase().includes(term) ||
        batch.bay.toLowerCase().includes(term) ||
        batch.supplier.toLowerCase().includes(term) ||
        batch.commodity.toLowerCase().includes(term);

      const matchesCommodity = selectedCommodity === 'ALL' || batch.commodity === selectedCommodity;
      const matchesStatus = selectedStatus === 'ALL' || batch.qualityStatus === selectedStatus;

      const ageDays = calculateAgeDays(batch.receiptDate);
      const ageCat = getAgeCategory(ageDays).category;
      const matchesAge = selectedAgeGroup === 'ALL' || ageCat === selectedAgeGroup;

      return matchesSearch && matchesCommodity && matchesStatus && matchesAge;
    });
  }, [batches, searchTerm, selectedCommodity, selectedStatus, selectedAgeGroup]);

  return (
    <div className="bg-white border border-slate-300 rounded-lg p-4 sm:p-5 shadow-sm flex flex-col space-y-4">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#0B2A5B] flex items-center gap-2">
              <Database className="h-4 w-4 text-[#0B2A5B]" />
              <span>Surajpur Godown Live Stock Batches</span>
            </h2>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-900 font-mono font-bold border border-blue-200">
              {filteredBatches.length} / {batches.length} Batches
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Auto-calculated batch ageing relative to current date • Strict FIFO priority sorting
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="batch-search-input"
              placeholder={`${t('common.search')} Batch / Bay...`}
              value={searchTerm}
              onChange={handleSearchChange}
              className="bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded pl-8 pr-3 py-1.5 focus:outline-none focus:border-blue-600 focus:bg-white w-48 font-mono placeholder:font-sans placeholder:text-slate-400"
            />
          </div>

          {/* Commodity Dropdown */}
          <select
            id="batch-commodity-filter"
            value={selectedCommodity}
            onChange={handleCommodityChange}
            className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-600 focus:bg-white font-medium"
          >
            <option value="ALL">{t('common.all')} ({t('challan.selectCommodity')})</option>
            {COMMODITIES.map(c => (
              <option key={c} value={c}>{tCommodity(c)}</option>
            ))}
          </select>

          {/* Quality Status Dropdown */}
          <select
            id="batch-status-filter"
            value={selectedStatus}
            onChange={handleStatusChange}
            className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-600 focus:bg-white font-medium"
          >
            <option value="ALL">{t('common.all')} ({t('common.status')})</option>
            <option value={QUALITY_STATUS.ELIGIBLE}>{t('common.eligible')}</option>
            <option value={QUALITY_STATUS.HOLD_HIGH_MOISTURE}>{t('common.holdMoisture')}</option>
          </select>

          {/* Age Group Dropdown */}
          <select
            id="batch-age-filter"
            value={selectedAgeGroup}
            onChange={handleAgeChange}
            className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-600 focus:bg-white font-medium"
          >
            <option value="ALL">{t('common.all')} ({t('common.batchAge')})</option>
            <option value="critical">{t('common.critical')} (60+ {t('common.days')})</option>
            <option value="moderate">{t('common.moderate')} (21-59 {t('common.days')})</option>
            <option value="fresh">{t('common.fresh')} (0-20 {t('common.days')})</option>
          </select>
        </div>
      </div>

      {/* Table Container with Bilingual Headers */}
      <div className="overflow-x-auto border border-slate-300 rounded-md">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-300 text-[11px] font-bold text-slate-700 uppercase tracking-wider bg-slate-100">
              <th className="py-2.5 px-3 border-r border-slate-200">
                <div>Batch ID / SHA-256</div>
                <div className="text-[10px] text-slate-500 font-normal">बैच सं. / हैश</div>
              </th>
              <th className="py-2.5 px-3 border-r border-slate-200">
                <div>Commodity</div>
                <div className="text-[10px] text-slate-500 font-normal">खाद्यान्न जिंस</div>
              </th>
              <th className="py-2.5 px-3 border-r border-slate-200 text-center">
                <div>Bay Location</div>
                <div className="text-[10px] text-slate-500 font-normal">गोदाम बे</div>
              </th>
              <th className="py-2.5 px-3 border-r border-slate-200">
                <div>{t('common.supplier')}</div>
                <div className="text-[10px] text-slate-500 font-normal">आपूर्तिकर्ता</div>
              </th>
              <th className="py-2.5 px-3 border-r border-slate-200 text-center">
                <div>{t('common.receiptDate')}</div>
                <div className="text-[10px] text-slate-500 font-normal">आवक दिनांक</div>
              </th>
              <th className="py-2.5 px-3 border-r border-slate-200 text-center">
                <div>Batch Age</div>
                <div className="text-[10px] text-slate-500 font-normal font-bold text-amber-900">बैच की आयु</div>
              </th>
              <th className="py-2.5 px-3 border-r border-slate-200 text-right">
                <div>{t('common.stockBalance')} ({t('common.qtl')})</div>
                <div className="text-[10px] text-slate-500 font-normal">शेष मात्रा - क्विंटल</div>
              </th>
              <th className="py-2.5 px-3 text-right">
                <div>{t('common.status')}</div>
                <div className="text-[10px] text-slate-500 font-normal">गुणवत्ता स्थिति</div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-sans">
            {filteredBatches.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-slate-500 font-mono text-xs">
                  No batches match the selected criteria.
                </td>
              </tr>
            ) : (
              filteredBatches.map((batch, idx) => (
                <BatchRow
                  key={batch.batchId}
                  batch={batch}
                  idx={idx}
                  copiedHash={copiedHash}
                  onCopyHash={handleCopyHash}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});
