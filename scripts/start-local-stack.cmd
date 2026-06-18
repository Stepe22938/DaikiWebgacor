@echo off
setlocal

set "ROOT=C:\Users\Zaidan\Desktop\Server-Gila\Zaidan Web"

start "Arcadia API" powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\run-api-job.ps1"
start "Arcadia Web" cmd /k "cd /d %ROOT% && C:\Program Files\nodejs\corepack.cmd pnpm -C artifacts\mc-roleplay dev --host 0.0.0.0"

echo Arcadia local stack is starting...
echo API window: Arcadia API
echo Web window: Arcadia Web
