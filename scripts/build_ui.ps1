# FWYS — Build Qt 6 UI
# Run from project root: .\scripts\build_ui.ps1

param(
    [string]$Config = "Release",
    [string]$QtDir = ""
)

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  FWYS — Building Qt 6 UI ($Config)" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Find Qt6 directory
if ([string]::IsNullOrEmpty($QtDir)) {
    $QtDir = $env:QT6_DIR
}

if ([string]::IsNullOrEmpty($QtDir)) {
    # Auto-detect common Qt install paths
    $searchPaths = @(
        "C:\Qt\6.8\msvc2022_64",
        "C:\Qt\6.7\msvc2022_64",
        "C:\Qt\6.6\msvc2022_64",
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
    Write-Host "[ERROR] Qt6 directory not found!" -ForegroundColor Red
    Write-Host "        Run .\scripts\install_qt6.ps1 first, or set QT6_DIR env var" -ForegroundColor Yellow
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
    -G "Visual Studio 17 2022" `
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
