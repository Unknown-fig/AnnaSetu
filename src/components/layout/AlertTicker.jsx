import React, { useMemo } from 'react';
import { useStore } from '../../context/store';
import { useI18n } from '../../i18n/I18nContext';
import { calculateAgeDays, CRITICAL_AGE_DAYS, QUALITY_STATUS } from '../../types/models';
import { 
  AlertTriangle, 
  AlertOctagon, 
  Lock, 
  ShieldCheck, 
  FileCheck2, 
  TrendingDown,
  Megaphone
} from 'lucide-react';

export const AlertTicker = React.memo(function AlertTicker({ onSelectTab }) {
  const { state } = useStore();
  const { batches, stats, exceptions } = state;
  const { t, tCommodity } = useI18n();

  const alerts = useMemo(() => {
    const list = [];

    // 1. Batches >= 60 days with stock
    const criticalBatches = batches.filter(
      b => b.remainingQtl > 0 && calculateAgeDays(b.receiptDate) >= CRITICAL_AGE_DAYS
    );
    if (criticalBatches.length > 0) {
      const idsStr = criticalBatches.map(b => `#${b.batchId} (${calculateAgeDays(b.receiptDate)}d)`).join(', ');
      list.push({
        id: 'critical-ageing',
        icon: AlertTriangle,
        targetTab: 'dashboard',
        severity: 'critical', // red
        badgeBg: 'bg-red-600 text-white',
        text: t('ticker.criticalBatches', { batches: idsStr }),
      });
    }

    // 2. Batches on Hold - High Moisture
    const holdBatches = batches.filter(
      b => b.qualityStatus === QUALITY_STATUS.HOLD_HIGH_MOISTURE && b.remainingQtl > 0
    );
    if (holdBatches.length > 0) {
      const idsStr = holdBatches.map(b => `#${b.batchId} (${tCommodity(b.commodity)})`).join(', ');
      list.push({
        id: 'hold-moisture',
        icon: Lock,
        targetTab: 'locator',
        severity: 'hold', // purple
        badgeBg: 'bg-purple-700 text-white',
        text: t('ticker.holdBatches', { batches: idsStr }),
      });
    }

    // 3. FIFO violations blocked today
    if (stats.blockedViolations > 0) {
      list.push({
        id: 'violations-blocked',
        icon: AlertOctagon,
        targetTab: 'exceptions',
        severity: 'violation', // rose
        badgeBg: 'bg-rose-600 text-white',
        text: t('ticker.violationsBlocked', { count: stats.blockedViolations }),
      });
    }

    // 4. Approved exceptions today
    const exceptionsCount = Math.max(stats.approvedExceptions, exceptions.length);
    if (exceptionsCount > 0) {
      list.push({
        id: 'exceptions-approved',
        icon: FileCheck2,
        targetTab: 'exceptions',
        severity: 'exception', // blue
        badgeBg: 'bg-blue-700 text-white',
        text: t('ticker.exceptionsApproved', { count: exceptionsCount }),
      });
    }

    // 5. Shortfall warnings (if any commodity has <= 0 stock)
    const commStock = {};
    batches.forEach(b => {
      commStock[b.commodity] = (commStock[b.commodity] || 0) + (b.remainingQtl || 0);
    });
    const depleted = Object.entries(commStock).filter(([, qty]) => qty <= 0);
    if (depleted.length > 0) {
      const depletedNames = depleted.map(([c]) => tCommodity(c)).join(', ');
      list.push({
        id: 'shortfall-warning',
        icon: TrendingDown,
        targetTab: 'receipt',
        severity: 'warning', // amber
        badgeBg: 'bg-amber-600 text-white',
        text: t('ticker.shortfallWarning', { commodities: depletedNames }),
      });
    }

    // 6. If nothing flagged
    if (list.length === 0) {
      list.push({
        id: 'all-compliant',
        icon: ShieldCheck,
        targetTab: 'dashboard',
        severity: 'compliant', // green
        badgeBg: 'bg-emerald-600 text-white',
        text: t('ticker.allCompliant'),
      });
    }

    return list;
  }, [batches, stats, exceptions, t, tCommodity]);

  return (
    <div
      id="gov-alert-ticker"
      className="bg-amber-50 border-b border-amber-200 text-slate-800 px-3 py-1 flex items-center justify-between text-xs select-none shadow-xs overflow-hidden"
    >
      <div className="max-w-[1920px] mx-auto w-full flex items-center gap-2">
        {/* Ticker Lead Tag */}
        <div className="flex-shrink-0 flex items-center gap-1.5 bg-[#0B2A5B] text-white text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded shadow-xs">
          <Megaphone className="h-3 w-3 text-amber-400" />
          <span>{t('ticker.complianceAlerts')}</span>
        </div>

        {/* CSS Continuous Scrolling Marquee Track */}
        <div className="ticker-marquee-wrapper flex-1 overflow-hidden">
          <div className="ticker-marquee-track flex items-center gap-6 cursor-pointer">
            {/* Duplicated list to create a seamless infinite loop */}
            {[...alerts, ...alerts].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={`${item.id}-${idx}`}
                  onClick={() => onSelectTab(item.targetTab)}
                  className="inline-flex items-center gap-2 px-2 py-0.5 rounded hover:bg-amber-100/80 transition-colors whitespace-nowrap"
                  title="Click to view details in relevant module"
                >
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold flex items-center gap-1 ${item.badgeBg}`}>
                    <Icon className="h-2.5 w-2.5" />
                    <span className="uppercase text-[9px]">{item.severity}</span>
                  </span>
                  <span className="text-[12px] font-medium text-slate-800 hover:text-[#0B2A5B] hover:underline">
                    {item.text}
                  </span>
                  <span className="text-amber-300 font-bold">•</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});
