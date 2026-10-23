import React, { createContext, useContext, useReducer, useEffect, useRef, useMemo, useCallback } from 'react';
import { ACTION_TYPES } from './actions';
import { createSeedBatches, createSeedAuditLogs } from './seedData';
import { round2 } from '../types/models';
import { getOrCreateDeviceId } from '../services/offlineService';
import { apiClient } from '../services/apiClient';

const STORAGE_KEY = 'annasetu_pds_state_v6';
const SERVER_STORAGE_KEY = 'annasetu_central_server_v6';
const MAX_PERSISTED_LOGS = 100;
const MAX_IN_MEMORY_LOGS = 200;

const StoreContext = createContext(null);

function getInitialState() {
  const deviceId = getOrCreateDeviceId();
  let serverRecords = [];
  try {
    const sSaved = localStorage.getItem(SERVER_STORAGE_KEY);
    if (sSaved) serverRecords = JSON.parse(sSaved);
  } catch (e) {
    serverRecords = [];
  }

  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.batches && parsed.batches.length > 0) {
          const safeBatches = parsed.batches.map(b => ({
            ...b,
            stackPosition: b.stackPosition !== undefined ? b.stackPosition : 0,
          }));
          return {
            ...parsed,
            batches: safeBatches,
            challans: Array.isArray(parsed.challans) ? parsed.challans : [],
            challanCounter: Number(parsed.challanCounter) || 1,
            approvals: Array.isArray(parsed.approvals) ? parsed.approvals : [],
            auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs.slice(0, MAX_PERSISTED_LOGS) : [],
            isAlarmActive: false,
            activeViolationAlert: null,
            mobileScanResult: { type: 'idle' },
            isTamperedForTest: false,
            // Phase 4 fields
            networkMode: parsed.networkMode || 'ONLINE',
            deviceId: parsed.deviceId || deviceId,
            localSeq: Number(parsed.localSeq) || 1,
            prevTokenHash: parsed.prevTokenHash || '0000000000000000000000000000000000000000000000000000000000000000',
            syncQueue: Array.isArray(parsed.syncQueue) ? parsed.syncQueue : [],
            serverRecords: Array.isArray(serverRecords) ? serverRecords : [],
            voiceLog: Array.isArray(parsed.voiceLog) ? parsed.voiceLog : [],
            scanLog: Array.isArray(parsed.scanLog) ? parsed.scanLog : [],
            isSyncing: false,
            syncProgress: { current: 0, total: 0 },
            tamperedLogIndex: null,
            originalAuditLogs: null,
            // Real Backend fields
            backendConnected: false,
            isLoading: false,
            fpsIndents: [],
            serverKpis: null,
          };
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved state from localStorage:', e);
    }
  }

  const initialBatches = createSeedBatches();
  const initialAuditLogs = createSeedAuditLogs(initialBatches);

  return {
    batches: initialBatches,
    challans: [],
    challanCounter: 1,
    activeChallan: null,
    approvals: [],
    auditLogs: initialAuditLogs,
    exceptions: [],
    stats: {
      totalDispatches: 10,
      compliantDispatches: 10,
      blockedViolations: 0,
      approvedExceptions: 0,
    },
    isAlarmActive: false,
    activeViolationAlert: null,
    mobileScanResult: { type: 'idle' },
    isTamperedForTest: false,
    // Phase 4 initial fields
    networkMode: 'ONLINE',
    deviceId,
    localSeq: 1,
    prevTokenHash: '0000000000000000000000000000000000000000000000000000000000000000',
    syncQueue: [],
    serverRecords: [],
    voiceLog: [],
    scanLog: [],
    isSyncing: false,
    syncProgress: { current: 0, total: 0 },
    tamperedLogIndex: null,
    originalAuditLogs: null,
    backendConnected: false,
    isLoading: false,
    fpsIndents: [],
    serverKpis: null,
  };
}

