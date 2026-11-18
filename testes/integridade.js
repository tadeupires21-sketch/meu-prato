const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { URL, registrar, encerrar } = require('./_comum');

async function testarAbas(browser, usarWebLocks) {
  const contexto = await browser.newContext();
  if (!usarWebLocks) await contexto.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
  const a = await contexto.newPage();
  const b = await contexto.newPage();
  await Promise.all([a.goto(URL), b.goto(URL)]);
  const gravarCopo = (pagina, ml) => pagina.evaluate(async (ml) => {
    const { obterDia } = await import('./js/dominio.js');
    const { salvar, UI } = await import('./js/estado.js');
    obterDia(UI.data).agua.push({ id: String(ml), ml });
    return salvar();
  }, ml);
  const resultados = await Promise.all([gravarCopo(a, 200), gravarCopo(b, 350)]);
  assert.equal(resultados.filter(Boolean).length, 1);
  const desatualizada = resultados[0] ? b : a;
  const vencedora = resultados[0] ? 200 : 350;
  assert.match(await desatualizada.locator('#erro-banner').innerText(), /Outra aba/);
  const lerReal = () => a.evaluate(() => JSON.parse(localStorage.getItem('meuprato.v1')));
  assert.deepEqual(Object.values((await lerReal()).dias)[0].agua.map(x => x.ml), [vencedora]);
  await desatualizada.reload();
  assert.ok(await gravarCopo(desatualizada, 100));
  const real = await lerReal();
  assert.deepEqual(Object.values(real.dias)[0].agua.map(x => x.ml), [vencedora, 100]);

  const alternar = async (p) => {
    await p.click('[data-tab=config]');
    await p.click('[data-act=alternar-demo]');
    await p.waitForSelector('[data-act=agua-mais]');
  };
  await alternar(a);
  const outraDemo = await contexto.newPage();
  await outraDemo.goto(URL);
  assert.ok(await outraDemo.locator('#demo-banner').isVisible());
  await alternar(a);
  assert.ok(await gravarCopo(outraDemo, 500));
  assert.deepEqual(await lerReal(), real);
  await outraDemo.reload();
  assert.ok(await outraDemo.locator('#demo-banner').isVisible());
  await contexto.close();
}

async function testarAgua(browser) {
  const p = await browser.newPage();
  await p.goto(URL);
  await p.locator('[data-act=agua-mais][data-ml="250"]').click();
  await p.waitForSelector('.agua .value:has-text("250 /")');
  await p.click('[data-act=agua-outro]');
  await p.fill('.sheet [name=ml]', '0,4');
  await p.click('.sheet [data-ok]');
  await p.waitForSelector('#toast:has-text("pelo menos 1 ml")');
  await p.fill('.sheet [name=ml]', '0,5');
  await p.click('.sheet [data-ok]');
  await p.waitForSelector('.agua .value:has-text("251 /")');
  await p.click('[data-tab=config]');
  const form = p.locator('[data-form=agua]');
  for (const campo of ['meta', 'copo']) {
    await form.locator('[name=' + campo + ']').fill('0,4');
    await form.locator('button[type=submit]').click();
    await p.reload();
    await p.click('[data-tab=config]');
    assert.equal(await form.locator('[name=meta]').inputValue(), '2000');
    assert.equal(await form.locator('[name=copo]').inputValue(), '250');
  }
  const backup = await p.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('meuprato.v1'));
    d.config.copoAgua = 0;
    Object.values(d.dias)[0].agua.push({ ml: 0 });
    localStorage.setItem('meuprato.v1', JSON.stringify(d));
    return JSON.stringify(d);
  });
  await p.reload();
  await p.waitForSelector('.agua .value:has-text("251 /")');
  assert.equal(await p.evaluate(() => MeuPrato.validar(MeuPrato.dados()).ok), true);
  await p.click('[data-tab=config]');
  p.once('dialog', dialogo => dialogo.accept());
  await p.locator('[data-act=arquivo-json]').setInputFiles({
    name: 'diario-antigo.json', mimeType: 'application/json', buffer: Buffer.from(backup)
  });
  await p.waitForSelector('#toast:has-text("Backup importado")');
  await p.reload();
  await p.waitForSelector('.agua .value:has-text("251 /")');
  await p.close();
}

async function testarBase(browser) {
  const p = await browser.newPage();
  await p.goto(URL);
  const casos = await p.evaluate(async () => {
    const { aplicarBase, estadoBase } = await import('./js/dominio.js');
    const { FONTE_TACO } = await import('./js/alimentos-base.js');
    const d = MeuPrato.dados();
    const resultados = [];
    for (const [fonte, refUnidade] of [['Rótulo', 'porção'], ['Rótulo', 'g'], [FONTE_TACO, 'porção']]) {
      const ovo = { nome: 'Ovo de galinha inteiro, cozido', id: 'ovo', fonte, refQtd: 1, refUnidade,
        medidas: [], kcal: 73, prot: 6, gord: 5, carb: 0 };
      d.alimentos = [ovo];
      const oferta = estadoBase().find(x => x.a === ovo);
      await aplicarBase(new Set(), true);
      resultados.push([oferta.completar, ovo.medidas.length, MeuPrato.calc.nutrientesAlimento(ovo, 1, refUnidade).kcal]);
    }
    return resultados;
  });
  for (const caso of casos) assert.deepEqual(caso, [false, 0, 73]);
  await p.close();
}

(async () => {
  const browser = registrar(await chromium.launch());
  await testarAbas(browser, true);
  await testarAbas(browser, false);
  await testarAgua(browser);
  await testarBase(browser);
})().then(() => encerrar(0), erro => { console.error(erro); return encerrar(1); });
