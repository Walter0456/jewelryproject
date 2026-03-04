@echo off
setlocal
TITLE JewelAdmin Pro - Shutting Down

set "BACKEND_WINDOW=JewelAdmin Backend"
set "FRONTEND_WINDOW=JewelAdmin Frontend"

:: 1. Stop only JewelAdmin command windows (and their child node processes)
echo Closing JewelAdmin Frontend and Backend...
taskkill /F /FI "WINDOWTITLE eq %BACKEND_WINDOW%*" /T >nul 2>&1
if errorlevel 1 (
  echo Backend window not found.
) else (
  echo Backend stopped.
)

taskkill /F /FI "WINDOWTITLE eq %FRONTEND_WINDOW%*" /T >nul 2>&1
if errorlevel 1 (
  echo Frontend window not found.
) else (
  echo Frontend stopped.
)

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
