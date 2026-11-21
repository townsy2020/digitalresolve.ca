<#
.SYNOPSIS
    Automated Windows Native Service Installer & Configurator for AdGuard Home.
    Installs AdGuard Home as a native Windows service on the Intel NUC (192.168.2.35).
#>
[CmdletBinding()]
param(
    [string]$InstallDir = "C:\Program Files\AdGuardHome",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "   Digital Resolve - AdGuard Home Windows Installer    " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# 1. Administrator Check
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "Administrator rights required to install Windows Services."
    Write-Host "Relaunching elevated PowerShell..." -ForegroundColor Yellow
    $elevArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-InstallDir', "`"$InstallDir`"")
    if ($Force) { $elevArgs += '-Force' }
    Start-Process powershell.exe -Verb RunAs -ArgumentList $elevArgs
    exit
}

# 2. Prepare Directory
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Write-Host "[+] Created directory: $InstallDir" -ForegroundColor Green
}

# 3. Download Latest AdGuard Home Windows Release
$zipUrl = "https://github.com/AdguardTeam/AdGuardHome/releases/latest/download/AdGuardHome_windows_amd64.zip"
$zipPath = Join-Path $env:TEMP "AdGuardHome_windows_amd64.zip"
$extractTemp = Join-Path $env:TEMP "AdGuardHome_Extract"

Write-Host "[*] Downloading AdGuard Home (Windows x64)..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing

Write-Host "[*] Extracting package..." -ForegroundColor Cyan
if (Test-Path $extractTemp) { Remove-Item -Path $extractTemp -Recurse -Force }
Expand-Archive -Path $zipPath -DestinationPath $extractTemp -Force

$exeSource = Join-Path $extractTemp "AdGuardHome\AdGuardHome.exe"
$exeDest = Join-Path $InstallDir "AdGuardHome.exe"

# Stop existing service if present
$existingService = Get-Service -Name "AdGuardHome" -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "[*] Stopping existing AdGuardHome service..." -ForegroundColor Yellow
    Stop-Service -Name "AdGuardHome" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

Copy-Item -Path $exeSource -Destination $exeDest -Force
Write-Host "[+] Installed binary: $exeDest" -ForegroundColor Green

# 4. Copy Pre-configured YAML
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceYaml = Join-Path $scriptDir "conf\AdGuardHome.yaml"
$destYaml = Join-Path $InstallDir "AdGuardHome.yaml"

if (Test-Path $sourceYaml) {
    if (-not (Test-Path -LiteralPath $destYaml) -or $Force) {
        Copy-Item -Path $sourceYaml -Destination $destYaml -Force
        Write-Host "[+] Injected pre-built configuration: $destYaml" -ForegroundColor Green
    } else {
        Write-Host "[i] Existing AdGuardHome.yaml preserved (use -Force to overwrite): $destYaml" -ForegroundColor Gray
    }
} else {
    Write-Host "[!] Local conf\AdGuardHome.yaml not found; complete initial setup at http://192.168.2.35:3000 once service starts." -ForegroundColor Yellow
}

# 5. Register and Start Windows Service
Push-Location $InstallDir
try {
    Write-Host "[*] Registering AdGuard Home Windows Service..." -ForegroundColor Cyan
    & .\AdGuardHome.exe -s install -c "$destYaml" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "AdGuardHome.exe -s install returned exit code $LASTEXITCODE"
    }
    Write-Host "[*] Starting AdGuard Home Service..." -ForegroundColor Cyan
    & .\AdGuardHome.exe -s start 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "AdGuardHome.exe -s start returned exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}

# 6. Verify Service Status & Connectivity
Start-Sleep -Seconds 3
$svc = Get-Service -Name "AdGuardHome" -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq "Running") {
    Write-Host "`n=======================================================" -ForegroundColor Green
    Write-Host "   AdGuard Home successfully installed and RUNNING!   " -ForegroundColor Green
    Write-Host "=======================================================" -ForegroundColor Green
    Write-Host "  Web Dashboard : http://localhost:3000" -ForegroundColor White
    Write-Host "  DNS Resolver  : 127.0.0.1:53" -ForegroundColor White
    Write-Host "  Service Status: $($svc.Status)" -ForegroundColor White
} else {
    Write-Host "`nAdGuard Home installed. Check service status via: Get-Service AdGuardHome" -ForegroundColor Yellow
}

# Clean temp files
Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue
Remove-Item -Path $extractTemp -Recurse -Force -ErrorAction SilentlyContinue
