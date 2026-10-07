# Windows-friendly pre-commit (same rules as pre-commit).
# Enable: git config core.hooksPath .githooks
# Git for Windows runs pre-commit; on pure PowerShell-only setups, copy logic here.

$ErrorActionPreference = 'Stop'
$staged = git diff --cached --name-only
if (-not $staged) { exit 0 }

foreach ($path in $staged) {
  if ($path -match '\.env\.example$' -or $path -match '\.env\..*\.example$') { continue }
  if ($path -eq '.env' -or $path -match '(^|[\\/])\.env\.[^\\/]+$') {
    Write-Error "pre-commit: blocked — do not commit: $path (use .env.example in git)"
  }
  if ($path -match 'node_modules[\\/]' -or $path -match '[\\/]dist[\\/]' -or $path -match '\.(pem|key)$' -or $path -eq 'credentials.json') {
    Write-Error "pre-commit: blocked — do not commit: $path"
  }
}
exit 0
