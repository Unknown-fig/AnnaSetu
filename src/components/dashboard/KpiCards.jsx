import React, { useMemo } from 'react';
import { useStore } from '../../context/store';
import { useI18n } from '../../i18n/I18nContext';
import { calculateAgeDays, round2, CRITICAL_AGE_DAYS } from '../../types/models';
import { 
  Boxes, 
  CheckCircle2, 
  AlertTriangle, 
  Truck, 
  TrendingUp, 
  ShieldCheck
} from 'lucide-react';

export const KpiCards = React.memo(function KpiCards() {
  const { state } = useStore();
  const { batches, stats } = state;
  const { t } = useI18n();

  const { totalInventoryQtl, complianceRate, criticalBatchesCount, totalDispatches } = useMemo(() => {
    // 1. Total Inventory Qtl
    const invQtl = round2(batches.reduce((sum, b) => sum + (b.remainingQtl || 0), 0));

    // 2. FIFO Compliance %
    const totalAuditEvents = stats.compliantDispatches + stats.blockedViolations + stats.approvedExceptions;
    const rate = totalAuditEvents > 0
      ? Math.round((stats.compliantDispatches / totalAuditEvents) * 100)
      : 100;

    // 3. Critical Batches (60+ days)
    const critCount = batches.filter(b => {
      const age = calculateAgeDays(b.receiptDate);
      return age >= CRITICAL_AGE_DAYS && b.remainingQtl > 0;
    }).length;

    // 4. Total Dispatches
    const dispatches = stats.totalDispatches;

    return {
      totalInventoryQtl: invQtl,
      complianceRate: rate,
      criticalBatchesCount: critCount,
      totalDispatches: dispatches
    };
  }, [batches, stats]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* KPI 1: Total Inventory */}
      <div className="bg-white border border-slate-300 rounded-lg p-4 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between text-slate-700">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#0B2A5B] block">
              {t('kpi.totalStockTitle')}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              {t('kpi.totalStockSub')}
            </span>
          </div>
          <div className="p-2 rounded bg-blue-50 text-blue-800 border border-blue-200">
            <Boxes className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl font-extrabold font-mono text-slate-900">
            {totalInventoryQtl.toLocaleString()} <span className="text-xs font-sans font-medium text-slate-600">{t('common.qtl')}</span>
          </div>
          <div className="text-[11px] text-[#138808] font-semibold flex items-center gap-1 mt-1">
            <TrendingUp className="h-3 w-3" />
            <span>16 Storage Bays (A1-D4)</span>
          </div>
        </div>
      </div>

      {/* KPI 2: FIFO Compliance */}
      <div className="bg-white border border-slate-300 rounded-lg p-4 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between text-slate-700">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#0B2A5B] block">
              {t('kpi.complianceTitle')}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              {t('kpi.complianceSub')}
            </span>
          </div>
          <div className="p-2 rounded bg-emerald-50 text-[#138808] border border-emerald-200">
            <ShieldCheck className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl font-extrabold font-mono text-[#138808]">
            {complianceRate}%
          </div>
          <div className="text-[11px] text-slate-600 font-medium flex items-center gap-1 mt-1">
            <CheckCircle2 className="h-3 w-3 text-[#138808]" />
            <span>{stats.compliantDispatches} compliant • {stats.blockedViolations} blocked</span>
          </div>
        </div>
      </div>

      {/* KPI 3: Critical Batches (60+ days) */}
      <div className="bg-white border border-slate-300 rounded-lg p-4 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between text-slate-700">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#0B2A5B] block">
              {t('kpi.criticalTitle')}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              {t('kpi.criticalSub')}
            </span>
          </div>
          <div className="p-2 rounded bg-red-50 text-[#b91c1c] border border-red-200">
            <AlertTriangle className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl font-extrabold font-mono text-[#b91c1c]">
            {criticalBatchesCount} <span className="text-xs font-sans font-medium text-slate-600">Batches</span>
          </div>
          <div className="text-[11px] text-[#b91c1c] font-semibold flex items-center gap-1 mt-1">
            <span>{t('common.dispatchFirst')}</span>
          </div>
        </div>
      </div>

      {/* KPI 4: Total Dispatches */}
      <div className="bg-white border border-slate-300 rounded-lg p-4 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between text-slate-700">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#0B2A5B] block">
              {t('kpi.dispatchesTitle')}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              {t('kpi.dispatchesSub')}
            </span>
          </div>
          <div className="p-2 rounded bg-amber-50 text-[#b45309] border border-amber-200">
            <Truck className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl font-extrabold font-mono text-slate-900">
            {totalDispatches} <span className="text-xs font-sans font-medium text-slate-600">Challans</span>
          </div>
          <div className="text-[11px] text-slate-600 font-medium flex items-center gap-1 mt-1">
            <span>Servicing 6 Gautam Buddha Nagar FPS</span>
          </div>
        </div>
      </div>
    </div>
  );
});
