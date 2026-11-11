import { prepararQuadro } from './leitor.js';
import { NUTR, NUTR_OBRIG, NUTR_OPC, NUTRIENTES } from './nutrientes.js';
import { ALIMENTOS_BASE, FONTE_TACO, MODELOS_BASE } from './alimentos-base.js';
import { dataCurta, esc, filtrarOrdenar, fmt, fmtIn, hojeISO, num, pontuarBusca, rotuloData, somarDias, uid } from './util.js';
import { $, $$, confirmar, mostrarBannerErro, toast } from './dom.js';
import { escalar, nutrientesAlimento, nutrientesReceita, rotuloAlimento, somar, totaisReceita, unidadesAlimento, unidadesReceita } from './calculos.js';
import { brutoCorrompido, chaveAtual, D, modoDemo, salvar, UI, VERSAO_DADOS } from './estado.js';
import { aguaDia, aplicarBase, calcularLinha, diaTemRegistro, estadoBase, frequenciaPorRefeicao, lembrarPorcao, linhasDeItens, metasEm, obterDia, registrarRecente, resumoPeriodo, temAlgumaMeta, totaisDia, ultimaPorcao, ultimaRefeicaoAnterior } from './dominio.js';
import { consultarOFF, FONTE_OFF, mapearOFF, normalizarCodigo, temLeitor } from './off.js';

export function cartaoAgua(dia) {
  const total = aguaDia(dia), meta = D.config.metaAgua, copo = D.config.copoAgua;
  const pct = Math.max(0, Math.min(1, total / meta)); const falta = meta - total;
  const texto = falta > 0 ? `faltam ${fmt(falta)} ml` : falta === 0 ? 'meta do dia alcançada' : `${fmt(-falta)} ml além da meta`;
  const nivel = 118 - pct * 96; // copo vai de y=22 (cheio) a y=118 (vazio)
  const copos = Math.round(total / copo * 10) / 10;
  return `<section class="card agua">
    <div class="row" style="gap:16px">
      <svg class="copo" viewBox="0 0 80 130" width="76" height="124" aria-hidden="true">
        <defs><clipPath id="copo-clip"><path d="M12 10 L68 10 L62 118 Q61 124 55 124 L25 124 Q19 124 18 118 Z"/></clipPath></defs>
        <g clip-path="url(#copo-clip)">
          <rect x="0" y="0" width="80" height="130" fill="var(--agua-fundo)"/>
          <g class="onda" style="transform:translateY(${nivel}px)">
            <path fill="var(--agua)" d="M-80 6 Q-70 0 -60 6 T-40 6 T-20 6 T0 6 T20 6 T40 6 T60 6 T80 6 T100 6 T120 6 T140 6 T160 6 V140 H-80 Z"/>
          </g>
          <g class="onda onda2" style="transform:translateY(${nivel + 3}px)">
            <path fill="var(--agua)" opacity=".55" d="M-80 6 Q-70 0 -60 6 T-40 6 T-20 6 T0 6 T20 6 T40 6 T60 6 T80 6 T100 6 T120 6 T140 6 T160 6 V140 H-80 Z"/>
          </g>
        </g>
        <path d="M12 10 L68 10 L62 118 Q61 124 55 124 L25 124 Q19 124 18 118 Z" fill="none" stroke="var(--agua-borda)" stroke-width="3"/>
        ${[0.25, 0.5, 0.75].map((m) => `<line x1="58" x2="64" y1="${118 - m * 96}" y2="${118 - m * 96}" stroke="var(--agua-borda)" stroke-width="2" opacity=".6"/>`).join('')}
      </svg>
      <div class="grow">
        <div class="label muted small">Água</div>
        <div class="value" style="font-size:30px;font-weight:700;line-height:1.1">${fmt(total)} <small style="font-size:14px;font-weight:500" class="muted">/ ${fmt(meta)} ml</small></div>
        <div class="small" style="margin-top:4px">${texto} · ${fmt(copos, 1)} copo${copos === 1 ? '' : 's'} de ${fmt(copo)} ml</div>
        <div class="bar" style="margin-top:8px"><span style="width:${pct * 100}%;background:var(--agua)"></span></div>
      </div>
    </div>
    <div class="row" style="margin-top:12px;gap:8px">
      <button class="btn primary grow" data-act="agua-mais" data-ml="${copo}" style="background:var(--agua);border-color:var(--agua);white-space:nowrap">+ Copo</button>
      <button class="btn" data-act="agua-mais" data-ml="500">+ 500 ml</button>
      <button class="btn" data-act="agua-outro">Outro</button>
      <button class="btn icon" data-act="agua-desfazer" aria-label="Desfazer último registro de água" ${dia && dia.agua && dia.agua.length ? '' : 'disabled'}>↶</button>
    </div>
  </section>`;
}
// ---------- Estado de interface ----------
// (UI é declarado antes de carregar(), no topo.)

export function render() {
  $('#demo-banner').hidden = !modoDemo(); mostrarBannerErro();
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === UI.aba));
  const app = $('#app');
  if (UI.aba === 'hoje') app.innerHTML = telaHoje();
  else if (UI.aba === 'alimentos') app.innerHTML = telaAlimentos();
  else if (UI.aba === 'historico') app.innerHTML = telaHistorico();
  else app.innerHTML = telaConfig();
  window.scrollTo(0, 0);
}

