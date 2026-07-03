@echo off
setlocal

cd /d "%~dp0"

set NITRO_HOST=127.0.0.1
set NITRO_PORT=8092
set NODE_ENV=production
set APP_URL=http://127.0.0.1:8092/ai

echo.
echo CollabManga local
echo URL: %APP_URL%
echo.

netstat -ano | findstr /R /C:":%NITRO_PORT% .*LISTENING" >nul
if %ERRORLEVEL% EQU 0 (
  echo A local server is already running on port %NITRO_PORT%.
  start "" "%APP_URL%"
  exit /b 0
)

if not exist ".output\server\index.mjs" (
  echo Production build missing. Building the app once...
  call npm run build
  if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Build failed.
    pause
    exit /b 1
  )
)

start "" "%APP_URL%"
echo Keep this window open while using CollabManga locally.
echo Close it only when you want to stop the local site.
echo.

node .output\server\index.mjs

echo.
echo Local server stopped.
pause
