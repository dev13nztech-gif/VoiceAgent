@echo off
setlocal

echo.
echo  ================================================
echo   VoiceAgent - Local Launcher
echo  ================================================
echo.

:: -- Build the React frontend ------------------------------------------------
echo [1/2] Building frontend...
cd /d "%~dp0frontend"
call npm install --silent
call npm run build
if errorlevel 1 (
    echo.
    echo  ERROR: Frontend build failed. Check the output above.
    pause
    exit /b 1
)
echo  Frontend built successfully.
echo.

:: -- Start the combined FastAPI server ---------------------------------------
echo [2/2] Starting server...
echo.
echo  Open http://localhost:8080 in your browser
echo  Press Ctrl+C to stop
echo.
cd /d "%~dp0backend"
set STATIC_DIR=%~dp0frontend\dist
python -m uvicorn main:app --host 127.0.0.1 --port 8080 --reload

endlocal
