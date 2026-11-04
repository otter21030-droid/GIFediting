@echo off
cd /d "%~dp0"
set GIF_STUDIO_OPEN=1
node server.js
if errorlevel 1 (
  echo.
  echo 앱을 시작하지 못했습니다. Node.js 설치 여부를 확인해 주세요.
  pause
)
