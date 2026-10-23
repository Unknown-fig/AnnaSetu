import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { ROLES, ROLE_KEYS } from './roles';
import { useI18n } from '../i18n/I18nContext';
import { EmblemPlaceholder } from './EmblemPlaceholder';
import { 
  ShieldCheck, 
  Lock, 
  KeyRound, 
  CheckCircle2, 
  ArrowRight, 
  Languages, 
  RotateCw, 
  FileCheck, 
  Award, 
  UserCheck,
  Building2,
  Store,
  Scale
} from 'lucide-react';

export function LoginScreen({ onLoginSuccess }) {
  const { login } = useAuth();
  const { isHindi, setLanguage, t } = useI18n();

  const [selectedRoleKey, setSelectedRoleKey] = useState(null);
  const [officialId, setOfficialId] = useState('');
  const [password, setPassword] = useState('');
  const [otpBoxes, setOtpBoxes] = useState(['', '', '', '', '', '']);
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaCode, setCaptchaCode] = useState('7N9W2');
  const [isTyping, setIsTyping] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationRole, setVerificationRole] = useState(null);

  const typingTimerRef = useRef(null);
  const verifyTimerRef = useRef(null);

  // Refresh captcha string
  const refreshCaptcha = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let res = '';
    for (let i = 0; i < 5; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptchaCode(res);
    setCaptchaInput(res);
  };

  useEffect(() => {
    refreshCaptcha();
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (verifyTimerRef.current) clearTimeout(verifyTimerRef.current);
    };
  }, []);

  // Card click auto-fill animation (~600ms) then auto-login (~800ms)
  const handleCardClick = (roleKey) => {
    const r = ROLES[roleKey];
    if (!r) return;

    setSelectedRoleKey(roleKey);
    setIsTyping(true);

    // Quick progressive filling simulation
    setOfficialId(r.id);
    setPassword('••••••••••••');
    setCaptchaInput(captchaCode);

    const digits = (r.otpPlaceholder || '824915').split('');
    setOtpBoxes(digits);

    // After ~600ms typing animation, transition to verifying
    typingTimerRef.current = setTimeout(() => {
      setIsTyping(false);
      setIsVerifying(true);
      setVerificationRole(r);

      // After ~800ms verifying, execute login
      verifyTimerRef.current = setTimeout(() => {
        login(roleKey);
        if (onLoginSuccess) onLoginSuccess(r.landingTab);
      }, 800);
    }, 600);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const fallbackKey = selectedRoleKey || 'GODOWN_MANAGER';
    handleCardClick(fallbackKey);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* 1. Official 6px Tricolor Strip */}
      <div className="h-1.5 w-full flex" role="presentation" aria-hidden="true">
        <div className="flex-1 bg-[#FF9933]" />
        <div className="flex-1 bg-[#FFFFFF]" />
        <div className="flex-1 bg-[#138808]" />
      </div>

      {/* Top Banner with Language Toggle */}
      <div className="max-w-7xl w-full mx-auto px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
            {isHindi ? 'राष्ट्रीय सूचना विज्ञान केंद्र (NIC) • ई-प्रमाण' : 'National Informatics Centre (NIC) • e-Pramaan'}
          </span>
        </div>

        {/* Bilingual EN / हिन्दी Toggle */}
        <button
          type="button"
          onClick={() => setLanguage(isHindi ? 'en' : 'hi')}
          className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded border border-slate-700 text-xs font-bold transition-all"
          title="Toggle English / Hindi language"
        >
          <Languages className="h-3.5 w-3.5 text-amber-400" />
          <span>{isHindi ? 'English' : 'हिन्दी'}</span>
        </button>
      </div>

      {/* Center Main Two-Panel Split Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:py-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
        {/* Left Panel (5 Cols): Branding, Badges, Mission */}
        <div className="lg:col-span-5 flex flex-col justify-center space-y-6 lg:pr-4">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-white/95 rounded-xl shadow-lg border border-slate-200 shrink-0">
              <EmblemPlaceholder className="h-14 w-14 sm:h-16 sm:w-16" />
            </div>

            <div>
              <span className="text-[11px] font-bold text-amber-400 tracking-wider uppercase block">
                {isHindi ? 'खाद्य एवं रसद विभाग • उत्तर प्रदेश' : 'Food & Civil Supplies Dept • UP'}
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                {isHindi 
                  ? 'अन्नसेतु व एनएफएसए एकीकृत आपूर्ति श्रृंखला पोर्टल (iPDS)' 
                  : 'AnnaSetu & NFSA Integrated Supply Chain Portal (iPDS)'}
              </h1>
            </div>
          </div>

          <div className="h-1 w-24 bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full" />

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {isHindi 
              ? 'गौतम बुद्ध नगर (सूरजपुर बेस गोदाम) अंतर्गत वैधानिक फर्स्ट-इन-फर्स्ट-आउट (FIFO) खाद्यान्न आवंटन, ई-पॉश प्राप्ति व दोहरे-ओटीपी सतर्कता गेट हेतु सुरक्षित एकल लॉगिन।'
              : 'Authorized single-sign-on gateway for statutory FIFO warehouse commodity allocation, e-PoS dealer receipt tracking, and DSO vigilance compliance in Gautam Buddha Nagar.'}
          </p>

          {/* 3 Official Security Trust Badges */}
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
              <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
              <div>
                <div className="text-xs font-bold text-white">
                  {isHindi ? 'एनआईसी ई-प्रमाण एसएसओ द्वारा सुरक्षित' : 'Secured by NIC e-Pramaan SSO'}
                </div>
                <div className="text-[10px] text-slate-400">
                  {isHindi ? 'राष्ट्रीय एकल साइन-ऑन सेवा' : 'National Single Sign-On Infrastructure'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
              <UserCheck className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <div className="text-xs font-bold text-white">
                  {isHindi ? 'आधार ई-केवाईसी व दोहरी बायोमेट्रिक सत्यापन' : 'Aadhaar e-KYC Enabled'}
                </div>
                <div className="text-[10px] text-slate-400">
                  {isHindi ? 'यूआईडीएआई अधिकृत अधिकारी क्रेडेंशियल' : 'UIDAI Authenticated Officer Credentials'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
              <Award className="h-5 w-5 text-blue-400 shrink-0" />
              <div>
                <div className="text-xs font-bold text-white">
                  {isHindi ? 'आईएसओ 27001 प्रमाणित आपूर्ति श्रृंखला' : 'ISO 27001 Certified'}
                </div>
                <div className="text-[10px] text-slate-400">
                  {isHindi ? 'क्रिप्टोग्राफिक एसएचए-256 अपरिवर्तनीय लेजर' : 'Cryptographic SHA-256 Tamper-Proof Trail'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel (7 Cols): 1-Click Role Cards & Interactive Form */}
        <div className="lg:col-span-7 bg-slate-950/90 border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-7 relative overflow-hidden">
          {/* Active Verifying Modal Overlay */}
          {isVerifying && (
            <div className="absolute inset-0 bg-slate-950/95 z-30 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
              <div className="relative mb-4">
                <div className="h-16 w-16 rounded-full border-4 border-amber-400/20 border-t-amber-400 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <ShieldCheck className="h-7 w-7 text-amber-400 animate-pulse" />
                </div>
              </div>

              <h3 className="text-lg font-black text-white">
                {isHindi ? 'ई-प्रमाण एसएसओ द्वारा सत्यापन जारी...' : 'Verifying with e-Pramaan...'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                {isHindi 
                  ? `अधिकारी सत्र प्रारंभ: ${verificationRole?.nameHi || verificationRole?.name} (${verificationRole?.id})`
                  : `Authorizing session for ${verificationRole?.name} (${verificationRole?.id})...`}
              </p>
              <div className="mt-4 px-3 py-1 rounded bg-amber-500/20 text-amber-300 text-xs font-mono font-bold border border-amber-500/30">
                Landing Tab ➔ {verificationRole?.landingTab?.toUpperCase()}
              </div>
            </div>
          )}

          {/* Heading */}
          <div className="mb-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-400" />
                <span>
                  {isHindi 
                    ? 'त्वरित डेमो लॉगिन हेतु अधिकृत अधिकारी पद चुनें' 
                    : 'Select Authorized Official Role for Instant Demo Login'}
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isHindi 
                ? 'मूल्यांकन हेतु किसी भी कार्ड पर 1-क्लिक करें — क्रेडेंशियल स्वतः भरे जाएंगे और सत्र तुरंत प्रारंभ होगा:' 
                : 'Click any role below for 1-click animated auto-fill and instant e-Pramaan simulated authorization:'}
            </p>
          </div>

          {/* 3 One-Click Role Cards */}
          <div className="grid grid-cols-1 gap-2.5 sm:gap-3 mb-6">
            {ROLE_KEYS.map((key) => {
              const r = ROLES[key];
              const isSelected = selectedRoleKey === key;
              const IconComponent = key === 'GODOWN_MANAGER' ? Building2 : key === 'FPS_DEALER' ? Store : Scale;

              return (
                <button
                  key={key}
                  type="button"
                  id={`role-login-card-${key}`}
                  onClick={() => handleCardClick(key)}
                  disabled={isTyping || isVerifying}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                    isSelected 
                      ? 'bg-slate-800/90 border-amber-400 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400' 
                      : 'bg-slate-900/90 hover:bg-slate-800/80 border-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-lg border mt-0.5 shrink-0 ${r.badgeBg} ${r.badgeBorder} text-white`}>
                      <IconComponent className="h-5 w-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-white group-hover:text-amber-300 transition-colors">
                          {isHindi ? r.nameHi || r.name : r.name}
                        </span>
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.2 rounded border ${r.badgeBg} ${r.badgeText} ${r.badgeBorder}`}>
                          {isHindi ? r.labelHi : r.label}
                        </span>
                      </div>

                      <div className="text-xs text-slate-300 mt-0.5">
                        {isHindi ? r.designationHi || r.designation : r.designation}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 font-mono">
                        <span>{isHindi ? r.locationHi || r.location : r.location}</span>
                        <span>•</span>
                        <span className="text-slate-300 font-bold">{r.maskedId}</span>
                      </div>
                    </div>
                  </div>

                  {/* Digital Signature Active Badge */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-[10px] font-bold text-emerald-300">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      <span>{isHindi ? 'डिजिटल हस्ताक्षर: सक्रिय' : 'Digital Signature: Active'}</span>
                    </span>
                    <span className="text-[10px] text-amber-400 font-bold group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                      <span>{isHindi ? 'क्लिक कर लॉगिन करें' : '1-Click Login'}</span>
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Traditional e-Pramaan Form (Auto-filled on click, manual typing also allowed) */}
          <form onSubmit={handleManualSubmit} className="space-y-4 pt-3 border-t border-slate-800">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>{isHindi ? 'पारंपरिक ई-प्रमाण क्रेडेंशियल प्रपत्र' : 'Official e-Pramaan SSO Credentials'}</span>
              <span className="text-amber-400/90 text-[10px] font-normal lowercase">
                ({isHindi ? 'कार्ड पर क्लिक करने पर स्वतः भरता है' : 'Auto-filled on role card click'})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Official ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isHindi ? 'अधिकारी पहचान संख्या (Official ID)' : 'Official Officer ID'}
                </label>
                <input
                  type="text"
                  value={officialId}
                  onChange={(e) => setOfficialId(e.target.value)}
                  placeholder="e.g. UP-FCI-4092"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isHindi ? 'एसएसओ पासवर्ड (Password)' : 'SSO Password'}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Aadhaar OTP (6 boxes) & Captcha */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 6 OTP Boxes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                  <span>{isHindi ? 'आधार 6-अंकीय ओटीपी' : 'Aadhaar 6-Digit OTP'}</span>
                </label>
                <div className="flex gap-1.5">
                  {otpBoxes.map((digit, idx) => (
                    <input
                      key={idx}
                      type="text"
                      maxLength={1}
                      value={digit}
                      readOnly
                      className="w-full text-center bg-slate-900 border border-slate-700 rounded-md py-1.5 text-xs font-mono font-bold text-amber-300"
                    />
                  ))}
                </div>
              </div>

              {/* Captcha with refresh */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isHindi ? 'सुरक्षा कैप्चा' : 'Security Captcha'}
                </label>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1.5 bg-slate-800 rounded border border-slate-700 text-sm font-mono font-bold tracking-widest text-amber-400 select-none line-through">
                    {captchaCode}
                  </div>
                  <input
                    type="text"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    placeholder="Code"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-400 focus:outline-none uppercase"
                  />
                  <button
                    type="button"
                    onClick={refreshCaptcha}
                    title="Refresh Captcha"
                    className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              id="btn-epramaan-submit"
              disabled={isTyping || isVerifying}
              className="w-full mt-2 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isHindi ? 'ई-प्रमाण के माध्यम से सत्र अधिकृत करें' : 'Authorize Session via e-Pramaan'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Small Disclaimer Footer */}
      <footer className="w-full border-t border-slate-800 py-3 px-4 text-center text-[11px] text-slate-400">
        <p>
          {isHindi
            ? 'हैकाथॉन डेमो सिमुलेशन। एनआईसी / एमईआईटीवाई से संबद्ध नहीं। केवल प्रदर्शन हेतु मास्क आईडी (उदा. XXXX-XXXX-4092)।'
            : 'Hackathon demo simulation. Not affiliated with NIC / MeitY. Sample masked IDs for demonstration only (e.g. XXXX-XXXX-1234).'}
        </p>
      </footer>
    </div>
  );
}
