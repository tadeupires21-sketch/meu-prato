/* Meu Prato — acompanhamento alimentar pessoal.
   Sem dependências. Dados em localStorage (um documento JSON por modo: real e demonstração).
   Regras que valem em todo o arquivo:
   - Cada registro de consumo guarda os nutrientes já calculados (snapshot). Editar um
     alimento/receita depois NÃO altera dias anteriores.
   - Nenhum valor nutricional é inventado: só existe o que o usuário cadastrou.
   - Medidas caseiras (unidade, colher, scoop) só valem se tiverem equivalência cadastrada. */
(() => {
'use strict';

// ---------- Armazenamento ----------
const CHAVE_REAL = 'meuprato.v1';
const CHAVE_DEMO = 'meuprato.demo.v1';
const CHAVE_MODO = 'meuprato.modo';
const VERSAO_DADOS = 1;
const REFEICOES_PADRAO = ['Café da manhã', 'Almoço', 'Lanche', 'Jantar'];
// Alimentos comuns, por 100 g de parte comestível, copiados da TACO 4ª edição (NEPA/Unicamp, 2011).
// Entram como cadastro normal (editável) e levam o campo `fonte`. Sem medidas caseiras de propósito:
// peso de "1 unidade" ou "1 colher" varia, então o usuário cadastra a equivalência que pesou.
const FONTE_TACO = 'TACO 4ª ed. (NEPA/Unicamp)';
const ALIMENTOS_BASE = [
  { nome: 'Ovo de galinha inteiro, cozido', estado: 'cozido', kcal: 146, prot: 13.3, carb: 0.6, gord: 9.5 },
  { nome: 'Arroz branco tipo 1, cozido', estado: 'cozido', kcal: 128, prot: 2.5, carb: 28.1, gord: 0.2 },
  { nome: 'Feijão carioca, cozido', estado: 'cozido', kcal: 76, prot: 4.8, carb: 13.6, gord: 0.5 },
  { nome: 'Frango, peito sem pele, grelhado', estado: 'cozido', kcal: 159, prot: 32.0, carb: 0, gord: 2.5 },
  { nome: 'Pão de forma integral', estado: 'na', kcal: 253, prot: 9.4, carb: 49.9, gord: 3.7 },
];

function dadosVazios() {
  return {
    versao: VERSAO_DADOS,
    config: { metas: { kcal: 2000, prot: 120, carb: null, gord: null }, refeicoesPadrao: [...REFEICOES_PADRAO] },
    alimentos: [], receitas: [], dias: {}, recentes: []
  };
}
function modoDemo() { try { return localStorage.getItem(CHAVE_MODO) === 'demo'; } catch { return false; } }
function chaveAtual() { return modoDemo() ? CHAVE_DEMO : CHAVE_REAL; }

let D = carregar();
function carregar() {
  let bruto = null;
  try { bruto = localStorage.getItem(chaveAtual()); } catch { /* sem acesso */ }
  if (!bruto) {
    const novo = dadosVazios();
    if (modoDemo()) semearDemo(novo);
    return novo;
  }
  try {
    const obj = JSON.parse(bruto);
    const v = validarDados(obj);
    if (!v.ok) { console.warn('Dados locais inválidos:', v.erro); return dadosVazios(); }
    return normalizar(obj);
  } catch (e) { console.warn('Falha ao ler dados locais', e); return dadosVazios(); }
}
function salvar() {
  try { localStorage.setItem(chaveAtual(), JSON.stringify(D)); }
  catch (e) { toast('Não foi possível salvar: armazenamento indisponível ou cheio.'); console.error(e); }
}
function normalizar(obj) {
  const base = dadosVazios();
  obj.config = Object.assign(base.config, obj.config || {});
  obj.config.metas = Object.assign(base.config.metas, obj.config.metas || {});
  if (!Array.isArray(obj.config.refeicoesPadrao) || !obj.config.refeicoesPadrao.length) obj.config.refeicoesPadrao = [...REFEICOES_PADRAO];
  obj.alimentos = obj.alimentos || []; obj.receitas = obj.receitas || []; obj.dias = obj.dias || {}; obj.recentes = obj.recentes || [];
  for (const a of obj.alimentos) { a.medidas = a.medidas || []; a.favorito = !!a.favorito; }
  for (const r of obj.receitas) { r.ingredientes = r.ingredientes || []; r.favorito = !!r.favorito; }
  return obj;
}
function validarDados(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, erro: 'não é um objeto JSON' };
  if (typeof obj.versao !== 'number') return { ok: false, erro: 'campo "versao" ausente' };
  if (obj.versao > VERSAO_DADOS) return { ok: false, erro: `versão ${obj.versao} é mais nova que a do app (${VERSAO_DADOS})` };
  if (!Array.isArray(obj.alimentos)) return { ok: false, erro: '"alimentos" deve ser uma lista' };
  if (!Array.isArray(obj.receitas)) return { ok: false, erro: '"receitas" deve ser uma lista' };
  if (!obj.dias || typeof obj.dias !== 'object' || Array.isArray(obj.dias)) return { ok: false, erro: '"dias" deve ser um objeto por data' };
  for (const a of obj.alimentos) {
    if (!a.id || typeof a.nome !== 'string' || !(Number(a.refQtd) > 0)) return { ok: false, erro: `alimento inválido: ${JSON.stringify(a).slice(0, 80)}` };
    for (const k of ['kcal', 'prot', 'carb', 'gord']) if (typeof a[k] !== 'number' || !isFinite(a[k])) return { ok: false, erro: `alimento "${a.nome}" com ${k} inválido` };
  }
  for (const [data, dia] of Object.entries(obj.dias)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { ok: false, erro: `data inválida: ${data}` };
    if (!Array.isArray(dia.refeicoes)) return { ok: false, erro: `dia ${data} sem lista de refeições` };
    for (const r of dia.refeicoes) {
      if (!Array.isArray(r.itens)) return { ok: false, erro: `refeição sem itens em ${data}` };
      for (const it of r.itens) for (const k of ['kcal', 'prot', 'carb', 'gord', 'qtd']) if (typeof it[k] !== 'number' || !isFinite(it[k])) return { ok: false, erro: `item com ${k} inválido em ${data}` };
    }
  }
  return { ok: true };
}

// ---------- Utilidades ----------
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
function hojeISO() { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; }
const p2 = (n) => String(n).padStart(2, '0');
function somarDias(iso, n) { const [a, m, d] = iso.split('-').map(Number); const dt = new Date(a, m - 1, d + n); return `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`; }
function rotuloData(iso) {
  if (iso === hojeISO()) return 'Hoje';
  if (iso === somarDias(hojeISO(), -1)) return 'Ontem';
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
}
function dataCurta(iso) { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', ''); }
function fmt(n, dec = 0) { if (n == null || !isFinite(n)) return '–'; return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: dec }); }
function num(str) { if (typeof str === 'number') return str; if (str == null) return NaN; const s = String(str).trim().replace(/\s/g, '').replace(',', '.'); if (s === '') return NaN; return Number(s); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function $(sel, root = document) { return root.querySelector(sel); }
function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }
let toastTimer;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600); }
function confirmar(msg) { return window.confirm(msg); }

// ---------- Cálculos ----------
// Unidades disponíveis para um alimento: a unidade de referência + medidas caseiras cadastradas.
function unidadesAlimento(a) { return [{ nome: a.refUnidade, fator: 1 }, ...a.medidas.map((m) => ({ nome: m.nome, fator: m.equivale }))]; }
// Nutrientes de "qtd" na unidade "unidade" de um alimento. Proporcional à quantidade de referência.
function nutrientesAlimento(a, qtd, unidade) {
  const u = unidadesAlimento(a).find((x) => x.nome === unidade);
  if (!u) throw new Error(`Medida "${unidade}" sem equivalência cadastrada para ${a.nome}`);
  const fator = (qtd * u.fator) / a.refQtd;
  return { kcal: a.kcal * fator, prot: a.prot * fator, carb: a.carb * fator, gord: a.gord * fator };
}
function somar(lista) { return lista.reduce((s, n) => ({ kcal: s.kcal + n.kcal, prot: s.prot + n.prot, carb: s.carb + n.carb, gord: s.gord + n.gord }), { kcal: 0, prot: 0, carb: 0, gord: 0 }); }
// Receita: totais calculados dos ingredientes. Usa o alimento atual se existir; senão o snapshot do ingrediente.
function totaisReceita(r) {
  return somar(r.ingredientes.map((ing) => {
    const a = D.alimentos.find((x) => x.id === ing.alimentoId);
    if (a) { try { return nutrientesAlimento(a, ing.qtd, ing.unidade); } catch { /* medida removida: usa snapshot */ } }
    return { kcal: ing.kcal, prot: ing.prot, carb: ing.carb, gord: ing.gord };
  }));
}
function unidadesReceita(r) { const u = [{ nome: 'porção', fator: null }]; if (r.pesoFinal > 0) u.push({ nome: 'g', fator: null }); return u; }
function nutrientesReceita(r, qtd, unidade) {
  const t = totaisReceita(r);
  let f;
  if (unidade === 'porção') f = qtd / r.porcoes;
  else if (unidade === 'g' && r.pesoFinal > 0) f = qtd / r.pesoFinal;
  else throw new Error('Unidade inválida para receita');
  return { kcal: t.kcal * f, prot: t.prot * f, carb: t.carb * f, gord: t.gord * f };
}
function rotuloAlimento(a) { return a.marca ? `${a.nome} (${a.marca})` : a.nome; }

