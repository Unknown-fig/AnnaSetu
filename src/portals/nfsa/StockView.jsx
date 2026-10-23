import React from 'react';
import { AlertTriangle, AlertCircle, PlusCircle, PackageCheck, Layers } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

export function getCommodityDisplayName(comm, isHindi) {
  if (comm === 'Edible Oil' || comm === 'Mustard Oil') {
    return isHindi ? 'खाद्य तेल (सरसों)' : 'Edible Oil (Mustard)';
  }
  const hindiNames = {
    'Wheat': 'गेहूं',
    'Rice': 'चावल',
    'Sugar': 'चीनी',
    'Salt': 'नमक',
    'Chana': 'चना',
    'Tuvar Dal': 'तुवर दाल',
  };
  return isHindi ? (hindiNames[comm] || comm) : comm;
}

export function StockView({ stockList = [], onRaiseIndentShortcut }) {
  const { isHindi } = useI18n();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#0B2A5B]" />
            <span>{isHindi ? 'दुकान राशन भंडार (Live Closing Stock)' : 'Shop Ration Stock (Live Inventory)'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isHindi 
              ? 'राष्ट्रीय खाद्य सुरक्षा अधिनियम (NFSA) के अंतर्गत सभी 7 आवश्यक जिंसों का वास्तविक स्टॉक संतुलन'
              : 'Live closing balance in Quintals across all 7 essential commodities under NFSA'}
          </p>
        </div>
      </div>

      {/* Grid of 7 Commodities */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
        {stockList.map((item) => {
          const isCritical = item.status === 'CRITICAL';
          const isLow = item.status === 'LOW';
          const isNormal = item.status === 'NORMAL';
          const displayName = getCommodityDisplayName(item.commodity, isHindi);

          // Progress bar percentage (relative to standard quota 100 Qtl)
          const pct = Math.min(100, Math.round((item.qty / 100.0) * 100));

          return (
            <div
              key={item.commodity}
              className={`rounded-lg border p-4 transition-all bg-white shadow-xs relative flex flex-col justify-between ${
                isCritical
                  ? 'border-rose-300 bg-rose-50/30'
                  : isLow
                  ? 'border-amber-300 bg-amber-50/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                {/* Header: Title + Status Chip */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-bold text-slate-900 text-sm">
                    {displayName}
                  </div>
                  {isCritical ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                      <AlertCircle className="h-3 w-3" />
                      <span>{isHindi ? 'अति न्यून (Critical)' : 'Critical'}</span>
                    </span>
                  ) : isLow ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                      <AlertTriangle className="h-3 w-3" />
                      <span>{isHindi ? 'कम स्टॉक (Low)' : 'Low Stock'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                      <PackageCheck className="h-3 w-3" />
                      <span>{isHindi ? 'पर्याप्त (Adequate)' : 'Adequate'}</span>
                    </span>
                  )}
                </div>

                {/* Stock Quantity in Quintals */}
                <div className="mt-2 mb-3">
                  <div className="flex items-baseline gap-1.5 font-mono">
                    <span className={`text-2xl font-black ${
                      isCritical ? 'text-rose-700' : isLow ? 'text-amber-800' : 'text-slate-900'
                    }`}>
                      {item.qty.toFixed(2)}
                    </span>
                    <span className="text-xs font-sans text-slate-500 font-semibold">Qtl (क्विंटल)</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {isHindi ? 'न्यूनतम सीमा:' : 'Safety Threshold:'} {item.threshold} Qtl
                  </div>
                </div>

                {/* Stock Progress Bar */}
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isCritical ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-600'
                    }`}
                    style={{ width: `${Math.max(5, pct)}%` }}
                  />
                </div>
              </div>

              {/* Action Button: Raise Indent Shortcut if Low/Critical or standard requisition */}
              <div>
                {(isLow || isCritical) ? (
                  <button
                    type="button"
                    onClick={() => onRaiseIndentShortcut(item.commodity, Math.max(20, Math.round(50 - item.qty)))}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors shadow-2xs"
                  >
                    <PlusCircle className="h-3.5 w-3.5 text-amber-800" />
                    <span>{isHindi ? 'मांग पत्र बनाएं (Raise Indent)' : 'Raise Indent'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onRaiseIndentShortcut(item.commodity, 40)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
                  >
                    <span>{isHindi ? 'मांग जोड़ें' : 'Requisition'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
