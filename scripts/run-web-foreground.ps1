$ErrorActionPreference = "Stop"

Set-Location "C:\Users\Zaidan\Desktop\Server-Gila\Zaidan Web"
$env:NODE_ENV = "development"

& "C:\Program Files\nodejs\corepack.cmd" pnpm -C artifacts/mc-roleplay dev --host 0.0.0.0
