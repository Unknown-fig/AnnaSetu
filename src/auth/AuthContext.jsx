import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ROLES, ROLE_KEYS } from './roles';
import { createChainedEventHash } from '../services/cryptoService';
import { useStore } from '../context/store';
import { ACTION_TYPES } from '../context/actions';
import { apiClient } from '../services/apiClient';

const AUTH_STORAGE_KEY = 'annasetu_auth_session';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { state, dispatch } = useStore();

  const [user, setUser] = useState(() => {
    if (typeof window === 'undefined') return null;

    // 1. Check URL query param ?role= for instant dual-window boot
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role');
    if (roleParam && ROLES[roleParam]) {
      try {
        sessionStorage.setItem(AUTH_STORAGE_KEY, roleParam);
      } catch (e) {
        // Ignore storage errors
      }
      return ROLES[roleParam];
    }

    // 2. Check sessionStorage
    try {
      const savedKey = sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (savedKey && ROLES[savedKey]) {
        return ROLES[savedKey];
      }
    } catch (e) {
      // Ignore
    }

    return null;
  });

  // Sync handset simulator mode when user changes
  useEffect(() => {
    if (user && user.handsetMode) {
      window.dispatchEvent(
        new CustomEvent('annasetu:handset-mode-change', {
          detail: { mode: user.handsetMode, roleKey: user.key },
        })
      );
    }
  }, [user]);

  // Helper to append audit log through cryptographic hash chain
  const recordAuthAuditEvent = useCallback(
    async (eventType, roleObj, extraDetails = {}) => {
      try {
        const timestamp = new Date().toISOString();
        const prevHash =
          state?.auditLogs?.[0]?.hash ||
          '0000000000000000000000000000000000000000000000000000000000000000';

        const payload = {
          roleKey: roleObj.key,
          officerName: roleObj.name,
          officerId: roleObj.id,
          location: roleObj.location,
          ...extraDetails,
        };

        const eventHash = await createChainedEventHash(
          prevHash,
          timestamp,
          eventType,
          payload
        );

        const auditItem = {
          id: `EVT-AUTH-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          timestamp,
          type: eventType,
          title:
            eventType === 'LOGIN'
              ? `SSO Authentication: ${roleObj.name} (${roleObj.label})`
              : `SSO Role Switch: ${roleObj.name} (${roleObj.label})`,
          actor: roleObj.name,
          details: `Authenticated via e-Pramaan SSO Gateway. Official ID: ${roleObj.id}, Location: ${roleObj.location}`,
          commodity: 'All',
          quantity: 0,
          fpsName: roleObj.location,
          prevHash,
          hash: eventHash,
        };

        if (dispatch) {
          dispatch({
            type: ACTION_TYPES.RECORD_AUDIT_LOG,
            payload: auditItem,
          });
        }

        // Send to backend sync queue if online
        if (state?.backendConnected) {
          try {
            await apiClient.syncOfflineEvents([
              {
                id: auditItem.id,
                action_type: eventType,
                event_type: eventType,
                payload,
                token: eventHash,
                token_payload: payload,
                local_seq: state?.localSeq || 1,
                occurred_at: timestamp,
              },
            ]);
          } catch (e) {
            // Ignore background sync errors
          }
        }
      } catch (err) {
        console.warn('Failed to record auth audit event:', err);
      }
    },
    [dispatch, state?.auditLogs, state?.backendConnected, state?.localSeq]
  );

  const login = useCallback(
    async (roleKey) => {
      const selected = ROLES[roleKey];
      if (!selected) return;

      try {
        sessionStorage.setItem(AUTH_STORAGE_KEY, roleKey);
      } catch (e) {
        // Ignore
      }

      setUser(selected);
      await recordAuthAuditEvent('LOGIN', selected);
    },
    [recordAuthAuditEvent]
  );

  const switchRole = useCallback(
    async (newRoleKey) => {
      const selected = ROLES[newRoleKey];
      if (!selected) return;

      const oldRoleKey = user?.key;

      try {
        sessionStorage.setItem(AUTH_STORAGE_KEY, newRoleKey);
      } catch (e) {
        // Ignore
      }

      setUser(selected);
      await recordAuthAuditEvent('ROLE_SWITCH', selected, {
        previousRole: oldRoleKey,
        newRole: newRoleKey,
      });
    },
    [user, recordAuthAuditEvent]
  );

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (e) {
      // Ignore
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, switchRole, logout, roles: ROLES, roleKeys: ROLE_KEYS }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
