// Executa o teste principal (testes/e2e.js) contra o app servido localmente.
// Sobe um servidor estático só com Node (sem dependência extra), espera responder, roda o teste,
// encerra o servidor e devolve o código de saída do teste. Qualquer falha => código diferente de zero.
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
    codigo = await new Promise((resolve) => {
      const filho = spawn(process.execPath, [path.join(RAIZ, 'testes', 'e2e.js')], { stdio: 'inherit', env: { ...process.env, BASE_URL: base } });
      filho.on('exit', (c, sinal) => resolve(c === null ? 1 : c));
      filho.on('error', (e) => { console.error(e); resolve(1); });
    });
  } catch (e) {
    console.error('Falha ao preparar o teste:', e.message);
  } finally {
    servidor.close();
  }
  console.log(codigo === 0 ? 'test:e2e: SUCESSO' : `test:e2e: FALHOU (código ${codigo})`);
  process.exit(codigo);
});
servidor.on('error', (e) => { console.error('Não foi possível iniciar o servidor:', e.message); process.exit(1); });
