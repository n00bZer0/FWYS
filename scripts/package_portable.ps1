# scripts/package_portable.ps1
# Automates the creation of a standalone portable build and zip distribution for FWYS Antidetect Browser

param (
    [string]$DistDir = "d:\C_Camofoux_Node\dist",
    [string]$BuildType = "Release"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  FWYS Antidetect Browser - Standalone Portable Packager  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$RootDir = "d:\C_Camofoux_Node"
$PortableDir = Join-Path $DistDir "FWYS_Portable"
$ExeSource = Join-Path $RootDir "ui\build\$BuildType\FWYS.exe"
$QmlDir = Join-Path $RootDir "ui\qml"
$Windeployqt = "C:\Qt\6.8.2\msvc2022_64\bin\windeployqt.exe"

# 1. Verify build
if (-not (Test-Path $ExeSource)) {
    throw "FWYS.exe not found at $ExeSource. Please build the project first."
}
Write-Host "[1/7] Verified executable: $ExeSource" -ForegroundColor Green

# 2. Prepare directories
if (Test-Path $PortableDir) {
    Write-Host "[2/7] Cleaning previous portable directory..." -ForegroundColor Yellow
    Remove-Item -Path $PortableDir -Recurse -Force
}
New-Item -ItemType Directory -Path $PortableDir -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PortableDir "profiles\user_data") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PortableDir "injector") -Force | Out-Null
Write-Host "[2/7] Created portable directory tree at $PortableDir" -ForegroundColor Green

# 3. Copy FWYS.exe
Copy-Item -Path $ExeSource -Destination (Join-Path $PortableDir "FWYS.exe") -Force
Write-Host "[3/7] Copied FWYS.exe to target" -ForegroundColor Green

# 4. Deploy Qt6 Runtime Dependencies via windeployqt
Write-Host "[4/7] Deploying Qt6 runtime libraries via windeployqt..." -ForegroundColor Yellow
$deployArgs = @(
    "--qmldir", $QmlDir,
    "--release",
    "--compiler-runtime",
    (Join-Path $PortableDir "FWYS.exe")
)
& $Windeployqt @deployArgs
Write-Host "[4/7] Qt6 runtime libraries successfully deployed." -ForegroundColor Green

# 5. Copy MSVC C++ Runtime DLLs (for zero-dependency clean Windows execution)
Write-Host "[5/8] Copying MSVC C++ Runtime DLLs..." -ForegroundColor Yellow
$crtDlls = @('vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll', 'msvcp140_1.dll', 'msvcp140_2.dll')
foreach ($d in $crtDlls) {
    $src = "C:\Windows\System32\$d"
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $PortableDir -Force
        Write-Host "      Copied CRT: $d" -ForegroundColor Green
    }
}

# 6. Embed Node.js Runtime
Write-Host "[6/8] Embedding Node.js runtime..." -ForegroundColor Yellow
$nodeSource = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodeSource) {
    $nodeSource = "C:\Program Files\nodejs\node.exe"
}
if (Test-Path $nodeSource) {
    Copy-Item -Path $nodeSource -Destination (Join-Path $PortableDir "node.exe") -Force
    Write-Host "      Embedded Node.js: $nodeSource -> dist\FWYS_Portable\node.exe" -ForegroundColor Green
} else {
    Write-Warning "node.exe could not be found locally. Host must have node installed."
}

# 7. Copy Injector Engine (Node.js Stealth Backend)
Write-Host "[7/8] Bundling Stealth Injector engine..." -ForegroundColor Yellow
$injectorTarget = Join-Path $PortableDir "injector"
Copy-Item -Path (Join-Path $RootDir "injector\src") -Destination (Join-Path $injectorTarget "src") -Recurse -Force
Copy-Item -Path (Join-Path $RootDir "injector\package.json") -Destination (Join-Path $injectorTarget "package.json") -Force
if (Test-Path (Join-Path $RootDir "injector\package-lock.json")) {
    Copy-Item -Path (Join-Path $RootDir "injector\package-lock.json") -Destination (Join-Path $injectorTarget "package-lock.json") -Force
}

