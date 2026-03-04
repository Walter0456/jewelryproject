@echo off
TITLE JewelAdmin Pro - Booting System

:: 1. Start PostgreSQL Database
echo Starting Database...
net start "postgresql-x64-18"
:: Note: Replace "postgresql-x64-16" with your name from Step 1

:: 2. Start Backend (in a new window with high priority)
echo Starting Backend...
cd /d "%~dp0.."
start "Backend Server" /high cmd /c "npm run backend"

:: 3. Start Frontend (in a new window with high priority)
echo Starting Frontend...
start "Frontend UI" /high cmd /c "npm run start"

:: 4. Wait a few seconds then open the browser
timeout /t 5
start http://localhost:5173

echo.
echo ==========================================
echo SYSTEM ACTIVE: Dashboard opening in browser
echo ==========================================
pause