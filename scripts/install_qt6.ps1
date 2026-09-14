# FWYS - Qt 6 Install Helper (Windows)
# Run from project root: .\scripts\install_qt6.ps1

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  FWYS - Qt 6 Installer & Environment Helper" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Search for Qt 6 installation
$qtFound = $null
$qtCandidates = Get-ChildItem -Path "C:\Qt", "D:\Qt" -Filter "msvc*" -Recurse -Depth 3 -ErrorAction SilentlyContinue | Where-Object { Test-Path "$($_.FullName)\lib\cmake\Qt6" }

if ($qtCandidates) {
    $qtFound = $qtCandidates[0].FullName
}

if ($qtFound) {
    Write-Host "[OK] Qt 6 SDK found at: $qtFound" -ForegroundColor Green
    [System.Environment]::SetEnvironmentVariable("QT6_DIR", $qtFound, "User")
    $env:QT6_DIR = $qtFound
    Write-Host "[SET] QT6_DIR = $qtFound" -ForegroundColor Cyan
} else {
    Write-Host "[INFO] Native C++ Qt 6 SDK is not yet installed." -ForegroundColor Yellow
    Write-Host "       FWYS requires Qt 6.5+ (Desktop MSVC 2022 x64) for the C++ QML desktop UI." -ForegroundColor Gray
    Write-Host ""
    Write-Host "       Installation Options:" -ForegroundColor White
    Write-Host "       1) Automated CLI Install (via aqtinstall):" -ForegroundColor Cyan
    Write-Host "          python -m pip install aqtinstall" -ForegroundColor Gray
    Write-Host "          python -m aqt install-qt windows desktop 6.8.2 win64_msvc2022_64 -m qtwebsockets -O C:\Qt" -ForegroundColor Gray
    Write-Host ""
    Write-Host "       2) Official Qt Online Installer (GUI):" -ForegroundColor Cyan
    Write-Host "          Download from: https://www.qt.io/download-qt-installer-oss" -ForegroundColor Gray
}

Write-Host ""

# 2. Check Visual Studio
Write-Host "Checking Visual Studio C++ Toolchain..." -ForegroundColor Yellow
$vsFound = $null
$vsCandidates = @(
    "${env:ProgramFiles}\Microsoft Visual Studio\18\Community",
    "${env:ProgramFiles}\Microsoft Visual Studio\18\Professional",
    "${env:ProgramFiles}\Microsoft Visual Studio\18\Enterprise",
    "${env:ProgramFiles}\Microsoft Visual Studio\2022\Community",
    "${env:ProgramFiles}\Microsoft Visual Studio\2022\Professional",
    "${env:ProgramFiles}\Microsoft Visual Studio\2022\Enterprise"
)

foreach ($vsc in $vsCandidates) {
    if (Test-Path $vsc) {
        $vsFound = $vsc
        break
    }
}

if ($vsFound) {
    Write-Host "[OK] Visual Studio found: $vsFound" -ForegroundColor Green
} else {
    Write-Host "[WARN] Visual Studio not detected in standard paths." -ForegroundColor Yellow
}

Write-Host ""

# 3. Check CMake & Ninja
Write-Host "Checking CMake..." -ForegroundColor Yellow
$cmakeCmd = Get-Command cmake -ErrorAction SilentlyContinue
if ($cmakeCmd) {
    $cmakeVer = (cmake --version | Select-Object -First 1)
    Write-Host "[OK] CMake in PATH: $cmakeVer" -ForegroundColor Green
} elseif ($vsFound) {
    $vsCmake = "$vsFound\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
    if (Test-Path $vsCmake) {
        Write-Host "[OK] Found CMake in Visual Studio: $vsCmake" -ForegroundColor Green
        $cmakeDir = Split-Path -Parent $vsCmake
        $env:PATH = "$cmakeDir;$env:PATH"
        Write-Host "[SET] Added Visual Studio CMake to current session PATH" -ForegroundColor Cyan
    } else {
        Write-Host "[WARN] CMake not found." -ForegroundColor Yellow
    }
} else {
    Write-Host "[WARN] CMake not found." -ForegroundColor Yellow
}

Write-Host ""

# 4. Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
    $nodeVer = node --version
    Write-Host "[OK] Node.js found: $nodeVer" -ForegroundColor Green
}

Write-Host ""

# 5. Check Python
Write-Host "Checking Python..." -ForegroundColor Yellow
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if ($pythonCmd) {
    $pyVer = python --version
    Write-Host "[OK] Python found: $pyVer" -ForegroundColor Green
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Setup Check Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
