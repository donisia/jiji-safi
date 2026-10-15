@echo off
title Safi Track Bot
cd /d "%~dp0"

if not exist ".env" (
    echo .env file missing. Put it in this folder and try again.
    pause
    exit /b 1
)

if not exist "venv\Scripts\python.exe" (
    echo Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo Python not found. Install Python 3.10+ and tick "Add to PATH".
        pause
        exit /b 1
    )
)

echo Installing requirements...
venv\Scripts\python.exe -m pip install -q -r requirements.txt

echo Starting Safi Track bot... (Ctrl+C to stop)
venv\Scripts\python.exe bot.py

echo.
echo Bot stopped.
pause