# Copy node_modules (excluding test caches if any)
Write-Host "      Copying injector node_modules (production stealth modules)..." -ForegroundColor Yellow
$injectorNodeModules = Join-Path $RootDir "injector\node_modules"
if (Test-Path $injectorNodeModules) {
    $destNodeModules = Join-Path $injectorTarget "node_modules"
    robocopy $injectorNodeModules $destNodeModules /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    Write-Host "      node_modules bundled successfully." -ForegroundColor Green
} else {
    Write-Warning "node_modules not found in injector directory!"
}

# 8. Copy Chromium Portable (if available)
$chromiumSource = Join-Path $RootDir "dist\chromium"
if (Test-Path (Join-Path $chromiumSource "chrome.exe")) {
    Write-Host "      Bundling Ungoogled-Chromium Portable..." -ForegroundColor Yellow
    $chromiumDest = Join-Path $PortableDir "chromium"
    robocopy $chromiumSource $chromiumDest /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    Write-Host "      Chromium Portable bundled successfully." -ForegroundColor Green
}

# 8. Create Launchers & Documentation
Write-Host "[8/8] Generating 1-Click Launchers and Documentation..." -ForegroundColor Yellow

$batContent = @"
@echo off
setlocal
title FWYS Antidetect Browser
cd /d "%~dp0"
echo ===================================================
echo   FWYS Antidetect Browser - Portable Edition
echo ===================================================
echo Starting FWYS...
start "" "%~dp0FWYS.exe"
exit /b 0
"@
Set-Content -Path (Join-Path $PortableDir "Launch_FWYS.bat") -Value $batContent -Encoding Ascii

$readmeContent = @"
================================================================================
  FWYS ANTIDETECT BROWSER - STANDALONE PORTABLE DISTRIBUTION
================================================================================

Version: 1.0.0
Build: Release (Standalone Portable)

OVERVIEW:
This package is a completely self-contained portable build of FWYS Antidetect Browser.
No installation of Qt, Visual Studio, Python, or Node.js is required on the host system.

HOW TO RUN:
1. Double-click `Launch_FWYS.bat` or `FWYS.exe`.
2. The browser management dashboard will open.

PORTABLE STORAGE:
- All profiles, cookies, browser caches, and fingerprint databases are stored
  inside the `profiles\` folder within this portable directory.
- You can move this entire folder to any drive (or USB drive) and run it anywhere.

COMPONENTS INCLUDED:
- FWYS.exe: Modern Qt6 Quick/QML UI Dashboard
- node.exe: Embedded Node.js runtime for zero-dependency CDP automation
- injector/: High-fidelity CDP & fingerprint spoofing engine
- profiles/: 100% self-contained SQLite database and user data directories
- Qt6 Runtime: Qt6Core, Qt6Gui, Qt6Widgets, Qt6Quick, Qt6Qml, Qt6Sql, qsqlite.dll, etc.
- MSVC C++ Runtime: vcruntime140.dll, msvcp140.dll, vcruntime140_1.dll

================================================================================
"@
Set-Content -Path (Join-Path $PortableDir "README.txt") -Value $readmeContent -Encoding UTF8

# Clean any temporary profile test databases before final packaging
Get-ChildItem -Path (Join-Path $PortableDir "profiles") -Filter "*.db*" -ErrorAction SilentlyContinue | Remove-Item -Force

# Create portable distribution ZIP
$zipPath = Join-Path $DistDir "FWYS_Portable_v1.0.0.zip"
Write-Host "Creating compressed archive: $zipPath..." -ForegroundColor Yellow
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path "$PortableDir\*" -DestinationPath $zipPath -CompressionLevel Optimal
Write-Host "Archive created successfully: $zipPath" -ForegroundColor Green

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "Standalone Portable Build successfully created at:" -ForegroundColor Cyan
Write-Host "  Folder:  $PortableDir" -ForegroundColor White
Write-Host "  Archive: $zipPath" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
