const { chromium } = require('playwright'); const assert = require('assert');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const erros = []; p.on('pageerror', (e) => { erros.push(e.message); console.log('PAGEERROR', e.stack.split('\n').slice(0, 3).join(' <- ')); }); const prompts = []; p.on('dialog', (d) => { if (d.type() === 'prompt') { prompts.push(d.message()); d.accept('Meu café'); } else d.accept(); });
  const txt = async (sel) => (await p.locator(sel).first().innerText()).replace(/\s+/g, ' ').trim();
  const SHOT = '/tmp/claude-0/-home-user/31289882-dc9d-5eca-88d1-67be19cd3d3b/scratchpad/';
  await p.goto('http://127.0.0.1:8765/index.html'); await p.click('.tab[data-tab=config]'); await p.click('[data-act=importar-base]'); await p.waitForSelector('.list-item'); await p.click('.tab[data-tab=hoje]');
  // 1. seleção em lote: 3 itens, revisar, desmarcar 1, alterar quantidade, confirmar
  await p.click('[data-act=adicionar][data-idx="1"]'); await p.click('.sheet [data-lote]');
  for (const q of ['arroz branco', 'feijao carioca', 'frango']) { await p.fill('.sheet .search', q); await p.click('.sheet [data-act=pick-alimento]'); }
  console.log('barra lote:', await txt('.sheet [data-revisar]')); assert.equal(await txt('.sheet [data-revisar]'), 'Revisar 3 itens');
  await p.fill('.sheet .search', ''); await p.click('.sheet .chip[data-f=todos]'); console.log('marcados visíveis:', await p.locator('.sheet .marca.on').count()); assert.equal(await p.locator('.sheet .marca.on').count(), 3);
  // rascunho sobrevive ao cadastro de alimento novo
  await p.fill('.sheet .search', 'Tapioca'); await p.click('.sheet [data-act=pick-novo]'); await p.waitForSelector('form[data-form=alimento]');
  await p.fill('[name=kcal]', '240'); await p.fill('[name=prot]', '0'); await p.fill('[name=carb]', '59'); await p.fill('[name=gord]', '0'); await p.click('form[data-form=alimento] button[type=submit]'); await p.waitForTimeout(150); console.log('pós-submit: toast=', await p.locator('#toast').textContent(), 'sheet=', await p.locator('.sheet').count(), 'form=', await p.locator('form[data-form=alimento]').count(), 'alimentos=', await p.evaluate(() => MeuPrato.dados().alimentos.length));
  await p.waitForSelector('.sheet [data-revisar]'); console.log('após novo alimento:', await txt('.sheet [data-revisar]')); assert.equal(await txt('.sheet [data-revisar]'), 'Revisar 4 itens');
  await p.click('.sheet [data-revisar]'); await p.waitForSelector('.sheet .linhas .ing'); await p.screenshot({ path: SHOT + 'e2-revisar.png' });
  await p.uncheck('.sheet [data-sel="3"]'); await p.fill('.sheet [data-q="0"]', '200'); await p.dispatchEvent('.sheet [data-q="0"]', 'change');
  console.log('botão:', await txt('.sheet [data-ok]'), '| total:', await txt('.sheet .total .preview')); assert((await txt('.sheet [data-ok]')).startsWith('Adicionar 3 itens em Almoço'));
  await p.click('.sheet [data-ok]'); await p.waitForFunction(() => document.querySelectorAll('.meal[data-idx="1"] .entry').length === 3);
  console.log('almoço:', await txt('.meal[data-idx="1"] .meal-sub'), '| 1º item:', await txt('.meal[data-idx="1"] .entry .qty')); assert.equal(await txt('.meal[data-idx="1"] .entry .qty'), '200 g');
  // desfazer lote inteiro
  await p.click('#toast .toast-acao'); await p.waitForFunction(() => document.querySelectorAll('.meal[data-idx="1"] .entry').length === 0); console.log('desfazer lote ok');
  // registrar de novo (sem toque duplo): refazer rápido
  await p.click('[data-act=adicionar][data-idx="1"]'); await p.click('.sheet [data-lote]'); for (const q of ['arroz branco', 'frango']) { await p.fill('.sheet .search', q); await p.click('.sheet [data-act=pick-alimento]'); }
  await p.click('.sheet [data-revisar]'); await p.waitForSelector('.sheet [data-ok]'); await p.click('.sheet [data-ok]'); await p.click('.sheet [data-ok]').catch(() => {}); await p.waitForTimeout(150);
  assert.equal(await p.locator('.meal[data-idx="1"] .entry').count(), 2); console.log('sem duplicar por toque repetido ok; última porção do arroz:', await p.evaluate(() => { const D = MeuPrato.dados(); const a = D.alimentos.find(x => x.nome.startsWith('Arroz branco')); return D.porcoes['alimento:' + a.id]; }));
  // 2. salvar como combinação; aplicar via seletor com prévia; cadastro editado reflete; excluído usa snapshot
  await p.click('[data-act=menu-refeicao][data-idx="1"]'); await p.click('.sheet .menu button:has-text("Salvar como combinação")'); await p.waitForTimeout(100);
  console.log('prompt:', prompts[prompts.length - 1], '| combos:', await p.evaluate(() => MeuPrato.dados().combinacoes.map(c => c.nome + ':' + c.itens.length)));
  await p.evaluate(() => { const D = MeuPrato.dados(); const a = D.alimentos.find(x => x.nome.startsWith('Arroz branco')); a.kcal = 1000; localStorage.setItem('meuprato.v1', JSON.stringify(D)); }); await p.reload();
  await p.click('[data-act=adicionar][data-idx="3"]'); await p.click('.sheet .chip[data-f=combinacoes]'); console.log('lista combos:', await txt('.sheet .lista'));
  await p.click('.sheet [data-act=pick-combo]'); await p.click('.sheet .menu button:has-text("Usar nesta refeição")'); await p.waitForSelector('.sheet .linhas .ing');
  console.log('prévia com cadastro novo:', await txt('.sheet .linhas .ing >> nth=0')); assert((await txt('.sheet .linhas .ing >> nth=0')).includes('2.000 kcal'));
  await p.click('.sheet [data-ok]'); await p.waitForFunction(() => document.querySelectorAll('.meal[data-idx="3"] .entry').length === 2);
  assert((await txt('.meal[data-idx="1"] .entry .nums')).startsWith('256 kcal')); // histórico intacto
  await p.evaluate(() => { const D = MeuPrato.dados(); D.alimentos = D.alimentos.filter(x => !x.nome.startsWith('Arroz branco')); localStorage.setItem('meuprato.v1', JSON.stringify(D)); }); await p.reload();
  await p.click('[data-act=adicionar][data-idx="2"]'); await p.click('.sheet .chip[data-f=combinacoes]'); await p.click('.sheet [data-act=pick-combo]'); await p.click('.sheet .menu button:has-text("Usar nesta refeição")'); await p.waitForSelector('.sheet .linhas .ing');
  console.log('cadastro excluído:', await txt('.sheet .linhas .ing >> nth=0')); assert((await txt('.sheet .linhas')).includes('cadastro excluído')); await p.keyboard.press('Escape');
  // 3. repetir última: ontem vazio → hoje tem almoço → em "amanhã" o atalho aparece e preserva valores
  await p.click('[data-act=dia-prox]'); console.log('amanhã:', await txt('h1'), '| datas com registro:', await p.evaluate(() => Object.entries(MeuPrato.dados().dias).map(([d, x]) => d + ':' + x.refeicoes.map(r => r.itens.length).join('/')).join(' ')), '| itens almoço:', await p.locator('.meal[data-idx="1"] .entry').count()); assert.equal(await p.locator('.meal[data-idx="1"] .entry').count(), 0);
  console.log('atalho repetir visível:', await p.locator('[data-act=repetir][data-idx="1"]').count());
  await p.click('[data-act=repetir][data-idx="1"]'); await p.waitForSelector('.sheet .linhas .ing'); console.log('repetir título:', await txt('.sheet h2'), '|', await txt('.sheet .linhas .ing >> nth=0'));
  assert((await txt('.sheet .linhas .ing >> nth=0')).includes('256 kcal')); // valor histórico, não 2.000
  await p.fill('.sheet [data-q="0"]', '300'); await p.dispatchEvent('.sheet [data-q="0"]', 'change'); console.log('escalado:', await txt('.sheet .linhas .ing >> nth=0'));
  assert((await txt('.sheet .linhas .ing >> nth=0')).includes('384 kcal'));
  await p.click('.sheet [data-ok]'); await p.waitForFunction(() => document.querySelectorAll('.meal[data-idx="1"] .entry').length === 2);
  await p.click('[data-act=dia-ant]'); assert.equal(await p.locator('.meal[data-idx="1"] .entry').count(), 2); // hoje não mudou
  // 4. combinações na aba Alimentos: renomear e excluir; backup valida
  await p.click('.tab[data-tab=alimentos]'); await p.click('[data-act=filtro-alimentos][data-f=combinacoes]'); console.log('aba combos:', await txt('.list-item .name'));
  const v = await p.evaluate(() => [MeuPrato.validar(JSON.parse(localStorage.getItem('meuprato.v1'))).ok, MeuPrato.validar({ versao: 1, alimentos: [], receitas: [], dias: {}, combinacoes: [{ id: 'c', nome: 'x', itens: [] }] }).erro]); console.log('validação:', v); assert(v[0] && v[1]);
  console.log('combos antes:', await p.evaluate(() => MeuPrato.dados().combinacoes.map(c => c.nome))); await p.click('[data-act=abrir-combinacao]'); console.log('menu:', await txt('.sheet .menu')); await p.click('.sheet .menu button:has-text("Excluir")'); await p.waitForTimeout(100); console.log('combos depois:', await p.evaluate(() => MeuPrato.dados().combinacoes.map(c => c.nome))); assert.equal(await p.evaluate(() => MeuPrato.dados().combinacoes.length), 0);
  console.log('erros:', erros); assert.equal(erros.length, 0); await b.close(); console.log('OK');
})().catch((e) => { console.error('FALHA', e); process.exit(1); });
