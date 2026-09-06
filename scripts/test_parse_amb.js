import fs from 'fs';
import path from 'path';

const fileAmbPath = 'c:/Users/Cliente/Projetos/SisFilaSus/scratch/SISREG_AMB_AGENDADOS_REG_150420_2026-06-05_19-58-59.csv';

const fileContent = fs.readFileSync(fileAmbPath, 'utf-8');
const lines = fileContent.split(/\r?\n/).filter(line => line.trim().length > 0);

console.log('Linhas totais:', lines.length);

const headerLine = lines[0];
const rawHeaders = headerLine.split(';').map(h => h.trim());
const seenHeaders = new Map();
const sanitizedHeaders = rawHeaders.map(h => {
  const count = seenHeaders.get(h) || 0;
  seenHeaders.set(h, count + 1);
  return count > 0 ? `${h}_${count}` : h;
});

console.log('Total colunas:', sanitizedHeaders.length);
console.log('Colunas Higienizadas:', sanitizedHeaders.slice(0, 15), '...');

const getColValue = (rowCols, headerName) => {
  const idx = sanitizedHeaders.indexOf(headerName);
  return idx !== -1 && rowCols[idx] ? rowCols[idx].trim() : '';
};

const isAmbulatorial = sanitizedHeaders.includes('STATUS SOLICITACAO') || sanitizedHeaders.includes('EXECUCAO CONFIRMADA');
console.log('É Ambulatorial?', isAmbulatorial);

// Vamos tentar analisar as primeiras 5 linhas e validar campos cruciais
for (let i = 1; i <= 5; i++) {
  const rowCols = lines[i].split(';');
  console.log(`\n--- Registro ${i} ---`);
  console.log('COD. SOLICITACAO:', getColValue(rowCols, 'COD. SOLICITACAO'));
  console.log('CNS DO USUARIO:', getColValue(rowCols, 'CNS DO USUARIO'));
  console.log('NOME DO USUARIO:', getColValue(rowCols, 'NOME DO USUARIO'));
  console.log('COD. SIGTAP:', getColValue(rowCols, 'COD. SIGTAP'));
  console.log('DESC. SIGTAP:', getColValue(rowCols, 'DESC. SIGTAP'));
  console.log('STATUS SOLICITACAO:', getColValue(rowCols, 'STATUS SOLICITACAO'));
  console.log('EXECUCAO CONFIRMADA:', getColValue(rowCols, 'EXECUCAO CONFIRMADA'));
  console.log('CHAVE DE CONFIRMACAO:', getColValue(rowCols, 'CHAVE DE CONFIRMACAO'));
}
