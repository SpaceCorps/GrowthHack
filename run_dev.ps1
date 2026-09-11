# SpaceCorps // GrowthHack Dev Launcher
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Starting SpaceCorps // GrowthHack (Rust + Vite+ + agy)  " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

$hostAddress = if ([string]::IsNullOrWhiteSpace($env:HOST)) { "127.0.0.1" } else { $env:HOST }
$port = if ([string]::IsNullOrWhiteSpace($env:PORT)) { "4200" } else { $env:PORT }

$env:HOST = $hostAddress
$env:PORT = $port

$backendProcess = Start-Process -FilePath "cargo" -ArgumentList "run" -WorkingDirectory "$PSScriptRoot\backend" -PassThru
Write-Host "[BACKEND] Launched Axum server on http://$($hostAddress):$($port) (PID: $($backendProcess.Id))" -ForegroundColor Green

Start-Sleep -Seconds 2

Write-Host "[FRONTEND] Launching Vite+ dev server on http://localhost:5173..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\frontend"
vp dev
