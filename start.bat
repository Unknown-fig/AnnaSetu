@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
if not exist .venv python -m venv .venv
call .venv\Scripts\activate
pip install -q -r requirements.txt
call npm run dev
pause
