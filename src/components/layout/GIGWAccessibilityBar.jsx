import React, { useCallback } from 'react';
import { Eye, Type, Globe, ArrowDownToLine } from 'lucide-react';

export const GIGWAccessibilityBar = React.memo(function GIGWAccessibilityBar({
  fontSize,
  setFontSize,
  isHighContrast,
  setIsHighContrast,
  language,
  setLanguage,
}) {
  const handleSkipToContent = useCallback((e) => {
    e.preventDefault();
    const element = document.getElementById('main-content');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      element.focus({ preventScroll: true });
    }
  }, []);

  const handleFontSm = useCallback(() => setFontSize('sm'), [setFontSize]);
  const handleFontMd = useCallback(() => setFontSize('md'), [setFontSize]);
  const handleFontLg = useCallback(() => setFontSize('lg'), [setFontSize]);
  const handleToggleContrast = useCallback(() => setIsHighContrast(prev => !prev), [setIsHighContrast]);
  const handleToggleLanguage = useCallback(() => setLanguage(lang => lang === 'hi' ? 'en' : 'hi'), [setLanguage]);

  return (
    <div
      id="gigw-bar"
      className="h-8 bg-[#0f172a] text-white text-xs px-3 sm:px-6 flex items-center justify-between border-b border-slate-800 z-50 select-none"
    >
      {/* Left: Official Ministry Name */}
      <div className="flex items-center gap-2 truncate">
        {/* Ashoka mini flag tricolor stripe */}
        <div className="flex h-3 w-4 rounded-sm overflow-hidden flex-col flex-shrink-0 shadow-sm border border-slate-700">
          <div className="h-1 bg-[#ff9933]"></div>
          <div className="h-1 bg-white flex items-center justify-center">
            <div className="h-0.5 w-0.5 rounded-full bg-[#000080]"></div>
          </div>
          <div className="h-1 bg-[#138808]"></div>
        </div>
        <span className="font-semibold tracking-wide text-[11px] truncate text-slate-200">
          {language === 'hi'
            ? 'भारत सरकार | उपभोक्ता मामले, खाद्य एवं सार्वजनिक वितरण मंत्रालय'
            : 'भारत सरकार | GOVERNMENT OF INDIA — MINISTRY OF CONSUMER AFFAIRS, FOOD & PUBLIC DISTRIBUTION'}
        </span>
      </div>

      {/* Right: Interactive Accessibility & Language Controls */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {/* Skip to Main Content */}
        <a
          href="#main-content"
          onClick={handleSkipToContent}
          className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-300 hover:text-white hover:bg-slate-800 focus:bg-amber-500 focus:text-slate-950 transition-colors"
          title="Skip to Main Content (मुख्य सामग्री पर जाएं)"
        >
          <ArrowDownToLine className="h-3 w-3" />
          <span>Skip to Main Content</span>
        </a>

        <div className="hidden sm:block h-3.5 w-px bg-slate-700"></div>

        {/* Font Size Resizer (A-, A, A+) */}
        <div className="flex items-center bg-slate-800/80 rounded border border-slate-700/80 overflow-hidden text-[10px] font-mono">
          <button
            type="button"
            onClick={handleFontSm}
            title="Decrease Font Size (छोटा फ़ॉन्ट)"
            aria-label="Decrease Font Size"
            className={`px-1.5 py-0.5 font-bold hover:bg-slate-700 transition-colors ${
              fontSize === 'sm' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
            }`}
          >
            A-
          </button>
          <button
            type="button"
            onClick={handleFontMd}
            title="Standard Font Size (सामान्य फ़ॉन्ट)"
            aria-label="Reset Font Size"
            className={`px-1.5 py-0.5 font-bold border-x border-slate-700 hover:bg-slate-700 transition-colors ${
              fontSize === 'md' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
            }`}
          >
            A
          </button>
          <button
            type="button"
            onClick={handleFontLg}
            title="Increase Font Size (बड़ा फ़ॉन्ट)"
            aria-label="Increase Font Size"
            className={`px-1.5 py-0.5 font-bold hover:bg-slate-700 transition-colors ${
              fontSize === 'lg' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
            }`}
          >
            A+
          </button>
        </div>

        <div className="hidden sm:block h-3.5 w-px bg-slate-700"></div>

        {/* High Contrast Mode Toggle */}
        <button
          type="button"
          onClick={handleToggleContrast}
          title="Toggle High Contrast Mode (उच्च कंट्रास्ट)"
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors border ${
            isHighContrast
              ? 'bg-yellow-400 text-slate-950 border-yellow-300 font-bold'
              : 'text-slate-300 border-slate-700 hover:bg-slate-800'
          }`}
        >
          <Eye className="h-3 w-3" />
          <span className="hidden sm:inline">High Contrast</span>
          <span className="sm:hidden">HC</span>
        </button>

        <div className="h-3.5 w-px bg-slate-700"></div>

        {/* Bilingual Hindi / English Toggle */}
        <button
          type="button"
          onClick={handleToggleLanguage}
          title="Switch Language / भाषा बदलें"
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-200 bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors"
        >
          <Globe className="h-3 w-3 text-amber-400" />
          <span>{language === 'hi' ? 'English' : 'हिंदी'}</span>
        </button>
      </div>
    </div>
  );
});

