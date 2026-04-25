# Post-deploy smoke checks. Usage:
#   .\scripts\verify-deploy.ps1 -ApiBase https://your-api.example.com
param(
    [Parameter(Mandatory = $true)]
    [string]$ApiBase
)
$base = $ApiBase.TrimEnd('/')
Write-Host "GET $base/api/health"
$r = Invoke-WebRequest -Uri "$base/api/health" -UseBasicParsing
if ($r.StatusCode -ne 200) { throw "Health failed: $($r.StatusCode)" }
Write-Host $r.Content
Write-Host "GET $base/api/defaults"
$d = Invoke-WebRequest -Uri "$base/api/defaults" -UseBasicParsing
if ($d.StatusCode -ne 200) { throw "Defaults failed: $($d.StatusCode)" }
Write-Host $d.Content
Write-Host "OK"
