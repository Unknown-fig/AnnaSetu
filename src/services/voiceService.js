/**
 * Speech Recognition and Speech Synthesis Service with bilingual EN-IN/HI-IN support
 */

let recognitionInstance = null;

export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function startListening({ lang = 'en-IN', onResult, onError, onEnd }) {
  if (!isSpeechRecognitionSupported()) {
    if (onError) onError('Speech recognition API not supported in this browser environment.');
    return null;
  }

  try {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (recognitionInstance) {
      try { recognitionInstance.abort(); } catch (e) {}
    }

    recognitionInstance = new SpeechRecognition();
    recognitionInstance.lang = lang;
    recognitionInstance.continuous = false;
    recognitionInstance.interimResults = false;
    recognitionInstance.maxAlternatives = 1;

    recognitionInstance.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (onResult) onResult(transcript);
    };

    recognitionInstance.onerror = (event) => {
      console.warn('Speech recognition warning/error:', event.error);
      if (onError) onError(event.error || 'Speech capture failed');
    };

    recognitionInstance.onend = () => {
      if (onEnd) onEnd();
    };

    recognitionInstance.start();
    return recognitionInstance;
  } catch (err) {
    console.warn('Failed to start speech recognition:', err);
    if (onError) onError(err.message || 'Speech initialization error');
    return null;
  }
}

export function stopListening() {
  if (recognitionInstance) {
    try {
      recognitionInstance.stop();
    } catch (e) {}
    recognitionInstance = null;
  }
}

/**
 * Text-to-speech read back in active language
 */
export function speakFeedback(text, lang = 'en-IN') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  try {
    window.speechSynthesis.cancel(); // Stop prior speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'hi-IN' || lang === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Pick matching voice if available
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find(v => v.lang.startsWith(utterance.lang.substring(0, 2)));
    if (match) utterance.voice = match;

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('SpeechSynthesis error:', e);
  }
}