// ---------- Dias e refeições ----------
function obterDia(iso, criar = true) {
  let dia = D.dias[iso];
  if (!dia && criar) { dia = { refeicoes: D.config.refeicoesPadrao.map((n) => ({ id: uid(), nome: n, itens: [] })), concluido: false }; D.dias[iso] = dia; }
  return dia;
}
function diaTemRegistro(dia) { return !!dia && dia.refeicoes.some((r) => r.itens.length > 0); }
function totaisDia(dia) { return somar(dia ? dia.refeicoes.flatMap((r) => r.itens) : []); }
function registrarRecente(tipo, id) {
  D.recentes = [{ tipo, id, em: Date.now() }, ...D.recentes.filter((x) => !(x.tipo === tipo && x.id === id))].slice(0, 30);
}

// ---------- Estado de interface ----------
const UI = { aba: 'hoje', data: hojeISO(), filtroAlimentos: 'todos', buscaAlimentos: '', histDias: 7 };

function render() {
  $('#demo-banner').hidden = !modoDemo();
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === UI.aba));
  const app = $('#app');
  if (UI.aba === 'hoje') app.innerHTML = telaHoje();
  else if (UI.aba === 'alimentos') app.innerHTML = telaAlimentos();
  else if (UI.aba === 'historico') app.innerHTML = telaHistorico();
  else app.innerHTML = telaConfig();
  window.scrollTo(0, 0);
}

// ---------- Tela: Hoje ----------
function telaHoje() {
  const dia = obterDia(UI.data, false);
  const t = totaisDia(dia);
  const m = D.config.metas;
  const saldo = m.kcal - t.kcal;
  const saldoTxt = saldo >= 0 ? `${fmt(saldo)} kcal disponíveis` : `${fmt(-saldo)} kcal além da meta`;
  const protSaldo = m.prot - t.prot;
  const protTxt = protSaldo >= 0 ? `faltam ${fmt(protSaldo)} g` : `${fmt(-protSaldo)} g além da meta`;
  const pct = (v, meta) => meta > 0 ? Math.min(100, (v / meta) * 100) : 0;
  const macro = (nome, v, meta) => `<div><span class="muted">${nome}</span> <b>${fmt(v)} g</b>${meta ? `<span class="muted"> / ${fmt(meta)}</span>` : ''}</div>`;
  const refeicoes = (dia ? dia.refeicoes : D.config.refeicoesPadrao.map((n) => ({ id: null, nome: n, itens: [] })));
  return `
  <div class="topbar">
    <button class="btn icon ghost" data-act="dia-ant" aria-label="Dia anterior">‹</button>
    <div class="title" style="text-align:center">
      <h1>${esc(rotuloData(UI.data))}</h1>
      <input type="date" value="${UI.data}" data-act="data" aria-label="Escolher data" style="border:0;background:none;color:var(--muted);font-size:13px;text-align:center;width:100%">
    </div>
    <button class="btn icon ghost" data-act="dia-prox" aria-label="Próximo dia">›</button>
  </div>
  ${UI.data !== hojeISO() ? `<button class="btn sm full" data-act="ir-hoje" style="margin-bottom:10px">Voltar para hoje</button>` : ''}
  <section class="card">
    <div class="summary">
      <div class="stat"><div class="label">Calorias</div><div class="value">${fmt(t.kcal)}</div><div class="sub muted">de ${fmt(m.kcal)} kcal</div><div class="sub">${saldoTxt}</div><div class="bar"><span style="width:${pct(t.kcal, m.kcal)}%"></span></div></div>
      <div class="stat prot"><div class="label">Proteínas</div><div class="value">${fmt(t.prot)} <small>g</small></div><div class="sub muted">de ${fmt(m.prot, 1)} g</div><div class="sub">${protTxt}</div><div class="bar"><span style="width:${pct(t.prot, m.prot)}%"></span></div></div>
    </div>
    <div class="macros">${macro('Carboidratos', t.carb, m.carb)}${macro('Gorduras', t.gord, m.gord)}</div>
  </section>
  ${refeicoes.map((r, i) => {
    const st = somar(r.itens);
    return `<section class="card meal" data-ref="${r.id ?? ''}" data-idx="${i}">
      <div class="meal-head">
        <div class="grow"><h2>${esc(r.nome)}</h2><div class="meal-sub">${r.itens.length ? `${fmt(st.kcal)} kcal · ${fmt(st.prot, 1)} g prot` : 'Nada registrado'}</div></div>
        <button class="btn icon ghost" data-act="menu-refeicao" data-idx="${i}" aria-label="Opções da refeição">⋯</button>
      </div>
      ${r.itens.map((it) => `<button class="entry" data-act="editar-item" data-idx="${i}" data-item="${it.id}">
          <div class="grow"><div class="name ellipsis">${esc(it.rotulo)}</div><div class="qty">${fmt(it.qtd, 2)} ${esc(it.unidade)}</div></div>
          <div class="nums"><div>${fmt(it.kcal)} kcal</div><div class="p">${fmt(it.prot, 1)} g prot</div></div>
        </button>`).join('')}
      <button class="meal-add" data-act="adicionar" data-idx="${i}">+ Adicionar alimento</button>
    </section>`;
  }).join('')}
  <button class="btn full" data-act="nova-refeicao">+ Nova refeição neste dia</button>
  <div style="height:12px"></div>
  <label class="check card" style="margin-top:12px"><input type="checkbox" data-act="concluir" ${dia && dia.concluido ? 'checked' : ''}> <span><b>Dia concluído</b><br><span class="small muted">Só dias concluídos entram nas médias do histórico.</span></span></label>`;
}

// ---------- Tela: Alimentos ----------
function telaAlimentos() {
  const f = UI.filtroAlimentos; const q = UI.buscaAlimentos.trim().toLowerCase();
  const bate = (s) => !q || s.toLowerCase().includes(q);
  let html = `<div class="topbar"><h1 class="title">Alimentos e receitas</h1></div>
  <input class="search" type="search" placeholder="Buscar por nome ou marca" value="${esc(UI.buscaAlimentos)}" data-act="busca-alimentos" aria-label="Buscar">
  <div class="chips">${[['todos', 'Todos'], ['favoritos', 'Favoritos'], ['receitas', 'Receitas']].map(([k, n]) => `<button class="chip ${f === k ? 'active' : ''}" data-act="filtro-alimentos" data-f="${k}">${n}</button>`).join('')}</div>
  <div class="grid2" style="margin-bottom:12px"><button class="btn primary" data-act="novo-alimento">+ Alimento</button><button class="btn" data-act="nova-receita">+ Receita</button></div>
  <section class="card">`;
  const itens = [];
  if (f !== 'receitas') for (const a of D.alimentos) if ((f !== 'favoritos' || a.favorito) && bate(a.nome + ' ' + (a.marca || ''))) itens.push(itemListaAlimento(a, 'abrir-alimento'));
  if (f !== 'todos' || true) for (const r of D.receitas) if ((f === 'receitas' || f === 'todos' || (f === 'favoritos' && r.favorito)) && bate(r.nome)) itens.push(itemListaReceita(r, 'abrir-receita'));
  html += itens.length ? itens.join('') : `<div class="empty">${D.alimentos.length || D.receitas.length ? 'Nada encontrado com esse filtro.' : 'Nenhum alimento cadastrado ainda. Toque em “+ Alimento” para começar.'}</div>` + (D.alimentos.length ? '' : `<button class="btn full" data-act="importar-base" style="margin-top:8px">Adicionar alimentos comuns (TACO)</button>`);
  html += `</section>`;
  return html;
}
function itemListaAlimento(a, act, extra = '') {
  const estado = a.estado && a.estado !== 'na' ? ` · ${a.estado}` : '';
  return `<button class="list-item" data-act="${act}" data-id="${a.id}" ${extra}>
    <div class="grow"><div class="name">${a.favorito ? '<span class="star">★</span> ' : ''}${esc(a.nome)}${a.marca ? ` <span class="muted">· ${esc(a.marca)}</span>` : ''}</div>
    <div class="meta">${fmt(a.kcal)} kcal · ${fmt(a.prot, 1)} g prot por ${fmt(a.refQtd, 2)} ${esc(a.refUnidade)}${estado}${a.fonte ? ` · <span class="badge neutral">${esc(a.fonte)}</span>` : ''}</div></div><span class="muted">›</span></button>`;
}
function itemListaReceita(r, act, extra = '') {
  const t = totaisReceita(r); const pp = r.porcoes > 0 ? t.kcal / r.porcoes : 0; const pr = r.porcoes > 0 ? t.prot / r.porcoes : 0;
  return `<button class="list-item" data-act="${act}" data-id="${r.id}" ${extra}>
    <div class="grow"><div class="name">${r.favorito ? '<span class="star">★</span> ' : ''}${esc(r.nome)} <span class="badge">receita</span></div>
    <div class="meta">${fmt(pp)} kcal · ${fmt(pr, 1)} g prot por porção · rende ${fmt(r.porcoes, 2)}${r.pesoFinal ? ` · ${fmt(r.pesoFinal)} g no total` : ''}</div></div><span class="muted">›</span></button>`;
}

