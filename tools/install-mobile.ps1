$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$adb = Join-Path $root '.toolchains\android-sdk\platform-tools\adb.exe'
$releaseApk = Join-Path $root 'apps\mobile\output\Qingdan-mobile-release.apk'
$testApk = Join-Path $root 'apps\mobile\output\Qingdan-mobile-test.apk'
$apk = if (Test-Path -LiteralPath $releaseApk) { $releaseApk } else { $testApk }
$env:ANDROID_USER_HOME = Join-Path $root '.toolchains\android-user-home'
New-Item -ItemType Directory -Force -Path $env:ANDROID_USER_HOME | Out-Null

if (-not (Test-Path -LiteralPath $adb)) { throw 'ADB was not found. Ask Codex to repair the mobile toolchain.' }
if (-not (Test-Path -LiteralPath $apk)) { throw 'APK was not found. Run the mobile build command first.' }

Write-Host 'Checking the phone connection...'
& $adb start-server | Out-Host
$devices = & $adb devices
$ready = @($devices | Where-Object { $_ -match "\tdevice$" })
if ($ready.Count -eq 0) {
    Write-Host ''
    Write-Host 'No authorized phone was found.'
    Write-Host 'Enable Developer options and USB debugging, connect a data cable, and allow the authorization prompt on the phone.'
    exit 1
}

Write-Host 'Phone found. Installing Qingdan...'
& $adb install -r $apk | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'Installation failed. Send the message above to Codex.' }
Write-Host ''
Write-Host 'Installation succeeded. Find Qingdan on the phone.'
