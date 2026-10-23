import React, { useState } from 'react';
import { useStore } from '../../context/store';
import { useI18n } from '../../i18n/I18nContext';
import { apiClient } from '../../services/apiClient';
import { FAIR_PRICE_SHOPS, COMMODITIES } from '../../types/models';
import { ClipboardList, PlusCircle, CheckCircle2, AlertCircle, ArrowRight, Clock, Store, ShieldCheck } from 'lucide-react';

export function FpsIndentsPanel({ onPreFillChallan, filterFpsCode }) {
  const { state, refreshServerState } = useStore();
  const { t, lang } = useI18n();

  const [filterStatus, setFilterStatus] = useState('ALL');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedFps, setSelectedFps] = useState(filterFpsCode || 'FPS-GN-101');
  const [commodity, setCommodity] = useState('Wheat');
  const [qty, setQty] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const indents = state.fpsIndents || [];

  const filteredIndents = indents.filter((ind) => {
    if (filterFpsCode && ind.fps_code !== filterFpsCode) return false;
    if (filterStatus === 'ALL') return true;
    return ind.status === filterStatus;
  });

  const handleCreateIndent = async (e) => {
    e.preventDefault();
    const numQty = parseFloat(qty);
    if (!numQty || numQty <= 0) {
      setFeedback({ type: 'error', message: lang === 'hi' ? 'कृपया मान्य मात्रा दर्ज करें (> 0)' : 'Please enter a valid quantity (> 0)' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await apiClient.createIndent({
        fpsCode: selectedFps,
        commodity,
        requestedQty: numQty,
        priority,
      });
      await refreshServerState();
      setFeedback({
        type: 'success',
        message: lang === 'hi' ? `मांगपत्र ${res.indent_no} सफलतापूर्वक दर्ज किया गया!` : `Indent ${res.indent_no} submitted successfully to Central Godown!`,
      });
      setQty('');
      setIsCreating(false);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || (lang === 'hi' ? 'मांगपत्र दर्ज करने में त्रुटि' : 'Failed to submit indent'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateChallan = (indent) => {
    if (onPreFillChallan) {
      onPreFillChallan({
        indentId: indent.id,
        indentNo: indent.indent_no,
        fpsId: indent.fps_code,
        commodity: indent.commodity,
        quantity: indent.requested_qty,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 rounded-lg border border-blue-700/50 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="h-6 w-6 text-amber-400" />
            <h2 className="text-xl font-bold tracking-tight">
              {lang === 'hi' ? 'उचित दर दुकान (FPS) मांगपत्र प्रबंधन' : 'Fair Price Shop (FPS) Indents Management'}
            </h2>
            <span className="bg-amber-400 text-slate-950 text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider">
              {lang === 'hi' ? 'लाइव सिंक' : 'Live iPDS'}
            </span>
          </div>
          <p className="text-xs text-blue-200">
            {lang === 'hi'
              ? 'उचित दर दुकानों द्वारा दर्ज किए गए राशन मांगपत्र एवं केंद्रीय डिपो चालान आवंटन'
              : 'Direct commodity indent requisitions from Fair Price Shops awaiting FIFO allocation and loading.'}
          </p>
        </div>

        <button
          onClick={() => { setIsCreating(!isCreating); setFeedback(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded shadow transition-all focus:outline-none focus:ring-2 focus:ring-amber-300"
        >
          <PlusCircle className="h-4 w-4" />
          <span>{isCreating ? (lang === 'hi' ? 'बंद करें' : 'Close Form') : (lang === 'hi' ? '+ नया मांगपत्र दर्ज करें' : '+ Create FPS Indent')}</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg border flex items-center gap-2 text-sm font-semibold ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <AlertCircle className="h-5 w-5 text-rose-400" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Indent Creation Drawer / Form */}
      {isCreating && (
        <form onSubmit={handleCreateIndent} className="bg-slate-900 border border-amber-500/40 rounded-lg p-5 shadow-lg space-y-4">
          <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
            <Store className="h-4 w-4" />
            {lang === 'hi' ? 'नया मांगपत्र प्रपत्र (FPS e-PoS पोर्टल)' : 'New FPS Requisition Form (e-PoS Direct)'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-semibold text-slate-300">
            <div>
              <label className="block mb-1">{lang === 'hi' ? 'उचित दर दुकान (FPS)' : 'Fair Price Shop'}</label>
              <select
                value={selectedFps}
                onChange={(e) => setSelectedFps(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded px-3 py-2 focus:border-amber-400 focus:outline-none"
              >
                {FAIR_PRICE_SHOPS.map((fps) => (
                  <option key={fps.id} value={fps.id}>
                    {fps.id} — {fps.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1">{lang === 'hi' ? 'खाद्यान्न सामग्री' : 'Commodity'}</label>
              <select
                value={commodity}
                onChange={(e) => setCommodity(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded px-3 py-2 focus:border-amber-400 focus:outline-none"
              >
                {COMMODITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1">{lang === 'hi' ? 'मांगी गई मात्रा (क्विंटल)' : 'Requested Quantity (Qtl)'}</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="e.g. 80.00"
                className="w-full bg-slate-950 border border-slate-700 text-white rounded px-3 py-2 focus:border-amber-400 focus:outline-none font-mono"
                required
              />
            </div>

            <div>
              <label className="block mb-1">{lang === 'hi' ? 'प्राथमिकता' : 'Priority'}</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded px-3 py-2 focus:border-amber-400 focus:outline-none"
              >
                <option value="NORMAL">{lang === 'hi' ? 'सामान्य (Normal)' : 'NORMAL'}</option>
                <option value="HIGH">{lang === 'hi' ? 'उच्च (High)' : 'HIGH'}</option>
                <option value="URGENT">{lang === 'hi' ? 'अति आवश्यक (Urgent)' : 'URGENT'}</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold rounded"
            >
              {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded shadow flex items-center gap-2"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>{isSubmitting ? (lang === 'hi' ? 'दर्ज हो रहा है...' : 'Submitting...') : (lang === 'hi' ? 'मांगपत्र प्रेषित करें' : 'Submit Requisition')}</span>
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <span className="text-xs font-bold text-slate-400 mr-2">{lang === 'hi' ? 'स्थिति अनुसार फ़िल्टर:' : 'Filter Status:'}</span>
        {[
          { id: 'ALL', label: lang === 'hi' ? 'सभी' : 'All' },
          { id: 'PENDING_AT_GODOWN', label: lang === 'hi' ? 'लंबित (डिपो में)' : 'Pending at Godown' },
          { id: 'CHALLAN_ISSUED', label: lang === 'hi' ? 'चालान जारी' : 'Challan Issued' },
          { id: 'DELIVERED_TO_FPS', label: lang === 'hi' ? 'वितरित (दुकान में)' : 'Delivered to FPS' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id)}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${
              filterStatus === tab.id
                ? 'bg-blue-600 text-white shadow'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Indents Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">{lang === 'hi' ? 'मांगपत्र संख्या' : 'Indent No'}</th>
                <th className="py-3 px-4">{lang === 'hi' ? 'दुकान का नाम / कोड' : 'FPS Code / Store'}</th>
                <th className="py-3 px-4">{lang === 'hi' ? 'सामग्री' : 'Commodity'}</th>
                <th className="py-3 px-4 text-right">{lang === 'hi' ? 'मांगी गई मात्रा' : 'Requested Qty'}</th>
                <th className="py-3 px-4">{lang === 'hi' ? 'प्राथमिकता' : 'Priority'}</th>
                <th className="py-3 px-4">{lang === 'hi' ? 'स्थिति' : 'Status'}</th>
                <th className="py-3 px-4 text-right">{lang === 'hi' ? 'कार्यवाही' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredIndents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    {lang === 'hi' ? 'कोई मांगपत्र उपलब्ध नहीं है' : 'No indents match this filter.'}
                  </td>
                </tr>
              ) : (
                filteredIndents.map((ind) => {
                  const isPending = ind.status === 'PENDING_AT_GODOWN';
                  const priorityColor =
                    ind.priority === 'URGENT'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : ind.priority === 'HIGH'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-800 text-slate-300 border-slate-700';

                  const statusColor =
                    ind.status === 'DELIVERED_TO_FPS'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : ind.status === 'CHALLAN_ISSUED'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40';

                  return (
                    <tr key={ind.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        {ind.indent_no}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-200">{ind.fps_code}</div>
                        <div className="text-[11px] text-slate-400">{ind.fps_name}</div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-amber-300">
                        {ind.ui_commodity || ind.commodity}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-100">
                        {parseFloat(ind.requested_qty).toFixed(2)} Qtl
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${priorityColor}`}>
                          {ind.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border flex items-center gap-1 w-fit ${statusColor}`}>
                          <Clock className="h-3 w-3" />
                          <span>{ind.status}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {isPending ? (
                          <button
                            onClick={() => handleCreateChallan(ind)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded shadow transition-all focus:outline-none"
                          >
                            <span>{lang === 'hi' ? 'चालान बनाएं' : 'Create Challan'}</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-semibold italic">
                            {lang === 'hi' ? 'संसाधित' : 'Processed'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
