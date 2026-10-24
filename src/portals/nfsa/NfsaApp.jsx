import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Landmark, Store, ShieldCheck, Layers, FileText, Truck, 
  Globe, UserCheck, RefreshCw, AlertCircle, WifiOff 
} from 'lucide-react';
import { FpsSelector, SEEDED_FPS } from './FpsSelector';
import { StockView } from './StockView';
import { IndentForm } from './IndentForm';
import { ChallanInbox } from './ChallanInbox';
import { VigilancePanel } from './VigilancePanel';
import { apiClient } from '../../services/apiClient';
import { useLiveState } from '../../shared/useLiveState';
import { useI18n } from '../../i18n/I18nContext';

export function NfsaApp() {
  const { isHindi, setLanguage, t } = useI18n();
  const { state, refreshServerState, isConnected } = useLiveState();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialView = searchParams.get('view') || searchParams.get('role');
  const [role, setRole] = useState(initialView?.toUpperCase() === 'DSO' ? 'DSO' : 'DEALER');
  const [selectedFpsCode, setSelectedFpsCode] = useState('FPS-GN-101');
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'indents' | 'challans'
  const [fpsDashboardData, setFpsDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Sync role when searchParams change (e.g. browser back/forward or direct navigation)
  useEffect(() => {
    const v = searchParams.get('view') || searchParams.get('role');
    if (v?.toUpperCase() === 'DSO' && role !== 'DSO') {
      setRole('DSO');
    } else if (v?.toUpperCase() !== 'DSO' && !v && role === 'DSO') {
      // Keep state in sync if cleared
    }
  }, [searchParams]);

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (newRole === 'DSO') {
        next.set('view', 'dso');
      } else {
        next.delete('view');
        next.delete('role');
      }
      return next;
    });
  };

  // Pre-fill state for Indent Form when "Raise Indent" shortcut is clicked in StockView
  const [prefillCommodity, setPrefillCommodity] = useState('Wheat');
  const [prefillQty, setPrefillQty] = useState(50);

  // Load FPS Dashboard
  const loadFpsDashboard = useCallback(async (code) => {
    setIsLoading(true);
    try {
      const data = await apiClient.getFpsDashboard(code);
      setFpsDashboardData(data);
    } catch (err) {
      console.error('Failed to load FPS dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (role === 'DEALER' && selectedFpsCode) {
      loadFpsDashboard(selectedFpsCode);
    }
  }, [role, selectedFpsCode, loadFpsDashboard]);

  // Handle shortcut from StockView
  const handleRaiseIndentShortcut = (comm, qty) => {
    setPrefillCommodity(comm);
    setPrefillQty(qty);
    setActiveTab('indents');
  };

  const isOffline = state.networkMode === 'OFFLINE' || !isConnected;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      {/* 1. Official Government 6px Tricolor Strip */}
      <div className="h-1.5 w-full flex">
        <div className="w-1/3 bg-[#FF9933]" />
        <div className="w-1/3 bg-white" />
        <div className="w-1/3 bg-[#138808]" />
      </div>

      {/* 2. White GovTech Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Logo & Portal Titles */}
          <div className="flex items-center gap-3">
            {/* Placeholder Emblem — replace with an approved asset; do NOT draw or claim the real State Emblem or official branding */}
            <div className="p-2.5 bg-[#0B2A5B] text-amber-400 rounded-lg shadow-xs shrink-0" title="Placeholder Asset">
              <Landmark className="h-7 w-7" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                  {isHindi ? 'खाद्य एवं सार्वजनिक वितरण विभाग • भारत सरकार' : 'Department of Food & Public Distribution • Govt of India'}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                  PROTOTYPE - DEMO DATA
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                {isHindi 
                  ? 'राष्ट्रीय खाद्य सुरक्षा अधिनियम (NFSA) — ई-पीडीएस उचित दर दुकान व सतर्कता पोर्टल'
                  : 'National Food Security Act (NFSA) — e-PDS Fair Price Shop & State Vigilance Portal'}
              </h1>
              <p className="text-xs text-slate-600 hidden sm:block">
                District Gautam Buddha Nagar (Surajpur Godown Zone) • E-PoS Electronic Commodity Receiving
              </p>
            </div>
          </div>

          {/* Controls: Role Selector & Language Toggle */}
          <div className="flex flex-wrap items-center gap-3 self-end md:self-center">
            {/* Demo Role Switcher */}
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Demo role switch - no real authentication
              </span>
              <div className="inline-flex rounded-md border border-slate-300 bg-slate-50 p-0.5 mt-0.5">
                <button
                  type="button"
                  onClick={() => handleRoleChange('DEALER')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition-all ${
                    role === 'DEALER'
                      ? 'bg-[#0B2A5B] text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  <Store className="h-3.5 w-3.5" />
                  <span>{isHindi ? 'दुकानदार (FPS Dealer)' : 'FPS Dealer'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleChange('DSO')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition-all ${
                    role === 'DSO'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>{isHindi ? 'डीएसओ / सतर्कता (DSO / Vigilance)' : 'DSO / Vigilance'}</span>
                </button>
              </div>
            </div>

            {/* Bilingual Language Switcher */}
            <div className="inline-flex rounded-md border border-slate-300 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                  !isHindi ? 'bg-[#0B2A5B] text-white' : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage('hi')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                  isHindi ? 'bg-[#0B2A5B] text-white' : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                हिन्दी
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Offline Banner if unreachable */}
      {isOffline && (
        <div className="bg-amber-500 text-slate-950 font-bold px-4 py-1.5 text-xs text-center flex items-center justify-center gap-2 border-b border-amber-600">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            {isHindi 
              ? 'ऑफ़लाइन - केवल पढ़ने योग्य स्नैपशॉट प्रदर्शित हो रहा है। रसीद सत्यापन हेतु नेटवर्क आवश्यक है।' 
              : 'Offline - read-only snapshot mode. e-PoS delivery receipt confirmation requires active network connection.'}
          </span>
        </div>
      )}

      {/* 3. Navy Navigation Bar (Dealer & DSO Modules) */}
      <nav className="bg-[#0B2A5B] text-white px-4 sm:px-6 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('stock');
              if (role !== 'DEALER') handleRoleChange('DEALER');
            }}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all shrink-0 ${
              role === 'DEALER' && activeTab === 'stock'
                ? 'border-amber-400 text-amber-300 bg-white/5'
                : 'border-transparent text-slate-200 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>{isHindi ? '1. राशन भंडार (Closing Stock)' : '1. Ration Closing Stock'}</span>
            {fpsDashboardData?.totals?.low_stock_count > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-slate-950 font-black">
                {fpsDashboardData.totals.low_stock_count} LOW
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('indents');
              if (role !== 'DEALER') handleRoleChange('DEALER');
            }}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all shrink-0 ${
              role === 'DEALER' && activeTab === 'indents'
                ? 'border-amber-400 text-amber-300 bg-white/5'
                : 'border-transparent text-slate-200 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>{isHindi ? '2. मांग पत्र प्रेषित करें (Raise Indent)' : '2. Raise Commodity Indent'}</span>
            {fpsDashboardData?.totals?.pending_indents_count > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-700 text-white font-mono">
                {fpsDashboardData.totals.pending_indents_count}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('challans');
              if (role !== 'DEALER') handleRoleChange('DEALER');
            }}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all shrink-0 ${
              role === 'DEALER' && activeTab === 'challans'
                ? 'border-amber-400 text-amber-300 bg-white/5'
                : 'border-transparent text-slate-200 hover:text-white hover:bg-white/5'
            }`}
          >
            <Truck className="h-4 w-4" />
            <span>{isHindi ? '3. आवक चालान व ई-पॉस (Delivery Challans)' : '3. Incoming Challans & e-PoS'}</span>
            {fpsDashboardData?.incoming_challans?.length > 0 && (
              <span className="px-2 py-0.2 rounded-full text-[10px] bg-blue-500 text-white font-bold animate-pulse">
                {fpsDashboardData.incoming_challans.length} IN-TRANSIT
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleRoleChange('DSO')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all shrink-0 ${
              role === 'DSO'
                ? 'border-amber-400 text-amber-300 bg-white/5'
                : 'border-transparent text-slate-200 hover:text-white hover:bg-white/5'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>4. {t('nfsa.dsoVigilance')}</span>
          </button>
        </div>
      </nav>

      {/* 4. Main Body Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* If Role is DEALER: FPS Selector & Current Tab */}
        {role === 'DEALER' ? (
          <>
            <FpsSelector
              selectedFpsCode={selectedFpsCode}
              onSelectFps={(code) => setSelectedFpsCode(code)}
              fpsData={fpsDashboardData?.fps}
            />

            {isLoading && !fpsDashboardData ? (
              <div className="bg-white rounded-lg p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-[#0B2A5B]" />
                <span>Loading live store inventory...</span>
              </div>
            ) : (
              <>
                {/* Module 1: Stock View */}
                {activeTab === 'stock' && (
                  <StockView
                    stockList={fpsDashboardData?.stock_inventory || []}
                    onRaiseIndentShortcut={handleRaiseIndentShortcut}
                  />
                )}

                {/* Module 2: Indent Form */}
                {activeTab === 'indents' && (
                  <IndentForm
                    fpsCode={selectedFpsCode}
                    indents={fpsDashboardData?.indents || []}
                    initialCommodity={prefillCommodity}
                    initialQty={prefillQty}
                    onIndentCreated={() => loadFpsDashboard(selectedFpsCode)}
                  />
                )}

                {/* Module 3: Challan Inbox */}
                {activeTab === 'challans' && (
                  <ChallanInbox
                    fpsCode={selectedFpsCode}
                    incomingChallans={fpsDashboardData?.incoming_challans || []}
                    deliveredChallans={fpsDashboardData?.delivered_challans || []}
                    onChallanReceived={() => {
                      loadFpsDashboard(selectedFpsCode);
                      refreshServerState();
                    }}
                  />
                )}
              </>
            )}
          </>
        ) : (
          /* Module 4: DSO and State Vigilance Panel */
          <VigilancePanel />
        )}
      </main>

      {/* 5. GovTech Footer */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 text-xs py-4 px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            {isHindi 
              ? 'खाद्य एवं सार्वजनिक वितरण विभाग, भारत सरकार • ई-पीडीएस पारदर्शिता एवं आपूर्ति शृंखला प्रबंधन'
              : 'Department of Food & Public Distribution, Government of India • e-PDS Transparency & Supply Chain System'}
          </span>
          <span className="font-mono text-[11px] text-slate-500">
            NFSA e-PDS Portal v2.0 • Secured with SHA-256 Token Chains
          </span>
        </div>
      </footer>
    </div>
  );
}
