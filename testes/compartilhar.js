// Botão "Compartilhar backup": envia o arquivo pela tela de compartilhamento do sistema; sem suporte, baixa.
const { chromium } = require('playwright');
const assert = require('assert');
const { URL, pastaResultados, registrar, encerrar } = require('./_comum');
pastaResultados('compartilhar');
(async () => {
  const b = registrar(await chromium.launch());
  const txt = async (p, sel) => (await p.locator(sel).first().innerText()).replace(/\s+/g, ' ').trim();
  const abrir = async (modo) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    // Simula a Web Share API antes de o app carregar: "ok" compartilha, "cancela" lança AbortError, "sem" não existe.
    await ctx.addInitScript((m) => {
      window.__compartilhado = null;
      if (m === 'sem') { delete Navigator.prototype.share; delete Navigator.prototype.canShare; Object.defineProperty(navigator, 'share', { value: undefined }); Object.defineProperty(navigator, 'canShare', { value: undefined }); return; }
      navigator.canShare = (d) => !!(d && d.files && d.files.length);
      navigator.share = async (d) => {
        if (m === 'cancela') throw new DOMException('cancelado', 'AbortError');
        const f = d.files[0]; window.__compartilhado = { nome: f.name, tipo: f.type, titulo: d.title, conteudo: await f.text() };
      };
    }, modo);
    const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message)); p.on('dialog', (d) => d.accept());
    await p.goto(URL); await p.waitForSelector('.summary');
    return { p, erros };
  };

  // 1. compartilha: arquivo com nome, tipo e conteúdo que o próprio app aceita reimportar
  let { p, erros } = await abrir('ok');
  await p.click('[data-act=agua-mais][data-ml="250"]');
  await p.click('.tab[data-tab=config]'); assert.equal(await p.locator('[data-act=compartilhar-backup]').count(), 1);
  let downloads = 0; p.on('download', () => downloads++);
  await p.click('[data-act=compartilhar-backup]'); await p.waitForFunction(() => window.__compartilhado);
  const c = await p.evaluate(() => window.__compartilhado);
  const valido = await p.evaluate((s) => { const o = JSON.parse(s); return { v: MeuPrato.validar(o), agua: Object.values(o.dias).flatMap((d) => d.agua || []).reduce((a, x) => a + x.ml, 0), app: o.app }; }, c.conteudo);
  console.log('compartilhado:', c.nome, c.tipo, c.titulo, '| validação:', JSON.stringify(valido.v), '| água no arquivo:', valido.agua, '| toast:', await txt(p, '#toast'));
  assert.match(c.nome, /^meu-prato-backup-\d{4}-\d{2}-\d{2}\.json$/); assert.equal(c.tipo, 'application/json'); assert.ok(valido.v.ok); assert.equal(valido.agua, 250); assert.equal(valido.app, 'Meu Prato'); assert.equal(downloads, 0);
  assert.deepEqual(erros, []);

  // 2. cancelado: nada é baixado, aviso de cancelamento
  ({ p, erros } = await abrir('cancela'));
  await p.click('.tab[data-tab=config]'); downloads = 0; p.on('download', () => downloads++);
  await p.click('[data-act=compartilhar-backup]'); await p.waitForTimeout(300);
  console.log('cancelado → toast:', await txt(p, '#toast'), '| downloads:', downloads); assert.match(await txt(p, '#toast'), /cancelado/); assert.equal(downloads, 0); assert.deepEqual(erros, []);

  // 3. sem suporte: cai no download do mesmo arquivo
  ({ p, erros } = await abrir('sem'));
  await p.click('.tab[data-tab=config]');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act=compartilhar-backup]')]);
  console.log('sem suporte → download:', dl.suggestedFilename(), '| toast:', await txt(p, '#toast'));
  assert.match(dl.suggestedFilename(), /^meu-prato-backup-.*\.json$/); assert.match(await txt(p, '#toast'), /baixado/); assert.deepEqual(erros, []);
  console.log('OK');
})().then(() => encerrar(0), (e) => { console.error('FALHA', e); return encerrar(1); });
