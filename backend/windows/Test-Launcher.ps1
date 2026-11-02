# Secret-free native Windows checks; never connects to Supabase.
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$tokens=$null;$parseErrors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'Start-ABGroup.ps1'),[ref]$tokens,[ref]$parseErrors)
if($parseErrors.Count){throw 'Launcher parse failure'}
# Load only function definitions; do not run setup, npm, prompts or server.
foreach($fn in $ast.FindAll({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst]},$false)) { Invoke-Expression $fn.Extent.Text }
$plain='SYNTHETIC_DPAPI_CANARY_1234'
$secret=ConvertTo-SecureString $plain -AsPlainText -Force
$encrypted=ConvertFrom-SecureString $secret
if($encrypted.Contains($plain)){throw 'Unencrypted vault value'}
$restored=ConvertTo-SecureString $encrypted
try{if((Open-Secret $restored) -cne $plain){throw 'DPAPI round trip failed'}}finally{$secret.Dispose();$restored.Dispose()}
$folder=Join-Path $env:RUNNER_TEMP ('ab-dpapi-'+[Guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory -Path $folder
Protect-VaultFolder $folder
$acl=Get-Acl -LiteralPath $folder
if(!$acl.AreAccessRulesProtected){throw 'Vault ACL inheritance not disabled'}
$allowed=@([Security.Principal.WindowsIdentity]::GetCurrent().User.Value,'S-1-5-18')
foreach($rule in $acl.Access){if($rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin $allowed){throw 'Unexpected vault access'}}
$file=Join-Path $folder 'vault.dpapi.json'
Save-Vault ([pscustomobject]@{value=$encrypted}) $file
if((Get-Content $file -Raw).Contains($plain)){throw 'Plaintext persisted'}
$env:MIGRATION_DATABASE_URL='ADMIN_SYNTHETIC_CANARY'
$node=(Get-Command node.exe -CommandType Application).Source
$child=New-Child $node '-e "if(process.env.MIGRATION_DATABASE_URL||process.env.DATA_ENCRYPTION_KEY)process.exit(3);console.log(''SAFE'')"' @{}
$out=Complete-Child $child
if($out.Trim() -ne 'SAFE'){throw 'Child isolation failure'}
$listener=New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback,0)
try{$listener.Start()}finally{$listener.Stop()}
Write-Host 'PASS: PowerShell parse, native DPAPI round trip, restricted ACL, encrypted persistence, isolated child and loopback listener'
