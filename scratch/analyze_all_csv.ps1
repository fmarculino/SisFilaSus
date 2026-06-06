Write-Host "============================================="
Write-Host "ANALISE COMPARATIVA DOS RELATORIOS SISREG"
Write-Host "============================================="
Write-Host ""

# --- Arquivo 1: INTERNACAO (Solicitações Eletivas) ---
Write-Host "====== ARQUIVO 1: INTERNACAO (SOL_E) ======"
$csv1 = Import-Csv 'C:\Users\Cliente\Projetos\SisFilaSus\scratch\SISREG_INTERNACAO_SOL_E_150420_2026-06-05_16-14-00.csv' -Delimiter ';'
$h1 = ($csv1 | Get-Member -MemberType NoteProperty).Name
Write-Host "Total registros: $($csv1.Count)"
Write-Host "Total colunas: $($h1.Count)"
Write-Host "Colunas:"
$h1 | ForEach-Object { Write-Host "  - $_" }

Write-Host ""

# --- Arquivo 2: AMB AGENDADOS FILA ---
Write-Host "====== ARQUIVO 2: AMB AGENDADOS FILA ======"
$csv2Content = Get-Content 'C:\Users\Cliente\Projetos\SisFilaSus\scratch\SISREG_AMB_AGENDADOS_FILA_150420_2026-06-05_17-10-40.csv' -Encoding UTF8
$csv2Header = ($csv2Content[0] -split ';')
Write-Host "Total linhas (incl header): $($csv2Content.Count)"
Write-Host "Total colunas: $($csv2Header.Count)"
Write-Host "** ARQUIVO VAZIO (so tem header) **"
Write-Host "Colunas:"
$csv2Header | ForEach-Object { Write-Host "  - $($_.Trim())" }

Write-Host ""

# --- Arquivo 3: AMB AGENDADOS REG ---
Write-Host "====== ARQUIVO 3: AMB AGENDADOS REG ======"
$raw3 = Get-Content 'C:\Users\Cliente\Projetos\SisFilaSus\scratch\SISREG_AMB_AGENDADOS_REG_150420_2026-06-05_17-10-25.csv'
$headerLine = $raw3[0]
$headerParts = $headerLine -split ';'
$seen = @{}
$newHeaderParts = for ($i = 0; $i -lt $headerParts.Count; $i++) {
    $col = $headerParts[$i].Trim()
    if ($seen.ContainsKey($col)) {
        $seen[$col]++
        "$col`_$($seen[$col])"
    } else {
        $seen[$col] = 0
        $col
    }
}
$newHeaderLine = $newHeaderParts -join ';'
$sanitizedContent = @($newHeaderLine) + $raw3[1..($raw3.Count - 1)]
$csv3 = ConvertFrom-Csv ($sanitizedContent -join "`r`n") -Delimiter ';'
$h3 = $newHeaderParts
Write-Host "Total registros: $($csv3.Count)"
Write-Host "Total colunas: $($h3.Count)"
Write-Host "Colunas:"
$h3 | ForEach-Object { Write-Host "  - $_" }

Write-Host ""

# --- Comparação de colunas ---
Write-Host "============================================="
Write-Host "COMPARACAO: INTERNACAO vs AMB_REG"
Write-Host "============================================="

$commonHeaders = $csv2Header | ForEach-Object { $_.Trim() }

Write-Host ""
Write-Host "Colunas EXCLUSIVAS do AMB (nao existem no INTERNACAO):"
$commonHeaders | Where-Object { $_ -notin $h1 } | ForEach-Object { Write-Host "  + $_" }

Write-Host ""
Write-Host "Colunas EXCLUSIVAS do INTERNACAO (nao existem no AMB):"
$h1 | Where-Object { $_ -notin $commonHeaders } | ForEach-Object { Write-Host "  + $_" }

Write-Host ""
Write-Host "============================================="
Write-Host "ANALISE DO AMB_REG: Estatisticas"
Write-Host "============================================="

Write-Host "Modalidades de fila:"
$csv3 | Group-Object 'COD. MODALIDADE FILA' | ForEach-Object { Write-Host "  Modalidade $($_.Name): $($_.Count)" }

Write-Host ""
Write-Host "Tipos de fila:"
$csv3 | Group-Object 'COD. TIPO DE FILA' | ForEach-Object { Write-Host "  Tipo $($_.Name): $($_.Count)" }

Write-Host ""
Write-Host "Classificacoes de risco:"
$csv3 | Group-Object 'COD. CLASSIFICACAO DE RISCO' | ForEach-Object { Write-Host "  Risco $($_.Name): $($_.Count)" }

Write-Host ""
Write-Host "Status solicitacao:"
$csv3 | Group-Object 'STATUS SOLICITACAO' | ForEach-Object { Write-Host "  $($_.Name): $($_.Count)" }

Write-Host ""
Write-Host "Execucao confirmada:"
$csv3 | Group-Object 'EXECUCAO CONFIRMADA' | ForEach-Object { Write-Host "  $($_.Name): $($_.Count)" }

Write-Host ""
Write-Host "Top 20 procedimentos AMB_REG:"
$csv3 | Group-Object 'DESC. SIGTAP' | Sort-Object Count -Descending | Select-Object -First 20 | ForEach-Object { Write-Host "  $($_.Count) - $($_.Name.Trim())" }

Write-Host ""
Write-Host "Unidades EXECUTANTES distintas (top 15):"
$csv3 | Group-Object 'NOME UNIDADE EXECUTANTE' | Sort-Object Count -Descending | Select-Object -First 15 | ForEach-Object { Write-Host "  $($_.Count) - $($_.Name)" }

Write-Host ""
Write-Host "--- ARQUIVO TXT ---"
Write-Host "Conteudo do TXT:"
Get-Content 'C:\Users\Cliente\Projetos\SisFilaSus\scratch\CENTRAL DE REGULACAO DE MARABA-20260605.txt'
