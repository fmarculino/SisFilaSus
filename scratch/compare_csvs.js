import fs from 'fs';

const file1Path = 'c:/Users/Cliente/Projetos/SisFilaSus/scratch/SISREG_INTERNACAO_SOL_E_150420_2026-06-05_16-14-00.csv';
const file2Path = 'c:/Users/Cliente/Projetos/SisFilaSus/scratch/SISREG_INTERNACAO_SOL_E_150420_2026-06-05_19-49-33.csv';

const file1 = fs.readFileSync(file1Path, 'utf-8');
const file2 = fs.readFileSync(file2Path, 'utf-8');

const lines1 = file1.split(/\r?\n/).filter(l => l.trim().length > 0);
const lines2 = file2.split(/\r?\n/).filter(l => l.trim().length > 0);

console.log('Linhas 1:', lines1.length);
console.log('Linhas 2:', lines2.length);

const headers = lines1[0].split(';').map(h => h.trim());

let diffCount = 0;
let colDiffs = {};

for (let i = 1; i < Math.min(lines1.length, lines2.length); i++) {
  if (lines1[i] !== lines2[i]) {
    diffCount++;
    const cols1 = lines1[i].split(';');
    const cols2 = lines2[i].split(';');
    
    for (let colIdx = 0; colIdx < Math.max(cols1.length, cols2.length); colIdx++) {
      const val1 = cols1[colIdx] || '';
      const val2 = cols2[colIdx] || '';
      
      if (val1 !== val2) {
        const headerName = headers[colIdx] || `Col_${colIdx}`;
        colDiffs[headerName] = (colDiffs[headerName] || 0) + 1;
        
        if (diffCount <= 3) {
          console.log(`Linha ${i + 1} difere na coluna "${headerName}":`);
          console.log(`  File 1: "${val1}"`);
          console.log(`  File 2: "${val2}"`);
        }
      }
    }
  }
}

console.log('Total de linhas com diferenças:', diffCount);
console.log('Distribuição de diferenças por colunas:', colDiffs);
