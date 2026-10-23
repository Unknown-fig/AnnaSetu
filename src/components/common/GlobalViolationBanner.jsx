import React, { useCallback } from 'react';
import { useStore } from '../../context/store';
import { ACTION_TYPES } from '../../context/actions';
import { AlertOctagon, X, Volume2, ShieldAlert } from 'lucide-react';

export const GlobalViolationBanner = React.memo(function GlobalViolationBanner() {
  const { state, dispatch } = useStore();
  const alert = state.activeViolationAlert;

  const handleDismiss = useCallback(() => {
    dispatch({ type: ACTION_TYPES.CLEAR_VIOLATION_ALERT });
  }, [dispatch]);

  if (!alert) return null;

  return (
    <div className="bg-[#b91c1c] border-y-2 border-red-900 text-white px-4 py-3 shadow-lg relative z-30 transition-all select-none animate-flash-red">
      <div className="max-w-[1920px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white text-[#b91c1c] rounded-lg shadow-sm animate-bounce">
            <AlertOctagon className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-wide uppercase text-white flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-yellow-300" />
                {alert.title || 'CRITICAL FIFO MISMATCH / STATUTORY VIOLATION DETECTED'}
              </span>
              <span className="text-[10px] bg-red-900 border border-red-700 px-1.5 py-0.5 rounded font-mono text-white font-bold">
                PDS DISPATCH LOCKED
              </span>
            </div>
            <p className="text-xs text-red-100 font-medium mt-0.5">
              {alert.message}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <div className="flex items-center gap-1 text-[11px] text-white font-mono bg-red-900/80 px-2.5 py-1 rounded border border-red-700">
            <Volume2 className="h-3.5 w-3.5 text-yellow-300 animate-pulse" />
            <span>Siren Active</span>
          </div>
          <button
            onClick={handleDismiss}
            className="px-3 py-1 bg-white hover:bg-red-50 text-[#b91c1c] rounded text-xs font-bold flex items-center gap-1 transition-colors shadow-sm"
          >
            <X className="h-3.5 w-3.5" />
            <span>Acknowledge & Dismiss</span>
          </button>
        </div>
      </div>
    </div>
  );
});

