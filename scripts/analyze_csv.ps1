$csv = Import-Csv 'C:\Users\Cliente\Projetos\SisFilaSus\scratch\SISREG_INTERNACAO_SOL_E_150420_2026-06-05_16-14-00.csv' -Delimiter ';'
Write-Host "Total registros: $($csv.Count)"
Write-Host "---"

Write-Host "Municipios solicitantes distintos:"
$csv | Select-Object -ExpandProperty 'NOME CENTRAL REGULADORA SOLICITANTE' | Sort-Object -Unique | ForEach-Object { Write-Host "  $_" }

Write-Host "---"
Write-Host "Classificacoes de risco:"
$csv | Group-Object 'COD. CLASSIFICACAO DE RISCO' | ForEach-Object { Write-Host "  Risco $($_.Name): $($_.Count) registros" }

Write-Host "---"
Write-Host "Modalidade fila:"
$csv | Group-Object 'COD. MODALIDADE FILA' | ForEach-Object { Write-Host "  Modalidade $($_.Name): $($_.Count)" }

Write-Host "---"
Write-Host "Tipo fila:"
$csv | Group-Object 'COD. TIPO DE FILA' | ForEach-Object { Write-Host "  Tipo $($_.Name): $($_.Count)" }

Write-Host "---"
Write-Host "Top 20 procedimentos (SIGTAP) mais frequentes:"
$csv | Group-Object 'DESC. SIGTAP' | Sort-Object Count -Descending | Select-Object -First 20 | ForEach-Object { Write-Host "  $($_.Count) - $($_.Name.Trim())" }

Write-Host "---"
Write-Host "Pacientes com solicitacao mais antiga (top 10):"
$csv | Sort-Object 'DATA/HORA DA SOLICITACAO' | Select-Object -First 10 | ForEach-Object { Write-Host "  $($_.'DATA/HORA DA SOLICITACAO') | $($_.'NOME DO USUARIO') | $($_.'DESC. SIGTAP'.Trim())" }

Write-Host "---"
Write-Host "Unidades solicitantes (CNES) distintas:"
$csv | Group-Object 'NOME UNIDADE SOLICITANTE' | Sort-Object Count -Descending | Select-Object -First 15 | ForEach-Object { Write-Host "  $($_.Count) - $($_.Name)" }

Write-Host "---"
Write-Host "Pacientes com CPF vazio:"
$semCpf = ($csv | Where-Object { $_.'CPF DO USUARIO' -eq '' }).Count
Write-Host "  $semCpf de $($csv.Count)"
