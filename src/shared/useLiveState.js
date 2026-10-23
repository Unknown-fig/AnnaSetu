import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../context/store';
import { ACTION_TYPES } from '../context/actions';
import { apiClient } from '../services/apiClient';
import { subscribeToSync } from './syncChannel';

const POLL_INTERVAL_MS = 3000;

export function useLiveState() {
  const { state, dispatch, refreshServerState } = useStore();
  const [lastUpdated, setLastUpdated] = useState(() => new Date().toLocaleTimeString('en-GB'));
  const [stateVersion, setStateVersion] = useState(null);

  const versionRef = useRef(stateVersion);
  versionRef.current = stateVersion;

  const refreshServerStateRef = useRef(refreshServerState);
  refreshServerStateRef.current = refreshServerState;

  const networkModeRef = useRef(state.networkMode);
  networkModeRef.current = state.networkMode;

  const isPollingRef = useRef(false);
  const failureCountRef = useRef(0);

  // Core update check: queries /api/state/version
  const checkVersionAndSync = useCallback(async (forced = false) => {
    if (networkModeRef.current === 'OFFLINE') {
      return;
    }

    if (isPollingRef.current && !forced) return;
    isPollingRef.current = true;

    try {
      const versionInfo = await apiClient.getStateVersion();
      failureCountRef.current = 0;
      dispatch({ type: ACTION_TYPES.SET_BACKEND_STATUS, payload: true });

      const newVersion = versionInfo.version;
      if (forced || versionRef.current === null || newVersion !== versionRef.current) {
        versionRef.current = newVersion;
        setStateVersion(newVersion);
        if (refreshServerStateRef.current) {
          await refreshServerStateRef.current();
        }
        setLastUpdated(new Date().toLocaleTimeString('en-GB'));
      }
    } catch (err) {
      failureCountRef.current += 1;
      // Require 3 consecutive failed pings before marking UNREACHABLE to prevent transient flicker
      if (failureCountRef.current >= 3) {
        dispatch({ type: ACTION_TYPES.SET_BACKEND_STATUS, payload: false });
      }
    } finally {
      isPollingRef.current = false;
    }
  }, [dispatch]);

  // 1. Cross-tab BroadcastChannel invalidation listener (updates < 300ms)
  useEffect(() => {
    const unsubscribe = subscribeToSync(() => {
      // Immediate invalidation from another tab or local mutation
      checkVersionAndSync(true);
    });
    return unsubscribe;
  }, [checkVersionAndSync]);

  // 2. Periodic polling with visibility pause and immediate refetch on tab focus
  useEffect(() => {
    checkVersionAndSync(false);

    let intervalId = null;

    const startTimer = () => {
      if (!intervalId) {
        intervalId = setInterval(() => {
          checkVersionAndSync(false);
        }, POLL_INTERVAL_MS);
      }
    };

    const stopTimer = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersionAndSync(false);
        startTimer();
      } else {
        stopTimer();
      }
    };

    if (document.visibilityState === 'visible') {
      startTimer();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkVersionAndSync]);

  const currentStatus = state.networkMode === 'OFFLINE'
    ? 'OFFLINE'
    : (state.backendConnected ? 'CONNECTED' : 'UNREACHABLE');

  return {
    state,
    dispatch,
    refreshServerState: () => checkVersionAndSync(true),
    lastUpdated,
    backendStatus: currentStatus,
    isConnected: currentStatus === 'CONNECTED',
    version: stateVersion,
  };
}
