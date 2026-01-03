# Restore Remote Database from Baseline Backup
# Usage: .\restore_db_remote.ps1

$ErrorActionPreference = "Stop"

# Configuration
$BackupFile = "..\database\backups\baseline_stable_v1_20251219.sql"
$MysqlPath = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" # Adjust if needed

Write-Host "⚠️  ATENÇÃO: ESTE SCRIPT IRÁ SUBSTITUIR O BANCO DE DADOS REMOTO!" -ForegroundColor Red
Write-Host "    Backup a ser restaurado: $BackupFile" -ForegroundColor Yellow
Write-Host ""

# Check Backup File
if (-not (Test-Path $BackupFile)) {
    Write-Host "❌ Erro: Arquivo de backup não encontrado!" -ForegroundColor Red
    exit 1
}

# Check MySQL Path
if (-not (Test-Path $MysqlPath)) {
    # Try generic "mysql"
    if (Get-Command mysql -ErrorAction SilentlyContinue) {
        $MysqlPath = "mysql"
    } else {
        Write-Host "❌ Erro: executável 'mysql' não encontrado em $MysqlPath ou no PATH." -ForegroundColor Red
        exit 1
    }
}

# Prompt for Credentials
$RemoteHost = Read-Host "Digite o HOST do Banco de Dados (ex: cash-db no Easypanel ou IP externo?)"
$RemoteUser = Read-Host "Digite o USUÁRIO do Banco de Dados (ex: root)"
$RemotePass = Read-Host -AsSecureString "Digite a SENHA do Banco de Dados"
$RemoteDB   = Read-Host "Digite o NOME do Banco de Dados (ex: cash)"

$RemotePassPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($RemotePass))

Write-Host ""
Write-Host "⏳ Conectando e restaurando banco de dados em $RemoteHost..." -ForegroundColor Cyan

# Execute Import
try {
    # We use Get-Content piped to mysql to handle encoding better if needed, or simple redirection
    # Using cmd /c type | mysql is robust on Windows
    
    $ProcessArgs = @("-h", $RemoteHost, "-u", $RemoteUser, "-p$RemotePassPlain", $RemoteDB)
    
    # Run mysql process
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $MysqlPath
    $psi.Arguments = "-h $RemoteHost -u $RemoteUser -p$RemotePassPlain $RemoteDB"
    $psi.RedirectStandardInput = $true
    $psi.UseShellExecute = $false
    
    $p = [System.Diagnostics.Process]::Start($psi)
    
    # Stream file to stdin
    $reader = [System.IO.File]::OpenText($BackupFile)
    while ($line = $reader.ReadLine()) {
        $p.StandardInput.WriteLine($line)
    }
    $reader.Close()
    $p.StandardInput.Close()
    $p.WaitForExit()

    if ($p.ExitCode -eq 0) {
        Write-Host "✅ Banco de dados restaurado com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "❌ Falha na importação. Código de saída: $($p.ExitCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erro inesperado: $_" -ForegroundColor Red
}
