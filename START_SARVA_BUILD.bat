@echo off
setlocal

cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"

echo.
echo ========================================
echo   Starting Sarva Build PDF Mock Test
echo ========================================
echo.

where pnpm.cmd >nul 2>nul
if errorlevel 1 (
  echo pnpm was not found.
  echo Please install Node.js first, then run:
  echo corepack.cmd enable
  echo corepack.cmd prepare pnpm@latest --activate
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\.pnpm" (
  echo Installing project packages. This may take a few minutes the first time...
  pnpm.cmd install
  if errorlevel 1 (
    echo.
    echo Package install failed. Please send the error to Codex.
    pause
    exit /b 1
  )
)

echo Starting API server...
start "Sarva Build API Server" /D "%~dp0" cmd /k "set PATH=C:\Program Files\nodejs;%PATH%&& pnpm.cmd --filter @workspace/api-server run dev"

timeout /t 4 /nobreak >nul

echo Starting website...
start "Sarva Build Website" /D "%~dp0" cmd /k "set PATH=C:\Program Files\nodejs;%PATH%&& pnpm.cmd --filter @workspace/mock-test run dev"

timeout /t 6 /nobreak >nul

start "" "http://localhost:19055/"

echo.
echo Website opened at http://localhost:19055/
echo Keep the two server windows open while using the app.
echo To stop the app, close those windows or press Ctrl+C in each server window.
echo.
pause
