import React, { useCallback } from 'react';
import { useStore } from '../../context/store';
import { ACTION_TYPES } from '../../context/actions';
import { 
  Building2, 
  RotateCcw, 
  Smartphone, 
  ShieldCheck, 
  PlusCircle, 
  PlayCircle,
  AlertOctagon,
  PhoneCall,
  Activity,
  Layers,
  CheckCircle2
} from 'lucide-react';

export const Header = React.memo(function Header({
  onOpenReceiptModal,
  handsetVisible,
  onToggleHandset,
  onLoadDemoScenario,
  language = 'en',
}) {
  const { state, dispatch } = useStore();

  const handleResetDemo = useCallback(() => {
    if (window.confirm('Sync & Restore NIC Master Data? This will reset all 16 godown batches with relative dates.')) {
      dispatch({ type: ACTION_TYPES.RESET_DEMO_DATA });
    }
  }, [dispatch]);


  return (
    <header id="nic-header" className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40 select-none">
      {/* Subtle Top Tricolor Border (4px) */}
      <div className="h-1 w-full grid grid-cols-3">
        <div className="bg-[#ff9933]"></div>
        <div className="bg-[#ffffff] border-b border-slate-200"></div>
        <div className="bg-[#138808]"></div>
      </div>

      <div className="max-w-[1920px] mx-auto px-4 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Left: Official Government Emblem + Title Branding */}
        <div className="flex items-center gap-3.5">
          {/* State Emblem of India (Ashoka Lion Capital SVG) */}
          <div className="flex-shrink-0 flex flex-col items-center justify-center p-1 bg-amber-50/50 rounded border border-amber-200/60 shadow-xs">
            <svg
              className="h-11 w-10 text-slate-800"
              viewBox="0 0 100 125"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="State Emblem of India"
            >
              {/* Ashoka Lion Capital Vector Silhouette */}
              <path d="M50 4C45 4 41 8 40 12C38 12 36 13 35 15C33 14 31 15 30 17C28 17 26 19 26 21C24 23 23 26 24 29C25 32 27 34 29 35C29 37 30 39 32 41C31 43 31 46 32 48C34 52 38 55 42 56C42 59 43 62 45 64L35 68C32 69 30 72 30 75L30 82C30 84 32 86 34 86L66 86C68 86 70 84 70 82L70 75C70 72 68 69 65 68L55 64C57 62 58 59 58 56C62 55 66 52 68 48C69 46 69 43 68 41C70 39 71 37 71 35C73 34 75 32 76 29C77 26 76 23 74 21C74 19 72 17 70 17C69 15 67 14 65 15C64 13 62 12 60 12C59 8 55 4 50 4ZM50 10C53 10 55 12 55 15C55 16 54 17 53 18C52 17 50 17 48 18C47 17 46 16 46 15C46 12 48 10 50 10ZM50 72C54 72 57 75 57 78C57 81 54 84 50 84C46 84 43 81 43 78C43 75 46 72 50 72Z" fill="#1e3a8a" />
              {/* Ashoka Wheel Base */}
              <circle cx="50" cy="78" r="4.5" fill="none" stroke="#ea580c" strokeWidth="1.5" />
              {/* Base Pedestal with Satyameva Jayate */}
              <rect x="22" y="88" width="56" height="5" rx="1.5" fill="#1e3a8a" />
              <text x="50" y="103" textAnchor="middle" fontSize="9.5" fontWeight="bold" fontFamily="serif" fill="#b91c1c">
                सत्यमेव जयते
              </text>
            </svg>
          </div>

          <div className="border-l border-slate-300 pl-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg font-extrabold text-[#1e3a8a] tracking-tight leading-tight flex items-center gap-2">
                <span>ANNA-SETU</span>
                <span className="text-slate-400 font-light hidden sm:inline">|</span>
                <span className="text-xs sm:text-sm font-bold text-slate-800">
                  e-PDS Smart Godown & FIFO Management Portal
                </span>
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                iPDS v4.2
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-0.5">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-amber-600" />
                खाद्य एवं सार्वजनिक वितरण विभाग, भारत सरकार
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600 font-medium">
                Gautam Buddha Nagar — Surajpur Central Godown (डिपो कोड: DEP-UP-GBN-04)
              </span>
            </div>
          </div>
        </div>

        {/* Right: Official Metadata Box + Official Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Metadata Box (iPDS Sync + Toll Free Helpline) */}
          <div className="hidden lg:flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-xs text-slate-700">
            <div className="flex items-center gap-1.5 pr-3 border-r border-slate-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
              </span>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block leading-none">Annavitran Sync</span>
                <span className="text-[11px] font-mono font-bold text-emerald-700">ACTIVE (iPDS-v4.2)</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <PhoneCall className="h-3.5 w-3.5 text-blue-700" />
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block leading-none">PDS Helpline</span>
                <span className="text-[11px] font-mono font-bold text-slate-800">1967 / 1800-180-0150</span>
              </div>
            </div>
          </div>

          {/* Alarm Indicator */}
          {state.isAlarmActive && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-bold font-mono animate-bounce shadow">
              <AlertOctagon className="h-4 w-4" />
              <span>FIFO VIOLATION ALARM ACTIVE</span>
            </div>
          )}

          {/* Load Demo Scenario Booster */}
          <button
            id="btn-load-demo-scenario"
            type="button"
            onClick={onLoadDemoScenario}
            title="Load Pre-configured Demo Scenario: Wheat 120 Qtl for FPS-GN-101 (Tests Hold Skip + 3-Batch Split)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors shadow-xs"
          >
            <PlayCircle className="h-4 w-4" />
            <span>Load Demo (120 Qtl)</span>
          </button>

          {/* Inward Stock Receipt Entry */}
          <button
            id="btn-stock-receipt"
            type="button"
            onClick={onOpenReceiptModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#15803d] hover:bg-[#166534] text-white font-semibold text-xs transition-colors shadow-xs"
          >
            <PlusCircle className="h-4 w-4" />
            <span>+ Inward Stock Entry</span>
          </button>

          {/* Reset Demo Data Button Styled as Official "Sync / Restore NIC Master Data" */}
          <button
            id="btn-reset-demo"
            type="button"
            onClick={handleResetDemo}
            title="Sync / Restore NIC Master Data (पुनः स्थापित करें)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-medium transition-colors shadow-xs"
          >
            <RotateCcw className="h-3.5 w-3.5 text-blue-700" />
            <span>Sync / Restore NIC Data</span>
          </button>

          {/* Worker Handset Simulator Toggle */}
          <button
            id="btn-toggle-handset"
            type="button"
            onClick={onToggleHandset}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border shadow-xs ${
              handsetVisible
                ? 'bg-blue-50 text-blue-800 border-blue-300'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5 text-blue-600" />
            <span>{handsetVisible ? 'Handset Simulator (ON)' : 'Show Handset (28%)'}</span>
          </button>
        </div>
      </div>
    </header>
  );
});

