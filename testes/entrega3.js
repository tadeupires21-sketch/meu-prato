const { chromium } = require('playwright'); const assert = require('assert'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true }); const p = await ctx.newPage();
  const erros = []; p.on('pageerror', (e) => { erros.push(e.message); console.log('PAGEERROR', e.stack.split('\n').slice(0, 2).join(' <- ')); }); p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Receita X' : undefined));
  const txt = async (sel) => (await p.locator(sel).first().innerText()).replace(/\s+/g, ' ').trim();
  const SHOT = '/tmp/claude-0/-home-user/31289882-dc9d-5eca-88d1-67be19cd3d3b/scratchpad/';
  const hoje = () => p.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  await p.goto('http://127.0.0.1:8765/index.html');
  // 1. usuário novo: sem metas → só consumo
  console.log('kcal sem meta:', await txt('.stat .sub'), '| aviso:', (await txt('.card')).includes('Sem metas')); assert((await txt('.stat .sub')).includes('sem meta definida'));
  await p.click('[data-act=ir-config]'); assert.equal(await p.evaluate(() => MeuPrato.ui.aba), 'config');
  await p.fill('form[data-form=metas] [name=kcal]', '1800'); await p.fill('form[data-form=metas] [name=prot]', '110'); await p.fill('form[data-form=metas] [name=sodio]', '2000'); await p.click('form[data-form=metas] button[type=submit]'); await p.waitForTimeout(100);
  console.log('vigência:', await txt('form[data-form=metas] p.help:last-of-type'));
  await p.fill('form[data-form=metas] [name=kcal]', '1900'); await p.click('form[data-form=metas] button[type=submit]'); await p.waitForTimeout(100);
  const hm = await p.evaluate(() => MeuPrato.dados().config.historicoMetas); console.log('historicoMetas:', JSON.stringify(hm.map(h => [h.desde, h.metas.kcal]))); assert.equal(hm.length, 1); assert.equal(hm[0].metas.kcal, 1900);
  await p.click('.tab[data-tab=hoje]'); assert((await txt('.stat .sub')).includes('de 1.900 kcal'));
  await p.click('[data-act=dia-ant]'); console.log('ontem:', await txt('.stat .sub')); assert((await txt('.stat .sub')).includes('sem meta definida')); // sem vigência ontem
  await p.click('[data-act=ir-hoje]');
  // 2. alimentos com e sem fibra/sódio
  const novo = async (nome, fibra, sodio) => { await p.click('.tab[data-tab=alimentos]'); await p.click('[data-act=novo-alimento]'); await p.fill('[name=nome]', nome); await p.fill('[name=kcal]', '100'); await p.fill('[name=prot]', '5'); await p.fill('[name=carb]', '10'); await p.fill('[name=gord]', '2'); if (fibra !== null) await p.fill('[name=fibra]', fibra); if (sodio !== null) await p.fill('[name=sodio]', sodio); await p.click('form[data-form=alimento] button[type=submit]'); await p.waitForTimeout(80); };
  await novo('Com dados', '3', '200'); await novo('Sem dados', null, null);
  const al = await p.evaluate(() => MeuPrato.dados().alimentos.map(a => [a.nome, a.fibra, a.sodio])); console.log('alimentos:', JSON.stringify(al)); assert.deepEqual(al.find(x => x[0] === 'Sem dados').slice(1), [null, null]);
  await p.click('.tab[data-tab=hoje]');
  for (const q of ['Com dados', 'Sem dados']) { await p.click('[data-act=adicionar][data-idx="1"]'); await p.fill('.sheet .search', q); await p.click('.sheet [data-act=pick-alimento]'); console.log('prévia:', await txt('.sheet .preview .small')); await p.click('.sheet [data-ok]'); await p.waitForTimeout(80); }
  const opc = await txt('.macros.opc'); console.log('linha opcionais:', opc); assert(opc.includes('Fibras 3 g') && opc.includes('dados em 1 de 2') && opc.includes('Sódio 200 mg') && opc.includes('de 2.000'));
  await p.screenshot({ path: SHOT + 'e3-hoje.png' });
  await p.click('[data-act=detalhe][data-n="fibra"]'); await p.waitForSelector('.sheet .corpo'); const det = await txt('.sheet .corpo'); console.log('detalhe fibra:', det.slice(0, 220));
  assert(det.includes('parcial') && det.includes('dados em 1 de 2') && det.includes('não informado')); await p.screenshot({ path: SHOT + 'e3-detalhe.png' }); await p.keyboard.press('Escape');
  // zero continua zero: editar "Sem dados" com fibra 0 e registrar de novo
  await p.click('.tab[data-tab=alimentos]'); await p.click('[data-act=abrir-alimento]:has-text("Sem dados")'); await p.click('.sheet .menu button:has-text("Editar")'); await p.fill('.sheet [name=fibra]', '0'); await p.click('form[data-form=alimento] button[type=submit]'); await p.waitForTimeout(80);
  await p.click('.tab[data-tab=hoje]'); await p.click('[data-act=adicionar][data-idx="2"]'); await p.fill('.sheet .search', 'Sem dados'); await p.click('.sheet [data-act=pick-alimento]'); await p.click('.sheet [data-ok]'); await p.waitForTimeout(80);
  const opc2 = await txt('.macros.opc'); console.log('após zero:', opc2); assert(opc2.includes('Fibras 3 g') && opc2.includes('dados em 2 de 3')); // registro antigo segue desconhecido; o novo tem 0
  // 3. receita: incompletude propaga
  await p.click('.tab[data-tab=alimentos]'); await p.click('[data-act=nova-receita]'); await p.fill('.sheet [name=nome]', 'Receita X');
  for (const q of ['Com dados', 'Sem dados']) { await p.click('.sheet [data-add-ing]'); await p.fill('.sheet .search', q); await p.click('.sheet [data-act=pick]'); await p.click('.sheet [data-ok]'); await p.waitForSelector('.sheet .ing'); }
  await p.click('form[data-form=receita] button[type=submit]'); await p.waitForTimeout(80);
  const rec = await p.evaluate(() => { const r = MeuPrato.dados().receitas[0]; return MeuPrato.calc.nutrientesReceita(r, 1, 'porção'); }); console.log('receita (1 ingrediente com fibra 3, outro com fibra 0 agora):', JSON.stringify(rec));
  assert.equal(rec.fibra, 3); assert.equal(rec.sodio, null); // sódio: "Sem dados" continua null → propaga; fibra: ambos conhecidos (3 + 0)
  // 4. CSV com colunas opcionais e vazio = não informado
  await p.click('.tab[data-tab=config]'); const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act=exportar-csv]')]); const csv = fs.readFileSync(await dl.path(), 'utf8').split('\r\n');
  console.log('csv:', csv[0], '|', csv[1], '|', csv[2]); assert(csv[0].includes('fibra_g;sodio_mg')); assert(csv[2].includes(';;;')); // Sem dados: fibra e sódio vazios
  // 5. histórico: concluído hoje; tabela com denominadores
  await p.click('.tab[data-tab=hoje]'); await p.check('[data-act=concluir]'); await p.click('.tab[data-tab=historico]'); await p.waitForSelector('.tabela');
  const tab = await p.$$eval('.tabela tbody tr', (trs) => trs.map((tr) => tr.innerText.replace(/\s+/g, ' ').trim())); console.log('tabela:', tab.join(' || '));
  assert(tab[0].startsWith('Calorias 300 kcal 1 dia')); assert(tab[4].includes('Fibras – 0 dias')); assert(tab[5].includes('Sódio – 0 dias')); await p.screenshot({ path: SHOT + 'e3-hist.png', fullPage: true });
  // 6. OFF: sódio g→mg; só sal → não informado
  let modo = 'sodio'; await p.route('https://world.openfoodfacts.org/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 1, product: { product_name: 'P', brands: 'M', quantity: '200 g', nutriments: Object.assign({ 'energy-kcal_100g': 50, proteins_100g: 1, carbohydrates_100g: 2, fat_100g: 3, fiber_100g: 1.5 }, modo === 'sodio' ? { sodium_100g: 0.5 } : { salt_100g: 1.25 }) } }) }));
  await p.click('.tab[data-tab=alimentos]'); await p.click('[data-act=ler-codigo]'); await p.fill('.sheet [name=codigo]', '7890000000017'); await p.click('.sheet button[type=submit]'); await p.waitForSelector('form[data-form=alimento]');
  console.log('OFF sódio:', await p.inputValue('[name=sodio]'), 'fibra:', await p.inputValue('[name=fibra]')); assert.equal(await p.inputValue('[name=sodio]'), '500'); await p.keyboard.press('Escape');
  modo = 'sal'; await p.click('[data-act=ler-codigo]'); await p.fill('.sheet [name=codigo]', '7890000000024'); await p.click('.sheet button[type=submit]'); await p.waitForSelector('form[data-form=alimento]');
  console.log('OFF sal:', JSON.stringify(await p.inputValue('[name=sodio]')), '| aviso tem sal:', (await txt('.sheet')).includes('Vem só “sal”')); assert.equal(await p.inputValue('[name=sodio]'), ''); await p.keyboard.press('Escape');
  // 7. validação e persistência
  const v = await p.evaluate(() => [MeuPrato.validar(JSON.parse(localStorage.getItem('meuprato.v1'))).ok, MeuPrato.validar({ versao: 1, alimentos: [], receitas: [], dias: {}, config: { historicoMetas: [{ desde: 'x', metas: {} }] } }).erro, MeuPrato.validar({ versao: 1, alimentos: [{ id: 'a', nome: 'x', refQtd: 100, refUnidade: 'g', kcal: 1, prot: 0, carb: 0, gord: 0, fibra: -1 }], receitas: [], dias: {} }).erro]);
  console.log('validação:', v); assert(v[0] && v[1] && v[2]);
  await p.reload(); assert((await txt('.stat .sub')).includes('de 1.900 kcal'));
  console.log('erros:', erros); assert.equal(erros.length, 0); await b.close(); console.log('OK');
})().catch((e) => { console.error('FALHA', e); process.exit(1); });
