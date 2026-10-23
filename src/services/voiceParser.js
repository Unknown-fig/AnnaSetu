import { FAIR_PRICE_SHOPS, COMMODITIES } from '../types/models';

/**
 * Levenshtein distance between two strings
 */
export function levenshteinDistance(a, b) {
  if (!a || !b) return (a || b).length;
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,      // deletion
        d[i][j - 1] + 1,      // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return d[m][n];
}

// Number mappings for English and Hindi words
const WORD_TO_NUMBER = {
  // English words
  'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
  'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
  'ten': 10, 'twenty': 20, 'thirty': 30, 'forty': 40,
  'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80,
  'ninety': 90, 'hundred': 100, 'one hundred': 100,
  'one hundred twenty': 120, 'one hundred and twenty': 120,
  
  // Hindi words
  'शून्य': 0, 'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4,
  'पांच': 5, 'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9,
  'दस': 10, 'बीस': 20, 'तीस': 30, 'चालीस': 40,
  'पचास': 50, 'साठ': 60, 'सत्तर': 70, 'अस्सी': 80,
  'नब्बे': 90, 'सौ': 100, 'एक सौ': 100,
  'एक सौ बीस': 120, 'सवा सौ': 125, 'डेढ़ सौ': 150,
};

// Devanagari digit mapping
const DEVANAGARI_DIGITS = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
};

// FPS Reference Table with aliases and Hindi spellings
const FPS_KNOWLEDGE = [
  { id: 'FPS-GN-101', name: 'Kasna Village Market', aliases: ['kasna', 'कसना', 'gn-101', '101', 'fps 101', 'fps-101'] },
  { id: 'FPS-GN-102', name: 'Tugalpur Haldoni Road', aliases: ['tugalpur', 'तुगलपुर', 'तुगलपुर हल्दोनी', 'gn-102', '102', 'fps 102', 'fps-102'] },
  { id: 'FPS-GN-103', name: 'Sector Beta-2 Market', aliases: ['beta', 'बीटा', 'beta 2', 'beta-2', 'gn-103', '103', 'fps 103', 'fps-103'] },
  { id: 'FPS-GN-104', name: 'Dankaur Main Bazaar', aliases: ['dankaur', 'दनकौर', 'gn-104', '104', 'fps 104', 'fps-104'] },
  { id: 'FPS-GN-105', name: 'Alpha Commercial Belt', aliases: ['alpha', 'अल्फा', 'gn-105', '105', 'fps 105', 'fps-105'] },
  { id: 'FPS-GN-106', name: 'Rabupura Rural Depot', aliases: ['rabupura', 'रबूपुरा', 'gn-106', '106', 'fps 106', 'fps-106'] },
];

// Commodity Synonyms Mapping
const COMMODITY_SYNONYMS = {
  'Wheat': ['wheat', 'गेहूं', 'गेहूँ', 'gehu', 'gehun', 'kanak'],
  'Rice': ['rice', 'चावल', 'chawal', 'dhan'],
  'Sugar': ['sugar', 'चीनी', 'cheeni', 'shakkar', 'शक्कर'],
  'Salt': ['salt', 'नमक', 'namak'],
  'Mustard Oil': ['mustard oil', 'mustard', 'सरसों का तेल', 'सरसों तेल', 'sarson', 'sarson tel'],
  'Chana': ['chana', 'चना', 'gram'],
  'Tuvar Dal': ['tuvar dal', 'tuvar', 'तुवर दाल', 'तुवर', 'arhar', 'अरहर दाल', 'arhar dal'],
};

/**
 * Extracts numeric quantity from text supporting digits, Devanagari numerals, and words
 */
function extractQuantity(text) {
  // 1. Convert Devanagari digits to Latin
  let normalized = text;
  for (const [dev, lat] of Object.entries(DEVANAGARI_DIGITS)) {
    normalized = normalized.split(dev).join(lat);
  }

  // 2. Check for composite Hindi phrases like 'एक सौ बीस' or English 'one hundred twenty'
  if (normalized.includes('एक सौ बीस') || normalized.includes('one hundred twenty') || normalized.includes('one hundred and twenty')) {
    return 120;
  }
  if (normalized.includes('सौ') || normalized.includes('one hundred')) {
    return 100;
  }
  if (normalized.includes('अस्सी') || normalized.includes('eighty')) {
    return 80;
  }

  // 3. Regex for standard digits (e.g. "120 quintal", "80qtl", "40.5")
  const digitMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:quintal|quintals|qtl|क्विंटल)?/i);
  if (digitMatch) {
    const val = parseFloat(digitMatch[1]);
    if (!isNaN(val) && val > 0) return val;
  }

  // 4. Word lookup
  const words = normalized.toLowerCase().split(/\s+/);
  for (const w of words) {
    if (WORD_TO_NUMBER[w] !== undefined) {
      return WORD_TO_NUMBER[w];
    }
  }

  return null;
}

/**
 * Extracts commodity from text based on synonyms
 */
function extractCommodity(text) {
  const lower = text.toLowerCase();
  for (const [commodity, synonyms] of Object.entries(COMMODITY_SYNONYMS)) {
    for (const syn of synonyms) {
      if (lower.includes(syn.toLowerCase())) {
        return commodity;
      }
    }
  }
  return null;
}

/**
 * Extracts and fuzzy matches FPS with edit distance <= 2
 */
