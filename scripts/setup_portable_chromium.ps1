# scripts/setup_portable_chromium.ps1
# Downloads and extracts official Ungoogled-Chromium Portable for FWYS

param (
    [string]$TargetDir = "d:\C_Camofoux_Node\dist\chromium",
    [string]$PortableTarget = "d:\C_Camofoux_Node\dist\FWYS_Portable\chromium"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  FWYS Antidetect - Setup Ungoogled-Chromium Portable     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Get latest release URL from GitHub API
Write-Host "[1/4] Querying latest Ungoogled-Chromium Windows x64 release..." -ForegroundColor Yellow
$releaseApi = "https://api.github.com/repos/ungoogled-software/ungoogled-chromium-windows/releases/latest"
$release = Invoke-RestMethod -Uri $releaseApi
$asset = $release.assets | Where-Object { $_.name -match 'windows_x64\.zip' }

if (-not $asset) {
    throw "Could not find windows_x64.zip asset in latest release!"
}

$downloadUrl = $asset.browser_download_url
$zipFileName = $asset.name
$tempZip = Join-Path $env:TEMP $zipFileName

Write-Host "      Version: $($release.tag_name)" -ForegroundColor Green
Write-Host "      Download URL: $downloadUrl" -ForegroundColor Green
Write-Host "      File Size: $([math]::Round($asset.size / 1MB, 2)) MB" -ForegroundColor Green

# 2. Download ZIP
if ((Test-Path $tempZip) -and ((Get-Item $tempZip).Length -gt 100000000)) {
    Write-Host "[2/4] Found valid cached archive at $tempZip" -ForegroundColor Green
} else {
    if (Test-Path $tempZip) { Remove-Item $tempZip -Force }
    Write-Host "[2/4] Downloading $zipFileName using curl..." -ForegroundColor Yellow
    & curl.exe -L --fail --retry 3 -o $tempZip $downloadUrl
    Write-Host "      Download completed. Size: $([math]::Round((Get-Item $tempZip).Length / 1MB, 2)) MB" -ForegroundColor Green
}

# 3. Extract to Target Directory
Write-Host "[3/4] Extracting archive with tar..." -ForegroundColor Yellow
$tempExtractDir = Join-Path $env:TEMP ("fwys_extracted_" + [System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $tempExtractDir -Force | Out-Null

& tar.exe -xf $tempZip -C $tempExtractDir

# Ungoogled zip usually has a root folder like ungoogled-chromium_...
$innerFolder = Get-ChildItem -Path $tempExtractDir -Directory | Select-Object -First 1
$extractedRoot = if ($innerFolder) { $innerFolder.FullName } else { $tempExtractDir }

# Clean target dir
if (Test-Path $TargetDir) {
    Remove-Item -Path $TargetDir -Recurse -Force
}
New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null

# Move files to dist\chromium
Get-ChildItem -Path $extractedRoot | Move-Item -Destination $TargetDir -Force
Remove-Item -Path $tempExtractDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "      Extracted to: $TargetDir" -ForegroundColor Green

# 4. Copy to dist\FWYS_Portable\chromium if portable build exists
if (Test-Path "d:\C_Camofoux_Node\dist\FWYS_Portable") {
    Write-Host "[4/4] Syncing to dist\FWYS_Portable\chromium..." -ForegroundColor Yellow
    if (-not (Test-Path $PortableTarget)) {
        New-Item -ItemType Directory -Path $PortableTarget -Force | Out-Null
    }
    robocopy $TargetDir $PortableTarget /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    Write-Host "      Synced to: $PortableTarget" -ForegroundColor Green
}

# 5. Verification
$chromeExe = Join-Path $TargetDir "chrome.exe"
if (Test-Path $chromeExe) {
    $ver = (Get-Item $chromeExe).VersionInfo.ProductVersion
    Write-Host "`n==========================================================" -ForegroundColor Cyan
    Write-Host "  SUCCESS: Ungoogled-Chromium Portable Installed!        " -ForegroundColor Green
    Write-Host "  Executable: $chromeExe" -ForegroundColor White
    Write-Host "  Version:    $ver" -ForegroundColor White
    Write-Host "==========================================================" -ForegroundColor Cyan
} else {
    throw "chrome.exe not found at $chromeExe after extraction!"
}
