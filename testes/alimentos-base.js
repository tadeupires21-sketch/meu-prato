const { chromium } = require('playwright'); const assert = require('assert');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const erros = []; p.on('pageerror', (e) => erros.push(e.message)); p.on('dialog', (d) => { console.log(d.type(), '|', d.message().replace(/\n/g, ' / ').slice(0, 400)); d.accept(); });
  await p.goto('http://127.0.0.1:8765/index.html');
  // simula usuário que já importou os 5 antigos sem medidas
  await p.evaluate(() => { const D = MeuPrato.dados(); D.alimentos.push({ id: 'x1', nome: 'Ovo de galinha inteiro, cozido', marca: '', estado: 'cozido', refQtd: 100, refUnidade: 'g', kcal: 146, prot: 13.3, carb: 0.6, gord: 9.5, medidas: [], favorito: false, fonte: 'TACO 4ª ed. (NEPA/Unicamp)' }); D.alimentos.push({ id: 'x2', nome: 'Arroz branco tipo 1, cozido', marca: '', estado: 'cozido', refQtd: 100, refUnidade: 'g', kcal: 128, prot: 2.5, carb: 28.1, gord: 0.2, fibra: null, sodio: null, medidas: [], favorito: false, fonte: 'TACO 4ª ed. (NEPA/Unicamp)' }); localStorage.setItem('meuprato.v1', JSON.stringify(D)); });
  await p.reload(); await p.click('.tab[data-tab=config]'); await p.click('[data-act=importar-base]'); await p.waitForSelector('.sheet [data-ok]'); await p.click('.sheet [data-ok]'); await p.waitForSelector('.list-item');
  const d = await p.evaluate(() => { const D = MeuPrato.dados(); const ovo = D.alimentos.find(a => a.nome.startsWith('Ovo')); const ban = D.alimentos.find(a => a.nome.startsWith('Banana prata')); return { n: D.alimentos.length, ovoMed: ovo.medidas, ovo1: MeuPrato.calc.nutrientesAlimento(ovo, 1, 'unidade'), ban1: MeuPrato.calc.nutrientesAlimento(ban, 1, 'unidade'), maca: D.alimentos.find(a => a.nome.startsWith('Maçã')).medidas, leite: (() => { const l = D.alimentos.find(a => a.nome.startsWith('Leite')); return [l.refUnidade, MeuPrato.calc.nutrientesAlimento(l, 200, 'ml').kcal]; })(), pao: MeuPrato.calc.nutrientesAlimento(D.alimentos.find(a => a.nome === 'Pão francês'), 1, 'unidade').kcal }; });
  const arroz = await p.evaluate(() => { const a = MeuPrato.dados().alimentos.find(x => x.nome.startsWith('Arroz branco')); return [a.fibra, a.sodio, a.kcal]; }); console.log('arroz completado (fibra, sódio, kcal):', arroz); assert.deepEqual(arroz, [1.6, 1, 128]);
  console.log(JSON.stringify(d)); assert.equal(d.n, await p.evaluate(() => 89)); assert.equal(d.ovo1.kcal, 73); assert.equal(d.ban1.kcal, 63.7); assert.equal(d.maca.length, 0);
  // modelo whey
  await p.click('.tab[data-tab=config]'); await p.click('[data-act=modelo]'); await p.waitForSelector('.sheet form');
  console.log('whey nome:', await p.inputValue('.sheet [name=nome]'), '| ref:', await p.inputValue('.sheet [name=refQtd]'), '| medidas:', await p.locator('.sheet .medidas .ing').innerText());
  await p.fill('.sheet [name=kcal]', '120'); await p.fill('.sheet [name=prot]', '24'); await p.fill('.sheet [name=carb]', '3'); await p.fill('.sheet [name=gord]', '2');
  await p.click('form[data-form=alimento] button[type=submit]'); await p.waitForTimeout(150);
  const w = await p.evaluate(() => { const a = MeuPrato.dados().alimentos.find(a => a.nome === 'Whey protein'); return { fonte: a.fonte, s: MeuPrato.calc.nutrientesAlimento(a, 1, 'scoop') }; });
  console.log('whey 1 scoop:', JSON.stringify(w)); assert.equal(w.s.prot, 24); assert.equal(w.fonte, undefined);
  // obs visível ao editar ovo
  await p.click('.tab[data-tab=alimentos]'); await p.click('[data-act=abrir-alimento]:has-text("Ovo")'); await p.click('.sheet .menu button:has-text("Editar")');
  console.log('obs:', await p.locator('.sheet p.help').nth(1).innerText());
  console.log('erros:', erros); assert.equal(erros.length, 0); await b.close(); console.log('OK');
})().catch((e) => { console.error(e); process.exit(1); });
