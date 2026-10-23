import React, { useState } from 'react';
import { useStore } from '../../context/store';
import { useI18n } from '../../i18n/I18nContext';
import { IntegrityBar } from './IntegrityBar';
import { LedgerTable } from './LedgerTable';
import { BatchJourney } from './BatchJourney';
import { FpsView } from './FpsView';
import { RecallTrace } from './RecallTrace';
import { FlowSankey } from './FlowSankey';
import { 
  Database, 
  Layers, 
  Route, 
  Store, 
  ShieldAlert, 
  Activity,
  Workflow
} from 'lucide-react';

export const TraceabilityLog = React.memo(function TraceabilityLog() {
  const { state } = useStore();
  const { isHindi } = useI18n();
  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' | 'journey' | 'fps' | 'recall' | 'flow'

  return (
    <div className="space-y-6">
      {/* Top Header & Hash Chain Integrity Engine */}
      <IntegrityBar />

      {/* View Switcher Tabs */}
      <div className="bg-white border border-slate-300 rounded-xl p-2 shadow-xs flex flex-wrap items-center gap-1.5 text-xs font-bold">
        <button
          id="tab-traceability-timeline"
          type="button"
          onClick={() => setActiveTab('timeline')}
          className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
            activeTab === 'timeline'
              ? 'bg-[#0B2A5B] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>{isHindi ? '1. समयरेखा लेजर' : '1. Timeline Ledger'}</span>
        </button>

        <button
          id="tab-traceability-journey"
          type="button"
          onClick={() => setActiveTab('journey')}
          className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
            activeTab === 'journey'
              ? 'bg-[#0B2A5B] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Route className="h-4 w-4" />
          <span>{isHindi ? '2. बैच जीवनचक्र यात्रा' : '2. Batch Journey'}</span>
        </button>

        <button
          id="tab-traceability-fps"
          type="button"
          onClick={() => setActiveTab('fps')}
          className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
            activeTab === 'fps'
              ? 'bg-[#0B2A5B] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Store className="h-4 w-4" />
          <span>{isHindi ? '3. कोटेदार (FPS) दृश्य' : '3. FPS View'}</span>
        </button>

        <button
          id="tab-traceability-recall"
          type="button"
          onClick={() => setActiveTab('recall')}
          className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
            activeTab === 'recall'
              ? 'bg-red-700 text-white shadow-xs'
              : 'text-red-700 hover:text-red-900 hover:bg-red-50'
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          <span>{isHindi ? '4. बैच रिकॉल ट्रेस' : '4. Recall Trace'}</span>
        </button>

        <button
          id="tab-traceability-flow"
          type="button"
          onClick={() => setActiveTab('flow')}
          className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
            activeTab === 'flow'
              ? 'bg-[#0B2A5B] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Workflow className="h-4 w-4" />
          <span>{isHindi ? '5. आपूर्ति प्रवाह (Sankey)' : '5. Supply Flow'}</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'timeline' && <LedgerTable />}
        {activeTab === 'journey' && <BatchJourney />}
        {activeTab === 'fps' && <FpsView />}
        {activeTab === 'recall' && <RecallTrace />}
        {activeTab === 'flow' && <FlowSankey />}
      </div>
    </div>
  );
});
