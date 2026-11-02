// Utilidades compartilhadas pelos roteiros de teste. Não é um teste (o executor ignora arquivos com "_").
// - BASE_URL vem do executor (npm run test:e2e); sem ele, usa 127.0.0.1:8765.
// - Cada roteiro grava capturas em test-results/<nome>/.
// - encerrar() fecha todos os navegadores abertos, inclusive na falha, salvando falha.png antes.
'use strict';
const fs = require('fs');
const path = require('path');
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const URL = BASE + '/index.html';
const navegadores = [];
let pastaAtual = null;
function pastaResultados(nome) {
  pastaAtual = path.resolve(__dirname, '..', 'test-results', nome);
  fs.mkdirSync(pastaAtual, { recursive: true });
  return pastaAtual;
}
function registrar(browser) { navegadores.push(browser); return browser; }
async function encerrar(codigo) {
  if (codigo !== 0 && pastaAtual) {
    for (const b of navegadores) {
      try { const pg = b.contexts().flatMap((c) => c.pages())[0]; if (pg) { await pg.screenshot({ path: path.join(pastaAtual, 'falha.png'), fullPage: true }); break; } } catch { /* sem página */ }
    }
  }
  for (const b of navegadores) { try { await b.close(); } catch { /* já fechado */ } }
  process.exit(codigo);
}
module.exports = { BASE, URL, pastaResultados, registrar, encerrar };
