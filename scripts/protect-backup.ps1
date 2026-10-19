param(
    [Parameter(Mandatory=$true)][ValidateSet('protect','restore')][string]$Mode,
    [Parameter(Mandatory=$true)][string]$Source,
    [Parameter(Mandatory=$true)][string]$Destination
)
$ErrorActionPreference = 'Stop'
$backupRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\.wrangler')) + [IO.Path]::DirectorySeparatorChar
$sourcePath = [IO.Path]::GetFullPath($Source)
$destinationPath = [IO.Path]::GetFullPath($Destination)
foreach ($checkedPath in @($sourcePath, $destinationPath)) {
    if (-not $checkedPath.StartsWith($backupRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Backups must stay in the ignored workspace .wrangler directory.'
    }
}
if (Test-Path -LiteralPath $destinationPath) { throw 'Refusing to overwrite an existing file.' }
Add-Type -AssemblyName System.Security.Cryptography.ProtectedData
$bytes = [IO.File]::ReadAllBytes($sourcePath)
if ($Mode -eq 'protect') {
    $outputBytes = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    $verified = [Security.Cryptography.ProtectedData]::Unprotect($outputBytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    if (-not [Security.Cryptography.CryptographicOperations]::FixedTimeEquals($bytes, $verified)) { throw 'Backup roundtrip verification failed.' }
} else {
    $outputBytes = [Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
}
[IO.File]::WriteAllBytes($destinationPath, $outputBytes)
$digest = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($(if ($Mode -eq 'protect') {$bytes} else {$outputBytes})))
Write-Output "Backup $Mode verified. Plaintext SHA-256: $digest"
