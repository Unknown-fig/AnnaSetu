import React, { useState, useMemo, useCallback } from 'react';
import { useStore } from '../../context/store';
import { BAYS, calculateAgeDays, getAgeCategory, QUALITY_STATUS } from '../../types/models';
import { 
  Grid3X3, 
  Warehouse, 
  ShieldCheck, 
  AlertTriangle, 
  AlertOctagon, 
  Info, 
  Package, 
  Layers,
  CheckCircle2,
  Lock
} from 'lucide-react';

const BayCard = React.memo(function BayCard({ bayId, batch, isSelected, onSelectBay }) {
  const handleClick = useCallback(() => onSelectBay(bayId), [bayId, onSelectBay]);

  if (!batch || batch.remainingQtl <= 0) {
    return (
      <div
        onClick={handleClick}
        className={`p-3 rounded-md border-2 text-center transition-all cursor-pointer ${
          isSelected
            ? 'border-blue-600 ring-2 ring-blue-300 bg-white'
            : 'border-dashed border-slate-300 bg-slate-50 hover:bg-white'
        }`}
      >
        <div className="font-mono font-bold text-xs text-slate-400">Bay {bayId}</div>
        <div className="text-[11px] text-slate-400 mt-2">EMPTY BAY</div>
        <div className="text-[10px] text-slate-400 font-mono">0.00 Qtl</div>
      </div>
    );
  }

  const ageDays = calculateAgeDays(batch.receiptDate);
  const isHold = batch.qualityStatus === QUALITY_STATUS.HOLD_HIGH_MOISTURE;
  const isCritical = !isHold && ageDays >= 60;
  const isModerate = !isHold && ageDays >= 21 && ageDays < 60;

  let cardBg = 'bg-emerald-50/80 border-emerald-400 text-emerald-950 hover:bg-emerald-100/70';
  let badgeBg = 'bg-emerald-200 text-emerald-900';

  if (isHold) {
    cardBg = 'bg-purple-50 border-purple-400 text-purple-950 hover:bg-purple-100/70';
    badgeBg = 'bg-purple-200 text-purple-900';
  } else if (isCritical) {
    cardBg = 'bg-red-50/90 border-red-500 text-red-950 hover:bg-red-100 shadow-xs';
    badgeBg = 'bg-red-200 text-red-900';
  } else if (isModerate) {
    cardBg = 'bg-amber-50 border-amber-400 text-amber-950 hover:bg-amber-100/70';
    badgeBg = 'bg-amber-200 text-amber-900';
  }

  return (
    <div
      onClick={handleClick}
      className={`p-3 rounded-md border-2 transition-all cursor-pointer text-left relative ${cardBg} ${
        isSelected ? 'ring-2 ring-blue-700 shadow-md scale-[1.02]' : ''
      }`}
    >
      {/* Top Row: Bay ID + Age Badge */}
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono font-extrabold text-xs text-slate-900">
          Bay {bayId}
        </span>
        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${badgeBg}`}>
          {isHold ? 'HOLD' : `${ageDays}d old`}
        </span>
      </div>

      {/* Commodity + Batch */}
      <div className="font-bold text-xs truncate">
        {batch.commodity}
      </div>
      <div className="text-[10px] font-mono text-slate-600 truncate">
        #{batch.batchId}
      </div>

      {/* Stock Quantity */}
      <div className="mt-2 text-right">
        <span className="text-xs font-mono font-black text-slate-900">
          {batch.remainingQtl}
        </span>
        <span className="text-[10px] font-medium text-slate-600 ml-0.5">Qtl</span>
      </div>
    </div>
  );
});

export const RackMap2D = React.memo(function RackMap2D({ language = 'en' }) {
  const { state } = useStore();
  const { batches } = state;
  const [selectedBay, setSelectedBay] = useState('A1');

  const handleSelectBay = useCallback((bayId) => {
    setSelectedBay(bayId);
  }, []);


  // Map batches by bay ID
  const bayMap = useMemo(() => {
    const map = {};
    batches.forEach(b => {
      // If multiple batches somehow share a bay, store list or primary
      if (!map[b.bay]) {
        map[b.bay] = b;
      }
    });
    return map;
  }, [batches]);

  const selectedBatch = bayMap[selectedBay] || null;

  // Age counts
  const counts = useMemo(() => {
    let fresh = 0;
    let moderate = 0;
    let critical = 0;
    let hold = 0;

    batches.forEach(b => {
      if (b.remainingQtl <= 0) return;
      if (b.qualityStatus === QUALITY_STATUS.HOLD_HIGH_MOISTURE) {
        hold++;
      } else {
        const age = calculateAgeDays(b.receiptDate);
        if (age >= 60) critical++;
        else if (age >= 21) moderate++;
        else fresh++;
      }
    });

    return { fresh, moderate, critical, hold };
  }, [batches]);

  return (
    <div className="bg-white border border-slate-300 rounded-lg p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#1e3a8a] flex items-center gap-2">
              <Grid3X3 className="h-5 w-5 text-[#1e3a8a]" />
              <span>Batch Ageing & 2D Rack Map</span>
            </h2>
            <span className="text-xs font-hind text-slate-500 font-semibold">
              (बैच आयु एवं गोदाम मानचित्र)
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Surajpur Central Godown 2D Floor Layout • 16 Active Storage Bays • Live FIFO Age Indicators
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 border border-emerald-300 text-emerald-800 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
            <span>Fresh 0-20d ({counts.fresh})</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-50 border border-amber-300 text-amber-900 font-medium">
            <span className="h-2 w-2 rounded-full bg-amber-600"></span>
            <span>Moderate 21-59d ({counts.moderate})</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-50 border border-red-300 text-red-900 font-bold">
            <span className="h-2 w-2 rounded-full bg-red-600"></span>
            <span>Critical 60+d ({counts.critical})</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-purple-50 border border-purple-300 text-purple-900 font-medium">
            <span className="h-2 w-2 rounded-full bg-purple-600"></span>
            <span>Quality Hold ({counts.hold})</span>
          </div>
        </div>
      </div>

      {/* Main Grid + Selected Bay Inspector Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: 4x4 Warehouse Floorplan */}
        <div className="lg:col-span-2 space-y-3">
          <div className="bg-slate-100/80 p-4 rounded-lg border border-slate-300 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 px-1">
              <span className="flex items-center gap-1.5">
                <Warehouse className="h-4 w-4 text-[#1e3a8a]" />
                <span>Godown Storage Aisles (Row A to D)</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Click any Bay to inspect FIFO lifecycle details
              </span>
            </div>

            {/* 4x4 Grid of Bays */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {BAYS.map((bayId) => (
                <BayCard
                  key={bayId}
                  bayId={bayId}
                  batch={bayMap[bayId]}
                  isSelected={selectedBay === bayId}
                  onSelectBay={handleSelectBay}
                />
              ))}
            </div>
          </div>

        </div>

        {/* Right Col: Selected Bay Details Inspector */}
        <div className="space-y-3">
          <div className="bg-slate-50 border border-slate-300 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold uppercase text-[#1e3a8a] tracking-wide flex items-center gap-1.5">
                <Info className="h-4 w-4 text-blue-700" />
                Bay #{selectedBay} Inspection Details
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                Depot Zone {selectedBay[0]}
              </span>
            </div>

            {selectedBatch ? (
              <div className="space-y-3 text-xs">
                {/* Batch and Commodity Header */}
                <div className="p-3 bg-white border border-slate-200 rounded">
                  <div className="text-[10px] uppercase font-mono text-slate-500">Allocated Batch</div>
                  <div className="text-base font-extrabold text-[#1e3a8a] font-mono">
                    #{selectedBatch.batchId} ({selectedBatch.commodity})
                  </div>
                  <div className="text-slate-600 text-xs mt-0.5">
                    Supplier: <strong>{selectedBatch.supplier}</strong>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-white p-2.5 rounded border border-slate-200 space-y-0.5">
                    <span className="text-slate-500 font-mono text-[10px] block">Stock Balance:</span>
                    <span className="text-sm font-bold font-mono text-slate-900">
                      {selectedBatch.remainingQtl} <span className="text-xs font-normal text-slate-500">Qtl</span>
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded border border-slate-200 space-y-0.5">
                    <span className="text-slate-500 font-mono text-[10px] block">Stock Age:</span>
                    <span className="text-sm font-bold font-mono text-slate-900">
                      {calculateAgeDays(selectedBatch.receiptDate)} <span className="text-xs font-normal text-slate-500">days</span>
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded border border-slate-200 space-y-0.5">
                    <span className="text-slate-500 font-mono text-[10px] block">Receipt Date:</span>
                    <span className="font-mono text-slate-800 font-medium">
                      {selectedBatch.receiptDate}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded border border-slate-200 space-y-0.5">
                    <span className="text-slate-500 font-mono text-[10px] block">Quality Status:</span>
                    <span className={`font-mono font-bold text-[10px] px-1.5 py-0.2 rounded inline-block ${
                      selectedBatch.qualityStatus === QUALITY_STATUS.HOLD_HIGH_MOISTURE
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {selectedBatch.qualityStatus}
                    </span>
                  </div>
                </div>

                {/* FIFO Recommendation Assessment */}
                <div className={`p-3 rounded border text-xs space-y-1 ${
                  selectedBatch.qualityStatus === QUALITY_STATUS.HOLD_HIGH_MOISTURE
                    ? 'bg-purple-50 border-purple-300 text-purple-950'
                    : calculateAgeDays(selectedBatch.receiptDate) >= 60
                    ? 'bg-red-50 border-red-300 text-red-950'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                }`}>
                  <div className="font-bold uppercase text-[11px] flex items-center gap-1.5">
                    {selectedBatch.qualityStatus === QUALITY_STATUS.HOLD_HIGH_MOISTURE ? (
                      <>
                        <Lock className="h-3.5 w-3.5 text-purple-700" />
                        <span>DISPATCH LOCKED — PENDING LAB CLEARANCE</span>
                      </>
                    ) : calculateAgeDays(selectedBatch.receiptDate) >= 60 ? (
                      <>
                        <AlertTriangle className="h-3.5 w-3.5 text-red-700" />
                        <span>CRITICAL FIFO DISPATCH PRIORITY</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                        <span>FIFO NORMAL ELIGIBLE INVENTORY</span>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    {selectedBatch.qualityStatus === QUALITY_STATUS.HOLD_HIGH_MOISTURE
                      ? 'This batch is flagged on quality hold due to excessive moisture content (>14.5%). The FIFO engine will automatically bypass this batch until an official lab clearance report is filed.'
                      : calculateAgeDays(selectedBatch.receiptDate) >= 60
                      ? 'Stock has been in storage over 60 days. Under Department of Food & Civil Supplies regulations, this batch will be automatically prioritized as Step #1 in the next delivery challan.'
                      : 'Stock is fresh and compliant. It will be allocated sequentially following the oldest batches in storage.'}
                  </p>
                </div>

                {/* SHA-256 Genesis Hash */}
                <div className="p-2.5 bg-white border border-slate-200 rounded text-[10px] font-mono space-y-1">
                  <span className="text-slate-500 uppercase block font-semibold">Cryptographic Genesis Hash:</span>
                  <div className="truncate text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-200">
                    {selectedBatch.sha256Hash || '0x49a1b0294e771c890f84a1d94b02'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 font-mono text-xs">
                Bay {selectedBay} is currently empty.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

