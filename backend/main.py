from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError, HTTPException
from datetime import datetime, timezone

from backend.db import init_db, get_db
from backend.seed import seed_database
from backend.routes import batches, indents, challans, approvals, audit_routes, sync_routes, admin

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema
    init_db()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM batches")
        if cursor.fetchone()["count"] == 0:
            seed_database(conn)
    yield

app = FastAPI(
    title="AnnaSetu 3D Godown & FIFO API",
    description="Statutory FIFO allocation engine, dual-OTP gates, loading scanner, cryptographic audit chain, and rural offline sync.",
    version="1.0.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# CORS Middleware for local Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global validation error handler matching {error: {code, message, details}}
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid request parameters or payload",
                "details": exc.errors()
            }
        }
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": str(exc.detail)
            }
        }
    )

@app.get("/api/health")
def health_check():
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            db_status = "CONNECTED"
    except Exception as e:
        db_status = f"ERROR: {str(e)}"

    return {
        "status": "UP",
        "version": "1.0.0",
        "db": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

from backend.routes import (
    admin, batches, indents, challans, approvals,
    audit_routes, sync_routes, fps_routes
)

# Include all subrouters
app.include_router(admin.router)
app.include_router(batches.router)
app.include_router(indents.router)
app.include_router(challans.router)
app.include_router(approvals.router)
app.include_router(audit_routes.router)
app.include_router(sync_routes.router)
app.include_router(fps_routes.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
