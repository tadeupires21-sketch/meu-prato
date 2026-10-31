const { chromium } = require('playwright'); const assert = require('assert');
const URL = 'http://127.0.0.1:8765/index.html';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
  const erros = []; p.on('pageerror', (e) => erros.push(e.message)); p.on('dialog', (d) => d.accept());
  const txt = async (sel) => (await p.locator(sel).first().innerText()).replace(/\s+/g, ' ').trim();
  await p.goto(URL);
  // service worker real: cache com os arquivos
  await p.waitForFunction(async () => (await caches.keys()).includes('meu-prato-v16') && (await (await caches.open('meu-prato-v16')).keys()).length >= 5, null, { timeout: 15000 }).catch(async () => console.log('SW estado:', await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r ? [r.installing?.state, r.waiting?.state, r.active?.state].join('/') : 'sem registro'; })));
  const cached = await p.evaluate(async () => (await (await caches.open('meu-prato-v16')).keys()).map(r => r.url.split('/').pop()));
  console.log('cache SW:', cached.join(', ')); assert(cached.includes('app.js') && cached.includes('styles.css'));
  // 1. busca sem acento, ordem livre, nome antes de marca
  await p.click('.tab[data-tab=config]'); await p.click('[data-act=importar-base]'); await p.waitForSelector('.sheet [data-ok]'); await p.click('.sheet [data-ok]'); await p.waitForSelector('.list-item');
  await p.evaluate(() => { const D = MeuPrato.dados(); D.alimentos.push({ id: 'mk', nome: 'Biscoito água e sal', marca: 'Pão de Açúcar', refQtd: 100, refUnidade: 'g', kcal: 400, prot: 9, carb: 70, gord: 10, medidas: [], favorito: false }); localStorage.setItem('meuprato.v1', JSON.stringify(D)); });
  await p.reload(); await p.click('.tab[data-tab=alimentos]');
  await p.fill('[data-act=busca-alimentos]', 'pao'); await p.waitForTimeout(50);
  const r1 = await p.$$eval('.list-item .name', (els) => els.map((e) => e.textContent.trim()));
  console.log('busca "pao":', r1.join(' | ')); assert(r1[0].startsWith('Pão')); assert(r1.some((x) => x.includes('Biscoito água e sal'))); assert(r1.indexOf(r1.find((x) => x.includes('Biscoito'))) > r1.findIndex((x) => x.startsWith('Pão')));
  await p.fill('[data-act=busca-alimentos]', 'grelhado frango'); await p.waitForTimeout(50);
  const r2 = await p.$$eval('.list-item .name', (els) => els.map((e) => e.textContent.trim())); console.log('busca "grelhado frango":', r2.join(' | ')); assert.equal(r2.length, 1);
  await p.fill('[data-act=busca-alimentos]', ''); await p.waitForTimeout(50); assert((await p.locator('.list-item').count()) >= 47);
  // 2. adicionar e continuar: 3 itens numa abertura; última porção; atalhos
  await p.click('.tab[data-tab=hoje]'); await p.click('[data-act=adicionar][data-idx="1"]');
  console.log('cabeçalho seletor:', await txt('.sheet .resumo-refeicao'));
  await p.fill('.sheet .search', 'arroz branco'); await p.click('.sheet [data-act=pick-alimento]');
  console.log('atalhos g:', await txt('.sheet .atalhos'));
  await p.click('.sheet .atalhos .chip:has-text("150")'); assert.equal(await p.inputValue('.sheet [name=qtd]'), '150');
  await p.click('.sheet [data-continuar]'); await p.waitForSelector('.sheet .resumo-refeicao');
  console.log('após 1º:', await txt('.sheet .resumo-refeicao')); assert((await txt('.sheet .resumo-refeicao')).includes('1 item · 192 kcal'));
  await p.fill('.sheet .search', 'feijao carioca'); await p.click('.sheet [data-act=pick-alimento]'); await p.fill('.sheet [name=qtd]', '80'); await p.click('.sheet [data-continuar]'); await p.waitForSelector('.sheet .resumo-refeicao');
  await p.fill('.sheet .search', 'frango'); await p.click('.sheet [data-act=pick-alimento]'); await p.fill('.sheet [name=qtd]', '120'); await p.click('.sheet [data-ok]');
  await p.waitForFunction(() => document.querySelectorAll('.meal[data-idx="1"] .entry').length === 3);
  console.log('almoço:', await txt('.meal[data-idx="1"] .meal-sub'));
  // desfazer via toast
  await p.click('#toast .toast-acao'); await p.waitForFunction(() => document.querySelectorAll('.meal[data-idx="1"] .entry').length === 2); console.log('desfazer ok');
  // última porção persiste após recarregar e respeita unidade
  await p.reload(); await p.click('[data-act=adicionar][data-idx="3"]'); await p.fill('.sheet .search', 'arroz branco'); await p.click('.sheet [data-act=pick-alimento]');
  console.log('última porção:', await txt('.sheet .ultima'), '| campo:', await p.inputValue('.sheet [name=qtd]')); assert.equal(await p.inputValue('.sheet [name=qtd]'), '150');
  await p.keyboard.press('Escape');
  // unidade da última vez removida → aviso
  await p.evaluate(() => { const D = MeuPrato.dados(); const o = D.alimentos.find(a => a.nome.startsWith('Ovo de galinha inteiro, cozido')); D.porcoes['alimento:' + o.id] = { qtd: 2, unidade: 'dúzia' }; localStorage.setItem('meuprato.v1', JSON.stringify(D)); });
  await p.reload(); await p.click('[data-act=adicionar][data-idx="0"]'); await p.fill('.sheet .search', 'ovo cozido'); await p.click('.sheet [data-act=pick-alimento]');
  console.log('aviso medida removida:', (await txt('.sheet')).includes('não existe mais')); assert((await txt('.sheet')).includes('não existe mais')); await p.keyboard.press('Escape');
  // 3. detalhe do dia: somas batem
  await p.click('[data-act=detalhe][data-n="prot"]'); await p.waitForSelector('.sheet .corpo');
  const det = await p.evaluate(() => { const D = MeuPrato.dados(); const d = D.dias[MeuPrato.ui.data]; const tot = d.refeicoes.flatMap(r => r.itens).reduce((a, i) => a + i.prot, 0); const txt = document.querySelector('.sheet .stat .value').textContent; return { tot: Math.round(tot * 10) / 10, mostrado: txt.trim(), refs: [...document.querySelectorAll('.sheet .ing')].map(e => e.textContent.replace(/\s+/g, ' ').trim()), top: document.querySelectorAll('.sheet [data-item]').length }; });
  console.log('detalhe prot:', JSON.stringify(det)); assert(det.mostrado.startsWith(String(det.tot).replace('.', ',')));
  await p.click('.sheet .chip:has-text("Calorias")'); console.log('detalhe kcal:', await txt('.sheet .stat .value'));
  await p.click('.sheet [data-item] >> nth=0'); await p.waitForSelector('.sheet .menu'); console.log('abre item:', await txt('.sheet h2')); await p.keyboard.press('Escape');
  // 4. escape em nome com HTML no copiar
  await p.evaluate(() => { const D = MeuPrato.dados(); const d = D.dias[MeuPrato.ui.data]; d.refeicoes[1].itens[0].rotulo = '<img src=x onerror="window.__xss=1">Arroz'; localStorage.setItem('meuprato.v1', JSON.stringify(D)); });
  await p.reload(); await p.click('[data-act=dia-prox]'); await p.click('[data-act=menu-refeicao][data-idx="1"]'); await p.click('.sheet .menu button:has-text("Copiar")');
  const hoje = await p.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  await p.evaluate((h) => { const i = document.querySelector('.sheet input[type=date]'); i.max = '2099-12-31'; i.value = h; i.dispatchEvent(new Event('change')); }, hoje);
  await p.waitForSelector('.sheet .lista .list-item'); await p.waitForTimeout(100);
  const xss = await p.evaluate(() => ({ exec: window.__xss === 1, literal: document.querySelector('.sheet .lista .meta').textContent.includes('<img') })); console.log('escape copiar:', JSON.stringify(xss)); assert(!xss.exec && xss.literal);
  await p.keyboard.press('Escape');
  // 5. dados corrompidos preservados; validação completa
  const inval = await p.evaluate(() => [
    MeuPrato.validar({ versao: 1, alimentos: [], receitas: [{ id: 'r', nome: 'x', porcoes: 0, ingredientes: [] }], dias: {} }).erro,
    MeuPrato.validar({ versao: 1, alimentos: [{ id: 'a', nome: 'x', refQtd: 100, refUnidade: 'g', kcal: -1, prot: 0, carb: 0, gord: 0 }], receitas: [], dias: {} }).erro,
    MeuPrato.validar({ versao: 1, alimentos: [null], receitas: [], dias: {} }).erro,
    MeuPrato.validar({ versao: 1, alimentos: [{ id: 'a', nome: 'x', refQtd: 100, refUnidade: 'g', kcal: 1, prot: 0, carb: 0, gord: 0, medidas: [{ nome: 'un', equivale: 0 }] }], receitas: [], dias: {} }).erro,
  ]); console.log('validação rejeita:', inval.join(' / ')); assert(inval.every(Boolean));
  await p.evaluate(() => localStorage.setItem('meuprato.v1', '{"versao":1,"alimentos":"quebrado"')); await p.reload();
  const rec = await p.evaluate(() => ({ banner: document.querySelector('#erro-banner').textContent, hidden: document.querySelector('#erro-banner').hidden, preservado: localStorage.getItem('meuprato.v1.corrompido') }));
  console.log('corrompido:', rec.hidden ? 'SEM banner' : 'banner ok', '| preservado:', rec.preservado); assert(!rec.hidden && rec.preservado.startsWith('{"versao"'));
  await p.click('.tab[data-tab=config]'); assert(await p.locator('[data-act=baixar-corrompido]').count() === 1);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act=baixar-corrompido]')]); console.log('download brutos:', dl.suggestedFilename());
  // 6. falha ao salvar: banner e sem toast de sucesso
  await p.evaluate(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'meuprato.v1') throw new DOMException('cheio', 'QuotaExceededError'); return o.call(this, k, v); }; });
  await p.fill('form[data-form=metas] [name=kcal]', '1900'); await p.click('form[data-form=metas] button[type=submit]'); await p.waitForTimeout(100);
  console.log('falha salvar → toast:', await txt('#toast'), '| banner:', (await txt('#erro-banner')).slice(0, 40)); assert((await txt('#toast')).includes('Não foi possível')); assert((await txt('#erro-banner')).includes('NÃO foi salva'));
  console.log('erros de página:', erros); assert.equal(erros.length, 0); await b.close(); console.log('OK');
})().catch((e) => { console.error('FALHA', e); process.exit(1); });
