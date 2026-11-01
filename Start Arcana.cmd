@echo off
where node >nul 2>nul
if errorlevel 1 (
  echo Arcana needs Node.js 22 or later on PATH. Install Node, then try again.
  pause
  exit /b 1
)
node "%~dp0scripts\start.mjs" %*
if errorlevel 1 (
  echo Arcana could not start. Read the error above.
  pause
  exit /b 1
)