// ---------- Tela: Hoje ----------
export function telaHoje() {
  const dia = obterDia(UI.data, false);
  const t = totaisDia(dia);
  const m = metasEm(UI.data);
  const saldoTxt = m.kcal ? ((m.kcal - t.kcal) >= 0 ? `${fmt(m.kcal - t.kcal)} kcal disponíveis` : `${fmt(t.kcal - m.kcal)} kcal além da meta`) : 'sem meta definida';
  const protTxt = m.prot ? ((m.prot - t.prot) >= 0 ? `faltam ${fmt(m.prot - t.prot)} g` : `${fmt(t.prot - m.prot)} g além da meta`) : 'sem meta definida';
  const pct = (v, meta) => meta > 0 ? Math.min(100, (v / meta) * 100) : 0;
  const macro = (nome, v, meta, k) => `<button class="macro-btn" data-act="detalhe" data-n="${k}"><span class="muted">${nome}</span> <b>${fmt(v)} g</b>${meta ? `<span class="muted"> de ${fmt(meta)}</span>` : ''}</button>`;
  const nItens = dia ? dia.refeicoes.reduce((a, r) => a + r.itens.length, 0) : 0;
  const opc = (k) => { const d = NUTR.find((n) => n.k === k); const c = t.cob[k]; const txt = nItens === 0 ? '–' : c.conhecidos === 0 ? 'não informado' : `${fmt(t[k], d.dec)} ${d.un}`; const cobTxt = nItens && c.conhecidos < c.total ? ` <span class="muted small">(dados em ${c.conhecidos} de ${c.total})</span>` : ''; return `<button class="macro-btn" data-act="detalhe" data-n="${k}"><span class="muted">${d.nome}</span> <b>${txt}</b>${m[k] && c.conhecidos ? `<span class="muted"> de ${fmt(m[k], d.dec)}</span>` : ''}${cobTxt}</button>`; };
  const semMetas = !temAlgumaMeta(m);
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
      <button class="stat" data-act="detalhe" data-n="kcal"><div class="label">Calorias</div><div class="value">${fmt(t.kcal)}${m.kcal ? '' : ' <small>kcal</small>'}</div>${m.kcal ? `<div class="sub muted">de ${fmt(m.kcal)} kcal</div>` : ''}<div class="sub">${saldoTxt}</div>${m.kcal ? `<div class="bar"><span style="width:${pct(t.kcal, m.kcal)}%"></span></div>` : ''}</button>
      <button class="stat prot" data-act="detalhe" data-n="prot"><div class="label">Proteínas</div><div class="value">${fmt(t.prot)} <small>g</small></div>${m.prot ? `<div class="sub muted">de ${fmt(m.prot, 1)} g</div>` : ''}<div class="sub">${protTxt}</div>${m.prot ? `<div class="bar"><span style="width:${pct(t.prot, m.prot)}%"></span></div>` : ''}</button>
    </div>
    <div class="macros">${macro('Carboidratos', t.carb, m.carb, 'carb')}${macro('Gorduras', t.gord, m.gord, 'gord')}</div>
    <div class="macros opc" style="margin-top:6px">${opc('fibra')}${opc('sodio')}<span class="muted small" style="margin-left:auto">toque para detalhar</span></div>
    ${semMetas ? `<p class="help" style="margin:10px 0 0">Sem metas para ${UI.data === hojeISO() ? 'hoje' : 'esta data'}. Metas são referências que você escolhe, não uma recomendação do app. <button class="btn sm" data-act="ir-config" style="margin-left:6px">Definir em Ajustes</button></p>` : ''}
  </section>
  ${cartaoAgua(dia)}
  ${refeicoes.map((r, i) => {
    const st = somar(r.itens);
    return `<section class="card meal" data-ref="${r.id ?? ''}" data-idx="${i}">
      <div class="meal-head">
        <div class="grow"><h2>${esc(r.nome)}</h2><div class="meal-sub">${r.itens.length ? `${fmt(st.kcal)} kcal · <span style="color:var(--prot)">P ${fmt(st.prot, 1)}</span> · C ${fmt(st.carb, 1)} · G ${fmt(st.gord, 1)} g` : 'Nada registrado'}</div></div>
        <button class="btn icon ghost" data-act="menu-refeicao" data-idx="${i}" aria-label="Opções da refeição">⋯</button>
      </div>
      ${r.itens.map((it) => `<button class="entry" data-act="editar-item" data-idx="${i}" data-item="${it.id}">
          <div class="grow"><div class="name ellipsis">${esc(it.rotulo)}</div><div class="qty">${fmt(it.qtd, 2)} ${esc(it.unidade)}</div></div>
          <div class="nums"><div>${fmt(it.kcal)} kcal</div><div class="p">${fmt(it.prot, 1)} g prot</div></div>
        </button>`).join('')}
      <div class="row" style="gap:0"><button class="meal-add grow" data-act="adicionar" data-idx="${i}">+ Adicionar alimento</button>${!r.itens.length && ultimaRefeicaoAnterior(r.nome, UI.data) ? `<button class="meal-add" style="width:auto;color:var(--muted)" data-act="repetir" data-idx="${i}">↻ Repetir última</button>` : ''}</div>
    </section>`;
  }).join('')}
  <button class="btn full" data-act="nova-refeicao">+ Nova refeição neste dia</button>
  <div style="height:12px"></div>
  <label class="check card" style="margin-top:12px"><input type="checkbox" data-act="concluir" ${dia && dia.concluido ? 'checked' : ''}> <span><b>Dia concluído</b><br><span class="small muted">Só dias concluídos entram nas médias do histórico.</span></span></label>`;
}

// ---------- Tela: Alimentos ----------
export function telaAlimentos() {
  const f = UI.filtroAlimentos; const q = UI.buscaAlimentos.trim();
  let html = `<div class="topbar"><h1 class="title">Alimentos e receitas</h1></div>
  <input class="search" type="search" placeholder="Buscar por nome ou marca" value="${esc(UI.buscaAlimentos)}" data-act="busca-alimentos" aria-label="Buscar">
  <div class="chips">${[['todos', 'Todos'], ['favoritos', 'Favoritos'], ['receitas', 'Receitas'], ['combinacoes', 'Combinações']].map(([k, n]) => `<button class="chip ${f === k ? 'active' : ''}" data-act="filtro-alimentos" data-f="${k}">${n}</button>`).join('')}</div>
  <div class="grid3" style="margin-bottom:12px"><button class="btn primary" data-act="novo-alimento">+ Alimento</button><button class="btn" data-act="nova-receita">+ Receita</button><button class="btn" data-act="ler-codigo">▥ Código</button></div>
  <section class="card">`;
  const itens = [];
  if (f === 'combinacoes') {
    html += (D.combinacoes.length ? filtrarOrdenar(D.combinacoes, q, (c) => c.nome).map((c) => itemListaCombinacao(c, 'abrir-combinacao')).join('') : '<div class="empty">Nenhuma combinação salva. Na tela Hoje, no menu ⋯ de uma refeição com itens, use “Salvar como combinação”. Uma combinação reúne consumos independentes (editáveis um a um); receita tem ingredientes e rendimento.</div>') + '</section>';
    return html;
  }
  if (f !== 'receitas') for (const a of filtrarOrdenar(D.alimentos.filter((a) => f !== 'favoritos' || a.favorito), q, (a) => a.nome, (a) => a.marca)) itens.push(itemListaAlimento(a, 'abrir-alimento'));
  for (const r of filtrarOrdenar(D.receitas.filter((r) => f !== 'favoritos' || r.favorito), q, (r) => r.nome)) itens.push(itemListaReceita(r, 'abrir-receita'));
  html += itens.length ? itens.join('') : `<div class="empty">${D.alimentos.length || D.receitas.length ? 'Nada encontrado com esse filtro.' : 'Nenhum alimento cadastrado ainda. Toque em “+ Alimento” para começar.'}</div>` + (D.alimentos.length ? '' : `<button class="btn full" data-act="importar-base" style="margin-top:8px">Adicionar alimentos comuns (TACO)</button>`);
  html += `</section>`;
  return html;
}
export function itemListaAlimento(a, act, extra = '') {
  const estado = a.estado && a.estado !== 'na' ? ` · ${a.estado}` : '';
  return `<button class="list-item" data-act="${act}" data-id="${a.id}" ${extra}>
    <div class="grow"><div class="name">${a.favorito ? '<span class="star">★</span> ' : ''}${esc(a.nome)}${a.marca ? ` <span class="muted">· ${esc(a.marca)}</span>` : ''}</div>
    <div class="meta">${fmt(a.kcal)} kcal · ${fmt(a.prot, 1)} g prot por ${fmt(a.refQtd, 2)} ${esc(a.refUnidade)}${estado}${a.fonte ? ` · <span class="badge neutral">${esc(a.fonte)}</span>` : ''}${a.codigoBarras ? ' · ▥' : ''}</div></div><span class="muted">›</span></button>`;
}
export function itemListaReceita(r, act, extra = '') {
  const t = totaisReceita(r, D.alimentos); const pp = r.porcoes > 0 ? t.kcal / r.porcoes : 0; const pr = r.porcoes > 0 ? t.prot / r.porcoes : 0;
  return `<button class="list-item" data-act="${act}" data-id="${r.id}" ${extra}>
    <div class="grow"><div class="name">${r.favorito ? '<span class="star">★</span> ' : ''}${esc(r.nome)} <span class="badge">receita</span></div>
    <div class="meta">${fmt(pp)} kcal · ${fmt(pr, 1)} g prot por porção · rende ${fmt(r.porcoes, 2)}${r.pesoFinal ? ` · ${fmt(r.pesoFinal)} g no total` : ''}</div></div><span class="muted">›</span></button>`;
}

export function telaHistorico() {
  const n = UI.histDias; const hoje = hojeISO();
  const atual = resumoPeriodo(hoje, n); const anterior = resumoPeriodo(somarDias(hoje, -n), n);
  let maxK = Math.max(1, ...atual.linhas.map((l) => l.t.kcal), ...atual.linhas.map((l) => l.m.kcal || 0));
  const linhaMedia = (k, nome, un, dec) => { const a = atual.media(k), b = anterior.media(k); return `<tr><td>${nome}</td><td><b>${a == null ? '–' : fmt(a, dec) + ' ' + un}</b><div class="small muted">${atual.denom(k)} ${atual.denom(k) === 1 ? 'dia' : 'dias'}</div></td><td>${b == null ? '–' : fmt(b, dec) + ' ' + un}<div class="small muted">${anterior.denom(k)} ${anterior.denom(k) === 1 ? 'dia' : 'dias'}</div></td></tr>`; };
  return `<div class="topbar"><h1 class="title">Histórico</h1></div>
  <div class="chips">${[7, 30].map((k) => `<button class="chip ${n === k ? 'active' : ''}" data-act="hist-dias" data-n="${k}">Últimos ${k} dias</button>`).join('')}</div>
  <section class="card">
    <h2>Médias dos dias concluídos</h2>
    <p class="help">Só dias marcados como concluídos entram. Fibras e sódio: só dias em que todos os registros informaram o valor. Água: dias concluídos com água registrada. Cada média mostra seu próprio número de dias.</p>
    ${atual.concl || anterior.concl ? `<table class="tabela"><thead><tr><th></th><th>Últimos ${n} dias</th><th>${n} anteriores</th></tr></thead><tbody>
      ${linhaMedia('kcal', 'Calorias', 'kcal', 0)}${linhaMedia('prot', 'Proteínas', 'g', 0)}${linhaMedia('carb', 'Carboidratos', 'g', 0)}${linhaMedia('gord', 'Gorduras', 'g', 0)}${linhaMedia('fibra', 'Fibras', 'g', 1)}${linhaMedia('sodio', 'Sódio', 'mg', 0)}${linhaMedia('agua', 'Água', 'ml', 0)}
    </tbody></table>` : ''}
    <p class="help" style="margin-bottom:0">${atual.concl ? `${atual.comRef} de ${n} dias concluídos com refeições${atual.soAgua ? ` · ${atual.soAgua} só com água` : ''}${atual.semReg ? ` · ${atual.semReg} sem registro` : ''}. Dias sem registro não entram como zero.` : `Nenhum dia concluído nos últimos ${n} dias. Marque “Dia concluído” na tela Hoje para incluir um dia na média.`}</p>
  </section>
  <section class="card">
    ${atual.linhas.map(({ iso, dia, tem, t, ml, m }) => `<button class="hist-row" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left;color:inherit" data-act="abrir-dia" data-data="${iso}">
      <div class="d">${esc(dataCurta(iso))}</div>
      ${tem || ml ? `<div class="bars"><div class="small">${tem ? `${fmt(t.kcal)} kcal · <span style="color:var(--prot)">${fmt(t.prot)} g prot</span>` : '<span class="muted">Só água</span>'}${ml ? ` · <span style="color:var(--agua)">${fmt(ml)} ml</span>` : ''}</div>${tem ? `<div class="bar"><span style="width:${Math.min(100, t.kcal / maxK * 100)}%"></span>${m.kcal ? `<i class="meta-marca" style="left:${Math.min(100, m.kcal / maxK * 100)}%"></i>` : ''}</div><div class="bar p"><span style="width:${m.prot ? Math.min(100, t.prot / m.prot * 100) : 0}%"></span></div>` : ''}</div>` : `<div class="muted small">Sem registros</div>`}
      <div class="st">${tem || ml ? (dia.concluido ? '<span class="badge">concluído</span>' : '<span class="badge neutral">em aberto</span>') : ''}</div>
    </button>`).join('')}
    <p class="help" style="margin:10px 0 0">Barra verde: calorias na escala do período, com a marca da meta vigente naquele dia. Barra azul: proteína em relação à meta do dia (sem meta, vazia).</p>
  </section>`;
}

// ---------- Tela: Configurações ----------
export function telaConfig() {
  const m = D.config.metas; const hm = D.config.historicoMetas || []; const vig = hm.length ? hm[hm.length - 1] : null;
  let usoKB = 0; try { usoKB = Math.round((localStorage.getItem(chaveAtual()) || '').length / 1024); } catch { /* ignore */ }
  return `<div class="topbar"><h1 class="title">Configurações</h1></div>
  <section class="card">
    <h2>Metas diárias</h2>
    <p class="help">Referências escolhidas por você (com quem te orienta, se for o caso). O app não calcula dieta nem recomenda valores. Todas são opcionais: sem meta, a tela mostra só o consumo. Sódio funciona como limite.</p>
    <form data-form="metas">
      <div class="grid2">
        ${NUTR.map((n) => `<div class="field"><label>${n.nome} (${n.un})${n.k === 'sodio' ? ' — limite' : ''}</label><input name="${n.k}" inputmode="decimal" value="${m[n.k] != null ? fmtIn(m[n.k], 2) : ''}" placeholder="sem meta"></div>`).join('')}
      </div>
      <button class="btn primary full" type="submit">Salvar metas a partir de hoje</button>
      <p class="help" style="margin:8px 0 0">${vig ? `Vigência atual desde ${vig.desde === '1970-01-01' ? 'antes do registro de vigência' : dataCurta(vig.desde)}${hm.length > 1 ? ` · ${hm.length} alterações registradas` : ''}. Dias anteriores continuam comparados com a meta que valia neles.` : 'Nenhuma meta registrada ainda.'}</p>
    </form>
  </section>
  <section class="card">
    <h2>Água</h2>
    <form data-form="agua"><div class="grid2">
      <div class="field"><label>Meta diária (ml)</label><input name="meta" inputmode="numeric" value="${fmtIn(D.config.metaAgua)}" required></div>
      <div class="field"><label>Tamanho do copo (ml)</label><input name="copo" inputmode="numeric" value="${fmtIn(D.config.copoAgua)}" required></div>
    </div><button class="btn full" type="submit">Salvar água</button></form>
  </section>
  <section class="card">
    <h2>Refeições padrão</h2>
    <p class="help">Uma por linha. Vale para dias novos; dias já criados não mudam.</p>
    <form data-form="refeicoes"><div class="field"><textarea name="lista" rows="4" style="min-height:100px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);width:100%">${esc(D.config.refeicoesPadrao.join('\n'))}</textarea></div><button class="btn full" type="submit">Salvar refeições padrão</button></form>
  </section>
  <section class="card">
    <h2>Alimentos comuns</h2>
    <p class="help">Adiciona ${ALIMENTOS_BASE.length} alimentos do dia a dia (ovo, arroz, feijão, frango, carne, pães, laticínios, frutas, legumes, azeite) com valores por 100 g copiados da ${FONTE_TACO}. Entram como cadastro normal: confira e corrija se o seu produto for diferente. Itens já cadastrados não se repetem.</p>
    <button class="btn full" data-act="importar-base">Adicionar alimentos comuns (TACO)</button>
    <p class="help" style="margin-top:12px">Suplementos variam por marca, então não têm valor embutido. O modelo abaixo abre o cadastro já com porção e scoop para você copiar o rótulo.</p>
    ${MODELOS_BASE.map((m, i) => `<button class="btn full" data-act="modelo" data-i="${i}">Cadastrar ${esc(m.nome)} (do rótulo)</button>`).join('')}
  </section>
  <section class="card">
    <h2>Código de barras</h2>
    <p class="help">O leitor usa a câmera pelo próprio navegador (Chrome no Android). Ao ler um código novo, o app consulta o <b>Open Food Facts</b>, base aberta e colaborativa: envia só o código, recebe nome, marca e valores por 100 g, e abre o cadastro para você conferir com o rótulo antes de salvar. Produtos brasileiros nem sempre estão lá ou podem vir incompletos.</p>
    <label class="check"><input type="checkbox" data-act="toggle-off" ${D.config.consultarOFF ? 'checked' : ''}> <span>Consultar o Open Food Facts ao ler um código</span></label>
    <p class="small muted">Desligado, o código só fica salvo no alimento e o cadastro é todo manual.</p>
  </section>
  <section class="card">
    <h2>Dados e privacidade</h2>
    <p class="help">Tudo fica salvo <b>somente neste aparelho e neste navegador</b> (armazenamento local, ~${usoKB} KB em uso). Não há conta nem envio para servidor. Isso significa: trocar de celular, limpar os dados do navegador ou desinstalar o app apaga os registros. Faça backup em JSON com alguma frequência.</p>
    ${brutoCorrompido() ? `<div class="help" style="background:var(--warn-soft);padding:10px;border-radius:10px"><b>Dados anteriores preservados.</b> O conteúdo salvo antes estava ilegível${UI.dadosCorrompidos ? ` (${esc(UI.dadosCorrompidos.erro)})` : ''} e foi guardado à parte, sem ser apagado. Baixe-o para tentar recuperar; depois, se quiser, descarte.<div class="row" style="margin-top:8px"><button class="btn sm grow" data-act="baixar-corrompido">Baixar dados brutos</button><button class="btn sm danger" data-act="descartar-corrompido">Descartar</button></div></div>` : ''}
    <div class="stack">
      <button class="btn primary full" data-act="compartilhar-backup">Compartilhar backup (Drive, e-mail…)</button>
      <button class="btn full" data-act="exportar-json">Exportar backup (JSON)</button>
      <button class="btn full" data-act="importar-json">Importar backup (JSON)</button>
      <input type="file" accept="application/json,.json,text/plain,.txt" data-act="arquivo-json" hidden>
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
export function abrirFolha(html, aoMontar) {
  fecharFolha();
  const root = $('#sheet-root');
  root.innerHTML = `<div class="sheet-backdrop"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  $('#toast').classList.add('topo');
  const bd = $('.sheet-backdrop', root);
  bd.addEventListener('click', (e) => { if (e.target === bd) fecharFolha(); });
  $$('[data-fechar]', root).forEach((b) => b.addEventListener('click', fecharFolha));
  if (aoMontar) aoMontar($('.sheet', root));
}
export function fecharFolha() { $('#sheet-root').innerHTML = ''; $('#toast').classList.remove('topo'); }
export const cab = (titulo) => `<div class="sheet-head"><h2>${esc(titulo)}</h2><button class="btn icon ghost" data-fechar aria-label="Fechar">✕</button></div>`;

// Menu simples de opções
export function menu(titulo, opcoes) {
  abrirFolha(`${cab(titulo)}<div class="menu">${opcoes.map((o, i) => `<button data-i="${i}" class="${o.perigo ? 'danger' : ''}">${esc(o.rotulo)}</button>`).join('')}</div>`, (s) => {
    $$('.menu button', s).forEach((b) => b.addEventListener('click', () => { fecharFolha(); opcoes[Number(b.dataset.i)].acao(); }));
  });
}

// ----- Escolher alimento/receita para uma refeição -----
export function folhaEscolher(idxRefeicao, aoEscolher, resumo = '') {
  let filtro = 'recentes'; let busca = '';
  const lote = idxRefeicao !== null && idxRefeicao !== undefined; // modo lote só faz sentido ao montar uma refeição
  const nomeRef = lote ? (obterDia(UI.data, false)?.refeicoes[idxRefeicao]?.nome || null) : null;
  const freq = nomeRef ? frequenciaPorRefeicao(nomeRef) : new Map();
  const usado = (t, id) => { const n = freq.get(`${t}:${id}`); return n ? ` <span class="badge" title="Vezes que entrou em ${esc(nomeRef)} nos últimos 60 dias">${n}× ${n === 1 ? 'no' : 'no'} ${esc(nomeRef.toLowerCase())}</span>` : ''; };
  const rascunho = (lote && UI.rascunhoLote && UI.rascunhoLote.idx === idxRefeicao && UI.rascunhoLote.data === UI.data) ? UI.rascunhoLote.itens : [];
  let selecionando = rascunho.length > 0;
  const chave = (t, id) => `${t}:${id}`;
  const noRascunho = (t, id) => rascunho.some((x) => chave(x.tipo, x.id) === chave(t, id));
  const alternar = (t, id) => { const i = rascunho.findIndex((x) => chave(x.tipo, x.id) === chave(t, id)); if (i >= 0) rascunho.splice(i, 1); else rascunho.push({ tipo: t, id }); UI.rascunhoLote = { idx: idxRefeicao, data: UI.data, itens: rascunho }; };
  if (!D.recentes.length) filtro = D.alimentos.some((a) => a.favorito) || D.receitas.some((r) => r.favorito) ? 'favoritos' : 'todos';
  const desenhar = (s) => {
    const q = busca.trim();
    let lista = [];
    if (q) filtro = 'todos';
    if (filtro === 'recentes') {
      lista = D.recentes.map((x) => x.tipo === 'alimento' ? D.alimentos.find((a) => a.id === x.id) : Object.assign({ _receita: true }, D.receitas.find((r) => r.id === x.id))).filter((x) => x && x.id);
      // Com refeição conhecida, o que mais entrou nela vem primeiro (recência desempata).
      if (nomeRef && freq.size) lista = lista.map((x, i) => ({ x, i, f: freq.get(`${x._receita ? 'receita' : 'alimento'}:${x.id}`) || 0 })).sort((a, b) => b.f - a.f || a.i - b.i).map((o) => o.x);
    }
    else if (filtro === 'favoritos') lista = [...D.alimentos.filter((a) => a.favorito), ...D.receitas.filter((r) => r.favorito).map((r) => Object.assign({ _receita: true }, r))];
    else if (filtro === 'receitas') lista = D.receitas.map((r) => Object.assign({ _receita: true }, r));
    else if (filtro === 'combinacoes') lista = [];
    else lista = filtrarOrdenar([...D.alimentos, ...D.receitas.map((r) => Object.assign({ _receita: true }, r))], q, (x) => x.nome, (x) => x.marca || '');
    const marca = (t, id) => selecionando ? `<span class="marca ${noRascunho(t, id) ? 'on' : ''}" aria-hidden="true">${noRascunho(t, id) ? '✓' : ''}</span>` : '';
    const combos = filtro === 'combinacoes' ? (D.combinacoes.length ? D.combinacoes.map((c) => itemListaCombinacao(c, 'pick-combo')).join('') : '<div class="empty">Nenhuma combinação salva. No menu ⋯ de uma refeição com itens, use “Salvar como combinação”.</div>') : '';
    const comBadge = (html, t, id) => usado(t, id) ? html.replace('<div class="meta">', `<div class="meta">${usado(t, id)} · `) : html;
    $('.lista', s).innerHTML = combos + (filtro === 'combinacoes' ? '' : (lista.length ? lista.map((x) => x._receita ? comBadge(itemListaReceita(x, 'pick-receita', ''), 'receita', x.id).replace('<div class="grow">', marca('receita', x.id) + '<div class="grow">') : comBadge(itemListaAlimento(x, 'pick-alimento', ''), 'alimento', x.id).replace('<div class="grow">', marca('alimento', x.id) + '<div class="grow">')).join('')
      : `<div class="empty">${filtro === 'recentes' ? 'Nada usado recentemente.' : filtro === 'favoritos' ? 'Nenhum favorito ainda.' : 'Nada encontrado.'}</div>`)
      + `<button class="list-item" data-act="pick-novo"><div class="grow"><div class="name" style="color:var(--brand)">+ Cadastrar novo alimento${q ? ` “${esc(busca.trim())}”` : ''}</div></div></button>`
      + (D.alimentos.length ? '' : `<button class="list-item" data-act="pick-base"><div class="grow"><div class="name" style="color:var(--brand)">+ Adicionar alimentos comuns (TACO)</div><div class="meta">Arroz, feijão, ovo, frango, frutas… com valores da tabela oficial.</div></div></button>`));
    $$('.chip', s).forEach((c) => c.classList.toggle('active', c.dataset.f === filtro));
    const escolher = (t, id) => { if (selecionando) { alternar(t, id); desenhar(s); } else aoEscolher(t, id); };
    $$('[data-act="pick-alimento"]', s).forEach((b) => b.addEventListener('click', () => escolher('alimento', b.dataset.id)));
    $$('[data-act="pick-receita"]', s).forEach((b) => b.addEventListener('click', () => escolher('receita', b.dataset.id)));
    $$('[data-act="pick-combo"]', s).forEach((b) => b.addEventListener('click', () => { if (lote) menuCombinacao(b.dataset.id, idxRefeicao); else menuCombinacao(b.dataset.id); }));
    const barra = $('.barra-lote', s);
    if (barra) { barra.hidden = !selecionando; if (selecionando) { $('[data-revisar]', barra).textContent = rascunho.length ? `Revisar ${rascunho.length} ${rascunho.length === 1 ? 'item' : 'itens'}` : 'Toque nos itens para marcar'; $('[data-revisar]', barra).disabled = !rascunho.length; } $('[data-lote]', s).classList.toggle('active', selecionando); }
    $('[data-act="pick-base"]', s)?.addEventListener('click', () => folhaImportarBase(() => { if (lote) abrirSeletor(idxRefeicao); }));
    $('[data-act="pick-novo"]', s)?.addEventListener('click', () => folhaAlimento(null, { nome: busca.trim() }, (novo) => { if (selecionando) { alternar('alimento', novo.id); abrirSeletor(idxRefeicao); } else aoEscolher('alimento', novo.id); }));
  };
  abrirFolha(`${cab('Adicionar alimento')}
    ${resumo ? `<p class="help resumo-refeicao" style="margin-top:-6px">${esc(resumo)}</p>` : ''}
    <div class="row" style="margin-bottom:10px"><input class="search" type="search" placeholder="Buscar nos meus alimentos" aria-label="Buscar" autofocus style="margin:0"><button class="btn" data-act="pick-codigo" aria-label="Ler código de barras" title="Código de barras">▥</button></div>
    <div class="chips">${[['recentes', 'Recentes'], ['favoritos', 'Favoritos'], ['todos', 'Todos'], ['receitas', 'Receitas'], ['combinacoes', 'Combinações']].map(([k, n]) => `<button class="chip" data-f="${k}">${n}</button>`).join('')}${lote ? '<button class="chip" data-lote title="Selecionar vários">☑ Vários</button>' : ''}</div>
    <div class="lista"></div>
    ${lote ? `<div class="barra-lote row" hidden style="position:sticky;bottom:-16px;background:var(--card);padding:10px 0 4px;margin-top:8px;border-top:1px solid var(--line)"><button class="btn sm ghost" data-cancelar-lote>Cancelar</button><button class="btn primary grow" data-revisar>Revisar</button></div>` : ''}`, (s) => {
    $('.search', s).addEventListener('input', (e) => { busca = e.target.value; desenhar(s); });
    if (lote) {
      $('[data-lote]', s).addEventListener('click', () => { selecionando = !selecionando; if (!selecionando) { rascunho.length = 0; UI.rascunhoLote = null; } desenhar(s); });
      $('[data-cancelar-lote]', s).addEventListener('click', () => { selecionando = false; rascunho.length = 0; UI.rascunhoLote = null; desenhar(s); });
      $('[data-revisar]', s).addEventListener('click', () => {
        const linhas = rascunho.map(({ tipo, id }) => {
          const ref = tipo === 'alimento' ? D.alimentos.find((a) => a.id === id) : D.receitas.find((r) => r.id === id); if (!ref) return null;
          const un = tipo === 'alimento' ? unidadesAlimento(ref) : unidadesReceita(ref); const u = ultimaPorcao(tipo, id);
          const unidade = u && un.some((x) => x.nome === u.unidade) ? u.unidade : un[0].nome; const qtd = u && unidade === u.unidade ? u.qtd : (tipo === 'alimento' ? ref.refQtd : 1);
          const n = tipo === 'alimento' ? nutrientesAlimento(ref, qtd, unidade) : nutrientesReceita(ref, qtd, unidade, D.alimentos);
          return { tipo, refId: id, rotulo: tipo === 'alimento' ? rotuloAlimento(ref) : ref.nome, qtd, unidade, ...n, historico: false };
        }).filter(Boolean);
        const ref = obterDia(UI.data).refeicoes[idxRefeicao];
        folhaRevisar({ titulo: 'Revisar seleção', descricao: 'Quantidades sugeridas pela última porção usada ou pela referência do cadastro.', linhas, destino: `${ref.nome} de ${rotuloData(UI.data).toLowerCase()}`,
          aoConfirmar: (itens) => { UI.rascunhoLote = null; inserirLote(idxRefeicao, itens, { lote: true }); } });
      });
    }
    $('[data-act="pick-codigo"]', s).addEventListener('click', () => folhaCodigo((a) => aoEscolher('alimento', a.id)));
    $$('.chip', s).forEach((c) => c.addEventListener('click', () => { filtro = c.dataset.f; busca = ''; $('.search', s).value = ''; desenhar(s); }));
    desenhar(s);
    $('.search', s).focus();
  });
}

// ----- Quantidade (novo registro ou edição) -----
export function folhaQuantidade({ tipo, id, item, idxRefeicao, aoConfirmar, aoContinuar }) {
  const ref = tipo === 'alimento' ? D.alimentos.find((a) => a.id === id) : D.receitas.find((r) => r.id === id);
  if (!ref) { toast('Cadastro original não encontrado. Edite a quantidade a partir do registro.'); return; }
  const unidades = tipo === 'alimento' ? unidadesAlimento(ref) : unidadesReceita(ref);
  // Sugestão inicial: a última porção usada (se a unidade ainda existir), senão a referência do cadastro.
  const ultima = item ? null : ultimaPorcao(tipo, id);
  const ultimaValida = ultima && unidades.some((u) => u.nome === ultima.unidade);
  let avisoPorcao = '';
  if (ultima && !ultimaValida) avisoPorcao = `A medida “${ultima.unidade}” da última vez não existe mais neste cadastro; usando ${unidades[0].nome}.`;
  const qtdIni = item ? item.qtd : ultimaValida ? ultima.qtd : (tipo === 'alimento' ? ref.refQtd : 1);
  const uniIni = item && unidades.some((u) => u.nome === item.unidade) ? item.unidade : ultimaValida ? ultima.unidade : unidades[0].nome;
  const titulo = tipo === 'alimento' ? rotuloAlimento(ref) : ref.nome;
  const calc = (q, u) => tipo === 'alimento' ? nutrientesAlimento(ref, q, u) : nutrientesReceita(ref, q, u, D.alimentos);
  abrirFolha(`${cab(item ? 'Editar quantidade' : 'Quantidade')}
    <div style="font-weight:600;margin-bottom:10px">${esc(titulo)}</div>
    <div class="grid2">
      <div class="field"><label>Quantidade</label><input name="qtd" inputmode="decimal" value="${fmtIn(qtdIni, 3)}" autofocus></div>
      <div class="field"><label>Unidade</label><select name="uni">${unidades.map((u) => `<option value="${esc(u.nome)}" ${u.nome === uniIni ? 'selected' : ''}>${esc(u.nome)}${u.fator && u.fator !== 1 ? ` (${fmt(u.fator, 2)} ${esc(ref.refUnidade)})` : ''}</option>`).join('')}</select></div>
    </div>
    ${tipo === 'alimento' ? `<p class="help">Referência: ${fmt(ref.kcal)} kcal e ${fmt(ref.prot, 1)} g de proteína por ${fmt(ref.refQtd, 2)} ${esc(ref.refUnidade)}.${ref.medidas.length ? '' : ' Para usar unidade, colher ou scoop, cadastre a equivalência no alimento.'}</p>`
      : `<p class="help">Rende ${fmt(ref.porcoes, 2)} porção(ões)${ref.pesoFinal ? ` · ${fmt(ref.pesoFinal)} g no total` : ' · sem peso final informado, então só é possível registrar em porções'}.</p>`}
    ${ultimaValida ? `<p class="help ultima" style="margin-top:0">Última vez: <b>${fmt(ultima.qtd, 3)} ${esc(ultima.unidade)}</b>. Ajuste se for diferente.</p>` : ''}
    ${avisoPorcao ? `<p class="help" style="margin-top:0;background:var(--warn-soft);padding:8px 10px;border-radius:8px">${esc(avisoPorcao)}</p>` : ''}
    <div class="chips atalhos" aria-label="Atalhos de quantidade"></div>
    <div class="preview" aria-live="polite"></div>
    <button class="btn primary full" data-ok>${item ? 'Salvar' : 'Adicionar'}</button>
    ${aoContinuar ? '<button class="btn full" data-continuar style="margin-top:8px">Adicionar e continuar</button>' : ''}`, (s) => {
    const inQ = $('[name=qtd]', s), inU = $('[name=uni]', s), pv = $('.preview', s), ok = $('[data-ok]', s), cont = $('[data-continuar]', s), at = $('.atalhos', s);
    const ehBase = (u) => u === 'g' || u === 'ml';
    const atalhos = () => {
      const u = inU.value; const vals = ehBase(u) ? [50, 100, 150, 200, 250] : [0.5, 1, 1.5, 2, 3];
      const fator = ehBase(u) ? 1 : (unidades.find((x) => x.nome === u) || {}).fator;
      at.innerHTML = vals.map((v) => `<button type="button" class="chip" data-v="${v}">${fmt(v, 1)}${ehBase(u) ? ' ' + u : ''}${fator && fator !== 1 && tipo === 'alimento' ? ` <span class="muted">(${fmt(v * fator, 0)} ${esc(ref.refUnidade)})</span>` : ''}</button>`).join('');
      $$('.chip', at).forEach((c) => c.addEventListener('click', () => { inQ.value = fmtIn(Number(c.dataset.v), 3); atualizar(); inQ.focus(); }));
    };
    const atualizar = () => {
      const q = num(inQ.value);
      $$('.chip', at).forEach((c) => c.classList.toggle('active', Number(c.dataset.v) === q));
      if (!(q > 0)) { pv.innerHTML = '<span style="grid-column:1/-1">Informe uma quantidade maior que zero.</span>'; ok.disabled = true; if (cont) cont.disabled = true; return; }
      const n = calc(q, inU.value); ok.disabled = false; if (cont) cont.disabled = false;
      pv.innerHTML = `<div><b>${fmt(n.kcal)}</b><span>kcal</span></div><div><b>${fmt(n.prot, 1)}</b><span>g prot</span></div><div><b>${fmt(n.carb, 1)}</b><span>g carb</span></div><div><b>${fmt(n.gord, 1)}</b><span>g gord</span></div>`
        + `<div class="small muted" style="grid-column:1/-1">Fibras ${n.fibra == null ? 'não informadas' : fmt(n.fibra, 1) + ' g'} · Sódio ${n.sodio == null ? 'não informado' : fmt(n.sodio) + ' mg'}</div>`;
    };
    inQ.addEventListener('input', atualizar); inU.addEventListener('change', () => { atalhos(); atualizar(); }); atalhos(); atualizar();
    inQ.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !ok.disabled) ok.click(); });
    let enviado = false; // evita duplicar por toque repetido
    const confirmar_ = (cb) => {
      if (enviado) return; const q = num(inQ.value); if (!(q > 0)) return; enviado = true;
      const n = calc(q, inU.value);
      fecharFolha(); // antes do callback: ele pode abrir outra folha (ex.: voltar ao formulário da receita)
      cb({ qtd: q, unidade: inU.value, rotulo: titulo, ...n });
    };
    ok.addEventListener('click', () => confirmar_(aoConfirmar));
    if (cont) cont.addEventListener('click', () => confirmar_(aoContinuar));
    inQ.focus(); inQ.select();
  });
}

export function adicionarItem(idxRefeicao, tipo, id) {
  const inserir = (dados) => {
    const dia = obterDia(UI.data); const ref = dia.refeicoes[idxRefeicao];
    const novo = { id: uid(), tipo, refId: id, criadoEm: new Date().toISOString(), ...dados };
    ref.itens.push(novo); registrarRecente(tipo, id); lembrarPorcao(tipo, id, dados.qtd, dados.unidade);
    const ok = salvar(); render();
    if (ok) toast(`${dados.rotulo} em ${ref.nome}: ${fmt(dados.kcal)} kcal.`, { rotulo: 'Desfazer', acao: () => { ref.itens = ref.itens.filter((x) => x.id !== novo.id); salvar(); render(); if ($('.sheet .resumo-refeicao')) abrirSeletor(idxRefeicao); } });
    return ref;
  };
  folhaQuantidade({ tipo, id, idxRefeicao,
    aoConfirmar: inserir,
    aoContinuar: (dados) => { inserir(dados); abrirSeletor(idxRefeicao); } });
}
// Seletor de alimentos para uma refeição, com o parcial da refeição no cabeçalho.
export function abrirSeletor(idxRefeicao) {
  const dia = obterDia(UI.data); const ref = dia.refeicoes[idxRefeicao]; if (!ref) return;
  const t = somar(ref.itens);
  folhaEscolher(idxRefeicao, (tipo, id) => adicionarItem(idxRefeicao, tipo, id), `${ref.nome} · ${rotuloData(UI.data).toLowerCase()} · ${ref.itens.length} ${ref.itens.length === 1 ? 'item' : 'itens'} · ${fmt(t.kcal)} kcal`);
}

export function folhaRevisar({ titulo, descricao, linhas, destino, aoConfirmar, botao = 'Adicionar' }) {
  const estado = linhas.map((l) => ({ l, q: l.qtd, sel: true }));
  const desenhar = (s) => {
    const selecionados = []; let nSel = 0; let avisoSnapshot = false;
    const html = estado.map((e, i) => {
      const c = calcularLinha(e.l, e.q > 0 ? e.q : e.l.qtd);
      if (e.sel && e.q > 0) { nSel++; selecionados.push(c); }
      if (c.fonte === 'snapshot') avisoSnapshot = true;
      return `<div class="ing" style="gap:6px;opacity:${e.sel ? 1 : .5}">
        <input type="checkbox" data-sel="${i}" ${e.sel ? 'checked' : ''} aria-label="Incluir ${esc(c.rotulo)}" style="width:22px;height:22px;flex:none">
        <div class="grow"><div class="ellipsis" style="font-weight:500">${esc(c.rotulo)}${c.fonte === 'snapshot' ? ' <span class="badge neutral">cadastro excluído</span>' : ''}</div><div class="small muted">${fmt(c.kcal)} kcal · ${fmt(c.prot, 1)} g prot</div></div>
        <input data-q="${i}" inputmode="decimal" value="${fmtIn(e.q, 3)}" aria-label="Quantidade" style="width:64px;min-height:40px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);text-align:right">
        <span class="small muted" style="width:58px">${esc(e.l.unidade)}</span></div>`;
    }).join('');
    const tot = somar(selecionados);
    $('.linhas', s).innerHTML = html;
    $('.total', s).innerHTML = `<div class="preview" style="margin:10px 0 0"><div><b>${fmt(tot.kcal)}</b><span>kcal</span></div><div><b>${fmt(tot.prot, 1)}</b><span>g prot</span></div><div><b>${fmt(tot.carb, 1)}</b><span>g carb</span></div><div><b>${fmt(tot.gord, 1)}</b><span>g gord</span></div></div>
      ${avisoSnapshot ? '<p class="help">Itens com cadastro excluído usam os valores guardados na combinação.</p>' : ''}`;
    const ok = $('[data-ok]', s); ok.disabled = nSel === 0; ok.textContent = nSel ? `${botao} ${nSel} ${nSel === 1 ? 'item' : 'itens'} em ${destino}` : 'Nenhum item selecionado';
    $$('[data-sel]', s).forEach((c) => c.addEventListener('change', () => { estado[Number(c.dataset.sel)].sel = c.checked; desenhar(s); }));
    $$('[data-q]', s).forEach((inp) => inp.addEventListener('change', () => { const v = num(inp.value); estado[Number(inp.dataset.q)].q = v > 0 ? v : estado[Number(inp.dataset.q)].l.qtd; desenhar(s); }));
  };
  abrirFolha(`${cab(titulo)}${descricao ? `<p class="help" style="margin-top:-6px">${esc(descricao)}</p>` : ''}
    <div class="row between small muted" style="margin-bottom:4px"><span>Desmarque o que não comeu; ajuste quantidades.</span><button type="button" class="btn sm ghost" data-todos>Marcar todos</button></div>
    <div class="linhas"></div><div class="total"></div>
    <button class="btn primary full" data-ok style="margin-top:12px">Adicionar</button>`, (s) => {
    $('[data-todos]', s).addEventListener('click', () => { const todos = estado.every((e) => e.sel); estado.forEach((e) => { e.sel = !todos; }); desenhar(s); });
    let enviado = false;
    $('[data-ok]', s).addEventListener('click', () => {
      if (enviado) return; enviado = true;
      const escolhidas = estado.filter((e) => e.sel && e.q > 0).map((e) => { const c = calcularLinha(e.l, e.q); return { tipo: e.l.tipo, refId: e.l.refId, rotulo: c.rotulo, qtd: e.q, unidade: e.l.unidade, ...escalar(c, 1) }; });
      fecharFolha(); aoConfirmar(escolhidas);
    });
    desenhar(s);
  });
}
// Insere várias linhas numa refeição, com um único "Desfazer" para o lote inteiro.
export function inserirLote(idxRefeicao, itens, origem) {
  const dia = obterDia(UI.data); const ref = dia.refeicoes[idxRefeicao]; if (!ref || !itens.length) return;
  const novos = itens.map((it) => ({ id: uid(), criadoEm: new Date().toISOString(), origem, ...it }));
  ref.itens.push(...novos);
  for (const it of itens) { registrarRecente(it.tipo, it.refId); lembrarPorcao(it.tipo, it.refId, it.qtd, it.unidade); }
  const ok = salvar(); render();
  const ids = new Set(novos.map((n) => n.id)); const t = somar(novos);
  if (ok) toast(`${novos.length} ${novos.length === 1 ? 'item' : 'itens'} em ${ref.nome}: ${fmt(t.kcal)} kcal.`, { rotulo: 'Desfazer', acao: () => { ref.itens = ref.itens.filter((x) => !ids.has(x.id)); salvar(); render(); toast('Inclusão desfeita.'); } });
}

export function salvarCombinacao(itens, nomeSugerido) {
  if (!itens.length) { toast('A refeição está vazia.'); return; }
  const nome = prompt('Nome da combinação (ex.: Meu café da manhã):', nomeSugerido || ''); if (!nome || !nome.trim()) return;
  if (D.combinacoes.some((c) => c.nome.toLowerCase() === nome.trim().toLowerCase()) && !confirmar(`Já existe “${nome.trim()}”. Salvar outra com o mesmo nome?`)) return;
  D.combinacoes.push({ id: uid(), nome: nome.trim(), itens: linhasDeItens(itens, false).map(({ historico, ...r }) => r), criadoEm: new Date().toISOString() });
  D.combinacoes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  if (salvar()) toast(`Combinação “${nome.trim()}” salva. Ela aparece no seletor, em Combinações.`);
}
export function aplicarCombinacao(idxRefeicao, comboId) {
  const c = D.combinacoes.find((x) => x.id === comboId); if (!c) return; const ref = obterDia(UI.data).refeicoes[idxRefeicao];
  folhaRevisar({ titulo: c.nome, descricao: 'Composição calculada com os cadastros atuais.', linhas: linhasDeItens(c.itens, false), destino: `${ref.nome} de ${rotuloData(UI.data).toLowerCase()}`,
    aoConfirmar: (itens) => inserirLote(idxRefeicao, itens, { combinacao: c.id }) });
}
export function menuCombinacao(id, idxRefeicao = null) {
  const c = D.combinacoes.find((x) => x.id === id); if (!c) return;
  const ops = [];
  if (idxRefeicao !== null) ops.push({ rotulo: 'Usar nesta refeição', acao: () => aplicarCombinacao(idxRefeicao, id) });
  else ops.push({ rotulo: 'Registrar em uma refeição de ' + rotuloData(UI.data).toLowerCase(), acao: () => menu('Em qual refeição?', obterDia(UI.data).refeicoes.map((r, i) => ({ rotulo: r.nome, acao: () => aplicarCombinacao(i, id) }))) });
  ops.push({ rotulo: 'Renomear', acao: () => { const n = prompt('Novo nome:', c.nome); if (n && n.trim()) { c.nome = n.trim(); salvar(); render(); } } });
  ops.push({ rotulo: 'Excluir combinação', perigo: true, acao: () => { if (!confirmar(`Excluir “${c.nome}”? Os registros já feitos não mudam.`)) return; D.combinacoes = D.combinacoes.filter((x) => x !== c); salvar(); render(); } });
  menu(`${c.nome} · ${c.itens.length} itens`, ops);
}
export function itemListaCombinacao(c, act) {
  const t = somar(c.itens.map((it) => calcularLinha({ ...it, historico: false }, it.qtd)));
  return `<button class="list-item" data-act="${act}" data-id="${c.id}"><div class="grow"><div class="name">${esc(c.nome)} <span class="badge">combinação</span></div><div class="meta">${esc(c.itens.map((i) => i.rotulo).join(', '))} · ${fmt(t.kcal)} kcal · ${fmt(t.prot, 1)} g prot</div></div><span class="muted">›</span></button>`;
}
export function repetirUltima(idxRefeicao) {
  const ref = obterDia(UI.data).refeicoes[idxRefeicao]; const u = ultimaRefeicaoAnterior(ref.nome, UI.data);
  if (!u) { toast(`Nenhum ${ref.nome} anterior com registros.`); return; }
  folhaRevisar({ titulo: `Repetir ${ref.nome} de ${rotuloData(u.data).toLowerCase()}`, descricao: `Origem: ${dataCurta(u.data)}. Valores preservados do registro original.`, linhas: linhasDeItens(u.refeicao.itens, true), destino: `${ref.nome} de ${rotuloData(UI.data).toLowerCase()}`,
    aoConfirmar: (itens) => inserirLote(idxRefeicao, itens, { copiaDe: u.data }) });
}

export function folhaDetalheDia(n0 = 'kcal') {
  let n = NUTRIENTES[n0] ? n0 : 'kcal';
  const desenhar = (s) => {
    const dia = obterDia(UI.data, false); const info = NUTRIENTES[n]; const m = metasEm(UI.data)[n];
    const itens = dia ? dia.refeicoes.flatMap((r, i) => r.itens.map((it) => ({ it, r, i }))) : [];
    const val = (it) => it[n] == null ? null : it[n];
    const conhecidos = itens.filter((x) => val(x.it) != null).length;
    const total = itens.reduce((a, x) => a + (val(x.it) || 0), 0);
    const pct = (v) => total > 0 && v != null ? `${fmt(v / total * 100)}%` : '–';
    const porRef = dia ? dia.refeicoes.map((r) => ({ r, v: r.itens.reduce((a, it) => a + (val(it) || 0), 0), semDados: r.itens.length && r.itens.every((it) => val(it) == null) })) : [];
    const maiores = [...itens].sort((a, b) => (val(b.it) || 0) - (val(a.it) || 0)).slice(0, 10);
    const opcional = !info.obrigatorio; const parcial = opcional && conhecidos < itens.length;
    const difTxt = !m ? (opcional ? `sem ${info.meta === 'limite' ? 'limite' : 'meta'} definido para este nutriente` : 'sem meta definida para este nutriente')
      : info.meta === 'limite' ? (total <= m ? `${fmt(m - total, info.dec)} ${info.un} abaixo do limite de ${fmt(m, info.dec)}` : `${fmt(total - m, info.dec)} ${info.un} acima do limite de ${fmt(m, info.dec)}`)
      : (m - total >= 0 ? `faltam ${fmt(m - total, info.dec)} ${info.un} para a meta de ${fmt(m, info.dec)}` : `${fmt(total - m, info.dec)} ${info.un} além da meta de ${fmt(m, info.dec)}`);
    const cobTxt = opcional && itens.length ? (conhecidos === 0 ? 'Nenhum registro informa este nutriente.' : parcial ? `Total parcial: dados em ${conhecidos} de ${itens.length} registros. Um item sem dado pode ser grande; isto mede cobertura, não precisão.` : `Dados em todos os ${itens.length} registros.`) : '';
    $$('.chip', s).forEach((c) => c.classList.toggle('active', c.dataset.n === n));
    $('.corpo', s).innerHTML = `
      <div class="stat ${n === 'prot' ? 'prot' : ''}" style="margin-bottom:12px"><div class="label">${info.nome} registradas ${rotuloData(UI.data).toLowerCase()}${dia && dia.concluido ? '' : ' <span class="badge neutral">dia em aberto · parcial</span>'}</div>
        <div class="value">${opcional && conhecidos === 0 && itens.length ? 'não informado' : fmt(total, info.dec)} <small>${opcional && conhecidos === 0 && itens.length ? '' : info.un}</small>${parcial ? ' <span class="badge neutral">parcial</span>' : ''}</div><div class="sub">${difTxt}</div>${cobTxt ? `<div class="sub small muted">${cobTxt}</div>` : ''}${m && conhecidos ? `<div class="bar"><span style="width:${Math.min(100, total / m * 100)}%"></span></div>` : ''}</div>
      ${!itens.length ? '<div class="empty">Nenhum alimento registrado neste dia.</div>' : `
      <h3>Por refeição</h3>
      ${porRef.map(({ r, v, semDados }) => `<div class="ing"><div class="grow">${esc(r.nome)}</div><div style="text-align:right"><b>${semDados ? 'não informado' : `${fmt(v, info.dec)} ${info.un}`}</b> <span class="muted small">· ${semDados ? '–' : pct(v)}</span><div class="bar" style="width:120px;margin:4px 0 0 auto"><span style="width:${total > 0 ? v / total * 100 : 0}%"></span></div></div></div>`).join('')}
      <h3 style="margin-top:14px">Maiores contribuições</h3>
      <p class="help" style="margin-top:2px">Participação no total registrado do dia. Toque para corrigir o registro.</p>
      ${maiores.map(({ it, r, i }) => `<button class="list-item" data-item="${it.id}" data-idx="${i}"><div class="grow"><div class="name">${esc(it.rotulo)}</div><div class="meta">${fmt(it.qtd, 2)} ${esc(it.unidade)} · ${esc(r.nome)}</div></div><div style="text-align:right"><b>${val(it) == null ? '<span class="muted">não informado</span>' : `${fmt(val(it), info.dec)} ${info.un}`}</b><div class="small muted">${pct(val(it))}</div></div></button>`).join('')}`}`;
    $$('[data-item]', s).forEach((b) => b.addEventListener('click', () => { fecharFolha(); folhaItem(Number(b.dataset.idx), b.dataset.item); }));
  };
  abrirFolha(`${cab('Detalhe do dia')}
    <div class="chips">${Object.entries(NUTRIENTES).map(([k, v]) => `<button class="chip" data-n="${k}">${v.nome}</button>`).join('')}</div>
    <div class="corpo"></div>`, (s) => {
    $$('.chip', s).forEach((c) => c.addEventListener('click', () => { n = c.dataset.n; desenhar(s); }));
    desenhar(s);
  });
}

// ----- Editar item registrado -----
export function folhaItem(idxRefeicao, itemId) {
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
export function folhaQuantidadeOrfa(it) {
  abrirFolha(`${cab('Alterar quantidade')}<p class="help">O cadastro original foi excluído. A nova quantidade será calculada proporcionalmente a este registro (${fmt(it.qtd, 2)} ${esc(it.unidade)} = ${fmt(it.kcal)} kcal).</p>
    <div class="field"><label>Quantidade (${esc(it.unidade)})</label><input name="qtd" inputmode="decimal" value="${fmtIn(it.qtd, 3)}"></div><button class="btn primary full" data-ok>Salvar</button>`, (s) => {
    $('[data-ok]', s).addEventListener('click', () => {
      const q = num($('[name=qtd]', s).value); if (!(q > 0)) { toast('Quantidade inválida.'); return; }
      const f = q / it.qtd; it.kcal *= f; it.prot *= f; it.carb *= f; it.gord *= f; it.qtd = q; salvar(); render(); fecharFolha();
    });
  });
}

// ----- Menu da refeição -----
export function menuRefeicao(idx) {
  const dia = obterDia(UI.data); const ref = dia.refeicoes[idx];
  const ant = ultimaRefeicaoAnterior(ref.nome, UI.data);
  menu(ref.nome, [
    ...(ant ? [{ rotulo: `Repetir ${ref.nome} de ${rotuloData(ant.data).toLowerCase()} (${ant.refeicao.itens.length} itens)`, acao: () => repetirUltima(idx) }] : []),
    { rotulo: 'Copiar refeição de outro dia', acao: () => folhaCopiar(idx) },
    ...(ref.itens.length ? [{ rotulo: 'Salvar como combinação', acao: () => salvarCombinacao(ref.itens, `Meu ${ref.nome.toLowerCase()}`) }] : []),
    { rotulo: 'Renomear refeição', acao: () => { const n = prompt('Novo nome da refeição:', ref.nome); if (n && n.trim()) { ref.nome = n.trim(); salvar(); render(); } } },
    { rotulo: 'Limpar itens desta refeição', perigo: true, acao: () => { if (!ref.itens.length) return; if (confirmar(`Excluir os ${ref.itens.length} itens de ${ref.nome}?`)) { ref.itens = []; salvar(); render(); } } },
    { rotulo: 'Remover refeição do dia', perigo: true, acao: () => { if (ref.itens.length && !confirmar(`A refeição tem ${ref.itens.length} itens. Remover mesmo assim?`)) return; dia.refeicoes.splice(idx, 1); salvar(); render(); } },
  ]);
}
export function folhaCopiar(idxDestino) {
  let data = somarDias(UI.data, -1);
  const desenhar = (s) => {
    const dia = D.dias[data]; const lista = $('.lista', s);
    if (!diaTemRegistro(dia)) { lista.innerHTML = '<div class="empty">Nenhum registro nessa data.</div>'; return; }
    lista.innerHTML = dia.refeicoes.filter((r) => r.itens.length).map((r, i) => { const t = somar(r.itens); return `<button class="list-item" data-i="${dia.refeicoes.indexOf(r)}"><div class="grow"><div class="name">${esc(r.nome)}</div><div class="meta">${esc(r.itens.map((x) => x.rotulo).join(', '))} · ${fmt(t.kcal)} kcal</div></div><span class="muted">copiar ›</span></button>`; }).join('');
    $$('.list-item', lista).forEach((b) => b.addEventListener('click', () => {
      const origem = dia.refeicoes[Number(b.dataset.i)]; const destino = obterDia(UI.data).refeicoes[idxDestino];
      folhaRevisar({ titulo: `Copiar ${origem.nome} de ${dataCurta(data)}`, descricao: 'Valores preservados do registro original; quantidade alterada é escalada proporcionalmente.', linhas: linhasDeItens(origem.itens, true), destino: `${destino.nome} de ${rotuloData(UI.data).toLowerCase()}`, botao: 'Copiar',
        aoConfirmar: (itens) => inserirLote(idxDestino, itens, { copiaDe: data }) });
    }));
  };
  abrirFolha(`${cab('Copiar refeição de outro dia')}<div class="field"><label>Data de origem</label><input type="date" value="${data}" max="${hojeISO()}"></div><div class="lista"></div>`, (s) => {
    $('input[type=date]', s).addEventListener('change', (e) => { if (e.target.value) { data = e.target.value; desenhar(s); } }); desenhar(s);
  });
}

// ----- Cadastro / edição de alimento -----
export function folhaAlimento(id, inicial = {}, aoSalvar) {
  const a = id ? D.alimentos.find((x) => x.id === id) : null;
  const v = Object.assign({ nome: '', marca: '', estado: 'na', refQtd: 100, refUnidade: 'g', kcal: '', prot: '', carb: '', gord: '', medidas: [], favorito: false, obs: '', codigoBarras: '', fonte: '' }, a || {}, inicial);
  let medidas = v.medidas.map((m) => ({ ...m }));
  const linhaMedida = (m, i) => `<div class="ing"><div class="grow">${esc(m.nome)} = ${fmt(m.equivale, 2)} <span class="un"></span></div><button type="button" class="btn sm ghost danger" data-rm="${i}">remover</button></div>`;
  abrirFolha(`${cab(a ? 'Editar alimento' : 'Novo alimento')}
    <form data-form="alimento">
      <h3>Identificação</h3>
      <div class="field"><label>Nome</label><input name="nome" value="${esc(v.nome)}" required autofocus></div>
      <div class="grid2">
        <div class="field"><label>Estado</label><select name="estado"><option value="na" ${v.estado === 'na' ? 'selected' : ''}>não se aplica</option><option value="cru" ${v.estado === 'cru' ? 'selected' : ''}>cru</option><option value="cozido" ${v.estado === 'cozido' ? 'selected' : ''}>cozido</option></select></div>
      </div>
      ${(a && a.fonte) || (!a && v.fonte) ? `<p class="help" style="margin-top:0">Valores de origem: <b>${esc(v.fonte)}</b>. Se editar, eles passam a ser seus.</p>` : ''}
      ${v.obs ? `<p class="help" style="margin-top:0;background:var(--warn-soft);padding:8px 10px;border-radius:8px">${esc(v.obs)}</p>` : ''}
      <h3>Referência do rótulo</h3>
      <p class="help" style="margin-top:0">O rótulo informa os valores por 100 g/ml ou por porção. Escolha como está no rótulo; o app não converte nada sozinho.</p>
      <div class="chips base-chips">${[['100', 'Por 100 g ou ml'], ['porcao', 'Por porção do rótulo'], ['outra', 'Outra quantidade']].map(([k, n]) => `<button type="button" class="chip" data-base="${k}">${n}</button>`).join('')}</div>
      <div class="grid2">
        <div class="field"><label class="rot-ref">Quantidade de referência</label><input name="refQtd" inputmode="decimal" value="${fmtIn(v.refQtd, 3)}" required></div>
        <div class="field"><label>Unidade</label><select name="refUnidade">${['g', 'ml', 'porção'].map((u) => `<option ${v.refUnidade === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
      </div>
      <label class="check opt-porcao" hidden><input type="checkbox" name="criarPorcao" checked> <span class="small">Criar a medida “porção do rótulo” com essa quantidade, para registrar “1 porção”.</span></label>
      <p class="help base-txt" style="margin-top:0"></p>
      <h3>Nutrientes <span class="muted small base-txt2"></span></h3>
      <div class="grid2">
        <div class="field"><label>Calorias (kcal)</label><input name="kcal" inputmode="decimal" value="${v.kcal === '' ? '' : fmtIn(v.kcal, 2)}" required></div>
        <div class="field"><label>Proteínas (g)</label><input name="prot" inputmode="decimal" value="${v.prot === '' ? '' : fmtIn(v.prot, 2)}" required></div>
        <div class="field"><label>Carboidratos (g)</label><input name="carb" inputmode="decimal" value="${v.carb === '' ? '' : fmtIn(v.carb, 2)}" required></div>
        <div class="field"><label>Gorduras (g)</label><input name="gord" inputmode="decimal" value="${v.gord === '' ? '' : fmtIn(v.gord, 2)}" required></div>
        <div class="field"><label>Fibras (g) — opcional</label><input name="fibra" inputmode="decimal" value="${v.fibra == null || v.fibra === '' ? '' : fmtIn(v.fibra, 2)}" placeholder="não informado"></div>
        <div class="field"><label>Sódio (mg) — opcional</label><input name="sodio" inputmode="decimal" value="${v.sodio == null || v.sodio === '' ? '' : fmtIn(v.sodio, 2)}" placeholder="não informado"></div>
      </div>
      <p class="help" style="margin-top:-4px">Em branco = não informado (diferente de 0). Sódio em mg; o rótulo às vezes traz só “sal”: não converta, deixe em branco.</p>
      <details class="opcional" ${(v.marca || (v.medidas && v.medidas.length) || v.codigoBarras) ? 'open' : ''}><summary class="btn sm full" style="list-style:none;cursor:pointer;margin:6px 0 10px">Mais opções: marca, medidas caseiras, código de barras</summary>
      <div class="field"><label>Marca (opcional)</label><input name="marca" value="${esc(v.marca || '')}"></div>
      <h3>Medidas caseiras (opcional)</h3>
      <p class="help">Ex.: “unidade” = 50 g, “scoop” = 30 g, “colher de sopa” = 15 ml. Sem equivalência cadastrada o app não presume conversão.</p>
      <div class="medidas">${medidas.map(linhaMedida).join('')}</div>
      <div class="grid3" style="align-items:end;margin-top:8px">
        <div class="field" style="grid-column:span 2"><label>Nome da medida</label><input name="mNome" placeholder="unidade"></div>
        <div class="field"><label>Equivale a (<span class="un"></span>)</label><input name="mEq" inputmode="decimal" placeholder="50"></div>
      </div>
      <button type="button" class="btn sm full" data-add-medida>+ Adicionar medida</button>
      <div class="field" style="margin-top:10px"><label>Código de barras (opcional)</label><input name="codigoBarras" inputmode="numeric" value="${esc(v.codigoBarras || '')}" placeholder="Para reconhecer o produto ao ler o código"></div>
      </details>
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
    // Base do rótulo: "100" fixa 100; "porcao" libera a quantidade e oferece criar a medida; "outra" é livre.
    let base = (num(form.refQtd.value) === 100 && (form.refUnidade.value === 'g' || form.refUnidade.value === 'ml')) ? '100' : (v.medidas || []).some((m) => m.nome === 'porção do rótulo') ? 'porcao' : 'outra';
    const atualizarBase = () => {
      $$('.base-chips .chip', s).forEach((c) => c.classList.toggle('active', c.dataset.base === base));
      form.refQtd.readOnly = base === '100'; if (base === '100') form.refQtd.value = '100';
      $('.opt-porcao', s).hidden = base !== 'porcao';
      $('.rot-ref', s).textContent = base === 'porcao' ? 'Peso ou volume da porção' : 'Quantidade de referência';
      const q = num(form.refQtd.value); const txt = `Base: valores por ${q > 0 ? fmtIn(q, 3) : '…'} ${form.refUnidade.value}`;
      $('.base-txt', s).textContent = txt + (base === 'porcao' ? ' (porção do rótulo).' : '.'); $('.base-txt2', s).textContent = '· por ' + (q > 0 ? fmtIn(q, 3) : '…') + ' ' + form.refUnidade.value;
    };
    $$('.base-chips .chip', s).forEach((c) => c.addEventListener('click', () => { base = c.dataset.base; if (base === 'porcao' && num(form.refQtd.value) === 100) form.refQtd.value = ''; atualizarBase(); if (base !== '100') form.refQtd.focus(); }));
    form.refQtd.addEventListener('input', atualizarBase);
    form.refUnidade.addEventListener('change', () => { atualizarUn(); atualizarBase(); }); redesenharMedidas(); atualizarBase();
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
        kcal: num(form.kcal.value), prot: num(form.prot.value), carb: num(form.carb.value), gord: num(form.gord.value),
        fibra: form.fibra.value.trim() === '' ? null : num(form.fibra.value), sodio: form.sodio.value.trim() === '' ? null : num(form.sodio.value),
        medidas, favorito: form.favorito.checked, obs: v.obs || '', codigoBarras: normalizarCodigo(form.codigoBarras.value) };
      if (!campos.nome) { toast('Informe o nome.'); return; }
      if (!(campos.refQtd > 0)) { toast(base === 'porcao' ? 'Informe o peso ou volume da porção do rótulo.' : 'Quantidade de referência deve ser maior que zero.'); return; }
      if (base === 'porcao' && form.criarPorcao.checked && !['g', 'ml', 'porção'].includes('porção do rótulo') && !medidas.some((m) => m.nome === 'porção do rótulo') && campos.refUnidade !== 'porção') medidas.push({ nome: 'porção do rótulo', equivale: campos.refQtd });
      for (const k of NUTR_OBRIG) if (!(campos[k] >= 0)) { toast(`Valor inválido em ${k}. Use números (vírgula ou ponto).`); return; }
      for (const k of NUTR_OPC) if (campos[k] !== null && !(campos[k] >= 0)) { toast(`Valor inválido em ${k}. Use números ou deixe em branco.`); return; }
      if (campos.codigoBarras) { const dono = D.alimentos.find((x) => x !== a && x.codigoBarras === campos.codigoBarras); if (dono && !confirmar(`O código ${campos.codigoBarras} já está em “${dono.nome}”. Manter nos dois?`)) return; }
      if (!a && v.fonte) { const mudou = NUTR_OBRIG.some((k) => v[k] !== '' && v[k] !== campos[k]); campos.fonte = mudou ? v.fonte + ' (editado)' : v.fonte; }
      let salvo;
      if (a) {
        const mudouValor = a.fonte && [...NUTR_OBRIG, 'refQtd', 'refUnidade'].some((k) => a[k] !== campos[k]);
        Object.assign(a, campos, { atualizadoEm: new Date().toISOString() });
        if (mudouValor) a.fonte = a.fonte.replace(/ \(editado\)$/, '') + ' (editado)';
        salvo = a;
      }
      else { salvo = { id: uid(), ...campos, criadoEm: new Date().toISOString() }; D.alimentos.push(salvo); }
      D.alimentos.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
      const gravou = salvar(); fecharFolha(); render(); if (gravou) toast(a ? 'Alimento atualizado.' : 'Alimento cadastrado.');
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
    form.nome.focus();
  });
}

// ----- Cadastro / edição de receita -----
export function folhaReceita(id, rascunho = null, ingsIniciais = null) {
  const r = id ? D.receitas.find((x) => x.id === id) : null;
  const v = Object.assign({ nome: '', porcoes: 1, pesoFinal: '', favorito: false, ingredientes: [] }, r || {}, rascunho || {});
  let ings = ingsIniciais ? ingsIniciais : v.ingredientes.map((i) => ({ ...i }));
  const totais = () => somar(ings);
  abrirFolha(`${cab(r ? 'Editar receita' : 'Nova receita')}
    <form data-form="receita">
      <div class="field"><label>Nome</label><input name="nome" value="${esc(v.nome)}" required placeholder="Ex.: Pão com ovo"></div>
      <h3>Ingredientes</h3>
      <div class="ings"></div>
      <button type="button" class="btn sm full" data-add-ing style="margin:8px 0 12px">+ Adicionar ingrediente</button>
      <div class="grid2">
        <div class="field"><label>Rendimento (porções)</label><input name="porcoes" inputmode="decimal" value="${fmtIn(v.porcoes, 2)}" required></div>
        <div class="field"><label>Peso final do preparo (g, opcional)</label><input name="pesoFinal" inputmode="decimal" value="${v.pesoFinal ? fmtIn(v.pesoFinal, 1) : ''}"></div>
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
          ings.push({ alimentoId: alimento.id, rotulo: d.rotulo, qtd: d.qtd, unidade: d.unidade, ...escalar(d, 1) });
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
      const gravou = salvar(); fecharFolha(); render(); if (gravou) toast(r ? 'Receita atualizada.' : 'Receita salva.');
    });
    if (r) $('[data-del]', s).addEventListener('click', () => { if (!confirmar(`Excluir a receita “${r.nome}”? Registros antigos não mudam.`)) return; D.receitas = D.receitas.filter((x) => x !== r); D.recentes = D.recentes.filter((x) => !(x.tipo === 'receita' && x.id === r.id)); salvar(); fecharFolha(); render(); });
  });
}
export function folhaEscolherIngrediente(aoEscolher, aoCancelar) {
  let busca = '';
  const desenhar = (s) => {
    const q = busca.trim();
    const lista = filtrarOrdenar(D.alimentos, q, (a) => a.nome, (a) => a.marca);
    $('.lista', s).innerHTML = (lista.length ? lista.map((a) => itemListaAlimento(a, 'pick')).join('') : '<div class="empty">Nenhum alimento encontrado.</div>')
      + `<button class="list-item" data-act="novo"><div class="grow"><div class="name" style="color:var(--brand)">+ Cadastrar novo alimento</div></div></button>`;
    $$('[data-act="pick"]', s).forEach((b) => b.addEventListener('click', () => aoEscolher(D.alimentos.find((a) => a.id === b.dataset.id))));
    $('[data-act="novo"]', s).addEventListener('click', () => folhaAlimento(null, { nome: busca.trim() }, (novo) => aoEscolher(novo)));
  };
  abrirFolha(`${cab('Escolher ingrediente')}<input class="search" type="search" placeholder="Buscar alimento" aria-label="Buscar"><div class="lista"></div>`, (s) => {
    $('.search', s).addEventListener('input', (e) => { busca = e.target.value; desenhar(s); }); desenhar(s);
    $('[data-fechar]', s).addEventListener('click', aoCancelar);
    $('.search', s).focus();
  });
}

