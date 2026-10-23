import React, { useState } from 'react';
import { useStore } from '../../context/store';
import { ACTION_TYPES } from '../../context/actions';
import { useI18n } from '../../i18n/I18nContext';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { SyncQueuePanel } from '../sync/SyncQueuePanel';

export const NetworkSwitch = React.memo(function NetworkSwitch() {
  const { state, dispatch } = useStore();
  const { t, isHindi } = useI18n();
  const [showSyncModal, setShowSyncModal] = useState(false);

  const isOffline = state.networkMode === 'OFFLINE';
  const pendingCount = (state.syncQueue || []).filter(i => i.syncStatus === 'PENDING_SYNC').length;

  const handleToggle = () => {
    const nextMode = isOffline ? 'ONLINE' : 'OFFLINE';
    dispatch({
      type: ACTION_TYPES.SET_NETWORK_MODE,
      payload: nextMode,
    });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Network Mode Pill */}
        <button
          id="btn-network-toggle"
          type="button"
          onClick={handleToggle}
          title={isOffline ? 'Switch to Online (Auto-Sync)' : 'Simulate Offline Godown'}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all shadow-xs border ${
            isOffline
              ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-400 ring-2 ring-amber-300/40'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500'
          }`}
        >
          {isOffline ? (
            <>
              <WifiOff className="h-3.5 w-3.5 animate-pulse" />
              <span>{isHindi ? 'नेटवर्क: ऑफ़लाइन' : 'Network: OFFLINE'}</span>
            </>
          ) : (
            <>
              <Wifi className="h-3.5 w-3.5" />
              <span>{isHindi ? 'नेटवर्क: ऑनलाइन' : 'Network: ONLINE'}</span>
            </>
          )}
        </button>

        {/* Pending Sync Badge Button */}
        <button
          id="btn-sync-queue-modal"
          type="button"
          onClick={() => setShowSyncModal(true)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border transition-all ${
            pendingCount > 0
              ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
          }`}
          title="Open Sync Queue & Central Server Drawer"
        >
          <RefreshCw className={`h-3 w-3 ${state.isSyncing ? 'animate-spin text-amber-600' : ''}`} />
          <span>{isHindi ? 'लंबित सिंक' : 'Pending sync'}:</span>
          <strong className={`font-bold ${pendingCount > 0 ? 'text-amber-700' : 'text-slate-200'}`}>
            {pendingCount}
          </strong>
        </button>
      </div>

      {showSyncModal && (
        <SyncQueuePanel onClose={() => setShowSyncModal(false)} />
      )}
    </>
  );
});
