$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$project = Join-Path $root 'apps\desktop\Qingdan.Desktop\Qingdan.Desktop.csproj'
$output = Join-Path $root 'apps\desktop\output'
$staging = Join-Path $output 'package'
$archive = Join-Path $output 'Qingdan-desktop-release.zip'

New-Item -ItemType Directory -Force -Path $output | Out-Null
if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
New-Item -ItemType Directory -Force -Path $staging | Out-Null

Write-Host 'Building Qingdan desktop update package...'
& dotnet publish $project -c Release --no-restore -r win-x64 --self-contained true -o $staging
if ($LASTEXITCODE -ne 0) { throw 'Desktop update build failed.' }

$launcherName = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('5ZCv5Yqo5riF5Y2VLnZicw=='))
$shortcutName = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('5Yib5bu65qGM6Z2i5b+r5o235pa55byPLnZicw=='))
Copy-Item -LiteralPath (Join-Path $root $launcherName) -Destination $staging -Force
Copy-Item -LiteralPath (Join-Path $root $shortcutName) -Destination $staging -Force

if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $archive -CompressionLevel Optimal
$hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLower()
$projectText = Get-Content -LiteralPath $project -Raw
$version = [regex]::Match($projectText, '<Version>([^<]+)</Version>').Groups[1].Value
$notes = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('5L+u5aSN56qE5bGP5biD5bGA5LiL5re75Yqg6YeN5aSN5Lu75Yqh5ZKM5paw5bu66aG555uu5YWl5Y+j77yb5YyF5ZCr56e75Yqo56uvIDAuNS4zIOWQjOatpeWPkeW4g+OAgg=='))
$manifest = [ordered]@{
    version = $version
    packageUrl = 'Qingdan-desktop-release.zip'
    sha256 = $hash
    notes = $notes
} | ConvertTo-Json
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $output 'desktop-latest.json'), $manifest, $utf8NoBom)

Remove-Item -LiteralPath $staging -Recurse -Force
Write-Host ''
Write-Host 'Desktop update package built:'
Write-Host $archive
Write-Host (Join-Path $output 'desktop-latest.json')