// ----- Detalhe de alimento / receita (na aba Alimentos) -----
export function menuAlimento(id) {
  const a = D.alimentos.find((x) => x.id === id); if (!a) return;
  menu(rotuloAlimento(a), [
    { rotulo: 'Registrar em uma refeição de ' + rotuloData(UI.data).toLowerCase(), acao: () => menu('Em qual refeição?', obterDia(UI.data).refeicoes.map((r, i) => ({ rotulo: r.nome, acao: () => adicionarItem(i, 'alimento', id) }))) },
    { rotulo: 'Editar / excluir', acao: () => folhaAlimento(id) },
    { rotulo: a.favorito ? 'Remover dos favoritos' : 'Marcar como favorito', acao: () => { a.favorito = !a.favorito; salvar(); render(); } },
  ]);
}
export function menuReceita(id) {
  const r = D.receitas.find((x) => x.id === id); if (!r) return;
  menu(r.nome, [
    { rotulo: 'Registrar em uma refeição de ' + rotuloData(UI.data).toLowerCase(), acao: () => menu('Em qual refeição?', obterDia(UI.data).refeicoes.map((m, i) => ({ rotulo: m.nome, acao: () => adicionarItem(i, 'receita', id) }))) },
    { rotulo: 'Editar / excluir', acao: () => folhaReceita(id) },
    { rotulo: r.favorito ? 'Remover dos favoritos' : 'Marcar como favorita', acao: () => { r.favorito = !r.favorito; salvar(); render(); } },
  ]);
}

