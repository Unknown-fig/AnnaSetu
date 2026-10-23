import React, { useState, useMemo, useCallback } from 'react';
import { useStore } from '../../context/store';
import { useI18n } from '../../i18n/I18nContext';
import { BAYS, CRITICAL_AGE_DAYS, calculateAgeDays, QUALITY_STATUS } from '../../types/models';
import { BayCard } from './BayCard';
import { BayDrawer } from './BayDrawer';
import { 
  Warehouse, 
  DoorOpen, 
  Sparkles, 
  Layers, 
  AlertTriangle, 
  Lock, 
  Info 
} from 'lucide-react';

export const BayGrid = React.memo(function BayGrid({ compact = false }) {
  const { state } = useStore();
  const { batches, activeChallan } = state;
  const { t } = useI18n();

  const [selectedBay, setSelectedBay] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleSelectBay = useCallback((bayId) => {
    setSelectedBay(bayId);
    setIsDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  // Group all batches by bay
  const batchesByBay = useMemo(() => {
    const map = {};
    BAYS.forEach(b => { map[b] = []; });
    batches.forEach(batch => {
      if (map[batch.bay]) {
        map[batch.bay].push(batch);
      }
    });
    return map;
  }, [batches]);

  // Active Challan Allocations Mapping:
  // Map bayId -> pickOrder (1, 2, 3) and determine which bay is next pick
  const { pickOrderMap, nextPickBay } = useMemo(() => {
    const orderMap = new Map();
    let nextBay = null;

    if (activeChallan && Array.isArray(activeChallan.allocations)) {
      activeChallan.allocations.forEach((alloc, idx) => {
        // Record 1-based order
        if (!orderMap.has(alloc.bay)) {
          orderMap.set(alloc.bay, idx + 1);
        }
      });

      // The next pick target is the current step allocation
      const currentAlloc = activeChallan.allocations[activeChallan.currentStepIndex || 0];
      if (currentAlloc) {
        nextBay = currentAlloc.bay;
      }
    }

    return { pickOrderMap: orderMap, nextPickBay: nextBay };
  }, [activeChallan]);

  // Count metrics for legend
  const legendCounts = useMemo(() => {
    let fresh = 0;
    let moderate = 0;
    let critical = 0;
    let hold = 0;
    let empty = 0;

    BAYS.forEach(bayId => {
      const bayBatches = batchesByBay[bayId]?.filter(b => (b.remainingQtl || 0) > 0) || [];
      if (bayBatches.length === 0) {
        empty++;
      } else if (bayBatches.some(b => b.qualityStatus === QUALITY_STATUS.HOLD_HIGH_MOISTURE)) {
        hold++;
      } else {
        const oldestAge = Math.max(...bayBatches.map(b => calculateAgeDays(b.receiptDate)));
        if (oldestAge >= CRITICAL_AGE_DAYS) critical++;
        else if (oldestAge >= 21) moderate++;
        else fresh++;
      }
    });

    return { fresh, moderate, critical, hold, empty };
  }, [batchesByBay]);

  return (
    <div className="bg-white border border-slate-300 rounded-lg p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header & Legend */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-3 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-[#0B2A5B]" />
            <h2 className="text-base font-bold text-[#0B2A5B]">
              {t('locator.title')}
            </h2>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-blue-50 text-blue-900 border border-blue-200">
              16 Bays (A1 to D4)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('locator.subtitle')}
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 border border-emerald-300 text-emerald-800 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
            <span>{t('common.fresh')} (0-20d): {legendCounts.fresh}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-50 border border-amber-300 text-amber-900 font-medium">
            <span className="h-2 w-2 rounded-full bg-amber-600"></span>
            <span>{t('common.moderate')} (21-59d): {legendCounts.moderate}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-50 border border-red-300 text-red-900 font-bold">
            <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse"></span>
            <span>{t('common.critical')} (60+d): {legendCounts.critical}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-purple-50 border border-purple-300 text-purple-900 font-medium">
            <span className="h-2 w-2 rounded-full bg-purple-600"></span>
            <span>{t('common.holdShort')}: {legendCounts.hold}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-50 border border-slate-300 text-slate-600 font-medium">
            <span className="h-2 w-2 rounded-full bg-slate-400"></span>
            <span>{t('common.empty')}: {legendCounts.empty}</span>
          </div>

          {activeChallan && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-100 border border-amber-400 text-amber-950 font-bold shadow-xs">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
              <span>{t('common.nextPick')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main 4x4 Grid Container */}
      <div className="bg-slate-100/70 p-4 sm:p-5 rounded-xl border border-slate-300 space-y-4">
        {/* Aisle Labels & 4x4 Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {BAYS.map((bayId) => (
            <BayCard
              key={bayId}
              bayId={bayId}
              batches={batchesByBay[bayId] || []}
              isSelected={selectedBay === bayId}
              onSelectBay={handleSelectBay}
              pickOrder={pickOrderMap.has(bayId) ? pickOrderMap.get(bayId) : null}
              isNextPick={nextPickBay === bayId}
              hasActiveChallan={Boolean(activeChallan)}
              compact={compact}
            />
          ))}
        </div>

        {/* Orientation Marker: Godown Entrance / Dispatch Door at bottom edge */}
        <div 
          id="godown-entrance-marker"
          className="w-full py-2.5 px-4 rounded-lg bg-[#0B2A5B] text-white flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider shadow-sm select-none"
        >
          <DoorOpen className="h-4 w-4 text-amber-400" />
          <span>{t('common.entranceMarker')} (गौतम बुद्ध नगर - गेट सं. 1)</span>
          <DoorOpen className="h-4 w-4 text-amber-400" />
        </div>
      </div>

      {/* Side Inspection Drawer */}
      <BayDrawer
        isOpen={isDrawerOpen}
        bayId={selectedBay}
        batches={selectedBay ? batchesByBay[selectedBay] : []}
        onClose={handleCloseDrawer}
      />
    </div>
  );
});
