@echo off
TITLE JewelAdmin Pro - Shutting Down

:: 1. Kill all Node.js processes (Frontend and Backend)
echo Closing Frontend and Backend...
taskkill /F /IM node.exe /T

:: 2. Stop PostgreSQL Database
echo Stopping Database...
net stop "postgresql-x64-18"

echo.
echo ==========================================
echo SYSTEM OFFLINE: All services stopped.
echo ==========================================
timeout /t 3