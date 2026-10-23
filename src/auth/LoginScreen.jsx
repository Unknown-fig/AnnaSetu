import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { ROLES, ROLE_KEYS } from './roles';
import { useI18n } from '../i18n/I18nContext';
import { EmblemPlaceholder } from './EmblemPlaceholder';
import { RotateCw } from 'lucide-react';

export function LoginScreen({ onLoginSuccess }) {
  const { login } = useAuth();
  const { isHindi, setLanguage } = useI18n();

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
    setCaptchaInput('');
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

  const handleCancel = () => {
    setSelectedRoleKey(null);
    setOfficialId('');
    setPassword('');
    setCaptchaInput('');
    setOtpBoxes(['', '', '', '', '', '']);
    refreshCaptcha();
  };

  const setFontSizeScale = (scale) => {
    document.documentElement.classList.remove('font-scale-sm', 'font-scale-md', 'font-scale-lg');
    if (scale === 'sm') document.documentElement.classList.add('font-scale-sm');
    if (scale === 'lg') document.documentElement.classList.add('font-scale-lg');
  };

  const todayString = new Date().toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-gray-800 flex flex-col justify-between font-sans">
      <div>
        {/* 1. Official 6px Tricolor Strip */}
        <div className="h-[6px] w-full flex border-b border-gray-300" role="presentation" aria-hidden="true">
          <div className="flex-1 bg-[#FF9933]" />
          <div className="flex-1 bg-[#FFFFFF] border-l border-r border-gray-200" />
          <div className="flex-1 bg-[#138808]" />
        </div>

        {/* 2. Thin Utility Bar (#F1F1F1, 12px text) */}
        <div className="bg-[#F1F1F1] border-b border-gray-300 py-1 px-4 text-[12px] text-gray-700">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a
                href="#officialId"
                className="hover:underline text-gray-700 font-semibold focus:outline-none focus:ring-1 focus:ring-[#1F5FA8]"
              >
                {isHindi ? 'मुख्य सामग्री पर जाएं' : 'Skip to main content'}
              </a>
              <span className="text-gray-400">|</span>
              <a
                href="#screen-reader"
                onClick={(e) => {
                  e.preventDefault();
                  alert(isHindi ? 'स्क्रीन रीडर एक्सेस सक्रिय है।' : 'Screen reader access is enabled.');
                }}
                className="hover:underline text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#1F5FA8]"
              >
                {isHindi ? 'स्क्रीन रीडर एक्सेस' : 'Screen Reader Access'}
              </a>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-[11px] text-gray-600">
                <span className="hidden sm:inline">{isHindi ? 'फ़ॉन्ट आकार' : 'Text Size'}:</span>
                <button
                  type="button"
                  onClick={() => setFontSizeScale('sm')}
                  className="px-1.5 py-0.5 border border-gray-300 bg-white hover:bg-gray-100 rounded-[2px] font-bold text-[11px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#1F5FA8]"
                  title="Small Font Size"
                >
                  A-
                </button>
                <button
                  type="button"
                  onClick={() => setFontSizeScale('md')}
                  className="px-1.5 py-0.5 border border-gray-300 bg-white hover:bg-gray-100 rounded-[2px] font-bold text-[11px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#1F5FA8]"
                  title="Normal Font Size"
                >
                  A
                </button>
                <button
                  type="button"
                  onClick={() => setFontSizeScale('lg')}
                  className="px-1.5 py-0.5 border border-gray-300 bg-white hover:bg-gray-100 rounded-[2px] font-bold text-[11px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#1F5FA8]"
                  title="Large Font Size"
                >
                  A+
                </button>
              </div>

              <span className="text-gray-400">|</span>

              {/* EN | हिन्दी toggle */}
              <button
                type="button"
                onClick={() => setLanguage(isHindi ? 'en' : 'hi')}
                className="font-bold text-[#0B2A5B] hover:underline focus:outline-none focus:ring-1 focus:ring-[#1F5FA8]"
                title="Toggle Language / भाषा बदलें"
              >
                {isHindi ? 'English' : 'हिन्दी'}
              </button>
            </div>
          </div>
        </div>

        {/* 3. Header: White background, emblem placeholder, department style, 1px navy bottom border */}
        <header className="bg-white border-b border-[#0B2A5B] py-3 px-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <EmblemPlaceholder className="h-14 w-14 shrink-0" />
              <div>
                <div className="text-[13px] font-semibold text-gray-700 uppercase tracking-wide leading-tight">
                  उत्तर प्रदेश सरकार / Government of Uttar Pradesh
                </div>
                <div className="text-[18px] font-bold text-[#0B2A5B] leading-tight">
                  {isHindi ? 'खाद्य तथा रसद विभाग' : 'Department of Food & Civil Supplies'}
                </div>
              </div>
            </div>

            <div className="hidden sm:block text-right">
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                National Single Sign-On
              </div>
              <div className="text-[14px] font-bold text-[#0B2A5B]">
                e-Pramaan • JanParichay
              </div>
            </div>
          </div>
        </header>

        {/* 4. Body: Single bordered container (1px #C9CED6, radius 2px, faint shadow) */}
        <main className="max-w-6xl w-full mx-auto px-4 py-6">
          <div className="border border-[#C9CED6] rounded-[2px] bg-white grid grid-cols-1 md:grid-cols-12 md:divide-x divide-[#C9CED6] shadow-xs overflow-hidden">
            
            {/* Left Column (5 Cols): Plain text block, notices, flat security badges */}
            <div className="md:col-span-5 p-5 sm:p-6 flex flex-col justify-between">
              <div>
                <h1 className="text-[18px] font-bold text-[#0B2A5B] mb-2 leading-snug">
                  {isHindi 
                    ? 'अन्नसेतु व एनएफएसए एकीकृत आपूर्ति श्रृंखला पोर्टल (iPDS)' 
                    : 'AnnaSetu & NFSA Integrated Supply Chain Portal (iPDS)'}
                </h1>

                <p className="text-[13px] text-gray-600 leading-relaxed mb-5">
                  {isHindi 
                    ? 'राष्ट्रीय खाद्य सुरक्षा अधिनियम (NFSA) एवं लक्षित सार्वजनिक वितरण प्रणाली (TPDS) अंतर्गत खाद्यान्न भंडारण, फर्स्ट-इन-फर्स्ट-आउट (FIFO) स्टॉक प्रेषण एवं उचित दर दुकान वितरण हेतु अधिकृत एकल लॉगिन।' 
                    : 'Authorized single-sign-on gateway for statutory FIFO warehouse commodity allocation, e-PoS dealer receipt tracking, and DSO vigilance compliance in Gautam Buddha Nagar.'}
                </p>

                {/* Plain bulleted notices block */}
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-[2px] mb-5 text-[12px] text-gray-700">
                  <div className="font-bold text-[#0B2A5B] mb-1.5">
                    {isHindi ? 'महत्वपूर्ण सुरक्षा निर्देश' : 'Important Security Instructions'}:
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-gray-600">
                    <li>{isHindi ? 'केवल अपनी आधिकारिक विभागीय पहचान (Official ID) का उपयोग करें।' : 'Use only your official credentials.'}</li>
                    <li>{isHindi ? 'अपना आधार ओटीपी अथवा पासवर्ड किसी के साथ साझा न करें।' : 'Never share your OTP.'}</li>
                    <li>{isHindi ? 'अनधिकृत प्रवेश आईटी अधिनियम 2000 के तहत दंडनीय अपराध है।' : 'Unauthorized access is punishable under IT Act, 2000.'}</li>
                  </ul>
                </div>
              </div>

              {/* Three security badges rendered as small flat bordered labels (not glossy chips) */}
              <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  {isHindi ? 'सुरक्षा एवं प्रमाणीकरण मानक' : 'Security & Verification Standards'}
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1.5 rounded-[2px] text-[12px] text-gray-800 flex items-center gap-2">
                    <span className="font-bold text-[#0B2A5B]">✓</span>
                    <span>{isHindi ? 'एनआईसी ई-प्रमाण एसएसओ द्वारा सुरक्षित' : 'Secured by NIC e-Pramaan SSO'}</span>
                  </div>
                  <div className="border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1.5 rounded-[2px] text-[12px] text-gray-800 flex items-center gap-2">
                    <span className="font-bold text-[#0B2A5B]">✓</span>
                    <span>{isHindi ? 'आधार ई-केवाईसी सक्षम' : 'Aadhaar e-KYC Enabled'}</span>
                  </div>
                  <div className="border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1.5 rounded-[2px] text-[12px] text-gray-800 flex items-center gap-2">
                    <span className="font-bold text-[#0B2A5B]">✓</span>
                    <span>{isHindi ? 'आईएसओ 27001 प्रमाणित आपूर्ति श्रृंखला' : 'ISO 27001 Certified'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (7 Cols): Navy Title Bar, Demo Roles Panel, Stacked Form */}
            <div className="md:col-span-7 flex flex-col relative">
              {/* Plain Verifying Overlay (No flashy animations, plain spinner) */}
              {isVerifying && (
                <div className="absolute inset-0 bg-white/95 z-30 flex flex-col items-center justify-center p-6 text-center">
                  <div className="h-8 w-8 border-2 border-[#C9CED6] border-t-[#0B2A5B] rounded-full animate-spin mb-3" />
                  <div className="text-[15px] font-bold text-[#0B2A5B]">
                    {isHindi ? 'ई-प्रमाण एसएसओ द्वारा सत्यापन जारी...' : 'Verifying with e-Pramaan...'}
                  </div>
                  <div className="text-[12px] text-gray-600 mt-1 max-w-sm">
                    {isHindi 
                      ? `अधिकारी सत्र प्रारंभ: ${verificationRole?.nameHi || verificationRole?.name} (${verificationRole?.id})`
                      : `Authorizing session for ${verificationRole?.name} (${verificationRole?.id})...`}
                  </div>
                </div>
              )}

              {/* Navy Title Bar: #0B2A5B, white 14px bold text */}
              <div className="bg-[#0B2A5B] text-white px-4 py-2.5 text-[14px] font-bold flex items-center justify-between">
                <span>{isHindi ? 'विभागीय लॉगिन' : 'Official Login'}</span>
                <span className="text-[11px] font-normal tracking-wide text-gray-200">NIC e-Pramaan SSO</span>
              </div>

              <div className="p-4 sm:p-5 flex flex-col gap-4">
                {/* 6. Demo Role Cards: Separated bordered panel with light yellow header strip (#FFF4CE) */}
                <div className="border border-[#CBD5E1] rounded-[2px] overflow-hidden bg-white">
                  <div className="bg-[#FFF4CE] border-b border-[#F5E6A3] px-3 py-1.5 flex items-center justify-between text-[12px] font-bold text-[#7A5B04]">
                    <span>
                      {isHindi 
                        ? 'डेमो अभिगम (हैकाथॉन): अधिकारी पद चुनें' 
                        : 'DEMO ACCESS (Hackathon): select a role'}
                    </span>
                    <span className="text-[10px] font-normal text-[#8A6A08] hidden sm:inline">
                      {isHindi ? '1-क्लिक स्वतः भरण' : '1-click auto-fill'}
                    </span>
                  </div>

                  {/* Compact Table-like List */}
                  <div className="divide-y divide-gray-200">
                    {ROLE_KEYS.map((key) => {
                      const r = ROLES[key];
                      const isSelected = selectedRoleKey === key;

                      return (
                        <div
                          key={key}
                          id={`role-login-card-${key}`}
                          onClick={() => handleCardClick(key)}
                          className={`p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#EBF3FB]' : 'hover:bg-[#F5F8FC]'
                          }`}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleCardClick(key);
                            }
                          }}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {/* Small Role Label */}
                            <span className="shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-[2px] border border-gray-300 bg-gray-100 text-[#0B2A5B]">
                              {key === 'DSO' ? (isHindi ? 'डीएसओ (DSO)' : 'DSO') : (isHindi ? r.labelHi : r.label)}
                            </span>

                            {/* Name and ID */}
                            <span className="text-[13px] font-bold text-gray-900 whitespace-nowrap">
                              {isHindi ? r.nameHi || r.name : r.name}
                            </span>
                            <span className="text-[11px] font-mono text-gray-500 whitespace-nowrap">
                              ({r.id})
                            </span>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 ml-auto sm:ml-0">
                            {/* Digital Signature: Active (Small Green Text) */}
                            <span className="text-[11px] font-semibold text-[#1B6B2F] flex items-center gap-1 whitespace-nowrap">
                              <span>●</span>
                              <span>{isHindi ? 'डिजिटल हस्ताक्षर: सक्रिय' : 'Digital Signature: Active'}</span>
                            </span>

                            {/* Small Outlined Login Button */}
                            <button
                              type="button"
                              disabled={isTyping || isVerifying}
                              className="text-[12px] font-bold px-3 py-1 border border-[#1F5FA8] text-[#1F5FA8] hover:bg-[#1F5FA8] hover:text-white rounded-[2px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#1F5FA8]"
                            >
                              {isHindi ? 'लॉगिन' : 'Login'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 5. Traditional Form: Stacked fields, visible labels, square inputs (2px radius, 36px height) */}
                <form id="official-login-form" onSubmit={handleManualSubmit} className="space-y-3 pt-1">
                  {/* Official ID */}
                  <div>
                    <label htmlFor="officialId" className="block text-[12px] font-bold text-gray-700 mb-1">
                      {isHindi ? 'अधिकारी पहचान संख्या (Official ID)' : 'Official ID'}
                      <span className="text-[#B00020] ml-0.5">*</span>
                    </label>
                    <input
                      id="officialId"
                      type="text"
                      value={officialId}
                      onChange={(e) => setOfficialId(e.target.value)}
                      placeholder="e.g. UP-FCI-4092"
                      className="w-full h-[36px] px-3 bg-white border border-[#C9CED6] rounded-[2px] text-[13px] font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] focus:border-[#1F5FA8]"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label htmlFor="password" className="block text-[12px] font-bold text-gray-700 mb-1">
                      {isHindi ? 'एसएसओ पासवर्ड (Password)' : 'Password'}
                      <span className="text-[#B00020] ml-0.5">*</span>
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full h-[36px] px-3 bg-white border border-[#C9CED6] rounded-[2px] text-[13px] font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] focus:border-[#1F5FA8]"
                    />
                  </div>

                  {/* Captcha & Aadhaar OTP Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Captcha */}
                    <div>
                      <label htmlFor="captcha" className="block text-[12px] font-bold text-gray-700 mb-1">
                        {isHindi ? 'सुरक्षा कैप्चा' : 'Security Captcha'}
                        <span className="text-[#B00020] ml-0.5">*</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        {/* Distorted text box */}
                        <div 
                          className="h-[36px] px-2.5 bg-[#E8EEF5] border border-[#CBD5E1] rounded-[2px] text-[15px] font-mono font-bold tracking-widest text-[#0B2A5B] flex items-center justify-center select-none line-through italic"
                          style={{ letterSpacing: '4px' }}
                          aria-label={`Captcha: ${captchaCode}`}
                        >
                          {captchaCode}
                        </div>
                        <button
                          type="button"
                          onClick={refreshCaptcha}
                          title={isHindi ? 'कैप्चा कोड बदलें' : 'Refresh Captcha'}
                          className="h-[36px] w-[36px] flex items-center justify-center border border-[#C9CED6] text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-[2px] focus:outline-none focus:ring-2 focus:ring-[#1F5FA8]"
                        >
                          <RotateCw className="h-4 w-4" />
                        </button>
                        <input
                          id="captcha"
                          type="text"
                          value={captchaInput}
                          onChange={(e) => setCaptchaInput(e.target.value)}
                          placeholder={isHindi ? 'कोड दर्ज करें' : 'Code'}
                          className="flex-1 min-w-0 h-[36px] px-2.5 bg-white border border-[#C9CED6] rounded-[2px] text-[13px] uppercase font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] focus:border-[#1F5FA8]"
                        />
                      </div>
                    </div>

                    {/* Aadhaar OTP (6 boxes) */}
                    <div>
                      <label className="block text-[12px] font-bold text-gray-700 mb-1">
                        {isHindi ? 'आधार 6-अंकीय ओटीपी' : 'Aadhaar 6-Digit OTP'}
                      </label>
                      <div className="flex gap-1.5">
                        {otpBoxes.map((digit, idx) => (
                          <input
                            key={idx}
                            type="text"
                            maxLength={1}
                            value={digit}
                            readOnly
                            aria-label={`OTP digit ${idx + 1}`}
                            className="flex-1 min-w-0 h-[36px] text-center bg-gray-50 border border-[#C9CED6] rounded-[2px] text-[14px] font-mono font-bold text-gray-900"
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Buttons and Forgot Password */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {/* Plain Blue Login Button (#1F5FA8, 2px radius, no gradient) */}
                      <button
                        type="submit"
                        id="btn-epramaan-submit"
                        disabled={isTyping || isVerifying}
                        className="h-[36px] px-6 bg-[#1F5FA8] hover:bg-[#184a83] text-white font-bold text-[13px] rounded-[2px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] focus:ring-offset-1 cursor-pointer disabled:opacity-60"
                      >
                        {isHindi ? 'लॉगिन' : 'Login'}
                      </button>

                      {/* Cancel button */}
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={isTyping || isVerifying}
                        className="h-[36px] px-4 bg-white hover:bg-gray-100 text-gray-700 font-semibold text-[13px] border border-[#C9CED6] rounded-[2px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#1F5FA8]"
                      >
                        {isHindi ? 'रद्द करें' : 'Cancel'}
                      </button>
                    </div>

                    {/* Forgot Password link */}
                    <a
                      href="#forgot"
                      onClick={(e) => {
                        e.preventDefault();
                        alert(isHindi ? 'डेमो मोड: कृपया ऊपर दिए गए 1-क्लिक डेमो कार्ड का उपयोग करें।' : 'Demo mode: Please use the 1-click official role cards above.');
                      }}
                      className="text-[12px] text-[#1F5FA8] hover:underline"
                    >
                      {isHindi ? 'पासवर्ड भूल गए?' : 'Forgot Password?'}
                    </a>
                  </div>
                </form>
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* 7. Footer: Navy strip (#0B2A5B) with white 12px links, helpline, date, and disclaimer */}
      <footer className="w-full bg-[#0B2A5B] text-white py-3 px-4 mt-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 text-[12px] text-gray-300">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <a href="#terms" onClick={(e) => e.preventDefault()} className="hover:underline hover:text-white">
              {isHindi ? 'नियम व शर्तें' : 'Terms & Conditions'}
            </a>
            <span>|</span>
            <a href="#privacy" onClick={(e) => e.preventDefault()} className="hover:underline hover:text-white">
              {isHindi ? 'गोपनीयता नीति' : 'Privacy Policy'}
            </a>
            <span>|</span>
            <a href="#help" onClick={(e) => e.preventDefault()} className="hover:underline hover:text-white">
              {isHindi ? 'सहायता' : 'Help'}
            </a>
            <span>|</span>
            <a href="#contact" onClick={(e) => e.preventDefault()} className="hover:underline hover:text-white">
              {isHindi ? 'संपर्क करें' : 'Contact Us'}
            </a>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span>{isHindi ? 'हेल्पलाइन' : 'Helpline'}: <strong className="text-white">1967</strong> ({isHindi ? 'टोल फ्री' : 'Toll Free'})</span>
            <span>•</span>
            <span>{isHindi ? 'अंतिम अद्यतन' : 'Last updated'}: {todayString}</span>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-2 pt-2 border-t border-[#1C3E75] text-center text-[11px] text-gray-300">
          {isHindi
            ? 'हैकाथॉन डेमो सिमुलेशन। एनआईसी / एमईआईटीवाई से संबद्ध नहीं। केवल प्रदर्शन हेतु मास्क आईडी (उदा. XXXX-XXXX-1234)।'
            : 'Hackathon demo simulation. Not affiliated with NIC / MeitY. Sample masked IDs for demonstration only (e.g. XXXX-XXXX-1234).'}
        </div>
      </footer>
    </div>
  );
}
