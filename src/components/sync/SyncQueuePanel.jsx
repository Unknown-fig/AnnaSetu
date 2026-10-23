import React, { useState } from 'react';
import { useStore } from '../../context/store';
import { ACTION_TYPES } from '../../context/actions';
import { useI18n } from '../../i18n/I18nContext';
import { verifyAndSyncQueueItem } from '../../services/syncService';
import { createChainedEventHash } from '../../services/cryptoService';
import { 
  X, 
  RefreshCw, 
  Server, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Copy, 
  Check, 
  PlusCircle, 
  Trash2,
  Database
} from 'lucide-react';

export const SyncQueuePanel = React.memo(function SyncQueuePanel({ onClose }) {
  const { state, dispatch } = useStore();
  const { isHindi } = useI18n();
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'server'
  const [toastMsg, setToastMsg] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const pendingItems = (state.syncQueue || []).filter(i => i.syncStatus === 'PENDING_SYNC');
  const conflictItems = (state.syncQueue || []).filter(i => i.syncStatus === 'CONFLICT');
  const allQueueItems = state.syncQueue || [];
  const serverRecords = state.serverRecords || [];

  const handleCopy = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Perform item-by-item sequential synchronization
  const handleRunSync = async () => {
    if (pendingItems.length === 0 || state.isSyncing) return;

    dispatch({ type: ACTION_TYPES.START_SYNC });

    // Check prefers-reduced-motion
    const prefersReducedMotion = typeof window !== 'undefined' && 
      window.matchMedia && 
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delayMs = prefersReducedMotion ? 0 : 300;

    let syncedCount = 0;
    let conflictCount = 0;

    // Process each pending item sequentially
    for (const item of pendingItems) {
      if (delayMs > 0) {
        await new Promise(r => setTimeout(r, delayMs));
      }

      const syncResult = await verifyAndSyncQueueItem(item, state.serverRecords, state.batches);
      const timestamp = new Date().toISOString();
      const prevHash = state.auditLogs[0]?.hash || '0000000000000000000000000000000000000000000000000000000000000000';

      if (syncResult.status === 'SYNCED') {
        syncedCount++;
        const serverRecord = {
          id: `SRV-${item.id}`,
          originalId: item.id,
          eventType: item.eventType,
          actionType: item.actionType,
          payload: item.payload,
          token: item.token,
          localSeq: item.localSeq,
          serverReceivedAt: syncResult.serverReceivedAt,
          status: 'SYNCED',
        };

        const auditHash = await createChainedEventHash(prevHash, timestamp, 'SYNC_COMPLETED', {
          itemId: item.id,
          token: item.token,
          serverReceivedAt: syncResult.serverReceivedAt,
        });

        const auditLog = {
          id: `EVT-SYNC-${Date.now()}-${syncedCount}`,
          timestamp,
          type: 'SYNC_COMPLETED',
          title: `Central Sync: ${item.eventType} Verified`,
          actor: 'Central iPDS Server Sync Agent',
          details: `Item #${item.id} (Seq #${item.localSeq}) verified cryptographically. Registered at Central Depot.`,
          token: item.token,
          syncStatus: 'SYNCED',
          prevHash,
          hash: auditHash,
        };

        dispatch({
          type: ACTION_TYPES.PROGRESS_SYNC_ITEM,
          payload: {
            syncedItem: syncResult.item,
            status: 'SYNCED',
            serverRecord,
            auditLog,
          },
        });
      } else {
        conflictCount++;
        const auditHash = await createChainedEventHash(prevHash, timestamp, 'SYNC_CONFLICT', {
          itemId: item.id,
          reason: syncResult.reason,
        });

        const auditLog = {
          id: `EVT-CONF-${Date.now()}-${conflictCount}`,
          timestamp,
          type: 'SYNC_CONFLICT',
          title: `Central Sync Conflict: ${item.eventType}`,
          actor: 'Central iPDS Server Sync Agent',
          details: `Conflict detected for #${item.id}: ${syncResult.reason}. Maintained in queue for supervisor resolution.`,
          token: item.token,
          syncStatus: 'CONFLICT',
          prevHash,
          hash: auditHash,
        };

        dispatch({
          type: ACTION_TYPES.PROGRESS_SYNC_ITEM,
          payload: {
            syncedItem: syncResult.item,
            status: 'CONFLICT',
            serverRecord: null,
            auditLog,
          },
        });
      }
    }

    dispatch({ type: ACTION_TYPES.FINISH_SYNC });
    setToastMsg(
      isHindi 
        ? `सिंक पूर्ण: ${syncedCount} सिंक हुए, ${conflictCount} विवाद मिले` 
        : `Sync complete: ${syncedCount} synced, ${conflictCount} conflict(s) detected.`
    );
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleInjectConflict = () => {
    dispatch({ type: ACTION_TYPES.INJECT_SYNC_CONFLICT_DEMO });
    setToastMsg(isHindi ? 'डेमो विरोध आइटम कतार में जोड़ा गया' : 'Conflict demo item injected into sync queue.');
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleClearQueue = () => {
    dispatch({ type: ACTION_TYPES.CLEAR_SYNC_QUEUE });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[#0B2A5B] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm tracking-tight">
                {isHindi ? 'ऑफ़लाइन सिंक कतार और केंद्रीय सर्वर' : 'Offline Sync Queue & Central Server'}
              </h3>
              <p className="text-[11px] text-blue-200">
                {isHindi 
                  ? 'स्थानीय टोकन सत्यापन और केंद्रीय डेटाबेस प्रतिकृति (SIMULATED - demo only)' 
                  : 'Cryptographic offline token queue & Central iPDS replication (SIMULATED - demo only)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Switcher & Action Bar */}
        <div className="px-5 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1 bg-slate-200 p-0.5 rounded-lg">
            <button
              id="tab-sync-queue"
              type="button"
              onClick={() => setActiveTab('queue')}
              className={`px-3 py-1 rounded-md font-bold transition-all ${
                activeTab === 'queue'
                  ? 'bg-white text-[#0B2A5B] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isHindi ? 'सिंक कतार' : 'Sync Queue'} ({allQueueItems.length})
            </button>
            <button
              id="tab-central-server"
              type="button"
              onClick={() => setActiveTab('server')}
              className={`px-3 py-1 rounded-md font-bold transition-all ${
                activeTab === 'server'
                  ? 'bg-white text-[#0B2A5B] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isHindi ? 'केंद्रीय सर्वर रिकॉर्ड' : 'Central Server Records'} ({serverRecords.length})
            </button>
          </div>

          {activeTab === 'queue' && (
            <div className="flex items-center gap-2">
              <button
                id="btn-inject-conflict-demo"
                type="button"
                onClick={handleInjectConflict}
                className="px-2.5 py-1 rounded bg-amber-50 border border-amber-300 text-amber-900 font-bold hover:bg-amber-100 flex items-center gap-1 text-[11px]"
                title="Inject a conflict item to demonstrate collision detection"
              >
                <PlusCircle className="h-3 w-3 text-amber-600" />
                <span>{isHindi ? 'डेमो विरोध जोड़ें' : 'Inject Conflict Demo'}</span>
              </button>

              <button
                id="btn-run-auto-sync"
                type="button"
                disabled={pendingItems.length === 0 || state.isSyncing}
                onClick={handleRunSync}
                className={`px-3 py-1 rounded font-bold flex items-center gap-1 text-[11px] shadow-xs transition-all ${
                  pendingItems.length === 0 || state.isSyncing
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                }`}
              >
                <RefreshCw className={`h-3 w-3 ${state.isSyncing ? 'animate-spin' : ''}`} />
                <span>{isHindi ? 'सिंक चलाएं' : 'Run Auto-Sync'} ({pendingItems.length})</span>
              </button>

              {allQueueItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearQueue}
                  className="p-1 text-slate-400 hover:text-red-600"
                  title="Clear Queue"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Progress Bar during Sync */}
        {state.isSyncing && (
          <div className="px-5 py-2 bg-blue-50 border-b border-blue-200">
            <div className="flex items-center justify-between text-[11px] font-mono text-blue-900 mb-1">
              <span>{isHindi ? 'सर्वर से सिंक हो रहा है...' : 'Syncing with Central iPDS Server...'}</span>
              <span>{state.syncProgress.current} / {state.syncProgress.total}</span>
            </div>
            <div className="w-full bg-blue-200 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-blue-700 h-full transition-all duration-300"
                style={{ 
                  width: `${state.syncProgress.total > 0 ? (state.syncProgress.current / state.syncProgress.total) * 100 : 0}%` 
                }}
              />
            </div>
          </div>
        )}

        {/* Toast Summary */}
        {toastMsg && (
          <div className="px-5 py-2 bg-emerald-100 border-b border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-1.5 animate-in slide-in-from-top-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Main Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3">
          {activeTab === 'queue' ? (
            allQueueItems.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-mono text-xs">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2 opacity-60" />
                <div>{isHindi ? 'कतार खाली है। कोई लंबित ऑफ़लाइन कार्य नहीं।' : 'Sync queue is clear. No pending offline operations.'}</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {isHindi 
                    ? 'ऑफ़लाइन मोड में बनाए गए चालान, रसीदें और डिस्पैच यहां स्वतः कतारबद्ध होते हैं।' 
                    : 'Challans, receipts, and dispatches created while offline auto-queue here.'}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {allQueueItems.map((item, idx) => {
                  const isConflict = item.syncStatus === 'CONFLICT';
                  const isSynced = item.syncStatus === 'SYNCED';
                  const isPending = item.syncStatus === 'PENDING_SYNC';

                  return (
                    <div
                      key={item.id || idx}
                      className={`p-3 rounded-lg border text-xs transition-all ${
                        isConflict
                          ? 'bg-red-50/70 border-red-300 text-red-950'
                          : isSynced
                          ? 'bg-emerald-50/40 border-emerald-200 text-slate-800'
                          : 'bg-amber-50/50 border-amber-300 text-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono text-[11px] mb-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 text-[10px]">
                            #{item.localSeq || (idx + 1)}
                          </span>
                          <span className="text-[#0B2A5B]">{item.eventType || item.actionType}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            isConflict
                              ? 'bg-red-100 text-red-800 border border-red-300'
                              : isSynced
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}>
                            {item.syncStatus}
                          </span>
                        </div>
                      </div>

                      {/* Content Summary */}
                      <div className="text-[11px] text-slate-700 flex flex-wrap items-center justify-between gap-1">
                        <div>
                          <span>Time: {new Date(item.occurredAt || item.recordedAt).toLocaleTimeString()}</span>
                          {item.payload?.challan?.challanNo && (
                            <span className="ml-2 font-mono font-semibold text-slate-900">
                              {item.payload.challan.challanNo} ({item.payload.challan.commodity} - {item.payload.challan.requestedQty} Qtl)
                            </span>
                          )}
                          {item.payload?.challanNo && (
                            <span className="ml-2 font-mono font-semibold text-slate-900">
                              {item.payload.challanNo} ({item.payload.commodity} - {item.payload.requestedQty} Qtl)
                            </span>
                          )}
                          {item.payload?.batch && (
                            <span className="ml-2 font-mono font-semibold text-slate-900">
                              Receipt #{item.payload.batch.batchId} ({item.payload.batch.commodity} - {item.payload.batch.qtyReceivedQtl} Qtl)
                            </span>
                          )}
                        </div>

                        {/* Token Prefix */}
                        {item.token && (
                          <div className="flex items-center gap-1 font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200">
                            <span className="text-slate-400">Token:</span>
                            <span className="font-bold text-slate-800">
                              {item.token.substring(0, 16).toUpperCase()}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.token, item.id)}
                              className="text-slate-400 hover:text-slate-700 ml-1"
                              title="Copy full token"
                            >
                              {copiedId === item.id ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Conflict resolution note */}
                      {isConflict && (
                        <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-[11px] text-red-900 flex items-start gap-1.5 font-sans">
                          <AlertTriangle className="h-4 w-4 text-red-700 shrink-0 mt-0.5" />
                          <div>
                            <strong>{isHindi ? 'सिंक विरोध' : 'Sync Conflict'}: </strong>
                            <span>{item.conflictReason || 'Inventory collision or batch already dispatched by another godown node.'}</span>
                            <div className="text-[10px] text-red-700 mt-0.5 italic">
                              {isHindi 
                                ? 'यह आइटम खोया नहीं है। स्थानीय रिकॉर्ड सुरक्षित है और समीक्षा के लिए चिन्हित है।' 
                                : 'Record preserved for audit trail. Manual supervisor reconciliation required.'}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            // Central Server Records
            serverRecords.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-mono text-xs">
                <Database className="h-8 w-8 text-slate-400 mx-auto mb-2 opacity-50" />
                <div>{isHindi ? 'केंद्रीय सर्वर पर अभी तक कोई सिंक रिकॉर्ड नहीं है।' : 'No records received on Central Server yet.'}</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {isHindi 
                    ? 'ऑफ़लाइन कतार से सिंक चलाएं ताकि रिकॉर्ड केंद्रीय डेटाबेस में दर्ज हों।' 
                    : 'Run auto-sync from the offline queue to replicate transactions here.'}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900 font-mono flex items-center justify-between">
                  <span>CENTRAL iPDS REPLICATION NODE: surajpur-cluster-up01</span>
                  <span className="font-bold text-emerald-800">CONNECTED (SIMULATED)</span>
                </div>
                {serverRecords.map((rec, idx) => (
                  <div
                    key={rec.id || idx}
                    className="p-3 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-900">
                        {rec.id} • {rec.eventType}
                      </span>
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px]">
                        RECEIVED & VERIFIED
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 flex items-center justify-between">
                      <span>Server Received At: <strong>{new Date(rec.serverReceivedAt).toLocaleString()}</strong></span>
                      {rec.token && (
                        <span>Token: <strong>{rec.token.substring(0, 16).toUpperCase()}</strong></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="text-slate-500 font-mono text-[11px]">
            Device ID: <strong className="text-slate-800">{state.deviceId}</strong> • Local Seq: <strong className="text-slate-800">#{state.localSeq}</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs"
          >
            {isHindi ? 'बंद करें' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
});
