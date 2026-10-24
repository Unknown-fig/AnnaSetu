/**
 * Universal AnnaSetu API Client
 * Centralized communication layer with Python FastAPI Backend & SQLite Database.
 * Handles timeouts, error normalization, and bidirectional schema mapping.
 */
import { broadcastInvalidation } from '../shared/syncChannel';

const BASE_URL = '/api';
const DEFAULT_TIMEOUT_MS = 10000;

// Bidirectional naming adapters
export const COMMODITY_MAP_UI_TO_DB = {
  'Mustard Oil': 'Edible Oil',
};

export const COMMODITY_MAP_DB_TO_UI = {
  'Edible Oil': 'Mustard Oil',
};

export const STATUS_MAP_UI_TO_DB = {
  'Hold - High Moisture': 'QUALITY_HOLD',
  'Eligible': 'ELIGIBLE',
};

export const STATUS_MAP_DB_TO_UI = {
  'QUALITY_HOLD': 'Hold - High Moisture',
  'ELIGIBLE': 'Eligible',
};

export function toDbCommodity(comm) {
  return COMMODITY_MAP_UI_TO_DB[comm] || comm;
}

export function toUiCommodity(comm) {
  return COMMODITY_MAP_DB_TO_UI[comm] || comm;
}

export function toDbStatus(st) {
  return STATUS_MAP_UI_TO_DB[st] || st;
}

export function toUiStatus(st) {
  return STATUS_MAP_DB_TO_UI[st] || st;
}

