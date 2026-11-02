import { METAS_VAZIAS, NUTR, NUTR_OBRIG, NUTR_OPC } from './nutrientes.js';
import { hojeISO } from './util.js';
import { mostrarBannerErro, toast } from './dom.js';
import { semearDemo } from './demo.js';

// ---------- Armazenamento ----------
export const CHAVE_REAL = 'meuprato.v1';
export const CHAVE_DEMO = 'meuprato.demo.v1';
export const CHAVE_MODO = 'meuprato.modo';
export const VERSAO_DADOS = 1;
export const REFEICOES_PADRAO = ['Café da manhã', 'Almoço', 'Lanche', 'Jantar'];
export function dadosVazios() {
  return {
    versao: VERSAO_DADOS,
    config: { metas: METAS_VAZIAS(), historicoMetas: [], refeicoesPadrao: [...REFEICOES_PADRAO], consultarOFF: true, metaAgua: 2000, copoAgua: 250 },
    alimentos: [], receitas: [], dias: {}, recentes: [], porcoes: {}, combinacoes: []
  };
}
export function modoDemo() { try { return localStorage.getItem(CHAVE_MODO) === 'demo'; } catch { return false; } }
export function chaveAtual() { return modoDemo() ? CHAVE_DEMO : CHAVE_REAL; }

