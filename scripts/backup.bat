@echo off
setlocal

cd /d "%~dp0.."
call node scripts\backup-db.js

endlocal
exit /b %ERRORLEVEL%