class ApiError extends Error {
  constructor(message, code = 'API_ERROR', status = 500, details = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function request(endpoint, options = {}) {
  const { timeout = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(fetchOptions.headers || {}),
  };

  try {
    const url = `${BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const res = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let data;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    if (!res.ok) {
      const errObj = (typeof data === 'object' && data?.error) ? data.error : {};
      const code = errObj.code || `HTTP_${res.status}`;
      const msg = errObj.message || (typeof data === 'string' ? data : res.statusText);
      const details = errObj.details || null;
      throw new ApiError(msg, code, res.status, details);
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new ApiError('Request timed out. Central server unreachable', 'TIMEOUT', 504);
    }
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(err.message || 'Network connection failed', 'NETWORK_ERROR', 0);
  }
}

export const apiClient = {
  // System Health
  async checkHealth() {
    return request('/health', { method: 'GET', timeout: 3000 });
  },

  // Full Server State (Source of Truth)
  async getState() {
    return request('/state', { method: 'GET' });
  },

  // Waterfall Allocation Preview
  async previewWaterfall(commodity, requestedQty) {
    return request('/challans/preview-waterfall', {
      method: 'POST',
      body: JSON.stringify({
        commodity: toDbCommodity(commodity),
        requested_qty: Number(requestedQty),
      }),
    });
  },

  // Stage FIFO Waterfall Challan
  async stageChallan({ fpsCode, commodity, requestedQty, indentId = null, deviceId, localSeq, prevTokenHash }) {
    return request('/challans/stage', {
      method: 'POST',
      body: JSON.stringify({
        fps_code: fpsCode,
        commodity: toDbCommodity(commodity),
        requested_qty: Number(requestedQty),
        indent_id: indentId,
        device_id: deviceId,
        local_seq: localSeq,
        prev_token_hash: prevTokenHash,
      }),
    });
  },

  // Stage Manual Batch Selection Challan
  async stageManualChallan({ fpsCode, commodity, requestedQty, selectedPicks, indentId = null, deviceId, localSeq, prevTokenHash }) {
    return request('/challans/stage-manual', {
      method: 'POST',
      body: JSON.stringify({
        fps_code: fpsCode,
        commodity: toDbCommodity(commodity),
        requested_qty: Number(requestedQty),
        selected_picks: selectedPicks.map(p => ({
          batch_code: p.batchCode || p.batch_code,
          qty: Number(p.qty || p.allocated_qty || 0),
        })),
        indent_id: indentId,
        device_id: deviceId,
        local_seq: localSeq,
        prev_token_hash: prevTokenHash,
      }),
    });
  },

  // Request Dual-OTP Exception Approval
  async requestExceptionOtp(challanId, { reason, operatorName, remarks }) {
    return request(`/challans/${challanId}/exception/request-otp`, {
      method: 'POST',
      body: JSON.stringify({
        reason,
        operator_name: operatorName,
        remarks,
      }),
    });
  },

  // Verify Single OTP
  async verifyExceptionOtp(challanId, { role, otp }) {
    return request(`/challans/${challanId}/exception/verify-otp`, {
      method: 'POST',
      body: JSON.stringify({
        role,
        otp: String(otp).trim(),
      }),
    });
  },

  // Scan Challan Line at Loading Gate
  async scanChallanLine(challanId, { batchCode, qrPayload, lineNo }) {
    return request(`/challans/${challanId}/scan`, {
      method: 'POST',
      body: JSON.stringify({
        batch_code: batchCode,
        qr_payload: qrPayload,
        line_no: Number(lineNo),
      }),
    });
  },

  // Dispatch Challan (Deducts stock and sets IN_TRANSIT)
  async dispatchChallan(challanId) {
    return request(`/challans/${challanId}/dispatch`, {
      method: 'POST',
    });
  },

  // Cancel Staged Challan
  async cancelChallan(challanId) {
    return request(`/challans/${challanId}/cancel`, {
      method: 'POST',
    });
  },

  // Receive at FPS e-PoS
  async receiveAtFps(challanId) {
    return request(`/challans/${challanId}/receive`, {
      method: 'POST',
    });
  },

  // Verify Challan Token
  async verifyChallanToken(challanNo) {
    return request(`/challans/${challanNo}/verify`, {
      method: 'GET',
    });
  },

  // Approver / Simulated SMS
  async getPendingApprovals() {
    return request('/approvals/pending', { method: 'GET' });
  },

  async makeApproverDecision(otpRequestId, action, remarks = '') {
    const res = await request(`/approvals/${otpRequestId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ action, remarks }),
    });
    broadcastInvalidation(res?.version || Date.now(), 'approver_decision');
    return res;
  },

  async decideApproval(otpRequestId, decision, remarks = '') {
    return this.makeApproverDecision(otpRequestId, decision, remarks);
  },

  // Audit Logs & Hash Chain
  async getAuditLogs(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/audit${qs ? `?${qs}` : ''}`, { method: 'GET' });
  },

  async verifyHashChain() {
    return request('/audit/verify-chain', { method: 'GET' });
  },

  // Traceability & Recall
  async traceBatchJourney(batchCode) {
    return request(`/trace/batch/${batchCode}`, { method: 'GET' });
  },

  async traceBatchRecall(batchCode) {
    return request(`/trace/recall/${batchCode}`, { method: 'GET' });
  },

  async traceFps(fpsCode) {
    return request(`/trace/fps/${fpsCode}`, { method: 'GET' });
  },

  // Live State Version
  async getStateVersion() {
    return request('/state/version', { method: 'GET' });
  },

  // NFSA / FPS Modules
  async getFpsDashboard(fpsCode) {
    return request(`/fps/${fpsCode}/dashboard`, { method: 'GET' });
  },

  async confirmFpsReceipt({ challanNo, fpsCode, qrPayload = null, qrRaw = null }) {
    const res = await request('/fps/confirm-receipt', {
      method: 'POST',
      body: JSON.stringify({
        challan_no: challanNo,
        fps_code: fpsCode,
        qr_payload: qrPayload,
        qr_raw: qrRaw,
      }),
    });
    broadcastInvalidation(res.version, 'epos_receipt');
    return res;
  },

  async rejectFpsReceipt({ challanNo, fpsCode, remarks }) {
    const res = await request('/fps/reject-receipt', {
      method: 'POST',
      body: JSON.stringify({
        challan_no: challanNo,
        fps_code: fpsCode,
        remarks,
      }),
    });
    broadcastInvalidation(res.version, 'receipt_disputed');
    return res;
  },

  async getDsoVigilance() {
    return request('/dso/vigilance', { method: 'GET' });
  },

  async getBatchFpsMatrix(commodity = null) {
    const qs = commodity ? `?commodity=${encodeURIComponent(toDbCommodity(commodity))}` : '';
    return request(`/trace/matrix${qs}`, { method: 'GET' });
  },

  // FPS Indents
  async listIndents(status = null) {
    const qs = status ? `?status=${status}` : '';
    return request(`/indents${qs}`, { method: 'GET' });
  },

  async createIndent({ fpsCode, commodity, requestedQty, priority = 'NORMAL', remarks = '', force = false }) {
    const res = await request('/indents', {
      method: 'POST',
      body: JSON.stringify({
        fps_code: fpsCode,
        commodity: toDbCommodity(commodity),
        requested_qty: Number(requestedQty),
        priority,
        remarks,
        force,
      }),
    });
    broadcastInvalidation(res.version, 'new_indent');
    return res;
  },

  // Consignment Receipt
  async createBatch(batchData) {
    const res = await request('/batches', {
      method: 'POST',
      body: JSON.stringify({
        ...batchData,
        commodity: toDbCommodity(batchData.commodity),
      }),
    });
    broadcastInvalidation(null, 'batch_created');
    return res;
  },

  // Offline Sync Queue
  async syncOfflineQueue(items) {
    const res = await request('/sync', {
      method: 'POST',
      body: JSON.stringify(items),
    });
    broadcastInvalidation(null, 'sync_queue');
    return res;
  },

  // Admin Reset
  async resetDatabase() {
    const res = await request('/admin/reset', { method: 'POST' });
    broadcastInvalidation(res.version, 'db_reset');
    return res;
  },
};

