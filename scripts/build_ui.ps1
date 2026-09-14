# FWYS - Build Qt 6 UI
# Run from project root: .\scripts\build_ui.ps1

param(
    [string]$Config = "Release",
    [string]$QtDir = ""
)

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  FWYS - Building Qt 6 UI ($Config)" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Ensure CMake is available
$cmakeCmd = Get-Command cmake -ErrorAction SilentlyContinue
if (-not $cmakeCmd) {
    $vsCMakeCandidates = @(
        "${env:ProgramFiles}\Microsoft Visual Studio\18\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe",
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe",
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\Enterprise\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe",
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\Professional\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
    )
    foreach ($candidate in $vsCMakeCandidates) {
        if (Test-Path $candidate) {
            $cmakeDir = Split-Path -Parent $candidate
            $env:PATH = "$cmakeDir;$env:PATH"
            Write-Host "[AUTO] Using CMake from Visual Studio: $cmakeDir" -ForegroundColor Green
            break
        }
    }
}

# Find Qt6 directory
if ([string]::IsNullOrEmpty($QtDir)) {
    $QtDir = $env:QT6_DIR
}

if ([string]::IsNullOrEmpty($QtDir)) {
    # Auto-detect common Qt install paths
    $searchPaths = @(
        "C:\Qt\6.9\msvc2022_64",
        "C:\Qt\6.8\msvc2022_64",
        "C:\Qt\6.7\msvc2022_64",
        "C:\Qt\6.6\msvc2022_64",
        "C:\Qt\6.8.0\msvc2022_64",
        "D:\Qt\6.8\msvc2022_64",
        "D:\Qt\6.7\msvc2022_64",
        "C:\Qt\6.8\mingw_64",
        "C:\Qt\6.7\mingw_64"
    )
    foreach ($p in $searchPaths) {
        if (Test-Path "$p\lib\cmake\Qt6") {
            $QtDir = $p
            Write-Host "[AUTO] Found Qt6 at: $QtDir" -ForegroundColor Green
            break
        }
    }
}

if ([string]::IsNullOrEmpty($QtDir) -or -not (Test-Path $QtDir)) {
    Write-Host "[ERROR] Qt6 C++ SDK not found!" -ForegroundColor Red
    Write-Host "        Qt 6.5+ (MSVC 2022 x64) is required to compile the native UI." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "        Quick install command (via python):" -ForegroundColor Cyan
    Write-Host "          python -m pip install aqtinstall" -ForegroundColor Gray
    Write-Host "          python -m aqt install-qt windows desktop 6.8.0 win64_msvc2022_64 -O C:\Qt" -ForegroundColor Gray
    Write-Host ""
    Write-Host "        Then re-run .\scripts\build_ui.ps1" -ForegroundColor Yellow
    exit 1
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$uiDir = Join-Path $projectRoot "ui"
$buildDir = Join-Path $uiDir "build"

Write-Host "Project: $projectRoot" -ForegroundColor Gray
Write-Host "Qt6 Dir: $QtDir" -ForegroundColor Gray
Write-Host "Build:   $buildDir" -ForegroundColor Gray
Write-Host ""

# Create build directory
if (-not (Test-Path $buildDir)) {
    New-Item -ItemType Directory -Path $buildDir | Out-Null
}

# CMake configure
Write-Host "[1/3] Configuring CMake..." -ForegroundColor Yellow
Push-Location $buildDir

# Detect generator or let CMake pick default VS generator
$cmakeResult = cmake .. `
    -DCMAKE_PREFIX_PATH="$QtDir" `
    -DCMAKE_BUILD_TYPE=$Config `
    -A x64

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] CMake configuration failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "[OK] CMake configured" -ForegroundColor Green

# Build
Write-Host ""
Write-Host "[2/3] Building..." -ForegroundColor Yellow
cmake --build . --config $Config --parallel

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Build failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "[OK] Build complete" -ForegroundColor Green

# Deploy Qt DLLs (windeployqt)
Write-Host ""
Write-Host "[3/3] Deploying Qt runtime..." -ForegroundColor Yellow
$exePath = Join-Path $buildDir "$Config\FWYS.exe"
$windeployqt = Join-Path $QtDir "bin\windeployqt.exe"

if (Test-Path $windeployqt) {
    & $windeployqt --qmldir "$uiDir\qml" "$exePath"
    Write-Host "[OK] Qt runtime deployed" -ForegroundColor Green
} else {
    Write-Host "[WARN] windeployqt not found at $windeployqt" -ForegroundColor Yellow
}

Pop-Location

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "  Executable: $exePath" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Green
