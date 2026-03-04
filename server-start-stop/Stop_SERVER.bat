@echo off
setlocal
TITLE JewelAdmin Pro - Shutting Down

set "BACKEND_WINDOW=JewelAdmin Backend"
set "FRONTEND_WINDOW=JewelAdmin Frontend"
set "LEGACY_BACKEND_WINDOW=Backend Server"
set "LEGACY_FRONTEND_WINDOW=Frontend UI"

:: 1. Stop only JewelAdmin command windows (and their child node processes)
echo Closing JewelAdmin Frontend and Backend...
taskkill /F /FI "WINDOWTITLE eq %BACKEND_WINDOW%*" /T >nul 2>&1
if errorlevel 1 (
  echo Backend window not found.
) else (
  echo Backend stopped.
)

taskkill /F /FI "WINDOWTITLE eq %LEGACY_BACKEND_WINDOW%*" /T >nul 2>&1

taskkill /F /FI "WINDOWTITLE eq %FRONTEND_WINDOW%*" /T >nul 2>&1
if errorlevel 1 (
  echo Frontend window not found.
) else (
  echo Frontend stopped.
)

taskkill /F /FI "WINDOWTITLE eq %LEGACY_FRONTEND_WINDOW%*" /T >nul 2>&1

:: 1b. Fallback: kill any stale listeners on app ports
powershell -NoProfile -Command ^
  "$ports = 3001,5173; foreach($p in $ports){ Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }"

:: 2. Stop PostgreSQL Database
echo Stopping Database...
net stop "postgresql-x64-18" >nul 2>&1
if errorlevel 1 (
  echo Database service may already be stopped or requires admin rights.
) else (
  echo Database stopped.
)

echo.
echo ==========================================
echo SYSTEM OFFLINE: JewelAdmin services stopped.
echo ==========================================
timeout /t 3 >nul
endlocal
