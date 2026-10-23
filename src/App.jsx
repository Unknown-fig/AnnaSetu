import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { StoreProvider, useStore } from './context/store';
import { I18nProvider, useI18n } from './i18n/I18nContext';
import { PortalSwitcher } from './shared/PortalSwitcher';
import { NfsaApp } from './portals/nfsa/NfsaApp';
import { subscribeToSync } from './shared/syncChannel';
import { playNotificationChime } from './services/audioService';
import { GovHeader } from './components/layout/GovHeader';
import { NavBar } from './components/layout/NavBar';
import { AlertTicker } from './components/layout/AlertTicker';
import { Footer } from './components/layout/Footer';
import { GlobalViolationBanner } from './components/common/GlobalViolationBanner';
import { KpiCards } from './components/dashboard/KpiCards';
import { AgeingRadar } from './components/dashboard/AgeingRadar';
import { StockCharts } from './components/dashboard/StockCharts';
import { BatchTable } from './components/dashboard/BatchTable';
import { BayGrid } from './components/locator/BayGrid';
import { StockReceiptView } from './components/receipt/StockReceiptView';
import { FifoChallanEngine } from './components/challan/FifoChallanEngine';
import { TraceabilityLog } from './components/traceability/TraceabilityLog';
import { ExceptionsLog } from './components/traceability/ExceptionsLog';
import { GateScanner } from './components/scanner/GateScanner';
import { FpsIndentsPanel } from './components/indents/FpsIndentsPanel';
import { WorkerSimulator } from './components/handset/WorkerSimulator';
import { 
  Smartphone,
  Radio,
  WifiOff,
  Bell,
  BellOff,
  ClipboardList,
  ArrowRight,
  X
} from 'lucide-react';

