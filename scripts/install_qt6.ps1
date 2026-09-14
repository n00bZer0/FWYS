# FWYS - Qt 6 Install Helper (Windows)
# Run from project root: .\scripts\install_qt6.ps1

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  FWYS - Qt 6 Installer & Environment Helper" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if winget is available
$hasWinget = (Get-Command winget -ErrorAction SilentlyContinue) -ne $null

# 1. Search for Qt 6 installation
$qtSearchLocations = @(
    "C:\Qt\6.9", "C:\Qt\6.8", "C:\Qt\6.7", "C:\Qt\6.6", "C:\Qt\6.5",
    "D:\Qt\6.9", "D:\Qt\6.8", "D:\Qt\6.7", "D:\Qt\6.6", "D:\Qt\6.5",
    "C:\Qt", "D:\Qt"
)

$qtFound = $null
foreach ($path in $qtSearchLocations) {
    if (Test-Path $path) {
        # Check subdirectories for msvc or mingw
        $candidates = Get-ChildItem -Path $path -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "msvc*" -or $_.Name -like "mingw*" }
        if ($candidates) {
            $qtFound = $candidates[0].FullName
            break
        } elseif (Test-Path "$path\bin\qmake.exe") {
            $qtFound = $path
            break
        }
    }
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
    Write-Host "          python -m aqt install-qt windows desktop 6.8.0 win64_msvc2022_64 -O C:\Qt" -ForegroundColor Gray
    Write-Host ""
    Write-Host "       2) Official Qt Online Installer (GUI):" -ForegroundColor Cyan
    Write-Host "          Download from: https://www.qt.io/download-qt-installer-oss" -ForegroundColor Gray
    Write-Host "          Select: Qt 6.8 (or 6.7) -> MSVC 2022 64-bit, Qt Quick, Qt SQL" -ForegroundColor Gray
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
    Write-Host "       Required: Visual Studio 2022 / 2026 with 'Desktop development with C++'" -ForegroundColor Gray
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
        # Add to current session PATH
        $cmakeDir = Split-Path -Parent $vsCmake
        $env:PATH = "$cmakeDir;$env:PATH"
        Write-Host "[SET] Added Visual Studio CMake to current session PATH" -ForegroundColor Cyan
    } else {
        Write-Host "[WARN] CMake not found. Download: https://cmake.org/download/" -ForegroundColor Yellow
    }
} else {
    Write-Host "[WARN] CMake not found. Download: https://cmake.org/download/" -ForegroundColor Yellow
}

Write-Host ""

# 4. Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
    $nodeVer = node --version
    Write-Host "[OK] Node.js found: $nodeVer" -ForegroundColor Green
} else {
    Write-Host "[WARN] Node.js not found. Download: https://nodejs.org/" -ForegroundColor Yellow
}

Write-Host ""

# 5. Check Python
Write-Host "Checking Python..." -ForegroundColor Yellow
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if ($pythonCmd) {
    $pyVer = python --version
    Write-Host "[OK] Python found: $pyVer" -ForegroundColor Green
} else {
    Write-Host "[WARN] Python not found. Download: https://www.python.org/" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Setup Check Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
