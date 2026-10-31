const { chromium } = require('playwright'); const assert = require('assert');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const erros = []; p.on('pageerror', (e) => { erros.push(e.message); console.log('PAGEERROR', e.stack.split('\n').slice(0, 2).join(' <- ')); }); p.on('dialog', (d) => d.accept());
  const txt = async (sel) => (await p.locator(sel).first().innerText()).replace(/\s+/g, ' ').trim();
  const SHOT = '/tmp/claude-0/-home-user/31289882-dc9d-5eca-88d1-67be19cd3d3b/scratchpad/';
  await p.goto('http://127.0.0.1:8765/index.html');
  // 1. lista vazia: seletor oferece a base; importação seletiva de 2 itens
  await p.click('[data-act=adicionar][data-idx="1"]'); await p.waitForTimeout(250); assert.equal(await p.locator('.sheet [data-act=pick-base]').count(), 1);
  await p.click('.sheet [data-act=pick-base]'); await p.waitForSelector('.sheet .lista label');
  console.log('botão inicial:', await txt('.sheet [data-ok]')); assert.equal(await txt('.sheet [data-ok]'), 'Adicionar 93 alimentos');
  await p.click('.sheet [data-nenhum]'); assert.equal(await txt('.sheet [data-ok]'), 'Nada selecionado');
  await p.fill('.sheet .search', 'tilapia'); const n = await p.locator('.sheet .lista label').count(); console.log('filtro tilapia:', n, '|', await txt('.sheet .lista label'));
  await p.check('.sheet input[data-nome="Tilápia, filé, cru"]'); await p.fill('.sheet .search', 'arroz branco'); await p.check('.sheet input[data-nome="Arroz branco tipo 1, cozido"]');
  assert.equal(await txt('.sheet [data-ok]'), 'Adicionar 2 alimentos'); await p.screenshot({ path: SHOT + 'r3-import.png' }); await p.click('.sheet [data-ok]'); await p.waitForSelector('.list-item');
  const al = await p.evaluate(() => MeuPrato.dados().alimentos.map(a => a.nome)); console.log('importados:', al); assert.equal(al.length, 2);
  console.log('voltou ao seletor da refeição:', await txt('.sheet .resumo-refeicao')); await p.keyboard.press('Escape');
  // reabrir: já cadastrados aparecem marcados e desabilitados
  await p.click('.tab[data-tab=config]'); await p.click('[data-act=importar-base]'); await p.waitForSelector('.sheet .lista label'); await p.fill('.sheet .search', 'arroz branco');
  console.log('já cadastrado:', await txt('.sheet .lista label')); assert((await txt('.sheet .lista label')).includes('já cadastrado')); assert(await p.locator('.sheet input[data-nome="Arroz branco tipo 1, cozido"]').isDisabled()); await p.keyboard.press('Escape');
  // 2. cadastro por porção do rótulo: 150 kcal / 7 g prot por porção de 30 g → 60 g = 300 kcal
  await p.click('.tab[data-tab=alimentos]'); await p.click('[data-act=novo-alimento]'); await p.fill('[name=nome]', 'Barra X');
  console.log('base inicial:', await txt('.sheet .base-txt'), '| refQtd readonly:', await p.evaluate(() => document.querySelector('[name=refQtd]').readOnly));
  await p.click('.sheet .chip[data-base=porcao]'); assert.equal(await p.inputValue('[name=refQtd]'), ''); await p.fill('[name=refQtd]', '30');
  console.log('base porção:', await txt('.sheet .base-txt'), '| opção criar medida visível:', await p.locator('.sheet .opt-porcao').isVisible());
  await p.fill('[name=kcal]', '150'); await p.fill('[name=prot]', '7'); await p.fill('[name=carb]', '20'); await p.fill('[name=gord]', '5'); await p.screenshot({ path: SHOT + 'r3-form.png', fullPage: true });
  await p.click('form[data-form=alimento] button[type=submit]'); await p.waitForTimeout(100);
  const barra = await p.evaluate(() => { const a = MeuPrato.dados().alimentos.find(x => x.nome === 'Barra X'); return { refQtd: a.refQtd, medidas: a.medidas, g60: MeuPrato.calc.nutrientesAlimento(a, 60, 'g'), p1: MeuPrato.calc.nutrientesAlimento(a, 1, 'porção do rótulo') }; });
  console.log('barra:', JSON.stringify(barra)); assert.equal(barra.refQtd, 30); assert.equal(barra.g60.kcal, 300); assert.equal(barra.p1.prot, 7);
  // editar: base detectada como porção; marca dentro de "mais opções"
  await p.click('[data-act=abrir-alimento]:has-text("Barra X")'); await p.click('.sheet .menu button:has-text("Editar")');
  console.log('chip ativo na edição:', await txt('.sheet .base-chips .chip.active'), '| details aberto:', await p.evaluate(() => document.querySelector('.sheet details').open));
  await p.evaluate(() => { document.querySelector('.sheet details').open = true; }); await p.fill('[name=marca]', 'Marca Z'); await p.click('form[data-form=alimento] button[type=submit]'); await p.waitForTimeout(100);
  assert.equal(await p.evaluate(() => MeuPrato.dados().alimentos.find(x => x.nome === 'Barra X').marca), 'Marca Z'); await p.keyboard.press('Escape');
  // 3. frequência por refeição: arroz 2× no almoço em dias diferentes → badge nos recentes do almoço, não no jantar
  await p.evaluate(() => { const D = MeuPrato.dados(); const a = D.alimentos.find(x => x.nome.startsWith('Arroz')); const t = D.alimentos.find(x => x.nome.startsWith('Tilápia')); const hoje = MeuPrato.ui.data; const d = (iso) => `${iso}`; const ontem = (() => { const x = new Date(hoje + 'T12:00:00'); x.setDate(x.getDate() - 1); return x.toISOString().slice(0, 10); })();
    const item = (al) => ({ id: Math.random().toString(36).slice(2), tipo: 'alimento', refId: al.id, rotulo: al.nome, qtd: 100, unidade: 'g', kcal: al.kcal, prot: al.prot, carb: al.carb, gord: al.gord, fibra: al.fibra, sodio: al.sodio, criadoEm: new Date().toISOString() });
    const dia = (arr) => ({ refeicoes: ['Café da manhã', 'Almoço', 'Lanche', 'Jantar'].map((n, i) => ({ id: n, nome: n, itens: i === 1 ? arr.map(item) : [] })), concluido: false, agua: [] });
    D.dias[ontem] = dia([a, t]); D.dias[hoje] = dia([a]); D.recentes = [{ tipo: 'alimento', id: t.id, em: Date.now() }, { tipo: 'alimento', id: a.id, em: Date.now() - 1000 }]; localStorage.setItem('meuprato.v1', JSON.stringify(D)); });
  await p.reload(); await p.click('[data-act=adicionar][data-idx="1"]'); await p.waitForSelector('.sheet .lista .list-item');
  const rec = await p.$$eval('.sheet .lista .list-item', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()).slice(0, 2)); console.log('recentes almoço:', rec);
  assert(rec[0].startsWith('Arroz') && rec[0].includes('2× no almoço')); assert(rec[1].includes('1× no almoço')); await p.screenshot({ path: SHOT + 'r3-recentes.png' }); await p.keyboard.press('Escape');
  await p.click('[data-act=adicionar][data-idx="3"]'); await p.waitForSelector('.sheet .lista .list-item'); const recJ = await txt('.sheet .lista .list-item'); console.log('recentes jantar:', recJ); assert(!recJ.includes('×')); await p.keyboard.press('Escape');
  console.log('erros:', erros); assert.equal(erros.length, 0); await b.close(); console.log('OK');
})().catch((e) => { console.error('FALHA', e); process.exit(1); });
