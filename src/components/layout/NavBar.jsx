import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useStore } from '../../context/store';
import { NetworkSwitch } from './NetworkSwitch';
import { 
  LayoutDashboard, 
  PackagePlus, 
  Truck, 
  Grid3X3, 
  History, 
  FileCheck2,
  QrCode,
  ClipboardList,
  Server
} from 'lucide-react';

export const NavBar = React.memo(function NavBar({ activeTab, onSelectTab, exceptionsCount = 0 }) {
  const { t, lang } = useI18n();
  const { state } = useStore();

  const pendingIndentsCount = (state.fpsIndents || []).filter(i => i.status === 'PENDING_AT_GODOWN').length;

  const navItems = [
    {
      id: 'dashboard',
      tabElementId: 'tab-dashboard',
      icon: LayoutDashboard,
      labelKey: 'nav.dashboard',
    },
    {
      id: 'receipt',
      tabElementId: 'tab-receipt',
      icon: PackagePlus,
      labelKey: 'nav.stockReceipt',
    },
    {
      id: 'challan',
      tabElementId: 'tab-challan',
      icon: Truck,
      labelKey: 'nav.deliveryChallan',
    },
    {
      id: 'scanner',
      tabElementId: 'tab-scanner',
      icon: QrCode,
      labelKey: 'nav.gateScanner',
    },
    {
      id: 'locator',
      tabElementId: 'tab-locator',
      icon: Grid3X3,
      labelKey: 'nav.bayLocator',
    },
    {
      id: 'indents',
      tabElementId: 'tab-indents',
      icon: ClipboardList,
      labelKey: 'nav.fpsIndents',
      badge: pendingIndentsCount > 0 ? pendingIndentsCount : null,
    },
    {
      id: 'traceability',
      tabElementId: 'tab-traceability',
      icon: History,
      labelKey: 'nav.traceability',
    },
    {
      id: 'exceptions',
      tabElementId: 'tab-exceptions',
      icon: FileCheck2,
      labelKey: 'nav.exceptionsLog',
      badge: exceptionsCount > 0 ? exceptionsCount : null,
    },
  ];

  return (
    <nav id="gov-navbar" className="bg-[#0B2A5B] text-white shadow-md select-none sticky top-[64px] z-30">
      <div className="max-w-[1920px] mx-auto px-4 flex items-center justify-between overflow-x-auto no-scrollbar gap-2">
        <div className="flex items-center space-x-1 py-0 shrink-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                id={item.tabElementId}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-xs font-bold tracking-wide transition-all border-b-4 whitespace-nowrap focus:outline-none ${
                  isActive
                    ? 'border-amber-400 bg-blue-950/70 text-white font-extrabold shadow-inner'
                    : 'border-transparent text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-amber-400' : 'text-slate-300'}`} />
                <span className="text-[13px]">{t(item.labelKey)}</span>

                {item.badge && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-slate-950 text-[10px] font-bold font-mono ${
                    item.id === 'indents' ? 'bg-amber-400 animate-pulse ring-2 ring-amber-300' : 'bg-amber-500'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Backend Status Pill + Network Online/Offline Simulator Switch & Sync Queue Pill */}
        <div className="py-2 shrink-0 flex items-center gap-3">
          <div
            id="backend-status-pill"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${
              state.backendConnected
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/60 shadow-sm'
                : 'bg-rose-950/60 text-rose-300 border-rose-500/60 shadow-sm'
            }`}
            title={state.backendConnected ? 'Central Python FastAPI & SQLite Server: Operational' : 'Central Python FastAPI Server: Unreachable or Offline'}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                state.backendConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="text-[11px] font-mono tracking-tight">
              {state.backendConnected
                ? (lang === 'hi' ? 'सर्वर: कनेक्टेड' : 'Backend: CONNECTED')
                : (lang === 'hi' ? 'सर्वर: अनुपलब्ध' : 'Backend: UNREACHABLE')}
            </span>
          </div>

          <NetworkSwitch />
        </div>
      </div>
    </nav>
  );
});
