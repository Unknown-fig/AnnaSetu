import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../../context/store';
import { ACTION_TYPES } from '../../context/actions';
import { useI18n } from '../../i18n/I18nContext';
import { parseVoiceCommand } from '../../services/voiceParser';
import { 
  startListening, 
  stopListening, 
  speakFeedback, 
  isSpeechRecognitionSupported 
} from '../../services/voiceService';
import { createChainedEventHash } from '../../services/cryptoService';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  CheckCircle, 
  AlertCircle, 
  Sparkles, 
  Send, 
  HelpCircle,
  WifiOff,
  Keyboard
} from 'lucide-react';

const SAMPLE_CHIPS = [
  { label: 'Dispatch 120 Quintal Wheat to FPS Kasna', lang: 'en' },
  { label: '120 क्विंटल गेहूं कसना FPS को भेजो', lang: 'hi' },
  { label: 'Rice 80 quintal FPS 104', lang: 'en' },
  { label: 'Show oldest batch of Wheat', lang: 'en' },
];

export const VoiceMic = React.memo(function VoiceMic({
  onApplyParsed,
  onConfirmStage,
  onQueryOldestBatch,
  disabled = false,
}) {
  const { state, dispatch } = useStore();
  const { isHindi, t } = useI18n();

  const [isListening, setIsListening] = useState(false);
  const [langOverride, setLangOverride] = useState(isHindi ? 'hi-IN' : 'en-IN');
  const [typedInput, setTypedInput] = useState('');
  const [parsedResult, setParsedResult] = useState(null);
  const [speechError, setSpeechError] = useState(null);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  const isOffline = state.networkMode === 'OFFLINE';
  const hasWebSpeech = isSpeechRecognitionSupported();

  // Sync default speech recognition language with app i18n
  useEffect(() => {
    setLangOverride(isHindi ? 'hi-IN' : 'en-IN');
  }, [isHindi]);

  // Clean up listening on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  // Handle parsing and ledger logging
  const handleProcessTranscript = useCallback(async (transcript) => {
    if (!transcript) return;

    const parsed = parseVoiceCommand(transcript);
    setParsedResult(parsed);
    setSpeechError(null);

    // ASYNC SHA-256 for audit ledger
    const timestamp = new Date().toISOString();
    const prevHash = state.auditLogs[0]?.hash || '0000000000000000000000000000000000000000000000000000000000000000';
    const auditHash = await createChainedEventHash(prevHash, timestamp, 'VOICE_COMMAND_PARSED', {
      rawTranscript: transcript,
      intent: parsed.intent,
      commodity: parsed.commodity,
      quantity: parsed.quantity,
      fps: parsed.fps?.id || null,
      confidence: parsed.confidence,
    });

    const auditLog = {
      id: `EVT-VOICE-${Date.now()}`,
      timestamp,
      type: 'VOICE_COMMAND_PARSED',
      title: `Voice Command Parsed: "${transcript.substring(0, 32)}..."`,
      actor: 'Voice Assistant Engine',
      details: `Intent: ${parsed.intent} | Commodity: ${parsed.commodity || 'N/A'} | Qty: ${parsed.quantity || 'N/A'} Qtl | FPS: ${parsed.fps?.name || 'N/A'} (Confidence: ${(parsed.confidence * 100).toFixed(0)}%)`,
      token: auditHash.substring(0, 16).toUpperCase(),
      syncStatus: state.networkMode === 'OFFLINE' ? 'PENDING_SYNC' : 'SYNCED',
      prevHash,
      hash: auditHash,
    };

    dispatch({
      type: ACTION_TYPES.RECORD_VOICE_COMMAND,
      payload: {
        voiceRecord: {
          id: `VC-${Date.now()}`,
          transcript,
          parsed,
          confidence: parsed.confidence,
          timestamp,
        },
        auditLog,
      },
    });

    // Execute Voice Flow based on Intent
    if (parsed.intent === 'DISPATCH' && !parsed.clarificationNeeded) {
      if (onApplyParsed) {
        onApplyParsed({
          commodity: parsed.commodity,
          quantity: parsed.quantity,
          fpsId: parsed.fps?.id,
        });
      }

      setAwaitingConfirm(true);

      // Read-back spoken summary via SpeechSynthesis
      const spokenSummary = isHindi
        ? `${parsed.quantity} क्विंटल ${parsed.commodity} ${parsed.fps?.name || 'FPS'} के लिए। पुष्टि करने के लिए हाँ कहें।`
        : `${parsed.quantity} quintal ${parsed.commodity} for ${parsed.fps?.name || 'FPS'}. Say confirm to stage.`;
      
      speakFeedback(spokenSummary, langOverride);
    } else if (parsed.intent === 'CONFIRM') {
      if (awaitingConfirm && onConfirmStage) {
        setAwaitingConfirm(false);
        onConfirmStage();
      }
    } else if (parsed.intent === 'CANCEL') {
      setAwaitingConfirm(false);
      setParsedResult(null);
    } else if (parsed.intent === 'OLDEST_BATCH' && onQueryOldestBatch) {
      onQueryOldestBatch(parsed.commodity);
      const textResp = isHindi 
        ? `${parsed.commodity} का सबसे पुराना बैच हाइलाइट किया गया है`
        : `Oldest batch of ${parsed.commodity} highlighted in locator`;
      speakFeedback(textResp, langOverride);
    }
  }, [state.auditLogs, state.networkMode, langOverride, isHindi, onApplyParsed, onConfirmStage, onQueryOldestBatch, awaitingConfirm, dispatch]);

  // Start / Stop mic toggle
  const toggleListening = () => {
    if (isListening) {
      stopListening();
      setIsListening(false);
      return;
    }

    if (isOffline) {
      setSpeechError(isHindi 
        ? 'ऑफ़लाइन मोड: ब्राउज़र स्पीच इंजन को नेटवर्क की आवश्यकता है। कृपया नीचे दिए गए टाइप बॉक्स या चिप्स का उपयोग करें।' 
        : 'Offline Mode: Browser Speech Recognition requires network. Please use the typed command box or sample chips below.');
      return;
    }

    if (!hasWebSpeech) {
      setSpeechError(isHindi
        ? 'इस ब्राउज़र में स्पीच रिकग्निशन समर्थित नहीं है। कृपया टाइप करें या चिप्स चुनें।'
        : 'Speech recognition API unsupported. Please use typed input or chips.');
      return;
    }

    setSpeechError(null);
    setIsListening(true);

    startListening({
      lang: langOverride,
      onResult: (transcript) => {
        setIsListening(false);
        handleProcessTranscript(transcript);
      },
      onError: (err) => {
        setIsListening(false);
        setSpeechError(`Speech API: ${err}. Falling back to typed command mode.`);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });
  };

  const handleTypedSubmit = (e) => {
    e.preventDefault();
    if (!typedInput.trim()) return;
    handleProcessTranscript(typedInput.trim());
    setTypedInput('');
  };

  const handleChipClick = (phrase) => {
    handleProcessTranscript(phrase);
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
      {/* Mic Row + Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Min 56px One-Touch Mic Button */}
          <button
            id="btn-voice-mic"
            type="button"
            disabled={disabled}
            onClick={toggleListening}
            aria-label={isHindi ? 'ध्वनि सहायक माइक' : 'Voice Assistant Microphone'}
            className={`h-14 w-14 rounded-full flex items-center justify-center transition-all shadow-md focus:outline-hidden focus:ring-4 focus:ring-blue-400 ${
              isListening
                ? 'bg-red-600 text-white ring-4 ring-red-400/50 animate-pulse'
                : isOffline
                ? 'bg-amber-100 text-amber-800 border-2 border-amber-400 hover:bg-amber-200'
                : 'bg-[#0B2A5B] hover:bg-[#133E7C] text-white hover:scale-105 active:scale-95'
            }`}
            title={isOffline ? 'Offline - Speech API requires network fallback' : 'Click to Speak'}
          >
            {isListening ? (
              <Mic className="h-7 w-7 animate-bounce" />
            ) : isOffline ? (
              <MicOff className="h-6 w-6 text-amber-700" />
            ) : (
              <Mic className="h-7 w-7" />
            )}
          </button>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-[#0B2A5B]">
                {isHindi ? 'आवाज़ द्वारा चालान सहायक' : 'Voice-Assisted Challan'}
              </span>
              <span className="text-[10px] bg-blue-100 text-blue-900 font-mono font-bold px-1.5 py-0.2 rounded border border-blue-200">
                AI FREE • RULE PARSER
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {isListening 
                ? (isHindi ? 'सुन रहा हूँ... बोलिए' : 'Listening... Speak now')
                : (isHindi ? 'माइक दबाएं या नीचे दिए गए नमूना आदेश चुनें' : 'Tap mic to speak or click a sample phrase below')}
            </p>
          </div>
        </div>

        {/* Speech Recognition Language Selector */}
        <div className="flex items-center gap-2 text-xs">
          <label htmlFor="voice-lang-select" className="text-slate-500 text-[11px] font-semibold">
            {isHindi ? 'भाषा' : 'Lang'}:
          </label>
          <select
            id="voice-lang-select"
            value={langOverride}
            onChange={(e) => setLangOverride(e.target.value)}
            className="text-xs font-mono py-1 px-2 border border-slate-300 rounded bg-white text-slate-800"
          >
            <option value="en-IN">English (en-IN)</option>
            <option value="hi-IN">हिन्दी (hi-IN)</option>
          </select>
        </div>
      </div>

      {/* Offline Notice if network simulated offline */}
      {isOffline && (
        <div className="p-2 bg-amber-50 border border-amber-300 rounded text-amber-950 text-xs flex items-center gap-2">
          <WifiOff className="h-4 w-4 text-amber-600 shrink-0" />
          <span>
            <strong>{isHindi ? 'नेटवर्क आवश्यक' : 'Needs network'}:</strong>{' '}
            {isHindi 
              ? 'ब्राउज़र स्पीच इंजन ऑफ़लाइन में असमर्थ है। कृपया टाइप कमांड या प्रीसेट चिप्स का उपयोग करें।' 
              : 'Browser Web Speech API requires network connection. Use the typed box or sample chips below.'}
          </span>
        </div>
      )}

      {/* Fallback Speech Error Warning */}
      {speechError && (
        <div className="p-2 bg-red-50 border border-red-300 rounded text-red-900 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{speechError}</span>
        </div>
      )}

      {/* 4 Tappable Sample Chips */}
      <div>
        <div className="text-[10px] font-bold uppercase text-slate-500 mb-1 flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-amber-500" />
          <span>{isHindi ? 'त्वरित नमूना आदेश (क्लिक करें)' : 'Sample Voice Chips (Click to test)'}:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              id={`btn-voice-chip-${idx}`}
              type="button"
              onClick={() => handleChipClick(chip.label)}
              className="text-xs bg-white hover:bg-blue-50 text-slate-800 border border-slate-300 hover:border-blue-400 px-2.5 py-1 rounded-full transition-all shadow-2xs font-sans hover:text-[#0B2A5B]"
            >
              "{chip.label}"
            </button>
          ))}
        </div>
      </div>

      {/* Typed Command Fallback Input */}
      <form onSubmit={handleTypedSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Keyboard className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            id="input-voice-typed"
            type="text"
            value={typedInput}
            onChange={(e) => setTypedInput(e.target.value)}
            placeholder={isHindi ? 'कमांड टाइप करें (उदा. 120 क्विंटल गेहूं कसना FPS को भेजो)' : 'Type command (e.g., Dispatch 120 Quintal Wheat to FPS Kasna)'}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:border-blue-600 focus:outline-hidden bg-white text-slate-900"
          />
        </div>
        <button
          id="btn-voice-typed-submit"
          type="submit"
          className="px-3 py-1.5 bg-[#0B2A5B] hover:bg-[#133E7C] text-white rounded-md text-xs font-bold flex items-center gap-1"
        >
          <Send className="h-3 w-3" />
          <span>{isHindi ? 'पार्स करें' : 'Parse'}</span>
        </button>
      </form>

      {/* Parsed Result & Confidence Chips */}
      {parsedResult && (
        <div className="p-3 bg-white border border-slate-300 rounded-lg text-xs space-y-2 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-200 pb-2">
            <div className="font-mono text-slate-600">
              <span>Transcript: </span>
              <strong className="text-slate-900 font-sans">"{parsedResult.rawTranscript}"</strong>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400">Confidence:</span>
              <span className={`px-2 py-0.5 rounded-full font-bold font-mono text-[10px] ${
                parsedResult.confidence >= 0.8
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : parsedResult.confidence >= 0.5
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-red-100 text-red-800 border border-red-300'
              }`}>
                {(parsedResult.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Clarification prompt if ambiguous */}
          {parsedResult.clarificationNeeded ? (
            <div className="p-2.5 bg-amber-50 border border-amber-300 rounded text-amber-950 flex items-start gap-2">
              <HelpCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong>{isHindi ? 'स्पष्टीकरण आवश्यक' : 'Clarification Needed'}: </strong>
                <span>{parsedResult.clarificationNeeded}</span>
              </div>
            </div>
          ) : parsedResult.intent === 'DISPATCH' ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 font-mono text-[#0B2A5B]">
                  Commodity: <strong>{parsedResult.commodity}</strong>
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 font-mono text-[#0B2A5B]">
                  Qty: <strong>{parsedResult.quantity} Qtl</strong>
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 font-mono text-[#0B2A5B]">
                  FPS: <strong>{parsedResult.fps?.name}</strong>
                </span>
              </div>

              {awaitingConfirm && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-[11px] font-sans">
                    {isHindi ? 'पुष्टि की प्रतीक्षा है...' : 'Awaiting confirmation...'}
                  </span>
                  <button
                    id="btn-voice-confirm-stage"
                    type="button"
                    onClick={() => {
                      setAwaitingConfirm(false);
                      if (onConfirmStage) onConfirmStage();
                    }}
                    className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold shadow-xs flex items-center gap-1"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>{isHindi ? 'हाँ, चालान बनाएं' : 'Confirm & Stage'}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-600 font-mono text-[11px]">
              Intent detected: <strong>{parsedResult.intent}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
