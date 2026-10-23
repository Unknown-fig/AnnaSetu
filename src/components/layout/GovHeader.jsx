import React, { useCallback } from 'react';
import { useStore } from '../../context/store';
import { ACTION_TYPES } from '../../context/actions';
import { useI18n } from '../../i18n/I18nContext';
import { 
  Landmark, 
  RotateCcw, 
  Smartphone, 
  Building2, 
  Languages,
  PlayCircle,
  ClipboardList
} from 'lucide-react';

import { apiClient } from '../../services/apiClient';

export const GovHeader = React.memo(function GovHeader({
  handsetVisible,
  onToggleHandset,
  onLoadDemoScenario,
}) {
  const { state, dispatch, refreshServerState } = useStore();
  const { language, setLanguage, t } = useI18n();
  const pendingIndentsCount = (state?.fpsIndents || []).filter(i => i.status === 'PENDING_AT_GODOWN').length;

  const handleResetDemo = useCallback(async () => {
    if (window.confirm(
      language === 'hi'
        ? 'क्या आप सभी 16 गोदाम बैचों और ऑडिट लेजर को पुनः रीसेट करना चाहते हैं?'
        : 'Reset Demo Data? This will restore all 16 godown batches with relative dates.'
    )) {
      if (state.backendConnected) {
        try {
          await apiClient.resetDatabase();
          if (refreshServerState) await refreshServerState();
          return;
        } catch (e) {
          console.warn('Backend reset failed, resetting local state:', e);
        }
      }
      dispatch({ type: ACTION_TYPES.RESET_DEMO_DATA });
    }
  }, [dispatch, language, state.backendConnected, refreshServerState]);

  return (
    <header id="gov-header" className="bg-white border-b border-slate-200 select-none sticky top-0 z-40 shadow-xs">
      {/* 1. Top Tricolor Strip: 3 equal horizontal bands, saffron #FF9933 / white / green #138808, 6px tall, full width */}
      <div className="h-[6px] w-full flex" role="presentation" aria-hidden="true">
        <div className="flex-1 bg-[#FF9933]" />
        <div className="flex-1 bg-[#FFFFFF] border-b border-slate-200/50" />
        <div className="flex-1 bg-[#138808]" />
      </div>

      {/* Main Government Header Content */}
      <div className="max-w-[1920px] mx-auto px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Placeholder Emblem + Two-Line Title */}
        <div className="flex items-center gap-3">
          {/* Placeholder emblem: Lucide Landmark in a circle */}
          {/* replace with official asset */}
          <div 
            className="flex-shrink-0 h-11 w-11 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-700 shadow-xs"
            title="Placeholder Emblem (replace with official asset)"
            aria-label="Department Emblem"
          >
            <Landmark className="h-6 w-6 text-[#0B2A5B]" />
          </div>

          <div>
            {/* Line 1 */}
            <div className="text-xs sm:text-sm font-semibold text-slate-700 leading-snug">
              {t('header.dept')}
            </div>
            {/* Line 2 */}
            <h1 className="text-sm sm:text-base font-extrabold text-[#0B2A5B] tracking-tight leading-snug">
              {t('header.title')}
            </h1>
          </div>
        </div>

        {/* Right: Badges & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Godown Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold">
            <Building2 className="h-3.5 w-3.5 text-amber-600" />
            <span>{t('header.godownBadge')}</span>
          </div>

          {/* Pending Indents Pulsing Badge */}
          {pendingIndentsCount > 0 && (
            <div 
              id="header-pending-indents-badge" 
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500 text-slate-950 text-xs font-bold shadow-xs animate-pulse"
              title={`${pendingIndentsCount} Pending FPS Indents awaiting Challan creation`}
            >
              <ClipboardList className="h-3.5 w-3.5 text-slate-950" />
              <span>{pendingIndentsCount} {language === 'hi' ? 'लंबित मांगपत्र' : 'Pending Indents'}</span>
            </div>
          )}

          {/* Small Prototype Tag */}
          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-50 text-amber-800 border border-amber-300 uppercase tracking-wider">
            {t('header.prototypeBadge')}
          </span>

          {/* Bilingual Toggle: EN | हिन्दी */}
          <div className="flex items-center rounded border border-slate-300 bg-slate-50 overflow-hidden text-xs font-bold shadow-xs">
            <button
              id="btn-lang-en"
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2.5 py-1 transition-colors ${
                language === 'en'
                  ? 'bg-[#0B2A5B] text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              EN
            </button>
            <span className="text-slate-300 select-none">|</span>
            <button
              id="btn-lang-hi"
              type="button"
              onClick={() => setLanguage('hi')}
              className={`px-2.5 py-1 font-hindi transition-colors ${
                language === 'hi'
                  ? 'bg-[#0B2A5B] text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              हिन्दी
            </button>
          </div>

          {/* Quick Demo Scenario Trigger */}
          {onLoadDemoScenario && (
            <button
              id="btn-load-demo"
              type="button"
              onClick={onLoadDemoScenario}
              title="Load standard demonstration scenario (120 Qtl Wheat)"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-colors shadow-xs"
            >
              <PlayCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('header.loadDemo')}</span>
            </button>
          )}

          {/* Reset Demo Data Button */}
          <button
            id="btn-reset-demo"
            type="button"
            onClick={handleResetDemo}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold transition-colors shadow-xs"
          >
            <RotateCcw className="h-3.5 w-3.5 text-blue-700" />
            <span>{t('header.resetDemo')}</span>
          </button>

          {/* Handset Toggle Button */}
          <button
            id="btn-toggle-handset"
            type="button"
            onClick={onToggleHandset}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors border shadow-xs ${
              handsetVisible
                ? 'bg-blue-50 text-blue-900 border-blue-300'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5 text-blue-700" />
            <span>{t('header.toggleHandset')} {handsetVisible ? '(ON)' : '(OFF)'}</span>
          </button>
        </div>
      </div>
    </header>
  );
});
