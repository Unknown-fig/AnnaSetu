import React from 'react';
import { 
  Send, 
  LayoutDashboard, 
  Grid3X3, 
  History, 
  FileCheck2, 
  AlertTriangle,
  Megaphone,
  BellRing
} from 'lucide-react';

export const NavbarTicker = React.memo(function NavbarTicker({ activeTab, onSelectTab, exceptionsCount = 0, language = 'en' }) {

  const tabs = [
    {
      id: 'challan',
      tabElementId: 'tab-challan-engine',
      icon: Send,
      titleEn: 'Smart FIFO Delivery Challan',
      titleHi: 'स्मार्ट डिलीवरी चालान एवं बैच आवंटन',
    },
    {
      id: 'dashboard',
      tabElementId: 'tab-dashboard',
      icon: LayoutDashboard,
      titleEn: 'Centralized Godown Dashboard',
      titleHi: 'केंद्रीय गोदाम डैशबोर्ड',
    },
    {
      id: 'rackmap',
      tabElementId: 'tab-rackmap',
      icon: Grid3X3,
      titleEn: 'Batch Ageing & 2D Rack Map',
      titleHi: 'बैच आयु एवं गोदाम मानचित्र',
    },
    {
      id: 'traceability',
      tabElementId: 'tab-traceability',
      icon: History,
      titleEn: 'SHA-256 Traceability Ledger',
      titleHi: 'क्रिप्टोग्राफिक ऑडिट लेजर',
    },
    {
      id: 'exceptions',
      tabElementId: 'tab-exceptions',
      icon: FileCheck2,
      titleEn: 'FIFO Compliance & Exception Audit',
      titleHi: 'FIFO अनुपालन एवं अपवाद लॉग',
      badge: exceptionsCount > 0 ? exceptionsCount : null,
    },
  ];

  return (
    <div id="nic-navbar-section" className="w-full select-none">
      {/* Deep Government Navy Blue (#1e3a8a) Navigation Bar */}
      <nav id="nic-navbar" className="bg-[#1e3a8a] text-white shadow-md">
        <div className="max-w-[1920px] mx-auto px-4 flex items-center overflow-x-auto no-scrollbar">
          <div className="flex items-center space-x-1 sm:space-x-2 py-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  id={tab.tabElementId}
                  type="button"
                  onClick={() => onSelectTab(tab.id)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-xs font-bold uppercase tracking-wide transition-all border-b-4 whitespace-nowrap ${
                    isActive
                      ? 'border-[#f97316] bg-[#1e40af] text-white shadow-inner font-extrabold'
                      : 'border-transparent text-blue-100 hover:text-white hover:bg-blue-800/60'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-[#f97316]' : 'text-blue-300'}`} />
                  <span className="flex flex-col text-left">
                    <span className="text-[12px]">{tab.titleEn}</span>
                    <span className="text-[10px] font-normal normal-case text-blue-200 -mt-0.5 font-hind">
                      {tab.titleHi}
                    </span>
                  </span>

                  {tab.badge && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold font-mono">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Official Live Directive Ticker Bar (Yellow/Amber) */}
      <div
        id="nic-ticker"
        className="bg-amber-100 border-b border-amber-300 text-amber-950 px-4 py-1.5 flex items-center justify-between text-xs font-medium shadow-xs"
      >
        <div className="max-w-[1920px] mx-auto w-full flex items-center gap-2.5 overflow-hidden">
          {/* Directive Badge */}
          <div className="flex-shrink-0 flex items-center gap-1.5 bg-[#b45309] text-white text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded shadow-xs">
            <Megaphone className="h-3 w-3 animate-pulse" />
            <span>राजकीय निर्देश | OFFICIAL DIRECTIVE</span>
          </div>

          {/* Scrolling / Clean Announcement Text */}
          <div className="truncate text-[11px] sm:text-xs text-amber-950 font-semibold tracking-wide">
            <span className="text-[#b91c1c] font-bold">iPDS FIFO COMPLIANCE MANDATE:</span>{' '}
            Batches aged &gt;60 days are flagged <span className="font-bold underline decoration-red-600">CRITICAL</span>. Skipping older eligible batches for any Fair Price Shop (FPS) Delivery Challan requires a recorded Approved Exception Reason.
          </div>

          <div className="hidden md:flex items-center gap-1 text-[10px] font-mono font-bold text-amber-800 flex-shrink-0 pl-2 border-l border-amber-300">
            <span>UP FCS ORDER #2026/FIFO/819</span>
          </div>
        </div>
      </div>
    </div>
  );
});

