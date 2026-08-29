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
        notes = '修复部分桌面启动器未采用 2×2 组件尺寸的问题，并保留圆角卡片样式。'
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