function extractFps(text) {
  const lower = text.toLowerCase();
  
  // 1. Direct ID check (e.g. 101, 102, 104, GN-101, FPS-GN-101)
  const idMatch = lower.match(/(?:fps|gn)[-\s]?(\d{3})/i) || lower.match(/\b(10[1-6])\b/);
  if (idMatch) {
    const num = idMatch[1];
    const fullId = `FPS-GN-${num}`;
    const found = FAIR_PRICE_SHOPS.find(f => f.id === fullId);
    if (found) return { fps: found, confidence: 0.98 };
  }

  // 2. Direct name or alias inclusion
  for (const item of FPS_KNOWLEDGE) {
    for (const alias of item.aliases) {
      if (lower.includes(alias.toLowerCase())) {
        const found = FAIR_PRICE_SHOPS.find(f => f.id === item.id);
        if (found) return { fps: found, confidence: 0.95 };
      }
    }
  }

  // 3. Fuzzy match individual tokens (Edit distance <= 2)
  const tokens = lower.split(/[\s,]+/);
  let bestMatch = null;
  let bestDist = 999;

  for (const token of tokens) {
    if (token.length < 3) continue;
    for (const item of FPS_KNOWLEDGE) {
      for (const alias of item.aliases) {
        // Skip short numeric aliases in fuzzy matching to avoid false positives
        if (/^\d+$/.test(alias)) continue;
        const dist = levenshteinDistance(token, alias.toLowerCase());
        if (dist <= 2 && dist < bestDist) {
          bestDist = dist;
          bestMatch = FAIR_PRICE_SHOPS.find(f => f.id === item.id);
        }
      }
    }
  }

  if (bestMatch && bestDist <= 2) {
    return { fps: bestMatch, confidence: bestDist === 0 ? 0.95 : 0.75 };
  }

  return { fps: null, confidence: 0 };
}

/**
 * Parses a voice transcript deterministically into structured action
 */
export function parseVoiceCommand(transcript) {
  if (!transcript || typeof transcript !== 'string') {
    return {
      intent: 'UNKNOWN',
      confidence: 0,
      rawTranscript: transcript || '',
      clarificationNeeded: null,
    };
  }

  const text = transcript.trim();
  const lower = text.toLowerCase();

  // 1. Check Confirmation Intents
  if (/^(yes|confirm|हाँ|हा|पक्का|चालान जारी करो|कन्फर्म)/i.test(lower)) {
    return {
      intent: 'CONFIRM',
      confidence: 0.95,
      rawTranscript: text,
      clarificationNeeded: null,
    };
  }

  // 2. Check Cancellation Intents
  if (/^(no|cancel|नहीं|नही|रद्द|कैंसल)/i.test(lower)) {
    return {
      intent: 'CANCEL',
      confidence: 0.95,
      rawTranscript: text,
      clarificationNeeded: null,
    };
  }

  // 3. Check Oldest Batch Intent
  if (lower.includes('oldest batch') || lower.includes('पुरानी बैच') || lower.includes('पुराना बैच') || lower.includes('oldest')) {
    const commodity = extractCommodity(text);
    return {
      intent: 'OLDEST_BATCH',
      commodity,
      confidence: 0.9,
      rawTranscript: text,
      clarificationNeeded: commodity ? null : 'Please specify which commodity to check the oldest batch for.',
    };
  }

  // 4. Check Stock Query Intent
  if (lower.includes('stock of') || lower.includes('how much') || lower.includes('स्टॉक') || lower.includes('कितना स्टॉक')) {
    const commodity = extractCommodity(text);
    return {
      intent: 'STOCK_QUERY',
      commodity,
      confidence: 0.88,
      rawTranscript: text,
      clarificationNeeded: commodity ? null : 'Which commodity stock would you like to inquire about?',
    };
  }

  // 5. Check Dispatch / Create Challan Intent
  const hasDispatchWord = /dispatch|send|create|stage|challan|भेजो|भेजें|डिस्पैच|चालान बनाओ/i.test(lower);
  const qty = extractQuantity(text);
  const commodity = extractCommodity(text);
  const fpsMatch = extractFps(text);

  // If quantity and either commodity or FPS is specified, treat as DISPATCH intent
  if (hasDispatchWord || (qty !== null && (commodity !== null || fpsMatch.fps !== null))) {
    let confidence = 0.5;
    if (qty !== null) confidence += 0.2;
    if (commodity !== null) confidence += 0.15;
    if (fpsMatch.fps !== null) confidence += 0.15;

    let clarificationNeeded = null;
    if (!commodity) {
      clarificationNeeded = 'Which commodity should be allocated? (e.g., Wheat or Rice)';
    } else if (qty === null) {
      clarificationNeeded = `How many quintals of ${commodity} should be dispatched?`;
    } else if (!fpsMatch.fps) {
      clarificationNeeded = 'Which Fair Price Shop (FPS) destination? (e.g., Kasna, Tugalpur, Beta, or Dankaur)';
    }

    return {
      intent: 'DISPATCH',
      commodity: commodity || 'Wheat',
      quantity: qty || 0,
      fps: fpsMatch.fps,
      confidence: Math.min(0.98, confidence),
      rawTranscript: text,
      clarificationNeeded,
    };
  }

  return {
    intent: 'UNKNOWN',
    confidence: 0.2,
    rawTranscript: text,
    clarificationNeeded: 'Command not recognized. Say "Dispatch 120 Quintal Wheat to FPS Kasna" or pick a sample chip below.',
  };
}
