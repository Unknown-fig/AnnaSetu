import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { getNextRoleKey } from './roles';
import { 
  ShieldCheck, 
  UserCheck, 
  ChevronDown, 
  ExternalLink, 
  LogOut, 
  Check, 
  Smartphone,
  Sparkles
} from 'lucide-react';

export function OfficerTopBar({ onRoleSwitched }) {
  const { user, switchRole, logout, roles, roleKeys } = useAuth();
  const { isHindi } = useI18n();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside or Escape key
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!user) return null;

  const handleSelectRole = (key) => {
    if (key !== user.key) {
      switchRole(key);
      if (onRoleSwitched) onRoleSwitched(key);
    }
    setDropdownOpen(false);
  };

  const handleOpenDualWindow = () => {
    const nextKey = getNextRoleKey(user.key);
    const targetUrl = `${window.location.origin}${window.location.pathname}?role=${nextKey}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      id="sso-persistent-topbar"
      className="bg-slate-900 border-b border-slate-800 text-white text-xs px-3 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-2 shadow-inner z-40"
    >
      {/* Left: Active Officer Identity & Digital Badge */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
          <ShieldCheck className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            {isHindi ? 'सक्रिय अधिकारी' : 'SSO Officer'}:
          </span>
          <span className="font-bold text-white tracking-wide">
            {isHindi ? user.nameHi || user.name : user.name}
          </span>
        </div>

        {/* Role Badge */}
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border shadow-xs ${user.badgeBg} ${user.badgeText} ${user.badgeBorder}`}
        >
          {isHindi ? user.labelHi : user.label}
        </span>

        {/* Officer ID */}
        <span className="text-[11px] font-mono text-slate-300 hidden sm:inline bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60">
          ID: {user.id}
        </span>
      </div>

      {/* Right: Quick Role Switcher, Dual-Window Demo, Sign Out */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        {/* Quick Role Switcher Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            id="quick-role-switcher-btn"
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded text-xs font-bold border border-slate-700 shadow-xs transition-colors focus:outline-none focus:ring-1 focus:ring-amber-400"
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            <UserCheck className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden xs:inline">
              {isHindi ? 'पद बदलें' : 'Switch Role'}:
            </span>
            <span className="text-white">{isHindi ? user.labelHi : user.label}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {dropdownOpen && (
            <div
              className="absolute right-0 mt-1 w-72 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
              role="menu"
            >
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                {isHindi ? '1-क्लिक पद स्विच (हैकाथॉन डेमो)' : '1-Click Role Switch (Demo)'}
              </div>

              {roleKeys.map((key) => {
                const r = roles[key];
                const isCurrent = r.key === user.key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectRole(key)}
                    className={`w-full text-left px-3 py-2 flex items-start gap-2.5 hover:bg-slate-800 transition-colors ${
                      isCurrent ? 'bg-slate-800/80 border-l-2 border-amber-400' : ''
                    }`}
                    role="menuitem"
                  >
                    <div className="mt-0.5">
                      {isCurrent ? (
                        <Check className="h-4 w-4 text-amber-400" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-slate-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-white truncate">
                          {isHindi ? r.nameHi || r.name : r.name}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${r.badgeBg} ${r.badgeText}`}>
                          {isHindi ? r.labelHi : r.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">
                        {isHindi ? r.designationHi || r.designation : r.designation}
                      </p>
                      <span className="text-[9px] font-mono text-slate-500">
                        {r.id}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Dual Window Demo Button */}
        <button
          type="button"
          id="btn-dual-window-demo"
          onClick={handleOpenDualWindow}
          title={
            isHindi
              ? 'अगली आधिकारिक भूमिका के साथ नई विंडो खोलें (लाइव क्रॉस-विंडो सिंक)'
              : 'Open second window with next role for live cross-window verification'
          }
          className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-xs font-bold transition-all shadow-xs"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="hidden sm:inline">
            {isHindi ? 'डुअल-विंडो डेमो' : 'Dual-Window Demo'}
          </span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </button>

        {/* Sign Out to e-Pramaan SSO */}
        <button
          type="button"
          id="btn-sso-logout"
          onClick={logout}
          title={isHindi ? 'ई-प्रमाण एसएसओ सत्र समाप्त करें' : 'Sign Out to e-Pramaan SSO'}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 rounded text-xs font-bold transition-colors shadow-xs"
        >
          <LogOut className="h-3.5 w-3.5 text-rose-400 shrink-0" />
          <span>{isHindi ? 'साइन आउट' : 'Sign Out'}</span>
        </button>
      </div>
    </div>
  );
}
