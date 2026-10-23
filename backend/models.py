from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Dict, Any, Optional
from datetime import date

class ErrorDetails(BaseModel):
    code: str
    message: str
    details: Optional[Any] = None

class ErrorResponse(BaseModel):
    error: ErrorDetails

class BatchCreate(BaseModel):
    batch_code: str = Field(..., min_length=2)
    commodity: str
    supplier: str
    receipt_date: str
    stack_bay: str
    stack_position: int = 0
    initial_qty: float = Field(..., gt=0)
    status: str = "ELIGIBLE"
    moisture_pct: float = Field(..., ge=0)

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any):
        if isinstance(data, dict):
            # normalize batch_code
            if "batch_code" not in data and "batchId" in data:
                data["batch_code"] = data["batchId"]
            # normalize receipt_date
            if "receipt_date" not in data and "receiptDate" in data:
                data["receipt_date"] = data["receiptDate"]
            elif "receipt_date" not in data or not data["receipt_date"]:
                data["receipt_date"] = date.today().isoformat()
            # normalize stack_bay
            if "stack_bay" not in data and "bay" in data:
                data["stack_bay"] = data["bay"]
            if "stack_bay" in data and isinstance(data["stack_bay"], str):
                data["stack_bay"] = data["stack_bay"].upper().strip()
            # normalize initial_qty
            if "initial_qty" not in data:
                if "qtyReceivedQtl" in data:
                    data["initial_qty"] = data["qtyReceivedQtl"]
                elif "quantity" in data:
                    data["initial_qty"] = data["quantity"]
            # normalize status
            if "status" not in data and "qualityStatus" in data:
                qs = str(data["qualityStatus"]).upper()
                if "HOLD" in qs:
                    data["status"] = "QUALITY_HOLD"
                else:
                    data["status"] = "ELIGIBLE"
            elif "status" in data:
                st = str(data["status"]).upper()
                if "HOLD" in st:
                    data["status"] = "QUALITY_HOLD"
                elif "ELIGIBLE" in st:
                    data["status"] = "ELIGIBLE"
            # normalize moisture_pct
            if "moisture_pct" not in data and "moisturePct" in data:
                data["moisture_pct"] = data["moisturePct"]
            elif "moisture_pct" not in data or data["moisture_pct"] is None:
                data["moisture_pct"] = 15.5 if data.get("status") == "QUALITY_HOLD" else 11.5
        return data

    @field_validator("stack_bay")
    def validate_bay(cls, v):
        valid_bays = {f"{r}{c}" for r in ["A","B","C","D"] for c in [1,2,3,4]}
        v_upper = v.upper().strip()
        if v_upper not in valid_bays:
            raise ValueError(f"stack_bay must be one of {sorted(list(valid_bays))}")
        return v_upper

    @field_validator("receipt_date")
    def validate_date(cls, v):
        d = date.fromisoformat(v)
        if d > date.today():
            raise ValueError("receipt_date cannot be in the future")
        return v

class IndentCreate(BaseModel):
    fps_code: Optional[str] = None
    fps_id: Optional[int] = None
    commodity: str
    requested_qty: float = Field(..., gt=0, le=500.0)
    priority: str = "NORMAL"
    remarks: Optional[str] = ""
    force: Optional[bool] = False

    @model_validator(mode="before")
    @classmethod
    def normalize_indent(cls, data: Any):
        if isinstance(data, dict):
            if "fps_code" not in data and "fpsCode" in data:
                data["fps_code"] = data["fpsCode"]
            if "fps_id" not in data and "fpsId" in data:
                data["fps_id"] = data["fpsId"]
            if "requested_qty" not in data and "requestedQty" in data:
                data["requested_qty"] = data["requestedQty"]
            if "priority" in data and isinstance(data["priority"], str):
                data["priority"] = data["priority"].upper().strip()
        return data

    @field_validator("priority")
    def validate_prio(cls, v):
        if v not in ("NORMAL", "HIGH", "URGENT"):
            raise ValueError("priority must be NORMAL, HIGH, or URGENT")
        return v

class FpsConfirmReceiptRequest(BaseModel):
    challan_no: str
    fps_code: str
    qr_payload: Optional[Dict[str, Any]] = None
    qr_raw: Optional[str] = None

class FpsRejectReceiptRequest(BaseModel):
    challan_no: str
    fps_code: str
    remarks: str = Field(..., min_length=5)

class WaterfallPreviewRequest(BaseModel):
    commodity: str
    requested_qty: float = Field(..., gt=0)

    @model_validator(mode="before")
    @classmethod
    def normalize_waterfall(cls, data: Any):
        if isinstance(data, dict):
            if "requested_qty" not in data and "requestedQty" in data:
                data["requested_qty"] = data["requestedQty"]
        return data

class ChallanStageRequest(BaseModel):
    indent_id: Optional[int] = None
    fps_code: str
    commodity: str
    requested_qty: float = Field(..., gt=0)
    device_id: Optional[str] = "DEVICE_PORTAL_01"
    local_seq: Optional[int] = 1
    prev_token_hash: Optional[str] = "GENESIS_TOKEN_ROOT"

    @model_validator(mode="before")
    @classmethod
    def normalize_stage(cls, data: Any):
        if isinstance(data, dict):
            if "fps_code" not in data and "fpsCode" in data:
                data["fps_code"] = data["fpsCode"]
            if "requested_qty" not in data and "requestedQty" in data:
                data["requested_qty"] = data["requestedQty"]
            if "indent_id" not in data and "indentId" in data:
                data["indent_id"] = data["indentId"]
            if "device_id" not in data and "deviceId" in data:
                data["device_id"] = data["deviceId"]
            if "local_seq" not in data and "localSeq" in data:
                data["local_seq"] = data["localSeq"]
            if "prev_token_hash" not in data and "prevTokenHash" in data:
                data["prev_token_hash"] = data["prevTokenHash"]
        return data

class ManualPickItem(BaseModel):
    batch_code: str
    qty: float = Field(..., ge=0)

class ChallanStageManualRequest(BaseModel):
    indent_id: Optional[int] = None
    fps_code: str
    commodity: str
    requested_qty: float = Field(..., gt=0)
    selected_picks: List[ManualPickItem]
    device_id: Optional[str] = "DEVICE_PORTAL_01"
    local_seq: Optional[int] = 1
    prev_token_hash: Optional[str] = "GENESIS_TOKEN_ROOT"

class ExceptionOtpRequest(BaseModel):
    reason: str
    operator_name: str = Field(..., min_length=2)
    remarks: str = Field(..., min_length=20)

class OtpVerifyRequest(BaseModel):
    role: str = Field(..., pattern="^(SUPERVISOR|DSO)$")
    otp: str = Field(..., min_length=6, max_length=6)

class ScanLineRequest(BaseModel):
    batch_code: Optional[str] = None
    qr_payload: Optional[str] = None
    line_no: int = Field(..., ge=1)

class ApproverDecisionRequest(BaseModel):
    action: str = Field(..., pattern="^(APPROVE|REJECT)$")
    remarks: Optional[str] = None

class SyncEventItem(BaseModel):
    device_id: str
    local_seq: int
    token: str
    prev_token_hash: Optional[str] = None
    type: str
    payload: Dict[str, Any]
