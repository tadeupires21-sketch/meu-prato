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
