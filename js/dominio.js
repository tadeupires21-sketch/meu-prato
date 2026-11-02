import { METAS_VAZIAS, NUTR_OBRIG, NUTR_OPC } from './nutrientes.js';
import { ALIMENTOS_BASE, FONTE_TACO } from './alimentos-base.js';
import { hojeISO, somarDias, uid } from './util.js';
import { toast } from './dom.js';
import { escalar, nutrientesAlimento, nutrientesReceita, rotuloAlimento, somar } from './calculos.js';
import { D, salvar } from './estado.js';

// ---------- Dias e refeições ----------
export function obterDia(iso, criar = true) {
  let dia = D.dias[iso];
  if (!dia && criar) { dia = { refeicoes: D.config.refeicoesPadrao.map((n) => ({ id: uid(), nome: n, itens: [] })), concluido: false, agua: [] }; D.dias[iso] = dia; }
  return dia;
}
export function diaTemRegistro(dia) { return !!dia && dia.refeicoes.some((r) => r.itens.length > 0); }
// Metas vigentes numa data: o último registro com desde <= data. Sem registro anterior, não há referência (tudo null).
export function metasEm(iso) {
  const h = D.config.historicoMetas || []; let m = null;
  for (const x of h) if (x.desde <= iso) m = x.metas; else break;
  return m ? { ...METAS_VAZIAS(), ...m } : METAS_VAZIAS();
}
export function temAlgumaMeta(m) { return Object.values(m).some((v) => v != null && v > 0); }
export function aguaDia(dia) { return dia && Array.isArray(dia.agua) ? dia.agua.reduce((t, a) => t + a.ml, 0) : 0; }
export function totaisDia(dia) { return somar(dia ? dia.refeicoes.flatMap((r) => r.itens) : []); }
// Quantas vezes cada alimento/receita entrou numa refeição com este nome nos últimos 60 dias (sugestão explicável).
export function frequenciaPorRefeicao(nomeRefeicao, dias = 60) {
  const limite = somarDias(hojeISO(), -dias); const cont = new Map();
  for (const [data, dia] of Object.entries(D.dias)) { if (data < limite) continue; for (const r of dia.refeicoes) if (r.nome === nomeRefeicao) for (const it of r.itens) { const k = `${it.tipo}:${it.refId}`; cont.set(k, (cont.get(k) || 0) + 1); } }
  return cont;
}
export function registrarRecente(tipo, id) {
  D.recentes = [{ tipo, id, em: Date.now() }, ...D.recentes.filter((x) => !(x.tipo === tipo && x.id === id))].slice(0, 30);
}
// Última porção usada por alimento/receita: preferência, separada do diário. Por modo (real/demo), já que D é por modo.
export function lembrarPorcao(tipo, id, qtd, unidade) { D.porcoes[`${tipo}:${id}`] = { qtd, unidade, em: new Date().toISOString() }; }
export function ultimaPorcao(tipo, id) { return D.porcoes[`${tipo}:${id}`] || null; }

