import React from 'react';
import { Store, MapPin, User, CheckCircle2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

export const SEEDED_FPS = [
  { code: 'FPS-GN-101', name: 'Kasna Village Market', dealer: 'Ramesh Kumar', location: 'Kasna Zone' },
  { code: 'FPS-GN-102', name: 'Tugalpur Haldoni Road', dealer: 'Suresh Verma', location: 'Haldoni Sector' },
  { code: 'FPS-GN-103', name: 'Sector Beta-2 Market', dealer: 'Mohan Lal', location: 'Beta-2 Commercial' },
  { code: 'FPS-GN-104', name: 'Dankaur Main Bazaar', dealer: 'Rajesh Sharma', location: 'Dankaur Rural' },
  { code: 'FPS-GN-105', name: 'Alpha-1 Commercial Belt', dealer: 'Priya Singh', location: 'Alpha-1 Central' },
  { code: 'FPS-GN-106', name: 'Rabupura Gram Panchayat', dealer: 'Harish Yadav', location: 'Rabupura Outpost' },
];

export function FpsSelector({ selectedFpsCode, onSelectFps, fpsData = null }) {
  const { isHindi } = useI18n();

  const currentStore = fpsData || SEEDED_FPS.find(f => f.code === selectedFpsCode) || SEEDED_FPS[0];

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Dropdown selector */}
        <div className="flex-1">
          <label htmlFor="fps-store-select" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Store className="h-4 w-4 text-[#0B2A5B]" />
            <span>{isHindi ? 'उचित दर दुकान चुनें (Fair Price Shop):' : 'Select Fair Price Shop (FPS):'}</span>
          </label>
          <select
            id="fps-store-select"
            value={selectedFpsCode}
            onChange={(e) => onSelectFps(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 text-slate-900 font-bold text-sm rounded-md px-3 py-2 focus:ring-2 focus:ring-[#0B2A5B] focus:border-[#0B2A5B] outline-none transition-all shadow-xs"
          >
            {SEEDED_FPS.map((f) => (
              <option key={f.code} value={f.code}>
                {f.code} — {f.name} ({f.location})
              </option>
            ))}
          </select>
        </div>

        {/* Selected Store Profile Badge */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-200 rounded-md p-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-800">
            <User className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <span className="text-slate-500">{isHindi ? 'डीलर:' : 'Dealer:'}</span>
            <span className="font-bold">{currentStore.dealer || currentStore.dealer_name}</span>
          </div>
          <div className="h-4 w-px bg-slate-300 hidden sm:block" />
          <div className="flex items-center gap-1.5 text-slate-800">
            <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <span className="text-slate-500">{isHindi ? 'स्थान:' : 'Zone:'}</span>
            <span className="font-bold">{currentStore.location}</span>
          </div>
          <div className="h-4 w-px bg-slate-300 hidden sm:block" />
          <div className="flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" />
            <span>NFSA e-PoS Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
