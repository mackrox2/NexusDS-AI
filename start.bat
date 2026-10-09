@echo off

echo ==========================================
echo        NEXUSDS AI STARTING
echo ==========================================
echo.

echo Starting Backend...
start "NexusDS Backend" cmd /k "cd /d "%~dp0backend" && call venv\Scripts\activate && python -m uvicorn main:app --reload"

echo Starting Frontend...
start "NexusDS Frontend" cmd /k "cd /d "%~dp0client" && npm run dev"

echo.
echo Backend and Frontend are starting...
echo.

timeout /t 5
exit