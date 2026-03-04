@echo off
setlocal
TITLE JewelAdmin Pro - Booting System

set "APP_ROOT=%~dp0.."
set "BACKEND_WINDOW=JewelAdmin Backend"
set "FRONTEND_WINDOW=JewelAdmin Frontend"

:: 1. Start PostgreSQL Database
echo Starting Database...
net start "postgresql-x64-18" >nul 2>&1
if errorlevel 1 (
  echo Database service may already be running or requires admin rights.
) else (
  echo Database started.
)

:: 2. Start Backend (in a dedicated window)
echo Starting Backend...
start "%BACKEND_WINDOW%" /high cmd /c "cd /d ""%APP_ROOT%"" && npm.cmd run backend"

:: 3. Start Frontend (in a dedicated window)
echo Starting Frontend...
start "%FRONTEND_WINDOW%" /high cmd /c "cd /d ""%APP_ROOT%"" && npm.cmd run start"

:: 4. Wait a few seconds then open the browser
timeout /t 5 >nul
start http://localhost:5173

echo.
echo ==========================================
echo SYSTEM ACTIVE: Dashboard opening in browser
echo ==========================================
pause
endlocal
