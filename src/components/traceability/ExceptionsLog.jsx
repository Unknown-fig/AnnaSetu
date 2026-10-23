import React from 'react';
import { useStore } from '../../context/store';
import { 
  FileCheck2, 
  AlertTriangle, 
  ShieldAlert, 
  Calendar, 
  UserCheck, 
  CheckCircle2,
  Lock,
  Stamp
} from 'lucide-react';

export const ExceptionsLog = React.memo(function ExceptionsLog({ language = 'en' }) {
  const { state } = useStore();
  const { exceptions, stats } = state;

  return (
    <div className="bg-white border border-slate-300 rounded-lg p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#1e3a8a] flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-[#1e3a8a]" />
              <span>FIFO Compliance & Exception Audit</span>
            </h2>
            <span className="text-xs font-hind text-slate-500 font-semibold">
              (FIFO अनुपालन एवं अपवाद लॉग)
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-[#b45309] border border-amber-300 font-mono font-bold">
              Statutory Override Log
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Legal record of all non-FIFO dispatch authorizations approved by gazetted officers
          </p>
        </div>

        {/* Violation Counter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-md text-xs font-mono">
            <ShieldAlert className="h-4 w-4 text-[#b91c1c]" />
            <span className="text-slate-600">Blocked Violations:</span>
            <span className="text-[#b91c1c] font-bold">{stats.violationAttempts || 0}</span>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-md text-xs font-mono">
            <FileCheck2 className="h-4 w-4 text-[#b45309]" />
            <span className="text-slate-600">Approved Overrides:</span>
            <span className="text-[#b45309] font-bold">{exceptions.length}</span>
          </div>
        </div>
      </div>

      {/* Exception Records */}
      <div className="space-y-3">
        {exceptions.length === 0 ? (
          <div className="py-12 text-center text-slate-500 font-mono text-xs space-y-2 border border-dashed border-slate-300 rounded-lg bg-slate-50/50">
            <CheckCircle2 className="h-8 w-8 text-[#15803d] mx-auto" />
            <div className="text-slate-800 font-bold text-sm">Zero FIFO Override Exceptions</div>
            <p className="text-slate-600 text-xs max-w-md mx-auto">
              All dispatches in this godown are operating under 100% strict automated FIFO allocation. No manual bypasses have been executed.
            </p>
          </div>
        ) : (
          exceptions.map(exc => (
            <div 
              key={exc.id}
              className="bg-amber-50/50 border border-amber-300 rounded-lg p-4 space-y-3 shadow-xs"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-mono text-xs font-bold">
                    {exc.id}
                  </span>
                  <span className="font-bold text-slate-900 text-xs">
                    Challan: {exc.challanId} • Destination: {exc.fpsName}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>{new Date(exc.timestamp).toLocaleString()}</span>
                </div>
              </div>

              {/* Grid Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-mono font-bold">Approved Reason:</span>
                  <div className="text-amber-950 font-bold bg-white border border-amber-200 p-2.5 rounded shadow-xs">
                    {exc.reason}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-mono font-bold flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5 text-[#15803d]" />
                    Approving Officer (सक्षम प्राधिकारी):
                  </span>
                  <div className="text-slate-900 font-mono font-bold bg-white border border-amber-200 p-2.5 rounded shadow-xs">
                    {exc.officerName}
                  </div>
                </div>
              </div>

              {/* Remarks */}
              <div className="text-xs space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-mono font-bold">Official Remarks & Justification:</span>
                <p className="text-slate-800 bg-white border border-amber-200 p-2.5 rounded leading-relaxed font-sans shadow-xs">
                  "{exc.remarks}"
                </p>
              </div>

              {/* Allocated Batches list */}
              {exc.allocations && exc.allocations.length > 0 && (
                <div className="text-xs pt-1">
                  <span className="text-[10px] text-slate-500 uppercase font-mono font-bold">Authorized Non-FIFO Batches:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {exc.allocations.map(a => (
                      <span key={a.batchId} className="px-2 py-1 rounded bg-white border border-slate-300 font-mono text-[11px] text-slate-800 shadow-xs">
                        #{a.batchId} (Bay {a.bay}): <strong>{a.take} Qtl</strong> ({a.ageDays}d old)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
});