function storeReducer(state, action) {
  switch (action.type) {
    case ACTION_TYPES.RESET_DEMO_DATA: {
      const freshBatches = createSeedBatches();
      const freshLogs = createSeedAuditLogs(freshBatches);
      try {
        localStorage.removeItem(SERVER_STORAGE_KEY);
      } catch (e) {}

      return {
        batches: freshBatches,
        challans: [],
        challanCounter: 1,
        activeChallan: null,
        approvals: [],
        auditLogs: freshLogs,
        exceptions: [],
        stats: {
          totalDispatches: 10,
          compliantDispatches: 10,
          blockedViolations: 0,
          approvedExceptions: 0,
        },
        isAlarmActive: false,
        activeViolationAlert: null,
        mobileScanResult: { type: 'idle', message: 'Demo data reset with relative dates.' },
        isTamperedForTest: false,
        // Phase 4 resets
        networkMode: 'ONLINE',
        deviceId: state.deviceId || getOrCreateDeviceId(),
        localSeq: 1,
        prevTokenHash: '0000000000000000000000000000000000000000000000000000000000000000',
        syncQueue: [],
        serverRecords: [],
        voiceLog: [],
        scanLog: [],
        isSyncing: false,
        syncProgress: { current: 0, total: 0 },
        tamperedLogIndex: null,
        originalAuditLogs: null,
      };
    }

    case ACTION_TYPES.RECEIVE_STOCK: {
      const { batch, auditLog } = action.payload;
      let newQueue = state.syncQueue;
      if (state.networkMode === 'OFFLINE') {
        const queueItem = {
          id: `sync-rcv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          actionType: 'RECEIVE_STOCK',
          eventType: 'STOCK_RECEIPT',
          payload: { batch },
          token: batch.sha256Hash || 'OFFL-RCV-TOK',
          localSeq: state.localSeq,
          syncStatus: 'PENDING_SYNC',
          occurredAt: new Date().toISOString(),
          recordedAt: new Date().toISOString(),
        };
        newQueue = [queueItem, ...state.syncQueue];
      }

      return {
        ...state,
        batches: [batch, ...state.batches],
        auditLogs: [auditLog, ...state.auditLogs].slice(0, MAX_IN_MEMORY_LOGS),
        syncQueue: newQueue,
        localSeq: state.networkMode === 'OFFLINE' ? state.localSeq + 1 : state.localSeq,
      };
    }

    case ACTION_TYPES.STAGE_CHALLAN: {
      const stagedChallan = {
        ...action.payload,
        status: 'STAGED',
        reservedBatches: (action.payload.allocations || []).map(a => ({
          batchId: a.batchId,
          qty: round2(a.take),
        })),
        deviceId: action.payload.deviceId || state.deviceId,
        localSeq: action.payload.localSeq || state.localSeq,
        prevTokenHash: action.payload.prevTokenHash || state.prevTokenHash,
      };

      const existingFiltered = state.challans.filter(c => c.challanNo !== stagedChallan.challanNo);

      let newQueue = state.syncQueue;
      if (state.networkMode === 'OFFLINE') {
        const queueItem = {
          id: `sync-stg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          actionType: 'STAGE_CHALLAN',
          eventType: 'CHALLAN_STAGED',
          payload: stagedChallan,
          token: stagedChallan.offlineToken || stagedChallan.hash,
          tokenPayload: {
            challanNo: stagedChallan.challanNo,
            fps: stagedChallan.fps,
            commodity: stagedChallan.commodity,
            requestedQty: stagedChallan.requestedQty,
            allocations: stagedChallan.allocations,
            issuedAt: stagedChallan.issuedAt,
            deviceId: stagedChallan.deviceId,
            localSeq: stagedChallan.localSeq,
            prevTokenHash: stagedChallan.prevTokenHash,
          },
          localSeq: stagedChallan.localSeq,
          syncStatus: 'PENDING_SYNC',
          occurredAt: stagedChallan.stagedAt || new Date().toISOString(),
          recordedAt: new Date().toISOString(),
        };
        newQueue = [queueItem, ...state.syncQueue];
      }

      // Add OFFLINE_TOKEN_ISSUED audit log if token exists
      let updatedLogs = state.auditLogs;
      if (stagedChallan.offlineToken) {
        const tokenLog = {
          id: `EVT-TOK-${stagedChallan.challanNo}`,
          timestamp: stagedChallan.stagedAt || new Date().toISOString(),
          type: 'OFFLINE_TOKEN_ISSUED',
          title: `Offline Token Issued: ${stagedChallan.challanNo}`,
          actor: 'Terminal Security Engine',
          details: `Cryptographic Token: ${stagedChallan.offlineToken.substring(0, 16).toUpperCase()} (Seq #${stagedChallan.localSeq}, Device ${stagedChallan.deviceId})`,
          challanNo: stagedChallan.challanNo,
          token: stagedChallan.offlineToken,
          commodity: stagedChallan.commodity,
          quantity: stagedChallan.requestedQty,
          fpsName: stagedChallan.fps?.name || stagedChallan.fps,
          syncStatus: state.networkMode === 'OFFLINE' ? 'PENDING_SYNC' : 'SYNCED',
          prevHash: state.auditLogs[0]?.hash || '0000000000000000000000000000000000000000000000000000000000000000',
          hash: stagedChallan.offlineToken,
        };
        updatedLogs = [tokenLog, ...state.auditLogs].slice(0, MAX_IN_MEMORY_LOGS);
      }

      return {
        ...state,
        activeChallan: stagedChallan,
        challans: [stagedChallan, ...existingFiltered],
        challanCounter: state.challanCounter + 1,
        localSeq: state.localSeq + 1,
        prevTokenHash: stagedChallan.offlineToken || state.prevTokenHash,
        auditLogs: updatedLogs,
        syncQueue: newQueue,
        mobileScanResult: { type: 'idle' },
        isAlarmActive: false,
        activeViolationAlert: null,
        isTamperedForTest: false,
      };
    }

    case ACTION_TYPES.CONFIRM_PICKING_SUCCESS: {
      if (!state.activeChallan) return state;

      const { allocations, isManualOverride } = state.activeChallan;
      const allocationMap = new Map();
      allocations.forEach(a => {
        allocationMap.set(a.batchId, round2((allocationMap.get(a.batchId) || 0) + a.take));
      });

      const updatedBatches = state.batches.map(batch => {
        if (allocationMap.has(batch.batchId)) {
          const takeQty = allocationMap.get(batch.batchId);
          const newRemaining = Math.max(0, round2(batch.remainingQtl - takeQty));
          return {
            ...batch,
            remainingQtl: newRemaining,
          };
        }
        return batch;
      });

      const { auditLog } = action.payload;

      const fulfilledChallan = {
        ...state.activeChallan,
        status: 'DISPATCHED',
        fulfilledAt: new Date().toISOString(),
        reservedBatches: [],
      };

      const updatedChallans = state.challans.map(c => 
        c.challanNo === fulfilledChallan.challanNo ? fulfilledChallan : c
      );

      let newQueue = state.syncQueue;
      if (state.networkMode === 'OFFLINE') {
        const queueItem = {
          id: `sync-dsp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          actionType: 'CONFIRM_PICKING_SUCCESS',
          eventType: 'DISPATCH_COMPLETED',
          payload: { challan: fulfilledChallan },
          token: fulfilledChallan.offlineToken || fulfilledChallan.hash,
          localSeq: state.localSeq,
          syncStatus: 'PENDING_SYNC',
          occurredAt: fulfilledChallan.fulfilledAt,
          recordedAt: new Date().toISOString(),
        };
        newQueue = [queueItem, ...state.syncQueue];
      }

      return {
        ...state,
        batches: updatedBatches,
        challans: updatedChallans,
        activeChallan: fulfilledChallan,
        auditLogs: [auditLog, ...state.auditLogs].slice(0, MAX_IN_MEMORY_LOGS),
        syncQueue: newQueue,
        localSeq: state.networkMode === 'OFFLINE' ? state.localSeq + 1 : state.localSeq,
        stats: {
          ...state.stats,
          totalDispatches: state.stats.totalDispatches + 1,
          compliantDispatches: state.stats.compliantDispatches + (isManualOverride ? 0 : 1),
        },
        mobileScanResult: {
          type: 'success',
          message: `FIFO Verified: ${state.activeChallan.commodity} dispatched to ${state.activeChallan.fps.name}`,
          timestamp: Date.now(),
        },
        isAlarmActive: false,
        activeViolationAlert: null,
        isTamperedForTest: false,
      };
    }

    case ACTION_TYPES.TRIGGER_SCAN_VIOLATION: {
      const { auditLog, message, scannedBatchId, expectedBatchId } = action.payload;
      let newQueue = state.syncQueue;
      if (state.networkMode === 'OFFLINE') {
        const queueItem = {
          id: `sync-err-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          actionType: 'TRIGGER_SCAN_VIOLATION',
          eventType: 'SCAN_REJECTED',
          payload: { scannedBatchId, expectedBatchId, message },
          token: auditLog?.hash || 'OFFL-ERR-TOK',
          localSeq: state.localSeq,
          syncStatus: 'PENDING_SYNC',
          occurredAt: new Date().toISOString(),
          recordedAt: new Date().toISOString(),
        };
        newQueue = [queueItem, ...state.syncQueue];
      }

      return {
        ...state,
        isAlarmActive: true,
        activeViolationAlert: {
          title: 'CRITICAL FIFO MISMATCH DETECTED',
          message,
          scannedBatchId,
          expectedBatchId,
          timestamp: Date.now(),
        },
        mobileScanResult: {
          type: 'violation',
          message,
          timestamp: Date.now(),
        },
        stats: {
          ...state.stats,
          blockedViolations: state.stats.blockedViolations + 1,
        },
        auditLogs: [auditLog, ...state.auditLogs].slice(0, MAX_IN_MEMORY_LOGS),
        syncQueue: newQueue,
        localSeq: state.networkMode === 'OFFLINE' ? state.localSeq + 1 : state.localSeq,
      };
    }

    case ACTION_TYPES.CLEAR_VIOLATION_ALERT: {
      return {
        ...state,
        isAlarmActive: false,
        activeViolationAlert: null,
      };
    }

    case ACTION_TYPES.SUBMIT_EXCEPTION_OVERRIDE: {
      const { exception, auditLog } = action.payload;
      let newQueue = state.syncQueue;
      if (state.networkMode === 'OFFLINE') {
        const queueItem = {
          id: `sync-exp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          actionType: 'SUBMIT_EXCEPTION_OVERRIDE',
          eventType: 'EXCEPTION_OVERRIDE',
          payload: { exception },
          token: auditLog?.hash || 'OFFL-EXP-TOK',
          localSeq: state.localSeq,
          syncStatus: 'PENDING_SYNC',
          occurredAt: new Date().toISOString(),
          recordedAt: new Date().toISOString(),
        };
        newQueue = [queueItem, ...state.syncQueue];
      }

      return {
        ...state,
        exceptions: [exception, ...state.exceptions],
        auditLogs: [auditLog, ...state.auditLogs].slice(0, MAX_IN_MEMORY_LOGS),
        syncQueue: newQueue,
        localSeq: state.networkMode === 'OFFLINE' ? state.localSeq + 1 : state.localSeq,
        stats: {
          ...state.stats,
          approvedExceptions: state.stats.approvedExceptions + 1,
        },
        isAlarmActive: false,
        activeViolationAlert: null,
      };
    }

    case ACTION_TYPES.CANCEL_CHALLAN: {
      if (!state.activeChallan) {
        return {
          ...state,
          activeChallan: null,
          mobileScanResult: { type: 'idle' },
          isAlarmActive: false,
          activeViolationAlert: null,
          isTamperedForTest: false,
        };
      }

      const updatedChallans = state.challans.map(c => 
        c.challanNo === state.activeChallan.challanNo
          ? { ...c, status: 'CANCELLED', reservedBatches: [] }
          : c
      );

      return {
        ...state,
        activeChallan: null,
        challans: updatedChallans,
        mobileScanResult: { type: 'idle' },
        isAlarmActive: false,
        activeViolationAlert: null,
        isTamperedForTest: false,
      };
    }

    case ACTION_TYPES.DISMISS_MOBILE_FEEDBACK: {
      return {
        ...state,
        isAlarmActive: false,
        mobileScanResult: { type: 'idle' },
      };
    }

    case ACTION_TYPES.ADVANCE_PICKING_STEP: {
      if (!state.activeChallan) return state;
      return {
        ...state,
        activeChallan: {
          ...state.activeChallan,
          currentStepIndex: (state.activeChallan.currentStepIndex || 0) + 1,
        },
      };
    }

    // Phase 3 OTP & Security Handlers
    case ACTION_TYPES.CREATE_OTP_REQUEST: {
      const { request, auditLog } = action.payload;
      const updatedApprovals = [
        request,
        ...state.approvals.filter(a => a.requestId !== request.requestId),
      ];
      return {
        ...state,
        approvals: updatedApprovals,
        auditLogs: auditLog ? [auditLog, ...state.auditLogs].slice(0, MAX_IN_MEMORY_LOGS) : state.auditLogs,
      };
    }

    case ACTION_TYPES.APPROVE_OTP_ROLE: {
      const { requestId, approverId } = action.payload;
      const updatedApprovals = state.approvals.map(req => {
        if (req.requestId !== requestId) return req;
        return {
          ...req,
          approvers: req.approvers.map(app => 
            app.id === approverId ? { ...app, isRevealed: true } : app
          ),
        };
      });
      return {
        ...state,
        approvals: updatedApprovals,
      };
    }

    case ACTION_TYPES.REJECT_OTP_ROLE: {
      const { requestId, auditLog } = action.payload;
      const updatedApprovals = state.approvals.map(req => {
        if (req.requestId !== requestId) return req;
        return {
          ...req,
          isRejected: true,
        };
      });
      return {
        ...state,
        approvals: updatedApprovals,
        auditLogs: auditLog ? [auditLog, ...state.auditLogs].slice(0, MAX_IN_MEMORY_LOGS) : state.auditLogs,
      };
    }

    case ACTION_TYPES.RECORD_OTP_FAILED_ATTEMPT: {
      const { requestId, auditLog, isLockout, lockoutUntil } = action.payload;
      const updatedApprovals = state.approvals.map(req => {
        if (req.requestId !== requestId) return req;
        const attempts = (req.failedAttempts || 0) + 1;
        return {
          ...req,
          failedAttempts: attempts,
          lockoutUntil: isLockout ? lockoutUntil : req.lockoutUntil,
        };
      });
      return {
        ...state,
        approvals: updatedApprovals,
        auditLogs: auditLog ? [auditLog, ...state.auditLogs].slice(0, MAX_IN_MEMORY_LOGS) : state.auditLogs,
      };
    }

    case ACTION_TYPES.RECORD_OTP_SUCCESS: {
      const { requestId, approverId, auditLog } = action.payload;
      const updatedApprovals = state.approvals.map(req => {
        if (req.requestId !== requestId) return req;
        const updatedApprovers = req.approvers.map(app => 
          app.id === approverId ? { ...app, isVerified: true } : app
        );
        const allVerified = updatedApprovers.every(app => app.isVerified);
        return {
          ...req,
          isVerified: allVerified,
          approvers: updatedApprovers,
        };
      });
      return {
        ...state,
        approvals: updatedApprovals,
        auditLogs: auditLog ? [auditLog, ...state.auditLogs].slice(0, MAX_IN_MEMORY_LOGS) : state.auditLogs,
      };
    }

    case ACTION_TYPES.RESET_OTP_LOCKOUT: {
      const { requestId } = action.payload;
      const updatedApprovals = state.approvals.map(req => {
        if (req.requestId !== requestId) return req;
        return {
          ...req,
          failedAttempts: 0,
          lockoutUntil: null,
        };
      });
      return {
        ...state,
        approvals: updatedApprovals,
      };
    }

    case ACTION_TYPES.TAMPER_CHALLAN_FOR_TEST: {
      const { isTampered } = action.payload;
      if (!state.activeChallan) return state;

      if (isTampered) {
        const alteredAllocations = state.activeChallan.allocations.map((a, i) => 
          i === 0 ? { ...a, take: round2(a.take + 5) } : a
        );
        return {
          ...state,
          isTamperedForTest: true,
          activeChallan: {
            ...state.activeChallan,
            allocations: alteredAllocations,
            requestedQty: round2(state.activeChallan.requestedQty + 5),
          },
        };
      } else {
        const genuine = state.challans.find(c => c.challanNo === state.activeChallan.challanNo);
        return {
          ...state,
          isTamperedForTest: false,
          activeChallan: genuine || state.activeChallan,
        };
      }
    }

    // ==========================================
    // Phase 4 Reducer Cases
    // ==========================================
    case ACTION_TYPES.SET_NETWORK_MODE: {
      return {
        ...state,
        networkMode: action.payload,
      };
    }

    case ACTION_TYPES.ENQUEUE_SYNC_ACTION: {
      return {
        ...state,
        syncQueue: [action.payload, ...state.syncQueue],
      };
    }

    case ACTION_TYPES.START_SYNC: {
      const pendingCount = state.syncQueue.filter(i => i.syncStatus === 'PENDING_SYNC').length;
      return {
        ...state,
        isSyncing: true,
        syncProgress: { current: 0, total: pendingCount },
      };
    }

    case ACTION_TYPES.PROGRESS_SYNC_ITEM: {
      const { syncedItem, status, serverRecord, auditLog } = action.payload;
      const updatedQueue = state.syncQueue.map(item => 
        item.id === syncedItem.id ? { ...item, ...syncedItem, syncStatus: status } : item
      );

      let updatedServerRecords = state.serverRecords;
      if (serverRecord) {
        updatedServerRecords = [serverRecord, ...state.serverRecords];
        try {
          localStorage.setItem(SERVER_STORAGE_KEY, JSON.stringify(updatedServerRecords));
        } catch (e) {}
      }

      let updatedLogs = state.auditLogs;
      if (auditLog) {
        updatedLogs = [auditLog, ...state.auditLogs].slice(0, MAX_IN_MEMORY_LOGS);
      }

      return {
        ...state,
        syncQueue: updatedQueue,
        serverRecords: updatedServerRecords,
        auditLogs: updatedLogs,
        syncProgress: {
          ...state.syncProgress,
          current: Math.min(state.syncProgress.total, state.syncProgress.current + 1),
        },
      };
    }

    case ACTION_TYPES.FINISH_SYNC: {
      return {
        ...state,
        isSyncing: false,
      };
    }

    case ACTION_TYPES.CLEAR_SYNC_QUEUE: {
      return {
        ...state,
        syncQueue: [],
      };
    }

    case ACTION_TYPES.INJECT_SYNC_CONFLICT_DEMO: {
      // Injects a deliberate conflicting action into the syncQueue for demonstration
      const conflictItem = {
        id: `sync-conflict-${Date.now()}`,
        actionType: 'CONFIRM_PICKING_SUCCESS',
        eventType: 'DISPATCH_COMPLETED',
        forceConflict: true,
        payload: {
          challan: {
            challanNo: 'GBN-iPDS-2026-CONFLICT-DEMO',
            commodity: 'Rice',
            requestedQty: 40,
            fps: { id: 'FPS-GN-101', name: 'Kasna Village Market' },
            allocations: [{ batchId: 'RC-101', bay: 'B1', take: 40 }],
          },
        },
        token: 'E9F1A402D8B3C567',
        localSeq: state.localSeq,
        syncStatus: 'PENDING_SYNC',
        occurredAt: new Date().toISOString(),
        recordedAt: new Date().toISOString(),
        conflictReason: 'Batch #RC-101 already depleted by concurrent central dispatch',
      };
      return {
        ...state,
        syncQueue: [conflictItem, ...state.syncQueue],
      };
    }

    case ACTION_TYPES.RECORD_VOICE_COMMAND: {
      const { voiceRecord, auditLog } = action.payload;
      return {
        ...state,
        voiceLog: [voiceRecord, ...state.voiceLog],
        auditLogs: auditLog ? [auditLog, ...state.auditLogs].slice(0, MAX_IN_MEMORY_LOGS) : state.auditLogs,
      };
    }

    case ACTION_TYPES.RECORD_SCAN_LOG: {
      const { scanRecord, auditLog } = action.payload;
      return {
        ...state,
        scanLog: [scanRecord, ...state.scanLog],
        auditLogs: auditLog ? [auditLog, ...state.auditLogs].slice(0, MAX_IN_MEMORY_LOGS) : state.auditLogs,
      };
    }

    case ACTION_TYPES.TAMPER_AUDIT_LOG_FOR_DEMO: {
      if (state.tamperedLogIndex !== null) return state; // Already tampered
      const targetIndex = action.payload?.index !== undefined ? action.payload.index : 1;
      if (!state.auditLogs[targetIndex]) return state;

      const originalLogs = [...state.auditLogs];
      const tamperedLogs = originalLogs.map((log, idx) => {
        if (idx === targetIndex) {
          return {
            ...log,
            details: log.details + ' [TAMPERED: Qty altered to 999.00 Qtl by unauthorized agent]',
            quantity: 999,
            // Notice: Hash is deliberately NOT updated to show cryptographic chain break
          };
        }
        return log;
      });

      return {
        ...state,
        originalAuditLogs: originalLogs,
        tamperedLogIndex: targetIndex,
        auditLogs: tamperedLogs,
      };
    }

    case ACTION_TYPES.RESTORE_AUDIT_LOG: {
      if (!state.originalAuditLogs) return state;
      return {
        ...state,
        auditLogs: state.originalAuditLogs,
        originalAuditLogs: null,
        tamperedLogIndex: null,
      };
    }

    // ==========================================
    // Real Backend Reducer Cases
    // ==========================================
    case ACTION_TYPES.SET_BACKEND_STATUS: {
      return {
        ...state,
        backendConnected: Boolean(action.payload),
      };
    }

    case ACTION_TYPES.SET_LOADING: {
      return {
        ...state,
        isLoading: Boolean(action.payload),
      };
    }

    case ACTION_TYPES.SET_SERVER_STATE: {
      const serverState = action.payload;
      if (!serverState) return state;

      const { batches, fps_indents, delivery_challans, audit_logs, kpis } = serverState;

      const mappedBatches = (batches || []).map(b => ({
        ...b,
        batchId: b.batch_code || b.batchId,
        bay: b.stack_bay || b.bay,
        qtyReceivedQtl: b.initial_qty !== undefined ? b.initial_qty : b.qtyReceivedQtl,
        remainingQtl: b.current_qty !== undefined ? b.current_qty : b.remainingQtl,
        reservedQtl: b.reserved_qty !== undefined ? b.reserved_qty : b.reservedQtl,
        qualityStatus: b.qualityStatus || (b.status === 'QUALITY_HOLD' ? 'Hold - High Moisture' : 'Eligible'),
        stackPosition: b.stack_position !== undefined ? b.stack_position : (b.stackPosition || 0),
        sha256Hash: b.sha256_hash || b.sha256Hash,
        ageDays: b.age_days !== undefined ? b.age_days : (b.ageDays || 0),
      }));

      const mappedChallans = (delivery_challans || []).map(c => {
        const rawAllocs = Array.isArray(c.allocated_batches) ? c.allocated_batches : (c.allocations || []);
        const normAllocs = rawAllocs.map(a => ({
          ...a,
          batchId: a.batch_code || a.batch_id || a.batchId,
          batchCode: a.batch_code || a.batch_id || a.batchId,
          bay: a.stack_bay || a.bay,
          take: a.allocated_qty !== undefined ? a.allocated_qty : a.take,
          ageDays: a.batch_age_days !== undefined ? a.batch_age_days : (a.ageDays || 0),
        }));

        const fpsObj = (c.fps && typeof c.fps === 'object') ? c.fps : {
          id: c.fps_code || c.fps_id || 'FPS-GN-101',
          name: c.fps_name || c.shop_name || 'Kasna Village Market',
          licenseNo: 'UP-GBN-PDS-2024-001',
        };

        return {
          ...c,
          id: c.id,
          challanId: c.challan_no || c.challanNo || c.id,
          challanNo: c.challan_no || c.challanNo,
          commodity: c.commodity,
          requestedQty: c.total_qty !== undefined ? c.total_qty : c.requestedQty,
          allocations: normAllocs,
          fps: fpsObj,
          fps_code: fpsObj.id,
          fps_name: fpsObj.name,
          isFifoCompliant: c.is_fifo_compliant !== undefined ? Boolean(c.is_fifo_compliant) : Boolean(c.isFifoCompliant),
          isDsoOtpVerified: c.dso_otp_verified !== undefined ? Boolean(c.dso_otp_verified) : Boolean(c.isDsoOtpVerified),
          token: c.crypto_token || c.token,
          tokenPrefix: (c.crypto_token || c.token || '').slice(0, 16),
          status: c.status,
          issuedAt: c.issued_at || c.issuedAt,
          receivedAt: c.received_at || c.receivedAt,
        };
      });

      const mappedLogs = (audit_logs || []).map(l => ({
        id: l.id,
        type: l.event_type || l.type,
        details: typeof l.details === 'object' ? JSON.stringify(l.details) : (l.details || ''),
        rawDetails: l.details,
        timestamp: l.timestamp,
        prevHash: l.prev_hash || l.prevHash,
        hash: l.hash,
        hashPrefix: (l.hash || '').slice(0, 16),
      }));

      let currentActive = state.activeChallan;
      if (currentActive) {
        const found = mappedChallans.find(c => c.challanNo === currentActive.challanNo);
        if (found) {
          currentActive = {
            ...currentActive,
            ...found,
            allocations: (found.allocations && found.allocations.length > 0) ? found.allocations : currentActive.allocations,
          };
        }
      } else {
        const latestStaged = mappedChallans.find(c => c.status === 'STAGED');
        if (latestStaged) {
          currentActive = latestStaged;
        }
      }

      return {
        ...state,
        backendConnected: true,
        batches: mappedBatches.length > 0 ? mappedBatches : state.batches,
        challans: mappedChallans,
        activeChallan: currentActive,
        fpsIndents: fps_indents || [],
        auditLogs: state.tamperedLogIndex !== null ? state.auditLogs : mappedLogs,
        serverKpis: kpis || state.serverKpis,
        stats: kpis ? {
          totalDispatches: kpis.total_dispatches,
          compliantDispatches: Math.round(((kpis.fifo_compliance_pct || 100) / 100) * (kpis.total_dispatches || 0)),
          blockedViolations: 0,
          approvedExceptions: 0,
        } : state.stats,
      };
    }

    case ACTION_TYPES.RECORD_AUDIT_LOG: {
      const newLog = action.payload;
      const updatedLogs = [newLog, ...(state.auditLogs || [])].slice(0, MAX_IN_MEMORY_LOGS);
      return {
        ...state,
        auditLogs: updatedLogs,
      };
    }

    default:
      return state;
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(storeReducer, null, getInitialState);
  const alarmTimerRef = useRef(null);
  const saveDebounceRef = useRef(null);

  // Auto-clear global alarm after 5 seconds
  useEffect(() => {
    if (state.isAlarmActive) {
      if (alarmTimerRef.current) clearTimeout(alarmTimerRef.current);
      alarmTimerRef.current = setTimeout(() => {
        dispatch({ type: ACTION_TYPES.CLEAR_VIOLATION_ALERT });
      }, 5000);
    }
    return () => {
      if (alarmTimerRef.current) clearTimeout(alarmTimerRef.current);
    };
  }, [state.isAlarmActive]);

  // Debounced, non-blocking asynchronous sync to localStorage
  useEffect(() => {
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
    }

    saveDebounceRef.current = setTimeout(() => {
      const performSave = () => {
        try {
          const toSave = {
            batches: state.batches,
            challans: state.challans,
            challanCounter: state.challanCounter,
            approvals: state.approvals,
            auditLogs: state.auditLogs.slice(0, MAX_PERSISTED_LOGS),
            exceptions: state.exceptions,
            stats: state.stats,
            activeChallan: state.activeChallan,
            // Phase 4 persistence
            networkMode: state.networkMode,
            deviceId: state.deviceId,
            localSeq: state.localSeq,
            prevTokenHash: state.prevTokenHash,
            syncQueue: state.syncQueue,
            voiceLog: state.voiceLog.slice(0, 50),
            scanLog: state.scanLog.slice(0, 50),
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
        } catch (e) {
          console.warn('Failed to save state to localStorage:', e);
        }
      };

      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(performSave, { timeout: 1000 });
      } else {
        performSave();
      }
    }, 350);

    return () => {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
      }
    };
  }, [
    state.batches, 
    state.challans, 
    state.challanCounter, 
    state.approvals, 
    state.auditLogs, 
    state.exceptions, 
    state.stats, 
    state.activeChallan,
    state.networkMode,
    state.deviceId,
    state.localSeq,
    state.prevTokenHash,
    state.syncQueue,
    state.voiceLog,
    state.scanLog
  ]);

  // Initial server state load on mount (subsequent sync handled by useLiveState)
  useEffect(() => {
    let isMounted = true;
    if (state.networkMode === 'ONLINE') {
      apiClient.getState().then((data) => {
        if (isMounted && data) {
          dispatch({ type: ACTION_TYPES.SET_SERVER_STATE, payload: data });
        }
      }).catch(() => {
        if (isMounted) {
          dispatch({ type: ACTION_TYPES.SET_BACKEND_STATUS, payload: false });
        }
      });
    }
    return () => { isMounted = false; };
  }, [state.networkMode]);


  const refreshServerState = useCallback(async () => {
    try {
      const data = await apiClient.getState();
      dispatch({ type: ACTION_TYPES.SET_SERVER_STATE, payload: data });
      return data;
    } catch (err) {
      dispatch({ type: ACTION_TYPES.SET_BACKEND_STATUS, payload: false });
      throw err;
    }
  }, [dispatch]);

  const contextValue = useMemo(() => ({ state, dispatch, refreshServerState }), [state, refreshServerState]);

  return (
    <StoreContext.Provider value={contextValue}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
