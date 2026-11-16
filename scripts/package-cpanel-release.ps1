param([Parameter(Mandatory=$true)][string]$ReleaseName)
$ErrorActionPreference = 'Stop'
if ($ReleaseName -notmatch '^[a-z0-9-]+$') { throw 'Use a lowercase release name with hyphens.' }
$releaseRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$releaseDist = (Resolve-Path -LiteralPath (Join-Path $releaseRoot 'dist')).Path
$releaseOutput = Join-Path $releaseRoot ('output/releases/' + $ReleaseName)
if (Test-Path -LiteralPath $releaseOutput) { throw 'Release exists; choose a new name.' }
$releaseScan = Get-Content -LiteralPath (Join-Path $releaseRoot 'output/security/secret-scan.json') -Raw | ConvertFrom-Json
if (@($releaseScan.findings).Count -ne 0 -or ([DateTimeOffset]::UtcNow - [DateTimeOffset]$releaseScan.scannedAt).TotalMinutes -gt 60) { throw 'A fresh successful secret scan is required.' }
$releaseFiles = @(Get-ChildItem -LiteralPath $releaseDist -Recurse -Force -File)
$releaseRequired = @('index.html','.htaccess','robots.txt','sitemap.xml','legacy-not-found.html','consent-default.js','llms.txt','size-charts/mens-jackets.webp','size-charts/womens-jackets.webp','prerender-home/en.html','prerender-home/it.html','prerender-home/de.html','prerender-home/fr.html','prerender-home/es.html')
$releaseManifest = @()
foreach ($releaseFile in $releaseFiles) {
  if ($releaseFile.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse point rejected.' }
  $releaseRelative = $releaseFile.FullName.Substring($releaseDist.Length).TrimStart([char[]]'\/').Replace('\','/')
  $releasePublicHtml = $releaseRelative -match '^prerender-pages/(?:en|it|de|fr|es)/(?:[a-z0-9-]+/)+index\.html$'
  if (-not $releasePublicHtml -and $releaseRelative -notmatch '^(?:\.htaccess|index\.html|legacy-not-found\.html|consent-default\.js|favicon\.svg|robots\.txt|sitemap\.xml|llms\.txt|size-charts/(?:mens|womens)-jackets\.webp|prerender-home/(?:en|it|de|fr|es)\.html|(?:assets|blog_images)/[^\s]+\.(?:js|mjs|css|svg|png|jpe?g|webp|avif|gif|woff2?|ttf|ico))$') { throw ('Unexpected file: ' + $releaseRelative) }
  $releaseManifest += [pscustomobject]@{path=$releaseRelative;bytes=$releaseFile.Length;sha256=(Get-FileHash -LiteralPath $releaseFile.FullName -Algorithm SHA256).Hash}
}
foreach ($releaseRequiredFile in $releaseRequired) {
  if ($releaseManifest.path -notcontains $releaseRequiredFile) { throw ('Missing: ' + $releaseRequiredFile) }
}
New-Item -ItemType Directory -Path $releaseOutput | Out-Null
$releaseArchive = Join-Path $releaseOutput 'tuxar-cpanel.zip'
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($releaseDist,$releaseArchive,[IO.Compression.CompressionLevel]::Optimal,$false)
$releaseZip = [IO.Compression.ZipFile]::OpenRead($releaseArchive)
try {
  if ($releaseZip.Entries.Count -ne $releaseManifest.Count) { throw 'Entry count mismatch.' }
  foreach ($releaseEntry in $releaseZip.Entries) {
    $releaseExpected = @($releaseManifest | Where-Object { $_.path -ceq $releaseEntry.FullName.Replace('\','/') })
    if ($releaseExpected.Count -ne 1) { throw 'Unexpected or duplicate ZIP entry.' }
    $releaseStream = $releaseEntry.Open()
    $releaseHasher = [Security.Cryptography.SHA256]::Create()
    try { $releaseHash = [BitConverter]::ToString($releaseHasher.ComputeHash($releaseStream)).Replace('-','') } finally { $releaseStream.Dispose(); $releaseHasher.Dispose() }
    if ($releaseHash -ne $releaseExpected[0].sha256) { throw 'ZIP content hash mismatch.' }
  }
} finally { $releaseZip.Dispose() }
$releaseUnpacked = Join-Path $releaseOutput 'website-files'
New-Item -ItemType Directory -Path $releaseUnpacked | Out-Null
foreach ($releaseFile in $releaseFiles) {
  $releaseRelative = $releaseFile.FullName.Substring($releaseDist.Length).TrimStart([char[]]'\/')
  $releaseDestination = Join-Path $releaseUnpacked $releaseRelative
  New-Item -ItemType Directory -Path (Split-Path -Parent $releaseDestination) -Force | Out-Null
  Copy-Item -LiteralPath $releaseFile.FullName -Destination $releaseDestination
  if ((Get-FileHash -LiteralPath $releaseDestination -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $releaseFile.FullName -Algorithm SHA256).Hash) { throw 'Unpacked copy hash mismatch.' }
}
$releaseResult = [ordered]@{status='Verified frontend package only; production backend deployment unverified';archive=$releaseArchive;unpacked=$releaseUnpacked;sha256=(Get-FileHash -LiteralPath $releaseArchive -Algorithm SHA256).Hash;files=$releaseManifest}
[IO.File]::WriteAllText((Join-Path $releaseOutput 'manifest.json'),($releaseResult | ConvertTo-Json -Depth 5))
Write-Output ([pscustomobject]$releaseResult | Select-Object status,archive,unpacked,sha256 | ConvertTo-Json)
