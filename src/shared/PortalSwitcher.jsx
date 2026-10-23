import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ExternalLink, Warehouse, Store, Activity, RefreshCw } from 'lucide-react';
import { useLiveState } from './useLiveState';
import { useI18n } from '../i18n/I18nContext';

export function PortalSwitcher() {
  const location = useLocation();
  const navigate = useNavigate();
  const { lastUpdated, backendStatus, version, refreshServerState } = useLiveState();
  const { isHindi } = useI18n();

  const isGodown = location.pathname.startsWith('/godown') || location.pathname === '/';
  const isNfsa = location.pathname.startsWith('/nfsa-fps');

  return (
    <div className="bg-slate-900 border-b border-slate-800 text-white text-xs px-3 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-2 shadow-xs z-50">
      {/* Left: Portal Navigation Buttons */}
      <div className="flex items-center gap-1 sm:gap-2">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden md:inline mr-1">
          {isHindi ? 'पोर्टल स्विच करें:' : 'Portal Switcher:'}
        </span>

        {/* 1. AnnaSetu Godown Portal */}
        <div className="inline-flex items-center rounded-md overflow-hidden border border-slate-700 bg-slate-800/80 p-0.5">
          <button
            type="button"
            onClick={() => navigate('/godown')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all ${
              isGodown
                ? 'bg-[#0B2A5B] text-amber-300 shadow-xs border border-amber-400/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Warehouse className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>{isHindi ? 'अन्नसेतु गोदाम पोर्टल' : 'AnnaSetu Godown'}</span>
          </button>
          <a
            href="/godown"
            target="_blank"
            rel="noopener noreferrer"
            title={isHindi ? 'नई विंडो में गोदाम पोर्टल खोलें' : 'Open Godown in new window'}
            className="p-1 text-slate-400 hover:text-amber-300 hover:bg-slate-700 transition-colors ml-0.5"
            aria-label="Open Godown Portal in new window"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* 2. NFSA / e-PDS Fair Price Shop Portal */}
        <div className="inline-flex items-center rounded-md overflow-hidden border border-slate-700 bg-slate-800/80 p-0.5">
          <button
            type="button"
            onClick={() => navigate('/nfsa-fps')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all ${
              isNfsa
                ? 'bg-[#138808] text-white shadow-xs border border-emerald-300/40'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Store className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
            <span>{isHindi ? 'एनएफएसए / उचित दर दुकान पोर्टल' : 'NFSA / FPS Portal'}</span>
          </button>
          <a
            href="/nfsa-fps"
            target="_blank"
            rel="noopener noreferrer"
            title={isHindi ? 'नई विंडो में एनएफएसए पोर्टल खोलें' : 'Open NFSA in new window'}
            className="p-1 text-slate-400 hover:text-emerald-300 hover:bg-slate-700 transition-colors ml-0.5"
            aria-label="Open NFSA Portal in new window"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Right: Live Sync Heartbeat & Backend Pill */}
      <div className="flex items-center gap-2.5 sm:gap-4 text-[11px] font-mono">
        {/* Live sync ticker */}
        <div className="flex items-center gap-1.5 text-slate-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-slate-400 hidden sm:inline">Live:</span>
          <span className="text-emerald-400 font-bold">{lastUpdated}</span>
          {version && (
            <span className="text-slate-400 text-[10px] ml-1 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
              v{version}
            </span>
          )}
        </div>

        {/* Manual quick refresh */}
        <button
          type="button"
          onClick={() => refreshServerState()}
          title="Force refresh state from server"
          className="text-slate-400 hover:text-white transition-colors"
          aria-label="Force refresh server state"
        >
          <RefreshCw className="h-3 w-3" />
        </button>

        {/* Backend connectivity pill */}
        <div
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${
            backendStatus === 'CONNECTED'
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
              : 'bg-rose-950/80 text-rose-300 border-rose-700/60'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              backendStatus === 'CONNECTED' ? 'bg-emerald-400' : 'bg-rose-500 animate-pulse'
            }`}
          />
          <span>Backend: {backendStatus}</span>
        </div>
      </div>
    </div>
  );
}