// Fluxo: código → alimento já cadastrado (callback direto) → consulta OFF → formulário preenchido → callback ao salvar.
export function folhaCodigo(aoEscolher) {
  let stream = null, rodando = false, encerrado = false;
  const parar = () => { encerrado = true; rodando = false; if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } };
  const tratar = async (s, codigoBruto) => {
    const codigo = normalizarCodigo(codigoBruto);
    if (codigo.length < 8 || codigo.length > 14) { toast('Código inválido: use 8 a 14 dígitos.'); return; }
    parar();
    const existente = D.alimentos.find((a) => a.codigoBarras === codigo);
    if (existente) { fecharFolha(); toast(`Reconhecido: ${rotuloAlimento(existente)}`); aoEscolher(existente); return; }
    const status = $('.status', s); const abrirManual = (ini, msg) => { fecharFolha(); if (msg) toast(msg); folhaAlimento(null, ini, aoEscolher); };
    if (!D.config.consultarOFF) { abrirManual({ codigoBarras: codigo }, 'Consulta desligada em Ajustes. Cadastre pelo rótulo.'); return; }
    if (navigator.onLine === false) { abrirManual({ codigoBarras: codigo }, 'Sem internet. Cadastre pelo rótulo; o código fica salvo.'); return; }
    status.textContent = `Consultando ${codigo} no ${FONTE_OFF}…`;
    try {
      const r = await consultarOFF(codigo);
      if (!r.achou) { abrirManual({ codigoBarras: codigo }, `Código ${codigo} não está no ${FONTE_OFF}. Cadastre pelo rótulo.`); return; }
      abrirManual(mapearOFF(r.produto, codigo));
    } catch (e) { console.warn(e); abrirManual({ codigoBarras: codigo }, `${FONTE_OFF} não respondeu. Cadastre pelo rótulo; o código fica salvo.`); }
  };
  abrirFolha(`${cab('Código de barras')}
    ${temLeitor() ? `<div class="camera"><video playsinline muted autoplay style="width:100%;border-radius:12px;background:#000;aspect-ratio:4/3;object-fit:contain"></video><div class="row cam-ctr" style="margin-top:8px;min-height:0"></div><p class="help cam-msg">Abrindo a câmera…</p></div>`
      : `<p class="help">Este navegador não tem leitor de código embutido (no Android, use o Chrome). Digite o código abaixo.</p>`}
    <form class="row" data-form="codigo"><div class="field grow" style="margin:0"><label>Código (EAN)</label><input name="codigo" inputmode="numeric" pattern="[0-9]*" placeholder="7891234567890" autocomplete="off"></div><button class="btn primary" type="submit" style="align-self:flex-end">Buscar</button></form>
    <p class="help status" aria-live="polite" style="margin-top:10px"></p>
    <p class="small muted">${D.config.consultarOFF ? `A consulta envia apenas o código ao ${FONTE_OFF}. Pode ser desligada em Ajustes.` : 'Consulta ao Open Food Facts desligada em Ajustes: o código só fica salvo no alimento.'}</p>`, async (s) => {
    $('form', s).addEventListener('submit', (e) => { e.preventDefault(); tratar(s, $('[name=codigo]', s).value); });
    const bd = $('.sheet-backdrop'); const obs = new MutationObserver(() => { if (!document.contains(bd)) { parar(); obs.disconnect(); } }); obs.observe($('#sheet-root'), { childList: true });
    if (!temLeitor()) { $('[name=codigo]', s).focus(); return; }
    const video = $('video', s), msg = $('.cam-msg', s);
    try {
      const formatos = (await BarcodeDetector.getSupportedFormats()).filter((f) => ['ean_13', 'ean_8', 'upc_a', 'upc_e'].includes(f));
      if (!formatos.length) throw new Error('sem formatos EAN');
      const det = new BarcodeDetector({ formats: formatos });
      // Resolução alta + foco contínuo ajudam em código pequeno; zoom e lanterna quando a câmera oferecer.
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      if (encerrado || !s.isConnected) { parar(); return; }
      video.srcObject = stream; await video.play();
      if (encerrado || !s.isConnected) { parar(); return; }
      rodando = true;
      const trilha = stream.getVideoTracks()[0];
      const cap = trilha.getCapabilities ? trilha.getCapabilities() : {};
      const aplicar = (c) => trilha.applyConstraints({ advanced: [c] }).catch(() => {});
      if (Array.isArray(cap.focusMode) && cap.focusMode.includes('continuous')) aplicar({ focusMode: 'continuous' });
      const ctr = $('.cam-ctr', s);
      if (cap.zoom && cap.zoom.max > cap.zoom.min) {
        const z = document.createElement('input'); z.type = 'range'; z.min = cap.zoom.min; z.max = cap.zoom.max; z.step = cap.zoom.step || 0.1;
        z.value = Math.min(cap.zoom.max, Math.max(cap.zoom.min, 2)); z.setAttribute('aria-label', 'Zoom'); z.className = 'grow';
        aplicar({ zoom: Number(z.value) }); z.addEventListener('input', () => aplicar({ zoom: Number(z.value) }));
        const rot = document.createElement('span'); rot.className = 'small muted'; rot.textContent = 'Zoom'; ctr.append(rot, z);
      }
      if (cap.torch) {
        let ligada = false; const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'btn sm'; bt.textContent = '🔦 Lanterna';
        bt.addEventListener('click', () => { ligada = !ligada; aplicar({ torch: ligada }); bt.classList.toggle('primary', ligada); }); ctr.append(bt);
      }
      msg.textContent = 'Centralize o código inteiro, com margem nas laterais. Afaste um pouco se estiver desfocado; incline a embalagem para evitar reflexos.' + (cap.zoom ? ' Use o zoom para códigos pequenos.' : '');
      const canvas = document.createElement('canvas');
      let tentativa = 0;
      const laco = async () => {
        if (!rodando) return;
        try { const modo = tentativa++ % 3;
          const fonte = modo === 0 ? video : prepararQuadro(video, canvas, modo === 2);
          const cods = await det.detect(fonte); if (cods.length && rodando) { msg.textContent = `Lido: ${cods[0].rawValue}`; tratar(s, cods[0].rawValue); return; } } catch { /* quadro inválido */ }
        setTimeout(laco, 120);
      };
      laco();
    } catch (e) {
      console.warn(e); parar(); if (!s.isConnected) return; $('.camera', s).innerHTML = `<p class="help">Não foi possível usar a câmera (${e.name === 'NotAllowedError' ? 'permissão negada' : 'indisponível'}). Digite o código abaixo.</p>`;
      $('[name=codigo]', s).focus();
    }
  });
}

