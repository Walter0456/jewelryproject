@echo off
setlocal

cd /d "%~dp0.."
call npm run snapshot:inventory

endlocal
exit /b %ERRORLEVEL%
