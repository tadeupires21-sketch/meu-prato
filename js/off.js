import { fmt, num } from './util.js';

// ---------- Código de barras ----------
// Leitor: BarcodeDetector nativo (Chrome Android). Sem ele, só digitação. Consulta: Open Food Facts,
// base colaborativa; o que vem de lá entra no formulário para conferência, nunca é salvo direto.
export const FONTE_OFF = 'Open Food Facts';
export const temLeitor = () => 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;
export function normalizarCodigo(c) { return String(c || '').replace(/\D/g, ''); }
export async function consultarOFF(codigo) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${codigo}.json?fields=product_name,product_name_pt,brands,quantity,serving_size,nutriments`;
  let ultimoErro;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(url, { signal: ctrl.signal, headers: { 'Accept': 'application/json' } }); clearTimeout(t);
      if (r.status === 404) return { achou: false };
      if (!r.ok) { ultimoErro = new Error(`HTTP ${r.status}`); continue; }
      const j = await r.json();
      if (j.status !== 1 || !j.product) return { achou: false };
      return { achou: true, produto: j.product };
    } catch (e) { ultimoErro = e; }
  }
  throw ultimoErro || new Error('falha na consulta');
}
// Converte o registro do OFF nos campos do formulário. Só por 100 g/ml; kJ vira kcal (÷4,184) se faltar kcal.
export function mapearOFF(p, codigo) {
  const n = p.nutriments || {};
  const num100 = (k) => { const v = n[k]; return typeof v === 'number' && isFinite(v) ? v : (typeof v === 'string' && v.trim() !== '' && isFinite(Number(v)) ? Number(v) : ''); };
  let kcal = num100('energy-kcal_100g');
  if (kcal === '' && num100('energy-kj_100g') !== '') kcal = Math.round(num100('energy-kj_100g') / 4.184);
  if (kcal === '' && num100('energy_100g') !== '') kcal = Math.round(num100('energy_100g') / 4.184);
  // A base (100 g ou 100 ml) vem inferida do texto da embalagem; é só um palpite que o usuário confere.
  const qtdTxt = p.quantity || '';
  const liquido = /\b(ml|l|litros?)\b/i.test(qtdTxt) && !/\b(g|kg|gramas?)\b/i.test(qtdTxt);
  const refUnidade = liquido ? 'ml' : 'g';
  const avisoBase = qtdTxt ? ` Base assumida: 100 ${refUnidade} (embalagem "${qtdTxt}"); se o rótulo informar por 100 ${refUnidade === 'g' ? 'ml' : 'g'}, troque a unidade.` : ' Base assumida: 100 g; confira se o rótulo não é por 100 ml.';
  const medidas = [];
  const m = /([\d.,]+)\s*(g|ml)/i.exec(p.serving_size || '');
  if (m && m[2].toLowerCase() === refUnidade) { const q = num(m[1]); if (q > 0) medidas.push({ nome: 'porção do rótulo', equivale: q }); }
  const faltando = ['kcal', 'prot', 'carb', 'gord'].filter((k, i) => [kcal, num100('proteins_100g'), num100('carbohydrates_100g'), num100('fat_100g')][i] === '');
  // Opcionais: fibra em g; sódio no OFF vem em g → mg, convertido uma única vez aqui. "Sal" não é sódio: não converte.
  const fibra = num100('fiber_100g') === '' ? null : num100('fiber_100g');
  const sodio = num100('sodium_100g') === '' ? null : Math.round(num100('sodium_100g') * 1000);
  const avisoSal = sodio === null && num100('salt_100g') !== '' ? ` Vem só “sal” (${fmt(num100('salt_100g'), 2)} g/100 ${refUnidade}); sódio ficou como não informado.` : '';
  return {
    nome: (p.product_name_pt || p.product_name || '').trim(), marca: (p.brands || '').split(',')[0].trim(), refQtd: 100, refUnidade,
    kcal, prot: num100('proteins_100g'), carb: num100('carbohydrates_100g'), gord: num100('fat_100g'), fibra, sodio, medidas,
    codigoBarras: codigo, fonte: FONTE_OFF,
    obs: `Dados do ${FONTE_OFF} (base colaborativa): confira com o rótulo antes de salvar.${faltando.length ? ` Faltou no cadastro deles: ${faltando.join(', ')}.` : ''}${p.serving_size ? ` Porção informada: ${p.serving_size}.` : ''}${avisoBase}${avisoSal}`,
  };
}
