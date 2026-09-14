# FWYS — Dev Start Script
# Starts both the Qt UI and Node.js injector in development mode
# Run from project root: .\scripts\dev_start.ps1

param(
    [switch]$NodeOnly,
    [switch]$SkipNode
)

$root = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "  ╔═══════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║  FWYS — Dev Start                ║" -ForegroundColor Cyan
Write-Host "  ╚═══════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Start Node.js injector in background
if (-not $SkipNode) {
    $injectorPath = "$root\injector\src\index.js"
    if (Test-Path $injectorPath) {
        Write-Host "  [1/2] Starting Node.js injection layer..." -ForegroundColor Yellow
        $nodeJob = Start-Process -FilePath "node" `
            -ArgumentList $injectorPath `
            -WorkingDirectory "$root\injector" `
            -PassThru -NoNewWindow

        Write-Host "  [OK] Node.js PID: $($nodeJob.Id)" -ForegroundColor Green
        Start-Sleep -Milliseconds 800
    } else {
        Write-Host "  [WARN] Injector not found at $injectorPath" -ForegroundColor Yellow
        Write-Host "         Run: cd injector && npm install" -ForegroundColor Gray
    }
}

if ($NodeOnly) {
    Write-Host "  [INFO] Node-only mode. Press Ctrl+C to stop." -ForegroundColor Cyan
    Wait-Process -Id $nodeJob.Id
    exit
}

# Start Qt UI
$exePaths = @(
    "$root\ui\build\Release\FWYS.exe",
    "$root\ui\build\Debug\FWYS.exe",
    "$root\dist\FWYS.exe"
)

$exePath = $null
foreach ($p in $exePaths) {
    if (Test-Path $p) { $exePath = $p; break }
}

if ($exePath) {
    Write-Host "  [2/2] Starting Qt UI: $exePath" -ForegroundColor Yellow
    Start-Process -FilePath $exePath -WorkingDirectory $root
    Write-Host "  [OK] FWYS launched!" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Qt UI not built yet." -ForegroundColor Yellow
    Write-Host "         Run: .\scripts\build_ui.ps1" -ForegroundColor Gray
}

Write-Host ""
Write-Host "  FWYS is running. Close the browser window to stop." -ForegroundColor Cyan
Write-Host ""
