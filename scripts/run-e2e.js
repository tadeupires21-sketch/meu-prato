// Executa os roteiros de teste (testes/*.js) contra o app servido localmente.
// Sobe um servidor estático só com Node (sem dependência extra), espera responder, roda os roteiros um a um
// (cada um com navegador próprio e armazenamento vazio), encerra o servidor e mostra um resumo.
// Sem argumentos roda todos, começando por e2e; com nomes roda só esses: npm run test:e2e -- agua recorte1
// Termina com 0 só se todos passarem; qualquer falha => código diferente de zero.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const PORTA = Number(process.env.PORT || 8765);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/plain; charset=utf-8' };

const servidor = http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const arq = path.normalize(path.join(RAIZ, rel));
  if (!arq.startsWith(RAIZ + path.sep) || arq.includes(`${path.sep}node_modules${path.sep}`)) { res.writeHead(403); res.end(); return; }
  fs.readFile(arq, (err, dados) => {
    if (err) { res.writeHead(404); res.end('não encontrado'); return; }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(dados);
  });
});

function esperarResposta(url, tentativas = 50) {
  return new Promise((resolve, reject) => {
    const tentar = (n) => http.get(url, (r) => { r.resume(); r.statusCode === 200 ? resolve() : n > 0 ? setTimeout(() => tentar(n - 1), 100) : reject(new Error(`servidor respondeu ${r.statusCode}`)); })
      .on('error', (e) => (n > 0 ? setTimeout(() => tentar(n - 1), 100) : reject(e)));
    tentar(tentativas);
  });
}

servidor.listen(PORTA, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${PORTA}`;
  let codigo = 1;
  try {
    await esperarResposta(`${base}/index.html`);
    console.log(`Servidor de teste em ${base}`);
    const pasta = path.join(RAIZ, 'testes');
    const todos = fs.readdirSync(pasta).filter((f) => f.endsWith('.js') && !f.startsWith('_')).map((f) => f.slice(0, -3))
      .sort((a, b) => (a === 'e2e' ? -1 : b === 'e2e' ? 1 : a.localeCompare(b)));
    const pedidos = process.argv.slice(2).map((n) => n.replace(/^testes\//, '').replace(/\.js$/, ''));
    const desconhecidos = pedidos.filter((n) => !todos.includes(n));
    if (desconhecidos.length) throw new Error(`roteiro(s) inexistente(s): ${desconhecidos.join(', ')}. Disponíveis: ${todos.join(', ')}`);
    const fila = pedidos.length ? pedidos : todos;
    const resultados = [];
    for (const nome of fila) {
      console.log(`\n━━━ ${nome} ━━━`);
      const t0 = Date.now();
      const c = await new Promise((resolve) => {
        const filho = spawn(process.execPath, [path.join(pasta, nome + '.js')], { stdio: 'inherit', env: { ...process.env, BASE_URL: base } });
        filho.on('exit', (cod) => resolve(cod === null ? 1 : cod));
        filho.on('error', (e) => { console.error(e); resolve(1); });
      });
      resultados.push({ nome, ok: c === 0, s: ((Date.now() - t0) / 1000).toFixed(1) });
    }
    console.log('\nResumo:');
    for (const r of resultados) console.log(`  ${r.ok ? 'PASSOU' : 'FALHOU'}  ${r.nome.padEnd(16)} ${r.s}s`);
    codigo = resultados.every((r) => r.ok) ? 0 : 1;
  } catch (e) {
    console.error('Falha ao preparar o teste:', e.message);
  } finally {
    servidor.close();
  }
  console.log(codigo === 0 ? 'test:e2e: SUCESSO' : `test:e2e: FALHOU (código ${codigo})`);
  process.exit(codigo);
});
servidor.on('error', (e) => { console.error('Não foi possível iniciar o servidor:', e.message); process.exit(1); });