// ---------- Água: quantidade livre ----------
export function folhaAgua() {
  const dia = obterDia(UI.data);
  abrirFolha(`${cab('Registrar água')}
    <div class="field"><label>Quantidade (ml)</label><input name="ml" inputmode="numeric" pattern="[0-9]*" placeholder="Ex.: 350" autofocus></div>
    <div class="chips">${[150, 200, 300, 350, 600, 1000].map((v) => `<button class="chip" data-v="${v}">${fmt(v)} ml</button>`).join('')}</div>
    <button class="btn primary full" data-ok>Adicionar</button>
    ${dia.agua.length ? `<hr class="sep"><h3>Registros de ${esc(rotuloData(UI.data).toLowerCase())}</h3><div class="lista">${dia.agua.map((a) => `<div class="ing"><div class="grow">${fmt(a.ml)} ml <span class="muted small">· ${new Date(a.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div><button type="button" class="btn sm ghost danger" data-rm="${a.id}">remover</button></div>`).join('')}</div>` : ''}`, (s) => {
    const inp = $('[name=ml]', s);
    const add = () => { const ml = num(inp.value); if (!(ml > 0)) { toast('Informe uma quantidade em ml maior que zero.'); return; } dia.agua.push({ id: uid(), ml: Math.round(ml), em: new Date().toISOString() }); salvar(); fecharFolha(); render(); };
    $('[data-ok]', s).addEventListener('click', add); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    $$('.chip', s).forEach((c) => c.addEventListener('click', () => { inp.value = c.dataset.v; add(); }));
    $$('[data-rm]', s).forEach((b) => b.addEventListener('click', () => { dia.agua = dia.agua.filter((a) => a.id !== b.dataset.rm); salvar(); fecharFolha(); render(); }));
    inp.focus();
  });
}

