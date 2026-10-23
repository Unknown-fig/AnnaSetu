import React, { useRef, useCallback } from 'react';

export const OtpBoxesInput = React.memo(function OtpBoxesInput({
  value = '',
  onChange,
  disabled = false,
  idPrefix = 'otp',
}) {
  const inputsRef = useRef([]);

  // Ensure 6 characters array
  const chars = Array.from({ length: 6 }, (_, i) => value[i] || '');

  const handleChange = useCallback((index, e) => {
    const val = e.target.value.replace(/\D/g, ''); // numeric only
    const newChars = [...chars];

    if (!val) {
      newChars[index] = '';
      onChange(newChars.join(''));
      return;
    }

    // Single digit input
    const char = val.slice(-1);
    newChars[index] = char;
    onChange(newChars.join(''));

    // Move to next box
    if (index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  }, [chars, onChange]);

  const handleKeyDown = useCallback((index, e) => {
    if (e.key === 'Backspace' && !chars[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }, [chars]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    onChange(pasted);
    const targetFocus = Math.min(pasted.length, 5);
    inputsRef.current[targetFocus]?.focus();
  }, [onChange]);

  return (
    <div className="flex items-center gap-2 justify-center" onPaste={handlePaste}>
      {chars.map((char, index) => (
        <input
          key={index}
          id={`${idPrefix}-box-${index}`}
          ref={el => (inputsRef.current[index] = el)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={char}
          disabled={disabled}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          className={`w-10 h-12 text-center text-lg font-mono font-bold rounded-lg border-2 transition-all focus:outline-none ${
            disabled
              ? 'bg-slate-100 text-slate-400 border-slate-300 cursor-not-allowed'
              : char
              ? 'border-[#0B2A5B] bg-blue-50 text-[#0B2A5B] shadow-xs'
              : 'border-slate-300 bg-white text-slate-800 focus:border-[#0B2A5B] focus:ring-2 focus:ring-blue-200'
          }`}
        />
      ))}
    </div>
  );
});
