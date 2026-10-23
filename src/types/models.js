export const COMMODITIES = [
  'Wheat',
  'Rice',
  'Sugar',
  'Salt',
  'Mustard Oil',
  'Chana',
  'Tuvar Dal',
];

export const FAIR_PRICE_SHOPS = [
  { id: 'FPS-GN-101', name: 'Kasna Village Market', sector: 'Kasna Zone', licenseNo: 'UP-GBN-PDS-101' },
  { id: 'FPS-GN-102', name: 'Tugalpur Haldoni Road', sector: 'Haldoni Sector', licenseNo: 'UP-GBN-PDS-102' },
  { id: 'FPS-GN-103', name: 'Sector Beta-2 Market', sector: 'Beta-2 Commercial', licenseNo: 'UP-GBN-PDS-103' },
  { id: 'FPS-GN-104', name: 'Dankaur Main Bazaar', sector: 'Dankaur Rural', licenseNo: 'UP-GBN-PDS-104' },
  { id: 'FPS-GN-105', name: 'Alpha-1 Commercial Belt', sector: 'Alpha-1 Central', licenseNo: 'UP-GBN-PDS-105' },
  { id: 'FPS-GN-106', name: 'Rabupura Gram Panchayat', sector: 'Rabupura Outpost', licenseNo: 'UP-GBN-PDS-106' },
];

export const SUPPLIERS = [
  'FCI Hapur Depot',
  'NAFED UP',
  'UP State Agro',
];

export const BAYS = [
  'A1', 'A2', 'A3', 'A4',
  'B1', 'B2', 'B3', 'B4',
  'C1', 'C2', 'C3', 'C4',
  'D1', 'D2', 'D3', 'D4',
];

export const QUALITY_STATUS = {
  ELIGIBLE: 'Eligible',
  HOLD_HIGH_MOISTURE: 'Hold - High Moisture',
};

export const EXCEPTION_REASONS = [
  'Moisture/Quality Spoilage Risk (Early Clearance)',
  'Lab Hold / Pending Secondary Moisture Test',
  'Physical Bay Blockage / Forklift Pathway Obstruction',
  'Emergency Directive by District Magistrate / Dy. Director'
];

export const CRITICAL_AGE_DAYS = 60;

export const COMMODITY_HI_MAP = {
  'Wheat': 'गेहूं',
  'Rice': 'चावल',
  'Sugar': 'चीनी',
  'Salt': 'नमक',
  'Mustard Oil': 'सरसों का तेल',
  'Chana': 'चना',
  'Tuvar Dal': 'तुवर दाल',
};

/**
 * Rounds a quantity to 2 decimal places to prevent floating point drift
 */
export function round2(num) {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates batch age in whole days normalized to UTC midnight
 */
export function calculateAgeDays(receiptDateStr) {
  if (!receiptDateStr) return 0;
  
  const [rY, rM, rD] = receiptDateStr.split('-').map(Number);
  const receiptUtc = Date.UTC(rY, rM - 1, rD);

  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const diffTime = Math.max(0, todayUtc - receiptUtc);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Categorizes batch age into:
 * Fresh: 0 - 20 days
 * Moderate: 21 - 59 days
 * Critical: 60+ days (using CRITICAL_AGE_DAYS = 60)
 */
export function getAgeCategory(ageDays) {
  if (ageDays < 21) {
    return { label: 'Fresh (0-20d)', category: 'fresh', color: 'emerald' };
  } else if (ageDays < CRITICAL_AGE_DAYS) {
    return { label: 'Moderate (21-59d)', category: 'moderate', color: 'amber' };
  } else {
    return { label: 'Critical (60+d)', category: 'critical', color: 'rose' };
  }
}
