# FWYS — Qt 6 Install Helper (Windows)
# Run this script as Administrator in PowerShell

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  FWYS — Qt 6 Installer Helper" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if winget is available
$hasWinget = Get-Command winget -ErrorAction SilentlyContinue

# Check if Qt is already installed
$qtPaths = @(
    "C:\Qt\6.7",
    "C:\Qt\6.6",
    "C:\Qt\6.5",
    "C:\Qt\6.8"
)

$qtFound = $null
foreach ($path in $qtPaths) {
    if (Test-Path $path) {
        $qtFound = $path
        break
    }
}

if ($qtFound) {
    Write-Host "[OK] Qt 6 found at: $qtFound" -ForegroundColor Green
    Write-Host ""
    Write-Host "Checking for MSVC build..." -ForegroundColor Yellow
    $msvcPath = "$qtFound\msvc2022_64"
    $mingwPath = "$qtFound\mingw_64"
    
    if (Test-Path $msvcPath) {
        Write-Host "[OK] Qt 6 MSVC build found: $msvcPath" -ForegroundColor Green
        [System.Environment]::SetEnvironmentVariable("QT6_DIR", $msvcPath, "User")
        Write-Host "[SET] QT6_DIR = $msvcPath" -ForegroundColor Cyan
    } elseif (Test-Path $mingwPath) {
        Write-Host "[OK] Qt 6 MinGW build found: $mingwPath" -ForegroundColor Green
        [System.Environment]::SetEnvironmentVariable("QT6_DIR", $mingwPath, "User")
        Write-Host "[SET] QT6_DIR = $mingwPath" -ForegroundColor Cyan
    } else {
        Write-Host "[WARN] Qt 6 directory found but no compiler-specific build detected" -ForegroundColor Yellow
        Write-Host "       Please ensure msvc2022_64 or mingw_64 is installed via Qt Maintenance Tool" -ForegroundColor Yellow
    }
} else {
    Write-Host "[INFO] Qt 6 not found. Opening Qt Online Installer..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please install Qt 6 with these components:" -ForegroundColor White
    Write-Host "  - Qt 6.7.x (or latest)" -ForegroundColor White  
    Write-Host "  - MSVC 2022 64-bit  (recommended)" -ForegroundColor White
    Write-Host "  - Qt Quick / QML" -ForegroundColor White
    Write-Host "  - Qt SQL" -ForegroundColor White
    Write-Host "  - Qt WebSockets" -ForegroundColor White
    Write-Host ""
    
    $download = "https://www.qt.io/download-qt-installer-oss"
    Write-Host "Downloading Qt Installer..." -ForegroundColor Cyan
    Start-Process $download
    
    Write-Host ""
    Write-Host "After installation, re-run this script to set environment variables." -ForegroundColor Yellow
}

Write-Host ""

# Check Visual Studio
Write-Host "Checking Visual Studio 2022..." -ForegroundColor Yellow
$vsPath = "${env:ProgramFiles}\Microsoft Visual Studio\2022"
if (Test-Path $vsPath) {
    Write-Host "[OK] Visual Studio 2022 found" -ForegroundColor Green
} else {
    Write-Host "[WARN] VS 2022 not found. Required for MSVC Qt builds." -ForegroundColor Yellow
    Write-Host "       Download: https://visualstudio.microsoft.com/downloads/" -ForegroundColor Gray
    Write-Host "       Required workloads: 'Desktop development with C++'" -ForegroundColor Gray
}

Write-Host ""

# Check CMake
Write-Host "Checking CMake..." -ForegroundColor Yellow
$cmake = Get-Command cmake -ErrorAction SilentlyContinue
if ($cmake) {
    $cmakeVer = (cmake --version | Select-Object -First 1)
    Write-Host "[OK] CMake found: $cmakeVer" -ForegroundColor Green
} else {
    Write-Host "[WARN] CMake not found. Installing via winget..." -ForegroundColor Yellow
    if ($hasWinget) {
        winget install Kitware.CMake
    } else {
        Write-Host "       Download: https://cmake.org/download/" -ForegroundColor Gray
    }
}

Write-Host ""

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    $nodeVer = node --version
    Write-Host "[OK] Node.js found: $nodeVer" -ForegroundColor Green
} else {
    Write-Host "[WARN] Node.js not found. Installing..." -ForegroundColor Yellow
    if ($hasWinget) {
        winget install OpenJS.NodeJS.LTS
    } else {
        Write-Host "       Download: https://nodejs.org/en/download" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Setup Check Complete!" -ForegroundColor Green
Write-Host "  Next: Run .\scripts\build_ui.ps1" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