// ---------- Tela: Histórico ----------
// Resumo de um período de n dias terminando em `fim`: médias só de dias concluídos, com denominadores explícitos.
export function resumoPeriodo(fim, n) {
  const r = { n, concl: 0, comRef: 0, soAgua: 0, semReg: 0, comAgua: 0, soma: { kcal: 0, prot: 0, carb: 0, gord: 0, fibra: 0, sodio: 0, agua: 0 }, completos: { fibra: 0, sodio: 0 }, linhas: [] };
  for (let i = 0; i < n; i++) {
    const iso = somarDias(fim, -i); const dia = D.dias[iso]; const tem = diaTemRegistro(dia); const t = totaisDia(dia); const ml = aguaDia(dia);
    if (!tem && !ml) r.semReg++; else if (!tem) r.soAgua++;
    if (dia && dia.concluido && (tem || ml)) {
      r.concl++;
      if (tem) { r.comRef++; for (const k of NUTR_OBRIG) r.soma[k] += t[k]; for (const k of NUTR_OPC) if (t.cob[k].conhecidos === t.cob[k].total) { r.soma[k] += t[k]; r.completos[k]++; } }
      if (ml) { r.comAgua++; r.soma.agua += ml; }
    }
    r.linhas.push({ iso, dia, tem, t, ml, m: metasEm(iso) });
  }
  r.media = (k) => k === 'agua' ? (r.comAgua ? r.soma.agua / r.comAgua : null) : NUTR_OPC.includes(k) ? (r.completos[k] ? r.soma[k] / r.completos[k] : null) : (r.comRef ? r.soma[k] / r.comRef : null);
  r.denom = (k) => k === 'agua' ? r.comAgua : NUTR_OPC.includes(k) ? r.completos[k] : r.comRef;
  return r;
}
// ----- Revisão de vários itens antes de registrar (lote, combinação, cópia) -----
// linhas: [{ tipo, refId, rotulo, qtd, unidade, kcal, prot, carb, gord, historico }]
//  - historico=true: valores do registro antigo, escalados pela quantidade (nunca recalculados do cadastro).
//  - senão: recalcula do cadastro atual; se o cadastro sumiu, usa o snapshot da linha escalado e avisa.
export function calcularLinha(l, q) {
  if (!l.historico) {
    const ref = l.tipo === 'alimento' ? D.alimentos.find((a) => a.id === l.refId) : D.receitas.find((r) => r.id === l.refId);
    if (ref) { try { return { ...(l.tipo === 'alimento' ? nutrientesAlimento(ref, q, l.unidade) : nutrientesReceita(ref, q, l.unidade, D.alimentos)), rotulo: l.tipo === 'alimento' ? rotuloAlimento(ref) : ref.nome, fonte: 'cadastro' }; } catch { /* medida sumiu: cai no snapshot */ } }
  }
  const f = q / l.qtd; return { ...escalar(l, f), rotulo: l.rotulo, fonte: l.historico ? 'historico' : 'snapshot' };
}
// ----- Combinações (conjuntos de consumos independentes; não são receitas) -----
export function linhasDeItens(itens, historico) { return itens.map((it) => ({ tipo: it.tipo, refId: it.refId, rotulo: it.rotulo, qtd: it.qtd, unidade: it.unidade, ...escalar(it, 1), historico })); }
// Última ocorrência anterior de uma refeição com o mesmo nome e itens.
export function ultimaRefeicaoAnterior(nome, antesDe) {
  const datas = Object.keys(D.dias).filter((d) => d < antesDe).sort().reverse();
  for (const d of datas) { const r = D.dias[d].refeicoes.find((x) => x.nome === nome && x.itens.length); if (r) return { data: d, refeicao: r }; }
  return null;
}
// ---------- Alimentos comuns (TACO) ----------
// Estado de cada item da lista embutida em relação ao cadastro atual.
export function estadoBase() {
  const porNome = new Map(D.alimentos.map((a) => [a.nome.toLowerCase(), a]));
  const mesmaFonte = (a, b) => (a.fonte || '') === (b.fonte || FONTE_TACO);
  return ALIMENTOS_BASE.map((b) => {
    const a = porNome.get(b.nome.toLowerCase());
    const completarMed = !!(a && b.medidas && !a.medidas.length);
    const completarOpc = !!(a && mesmaFonte(a, b) && NUTR_OPC.some((k) => a[k] == null && b[k] != null));
    return { b, a, novo: !a, completar: completarMed || completarOpc, completarMed, completarOpc };
  });
}
export function aplicarBase(escolhidos, completarTambem) {
  const est = estadoBase(); let n = 0, c = 0;
  for (const e of est) {
    if (e.novo && escolhidos.has(e.b.nome)) {
      const b = e.b; D.alimentos.push({ id: uid(), nome: b.nome, marca: '', estado: b.estado, refQtd: 100, refUnidade: b.refUnidade || 'g', kcal: b.kcal, prot: b.prot, carb: b.carb, gord: b.gord, fibra: b.fibra ?? null, sodio: b.sodio ?? null, medidas: (b.medidas || []).map((m) => ({ ...m })), favorito: false, fonte: b.fonte || FONTE_TACO, obs: b.obs || '', criadoEm: new Date().toISOString() }); n++;
    } else if (!e.novo && completarTambem && e.completar) {
      if (e.completarMed) { e.a.medidas = e.b.medidas.map((m) => ({ ...m })); if (!e.a.obs) e.a.obs = e.b.obs || ''; }
      if (e.completarOpc) for (const k of NUTR_OPC) if (e.a[k] == null && e.b[k] != null) e.a[k] = e.b[k];
      c++;
    }
  }
  D.alimentos.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
  if (salvar()) toast(`${n} adicionado(s)${c ? `, ${c} completado(s)` : ''}.`);
  return n + c;
}
