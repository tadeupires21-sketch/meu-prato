// Base ampliada: (1) restante da TACO sugerido na busca e importado ao toque; (2) busca de produtos de marca
// por nome no Open Food Facts, só a pedido. O Open Food Facts é simulado: não testa a API real.
const { chromium } = require('playwright');
const assert = require('assert');
const { URL, pastaResultados, registrar, encerrar } = require('./_comum');
pastaResultados('base-completa');
(async () => {
  const { ALIMENTOS_BASE } = await import('../js/alimentos-base.js');
  const { TACO_COMPLETA } = await import('../js/taco-completa.js');
  const norm = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  assert.equal(TACO_COMPLETA.length, 496);
  const nomes = new Set(ALIMENTOS_BASE.map((b) => norm(b.nome)));
  assert.equal(TACO_COMPLETA.filter((t) => nomes.has(norm(t.nome))).length, 0, 'nenhum nome repetido com a lista conferida');
  assert.equal(new Set(TACO_COMPLETA.map((t) => norm(t.nome))).size, TACO_COMPLETA.length, 'nomes únicos');
  for (const t of TACO_COMPLETA) {
    for (const k of ['kcal', 'prot', 'carb', 'gord']) assert.ok(typeof t[k] === 'number' && t[k] >= 0, `${t.nome}: ${k}`);
    for (const k of ['fibra', 'sodio']) assert.ok(t[k] === null || (typeof t[k] === 'number' && t[k] >= 0), `${t.nome}: ${k}`);
    assert.ok(['cru', 'cozido', 'na'].includes(t.estado)); assert.match(t.obs, /^TACO nº \d+/);
  }
  const de = (nome) => TACO_COMPLETA.find((t) => t.nome === nome);
  assert.deepEqual([de('Arroz, tipo 1, cru').kcal, de('Arroz, tipo 1, cru').prot, de('Arroz, tipo 1, cru').carb], [358, 7.2, 78.8]);
  assert.deepEqual([de('Quiabo, cru').kcal, de('Quiabo, cru').fibra, de('Quiabo, cru').sodio], [30, 4.6, 1]);
  assert.equal(de('Azeite, de dendê').gord, 100); assert.equal(de('Óleo, de soja').prot, 0); assert.equal(de('Óleo, de soja').sodio, null);
  assert.equal(de('Sal, grosso').sodio, 39943); assert.equal(de('Cerveja, pilsen').refUnidade, 'ml');
  assert.equal(de('Leite, de vaca, integral'), undefined, 'linha com "*" na TACO fica de fora');
  console.log('lista gerada:', TACO_COMPLETA.length, 'itens, coerente');

  const b = registrar(await chromium.launch()); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const erros = []; p.on('pageerror', (e) => erros.push(e.message)); p.on('dialog', (d) => d.accept());
  let modo = 'ok'; const buscas = [];
  const produto = (code, nome, marca, kcal) => ({ code, product_name: nome, brands: marca, quantity: '170 g', serving_size: '170 g', nutriments: { 'energy-kcal_100g': kcal, proteins_100g: 8.5, carbohydrates_100g: 4.1, fat_100g: 6, sodium_100g: 0.04 } });
  await p.route('https://world.openfoodfacts.org/**', (r) => {
    const u = new (require('url').URL)(r.request().url()); buscas.push(u);
    if (modo === '503') return r.fulfill({ status: 503, body: 'fora do ar' });
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 3, products: [
      produto('7891000000011', 'Iogurte Grego Tradicional', 'Marca Z, Outra', 110),
      { code: '7891000000028', product_name: 'Iogurte sem tabela', brands: 'X', nutriments: {} },           // sem energia: descartado
      { code: '7891000000035', product_name: '', nutriments: { 'energy-kcal_100g': 90 } },                  // sem nome: descartado
    ] }) });
  });
  const txt = async (sel) => (await p.locator(sel).first().innerText()).replace(/\s+/g, ' ').trim();
  const cadastro = () => p.evaluate(() => (JSON.parse(localStorage.getItem('meuprato.v1') || '{}').alimentos || []));
  await p.goto(URL);

  // 1. TACO completa: "quiabo" não está na lista conferida, mas aparece na busca e entra ao toque
  await p.click('[data-act=adicionar][data-idx="1"]'); await p.waitForSelector('.sheet .lista');
  await p.fill('.sheet .search', 'quiabo'); await p.waitForSelector('.sheet [data-act=pick-sugestao]');
  assert.match(await txt('.sheet [data-act=pick-sugestao]'), /Quiabo, cru/);
  await p.click('.sheet [data-act=pick-sugestao]'); await p.waitForSelector('.sheet [name=qtd]');
  let al = await cadastro(); assert.equal(al.length, 1);
  assert.equal(al[0].nome, 'Quiabo, cru'); assert.equal(al[0].kcal, 30); assert.equal(al[0].fonte, 'TACO 4ª ed. (NEPA/Unicamp)'); assert.match(al[0].obs, /TACO nº 147/);
  await p.fill('.sheet [name=qtd]', '200'); await p.click('.sheet [data-ok]'); await p.waitForSelector('.entry');
  assert.match(await txt('.meal[data-idx="1"] .meal-sub'), /^60 kcal/);
  console.log('TACO completa: quiabo importado pela busca e registrado');

  // item conferido vem antes do restante da TACO quando a pontuação empata
  await p.click('[data-act=adicionar][data-idx="1"]'); await p.waitForSelector('.sheet .lista');
  await p.fill('.sheet .search', 'arroz'); await p.waitForSelector('.sheet [data-act=pick-sugestao]');
  const sug = await p.locator('.sheet [data-act=pick-sugestao] .name').allInnerTexts();
  assert.ok(sug.length <= 8 && /^Arroz (branco|integral)/.test(sug[0]), 'lista conferida primeiro: ' + sug[0]);
  assert.ok(sug.some((x) => x.startsWith('Arroz, tipo 1, cru')), 'TACO completa também aparece');

  // 2. Produtos de marca: com menos de 3 letras não oferece; nada é consultado antes do toque
  await p.fill('.sheet .search', 'io'); await p.waitForTimeout(100);
  assert.equal(await p.locator('.sheet [data-act=pick-off]').count(), 0);
  await p.fill('.sheet .search', 'iogurte grego'); await p.waitForSelector('.sheet [data-act=pick-off]');
  assert.equal(buscas.length, 0, 'digitar não consulta a internet');
  await p.click('.sheet [data-act=pick-off]'); await p.waitForSelector('.sheet [data-act=pick-off-item]');
  assert.equal(buscas.length, 1); assert.equal(buscas[0].searchParams.get('search_terms'), 'iogurte grego'); assert.equal(buscas[0].searchParams.get('tag_0'), 'brazil');
  assert.equal(await p.locator('.sheet [data-act=pick-off-item]').count(), 1, 'produtos sem nome ou sem energia descartados');
  console.log('resultado:', await txt('.sheet [data-act=pick-off-item]'));
  assert.match(await txt('.sheet [data-act=pick-off-item]'), /Iogurte Grego Tradicional.*Marca Z.*110 kcal/);
  assert.equal((await cadastro()).length, 1, 'ver o resultado não cadastra nada');

  // tocar abre o cadastro preenchido para conferência; salvar leva à quantidade
  await p.click('.sheet [data-act=pick-off-item]'); await p.waitForSelector('form[data-form=alimento]');
  assert.equal(await p.inputValue('[name=nome]'), 'Iogurte Grego Tradicional'); assert.equal(await p.inputValue('[name=codigoBarras]'), '7891000000011');
  await p.click('form[data-form=alimento] button[type=submit]'); await p.waitForSelector('.sheet [name=qtd]');
  al = await cadastro(); const iog = al.find((a) => a.nome === 'Iogurte Grego Tradicional');
  assert.ok(iog); assert.equal(iog.fonte, 'Open Food Facts'); assert.equal(iog.marca, 'Marca Z'); assert.equal(iog.sodio, 40);
  await p.fill('.sheet [name=qtd]', '170'); await p.click('.sheet [data-ok]'); await p.waitForFunction(() => document.querySelectorAll('.meal[data-idx="1"] .entry').length === 2);
  console.log('produto de marca cadastrado e registrado');

  // mesmo produto de novo: reconhecido pelo código, não duplica
  await p.click('[data-act=adicionar][data-idx="1"]'); await p.waitForSelector('.sheet .lista');
  await p.fill('.sheet .search', 'grego marca'); await p.click('.sheet [data-act=pick-off]'); await p.waitForSelector('.sheet [data-act=pick-off-item]');
  await p.click('.sheet [data-act=pick-off-item]'); await p.waitForSelector('.sheet [name=qtd]');
  assert.equal((await cadastro()).length, 2); await p.keyboard.press('Escape');

  // servidor fora do ar: aviso e "Tentar de novo"; mudar o texto limpa o resultado
  modo = '503'; await p.reload(); await p.click('[data-act=adicionar][data-idx="1"]'); await p.waitForSelector('.sheet .lista');
  await p.fill('.sheet .search', 'requeijão light'); await p.click('.sheet [data-act=pick-off]');
  await p.waitForFunction(() => /não respondeu/.test(document.querySelector('.sheet .secao-off')?.textContent || ''));
  assert.match(await txt('.sheet [data-act=pick-off]'), /Tentar de novo/);
  await p.fill('.sheet .search', 'requeijão'); await p.waitForFunction(() => !document.querySelector('.sheet .secao-off'));
  assert.match(await txt('.sheet [data-act=pick-off]'), /Buscar “requeijão” em produtos de marca/);
  await p.keyboard.press('Escape');

  // consulta desligada em Ajustes: a busca por nome some
  await p.reload(); await p.click('.tab[data-tab=config]'); await p.uncheck('[data-act=toggle-off]');
  await p.click('.tab[data-tab=hoje]'); await p.click('[data-act=adicionar][data-idx="1"]'); await p.waitForSelector('.sheet .lista');
  const antes = buscas.length; await p.fill('.sheet .search', 'iogurte grego'); await p.waitForTimeout(150);
  assert.equal(await p.locator('.sheet [data-act=pick-off]').count(), 0); assert.equal(buscas.length, antes);
  console.log('erro, nova busca e consulta desligada: ok');
  assert.deepEqual(erros, []);
  console.log('OK');
})().then(() => encerrar(0), (e) => { console.error('FALHA', e); return encerrar(1); });
