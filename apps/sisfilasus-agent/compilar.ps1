# Script de Compilação do SisFilaSUS Agente e-SUS PEC (v1.3.0)
$ErrorActionPreference = "Stop"

$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $baseDir

$cscPath = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $cscPath)) {
    $cscPath = "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
}

if (-not (Test-Path $cscPath)) {
    Write-Error "Compilador csc.exe não encontrado no .NET Framework."
}

Write-Host "Compilando SisFilaSusAgent.exe com $cscPath..." -ForegroundColor Cyan

# Criar pasta dist se não existir
if (-not (Test-Path "dist")) {
    New-Item -ItemType Directory -Path "dist" | Out-Null
}

$outputExe = Join-Path $baseDir "SisFilaSusAgent.exe"
$distExe = Join-Path $baseDir "dist\SisFilaSusAgent.exe"
$sourceFile = Join-Path $baseDir "Program.cs"

# Compilar
& $cscPath /target:winexe /optimize+ /platform:anycpu /out:"$outputExe" "$sourceFile" /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Security.dll /r:Npgsql.dll

if ($LASTEXITCODE -ne 0) {
    Write-Error "Falha na compilação do C#."
}

# Copiar para dist
Copy-Item "$outputExe" "$distExe" -Force
if (Test-Path (Join-Path $baseDir "Npgsql.dll")) {
    Copy-Item (Join-Path $baseDir "Npgsql.dll") (Join-Path $baseDir "dist\Npgsql.dll") -Force
}

# Calcular SHA-256
$hash = (Get-FileHash -Path "$distExe" -Algorithm SHA256).Hash.ToLower()
Write-Host "Compilação concluída com sucesso!" -ForegroundColor Green
Write-Host "Executável: $outputExe"
Write-Host "SHA256: $hash" -ForegroundColor Yellow

# Atualizar o ZIP de download público
$zipPath = Join-Path $baseDir "..\..\public\downloads\SisFilaSusAgent.zip"
if (Test-Path (Split-Path -Parent $zipPath)) {
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $tempZipDir = Join-Path ([System.IO.Path]::GetTempPath()) ("sisfilasus_agent_pkg_" + [System.Guid]::NewGuid().ToString().Substring(0,8))
    New-Item -ItemType Directory -Path $tempZipDir | Out-Null
    Copy-Item "$outputExe" "$tempZipDir\SisFilaSusAgent.exe"
    if (Test-Path (Join-Path $baseDir "Npgsql.dll")) {
        Copy-Item (Join-Path $baseDir "Npgsql.dll") "$tempZipDir\Npgsql.dll"
    }
    Copy-Item (Join-Path $baseDir "README-INSTALACAO.txt") "$tempZipDir\README-INSTALACAO.txt"
    [System.IO.Compression.ZipFile]::CreateFromDirectory($tempZipDir, $zipPath)
    Remove-Item $tempZipDir -Recurse -Force
    Write-Host "Pacote ZIP gerado em: $zipPath" -ForegroundColor Green
}
