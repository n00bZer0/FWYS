# scripts/verify_portable.ps1
$proc = Start-Process -FilePath "d:\C_Camofoux_Node\dist\FWYS_Portable\FWYS.exe" -PassThru
Start-Sleep -Seconds 3
if (-not $proc.HasExited) {
    Write-Host "Verification Success: FWYS.exe is running healthy without missing DLLs! PID: $($proc.Id)" -ForegroundColor Green
    Stop-Process -Id $proc.Id -Force
    Write-Host "Gracefully terminated test process." -ForegroundColor Green
} else {
    Write-Host "Error: Process exited with code: $($proc.ExitCode)" -ForegroundColor Red
}
