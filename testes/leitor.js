const assert = require('node:assert/strict');
(async () => {
  const { criarConfirmacaoLeitura, ajustarContraste, prepararQuadro } = await import('../js/leitor.js');
  const a = '7891234567895', b = '4006381333931';
  const c = criarConfirmacaoLeitura();
  assert.equal(c.observar(a), null);
  assert.equal(c.observar(b), null);
  assert.equal(c.observar(b), b);
  assert.equal(c.observar(b), null); // nunca confirma duas vezes
  const vazio = criarConfirmacaoLeitura();
  vazio.observar(a); vazio.observar(null);
  assert.equal(vazio.observar(a), null);
  assert.equal(vazio.observar(a), a);
  const fechada = criarConfirmacaoLeitura();
  fechada.observar(a); fechada.cancelar();
  assert.equal(fechada.observar(a), null); // resultado pendente após fechar
  const pixels = new Uint8ClampedArray([110,110,110,255,140,140,140,255]);
  ajustarContraste(pixels);
  assert.deepEqual([...pixels], [0,0,0,255,255,255,255,255]);
  const uniforme = new Uint8ClampedArray([120,120,120,255,122,122,122,255]);
  ajustarContraste(uniforme);
  assert.equal(uniforme[0],120); assert.equal(uniforme[4],122);
  const video = {videoWidth:1920,videoHeight:1080}; let args;
  const canvas = {getContext: () => ({drawImage: (...a) => {args=a;}})};
  assert.equal(prepararQuadro(video,canvas),canvas);
  assert.equal(canvas.width,1920);
  assert.equal(args[3],1344); assert.equal(args[4],756);
  assert.equal(prepararQuadro({videoWidth:0},canvas).videoWidth,0);
  console.log('OK: contraste baixo, ruído uniforme, recorte em resolução limitada e vídeo sem quadro');
})().catch(e => {console.error(e); process.exitCode=1;});
