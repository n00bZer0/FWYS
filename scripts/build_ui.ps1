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

if ([string]::IsNullOrEmpty($QtDir) -or -not (Test-Path $QtDir)) {
    # Auto-detect Qt install paths
    $qtCandidates = Get-ChildItem -Path "C:\Qt", "D:\Qt" -Filter "msvc*" -Recurse -Depth 3 -ErrorAction SilentlyContinue | Where-Object { Test-Path "$($_.FullName)\lib\cmake\Qt6" }
    if ($qtCandidates) {
        $QtDir = $qtCandidates[0].FullName
        Write-Host "[AUTO] Found Qt6 at: $QtDir" -ForegroundColor Green
    }
}

if ([string]::IsNullOrEmpty($QtDir) -or -not (Test-Path $QtDir)) {
    Write-Host "[ERROR] Qt6 C++ SDK not found!" -ForegroundColor Red
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