export const UI = { aba: 'hoje', data: hojeISO(), filtroAlimentos: 'todos', buscaAlimentos: '', histDias: 7, falhaSalvar: null, dadosCorrompidos: null };
// Documento de dados do modo atual. Outros módulos leem `D`; trocar o documento inteiro é só via definirD().
export let D = null;
export function definirD(novo) { D = novo; return D; }
export function carregar() {
  let bruto = null;
  try { bruto = localStorage.getItem(chaveAtual()); } catch { /* sem acesso */ }
  if (!bruto) {
    const novo = dadosVazios();
    if (modoDemo()) semearDemo(novo);
    return novo;
  }
  let erro = null;
  try {
    const obj = JSON.parse(bruto);
    const v = validarDados(obj);
    if (v.ok) return normalizar(obj);
    erro = v.erro;
  } catch (e) { erro = 'falha ao ler: ' + e.message; }
  // Conteúdo inválido: guarda o original à parte (nunca sobrescreve) e começa vazio, avisando.
  console.warn('Dados locais inválidos:', erro);
  try { if (!localStorage.getItem(chaveAtual() + '.corrompido')) localStorage.setItem(chaveAtual() + '.corrompido', bruto); } catch { /* sem espaço: o original continua na chave principal até a próxima gravação */ }
  UI.dadosCorrompidos = { erro, tamanho: bruto.length };
  return dadosVazios();
}
export function brutoCorrompido() { try { return localStorage.getItem(chaveAtual() + '.corrompido'); } catch { return null; } }
// Retorna true só se gravou. Em falha, mostra banner persistente e bloqueia toasts de sucesso por alguns segundos,
// para o aviso de erro não ser coberto por "salvo com sucesso" de quem chamou.
export function salvar() {
  try {
    localStorage.setItem(chaveAtual(), JSON.stringify(D));
    if (UI.falhaSalvar) { UI.falhaSalvar = null; mostrarBannerErro(); }
    return true;
  } catch (e) {
    console.error(e);
    UI.falhaSalvar = 'A última alteração NÃO foi salva (armazenamento cheio ou bloqueado). Exporte um backup em Ajustes antes de continuar.';
    mostrarBannerErro(); toast('Não foi possível salvar.', { erro: true });
    return false;
  }
}
export function normalizar(obj) {
  const base = dadosVazios();
  obj.config = Object.assign(base.config, obj.config || {});
  obj.config.metas = Object.assign(base.config.metas, obj.config.metas || {});
  for (const k of NUTR_OPC) if (obj.config.metas[k] === undefined) obj.config.metas[k] = null;
  // Vigência das metas: quem já tinha metas antes deste recurso recebe um registro "desde sempre", marcado como
  // anterior à vigência (não é inferência de valor: é a meta que estava em uso de fato).
  if (!Array.isArray(obj.config.historicoMetas)) obj.config.historicoMetas = [];
  if (!obj.config.historicoMetas.length && Object.values(obj.config.metas).some((v) => v != null)) obj.config.historicoMetas.push({ desde: '1970-01-01', metas: { ...obj.config.metas }, origem: 'anterior ao registro de vigência' });
  obj.config.historicoMetas.sort((a, b) => a.desde.localeCompare(b.desde));
  if (typeof obj.config.consultarOFF !== 'boolean') obj.config.consultarOFF = true;
  if (!(obj.config.metaAgua > 0)) obj.config.metaAgua = 2000;
  if (!(obj.config.copoAgua > 0)) obj.config.copoAgua = 250;
  for (const dia of Object.values(obj.dias)) if (!Array.isArray(dia.agua)) dia.agua = [];
  if (!Array.isArray(obj.config.refeicoesPadrao) || !obj.config.refeicoesPadrao.length) obj.config.refeicoesPadrao = [...REFEICOES_PADRAO];
  obj.alimentos = obj.alimentos || []; obj.receitas = obj.receitas || []; obj.dias = obj.dias || {}; obj.recentes = obj.recentes || []; obj.porcoes = obj.porcoes || {}; obj.combinacoes = obj.combinacoes || [];
  for (const a of obj.alimentos) { a.medidas = a.medidas || []; a.favorito = !!a.favorito; }
  for (const r of obj.receitas) { r.ingredientes = r.ingredientes || []; r.favorito = !!r.favorito; }
  return obj;
}
export function ehNum(v) { return typeof v === 'number' && isFinite(v); }
export function ehNumNaoNeg(v) { return ehNum(v) && v >= 0; }
export function ehObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
// Valida estrutura e regras de domínio antes de aceitar dados (do armazenamento ou de um backup).
// Campos novos são opcionais, para backups antigos continuarem válidos.
export function validarDados(obj) {
  if (!ehObj(obj)) return { ok: false, erro: 'não é um objeto JSON' };
  if (typeof obj.versao !== 'number') return { ok: false, erro: 'campo "versao" ausente' };
  if (obj.versao > VERSAO_DADOS) return { ok: false, erro: `versão ${obj.versao} é mais nova que a do app (${VERSAO_DADOS})` };
  if (!Array.isArray(obj.alimentos)) return { ok: false, erro: '"alimentos" deve ser uma lista' };
  if (!Array.isArray(obj.receitas)) return { ok: false, erro: '"receitas" deve ser uma lista' };
  if (!ehObj(obj.dias)) return { ok: false, erro: '"dias" deve ser um objeto por data' };
  if (obj.config !== undefined) {
    if (!ehObj(obj.config)) return { ok: false, erro: '"config" inválida' };
    const m = obj.config.metas;
    if (m !== undefined) {
      if (!ehObj(m)) return { ok: false, erro: 'metas inválidas' };
      for (const k of NUTR.map((n) => n.k)) if (m[k] != null && !ehNumNaoNeg(m[k])) return { ok: false, erro: `meta de ${k} inválida` };
    }
    if (obj.config.historicoMetas !== undefined) {
      if (!Array.isArray(obj.config.historicoMetas)) return { ok: false, erro: 'histórico de metas inválido' };
      for (const h of obj.config.historicoMetas) { if (!ehObj(h) || !/^\d{4}-\d{2}-\d{2}$/.test(h.desde) || !ehObj(h.metas)) return { ok: false, erro: 'vigência de meta inválida' }; for (const k of Object.keys(h.metas)) if (h.metas[k] != null && !ehNumNaoNeg(h.metas[k])) return { ok: false, erro: `vigência com ${k} inválido` }; }
    }
    for (const k of ['metaAgua', 'copoAgua']) if (obj.config[k] !== undefined && !(ehNum(obj.config[k]) && obj.config[k] > 0)) return { ok: false, erro: `${k} inválida` };
    if (obj.config.refeicoesPadrao !== undefined && (!Array.isArray(obj.config.refeicoesPadrao) || obj.config.refeicoesPadrao.some((n) => typeof n !== 'string'))) return { ok: false, erro: 'refeições padrão inválidas' };
  }
  const ids = new Set();
  const validarMedidas = (med, dono) => {
    if (med === undefined) return null;
    if (!Array.isArray(med)) return `medidas de "${dono}" devem ser lista`;
    for (const x of med) if (!ehObj(x) || typeof x.nome !== 'string' || !x.nome.trim() || !(ehNum(x.equivale) && x.equivale > 0)) return `medida inválida em "${dono}"`;
    return null;
  };
  for (const a of obj.alimentos) {
    if (!ehObj(a) || typeof a.id !== 'string' || !a.id) return { ok: false, erro: 'alimento sem id' };
    if (ids.has(a.id)) return { ok: false, erro: `id repetido: ${a.id}` }; ids.add(a.id);
    if (typeof a.nome !== 'string' || !a.nome.trim()) return { ok: false, erro: `alimento ${a.id} sem nome` };
    if (!(ehNum(a.refQtd) && a.refQtd > 0)) return { ok: false, erro: `alimento "${a.nome}" com quantidade de referência inválida` };
    if (!['g', 'ml', 'porção'].includes(a.refUnidade)) return { ok: false, erro: `alimento "${a.nome}" com unidade de referência inválida` };
    for (const k of NUTR_OBRIG) if (!ehNumNaoNeg(a[k])) return { ok: false, erro: `alimento "${a.nome}" com ${k} inválido` };
    for (const k of NUTR_OPC) if (a[k] != null && !ehNumNaoNeg(a[k])) return { ok: false, erro: `alimento "${a.nome}" com ${k} inválido` };
    const em = validarMedidas(a.medidas, a.nome); if (em) return { ok: false, erro: em };
  }
  for (const r of obj.receitas) {
    if (!ehObj(r) || typeof r.id !== 'string' || !r.id) return { ok: false, erro: 'receita sem id' };
    if (ids.has(r.id)) return { ok: false, erro: `id repetido: ${r.id}` }; ids.add(r.id);
    if (typeof r.nome !== 'string' || !r.nome.trim()) return { ok: false, erro: `receita ${r.id} sem nome` };
    if (!(ehNum(r.porcoes) && r.porcoes > 0)) return { ok: false, erro: `receita "${r.nome}" sem rendimento válido` };
    if (r.pesoFinal != null && !(ehNum(r.pesoFinal) && r.pesoFinal > 0)) return { ok: false, erro: `receita "${r.nome}" com peso final inválido` };
    if (!Array.isArray(r.ingredientes)) return { ok: false, erro: `receita "${r.nome}" sem lista de ingredientes` };
    for (const ing of r.ingredientes) {
      if (!ehObj(ing) || !(ehNum(ing.qtd) && ing.qtd > 0) || typeof ing.unidade !== 'string') return { ok: false, erro: `ingrediente inválido em "${r.nome}"` };
      for (const k of NUTR_OBRIG) if (!ehNumNaoNeg(ing[k])) return { ok: false, erro: `ingrediente com ${k} inválido em "${r.nome}"` };
      for (const k of NUTR_OPC) if (ing[k] != null && !ehNumNaoNeg(ing[k])) return { ok: false, erro: `ingrediente com ${k} inválido em "${r.nome}"` };
    }
  }
  for (const [data, dia] of Object.entries(obj.dias)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { ok: false, erro: `data inválida: ${data}` };
    if (!ehObj(dia) || !Array.isArray(dia.refeicoes)) return { ok: false, erro: `dia ${data} sem lista de refeições` };
    for (const r of dia.refeicoes) {
      if (!ehObj(r) || typeof r.nome !== 'string' || !Array.isArray(r.itens)) return { ok: false, erro: `refeição inválida em ${data}` };
      for (const it of r.itens) {
        if (!ehObj(it) || typeof it.rotulo !== 'string' || typeof it.unidade !== 'string') return { ok: false, erro: `item inválido em ${data}` };
        if (!(ehNum(it.qtd) && it.qtd > 0)) return { ok: false, erro: `item com quantidade inválida em ${data}` };
        for (const k of NUTR_OBRIG) if (!ehNumNaoNeg(it[k])) return { ok: false, erro: `item com ${k} inválido em ${data}` };
        for (const k of NUTR_OPC) if (it[k] != null && !ehNumNaoNeg(it[k])) return { ok: false, erro: `item com ${k} inválido em ${data}` };
      }
    }
    if (dia.agua !== undefined && (!Array.isArray(dia.agua) || dia.agua.some((a) => !ehObj(a) || !(ehNum(a.ml) && a.ml > 0)))) return { ok: false, erro: `registro de água inválido em ${data}` };
  }
  if (obj.recentes !== undefined && (!Array.isArray(obj.recentes) || obj.recentes.some((x) => !ehObj(x)))) return { ok: false, erro: '"recentes" inválido' };
  if (obj.combinacoes !== undefined) {
    if (!Array.isArray(obj.combinacoes)) return { ok: false, erro: '"combinacoes" inválido' };
    for (const c of obj.combinacoes) {
      if (!ehObj(c) || typeof c.id !== 'string' || typeof c.nome !== 'string' || !c.nome.trim() || !Array.isArray(c.itens) || !c.itens.length) return { ok: false, erro: 'combinação inválida' };
      for (const it of c.itens) { if (!ehObj(it) || !['alimento', 'receita'].includes(it.tipo) || typeof it.refId !== 'string' || typeof it.rotulo !== 'string' || !(ehNum(it.qtd) && it.qtd > 0) || typeof it.unidade !== 'string') return { ok: false, erro: `item inválido na combinação "${c.nome}"` };
        for (const k of NUTR_OBRIG) if (!ehNumNaoNeg(it[k])) return { ok: false, erro: `item com ${k} inválido na combinação "${c.nome}"` };
        for (const k of NUTR_OPC) if (it[k] != null && !ehNumNaoNeg(it[k])) return { ok: false, erro: `item com ${k} inválido na combinação "${c.nome}"` }; }
    }
  }
  if (obj.porcoes !== undefined) {
    if (!ehObj(obj.porcoes)) return { ok: false, erro: '"porcoes" inválido' };
    for (const [k, p] of Object.entries(obj.porcoes)) if (!ehObj(p) || !(ehNum(p.qtd) && p.qtd > 0) || typeof p.unidade !== 'string') return { ok: false, erro: `última porção inválida (${k})` };
  }
  return { ok: true };
}
