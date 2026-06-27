@echo off
setlocal

set APP_DIR=%~dp0..
cd /d "%APP_DIR%"

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js and npm are required.
  pause
  exit /b 1
)

if not exist node_modules (
  call npm install
)

start "" http://localhost:3000
call npm run start
