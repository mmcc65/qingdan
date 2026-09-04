$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$jdk = Get-ChildItem (Join-Path $root '.toolchains\jdk17') -Directory | Select-Object -First 1
if (-not $jdk) { throw 'JDK 17 was not found. Ask Codex to repair the mobile toolchain.' }

$env:JAVA_HOME = $jdk.FullName
$env:ANDROID_HOME = Join-Path $root '.toolchains\android-sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:ANDROID_USER_HOME = Join-Path $root '.toolchains\android-user-home'
$env:GRADLE_USER_HOME = Join-Path $root 'apps\mobile\android\.gradle-user-home'
New-Item -ItemType Directory -Force -Path $env:ANDROID_USER_HOME | Out-Null
$gradle = Join-Path $root '.toolchains\gradle\gradle-8.9\bin\gradle.bat'
$project = Join-Path $root 'apps\mobile\android'
$signingProperties = Join-Path $root 'apps\mobile\signing\private\signing.properties'
$buildTasks = @('assembleDebug')
if (Test-Path -LiteralPath $signingProperties) {
    $buildTasks += 'assembleRelease'
}

Write-Host 'Building Qingdan mobile packages...'
Push-Location $project
try {
    & $gradle --no-daemon @buildTasks
    if ($LASTEXITCODE -ne 0) { throw 'Mobile package build failed.' }
} finally {
    Pop-Location
}

$source = Join-Path $project 'app\build\outputs\apk\debug\app-debug.apk'
$outputDir = Join-Path $root 'apps\mobile\output'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$target = Join-Path $outputDir 'Qingdan-mobile-test.apk'
Copy-Item -LiteralPath $source -Destination $target -Force
$hash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLower()
$hash | Set-Content -Encoding ascii (Join-Path $outputDir 'Qingdan-mobile-test.sha256')

$releaseSource = Join-Path $project 'app\build\outputs\apk\release\app-release.apk'
$releaseTarget = Join-Path $outputDir 'Qingdan-mobile-release.apk'
if (Test-Path -LiteralPath $signingProperties) {
    if (-not (Test-Path -LiteralPath $releaseSource)) {
        throw 'Signed release package was not produced.'
    }
    Copy-Item -LiteralPath $releaseSource -Destination $releaseTarget -Force
    $releaseHash = (Get-FileHash -LiteralPath $releaseTarget -Algorithm SHA256).Hash.ToLower()
    $releaseHash | Set-Content -Encoding ascii (Join-Path $outputDir 'Qingdan-mobile-release.sha256')
    $gradleText = Get-Content -LiteralPath (Join-Path $project 'app\build.gradle') -Raw
    $versionCode = [regex]::Match($gradleText, "versionCode\s+(\d+)").Groups[1].Value
    $versionName = [regex]::Match($gradleText, "versionName\s+'([^']+)'").Groups[1].Value
    $releaseManifest = [ordered]@{
        versionCode = [int]$versionCode
        versionName = $versionName
        apkUrl = 'Qingdan-mobile-release.apk'
        sha256 = $releaseHash
        notes = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('5omL5py65qGM6Z2i57uE5Lu25paw5aKe5Lu75Yqh6YeN6KaB56iL5bqm6Imy54K577yb54K55Ye75Lu75Yqh5oiW6aG555uu5pu05aSa6I+c5Y2V5LmL5aSW55qE5Lu75oSP5L2N572u5Y2z5Y+v5YWz6Zet6I+c5Y2V44CC'))
    } | ConvertTo-Json
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Join-Path $outputDir 'latest.json'), $releaseManifest, $utf8NoBom)
} else {
    Remove-Item -LiteralPath $releaseTarget -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath (Join-Path $outputDir 'Qingdan-mobile-release.sha256') -Force -ErrorAction SilentlyContinue
    Write-Warning 'Formal signing files are missing; only the test package was built.'
}

Write-Host ''
Write-Host 'Build succeeded:'
Write-Host $target
if (Test-Path -LiteralPath $releaseTarget) { Write-Host $releaseTarget }
if (Test-Path -LiteralPath (Join-Path $outputDir 'latest.json')) { Write-Host (Join-Path $outputDir 'latest.json') }
