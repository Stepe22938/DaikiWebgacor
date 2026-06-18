$ErrorActionPreference = "Stop"

Set-Location "C:\Users\Zaidan\Desktop\Server-Gila\Zaidan Web\artifacts\api-server"
$env:NODE_ENV = "production"
$logPath = "C:\Users\Zaidan\Desktop\Server-Gila\Zaidan Web\artifacts\api-server\foreground-boot.log"

Remove-Item $logPath -ErrorAction SilentlyContinue
& "C:\Program Files\nodejs\node.exe" --enable-source-maps .\dist\index.mjs *>> $logPath
Add-Content -Path $logPath -Value ("EXIT_CODE=" + $LASTEXITCODE)
