# Windows PowerShell 5.1 / Windows 11. No plaintext env file or persistent env changes.
param([switch]$Setup)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$server = $null
$script:Values = @{}
$script:Names = @('SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY','DATABASE_URL','DATA_ENCRYPTION_KEY')
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
function Open-Secret([Security.SecureString]$Value) {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
function Read-Hidden([string]$Name) {
    $value = Read-Host $Name -AsSecureString
    if ($value.Length -eq 0) { $value.Dispose(); throw 'Required protected input missing' }
    return $value
}
function Assert-PlainPath([string]$Path) {
    if ((Test-Path -LiteralPath $Path) -and ((Get-Item -LiteralPath $Path -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Reparse path refused' }
}
function New-Child([string]$Exe,[string]$Arguments,[hashtable]$Secrets,[string]$InputText = '') {
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = $Exe; $info.Arguments = $Arguments; $info.WorkingDirectory = $repo
    $info.UseShellExecute = $false; $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true; $info.RedirectStandardError = $true; $info.RedirectStandardInput = $true
    $info.EnvironmentVariables.Clear()
    foreach ($name in @('PATH','SystemRoot','WINDIR','TEMP','TMP','COMSPEC','PATHEXT','LOCALAPPDATA','APPDATA','USERPROFILE','ProgramFiles','ProgramFiles(x86)')) {
        $item = [Environment]::GetEnvironmentVariable($name,'Process')
        if ($item) { $info.EnvironmentVariables[$name] = $item }
    }
    foreach ($name in $Secrets.Keys) { $info.EnvironmentVariables[$name] = $Secrets[$name] }
    $process = New-Object Diagnostics.Process; $process.StartInfo = $info
    if (!$process.Start()) { throw 'Child startup failed' }
    $outputTask = $process.StandardOutput.ReadToEndAsync()
    $errorTask = $process.StandardError.ReadToEndAsync()
    if ($InputText) { $process.StandardInput.Write($InputText) }
    $process.StandardInput.Close()
    return @{ Process=$process; Output=$outputTask; ErrorOutput=$errorTask }
}
function Complete-Child($Child) {
    $Child.Process.WaitForExit()
    $output = $Child.Output.Result
    $null = $Child.ErrorOutput.Result # Never forward raw provider/process errors.
    $code = $Child.Process.ExitCode
    $Child.Process.Dispose()
    if ($code -ne 0) { throw 'Operation failed; details withheld to protect credentials' }
    return $output
}
function Protect-VaultFolder([string]$Folder) {
    $acl = New-Object Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true,$false)
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')))
    $system = New-Object Security.Principal.SecurityIdentifier('S-1-5-18')
    $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($system,'FullControl','ContainerInherit,ObjectInherit','None','Allow')))
    Set-Acl -LiteralPath $Folder -AclObject $acl
}
function Save-Vault($Vault,[string]$File) {
    Assert-PlainPath $File
    $Vault | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $File -Encoding UTF8
}
try {
    if ($env:OS -ne 'Windows_NT') { throw 'Windows required' }
    $node = (Get-Command node.exe -CommandType Application -ErrorAction Stop).Source
    $version = & $node --version
    if ([int]($version.TrimStart('v').Split('.')[0]) -lt 24) { throw 'Node.js 24 LTS or newer required' }
    # Refuse an occupied port rather than opening an unrelated local service.
    $listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback,3100)
    try { $listener.Start() } finally { $listener.Stop() }
    Write-Host 'Preparing pinned dependencies (no secrets supplied to npm)...'
    $install = New-Child $env:COMSPEC '/d /s /c "npm ci --ignore-scripts --no-audit --no-fund"' @{}
    $null = Complete-Child $install
    $local = [Environment]::GetFolderPath('LocalApplicationData')
    $folder = Join-Path $local 'ABGroupERP\supabase-test'
    if ([IO.Path]::GetFullPath($folder).StartsWith($repo.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Vault cannot be inside repository' }
    Assert-PlainPath (Join-Path $local 'ABGroupERP'); Assert-PlainPath $folder
    $null = New-Item -ItemType Directory -Path $folder -Force
    Protect-VaultFolder $folder
    $vaultFile = Join-Path $folder 'vault.dpapi.json'
    Assert-PlainPath $vaultFile
    if (Test-Path -LiteralPath $vaultFile) {
        $vault = Get-Content -LiteralPath $vaultFile -Raw | ConvertFrom-Json
        if ($vault.version -ne 1) { throw 'Unsupported vault format' }
    } else {
        $vault = [pscustomobject]@{version=1;username=('trial_'+[Guid]::NewGuid().ToString('N').Substring(0,12));ownerReady=$false;secrets=[pscustomobject]@{}}
        $Setup = $true
    }
    if ($Setup) {
        Write-Host 'Enter EXISTING test-project values. Inputs are hidden; do not generate a new encryption key.'
        foreach ($name in $script:Names) {
            $secret = Read-Hidden $name
            try { $vault.secrets | Add-Member -NotePropertyName $name -NotePropertyValue (ConvertFrom-SecureString $secret) -Force }
            finally { $secret.Dispose() }
        }
        # New encrypted inputs are saved only after the canonical key format is validated.
        $secure = ConvertTo-SecureString $vault.secrets.DATA_ENCRYPTION_KEY
        try { $key = Open-Secret $secure; $bytes = [Convert]::FromBase64String($key)
            if ($bytes.Length -ne 32 -or [Convert]::ToBase64String($bytes) -cne $key) { throw 'Invalid encryption key format' }
        } finally { $secure.Dispose(); $key=$null; $bytes=$null }
        Save-Vault $vault $vaultFile
    }
    foreach ($name in $script:Names) {
        $secure = ConvertTo-SecureString $vault.secrets.$name
        try { $script:Values[$name] = Open-Secret $secure } finally { $secure.Dispose() }
    }
    $script:Values['APP_ENV']='local'; $script:Values['PUBLIC_ORIGIN']='http://127.0.0.1:3100'
    $script:Values['PORT']='3100'; $script:Values['SUPABASE_BUCKET']='ab-private-test'
    $script:Values['NODE_EXTRA_CA_CERTS']=Join-Path $repo 'backend\certificates\supabase-prod-ca-2021.crt'
    if (!$vault.ownerReady) {
        Write-Host ('Create your NEW fictional trial login: '+$vault.username)
        $admin = Read-Hidden 'MIGRATION_DATABASE_URL (existing admin URL; not saved)'
        $password = Read-Hidden 'Choose login password (12-128 chars, upper/lower/digit/symbol, no spaces)'
        $confirm = Read-Hidden 'Confirm login password'
        try {
            $plain = Open-Secret $password; $confirmation = Open-Secret $confirm
            if ($plain -cne $confirmation) { throw 'Password confirmation mismatch' }
            $provision = @{} + $script:Values
            $provision['MIGRATION_DATABASE_URL']=Open-Secret $admin
            $provision['AB_SYNTHETIC_PROJECT']='yes'
            $inputJson = @{username=$vault.username;password=$plain} | ConvertTo-Json -Compress
            $child = New-Child $node '--import tsx backend/windows/bootstrap-trial.ts' $provision $inputJson
            $null = Complete-Child $child
            $vault.ownerReady=$true; Save-Vault $vault $vaultFile
        } finally {
            $admin.Dispose();$password.Dispose();$confirm.Dispose()
            $plain=$null;$confirmation=$null;$inputJson=$null
            if (Get-Variable provision -ErrorAction SilentlyContinue) { $provision.Clear() }
        }
    }
    # No administrator URL or bootstrap password enters the web process.
    $server = New-Child $node '--import tsx backend/windows/local-server.ts' $script:Values
    $ready = $false
    for ($attempt=0;$attempt -lt 40;$attempt++) {
        if ($server.Process.HasExited) { break }
        try {
            $health = Invoke-RestMethod 'http://127.0.0.1:3100/api/health' -TimeoutSec 2
            if ($health.mode -eq 'central' -and $health.database -eq 'reachable') { $ready=$true;break }
        } catch { }
        Start-Sleep -Milliseconds 750
    }
    if (!$ready) { throw 'Backend readiness failed; no browser opened' }
    Write-Host ('Login username: '+$vault.username)
    Write-Host 'Open: http://127.0.0.1:3100 (use the login password you chose)'
    Start-Process 'http://127.0.0.1:3100'
    $null = Read-Host 'Keep this window open. Press Enter here to stop the local backend'
} catch {
    Write-Host 'STOP: Local setup/start failed. No secret values or raw errors are printed.'
    Write-Host 'Check Node.js 24+, internet access, port 3100 and original test-project inputs. Retry with -Setup to correct the encrypted vault.'
    exit 1
} finally {
    if ($server -and !$server.Process.HasExited) { $server.Process.Kill();$server.Process.WaitForExit() }
    if ($server) { $server.Process.Dispose() }
    $script:Values.Clear()
}