function GodownCommandCenter({ demoTrigger }) {
  const { state, refreshServerState } = useStore();
  const { t, isHindi } = useI18n();
  const [activeTab, setActiveTab] = useState('challan'); // Default on Challan for instant FIFO demo
  const [handsetVisible, setHandsetVisible] = useState(true);
  const [preFillChallanData, setPreFillChallanData] = useState(null);
  const [incomingIndentToast, setIncomingIndentToast] = useState(null);
  const [isChimeMuted, setIsChimeMuted] = useState(false);

  const prevPendingCountRef = useRef(null);

  const handleToggleHandset = useCallback(() => setHandsetVisible(v => !v), []);
  const handleCloseHandset = useCallback(() => setHandsetVisible(false), []);
  const handleSelectTab = useCallback((tabId) => setActiveTab(tabId), []);
  
  const handleLoadDemoScenario = useCallback(() => {
    setActiveTab('challan');
    demoTrigger.set({ timestamp: Date.now() });
  }, [demoTrigger]);

  const handleNavigateToChallan = useCallback(() => {
    setActiveTab('challan');
  }, []);

  const handlePreFillChallan = useCallback((data) => {
    setPreFillChallanData(data);
    setActiveTab('challan');
  }, []);

  // Monitor incoming indents from cross-tab BroadcastChannel and trigger soft chime + toast
  useEffect(() => {
    const unsubscribe = subscribeToSync(async (event) => {
      if (refreshServerState) {
        try {
          const freshData = await refreshServerState();
          if (event.reason === 'new_indent' || event.reason === 'mutation') {
            const indents = freshData?.fps_indents || freshData?.indents || state.fpsIndents || [];
            const pendingList = indents.filter(i => i.status === 'PENDING_AT_GODOWN');
            
            // If new pending indent arrived
            if (pendingList.length > 0) {
              const newest = pendingList[0];
              if (!isChimeMuted) {
                playNotificationChime();
              }
              setIncomingIndentToast({
                id: newest.id || Date.now(),
                fpsCode: newest.fps_code,
                commodity: newest.commodity,
                qty: newest.requested_qty,
                indentNo: newest.indent_no,
              });
            }
          }
        } catch (e) {
          // Ignore
        }
      }
    });

    return unsubscribe;
  }, [refreshServerState, isChimeMuted, state.fpsIndents]);

  // Auto-dismiss incoming indent toast after 8 seconds
  useEffect(() => {
    if (!incomingIndentToast) return;
    const timer = setTimeout(() => {
      setIncomingIndentToast(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [incomingIndentToast]);

  const isOffline = state.networkMode === 'OFFLINE';

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-800 flex flex-col transition-all ${
      state.isAlarmActive ? 'border-4 border-[#b91c1c] animate-flash-red' : ''
    }`}>
      {/* 1. Official GovTech Header (Tricolor 6px strip, landmark emblem, bilingual toggle, etc.) */}
      <GovHeader
        handsetVisible={handsetVisible}
        onToggleHandset={handleToggleHandset}
        onLoadDemoScenario={handleLoadDemoScenario}
      />

      {/* 2. Navy Navigation Bar (Navy-900 / #0B2A5B, active tab amber bottom border) */}
      <NavBar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        exceptionsCount={state.exceptions.length}
      />

      {/* Slim Offline Banner while offline */}
      {isOffline && (
        <div id="offline-status-banner" className="bg-amber-500 text-slate-950 font-bold px-4 py-1.5 text-xs text-center flex items-center justify-center gap-2 shadow-xs border-b border-amber-600 animate-in slide-in-from-top-1">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            {isHindi 
              ? 'ऑफ़लाइन - परिवर्तन इस डिवाइस पर सहेजे गए हैं और स्वचालित रूप से सिंक होंगे' 
              : 'Offline - changes saved on this device and will sync automatically'}
          </span>
        </div>
      )}

      {/* 3. Live Compliance Alert Ticker directly under nav bar */}
      <AlertTicker onSelectTab={handleSelectTab} />

      {/* Global Red Flashing Alarm Banner on statutory violation */}
      <GlobalViolationBanner />

      {/* Floating Incoming Indent Cross-Tab Notification Toast */}
      {incomingIndentToast && (
        <aside
          aria-label="New Indent Notification"
          className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-slate-900 text-white rounded-lg p-4 shadow-2xl border-2 border-amber-400 animate-in slide-in-from-bottom-5 duration-300"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500 text-slate-950 rounded-md shrink-0 animate-bounce">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded">
                    {isHindi ? 'नया मांगपत्र' : 'New FPS Indent'}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    {incomingIndentToast.indentNo}
                  </span>
                </div>
                <p className="text-sm font-bold text-white mt-1">
                  {isHindi
                    ? `${incomingIndentToast.fpsCode} से नया मांगपत्र: ${incomingIndentToast.commodity} ${incomingIndentToast.qty} Qtl`
                    : `New indent from ${incomingIndentToast.fpsCode}: ${incomingIndentToast.commodity} ${incomingIndentToast.qty} Qtl`}
                </p>
                <p className="text-xs text-slate-300 mt-0.5">
                  {isHindi
                    ? 'उचित दर दुकान द्वारा ई-मांगपत्र दर्ज किया गया है।'
                    : 'Submitted live from NFSA Fair Price Shop portal via BroadcastChannel.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsChimeMuted(!isChimeMuted)}
                title={isChimeMuted ? 'Unmute alert chime' : 'Mute alert chime'}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                {isChimeMuted ? <BellOff className="h-4 w-4 text-rose-400" /> : <Bell className="h-4 w-4 text-amber-400" />}
              </button>
              <button
                type="button"
                onClick={() => setIncomingIndentToast(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab('indents');
                setIncomingIndentToast(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded shadow transition-colors"
            >
              <span>{isHindi ? 'मांगपत्र देखें व चालान बनाएं' : 'View & Create Challan'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </aside>
      )}

      {/* Main Two-Pane Split Layout (Desktop: 72% Command Center, 28% Handset Simulator) */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 max-w-[1920px] w-full mx-auto p-3 sm:p-4 md:p-5 flex flex-col lg:flex-row gap-4 outline-none"
      >
        {/* Left 72% Godown Command Center */}
        <div className={`transition-all duration-300 flex flex-col gap-4 ${
          handsetVisible ? 'lg:w-[72%] w-full' : 'w-full'
        }`}>
          {/* Tab 1: Dashboard (डैशबोर्ड) */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4">
              <KpiCards />
              <AgeingRadar onNavigateToChallan={handleNavigateToChallan} />
              <StockCharts />
              <BatchTable />
            </div>
          )}

          {/* Tab 2: Stock Receipt (स्टॉक प्राप्ति) */}
          {activeTab === 'receipt' && (
            <div className="space-y-4">
              <StockReceiptView />
              <KpiCards />
            </div>
          )}

          {/* Tab 3: Delivery Challan (डिलीवरी चालान) */}
          {activeTab === 'challan' && (
            <div className="space-y-4">
              <FifoChallanEngine demoTrigger={demoTrigger.value} preFillData={preFillChallanData} />
              <KpiCards />
            </div>
          )}

          {/* Tab 4: Loading Gate Scanner (गेट स्कैनर) */}
          {activeTab === 'scanner' && (
            <div className="space-y-4">
              <GateScanner />
              <KpiCards />
            </div>
          )}

          {/* Tab 5: Stack Bay Locator (स्टैक बे लोकेटर) */}
          {activeTab === 'locator' && (
            <div className="space-y-4">
              <BayGrid compact={false} />
              <KpiCards />
            </div>
          )}

          {/* Tab 6: FPS Indents (FPS मांगपत्र) */}
          {activeTab === 'indents' && (
            <div className="space-y-4">
              <FpsIndentsPanel onPreFillChallan={handlePreFillChallan} />
              <KpiCards />
            </div>
          )}

          {/* Tab 7: Traceability (ट्रेसिबिलिटी लेजर) */}
          {activeTab === 'traceability' && (
            <div className="space-y-4">
              <TraceabilityLog />
              <KpiCards />
            </div>
          )}

          {/* Tab 8: FIFO Exceptions Log (FIFO अपवाद लॉग) */}
          {activeTab === 'exceptions' && (
            <div className="space-y-4">
              <ExceptionsLog />
              <KpiCards />
            </div>
          )}
        </div>

        {/* Right 28% Toggleable Worker Handset Simulator */}
        {handsetVisible && (
          <aside
            id="handset-simulator-pane"
            className="lg:w-[28%] w-full flex flex-col items-center sticky top-28 self-start no-print"
          >
            <div className="w-full flex items-center justify-between mb-2 px-1 text-xs text-slate-600 font-mono">
              <span className="flex items-center gap-1.5 text-slate-800 font-bold">
                <Smartphone className="h-3.5 w-3.5 text-[#0B2A5B]" />
                {t('header.toggleHandset')} (28%)
              </span>
              <span className="text-[10px] text-[#138808] font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                <Radio className="h-3 w-3 animate-pulse" />
                Live ePDS Sync
              </span>
            </div>
            <WorkerSimulator onClose={handleCloseHandset} />
          </aside>
        )}
      </main>

      {/* Official Government Footer */}
      <Footer />
    </div>
  );
}

export default function App() {
  const [demoState, setDemoState] = useState(null);

  const demoTrigger = useMemo(() => ({
    value: demoState,
    set: setDemoState,
  }), [demoState]);

  return (
    <StoreProvider>
      <I18nProvider>
        <BrowserRouter>
          <div className="flex flex-col min-h-screen">
            {/* Slim, prominent Portal Switcher bar at the very top of BOTH portals */}
            <PortalSwitcher />

            {/* Core Application Routes */}
            <div className="flex-1 flex flex-col">
              <Routes>
                {/* Route 1: AnnaSetu Godown Portal */}
                <Route
                  path="/godown"
                  element={<GodownCommandCenter demoTrigger={demoTrigger} />}
                />

                {/* Route 2: NFSA / e-PDS Fair Price Shop & State Monitoring Portal */}
                <Route
                  path="/nfsa-fps"
                  element={<NfsaApp />}
                />

                {/* Root Redirect: "/" redirects to "/godown" */}
                <Route
                  path="/"
                  element={<Navigate to="/godown" replace />}
                />

                {/* Catch-all Redirect */}
                <Route
                  path="*"
                  element={<Navigate to="/godown" replace />}
                />
              </Routes>
            </div>
          </div>
        </BrowserRouter>
      </I18nProvider>
    </StoreProvider>
  );
}
