$ErrorActionPreference = "Stop"

$workspaceRoot = "C:\Users\Zaidan\Desktop\Server-Gila\Zaidan Web"
$apiRoot = Join-Path $workspaceRoot "artifacts\api-server"
$logPath = Join-Path $apiRoot "boot.log"
$nodePath = "C:\Program Files\nodejs\node.exe"

Set-Location $workspaceRoot

Remove-Item $logPath -ErrorAction SilentlyContinue

$job = Start-Job -Name "ArcadiaApiServer" -ScriptBlock {
  param($apiRootParam, $nodePathParam, $logPathParam)

  Set-Location $apiRootParam
  $env:NODE_ENV = "production"

  & $nodePathParam --enable-source-maps ./dist/index.mjs *>> $logPathParam
} -ArgumentList $apiRoot, $nodePath, $logPath

while ($true) {
  $currentJob = Get-Job -Id $job.Id -ErrorAction SilentlyContinue
  if (-not $currentJob) {
    break
  }

  if ($currentJob.State -in @("Completed", "Failed", "Stopped")) {
    Receive-Job -Id $job.Id -Keep | Out-File -FilePath $logPath -Append
    break
  }

  Start-Sleep -Seconds 2
}
