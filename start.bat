@echo off
cd /d "%~dp0"
if not exist node_modules call npm install

set NEW_VENV=0
if not exist .venv set NEW_VENV=1
if "%NEW_VENV%"=="1" python -m venv .venv

call .venv\Scripts\activate

if "%NEW_VENV%"=="1" (
    echo Installing dependencies from requirements.txt...
    pip install -q --retries 1 --timeout 10 -r requirements.txt
    if errorlevel 1 (
        echo [WARNING] Pip install failed or network unavailable.
        python -c "import fastapi, uvicorn" >nul 2>&1
        if errorlevel 1 (
            echo [ERROR] Required packages fastapi and uvicorn are missing in .venv.
            pause
            exit /b 1
        )
        echo [INFO] Verified essential packages are installed. Continuing.
    )
) else (
    echo Using existing environment ^(offline-safe^)
)

call npm run dev
pause
