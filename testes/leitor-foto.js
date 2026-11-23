// Leitura por foto ("Tirar foto do código") e dígito verificador. O BarcodeDetector é simulado:
// só "enxerga" o código quando a imagem está girada (código vertical, como num tubo), e devolve
// uma leitura com dígito errado nas outras tentativas, que precisa ser descartada.
const { chromium } = require('playwright');
const assert = require('assert');
const path = require('path');
const { URL, pastaResultados, registrar, encerrar } = require('./_comum');
pastaResultados('leitor-foto');
const CERTO = '7896512924124', ERRADO = '7896512924125';
(async () => {
  const { codigoValido } = await import(require('url').pathToFileURL(path.join(__dirname, '..', 'js', 'leitor.js')).href);
  assert.ok(codigoValido(CERTO)); assert.ok(!codigoValido(ERRADO)); assert.ok(codigoValido('7891000100103')); assert.ok(!codigoValido('12345'));
  console.log('dígito verificador ok');

  const b = registrar(await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }));
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
  await ctx.addInitScript(([certo, errado]) => {
    window.__tentativas = []; window.__aberturas = 0;
    const md = navigator.mediaDevices, real = md.getUserMedia.bind(md); md.getUserMedia = (c) => { window.__aberturas++; return real(c); };
    delete window.ImageCapture; // foto automática fica fora deste roteiro (ver leitor-camera)
    window.BarcodeDetector = class {
      static async getSupportedFormats() { return ['ean_13', 'ean_8']; }
      async detect(src) {
        const w = src.width || src.videoWidth || 0, h = src.height || src.videoHeight || 0;
        window.__tentativas.push(`${w}x${h}`);
        if (window.__cego) return [{ rawValue: errado }];
        if (src instanceof HTMLVideoElement) return [{ rawValue: errado }];           // vídeo: só leitura errada
        return h > w ? [{ rawValue: certo }] : [{ rawValue: errado }];                 // foto: só girada
      }
    };
  }, [CERTO, ERRADO]);
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message));
  let consultas = [];
  await p.route('https://world.openfoodfacts.org/**', (r) => { consultas.push(r.request().url()); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 0 }) }); });
  await p.goto(URL); await p.click('.tab[data-tab=alimentos]'); await p.click('[data-act=ler-codigo]');
  await p.waitForFunction(() => /Vídeo da câmera: \d+×\d+/.test(document.querySelector('.cam-res')?.textContent || ''), null, { timeout: 15000 });
  console.log('resolução:', await p.locator('.cam-res').innerText());
  await p.waitForTimeout(800);
  assert.equal(await p.locator('form[data-form=alimento]').count(), 0, 'leitura com dígito errado no vídeo não pode abrir cadastro');
  assert.equal(consultas.length, 0);
  console.log('vídeo com leitura errada: ignorada');

  // foto paisagem (código vertical na foto): só a tentativa girada lê
  const png = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 800; c.height = 400; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 800, 400); x.fillStyle = '#000'; for (let i = 0; i < 40; i++) x.fillRect(380, 40 + i * 8, 40, 3 + (i % 3)); return c.toDataURL('image/png').split(',')[1]; });
  // foto que não dá leitura: a câmera ao vivo tem que voltar sozinha, com o aviso na tela
  await p.evaluate(() => { window.__cego = true; });
  await p.setInputFiles('[data-foto]', { name: 'ruim.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await p.waitForFunction(() => /Não consegui ler o código na foto\. A câmera voltou/.test(document.querySelector('.cam-msg')?.textContent || ''), null, { timeout: 15000 });
  assert.equal(await p.evaluate(() => window.__aberturas), 2, 'câmera reaberta depois da foto sem leitura');
  assert.ok(await p.evaluate(() => { const v = document.querySelector('.camera video'); return !!v.srcObject && v.srcObject.getVideoTracks()[0].readyState === 'live'; }), 'vídeo ao vivo de volta');
  // foto cancelada no app de câmera: o toque pausa o vídeo e o cancelamento o traz de volta
  await p.evaluate(() => { const i = document.querySelector('[data-foto]'); i.closest('label').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
  await p.waitForFunction(() => !document.querySelector('.camera video').srcObject);
  await p.evaluate(() => document.querySelector('[data-foto]').dispatchEvent(new Event('cancel')));
  await p.waitForFunction(() => window.__aberturas === 3 && document.querySelector('.camera video').srcObject?.getVideoTracks()[0].readyState === 'live', null, { timeout: 15000 });
  assert.equal(await p.locator('form[data-form=alimento]').count(), 0);
  console.log('foto sem leitura e foto cancelada: câmera ao vivo voltou');
  await p.evaluate(() => { window.__cego = false; });
  await p.setInputFiles('[data-foto]', { name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await p.waitForSelector('form[data-form=alimento]', { timeout: 15000 });
  const codigo = await p.inputValue('[name=codigoBarras]');
  console.log('código no cadastro:', codigo, '| consultas OFF:', consultas.length, '| tentativas até ler:', (await p.evaluate(() => window.__tentativas.filter((t) => !t.startsWith('0x')).length)));
  assert.equal(codigo, CERTO); assert.equal(consultas.length, 1); assert.ok(consultas[0].includes(CERTO));
  assert.deepEqual(erros, []);
  console.log('OK');
})().then(() => encerrar(0), (e) => { console.error('FALHA', e); return encerrar(1); });
