// A busca do registro mostra os itens da lista embutida ainda não importados e os importa ao toque,
// sem passar por Ajustes → Adicionar alimentos comuns.
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
const { URL, pastaResultados, registrar, encerrar } = require('./_comum');
const RES = pastaResultados('busca-base');
(async () => {
  const b = registrar(await chromium.launch()); const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const erros = []; p.on('pageerror', (e) => erros.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto(URL); const txt = async (sel) => (await p.locator(sel).first().innerText()).replace(/\s+/g, ' ').trim();
  const cadastro = () => p.evaluate(() => (JSON.parse(localStorage.getItem('meuprato.v1') || '{}').alimentos || []).map((a) => a.nome));
  assert.equal((await cadastro()).length, 0, 'parte de cadastro vazio');

  // Jantar (idx 3): sem busca, nenhuma sugestão aparece
  await p.click('[data-act=adicionar][data-idx="3"]'); await p.waitForSelector('.sheet .lista');
  assert.equal(await p.locator('.sheet [data-act=pick-sugestao]').count(), 0, 'sem busca não sugere');

  // busca "spoleto": aparece como sugestão, em seção separada, e nada foi importado ainda
  await p.fill('.sheet .search', 'spoleto');
  await p.waitForSelector('.sheet [data-act=pick-sugestao]');
  assert.equal(await p.locator('.sheet [data-act=pick-sugestao]').count(), 1);
  console.log('seção:', await txt('.sheet .secao-base')); console.log('sugestão:', await txt('.sheet [data-act=pick-sugestao]'));
  assert((await txt('.sheet [data-act=pick-sugestao]')).includes('Spoleto'));
  assert.equal(await p.locator('.sheet [data-act=pick-alimento]').count(), 0);
  assert.equal((await cadastro()).length, 0, 'só olhar a busca não importa nada');
  await p.screenshot({ path: path.join(RES, 'sugestao.png') });

  // tocar importa só aquele item e abre a quantidade; 1 prato (365 g × 133 kcal/100 g) = 485 kcal
  await p.click('.sheet [data-act=pick-sugestao]');
  await p.waitForSelector('.sheet [name=qtd]');
  assert.deepEqual(await cadastro(), ['Fettuccine pomodoro com calabresa (Spoleto), estimativa']);
  const opcoes = await p.locator('.sheet [name=uni] option').allInnerTexts(); const alvo = opcoes.find((o) => o.includes('prato Spoleto')); assert(alvo, 'medida do prato disponível');
  await p.selectOption('.sheet [name=uni]', { label: alvo });
  await p.fill('.sheet [name=qtd]', '1');
  console.log('prévia:', await txt('.sheet .preview'));
  assert((await txt('.sheet .preview')).startsWith('485 kcal'));
  await p.click('.sheet [data-ok]'); await p.waitForSelector('.entry');
  console.log('jantar:', await txt('.meal[data-idx="3"] .meal-sub'));
  assert((await txt('.meal[data-idx="3"] .meal-sub')).startsWith('485 kcal'));

  // fonte e observação vieram junto
  const item = await p.evaluate(() => JSON.parse(localStorage.getItem('meuprato.v1')).alimentos[0]);
  assert.equal(item.fonte, 'TBCA (USP) BRC0853A, aproximação'); assert(item.obs.includes('Spoleto não publica')); assert.equal(item.medidas[0].equivale, 365);

  // segunda busca: agora é alimento do cadastro, não sugestão, e continua único
  await p.click('[data-act=adicionar][data-idx="3"]'); await p.waitForSelector('.sheet .lista');
  await p.fill('.sheet .search', 'spoleto'); await p.waitForSelector('.sheet [data-act=pick-alimento]');
  assert.equal(await p.locator('.sheet [data-act=pick-alimento]').count(), 1);
  assert.equal(await p.locator('.sheet [data-act=pick-sugestao]').count(), 0);
  assert.equal((await cadastro()).length, 1);

  // busca sem acento acha item da lista; busca sem correspondência não mostra seção
  await p.fill('.sheet .search', 'feijao');
  await p.waitForSelector('.sheet [data-act=pick-sugestao]');
  const n = await p.locator('.sheet [data-act=pick-sugestao]').count(); console.log('sugestões para "feijao":', n); assert(n >= 1 && n <= 8);
  await p.fill('.sheet .search', 'zzzxqy'); await p.waitForTimeout(100);
  assert.equal(await p.locator('.sheet [data-act=pick-sugestao]').count(), 0); assert.equal(await p.locator('.sheet .secao-base').count(), 0);

  console.log('erros:', erros); assert.equal(erros.length, 0); await b.close(); console.log('OK');
})().then(() => encerrar(0), (e) => { console.error('FALHA', e); return encerrar(1); });