// ---------- Tela: Histórico ----------
function telaHistorico() {
  const n = UI.histDias; const hoje = hojeISO(); const m = D.config.metas;
  const linhas = []; let concl = 0; const acum = { kcal: 0, prot: 0 }; let maxK = m.kcal || 1;
  for (let i = 0; i < n; i++) {
    const iso = somarDias(hoje, -i); const dia = D.dias[iso]; const tem = diaTemRegistro(dia); const t = totaisDia(dia);
    if (tem && dia.concluido) { concl++; acum.kcal += t.kcal; acum.prot += t.prot; }
    if (t.kcal > maxK) maxK = t.kcal;
    linhas.push({ iso, dia, tem, t });
  }
  const media = concl ? { kcal: acum.kcal / concl, prot: acum.prot / concl } : null;
  return `<div class="topbar"><h1 class="title">Histórico</h1></div>
  <div class="chips">${[7, 30].map((k) => `<button class="chip ${n === k ? 'active' : ''}" data-act="hist-dias" data-n="${k}">Últimos ${k} dias</button>`).join('')}</div>
  <section class="card">
    <h2>Média dos dias concluídos</h2>
    ${media ? `<div class="summary" style="margin-top:10px"><div class="stat"><div class="label">Calorias / dia</div><div class="value">${fmt(media.kcal)}</div></div><div class="stat prot"><div class="label">Proteínas / dia</div><div class="value">${fmt(media.prot)} <small>g</small></div></div></div>` : ''}
    <p class="help" style="margin-bottom:0">${concl ? `${concl} de ${n} dias marcados como concluídos entraram na média.` : `Nenhum dia concluído nos últimos ${n} dias. Marque “Dia concluído” na tela Hoje para incluir um dia na média.`}</p>
  </section>
  <section class="card">
    ${linhas.map(({ iso, dia, tem, t }) => `<button class="hist-row" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left;color:inherit" data-act="abrir-dia" data-data="${iso}">
      <div class="d">${esc(dataCurta(iso))}</div>
      ${tem ? `<div class="bars"><div class="small">${fmt(t.kcal)} kcal · <span style="color:var(--prot)">${fmt(t.prot)} g prot</span></div><div class="bar"><span style="width:${Math.min(100, t.kcal / maxK * 100)}%"></span></div><div class="bar p"><span style="width:${m.prot ? Math.min(100, t.prot / m.prot * 100) : 0}%"></span></div></div>` : `<div class="muted small">Sem registros</div>`}
      <div class="st">${tem ? (dia.concluido ? '<span class="badge">concluído</span>' : '<span class="badge neutral">em aberto</span>') : ''}</div>
    </button>`).join('')}
  </section>`;
}

// ---------- Tela: Configurações ----------
function telaConfig() {
  const m = D.config.metas;
  let usoKB = 0; try { usoKB = Math.round((localStorage.getItem(chaveAtual()) || '').length / 1024); } catch { /* ignore */ }
  return `<div class="topbar"><h1 class="title">Configurações</h1></div>
  <section class="card">
    <h2>Metas diárias</h2>
    <p class="help">Defina você mesmo. Carboidratos e gorduras são opcionais.</p>
    <form data-form="metas">
      <div class="grid2">
        <div class="field"><label>Calorias (kcal)</label><input name="kcal" inputmode="decimal" value="${fmt(m.kcal, 2)}" required></div>
        <div class="field"><label>Proteínas (g)</label><input name="prot" inputmode="decimal" value="${fmt(m.prot, 2)}" required></div>
        <div class="field"><label>Carboidratos (g) — opcional</label><input name="carb" inputmode="decimal" value="${m.carb ? fmt(m.carb, 2) : ''}"></div>
        <div class="field"><label>Gorduras (g) — opcional</label><input name="gord" inputmode="decimal" value="${m.gord ? fmt(m.gord, 2) : ''}"></div>
      </div>
      <button class="btn primary full" type="submit">Salvar metas</button>
    </form>
  </section>
  <section class="card">
    <h2>Refeições padrão</h2>
    <p class="help">Uma por linha. Vale para dias novos; dias já criados não mudam.</p>
    <form data-form="refeicoes"><div class="field"><textarea name="lista" rows="4" style="min-height:100px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);width:100%">${esc(D.config.refeicoesPadrao.join('\n'))}</textarea></div><button class="btn full" type="submit">Salvar refeições padrão</button></form>
  </section>
  <section class="card">
    <h2>Alimentos comuns</h2>
    <p class="help">Adiciona ovo cozido, arroz, feijão, frango grelhado e pão integral com valores por 100 g copiados da ${FONTE_TACO}. Entram como cadastro normal: confira e corrija se o seu produto for diferente. Itens já cadastrados não se repetem.</p>
    <button class="btn full" data-act="importar-base">Adicionar alimentos comuns (TACO)</button>
  </section>
  <section class="card">
    <h2>Dados e privacidade</h2>
    <p class="help">Tudo fica salvo <b>somente neste aparelho e neste navegador</b> (armazenamento local, ~${usoKB} KB em uso). Não há conta nem envio para servidor. Isso significa: trocar de celular, limpar os dados do navegador ou desinstalar o app apaga os registros. Faça backup em JSON com alguma frequência.</p>
    <div class="stack">
      <button class="btn full" data-act="exportar-json">Exportar backup (JSON)</button>
      <button class="btn full" data-act="importar-json">Importar backup (JSON)</button>
      <input type="file" accept="application/json,.json" data-act="arquivo-json" hidden>
      <button class="btn full" data-act="exportar-csv">Exportar histórico alimentar (CSV)</button>
    </div>
  </section>
  <section class="card">
    <h2>Modo demonstração</h2>
    <p class="help">Carrega alimentos e dias de exemplo num espaço separado, sem tocar nos seus registros reais. Os números de exemplo são ilustrativos, não uma tabela nutricional de referência.</p>
    <button class="btn full" data-act="alternar-demo">${modoDemo() ? 'Sair do modo demonstração' : 'Entrar no modo demonstração'}</button>
  </section>
  <section class="card">
    <h2>Zona de cuidado</h2>
    <button class="btn full danger" data-act="apagar-tudo">Apagar todos os dados ${modoDemo() ? 'de demonstração' : 'deste aparelho'}</button>
  </section>
  <p class="small muted" style="text-align:center">Meu Prato · versão 1 · dados v${VERSAO_DADOS}</p>`;
}

