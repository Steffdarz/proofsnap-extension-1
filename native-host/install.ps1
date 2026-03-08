<# 
.SYNOPSIS
    Install ProofSnap Native Messaging Host for Windows

.DESCRIPTION
    This script:
    1. Creates the native host manifest with correct paths
    2. Registers it with Chrome via Windows Registry
    3. Allows external scripts to trigger ProofSnap captures via HTTP

.PARAMETER ExtensionId
    The Chrome extension ID for ProofSnap. Find it in chrome://extensions/

.EXAMPLE
    .\install.ps1 -ExtensionId "abcdefghijklmnopabcdefghijklmnop"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$ExtensionId
)

$ErrorActionPreference = "Stop"

# Configuration
$HostName = "com.numbersprotocol.proofsnap"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$HostScript = Join-Path $ScriptDir "proofsnap_host.py"
$ManifestTemplate = Join-Path $ScriptDir "$HostName.json"
$ManifestTarget = Join-Path $env:LOCALAPPDATA "ProofSnap\$HostName.json"

Write-Host "ProofSnap Native Host Installer" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Verify Python is installed
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✓ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Python not found. Please install Python 3.x first." -ForegroundColor Red
    exit 1
}

# Verify extension ID format
if ($ExtensionId -notmatch '^[a-z]{32}$') {
    Write-Host "✗ Invalid extension ID format. Should be 32 lowercase letters." -ForegroundColor Red
    Write-Host "  Find it at chrome://extensions/ (enable Developer mode)" -ForegroundColor Yellow
    exit 1
}

Write-Host "Extension ID: $ExtensionId" -ForegroundColor Gray

# Create target directory
$TargetDir = Split-Path -Parent $ManifestTarget
if (!(Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    Write-Host "✓ Created directory: $TargetDir" -ForegroundColor Green
}

# Create the manifest with actual paths
$Manifest = @{
    name = $HostName
    description = "ProofSnap Native Messaging Host - HTTP trigger for screenshot capture"
    path = $HostScript
    type = "stdio"
    allowed_origins = @("chrome-extension://$ExtensionId/")
}

$Manifest | ConvertTo-Json | Set-Content $ManifestTarget -Encoding UTF8
Write-Host "✓ Created manifest: $ManifestTarget" -ForegroundColor Green

# Register with Chrome via Registry
$RegistryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"
if (!(Test-Path $RegistryPath)) {
    New-Item -Path $RegistryPath -Force | Out-Null
}
Set-ItemProperty -Path $RegistryPath -Name "(Default)" -Value $ManifestTarget
Write-Host "✓ Registered with Chrome" -ForegroundColor Green

# Also register for Edge (Chromium) if present
$EdgeRegistryPath = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$HostName"
if (Test-Path "HKLM:\Software\Microsoft\Edge") {
    if (!(Test-Path $EdgeRegistryPath)) {
        New-Item -Path $EdgeRegistryPath -Force | Out-Null
    }
    Set-ItemProperty -Path $EdgeRegistryPath -Name "(Default)" -Value $ManifestTarget
    Write-Host "✓ Registered with Edge" -ForegroundColor Green
}

Write-Host ""
Write-Host "Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Reload the ProofSnap extension in Chrome"
Write-Host "2. Test with: curl -X POST http://localhost:19999/capture"
Write-Host ""
Write-Host "The HTTP server will start automatically when the extension connects." -ForegroundColor Gray
