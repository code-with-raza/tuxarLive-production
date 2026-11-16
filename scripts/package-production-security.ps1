$ErrorActionPreference = 'Stop'
$reviewRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$reviewOutput = Join-Path $reviewRoot 'output\production-security-2026-10-17'
$reviewDist = (Resolve-Path -LiteralPath (Join-Path $reviewRoot 'dist')).Path
$reviewStage = Join-Path $reviewOutput 'cpanel-staging'
$reviewBackend = Join-Path $reviewOutput 'backend-staging'
$reviewArchive = Join-Path $reviewOutput 'tuxar-cpanel-security-2026-10-17.zip'
foreach ($reviewTarget in @($reviewStage,$reviewBackend,$reviewArchive)) {
  if (Test-Path -LiteralPath $reviewTarget) { throw 'A release target already exists; nothing will be overwritten. Use a new release directory.' }
}
$reviewScan = Get-Content -LiteralPath (Join-Path $reviewRoot 'output\security\secret-scan.json') -Raw | ConvertFrom-Json
if (@($reviewScan.findings).Count -ne 0) { throw 'Secret scan must pass before packaging.' }
$reviewScanTime = [DateTimeOffset]$reviewScan.scannedAt
if (([DateTimeOffset]::UtcNow - $reviewScanTime) -gt [TimeSpan]::FromHours(1)) { throw 'Run a fresh secret scan before packaging.' }
$reviewBaseline = Get-Content -LiteralPath (Join-Path $reviewOutput 'repository-baseline.json') -Raw | ConvertFrom-Json
foreach ($reviewProtected in $reviewBaseline.files | Where-Object { $_.path -match '^(src/data/|src/i18n/|supabase/seed_catalog\.sql$|supabase/migrations/)' }) {
  $reviewCurrent = Get-FileHash -LiteralPath (Join-Path $reviewRoot $reviewProtected.path) -Algorithm SHA256
  if ($reviewCurrent.Hash -ne $reviewProtected.sha256) { throw ('Historical migration/catalogue changed since the baseline: ' + $reviewProtected.path) }
}
New-Item -ItemType Directory -Path $reviewStage,$reviewBackend -Force | Out-Null
$reviewFiles = @(Get-ChildItem -LiteralPath $reviewDist -Recurse -Force -File)
$reviewManifest = @()
foreach ($reviewFile in $reviewFiles) {
  if ($reviewFile.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse points are not permitted in the deployment package.' }
  $reviewRelative = [IO.Path]::GetRelativePath($reviewDist,$reviewFile.FullName).Replace('\','/')
  if ($reviewRelative -notmatch '^(?:\.htaccess|index\.html|consent-default\.js|favicon\.svg|robots\.txt|sitemap\.xml|(?:assets|blog_images)/[^\s]+\.(?:js|mjs|css|svg|png|jpe?g|webp|avif|gif|woff2?|ttf|ico))$') { throw ('Unexpected build entry: ' + $reviewRelative) }
  if ($reviewRelative -match '(^|/)(?:\.env|\.git|node_modules)(?:/|\.|$)|\.map$|\.key$|\.pem$') { throw 'Sensitive/source-map entry found.' }
  $reviewCopy = Join-Path $reviewStage $reviewRelative
  New-Item -ItemType Directory -Path (Split-Path -Parent $reviewCopy) -Force | Out-Null
  Copy-Item -LiteralPath $reviewFile.FullName -Destination $reviewCopy
  $reviewManifest += [pscustomobject]@{path=$reviewRelative;bytes=$reviewFile.Length;sha256=(Get-FileHash -LiteralPath $reviewFile.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
}
foreach ($reviewRequired in @('index.html','.htaccess','consent-default.js','robots.txt','sitemap.xml')) {
  if ($reviewManifest.path -notcontains $reviewRequired) { throw ('Missing required entry: ' + $reviewRequired) }
}
# Freeze only reviewed backend files, separate from the web ZIP. No .env, cache or seed.
$reviewFunctionFiles = @(Get-ChildItem -LiteralPath (Join-Path $reviewRoot 'supabase\functions') -Recurse -File -Filter '*.ts' | Where-Object { $_.Name -ne 'deno.d.ts' })
$reviewBackendFiles = @('supabase/config.toml','supabase/migrations/202610170001_security_hardening.sql','supabase/migrations/202610170002_security_release_safety.sql') + @($reviewFunctionFiles | ForEach-Object { [IO.Path]::GetRelativePath($reviewRoot,$_.FullName).Replace('\','/') })
$reviewBackendManifest = @()
foreach ($reviewRelative in $reviewBackendFiles) {
  $reviewCopy = Join-Path $reviewBackend $reviewRelative
  New-Item -ItemType Directory -Path (Split-Path -Parent $reviewCopy) -Force | Out-Null
  $reviewOriginal = Join-Path $reviewRoot $reviewRelative
  Copy-Item -LiteralPath $reviewOriginal -Destination $reviewCopy
  $reviewBackendManifest += [pscustomobject]@{path=$reviewRelative;sha256=(Get-FileHash -LiteralPath $reviewOriginal -Algorithm SHA256).Hash.ToLowerInvariant()}
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($reviewStage,$reviewArchive,[IO.Compression.CompressionLevel]::Optimal,$false)
$reviewZip = [IO.Compression.ZipFile]::OpenRead($reviewArchive)
try {
  if ($reviewZip.Entries.Count -ne $reviewManifest.Count) { throw 'Archive entry count differs from staging.' }
  foreach ($reviewEntry in $reviewZip.Entries) {
    $reviewExpected = $reviewManifest | Where-Object { $_.path -ceq $reviewEntry.FullName.Replace('\','/') }
    if (@($reviewExpected).Count -ne 1) { throw 'Unexpected/duplicate archive entry.' }
    $reviewStream = $reviewEntry.Open()
    try { $reviewEntryHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($reviewStream)).ToLowerInvariant() } finally { $reviewStream.Dispose() }
    if ($reviewExpected.sha256 -ne $reviewEntryHash) { throw 'Archive content hash differs from the audited build.' }
  }
} finally { $reviewZip.Dispose() }
$reviewResult = [ordered]@{createdAt=[DateTimeOffset]::UtcNow.ToString('o');format='Static Vite SPA; ZIP entries are document-root contents, not a dist wrapper';status='PACKAGE VERIFIED LOCALLY; PRODUCTION DEPLOYMENT NOT AUTHORIZED';archive=[IO.Path]::GetFileName($reviewArchive);sha256=(Get-FileHash -LiteralPath $reviewArchive -Algorithm SHA256).Hash.ToLowerInvariant();entries=$reviewManifest.Count;files=$reviewManifest;backendFiles=$reviewBackendManifest;historicalMigrationsAndCatalogueUnchanged=$true;secretScanAt=$reviewScan.scannedAt;secretFindings=0}
$reviewJson = $reviewResult | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText((Join-Path $reviewOutput 'PACKAGE_MANIFEST.json'),$reviewJson)
Write-Output ([pscustomobject]@{Archive=$reviewArchive;Entries=$reviewManifest.Count;Sha256=$reviewResult.sha256;BackendFiles=$reviewBackendManifest.Count;Status=$reviewResult.status} | ConvertTo-Json)