// ---------- Folhas (sheets) ----------
function abrirFolha(html, aoMontar) {
  fecharFolha();
  const root = $('#sheet-root');
  root.innerHTML = `<div class="sheet-backdrop"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  const bd = $('.sheet-backdrop', root);
  bd.addEventListener('click', (e) => { if (e.target === bd) fecharFolha(); });
  $$('[data-fechar]', root).forEach((b) => b.addEventListener('click', fecharFolha));
  if (aoMontar) aoMontar($('.sheet', root));
}
function fecharFolha() { $('#sheet-root').innerHTML = ''; }
const cab = (titulo) => `<div class="sheet-head"><h2>${esc(titulo)}</h2><button class="btn icon ghost" data-fechar aria-label="Fechar">✕</button></div>`;

// Menu simples de opções
function menu(titulo, opcoes) {
  abrirFolha(`${cab(titulo)}<div class="menu">${opcoes.map((o, i) => `<button data-i="${i}" class="${o.perigo ? 'danger' : ''}">${esc(o.rotulo)}</button>`).join('')}</div>`, (s) => {
    $$('.menu button', s).forEach((b) => b.addEventListener('click', () => { fecharFolha(); opcoes[Number(b.dataset.i)].acao(); }));
  });
}

// ----- Escolher alimento/receita para uma refeição -----
function folhaEscolher(idxRefeicao, aoEscolher) {
  let filtro = 'recentes'; let busca = '';
  if (!D.recentes.length) filtro = D.alimentos.some((a) => a.favorito) || D.receitas.some((r) => r.favorito) ? 'favoritos' : 'todos';
  const desenhar = (s) => {
    const q = busca.trim().toLowerCase(); const bate = (t) => !q || t.toLowerCase().includes(q);
    let lista = [];
    if (q) filtro = 'todos';
    if (filtro === 'recentes') lista = D.recentes.map((x) => x.tipo === 'alimento' ? D.alimentos.find((a) => a.id === x.id) : Object.assign({ _receita: true }, D.receitas.find((r) => r.id === x.id))).filter((x) => x && x.id);
    else if (filtro === 'favoritos') lista = [...D.alimentos.filter((a) => a.favorito), ...D.receitas.filter((r) => r.favorito).map((r) => Object.assign({ _receita: true }, r))];
    else if (filtro === 'receitas') lista = D.receitas.map((r) => Object.assign({ _receita: true }, r));
    else lista = [...D.alimentos.filter((a) => bate(a.nome + ' ' + (a.marca || ''))), ...D.receitas.filter((r) => bate(r.nome)).map((r) => Object.assign({ _receita: true }, r))];
    $('.lista', s).innerHTML = (lista.length ? lista.map((x) => x._receita ? itemListaReceita(x, 'pick-receita') : itemListaAlimento(x, 'pick-alimento')).join('')
      : `<div class="empty">${filtro === 'recentes' ? 'Nada usado recentemente.' : filtro === 'favoritos' ? 'Nenhum favorito ainda.' : 'Nada encontrado.'}</div>`)
      + `<button class="list-item" data-act="pick-novo"><div class="grow"><div class="name" style="color:var(--brand)">+ Cadastrar novo alimento${q ? ` “${esc(busca.trim())}”` : ''}</div></div></button>`;
    $$('.chip', s).forEach((c) => c.classList.toggle('active', c.dataset.f === filtro));
    $$('[data-act="pick-alimento"]', s).forEach((b) => b.addEventListener('click', () => aoEscolher('alimento', b.dataset.id)));
    $$('[data-act="pick-receita"]', s).forEach((b) => b.addEventListener('click', () => aoEscolher('receita', b.dataset.id)));
    $('[data-act="pick-novo"]', s).addEventListener('click', () => folhaAlimento(null, { nome: busca.trim() }, (novo) => aoEscolher('alimento', novo.id)));
  };
  abrirFolha(`${cab('Adicionar alimento')}
    <input class="search" type="search" placeholder="Buscar nos meus alimentos" aria-label="Buscar" autofocus>
    <div class="chips">${[['recentes', 'Recentes'], ['favoritos', 'Favoritos'], ['todos', 'Todos'], ['receitas', 'Receitas']].map(([k, n]) => `<button class="chip" data-f="${k}">${n}</button>`).join('')}</div>
    <div class="lista"></div>`, (s) => {
    $('.search', s).addEventListener('input', (e) => { busca = e.target.value; desenhar(s); });
    $$('.chip', s).forEach((c) => c.addEventListener('click', () => { filtro = c.dataset.f; busca = ''; $('.search', s).value = ''; desenhar(s); }));
    desenhar(s);
    setTimeout(() => $('.search', s).focus(), 50);
  });
}

// ----- Quantidade (novo registro ou edição) -----
function folhaQuantidade({ tipo, id, item, idxRefeicao, aoConfirmar }) {
  const ref = tipo === 'alimento' ? D.alimentos.find((a) => a.id === id) : D.receitas.find((r) => r.id === id);
  if (!ref) { toast('Cadastro original não encontrado. Edite a quantidade a partir do registro.'); return; }
  const unidades = tipo === 'alimento' ? unidadesAlimento(ref) : unidadesReceita(ref);
  const qtdIni = item ? item.qtd : (tipo === 'alimento' ? ref.refQtd : 1);
  const uniIni = item && unidades.some((u) => u.nome === item.unidade) ? item.unidade : unidades[0].nome;
  const titulo = tipo === 'alimento' ? rotuloAlimento(ref) : ref.nome;
  const calc = (q, u) => tipo === 'alimento' ? nutrientesAlimento(ref, q, u) : nutrientesReceita(ref, q, u);
  abrirFolha(`${cab(item ? 'Editar quantidade' : 'Quantidade')}
    <div style="font-weight:600;margin-bottom:10px">${esc(titulo)}</div>
    <div class="grid2">
      <div class="field"><label>Quantidade</label><input name="qtd" inputmode="decimal" value="${fmt(qtdIni, 3)}" autofocus></div>
      <div class="field"><label>Unidade</label><select name="uni">${unidades.map((u) => `<option value="${esc(u.nome)}" ${u.nome === uniIni ? 'selected' : ''}>${esc(u.nome)}${u.fator && u.fator !== 1 ? ` (${fmt(u.fator, 2)} ${esc(ref.refUnidade)})` : ''}</option>`).join('')}</select></div>
    </div>
    ${tipo === 'alimento' ? `<p class="help">Referência: ${fmt(ref.kcal)} kcal e ${fmt(ref.prot, 1)} g de proteína por ${fmt(ref.refQtd, 2)} ${esc(ref.refUnidade)}.${ref.medidas.length ? '' : ' Para usar unidade, colher ou scoop, cadastre a equivalência no alimento.'}</p>`
      : `<p class="help">Rende ${fmt(ref.porcoes, 2)} porção(ões)${ref.pesoFinal ? ` · ${fmt(ref.pesoFinal)} g no total` : ' · sem peso final informado, então só é possível registrar em porções'}.</p>`}
    <div class="preview" aria-live="polite"></div>
    <button class="btn primary full" data-ok>${item ? 'Salvar' : 'Adicionar'}</button>`, (s) => {
    const inQ = $('[name=qtd]', s), inU = $('[name=uni]', s), pv = $('.preview', s), ok = $('[data-ok]', s);
    const atualizar = () => {
      const q = num(inQ.value);
      if (!(q > 0)) { pv.innerHTML = '<span style="grid-column:1/-1">Informe uma quantidade maior que zero.</span>'; ok.disabled = true; return; }
      const n = calc(q, inU.value); ok.disabled = false;
      pv.innerHTML = `<div><b>${fmt(n.kcal)}</b><span>kcal</span></div><div><b>${fmt(n.prot, 1)}</b><span>g prot</span></div><div><b>${fmt(n.carb, 1)}</b><span>g carb</span></div><div><b>${fmt(n.gord, 1)}</b><span>g gord</span></div>`;
    };
    inQ.addEventListener('input', atualizar); inU.addEventListener('change', atualizar); atualizar();
    inQ.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !ok.disabled) ok.click(); });
    ok.addEventListener('click', () => {
      const q = num(inQ.value); if (!(q > 0)) return;
      const n = calc(q, inU.value);
      fecharFolha(); // antes do callback: ele pode abrir outra folha (ex.: voltar ao formulário da receita)
      aoConfirmar({ qtd: q, unidade: inU.value, rotulo: titulo, ...n });
    });
    setTimeout(() => { inQ.focus(); inQ.select(); }, 50);
  });
}

function adicionarItem(idxRefeicao, tipo, id) {
  folhaQuantidade({ tipo, id, idxRefeicao, aoConfirmar: (dados) => {
    const dia = obterDia(UI.data); const ref = dia.refeicoes[idxRefeicao];
    ref.itens.push({ id: uid(), tipo, refId: id, criadoEm: new Date().toISOString(), ...dados });
    registrarRecente(tipo, id); salvar(); render(); toast(`${dados.rotulo} adicionado em ${ref.nome}.`);
  } });
}

// ----- Editar item registrado -----
function folhaItem(idxRefeicao, itemId) {
  const dia = obterDia(UI.data); const ref = dia.refeicoes[idxRefeicao]; const it = ref.itens.find((x) => x.id === itemId); if (!it) return;
  const origem = it.tipo === 'alimento' ? D.alimentos.find((a) => a.id === it.refId) : D.receitas.find((r) => r.id === it.refId);
  const ops = [
    { rotulo: 'Alterar quantidade', acao: () => {
      if (origem) folhaQuantidade({ tipo: it.tipo, id: it.refId, item: it, aoConfirmar: (d) => { Object.assign(it, d); salvar(); render(); } });
      else folhaQuantidadeOrfa(it);
    } },
    { rotulo: 'Duplicar neste dia', acao: () => { ref.itens.push({ ...it, id: uid(), criadoEm: new Date().toISOString() }); salvar(); render(); toast('Item duplicado.'); } },
    { rotulo: 'Mover para outra refeição', acao: () => menu('Mover para', dia.refeicoes.filter((r) => r !== ref).map((r) => ({ rotulo: r.nome, acao: () => { ref.itens = ref.itens.filter((x) => x !== it); r.itens.push(it); salvar(); render(); } }))) },
  ];
  if (origem && it.tipo === 'alimento') ops.push({ rotulo: origem.favorito ? 'Remover dos favoritos' : 'Marcar alimento como favorito', acao: () => { origem.favorito = !origem.favorito; salvar(); toast(origem.favorito ? 'Favoritado.' : 'Removido dos favoritos.'); } });
  if (origem && it.tipo === 'receita') ops.push({ rotulo: origem.favorito ? 'Remover receita dos favoritos' : 'Marcar receita como favorita', acao: () => { origem.favorito = !origem.favorito; salvar(); } });
  ops.push({ rotulo: 'Excluir registro', perigo: true, acao: () => { ref.itens = ref.itens.filter((x) => x !== it); salvar(); render(); toast('Registro excluído.'); } });
  menu(`${it.rotulo} · ${fmt(it.qtd, 2)} ${it.unidade}`, ops);
}
// Item cujo alimento foi apagado: recalcula proporcionalmente a partir do próprio registro.
function folhaQuantidadeOrfa(it) {
  abrirFolha(`${cab('Alterar quantidade')}<p class="help">O cadastro original foi excluído. A nova quantidade será calculada proporcionalmente a este registro (${fmt(it.qtd, 2)} ${esc(it.unidade)} = ${fmt(it.kcal)} kcal).</p>
    <div class="field"><label>Quantidade (${esc(it.unidade)})</label><input name="qtd" inputmode="decimal" value="${fmt(it.qtd, 3)}"></div><button class="btn primary full" data-ok>Salvar</button>`, (s) => {
    $('[data-ok]', s).addEventListener('click', () => {
      const q = num($('[name=qtd]', s).value); if (!(q > 0)) { toast('Quantidade inválida.'); return; }
      const f = q / it.qtd; it.kcal *= f; it.prot *= f; it.carb *= f; it.gord *= f; it.qtd = q; salvar(); render(); fecharFolha();
    });
  });
}

// ----- Menu da refeição -----
function menuRefeicao(idx) {
  const dia = obterDia(UI.data); const ref = dia.refeicoes[idx];
  menu(ref.nome, [
    { rotulo: 'Copiar refeição de outro dia', acao: () => folhaCopiar(idx) },
    { rotulo: 'Renomear refeição', acao: () => { const n = prompt('Novo nome da refeição:', ref.nome); if (n && n.trim()) { ref.nome = n.trim(); salvar(); render(); } } },
    { rotulo: 'Limpar itens desta refeição', perigo: true, acao: () => { if (!ref.itens.length) return; if (confirmar(`Excluir os ${ref.itens.length} itens de ${ref.nome}?`)) { ref.itens = []; salvar(); render(); } } },
    { rotulo: 'Remover refeição do dia', perigo: true, acao: () => { if (ref.itens.length && !confirmar(`A refeição tem ${ref.itens.length} itens. Remover mesmo assim?`)) return; dia.refeicoes.splice(idx, 1); salvar(); render(); } },
  ]);
}
function folhaCopiar(idxDestino) {
  let data = somarDias(UI.data, -1);
  const desenhar = (s) => {
    const dia = D.dias[data]; const lista = $('.lista', s);
    if (!diaTemRegistro(dia)) { lista.innerHTML = '<div class="empty">Nenhum registro nessa data.</div>'; return; }
    lista.innerHTML = dia.refeicoes.filter((r) => r.itens.length).map((r, i) => { const t = somar(r.itens); return `<button class="list-item" data-i="${dia.refeicoes.indexOf(r)}"><div class="grow"><div class="name">${esc(r.nome)}</div><div class="meta">${r.itens.map((x) => x.rotulo).join(', ')} · ${fmt(t.kcal)} kcal</div></div><span class="muted">copiar ›</span></button>`; }).join('');
    $$('.list-item', lista).forEach((b) => b.addEventListener('click', () => {
      const origem = dia.refeicoes[Number(b.dataset.i)]; const destino = obterDia(UI.data).refeicoes[idxDestino];
      for (const it of origem.itens) destino.itens.push({ ...it, id: uid(), criadoEm: new Date().toISOString() });
      salvar(); render(); fecharFolha(); toast(`${origem.itens.length} itens copiados para ${destino.nome}.`);
    }));
  };
  abrirFolha(`${cab('Copiar refeição de outro dia')}<div class="field"><label>Data de origem</label><input type="date" value="${data}" max="${hojeISO()}"></div><div class="lista"></div>`, (s) => {
    $('input[type=date]', s).addEventListener('change', (e) => { if (e.target.value) { data = e.target.value; desenhar(s); } }); desenhar(s);
  });
}

// ----- Cadastro / edição de alimento -----
function folhaAlimento(id, inicial = {}, aoSalvar) {
  const a = id ? D.alimentos.find((x) => x.id === id) : null;
  const v = Object.assign({ nome: '', marca: '', estado: 'na', refQtd: 100, refUnidade: 'g', kcal: '', prot: '', carb: '', gord: '', medidas: [], favorito: false }, a || {}, inicial);
  let medidas = v.medidas.map((m) => ({ ...m }));
  const linhaMedida = (m, i) => `<div class="ing"><div class="grow">${esc(m.nome)} = ${fmt(m.equivale, 2)} <span class="un"></span></div><button type="button" class="btn sm ghost danger" data-rm="${i}">remover</button></div>`;
  abrirFolha(`${cab(a ? 'Editar alimento' : 'Novo alimento')}
    <form data-form="alimento">
      <div class="field"><label>Nome</label><input name="nome" value="${esc(v.nome)}" required autofocus></div>
      <div class="grid2">
        <div class="field"><label>Marca (opcional)</label><input name="marca" value="${esc(v.marca || '')}"></div>
        <div class="field"><label>Estado</label><select name="estado"><option value="na" ${v.estado === 'na' ? 'selected' : ''}>não se aplica</option><option value="cru" ${v.estado === 'cru' ? 'selected' : ''}>cru</option><option value="cozido" ${v.estado === 'cozido' ? 'selected' : ''}>cozido</option></select></div>
      </div>
      ${a && a.fonte ? `<p class="help" style="margin-top:0">Valores de origem: <b>${esc(a.fonte)}</b>. Se editar, eles passam a ser seus.</p>` : ''}
      <p class="help" style="margin-top:0">Os valores abaixo valem para a <b>quantidade de referência</b> (ex.: 100 g, 100 ml ou 1 porção). Copie do rótulo.</p>
      <div class="grid2">
        <div class="field"><label>Quantidade de referência</label><input name="refQtd" inputmode="decimal" value="${fmt(v.refQtd, 3)}" required></div>
        <div class="field"><label>Unidade</label><select name="refUnidade">${['g', 'ml', 'porção'].map((u) => `<option ${v.refUnidade === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Calorias (kcal)</label><input name="kcal" inputmode="decimal" value="${v.kcal === '' ? '' : fmt(v.kcal, 2)}" required></div>
        <div class="field"><label>Proteínas (g)</label><input name="prot" inputmode="decimal" value="${v.prot === '' ? '' : fmt(v.prot, 2)}" required></div>
        <div class="field"><label>Carboidratos (g)</label><input name="carb" inputmode="decimal" value="${v.carb === '' ? '' : fmt(v.carb, 2)}" required></div>
        <div class="field"><label>Gorduras (g)</label><input name="gord" inputmode="decimal" value="${v.gord === '' ? '' : fmt(v.gord, 2)}" required></div>
      </div>
      <h3>Medidas caseiras (opcional)</h3>
      <p class="help">Ex.: “unidade” = 50 g, “scoop” = 30 g, “colher de sopa” = 15 ml. Sem equivalência cadastrada o app não presume conversão.</p>
      <div class="medidas">${medidas.map(linhaMedida).join('')}</div>
      <div class="grid3" style="align-items:end;margin-top:8px">
        <div class="field" style="grid-column:span 2"><label>Nome da medida</label><input name="mNome" placeholder="unidade"></div>
        <div class="field"><label>Equivale a (<span class="un"></span>)</label><input name="mEq" inputmode="decimal" placeholder="50"></div>
      </div>
      <button type="button" class="btn sm full" data-add-medida>+ Adicionar medida</button>
      <hr class="sep">
      <label class="check"><input type="checkbox" name="favorito" ${v.favorito ? 'checked' : ''}> Favorito</label>
      <div class="stack" style="margin-top:8px">
        <button class="btn primary full" type="submit">${a ? 'Salvar alterações' : 'Salvar alimento'}</button>
        ${a ? `<button type="button" class="btn full" data-dup>Duplicar como novo alimento</button><button type="button" class="btn full danger" data-del>Excluir alimento</button>` : ''}
      </div>
      ${a ? '<p class="help">Alterar valores não muda registros de dias anteriores: eles guardam os nutrientes calculados na hora.</p>' : ''}
    </form>`, (s) => {
    const form = $('form', s);
    const atualizarUn = () => $$('.un', s).forEach((e) => { e.textContent = form.refUnidade.value; });
    const redesenharMedidas = () => { $('.medidas', s).innerHTML = medidas.map(linhaMedida).join(''); atualizarUn(); $$('[data-rm]', s).forEach((b) => b.addEventListener('click', () => { medidas.splice(Number(b.dataset.rm), 1); redesenharMedidas(); })); };
    form.refUnidade.addEventListener('change', atualizarUn); redesenharMedidas();
    $('[data-add-medida]', s).addEventListener('click', () => {
      const nome = form.mNome.value.trim(); const eq = num(form.mEq.value);
      if (!nome) { toast('Dê um nome à medida.'); return; }
      if (!(eq > 0)) { toast('Informe a equivalência (número maior que zero).'); return; }
      if (['g', 'ml', 'porção'].includes(nome) || medidas.some((m) => m.nome === nome)) { toast('Já existe uma medida com esse nome.'); return; }
      medidas.push({ nome, equivale: eq }); form.mNome.value = ''; form.mEq.value = ''; redesenharMedidas();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const campos = { nome: form.nome.value.trim(), marca: form.marca.value.trim(), estado: form.estado.value, refQtd: num(form.refQtd.value), refUnidade: form.refUnidade.value,
        kcal: num(form.kcal.value), prot: num(form.prot.value), carb: num(form.carb.value), gord: num(form.gord.value), medidas, favorito: form.favorito.checked };
      if (!campos.nome) { toast('Informe o nome.'); return; }
      if (!(campos.refQtd > 0)) { toast('Quantidade de referência deve ser maior que zero.'); return; }
      for (const k of ['kcal', 'prot', 'carb', 'gord']) if (!(campos[k] >= 0)) { toast(`Valor inválido em ${k}. Use números (vírgula ou ponto).`); return; }
      let salvo;
      if (a) {
        const mudouValor = a.fonte && ['kcal', 'prot', 'carb', 'gord', 'refQtd', 'refUnidade'].some((k) => a[k] !== campos[k]);
        Object.assign(a, campos, { atualizadoEm: new Date().toISOString() });
        if (mudouValor) a.fonte = a.fonte.replace(/ \(editado\)$/, '') + ' (editado)';
        salvo = a;
      }
      else { salvo = { id: uid(), ...campos, criadoEm: new Date().toISOString() }; D.alimentos.push(salvo); }
      D.alimentos.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
      salvar(); fecharFolha(); render(); toast(a ? 'Alimento atualizado.' : 'Alimento cadastrado.');
      if (aoSalvar) aoSalvar(salvo);
    });
    if (a) {
      $('[data-dup]', s).addEventListener('click', () => folhaAlimento(null, { ...a, id: undefined, nome: a.nome + ' (cópia)' }));
      $('[data-del]', s).addEventListener('click', () => {
        const emReceitas = D.receitas.filter((r) => r.ingredientes.some((i) => i.alimentoId === a.id)).map((r) => r.nome);
        const aviso = `Excluir “${a.nome}”? Registros antigos continuam com os valores já calculados.` + (emReceitas.length ? `\n\nUsado nas receitas: ${emReceitas.join(', ')} (elas passam a usar os valores guardados no ingrediente).` : '');
        if (!confirmar(aviso)) return;
        D.alimentos = D.alimentos.filter((x) => x !== a); D.recentes = D.recentes.filter((x) => !(x.tipo === 'alimento' && x.id === a.id));
        salvar(); fecharFolha(); render(); toast('Alimento excluído.');
      });
    }
    setTimeout(() => form.nome.focus(), 50);
  });
}

// ----- Cadastro / edição de receita -----
function folhaReceita(id, rascunho = null, ingsIniciais = null) {
  const r = id ? D.receitas.find((x) => x.id === id) : null;
  const v = Object.assign({ nome: '', porcoes: 1, pesoFinal: '', favorito: false, ingredientes: [] }, r || {}, rascunho || {});
  let ings = ingsIniciais ? ingsIniciais : v.ingredientes.map((i) => ({ ...i }));
  const totais = () => somar(ings.map((i) => ({ kcal: i.kcal, prot: i.prot, carb: i.carb, gord: i.gord })));
  abrirFolha(`${cab(r ? 'Editar receita' : 'Nova receita')}
    <form data-form="receita">
      <div class="field"><label>Nome</label><input name="nome" value="${esc(v.nome)}" required placeholder="Ex.: Pão com ovo"></div>
      <h3>Ingredientes</h3>
      <div class="ings"></div>
      <button type="button" class="btn sm full" data-add-ing style="margin:8px 0 12px">+ Adicionar ingrediente</button>
      <div class="grid2">
        <div class="field"><label>Rendimento (porções)</label><input name="porcoes" inputmode="decimal" value="${fmt(v.porcoes, 2)}" required></div>
        <div class="field"><label>Peso final do preparo (g, opcional)</label><input name="pesoFinal" inputmode="decimal" value="${v.pesoFinal ? fmt(v.pesoFinal, 1) : ''}"></div>
      </div>
      <div class="resumo"></div>
      <label class="check"><input type="checkbox" name="favorito" ${v.favorito ? 'checked' : ''}> Favorita</label>
      <div class="stack" style="margin-top:8px">
        <button class="btn primary full" type="submit">${r ? 'Salvar alterações' : 'Salvar receita'}</button>
        ${r ? '<button type="button" class="btn full danger" data-del>Excluir receita</button>' : ''}
      </div>
    </form>`, (s) => {
    const form = $('form', s);
    const resumo = () => {
      const t = totais(); const p = num(form.porcoes.value); const pf = num(form.pesoFinal.value);
      $('.resumo', s).innerHTML = `<div class="preview"><div><b>${fmt(t.kcal)}</b><span>kcal total</span></div><div><b>${fmt(t.prot, 1)}</b><span>g prot total</span></div>
        <div><b>${p > 0 ? fmt(t.kcal / p) : '–'}</b><span>kcal / porção</span></div><div><b>${p > 0 ? fmt(t.prot / p, 1) : '–'}</b><span>g prot / porção</span></div></div>
        ${pf > 0 ? `<p class="help">Por grama: ${fmt(t.kcal / pf, 2)} kcal · ${fmt(t.prot / pf, 3)} g prot.</p>` : ''}`;
    };
    const redesenhar = () => {
      $('.ings', s).innerHTML = ings.length ? ings.map((i, k) => `<div class="ing"><div class="grow">${esc(i.rotulo)} · ${fmt(i.qtd, 2)} ${esc(i.unidade)} <span class="muted">(${fmt(i.kcal)} kcal)</span></div><button type="button" class="btn sm ghost danger" data-rm="${k}">remover</button></div>`).join('') : '<div class="empty" style="padding:4px 0">Nenhum ingrediente ainda.</div>';
      $$('[data-rm]', s).forEach((b) => b.addEventListener('click', () => { ings.splice(Number(b.dataset.rm), 1); redesenhar(); }));
      resumo();
    };
    form.porcoes.addEventListener('input', resumo); form.pesoFinal.addEventListener('input', resumo); redesenhar();
    $('[data-add-ing]', s).addEventListener('click', () => {
      // Guarda o estado do formulário enquanto o seletor está aberto.
      const rascunho = { nome: form.nome.value, porcoes: num(form.porcoes.value) || 1, pesoFinal: form.pesoFinal.value.trim() === '' ? '' : num(form.pesoFinal.value), favorito: form.favorito.checked };
      const reabrir = () => folhaReceita(id, rascunho, ings);
      folhaEscolherIngrediente((alimento) => {
        folhaQuantidade({ tipo: 'alimento', id: alimento.id, aoConfirmar: (d) => {
          ings.push({ alimentoId: alimento.id, rotulo: d.rotulo, qtd: d.qtd, unidade: d.unidade, kcal: d.kcal, prot: d.prot, carb: d.carb, gord: d.gord });
          reabrir();
        } });
      }, reabrir);
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = form.nome.value.trim(); const porcoes = num(form.porcoes.value); const pf = form.pesoFinal.value.trim() === '' ? null : num(form.pesoFinal.value);
      if (!nome) { toast('Informe o nome.'); return; }
      if (!ings.length) { toast('Adicione ao menos um ingrediente.'); return; }
      if (!(porcoes > 0)) { toast('Rendimento deve ser maior que zero.'); return; }
      if (pf !== null && !(pf > 0)) { toast('Peso final inválido.'); return; }
      const campos = { nome, porcoes, pesoFinal: pf, favorito: form.favorito.checked, ingredientes: ings, atualizadoEm: new Date().toISOString() };
      if (r) Object.assign(r, campos); else D.receitas.push({ id: uid(), ...campos, criadoEm: campos.atualizadoEm });
      D.receitas.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
      salvar(); fecharFolha(); render(); toast(r ? 'Receita atualizada.' : 'Receita salva.');
    });
    if (r) $('[data-del]', s).addEventListener('click', () => { if (!confirmar(`Excluir a receita “${r.nome}”? Registros antigos não mudam.`)) return; D.receitas = D.receitas.filter((x) => x !== r); D.recentes = D.recentes.filter((x) => !(x.tipo === 'receita' && x.id === r.id)); salvar(); fecharFolha(); render(); });
  });
}
function folhaEscolherIngrediente(aoEscolher, aoCancelar) {
  let busca = '';
  const desenhar = (s) => {
    const q = busca.trim().toLowerCase();
    const lista = D.alimentos.filter((a) => !q || (a.nome + ' ' + (a.marca || '')).toLowerCase().includes(q));
    $('.lista', s).innerHTML = (lista.length ? lista.map((a) => itemListaAlimento(a, 'pick')).join('') : '<div class="empty">Nenhum alimento encontrado.</div>')
      + `<button class="list-item" data-act="novo"><div class="grow"><div class="name" style="color:var(--brand)">+ Cadastrar novo alimento</div></div></button>`;
    $$('[data-act="pick"]', s).forEach((b) => b.addEventListener('click', () => aoEscolher(D.alimentos.find((a) => a.id === b.dataset.id))));
    $('[data-act="novo"]', s).addEventListener('click', () => folhaAlimento(null, { nome: busca.trim() }, (novo) => aoEscolher(novo)));
  };
  abrirFolha(`${cab('Escolher ingrediente')}<input class="search" type="search" placeholder="Buscar alimento" aria-label="Buscar"><div class="lista"></div>`, (s) => {
    $('.search', s).addEventListener('input', (e) => { busca = e.target.value; desenhar(s); }); desenhar(s);
    $('[data-fechar]', s).addEventListener('click', aoCancelar);
    setTimeout(() => $('.search', s).focus(), 50);
  });
}

// ----- Detalhe de alimento / receita (na aba Alimentos) -----
function menuAlimento(id) {
  const a = D.alimentos.find((x) => x.id === id); if (!a) return;
  menu(rotuloAlimento(a), [
    { rotulo: 'Registrar em uma refeição de ' + rotuloData(UI.data).toLowerCase(), acao: () => menu('Em qual refeição?', obterDia(UI.data).refeicoes.map((r, i) => ({ rotulo: r.nome, acao: () => adicionarItem(i, 'alimento', id) }))) },
    { rotulo: 'Editar / excluir', acao: () => folhaAlimento(id) },
    { rotulo: a.favorito ? 'Remover dos favoritos' : 'Marcar como favorito', acao: () => { a.favorito = !a.favorito; salvar(); render(); } },
  ]);
}
function menuReceita(id) {
  const r = D.receitas.find((x) => x.id === id); if (!r) return;
  menu(r.nome, [
    { rotulo: 'Registrar em uma refeição de ' + rotuloData(UI.data).toLowerCase(), acao: () => menu('Em qual refeição?', obterDia(UI.data).refeicoes.map((m, i) => ({ rotulo: m.nome, acao: () => adicionarItem(i, 'receita', id) }))) },
    { rotulo: 'Editar / excluir', acao: () => folhaReceita(id) },
    { rotulo: r.favorito ? 'Remover dos favoritos' : 'Marcar como favorita', acao: () => { r.favorito = !r.favorito; salvar(); render(); } },
  ]);
}

// ---------- Backup ----------
function baixar(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportarJSON() { baixar(`meu-prato-backup-${hojeISO()}${modoDemo() ? '-demo' : ''}.json`, JSON.stringify({ ...D, exportadoEm: new Date().toISOString(), app: 'Meu Prato' }, null, 2), 'application/json'); toast('Backup gerado.'); }
function exportarCSV() {
  const linhas = [['data', 'refeicao', 'alimento', 'tipo', 'quantidade', 'unidade', 'kcal', 'proteina_g', 'carboidrato_g', 'gordura_g', 'dia_concluido']];
  const datas = Object.keys(D.dias).sort();
  for (const data of datas) for (const r of D.dias[data].refeicoes) for (const it of r.itens)
    linhas.push([data, r.nome, it.rotulo, it.tipo, it.qtd, it.unidade, it.kcal.toFixed(1), it.prot.toFixed(2), it.carb.toFixed(2), it.gord.toFixed(2), D.dias[data].concluido ? 'sim' : 'nao']);
  const cel = (v) => { const s = String(v).replace(/\./g, ',' ); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  // Números com vírgula decimal e separador ";" para abrir direto no Excel/LibreOffice em pt-BR.
  const csv = '﻿' + linhas.map((l) => l.map((v, i) => (typeof v === 'number' || (i >= 6 && i <= 9)) ? String(v).replace('.', ',') : cel(v)).join(';')).join('\r\n');
  baixar(`meu-prato-historico-${hojeISO()}.csv`, csv, 'text/csv;charset=utf-8'); toast(linhas.length - 1 ? 'CSV gerado.' : 'CSV gerado (sem registros).');
}
function importarJSON(arquivo) {
  const leitor = new FileReader();
  leitor.onload = () => {
    let obj; try { obj = JSON.parse(leitor.result); } catch { alert('Arquivo não é um JSON válido.'); return; }
    const v = validarDados(obj); if (!v.ok) { alert('Backup inválido: ' + v.erro); return; }
    const nDias = Object.values(obj.dias).filter(diaTemRegistro).length;
    const atual = `Dados atuais: ${D.alimentos.length} alimentos, ${D.receitas.length} receitas, ${Object.values(D.dias).filter(diaTemRegistro).length} dias com registro.`;
    const novo = `Backup: ${obj.alimentos.length} alimentos, ${obj.receitas.length} receitas, ${nDias} dias com registro${obj.exportadoEm ? ` (exportado em ${new Date(obj.exportadoEm).toLocaleString('pt-BR')})` : ''}.`;
    if (!confirmar(`${novo}\n\n${atual}\n\nSUBSTITUIR os dados atuais pelo backup? Esta ação não pode ser desfeita.`)) return;
    D = normalizar(obj); salvar(); UI.data = hojeISO(); render(); toast('Backup importado.');
  };
  leitor.readAsText(arquivo);
}

// ---------- Alimentos comuns (TACO) ----------
function importarAlimentosBase() {
  const existentes = new Set(D.alimentos.map((a) => a.nome.toLowerCase()));
  const novos = ALIMENTOS_BASE.filter((b) => !existentes.has(b.nome.toLowerCase()));
  if (!novos.length) { toast('Esses alimentos já estão cadastrados.'); return; }
  if (!confirmar(`Adicionar ${novos.length} alimento(s) da ${FONTE_TACO}, por 100 g?\n\n${novos.map((b) => `• ${b.nome}`).join('\n')}\n\nVocê pode conferir e corrigir cada valor depois.`)) return;
  for (const b of novos) D.alimentos.push({ id: uid(), nome: b.nome, marca: '', estado: b.estado, refQtd: 100, refUnidade: 'g', kcal: b.kcal, prot: b.prot, carb: b.carb, gord: b.gord, medidas: [], favorito: false, fonte: FONTE_TACO, criadoEm: new Date().toISOString() });
  D.alimentos.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
  salvar(); UI.aba = 'alimentos'; UI.filtroAlimentos = 'todos'; render(); toast(`${novos.length} alimento(s) adicionado(s).`);
}

// ---------- Demonstração ----------
function semearDemo(d) {
  const mk = (nome, marca, refQtd, refUnidade, kcal, prot, carb, gord, medidas = [], estado = 'na', favorito = false) => ({ id: uid(), nome, marca, estado, refQtd, refUnidade, kcal, prot, carb, gord, medidas, favorito, criadoEm: new Date().toISOString() });
  const ovo = mk('Ovo de galinha (exemplo)', '', 100, 'g', 143, 13, 1, 10, [{ nome: 'unidade', equivale: 50 }], 'cozido', true);
  const pao = mk('Pão francês (exemplo)', '', 100, 'g', 300, 8, 58, 3, [{ nome: 'unidade', equivale: 50 }]);
  const arroz = mk('Arroz branco cozido (exemplo)', '', 100, 'g', 128, 2.5, 28, 0.2, [{ nome: 'colher de servir', equivale: 45 }], 'cozido');
  const feijao = mk('Feijão carioca cozido (exemplo)', '', 100, 'g', 76, 4.8, 13.6, 0.5, [{ nome: 'concha', equivale: 80 }], 'cozido');
  const frango = mk('Peito de frango grelhado (exemplo)', '', 100, 'g', 159, 32, 0, 2.5, [], 'cozido', true);
  const whey = mk('Whey protein (exemplo)', 'Marca X', 30, 'g', 120, 24, 3, 2, [{ nome: 'scoop', equivale: 30 }], 'na', true);
  const iog = mk('Iogurte natural (exemplo)', '', 100, 'g', 60, 4, 5, 3);
  d.alimentos.push(ovo, pao, arroz, feijao, frango, whey, iog);
  d.alimentos.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
  const ing = (a, qtd, unidade) => ({ alimentoId: a.id, rotulo: a.nome, qtd, unidade, ...nutrientesAlimentoDe(a, qtd, unidade) });
  d.receitas.push({ id: uid(), nome: 'Pão com ovo (exemplo)', porcoes: 1, pesoFinal: null, favorito: true, ingredientes: [ing(pao, 1, 'unidade'), ing(ovo, 1, 'unidade')], criadoEm: new Date().toISOString() },
    { id: uid(), nome: 'Iogurte com whey (exemplo)', porcoes: 1, pesoFinal: 230, favorito: false, ingredientes: [ing(iog, 200, 'g'), ing(whey, 1, 'scoop')], criadoEm: new Date().toISOString() });
  const hoje = hojeISO();
  for (let i = 1; i <= 5; i++) {
    const iso = somarDias(hoje, -i);
    const dia = { refeicoes: REFEICOES_PADRAO.map((n) => ({ id: uid(), nome: n, itens: [] })), concluido: i !== 2 };
    const add = (ref, a, qtd, unidade) => dia.refeicoes[ref].itens.push({ id: uid(), tipo: 'alimento', refId: a.id, rotulo: a.nome, qtd, unidade, criadoEm: new Date().toISOString(), ...nutrientesAlimentoDe(a, qtd, unidade) });
    add(0, pao, 2, 'unidade'); add(0, ovo, 2, 'unidade'); add(1, arroz, 150 + i * 10, 'g'); add(1, feijao, 1, 'concha'); add(1, frango, 150, 'g'); add(2, whey, 1, 'scoop'); add(3, frango, 120, 'g'); add(3, arroz, 100, 'g');
    d.dias[iso] = dia;
  }
}
function nutrientesAlimentoDe(a, qtd, unidade) { const u = [{ nome: a.refUnidade, fator: 1 }, ...a.medidas.map((m) => ({ nome: m.nome, fator: m.equivale }))].find((x) => x.nome === unidade); const f = (qtd * u.fator) / a.refQtd; return { kcal: a.kcal * f, prot: a.prot * f, carb: a.carb * f, gord: a.gord * f }; }
function alternarDemo() {
  const entrando = !modoDemo();
  try { if (entrando) localStorage.setItem(CHAVE_MODO, 'demo'); else localStorage.removeItem(CHAVE_MODO); } catch { toast('Sem acesso ao armazenamento.'); return; }
  D = carregar(); if (entrando) salvar(); UI.data = hojeISO(); UI.aba = 'hoje'; render();
  toast(entrando ? 'Modo demonstração ativado.' : 'De volta aos seus dados reais.');
}

// ---------- Eventos ----------
document.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab'); if (tab) { UI.aba = tab.dataset.tab; render(); return; }
  const el = e.target.closest('[data-act]'); if (!el || el.closest('#sheet-root')) return;
  const act = el.dataset.act;
  const acoes = {
    'dia-ant': () => { UI.data = somarDias(UI.data, -1); render(); },
    'dia-prox': () => { UI.data = somarDias(UI.data, 1); render(); },
    'ir-hoje': () => { UI.data = hojeISO(); render(); },
    'adicionar': () => { const idx = Number(el.dataset.idx); obterDia(UI.data); folhaEscolher(idx, (tipo, id) => adicionarItem(idx, tipo, id)); },
    'editar-item': () => folhaItem(Number(el.dataset.idx), el.dataset.item),
    'menu-refeicao': () => { obterDia(UI.data); menuRefeicao(Number(el.dataset.idx)); },
    'nova-refeicao': () => { const n = prompt('Nome da nova refeição:', 'Ceia'); if (n && n.trim()) { obterDia(UI.data).refeicoes.push({ id: uid(), nome: n.trim(), itens: [] }); salvar(); render(); } },
    'filtro-alimentos': () => { UI.filtroAlimentos = el.dataset.f; render(); },
    'novo-alimento': () => folhaAlimento(null),
    'nova-receita': () => folhaReceita(null),
    'abrir-alimento': () => menuAlimento(el.dataset.id),
    'abrir-receita': () => menuReceita(el.dataset.id),
    'hist-dias': () => { UI.histDias = Number(el.dataset.n); render(); },
    'abrir-dia': () => { UI.data = el.dataset.data; UI.aba = 'hoje'; render(); },
    'exportar-json': exportarJSON,
    'exportar-csv': exportarCSV,
    'importar-json': () => $('[data-act="arquivo-json"]').click(),
    'alternar-demo': alternarDemo,
    'importar-base': importarAlimentosBase,
    'apagar-tudo': () => { if (!confirmar('Apagar TODOS os alimentos, receitas e registros deste modo? Não dá para desfazer. Exporte um backup antes, se quiser.')) return; if (!confirmar('Confirma mesmo? Última chance.')) return; D = dadosVazios(); salvar(); render(); toast('Dados apagados.'); },
  };
  if (acoes[act]) acoes[act]();
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-act]'); if (!el || el.closest('#sheet-root')) return;
  if (el.dataset.act === 'data' && el.value) { UI.data = el.value; render(); }
  if (el.dataset.act === 'concluir') { const dia = obterDia(UI.data); dia.concluido = el.checked; salvar(); toast(el.checked ? 'Dia marcado como concluído.' : 'Dia reaberto.'); }
  if (el.dataset.act === 'arquivo-json' && el.files[0]) { importarJSON(el.files[0]); el.value = ''; }
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-act="busca-alimentos"]'); if (!el) return;
  UI.buscaAlimentos = el.value; const pos = el.selectionStart; render(); const novo = $('[data-act="busca-alimentos"]'); novo.focus(); novo.setSelectionRange(pos, pos);
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-form]'); if (!f || f.closest('#sheet-root')) return;
  e.preventDefault();
  if (f.dataset.form === 'metas') {
    const kcal = num(f.kcal.value), prot = num(f.prot.value);
    const carb = f.carb.value.trim() === '' ? null : num(f.carb.value), gord = f.gord.value.trim() === '' ? null : num(f.gord.value);
    if (!(kcal > 0) || !(prot > 0)) { toast('Calorias e proteínas devem ser números maiores que zero.'); return; }
    if ((carb !== null && !(carb >= 0)) || (gord !== null && !(gord >= 0))) { toast('Valor inválido em carboidratos ou gorduras.'); return; }
    D.config.metas = { kcal, prot, carb, gord }; salvar(); toast('Metas salvas.');
  }
  if (f.dataset.form === 'refeicoes') {
    const lista = f.lista.value.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!lista.length) { toast('Informe ao menos uma refeição.'); return; }
    D.config.refeicoesPadrao = lista; salvar(); toast('Refeições padrão salvas.');
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharFolha(); });
// Se o app ficou aberto de um dia para o outro, volta para a data atual ao retomar.
document.addEventListener('visibilitychange', () => { if (!document.hidden && UI.aba === 'hoje' && UI.data === UI._ultimoHoje) { UI.data = hojeISO(); UI._ultimoHoje = UI.data; render(); } });
UI._ultimoHoje = hojeISO();

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

// Exposto para testes automatizados (não usado pela interface).
window.MeuPrato = { calc: { nutrientesAlimento, nutrientesReceita, totaisReceita }, dados: () => D, validar: validarDados };
render();
})();