// Folha de importação: escolher quais itens entram, com estado (cru/cozido) e fonte visíveis.
export function folhaImportarBase(aoTerminar) {
  const est = estadoBase(); const sel = new Set(est.filter((e) => e.novo).map((e) => e.b.nome)); let busca = '';
  const nCompletar = est.filter((e) => e.completar).length;
  const desenhar = (s) => {
    const q = busca.trim();
    const vis = est.filter((e) => !q || pontuarBusca(q, e.b.nome) > 0);
    $('.lista', s).innerHTML = vis.map((e) => { const b = e.b; const d = NUTR.find((n) => n.k === 'kcal');
      return `<label class="list-item" style="cursor:pointer;gap:8px"><input type="checkbox" data-nome="${esc(b.nome)}" ${e.novo ? (sel.has(b.nome) ? 'checked' : '') : 'checked disabled'} style="width:22px;height:22px;flex:none">
        <div class="grow"><div class="name">${esc(b.nome)}${b.estado !== 'na' ? ` <span class="badge neutral">${b.estado}</span>` : ''}${b.fonte ? ` <span class="badge neutral">${esc(b.fonte)}</span>` : ''}</div>
        <div class="meta">${fmt(b.kcal)} kcal · ${fmt(b.prot, 1)} g prot${b.fibra != null ? ` · fibra ${fmt(b.fibra, 1)}` : ''}${b.sodio != null ? ` · Na ${fmt(b.sodio)} mg` : ''} por 100 ${b.refUnidade || 'g'}${e.novo ? '' : e.completar ? ' · <b>já cadastrado, completável</b>' : ' · já cadastrado'}</div></div></label>`; }).join('') || '<div class="empty">Nada encontrado.</div>';
    $$('input[data-nome]', s).forEach((c) => c.addEventListener('change', () => { if (c.checked) sel.add(c.dataset.nome); else sel.delete(c.dataset.nome); atualizarBotao(s); }));
    atualizarBotao(s);
  };
  const atualizarBotao = (s) => { const ok = $('[data-ok]', s); const comp = $('[name=completar]', s)?.checked && nCompletar; ok.disabled = !sel.size && !comp; ok.textContent = sel.size ? `Adicionar ${sel.size} ${sel.size === 1 ? 'alimento' : 'alimentos'}` : comp ? `Completar ${nCompletar} já cadastrado(s)` : 'Nada selecionado'; };
  abrirFolha(`${cab('Alimentos comuns')}
    <p class="help" style="margin-top:-6px">Valores por 100 g da ${FONTE_TACO}, lidos do PDF oficial; item de outra fonte está marcado. Entram como cadastro normal, editável. Pesos por unidade são médias: confira pesando.</p>
    <input class="search" type="search" placeholder="Filtrar a lista" aria-label="Filtrar">
    <div class="row between small" style="margin-bottom:6px"><button type="button" class="btn sm ghost" data-todos>Marcar todos os novos</button><button type="button" class="btn sm ghost" data-nenhum>Desmarcar</button></div>
    <div class="lista"></div>
    ${nCompletar ? `<label class="check" style="margin-top:8px"><input type="checkbox" name="completar" checked> <span class="small">Também preencher fibras/sódio e medidas vazias em ${nCompletar} item(ns) já cadastrado(s) da mesma fonte, sem sobrescrever valores.</span></label>` : ''}
    <button class="btn primary full" data-ok style="margin-top:10px">Adicionar</button>`, (s) => {
    $('.search', s).addEventListener('input', (e) => { busca = e.target.value; desenhar(s); });
    $('[data-todos]', s).addEventListener('click', () => { est.filter((e) => e.novo).forEach((e) => sel.add(e.b.nome)); desenhar(s); });
    $('[data-nenhum]', s).addEventListener('click', () => { sel.clear(); desenhar(s); });
    $('[name=completar]', s)?.addEventListener('change', () => atualizarBotao(s));
    $('[data-ok]', s).addEventListener('click', () => { const comp = !!$('[name=completar]', s)?.checked; fecharFolha(); aplicarBase(sel, comp); UI.aba = 'alimentos'; UI.filtroAlimentos = 'todos'; render(); if (aoTerminar) aoTerminar(); });
    desenhar(s);
  });
}
export function novoDeModelo(i) {
  const m = MODELOS_BASE[i];
  folhaAlimento(null, { nome: m.nome, refQtd: m.refQtd, refUnidade: m.refUnidade, medidas: m.medidas.map((x) => ({ ...x })), obs: m.obs });
}
