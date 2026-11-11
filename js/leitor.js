// Tentativas complementares: preserva-se também a leitura do vídeo original.
// Recorte central evita reduzir códigos pequenos junto com toda a cena.
export function prepararQuadro(video, canvas, contraste = false) {
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return video;
  const rw = Math.round(w * 0.7), rh = Math.round(h * 0.7);
  const escala = Math.min(2, 1920 / rw);
  canvas.width = Math.round(rw * escala);
  canvas.height = Math.round(rh * escala);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, (w - rw) / 2, (h - rh) / 2, rw, rh, 0, 0, canvas.width, canvas.height);
  if (contraste) {
    const imagem = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ajustarContraste(imagem.data);
    ctx.putImageData(imagem, 0, 0);
  }
  return canvas;
}

// Percentis evitam que alguns reflexos dominem a faixa de contraste.
export function ajustarContraste(dados) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < dados.length; i += 4) {
    const v = Math.round(0.299 * dados[i] + 0.587 * dados[i + 1] + 0.114 * dados[i + 2]);
    dados[i] = dados[i + 1] = dados[i + 2] = v;
    hist[v]++;
  }
  const n = dados.length / 4;
  const percentil = (p) => { let soma = 0; for (let v = 0; v < 256; v++) { soma += hist[v]; if (soma >= n * p) return v; } return 255; };
  const min = percentil(0.02), max = percentil(0.98);
  if (max - min < 8) return; // Não amplificar ruído de uma imagem quase uniforme.
  for (let i = 0; i < dados.length; i += 4) {
    const v = Math.max(0, Math.min(255, Math.round((dados[i] - min) * 255 / (max - min))));
    dados[i] = dados[i + 1] = dados[i + 2] = v;
  }
}

// Dígito verificador GTIN (EAN-8, UPC-A, EAN-13, GTIN-14): descarta leituras erradas antes de abrir o cadastro.
export function codigoValido(codigo) {
  const c = String(codigo || '');
  if (!/^\d+$/.test(c) || ![8, 12, 13, 14].includes(c.length)) return false;
  let soma = 0;
  for (let i = c.length - 2, peso = 3; i >= 0; i--, peso = peso === 3 ? 1 : 3) soma += Number(c[i]) * peso;
  return (10 - (soma % 10)) % 10 === Number(c[c.length - 1]);
}

// Leitura numa foto (do app de câmera do celular, em resolução total). Tenta a imagem inteira e recortes,
// em pé e girada 90°, com e sem contraste, até achar um código com dígito verificador válido.
// `fonte` é qualquer coisa que o canvas desenha (ImageBitmap, <img>, <video>).
export async function detectarEmImagem(det, fonte, largura, altura, maxLado = 2400) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const regioes = [[0, 0, 1, 1], [0.2, 0.2, 0.6, 0.6], [0.1, 0, 0.8, 1], [0, 0.1, 1, 0.8]];
  for (const girar of [false, true]) {
    for (const [rx, ry, rw, rh] of regioes) {
      for (const contraste of [false, true]) {
        const sx = rx * largura, sy = ry * altura, sw = rw * largura, sh = rh * altura;
        const esc = Math.min(1.5, maxLado / Math.max(sw, sh));
        const w = Math.round(sw * esc), h = Math.round(sh * esc);
        canvas.width = girar ? h : w; canvas.height = girar ? w : h;
        ctx.save();
        if (girar) { ctx.translate(h, 0); ctx.rotate(Math.PI / 2); }
        ctx.drawImage(fonte, sx, sy, sw, sh, 0, 0, w, h);
        ctx.restore();
        if (contraste) { const img = ctx.getImageData(0, 0, canvas.width, canvas.height); ajustarContraste(img.data); ctx.putImageData(img, 0, 0); }
        try {
          const cods = await det.detect(canvas);
          const bom = cods.find((x) => codigoValido(x.rawValue));
          if (bom) return { codigo: bom.rawValue, tentativa: { girar, regiao: [rx, ry, rw, rh], contraste } };
        } catch { /* tenta a próxima */ }
      }
    }
  }
  return null;
}
