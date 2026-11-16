param(
  [string]$BackupFile = 'F:\Tuxar-private-backups\2026-10-22-114916\tuxar-production.dump',
  [string]$PgBin = 'F:\postgresql-17.11-5-windows-x64-binaries\pgsql\bin',
  [switch]$PrepareOnly
)
$ErrorActionPreference = 'Stop'
$testRef = 'kiwpvindkuponqwgmneq'
$testHost = 'aws-0-eu-west-1.pooler.supabase.com'
$testUser = 'postgres.kiwpvindkuponqwgmneq'
# Deliberately no host, user or project override: this runner cannot target production.
if ($testRef -eq 'ncgxljatjajgcvnlrncm' -or $testUser -ne ('postgres.' + $testRef)) { throw 'Refused target.' }
$backupPath = (Resolve-Path -LiteralPath $BackupFile).Path
$toolPath = (Resolve-Path -LiteralPath $PgBin).Path
$psqlPath = Join-Path $toolPath 'psql.exe'
if (-not (Test-Path -LiteralPath $psqlPath)) { throw 'PostgreSQL 17 psql is missing.' }
$nodePath = (Get-Command node -ErrorAction Stop).Source
$workPath = Join-Path ([IO.Path]::GetDirectoryName($backupPath)) ('restore-test-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
$prepareScript = Join-Path $PSScriptRoot 'prepare-restore-test.mjs'

if (-not $PrepareOnly) {
  Write-Output ('Target: Tuxar Restore Test / ' + $testRef)
  Write-Output ('Host: ' + $testHost + ' / User: ' + $testUser)
  Write-Output 'This imports real application data and basic Auth records into your isolated test project.'
  Write-Output 'Keep Data API, Email provider, signups and external integrations disabled. Never publish the generated SQL.'
  $confirmation = Read-Host ('Type ' + $testRef + ' to confirm TEST restore')
  if ($confirmation -cne $testRef) { throw 'Cancelled. Nothing restored.' }
}

& $nodePath $prepareScript --backup $backupPath --pg-bin $toolPath --output $workPath
if ($LASTEXITCODE -ne 0) { throw 'Offline preparation failed. Nothing restored; do not bypass the checks.' }
$manifest = Get-Content -LiteralPath (Join-Path $workPath 'manifest.json') -Raw | ConvertFrom-Json
if ($manifest.targetRef -cne $testRef -or $manifest.targetHost -cne $testHost) { throw 'Manifest target mismatch.' }
if ((Get-FileHash -LiteralPath $manifest.sqlFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $manifest.sqlSHA256) { throw 'Prepared SQL hash mismatch.' }
if ((Get-FileHash -LiteralPath $backupPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $manifest.backupSHA256) { throw 'Backup changed during preparation.' }
if ($PrepareOnly) { Write-Output 'Prepared privately only. No database connection or restore performed.'; return }

$connection = "host=$testHost port=5432 dbname=postgres user=$testUser sslmode=require connect_timeout=15 application_name=tuxar-isolated-restore-test"
Write-Output 'Enter only the TEST project database password at the next prompt.'
& $psqlPath $connection -X -W -v ON_ERROR_STOP=1 --file $manifest.sqlFile
if ($LASTEXITCODE -ne 0) { throw 'Restore failed or disconnected. Stop. The transaction should roll back; verify target state before retrying. Do not change production.' }
Write-Output 'Test restore completed. No production database was targeted. Keep this test project isolated.'
