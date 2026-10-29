const { chromium } = require('playwright'); const assert = require('assert');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const erros = []; p.on('pageerror', (e) => erros.push(e.message)); p.on('dialog', (d) => d.accept());
  let chamadas = 0, modo = 'ok';
  await p.route('https://world.openfoodfacts.org/**', (route) => {
    chamadas++;
    if (modo === '503') return route.fulfill({ status: 503, body: 'down' });
    if (modo === '404') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 0 }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 1, product: { product_name: 'Iogurte Natural', brands: 'Marca Y, Grupo Z', quantity: '170 g', serving_size: '170 g', nutriments: { 'energy-kcal_100g': 60, proteins_100g: 4.2, carbohydrates_100g: 5.1, fat_100g: 3 } } }) });
  });
  await p.goto('http://127.0.0.1:8765/index.html');
  console.log('leitor nativo no headless:', await p.evaluate(() => 'BarcodeDetector' in window));
  // 1. fluxo pela refeição: código novo → OFF → formulário → salvar → quantidade → registro
  await p.click('[data-act=adicionar][data-idx="0"]'); await p.click('.sheet [data-act=pick-codigo]');
  await p.fill('.sheet [name=codigo]', '7891234567895'); await p.click('.sheet button[type=submit]');
  await p.waitForSelector('form[data-form=alimento]');
  console.log('form:', await p.inputValue('[name=nome]'), '|', await p.inputValue('[name=marca]'), '|', await p.inputValue('[name=kcal]'), '|', await p.inputValue('[name=codigoBarras]'), '| medidas:', (await p.locator('.medidas').innerText()).replace(/\n/g,' '));
  console.log('aviso:', await p.locator('.sheet p.help').nth(1).innerText());
  assert.equal(await p.inputValue('[name=marca]'), 'Marca Y');
  await p.click('form[data-form=alimento] button[type=submit]'); await p.waitForSelector('.sheet [name=qtd]');
  await p.selectOption('.sheet [name=uni]', 'porção do rótulo'); await p.fill('.sheet [name=qtd]', '1');
  console.log('prévia 1 porção:', await p.locator('.sheet .preview').innerText().then(t => t.replace(/\n/g,' ')));
  await p.click('.sheet [data-ok]'); await p.waitForSelector('.entry');
  const a = await p.evaluate(() => MeuPrato.dados().alimentos[0]); console.log('salvo:', a.fonte, a.codigoBarras, a.kcal); assert.equal(a.fonte, 'Open Food Facts'); assert.equal(a.codigoBarras, '7891234567895');
  assert.equal(chamadas, 1);
  // 2. mesmo código: reconhece sem consultar
  await p.click('[data-act=adicionar][data-idx="1"]'); await p.click('.sheet [data-act=pick-codigo]');
  await p.fill('.sheet [name=codigo]', '7891234567895'); await p.click('.sheet button[type=submit]'); await p.waitForSelector('.sheet [name=qtd]');
  console.log('reconhecido, chamadas OFF:', chamadas); assert.equal(chamadas, 1); await p.keyboard.press('Escape');
  // 3. não encontrado → formulário só com código
  modo = '404'; await p.click('.tab[data-tab=alimentos]'); await p.click('[data-act=ler-codigo]');
  await p.fill('.sheet [name=codigo]', '7890000000017'); await p.click('.sheet button[type=submit]'); await p.waitForSelector('form[data-form=alimento]');
  console.log('404 → nome vazio:', JSON.stringify(await p.inputValue('[name=nome]')), 'código:', await p.inputValue('[name=codigoBarras]'), 'toast:', await p.locator('#toast').textContent()); await p.keyboard.press('Escape');
  // 4. 503 duas vezes → fallback manual
  modo = '503'; const antes = chamadas; await p.click('[data-act=ler-codigo]'); await p.fill('.sheet [name=codigo]', '7890000000024'); await p.click('.sheet button[type=submit]'); await p.waitForSelector('form[data-form=alimento]');
  console.log('503 → tentativas:', chamadas - antes, 'toast:', await p.locator('#toast').textContent()); assert.equal(chamadas - antes, 2); await p.keyboard.press('Escape');
  // 5. desligar consulta
  await p.click('.tab[data-tab=config]'); await p.uncheck('[data-act=toggle-off]'); modo = 'ok'; const antes2 = chamadas;
  await p.click('.tab[data-tab=alimentos]'); await p.click('[data-act=ler-codigo]'); await p.fill('.sheet [name=codigo]', '7890000000031'); await p.click('.sheet button[type=submit]'); await p.waitForSelector('form[data-form=alimento]');
  console.log('desligado → chamadas:', chamadas - antes2, 'toast:', await p.locator('#toast').textContent()); assert.equal(chamadas - antes2, 0); await p.keyboard.press('Escape');
  // 6. código inválido
  await p.click('[data-act=ler-codigo]'); await p.fill('.sheet [name=codigo]', '123'); await p.click('.sheet button[type=submit]'); await p.waitForTimeout(100); console.log('curto:', await p.locator('#toast').textContent());
  await p.reload(); assert.equal(await p.evaluate(() => MeuPrato.dados().config.consultarOFF), false);
  console.log('erros:', erros); assert.equal(erros.length, 0); await b.close(); console.log('OK');
})().catch((e) => { console.error(e); process.exit(1); });
