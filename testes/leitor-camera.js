// Câmera ao vivo: escolha de câmera traseira com foco automático, botão "Trocar câmera" (lembrado no
// aparelho) e foto automática em resolução total quando o vídeo não lê. Câmeras, capacidades, foto e
// BarcodeDetector são simulados: verifica o fluxo do app, não a nitidez de uma câmera real.
const { chromium } = require('playwright');
const assert = require('assert');
const { URL, pastaResultados, registrar, encerrar } = require('./_comum');
pastaResultados('leitor-camera');
const CERTO = '7896512924124', ERRADO = '7896512924125';
(async () => {
  const { camerasTraseiras, semFocoAutomatico } = await import('../js/leitor.js');
  const lista = [{ kind: 'videoinput', deviceId: 'a', label: 'camera2 1, facing front' }, { kind: 'videoinput', deviceId: 'b', label: 'camera2 0, facing back' }, { kind: 'audioinput', deviceId: 'm', label: 'mic' }, { kind: 'videoinput', deviceId: '', label: '' }];
  assert.deepEqual(camerasTraseiras(lista).map((d) => d.deviceId), ['b']);
  assert.deepEqual(camerasTraseiras([{ kind: 'videoinput', deviceId: 'w', label: 'Webcam' }]).map((d) => d.deviceId), ['w']);
  assert.ok(semFocoAutomatico({ focusMode: ['manual'] })); assert.ok(semFocoAutomatico({ focusMode: [] }));
  assert.ok(!semFocoAutomatico({ focusMode: ['manual', 'continuous'] })); assert.ok(!semFocoAutomatico({})); assert.ok(!semFocoAutomatico(undefined));
  console.log('seleção de câmeras e foco: ok');

  const b = registrar(await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }));
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
  // Três câmeras: "larga" (traseira, foco fixo, a que o navegador entrega por padrão), "principal"
  // (traseira, foco contínuo) e "frontal". A foto automática tem 1000×500; o detector só lê nela.
  await ctx.addInitScript(([certo, errado]) => {
    window.__pedidos = []; window.__fotos = 0;
    const md = navigator.mediaDevices, real = md.getUserMedia.bind(md);
    md.enumerateDevices = async () => [
      { kind: 'videoinput', deviceId: 'larga', label: 'camera2 2, facing back' },
      { kind: 'videoinput', deviceId: 'principal', label: 'camera2 0, facing back' },
      { kind: 'videoinput', deviceId: 'frontal', label: 'camera2 1, facing front' }];
    md.getUserMedia = async (c) => {
      const id = c.video.deviceId ? c.video.deviceId.exact : 'larga';
      window.__pedidos.push(c.video.deviceId ? id : 'padrão');
      const s = await real({ video: true });
      s.getVideoTracks()[0].__id = id; return s;
    };
    const P = MediaStreamTrack.prototype, gs = P.getSettings;
    P.getSettings = function () { return { ...gs.call(this), deviceId: this.__id }; };
    P.getCapabilities = function () { return { focusMode: this.__id === 'principal' ? ['manual', 'continuous'] : ['manual'] }; };
    P.applyConstraints = async () => {};
    window.ImageCapture = class {
      constructor(t) { this.t = t; }
      async takePhoto() { window.__fotos++; const c = document.createElement('canvas'); c.width = 1000; c.height = 500; c.getContext('2d').fillRect(0, 0, 10, 10); return new Promise((ok) => c.toBlob(ok, 'image/png')); }
    };
    window.BarcodeDetector = class {
      static async getSupportedFormats() { return ['ean_13', 'ean_8']; }
      async detect(src) {
        if (window.__lerFoto && !(src instanceof HTMLVideoElement) && src.width === 1500 && src.height === 750) return [{ rawValue: certo }];
        return [{ rawValue: errado }];
      }
    };
  }, [CERTO, ERRADO]);
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message));
  const consultas = [];
  await p.route('https://world.openfoodfacts.org/**', (r) => { consultas.push(r.request().url()); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 0 }) }); });
  const abrir = async () => { await p.click('.tab[data-tab=alimentos]'); await p.click('[data-act=ler-codigo]'); await p.waitForSelector('[data-trocar-camera]', { timeout: 15000 }); };
  await p.goto(URL); await abrir();

  // 1. A câmera padrão é de foco fixo: o app procura e fica na que tem foco contínuo, e lembra dela.
  assert.deepEqual(await p.evaluate(() => window.__pedidos), ['padrão', 'principal']);
  assert.equal(await p.evaluate(() => localStorage.getItem('meuprato.camera')), 'principal');
  assert.match(await p.locator('[data-trocar-camera]').innerText(), /Trocar câmera \(2\/2\)/); // frontal fora da lista
  console.log('câmera de foco fixo trocada sozinha pela de foco contínuo');

  // 2. Trocar câmera manualmente: abre a outra traseira e passa a lembrar dela.
  await p.click('[data-trocar-camera]');
  await p.waitForFunction(() => /\(1\/2\)/.test(document.querySelector('[data-trocar-camera]')?.textContent || ''), null, { timeout: 15000 });
  assert.deepEqual(await p.evaluate(() => window.__pedidos), ['padrão', 'principal', 'larga']);
  assert.equal(await p.evaluate(() => localStorage.getItem('meuprato.camera')), 'larga');
  await p.click('[data-trocar-camera]');
  await p.waitForFunction(() => /\(2\/2\)/.test(document.querySelector('[data-trocar-camera]')?.textContent || ''), null, { timeout: 15000 });
  console.log('troca manual lembrada');

  // 3. Reabrir usa direto a câmera lembrada, sem procurar de novo.
  await p.keyboard.press('Escape'); await p.reload(); await p.evaluate(() => { window.__pedidos = []; }); await abrir();
  assert.deepEqual(await p.evaluate(() => window.__pedidos), ['principal']);
  console.log('câmera lembrada reaberta direto');

  // 4. Vídeo só dá leitura errada: nada abre. Depois de alguns segundos o app fotografa em resolução
  // total e lê o código na foto.
  await p.waitForFunction(() => /Foto automática: 1000×500/.test(document.querySelector('.cam-res')?.textContent || ''), null, { timeout: 15000 });
  assert.equal(await p.locator('form[data-form=alimento]').count(), 0, 'foto sem código legível não pode abrir cadastro');
  await p.evaluate(() => { window.__lerFoto = true; });
  await p.waitForSelector('form[data-form=alimento]', { timeout: 15000 });
  assert.equal(await p.inputValue('[name=codigoBarras]'), CERTO);
  assert.equal(consultas.length, 1); assert.ok(consultas[0].includes(CERTO));
  const fotos = await p.evaluate(() => window.__fotos); await p.waitForTimeout(3500);
  assert.equal(await p.evaluate(() => window.__fotos), fotos, 'depois de ler, a câmera para de fotografar');
  console.log('foto automática leu o código; fotos tiradas:', fotos);
  assert.deepEqual(erros, []);
  console.log('OK');
})().then(() => encerrar(0), (e) => { console.error('FALHA', e); return encerrar(1); });
