import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Activity, CheckCircle2, AlertTriangle, Layers, FileSpreadsheet, Lock } from 'lucide-react';
import { ExceptionQueue } from './ExceptionQueue';
import { TraceMatrix } from './TraceMatrix';
import { apiClient } from '../../services/apiClient';
import { useI18n } from '../../i18n/I18nContext';

export function VigilancePanel() {
  const { isHindi } = useI18n();

  const [activeSubTab, setActiveSubTab] = useState('exceptions'); // 'exceptions' | 'matrix' | 'audit'
  const [vigilanceData, setVigilanceData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [chainVerifyResult, setChainVerifyResult] = useState(null);
  const [isVerifyingChain, setIsVerifyingChain] = useState(false);

  const fetchVigilance = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getDsoVigilance();
      setVigilanceData(data);
    } catch (err) {
      console.error('Failed to load DSO vigilance data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVigilance();
  }, []);

  const handleVerifyChain = async () => {
    setIsVerifyingChain(true);
    try {
      const res = await apiClient.verifyHashChain();
      setChainVerifyResult(res);
    } catch (err) {
      setChainVerifyResult({ valid: false, error: err.message });
    } finally {
      setIsVerifyingChain(false);
    }
  };

  const kpis = vigilanceData?.kpis || {
    fifo_compliance_pct: 100.0,
    total_dispatches: 0,
    compliant_dispatches: 0,
    violations_blocked: 0,
    exceptions_approved: 0,
    exceptions_rejected: 0,
    challans_in_transit: 0,
    pending_indents: 0,
  };

  return (
    <div className="space-y-6">
      {/* 1. District Vigilance KPI Header & Compliance Gauge */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Compliance Gauge Card */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex items-center gap-4">
          <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
            <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-100"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-emerald-500 transition-all duration-1000"
                strokeDasharray={`${kpis.fifo_compliance_pct}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute font-mono font-black text-xs text-slate-900">
              {kpis.fifo_compliance_pct}%
            </span>
          </div>

          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              {isHindi ? 'जिला FIFO अनुपालन दर' : 'District FIFO Rate'}
            </span>
            <div className="font-bold text-sm text-emerald-700 mt-0.5">
              {kpis.fifo_compliance_pct >= 95 ? (isHindi ? 'उत्कृष्ट (Compliant)' : 'Exemplary') : (isHindi ? 'निगरानी आवश्यक' : 'Vigilance Alert')}
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
              {kpis.compliant_dispatches} / {kpis.total_dispatches} compliant dispatches
            </span>
          </div>
        </div>

        {/* Violations Blocked */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            {isHindi ? 'अवरुद्ध FIFO उल्लंघन' : 'Violations Blocked'}
          </span>
          <div className="font-mono text-2xl font-black text-rose-700 mt-1">
            {kpis.violations_blocked}
          </div>
          <span className="text-[10px] text-rose-600 font-medium block mt-0.5">
            Intercepted at allocation gate
          </span>
        </div>

        {/* Exceptions Approved / Rejected */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            {isHindi ? 'वैधानिक अपवाद (Exceptions)' : 'Statutory Exceptions'}
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-mono text-2xl font-black text-amber-700">
              {kpis.exceptions_approved}
            </span>
            <span className="text-xs text-slate-400">approved /</span>
            <span className="font-mono text-lg font-bold text-slate-700">
              {kpis.exceptions_rejected}
            </span>
            <span className="text-xs text-slate-400">rejected</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            Authorized by DSO Dual-OTP
          </span>
        </div>

        {/* In-Transit Challans */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            {isHindi ? 'मार्ग में चालान (In-Transit)' : 'Active In-Transit Dispatches'}
          </span>
          <div className="font-mono text-2xl font-black text-blue-700 mt-1">
            {kpis.challans_in_transit}
          </div>
          <span className="text-[10px] text-blue-600 font-medium block mt-0.5">
            Awaiting e-PoS store receipt
          </span>
        </div>
      </div>

      {/* 2. Sub-Tab Switcher */}
      <div className="flex border-b border-slate-200 gap-1 bg-white px-3 pt-2 rounded-t-lg">
        <button
          type="button"
          onClick={() => setActiveSubTab('exceptions')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
            activeSubTab === 'exceptions'
              ? 'border-amber-600 text-amber-900 bg-amber-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
          <span>{isHindi ? 'अपवाद अनुरोध कतार (Exceptions Queue)' : 'Pending Exceptions'}</span>
          {vigilanceData?.pending_exceptions?.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-200 text-amber-950 ml-1">
              {vigilanceData.pending_exceptions.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('matrix')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
            activeSubTab === 'matrix'
              ? 'border-[#0B2A5B] text-[#0B2A5B] bg-slate-50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="h-3.5 w-3.5 text-[#0B2A5B]" />
          <span>{isHindi ? 'आपूर्ति मैट्रिक्स व वापसी (Traceability Matrix)' : 'Batch × FPS Matrix'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('audit')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
            activeSubTab === 'audit'
              ? 'border-emerald-600 text-emerald-900 bg-emerald-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Lock className="h-3.5 w-3.5 text-emerald-600" />
          <span>{isHindi ? 'सतर्कता ऑडिट टेल (Audit Trail)' : 'Vigilance Audit Ledger'}</span>
        </button>
      </div>

      {/* Sub-Tab Content */}
      <div>
        {activeSubTab === 'exceptions' && (
          <ExceptionQueue
            exceptions={vigilanceData?.pending_exceptions || []}
            onDecisionCompleted={fetchVigilance}
          />
        )}

        {activeSubTab === 'matrix' && <TraceMatrix />}

        {activeSubTab === 'audit' && (
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Lock className="h-4 w-4 text-emerald-700" />
                  <span>{isHindi ? 'क्रिप्टोग्राफ़िक सतर्कता लेजर (Append-Only Audit Tail)' : 'Statutory Vigilance Audit Ledger'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isHindi 
                    ? 'एसक्यूएल ट्रिगर्स द्वारा संरक्षित और शा-256 हैश द्वारा शृंखलाबद्ध अपरिवर्तनीय ऑडिट ट्रेल' 
                    : 'Immutable, SHA-256 Merkle-linked audit records protected by database-level triggers'}
                </p>
              </div>

              <button
                type="button"
                disabled={isVerifyingChain}
                onClick={handleVerifyChain}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded shadow-xs transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{isVerifyingChain ? 'Verifying...' : (isHindi ? 'हैश शृंखला सत्यापित करें' : 'Verify Hash Chain')}</span>
              </button>
            </div>

            {chainVerifyResult && (
              <div className={`p-3.5 rounded-lg border text-xs font-bold flex items-center gap-2 animate-in fade-in ${
                chainVerifyResult.valid
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                  : 'bg-rose-50 border-rose-400 text-rose-950'
              }`}>
                {chainVerifyResult.valid ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <span>CHAIN INTEGRITY: 100% VALID — {chainVerifyResult.events} events verified from genesis root.</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                    <span>CHAIN INTEGRITY BROKEN at event #{chainVerifyResult.broken_at}! Tamper detected.</span>
                  </>
                )}
              </div>
            )}

            {/* Recent Events Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-md">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                    <th className="py-2.5 px-3">Event Type</th>
                    <th className="py-2.5 px-3">Details</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3 font-mono">Hash Prefix</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {vigilanceData?.recent_exception_events?.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 font-bold font-mono text-slate-900">{ev.type}</td>
                      <td className="py-2 px-3 font-sans text-slate-700 max-w-md truncate">
                        {typeof ev.details === 'object' ? JSON.stringify(ev.details) : ev.details}
                      </td>
                      <td className="py-2 px-3 text-slate-500 font-mono text-[10px]">
                        {new Date(ev.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 font-mono text-emerald-700 font-bold">
                        {ev.hash_prefix}...
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
