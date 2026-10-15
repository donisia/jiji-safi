@echo off
title Jiji Safi Launcher
cd /d "%~dp0"

echo ==========================================
echo   JIJI SAFI - WhatsApp Waste Bot Launcher
echo ==========================================

:: 1. Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install from https://python.org and tick "Add to PATH".
    pause
    exit /b 1
)

:: 2. Check ngrok
where ngrok >nul 2>&1
if errorlevel 1 (
    echo [ERROR] ngrok not found. Install it and run: ngrok config add-authtoken YOUR_TOKEN
    pause
    exit /b 1
)

:: 3. Check .env keys
findstr /C:"your_token_here" .env >nul 2>&1
if not errorlevel 1 (
    echo [WARNING] UltraMsg token missing in .env - replies will not be sent!
    pause
)
findstr /C:"your_gemini_key_here" .env >nul 2>&1
if not errorlevel 1 echo [NOTE] No Gemini key in .env - chat AI off, keyword bot only.

:: 4. Install requirements
echo Installing requirements...
python -m pip install -r requirements.txt -q

:: 4b. Make the pre-recorded voice notes (first run only)
if not exist "voices\en\menu.mp3" (
    echo Making voice notes with ElevenLabs - first time only...
    python generate_voices.py
)

:: 5. Start ngrok and Flask in their own windows (kept open)
echo Starting ngrok...
start "NGROK" cmd /k ngrok http 5000
echo Starting Flask bot...
start "FLASK BOT" cmd /k python app.py

:: 6. Wait for ngrok and read its HTTPS URL
set NGROK_URL=
set TRIES=0
:waitloop
set /a TRIES+=1
timeout /t 2 /nobreak >nul
for /f "delims=" %%i in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0get_ngrok_url.ps1"') do set NGROK_URL=%%i
if "%NGROK_URL%"=="" if %TRIES% LSS 10 goto waitloop

echo.
if "%NGROK_URL%"=="" (
    echo [!] Could not read the ngrok URL. Look at the NGROK window and copy the https link.
) else (
    echo ==========================================
    echo  PASTE THIS INTO ULTRAMSG ^> WEBHOOK URL:
    echo.
    echo    %NGROK_URL%/webhook
    echo.
    echo ==========================================
    echo %NGROK_URL%/webhook| clip
    echo (Already copied to your clipboard)
)
echo.
echo Keep the NGROK and FLASK BOT windows open. 
pause
