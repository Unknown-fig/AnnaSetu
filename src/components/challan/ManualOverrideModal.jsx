import React, { useState, useCallback } from 'react';
import { 
  AlertOctagon, 
  X, 
  AlertTriangle,
  Stamp
} from 'lucide-react';
import { EXCEPTION_REASONS } from '../../types/models';
import { useI18n } from '../../i18n/I18nContext';

export const ManualOverrideModal = React.memo(function ManualOverrideModal({
  isOpen,
  violationDetails,
  onCancel,
  onApproveException,
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState(EXCEPTION_REASONS[0]);
  const [officerName, setOfficerName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (!officerName.trim()) {
      alert('Approving Officer Name & Designation is required.');
      return;
    }
    if (!remarks.trim()) {
      alert('Official Remarks / Justification are required.');
      return;
    }

    setIsSubmitting(true);
    onApproveException({
      reason,
      officerName: officerName.trim(),
      remarks: remarks.trim(),
      violationDetails,
      timestamp: new Date().toISOString(),
    });
  }, [reason, officerName, remarks, violationDetails, onApproveException]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs select-none">
      <div className="bg-white border-2 border-[#b91c1c] rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Official Statutory Header */}
        <div className="px-5 py-4 bg-[#b91c1c] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white text-[#b91c1c] rounded-lg shadow-sm">
              <AlertOctagon className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-red-200">
                UTTAR PRADESH FOOD & CIVIL SUPPLIES DEPARTMENT • STATUTORY OVERRIDE
              </div>
              <h3 className="text-base font-extrabold uppercase tracking-wide flex items-center gap-2">
                <span>{t('override.alertTitle')}</span>
              </h3>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-red-200 hover:text-white p-1 rounded-lg hover:bg-red-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Violation Description Callout */}
        <div className="p-5 space-y-4 text-xs">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-950">
            <div className="flex items-center gap-2 font-bold mb-1 text-[#b91c1c]">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span>{t('override.alertDesc')}</span>
            </div>
            <p className="font-mono text-xs leading-relaxed text-red-900">
              {violationDetails?.message || 
                'A newer commodity batch was selected while an older eligible batch still has stock balance in godown bays.'}
            </p>
          </div>

          <div className="text-slate-700 bg-slate-50 p-3 rounded border border-slate-200">
            <p className="font-bold text-[#0B2A5B] mb-0.5">
              Statutory PDS Control Notice:
            </p>
            <p className="text-[11px] text-slate-600 leading-normal">
              Under Uttar Pradesh Food & Civil Supplies Department PDS guidelines, dispatching newer stock out-of-turn is strictly prohibited to prevent stock deterioration. To proceed, an <strong>Approved Exception Form</strong> must be executed by an authorized gazetted/supervisory officer.
            </p>
          </div>

          {/* Exception Authorization Form */}
          <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-slate-200">
            {/* Reason */}
            <div>
              <label className="block text-slate-800 font-bold mb-1">
                {t('override.reasonLabel')} <span className="text-red-600">*</span>
              </label>
              <select
                id="exception-reason-select"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-800 focus:outline-none focus:border-red-600 font-medium"
              >
                {EXCEPTION_REASONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Approving Officer Name */}
            <div>
              <label className="block text-slate-800 font-bold mb-1">
                {t('override.officerLabel')} <span className="text-red-600">*</span>
              </label>
              <input
                id="exception-officer-input"
                type="text"
                placeholder="e.g., Shri R. K. Sharma (Dy. Director, Food & Civil Supplies, GBN)"
                value={officerName}
                onChange={(e) => setOfficerName(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:border-red-600 font-mono text-xs"
              />
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-slate-800 font-bold mb-1">
                {t('override.remarksLabel')} <span className="text-red-600">*</span>
              </label>
              <textarea
                id="exception-remarks-input"
                rows={2}
                placeholder="Specify inspection report number, moisture meter reading, or specific physical pathway obstruction..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:border-red-600 text-xs"
              />
            </div>

            {/* Buttons */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-300 transition-colors"
              >
                {t('override.cancelOverride')}
              </button>

              <button
                id="submit-exception-btn"
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-md bg-[#b91c1c] hover:bg-red-800 text-white font-bold transition-colors flex items-center gap-2 shadow-sm"
              >
                <Stamp className="h-4 w-4" />
                <span>{t('override.submitOverride')}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
});
