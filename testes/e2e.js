const { chromium } = require('playwright');
const assert = require('assert');
const fs = require('fs');
const SHOT = process.argv[2];
const URL = 'http://127.0.0.1:8765/index.html';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR', acceptDownloads: true });
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Ceia' : undefined));
  await p.goto(URL); await p.waitForSelector('.summary');
  const txt = async (sel) => (await p.locator(sel).first().innerText()).replace(/\s+/g, ' ').trim();
  const hoje = await p.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  console.log('abre em:', await txt('h1'), hoje);
  assert.equal(await txt('h1'), 'Hoje');

  // 1. Cadastrar alimento: 200 kcal, 10 g prot por 100 g, com medida "unidade" = 50 g
  await p.click('.tab[data-tab=alimentos]');
  await p.click('[data-act=novo-alimento]');
  await p.fill('[name=nome]', 'Alimento Teste'); await p.click('.sheet summary'); await p.fill('[name=marca]', 'Marca T');
  await p.fill('[name=kcal]', '200'); await p.fill('[name=prot]', '10'); await p.fill('[name=carb]', '20'); await p.fill('[name=gord]', '5');
  await p.fill('[name=mNome]', 'unidade'); await p.fill('[name=mEq]', '50'); await p.click('[data-add-medida]');
  await p.screenshot({ path: SHOT + '/02-form-alimento.png' });
  await p.click('form[data-form=alimento] button[type=submit]');
  await p.waitForTimeout(300); console.log('após submit: toast=', await p.locator('#toast').textContent(), 'sheet=', await p.locator('.sheet').count(), 'alimentos=', await p.evaluate(() => MeuPrato.dados().alimentos.length), 'aba=', await p.evaluate(() => document.querySelector('.tab.active').dataset.tab), await p.evaluate(() => [...document.querySelectorAll('form[data-form=alimento] input, form[data-form=alimento] select')].map(i => i.name + '=' + JSON.stringify(i.value) + (i.validity.valid ? '' : ' INVALIDO')).join(' | ')));
  await p.waitForSelector('.list-item');
  assert((await txt('.list-item')).includes('Alimento Teste'));

  // Unit test dos cálculos via API exposta
  const calc = await p.evaluate(() => { const a = MeuPrato.dados().alimentos[0]; return { g150: MeuPrato.calc.nutrientesAlimento(a, 150, 'g'), un2: MeuPrato.calc.nutrientesAlimento(a, 2, 'unidade'), dec: MeuPrato.calc.nutrientesAlimento(a, 37.5, 'g') }; });
  assert.deepEqual([calc.g150.kcal, calc.g150.prot], [300, 15]); assert.deepEqual([calc.un2.kcal, calc.un2.prot], [200, 10]); assert.equal(calc.dec.kcal, 75);
  console.log('cálculo proporcional ok:', JSON.stringify(calc.g150));
  const semMedida = await p.evaluate(() => { try { MeuPrato.calc.nutrientesAlimento(MeuPrato.dados().alimentos[0], 1, 'colher'); return 'calculou'; } catch (e) { return e.message; } });
  console.log('medida sem equivalência:', semMedida); assert(semMedida.includes('sem equivalência'));

  // 2. Registrar 150 g no almoço (quantidade com vírgula decimal também)
  await p.click('.tab[data-tab=hoje]');
  await p.click('[data-act=adicionar][data-idx="1"]');
  await p.waitForSelector('.sheet .lista');
  await p.click('.sheet [data-act=pick-alimento]');
  await p.fill('.sheet [name=qtd]', '150');
  await p.screenshot({ path: SHOT + '/03-quantidade.png' });
  assert((await txt('.sheet .preview')).startsWith('300 kcal 15 g prot 30 g carb 7,5 g gord'));
  await p.click('.sheet [data-ok]');
  await p.waitForSelector('.entry');
  console.log('almoço:', await txt('.meal[data-idx="1"] .meal-sub'));
  assert((await txt('.meal[data-idx="1"] .meal-sub')).startsWith('300 kcal · P 15'));
  assert((await txt('.stat .value')).startsWith('300'));
  // decimal com vírgula: 1,5 unidade = 75 g = 150 kcal
  await p.click('[data-act=adicionar][data-idx="0"]'); await p.click('.sheet [data-act=pick-alimento]');
  await p.fill('.sheet [name=qtd]', '1,5'); await p.selectOption('.sheet [name=uni]', 'unidade');
  assert.equal((await txt('.sheet .preview')).split(' ')[0], '150'); await p.click('.sheet [data-ok]');
  await p.waitForFunction(() => document.querySelectorAll('.entry').length === 2);
  assert((await txt('.meal[data-idx="0"] .meal-sub')).startsWith('150 kcal · P 7,5'));
  await p.screenshot({ path: SHOT + '/01-hoje.png', fullPage: true });

  // 3. Editar quantidade (150 -> 100) e depois duplicar e excluir
  await p.click('.meal[data-idx="1"] .entry'); await p.click('.sheet .menu button:has-text("Alterar quantidade")');
  await p.fill('.sheet [name=qtd]', '100'); await p.click('.sheet [data-ok]');
  await p.waitForFunction(() => document.querySelector('.meal[data-idx="1"] .meal-sub').textContent.startsWith('200'));
  await p.click('.meal[data-idx="1"] .entry'); await p.click('.sheet .menu button:has-text("Duplicar")');
  await p.waitForFunction(() => document.querySelectorAll('.meal[data-idx="1"] .entry').length === 2);
  assert((await txt('.meal[data-idx="1"] .meal-sub')).startsWith('400 kcal · P 20'));
  await p.click('.meal[data-idx="1"] .entry >> nth=1'); await p.click('.sheet .menu button:has-text("Excluir")');
  await p.waitForFunction(() => document.querySelectorAll('.meal[data-idx="1"] .entry').length === 1);
  console.log('editar/duplicar/excluir ok');

  // 4. Alterar o alimento depois NÃO muda o registro antigo
  await p.click('.tab[data-tab=alimentos]'); await p.click('[data-act=abrir-alimento]'); await p.click('.sheet .menu button:has-text("Editar")');
  await p.fill('.sheet [name=kcal]', '999'); await p.click('form[data-form=alimento] button[type=submit]');
  await p.click('.tab[data-tab=hoje]'); assert((await txt('.meal[data-idx="1"] .meal-sub')).startsWith('200 kcal · P 10'));
  console.log('snapshot preservado após editar alimento ok');

  // 5. Receita: 2 unidades (100 g = 999 kcal agora) + rendimento 2 porções, peso final 200 g
  await p.click('.tab[data-tab=alimentos]'); await p.click('[data-act=nova-receita]');
  await p.fill('.sheet [name=nome]', 'Receita Teste');
  await p.click('.sheet [data-add-ing]'); await p.click('.sheet [data-act=pick]');
  await p.fill('.sheet [name=qtd]', '2'); await p.selectOption('.sheet [name=uni]', 'unidade'); await p.click('.sheet [data-ok]');
  await p.waitForSelector('.sheet .ing');
  assert.equal(await p.inputValue('.sheet [name=nome]'), 'Receita Teste');
  await p.fill('.sheet [name=porcoes]', '2'); await p.fill('.sheet [name=pesoFinal]', '200');
  await p.screenshot({ path: SHOT + '/04-receita.png' });
  await p.click('form[data-form=receita] button[type=submit]');
  const rec = await p.evaluate(() => { const r = MeuPrato.dados().receitas[0]; return { porcao: MeuPrato.calc.nutrientesReceita(r, 1, 'porção'), g50: MeuPrato.calc.nutrientesReceita(r, 50, 'g') }; });
  assert.equal(rec.porcao.kcal, 999 / 2); assert.equal(rec.porcao.prot, 5); assert.equal(rec.g50.kcal, 999 / 4);
  console.log('receita por porção/grama ok:', JSON.stringify(rec));
  // registrar receita no jantar
  await p.click('.tab[data-tab=hoje]'); await p.click('[data-act=adicionar][data-idx="3"]'); await p.click('.sheet .chip[data-f=receitas]'); await p.click('.sheet [data-act=pick-receita]');
  await p.click('.sheet [data-ok]'); await p.waitForFunction(() => document.querySelectorAll('.entry').length === 3);
  assert((await txt('.meal[data-idx="3"] .meal-sub')).startsWith('500 kcal · P 5'));

  // 6. Mudar de data: ontem deve estar vazio; copiar almoço de hoje para ontem; voltar e conferir que hoje não mudou
  await p.click('[data-act=dia-ant]'); assert.equal(await txt('h1'), 'Ontem');
  assert.equal(await p.locator('.entry').count(), 0); assert((await txt('.stat .value')).startsWith('0'));
  await p.click('[data-act=menu-refeicao][data-idx="1"]'); await p.click('.sheet .menu button:has-text("Copiar refeição")');
  await p.fill('.sheet input[type=date]', hoje); await p.dispatchEvent('.sheet input[type=date]', 'change');
  await p.waitForSelector('.sheet .lista .list-item'); await p.click('.sheet .lista .list-item >> nth=0');
  await p.waitForSelector('.sheet .linhas .ing'); await p.click('.sheet [data-ok]'); // prévia editável antes de copiar
  await p.waitForSelector('.entry'); assert.equal(await p.locator('.entry').count(), 1); assert.equal(await p.locator('.meal[data-idx="1"] .entry').count(), 1); // copiou o café de hoje (1 item) para o almoço de ontem
  console.log('ontem após copiar:', await txt('.meal[data-idx="1"] .meal-sub'));
  await p.screenshot({ path: SHOT + '/05-ontem.png', fullPage: true });
  await p.click('[data-act=ir-hoje]'); assert.equal(await p.locator('.entry').count(), 3);
  // nova refeição e concluir dia
  await p.click('[data-act=nova-refeicao]'); await p.waitForSelector('.meal[data-idx="4"]'); assert.equal(await txt('.meal[data-idx="4"] h2'), 'Ceia');
  await p.check('[data-act=concluir]');

  // 7. Persistência: recarregar
  await p.reload(); await p.waitForSelector('.entry');
  assert.equal(await p.locator('.entry').count(), 3); assert((await txt('.meal[data-idx="1"] .meal-sub')).startsWith('200 kcal · P 10'));
  assert(await p.isChecked('[data-act=concluir]'));
  console.log('persistência após recarregar ok');

  // 8. Histórico
  await p.click('.tab[data-tab=historico]'); await p.screenshot({ path: SHOT + '/06-historico.png', fullPage: true });
  const hist = await txt('.card p.help >> nth=1'); console.log('histórico:', hist); assert(hist.startsWith('1 de 7'));

  // 9. Exportar JSON / CSV e importar
  await p.click('.tab[data-tab=config]'); await p.screenshot({ path: SHOT + '/07-config.png', fullPage: true });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act=exportar-json]')]);
  const jsonPath = SHOT + '/backup.json'; await dl.saveAs(jsonPath);
  const backup = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); assert.equal(backup.alimentos.length, 1); assert.equal(backup.receitas.length, 1);
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('[data-act=exportar-csv]')]);
  const csv = fs.readFileSync(await dl2.path(), 'utf8'); console.log('csv linhas:', csv.split('\r\n').length - 1, '|', csv.split('\r\n')[1]);
  assert(csv.includes('Alimento Teste (Marca T)'));
  // apagar tudo, depois importar backup inválido e válido
  await p.click('[data-act=apagar-tudo]'); await p.click('.tab[data-tab=hoje]'); assert.equal(await p.locator('.entry').count(), 0);
  await p.click('.tab[data-tab=config]');
  const alertas = []; p.removeAllListeners('dialog'); p.on('dialog', (d) => { alertas.push(d.type() + ': ' + d.message().slice(0, 60)); d.accept(); });
  await p.setInputFiles('[data-act=arquivo-json]', { name: 'ruim.json', mimeType: 'application/json', buffer: Buffer.from('{"versao":1,"alimentos":"x"}') });
  await p.waitForTimeout(200);
  await p.setInputFiles('[data-act=arquivo-json]', jsonPath); await p.waitForTimeout(300);
  console.log('diálogos import:', alertas);
  assert(alertas[0].startsWith('alert: Backup inválido')); assert(alertas[1].startsWith('confirm: Backup: 1 alimentos'));
  await p.click('.tab[data-tab=hoje]'); assert.equal(await p.locator('.entry').count(), 3);
  console.log('import/export ok');

  // 10. Modo demonstração isolado
  await p.click('.tab[data-tab=config]'); await p.click('[data-act=alternar-demo]'); await p.waitForSelector('#demo-banner:not([hidden])');
  assert.equal(await p.locator('.entry').count(), 0); // hoje vazio no demo
  await p.click('.tab[data-tab=historico]'); console.log('demo histórico:', await txt('.card p.help >> nth=1'));
  await p.screenshot({ path: SHOT + '/08-demo-historico.png', fullPage: true });
  await p.click('.tab[data-tab=config]'); await p.click('[data-act=alternar-demo]'); await p.click('.tab[data-tab=hoje]');
  assert.equal(await p.locator('.entry').count(), 3); assert(await p.locator('#demo-banner').isHidden());
  console.log('demo isolado ok');

  // 11. Metas
  await p.click('.tab[data-tab=config]'); await p.fill('form[data-form=metas] [name=kcal]', '1800'); await p.fill('form[data-form=metas] [name=prot]', '130,5');
  await p.click('form[data-form=metas] button[type=submit]'); await p.click('.tab[data-tab=hoje]');
  assert((await txt('.stat .sub')).includes('de 1.800 kcal')); assert((await txt('.stat.prot .sub')).includes('de 130,5 g'));

  // PWA
  const man = await (await p.request.get('http://127.0.0.1:8765/manifest.webmanifest')).json(); assert.equal(man.display, 'standalone');
  const sw = await p.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state || (await navigator.serviceWorker.ready).active.state);
  console.log('service worker:', sw, '| erros de console:', erros.length ? erros : 'nenhum');
  assert.equal(erros.length, 0);
  await b.close(); console.log('TODOS OS TESTES PASSARAM');
})().catch((e) => { console.error('FALHA:', e); process.exit(1); });
