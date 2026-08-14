$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

& (Join-Path $PSScriptRoot 'build-mobile.ps1')
& (Join-Path $PSScriptRoot 'build-desktop-update.ps1')

$projectUrl = $env:QINGDAN_SUPABASE_URL
if ([string]::IsNullOrWhiteSpace($projectUrl)) {
    $projectUrl = Read-Host 'Supabase Project URL (https://xxxx.supabase.co)'
}
$projectUrl = $projectUrl.TrimEnd('/')
if ($projectUrl -notmatch '^https://[a-z0-9-]+\.supabase\.co$') {
    throw 'Supabase Project URL format is invalid.'
}

$serviceKey = $env:QINGDAN_SUPABASE_SERVICE_ROLE_KEY
if ([string]::IsNullOrWhiteSpace($serviceKey)) {
    $secureKey = Read-Host 'Supabase service_role key (input is hidden)' -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    try { $serviceKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
if ([string]::IsNullOrWhiteSpace($serviceKey)) { throw 'The service_role key is required to publish an update.' }

$output = Join-Path $root 'mobile\output'
$apk = Join-Path $output 'Qingdan-mobile-release.apk'
$manifest = Join-Path $output 'latest.json'
$desktopOutput = Join-Path $root 'desktop\output'
$desktopPackage = Join-Path $desktopOutput 'Qingdan-desktop-release.zip'
$desktopManifest = Join-Path $desktopOutput 'desktop-latest.json'
$headers = @{ apikey = $serviceKey; Authorization = "Bearer $serviceKey"; 'x-upsert' = 'true' }
$baseUrl = "$projectUrl/storage/v1/object/qingdan-releases"

Write-Host 'Uploading signed APK...'
Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$baseUrl/Qingdan-mobile-release.apk" `
    -Headers $headers -ContentType 'application/vnd.android.package-archive' -InFile $apk | Out-Null

Write-Host 'Uploading desktop update package...'
Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$baseUrl/Qingdan-desktop-release.zip" `
    -Headers $headers -ContentType 'application/zip' -InFile $desktopPackage | Out-Null

# Publish the manifest last so phones never see metadata for an APK that is not uploaded yet.
Write-Host 'Publishing version manifest...'
Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$baseUrl/latest.json" `
    -Headers $headers -ContentType 'application/json' -InFile $manifest | Out-Null

Write-Host 'Publishing desktop version manifest...'
Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$baseUrl/desktop-latest.json" `
    -Headers $headers -ContentType 'application/json' -InFile $desktopManifest | Out-Null

Write-Host ''
Write-Host 'Desktop and mobile updates published successfully.'
Write-Host "$projectUrl/storage/v1/object/public/qingdan-releases/latest.json"
Write-Host "$projectUrl/storage/v1/object/public/qingdan-releases/desktop-latest.json"
