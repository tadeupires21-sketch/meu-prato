import { NUTR_OBRIG, NUTR_OPC } from './nutrientes.js';

// ---------- Cálculos ----------
// Unidades disponíveis para um alimento: a unidade de referência + medidas caseiras cadastradas.
export function unidadesAlimento(a) { return [{ nome: a.refUnidade, fator: 1 }, ...a.medidas.map((m) => ({ nome: m.nome, fator: m.equivale }))]; }
// Nutrientes de "qtd" na unidade "unidade" de um alimento. Proporcional à quantidade de referência.
export function nutrientesAlimento(a, qtd, unidade) {
  const u = unidadesAlimento(a).find((x) => x.nome === unidade);
  if (!u) throw new Error(`Medida "${unidade}" sem equivalência cadastrada para ${a.nome}`);
  const fator = (qtd * u.fator) / a.refQtd;
  return escalar(a, fator);
}
// Multiplica os nutrientes de um objeto por um fator; opcionais desconhecidos (null/undefined) continuam null.
export function escalar(o, f) { const r = {}; for (const k of NUTR_OBRIG) r[k] = (o[k] || 0) * f; for (const k of NUTR_OPC) r[k] = o[k] == null ? null : o[k] * f; return r; }
// Soma uma lista de nutrientes. Opcionais: soma só o conhecido e informa cobertura em `cob[k] = { conhecidos, total }`.
export function somar(lista) {
  const s = { kcal: 0, prot: 0, carb: 0, gord: 0, fibra: 0, sodio: 0, cob: {} };
  for (const k of NUTR_OPC) s.cob[k] = { conhecidos: 0, total: lista.length };
  for (const n of lista) { for (const k of NUTR_OBRIG) s[k] += n[k] || 0; for (const k of NUTR_OPC) if (n[k] != null) { s[k] += n[k]; s.cob[k].conhecidos++; } }
  return s;
}
// Resultado de somar() convertido em "nutrientes de um item": opcional só é conhecido se todos os componentes eram.
export function fecharSoma(s) { const r = {}; for (const k of NUTR_OBRIG) r[k] = s[k]; for (const k of NUTR_OPC) r[k] = s.cob[k].total > 0 && s.cob[k].conhecidos === s.cob[k].total ? s[k] : null; return r; }
// Receita: totais calculados dos ingredientes. Usa o alimento atual se existir; senão o snapshot do ingrediente.
export function totaisReceita(r, alimentos) {
  return somar(r.ingredientes.map((ing) => {
    const a = alimentos.find((x) => x.id === ing.alimentoId);
    if (a) { try { return nutrientesAlimento(a, ing.qtd, ing.unidade); } catch { /* medida removida: usa snapshot */ } }
    return escalar(ing, 1);
  }));
}
export function unidadesReceita(r) { const u = [{ nome: 'porção', fator: null }]; if (r.pesoFinal > 0) u.push({ nome: 'g', fator: null }); return u; }
export function nutrientesReceita(r, qtd, unidade, alimentos) {
  const t = totaisReceita(r, alimentos);
  let f;
  if (unidade === 'porção') f = qtd / r.porcoes;
  else if (unidade === 'g' && r.pesoFinal > 0) f = qtd / r.pesoFinal;
  else throw new Error('Unidade inválida para receita');
  return escalar(fecharSoma(t), f); // incompletude dos ingredientes se propaga: fibra/sódio só se todos informaram
}
export function rotuloAlimento(a) { return a.marca ? `${a.nome} (${a.marca})` : a.nome; }
