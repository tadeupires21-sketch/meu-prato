const { chromium } = require('playwright'); const assert = require('assert');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const erros = []; p.on('pageerror', (e) => erros.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto('http://127.0.0.1:8765/index.html'); const txt = async (sel) => (await p.locator(sel).first().innerText()).replace(/\s+/g, ' ').trim();
  console.log('inicial:', await txt('.agua .value'));
  await p.click('[data-act=agua-mais][data-ml="250"]'); await p.click('[data-act=agua-mais][data-ml="500"]');
  console.log('após 250+500:', await txt('.agua .value'), '|', await txt('.agua .small:not(.label)'));
  assert((await txt('.agua .value')).startsWith('750'));
  await p.click('[data-act=agua-outro]'); await p.fill('.sheet [name=ml]', '350'); await p.click('.sheet [data-ok]'); await p.waitForTimeout(100);
  assert((await txt('.agua .value')).startsWith('1.100'));
  await p.click('[data-act=agua-desfazer]'); assert((await txt('.agua .value')).startsWith('750'));
  const nivel = await p.evaluate(() => document.querySelector('.copo .onda').style.transform); console.log('nível do copo (750/2000):', nivel);
  // ontem não mistura
  await p.click('[data-act=dia-ant]'); assert((await txt('.agua .value')).startsWith('0')); await p.click('[data-act=ir-hoje]');
  // meta e copo em ajustes
  await p.click('.tab[data-tab=config]'); await p.fill('form[data-form=agua] [name=meta]', '2500'); await p.fill('form[data-form=agua] [name=copo]', '300'); await p.click('form[data-form=agua] button[type=submit]');
  await p.click('.tab[data-tab=hoje]'); console.log('após ajustes:', await txt('.agua .value'), '|', await txt('.agua .small:not(.label)'), '| botão:', await txt('[data-act=agua-mais]'));
  assert((await txt('.agua .value')).includes('2.500'));
  // além da meta: linguagem neutra
  await p.click('[data-act=agua-outro]'); await p.fill('.sheet [name=ml]', '2000'); await p.click('.sheet [data-ok]'); await p.waitForTimeout(100);
  console.log('acima:', await txt('.agua .small:not(.label)'));
  await p.screenshot({ path: '/tmp/claude-0/-home-user/31289882-dc9d-5eca-88d1-67be19cd3d3b/scratchpad/agua.png' });
  await p.reload(); assert((await txt('.agua .value')).startsWith('2.750'));
  await p.click('.tab[data-tab=historico]'); console.log('histórico:', await txt('.hist-row'));
  console.log('erros:', erros); assert.equal(erros.length, 0); await b.close(); console.log('OK');
})().catch((e) => { console.error(e); process.exit(1); });
