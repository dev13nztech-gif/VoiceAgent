@echo off
echo === VoiceAgent Startup ===
echo.

:: Check Python
where python >nul 2>&1 || (echo [ERROR] Python not found. Install Python 3.10+ && pause && exit /b 1)

:: Check Node
where node >nul 2>&1 || (echo [ERROR] Node.js not found. Install Node.js 18+ && pause && exit /b 1)

:: Check ffmpeg
where ffmpeg >nul 2>&1 || (
  echo [WARN] ffmpeg not found. The av package provides bundled FFmpeg for most formats.
  echo        For broadest format support, install ffmpeg: https://www.gyan.dev/ffmpeg/builds/
  echo.
)

:: Backend setup
echo [1/3] Installing Python dependencies...
cd backend
pip install -r requirements.txt --quiet
if errorlevel 1 (echo [ERROR] pip install failed && pause && exit /b 1)

:: Start backend in new window
echo [2/3] Starting backend on http://localhost:8000 ...
start "VoiceAgent Backend" cmd /k "set HF_HUB_DISABLE_SYMLINKS_WARNING=1 && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

cd ..\frontend

:: Frontend setup
echo [3/3] Installing Node dependencies and starting UI...
if not exist node_modules (
  npm install
)
start "VoiceAgent Frontend" cmd /k "npm run dev"

echo.
echo === VoiceAgent is starting ===
echo   UI:  http://localhost:3000
echo   API: http://localhost:8000
echo   Docs: http://localhost:8000/docs
echo.
echo Close the two terminal windows to stop the servers.
pause
