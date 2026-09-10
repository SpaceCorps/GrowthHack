# SpaceCorps // GrowthHack Dev Launcher
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Starting SpaceCorps // GrowthHack (Rust + Vite+ + agy)  " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

$backendProcess = Start-Process -FilePath "cargo" -ArgumentList "run" -WorkingDirectory "$PSScriptRoot\backend" -PassThru
Write-Host "[BACKEND] Launched Axum server on http://127.0.0.1:4200 (PID: $($backendProcess.Id))" -ForegroundColor Green

Start-Sleep -Seconds 2

Write-Host "[FRONTEND] Launching Vite+ dev server on http://localhost:5173..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\frontend"
vp dev
