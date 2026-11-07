/* Meu Prato — acompanhamento alimentar pessoal.
   Sem dependências. Dados em localStorage (um documento JSON por modo: real e demonstração).
   Regras que valem em todos os módulos:
   - Cada registro de consumo guarda os nutrientes já calculados (snapshot). Editar um
     alimento/receita depois NÃO altera dias anteriores.
   - Nenhum valor nutricional é inventado: só existe o que o usuário cadastrou.
   - Medidas caseiras (unidade, colher, scoop) só valem se tiverem equivalência cadastrada.
   Ponto de entrada: index.html carrega js/main.js como módulo ES, sem build. Módulos: nutrientes e
   alimentos-base (dados), util, dom, calculos (puro, sem estado), estado (persistência e validação),
   dominio (dias, metas, histórico), off (Open Food Facts), backup, demo, ui (telas e folhas). */
import { METAS_VAZIAS, NUTR } from './nutrientes.js';
import { baixar, fmt, hojeISO, normTexto, num, pontuarBusca, somarDias, uid } from './util.js';
import { $, confirmar, mostrarBannerErro, toast } from './dom.js';
import { nutrientesAlimento, nutrientesReceita, totaisReceita } from './calculos.js';
import { brutoCorrompido, carregar, chaveAtual, D, dadosVazios, definirD, salvar, UI, validarDados } from './estado.js';
import { obterDia, temAlgumaMeta } from './dominio.js';
import { compartilharBackup, exportarCSV, exportarJSON, importarJSON } from './backup.js';
import { alternarDemo } from './demo.js';
import { abrirSeletor, fecharFolha, folhaAgua, folhaAlimento, folhaCodigo, folhaDetalheDia, folhaImportarBase, folhaItem, folhaReceita, menuAlimento, menuCombinacao, menuReceita, menuRefeicao, novoDeModelo, render, repetirUltima } from './ui.js';

// ---------- Eventos ----------
document.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab'); if (tab) { UI.aba = tab.dataset.tab; render(); return; }
  const el = e.target.closest('[data-act]'); if (!el || el.closest('#sheet-root')) return;
  const act = el.dataset.act;
  const acoes = {
    'dia-ant': () => { UI.data = somarDias(UI.data, -1); render(); },
    'dia-prox': () => { UI.data = somarDias(UI.data, 1); render(); },
    'ir-hoje': () => { UI.data = hojeISO(); render(); },
    'ir-config': () => { UI.aba = 'config'; render(); },
    'agua-mais': () => { const ml = num(el.dataset.ml); const dia = obterDia(UI.data); dia.agua.push({ id: uid(), ml, em: new Date().toISOString() }); salvar(); render(); },
    'agua-outro': () => folhaAgua(),
    'agua-desfazer': () => { const dia = obterDia(UI.data); const u = dia.agua.pop(); if (u) { salvar(); render(); toast(`Removidos ${fmt(u.ml)} ml.`); } },
    'adicionar': () => { obterDia(UI.data); abrirSeletor(Number(el.dataset.idx)); },
    'editar-item': () => folhaItem(Number(el.dataset.idx), el.dataset.item),
    'detalhe': () => folhaDetalheDia(el.dataset.n),
    'menu-refeicao': () => { obterDia(UI.data); menuRefeicao(Number(el.dataset.idx)); },
    'repetir': () => { obterDia(UI.data); repetirUltima(Number(el.dataset.idx)); },
    'abrir-combinacao': () => menuCombinacao(el.dataset.id),
    'nova-refeicao': () => { const n = prompt('Nome da nova refeição:', 'Ceia'); if (n && n.trim()) { obterDia(UI.data).refeicoes.push({ id: uid(), nome: n.trim(), itens: [] }); salvar(); render(); } },
    'filtro-alimentos': () => { UI.filtroAlimentos = el.dataset.f; render(); },
    'novo-alimento': () => folhaAlimento(null),
    'ler-codigo': () => folhaCodigo((a) => menuAlimento(a.id)),
    'nova-receita': () => folhaReceita(null),
    'abrir-alimento': () => menuAlimento(el.dataset.id),
    'abrir-receita': () => menuReceita(el.dataset.id),
    'hist-dias': () => { UI.histDias = Number(el.dataset.n); render(); },
    'abrir-dia': () => { UI.data = el.dataset.data; UI.aba = 'hoje'; render(); },
    'exportar-json': exportarJSON,
    'compartilhar-backup': () => { compartilharBackup(); },
    'baixar-corrompido': () => { const b = brutoCorrompido(); if (b) baixar(`meu-prato-dados-brutos-${hojeISO()}.txt`, b, 'text/plain;charset=utf-8'); },
    'descartar-corrompido': () => { if (!confirmar('Descartar os dados brutos preservados? Baixe antes se ainda não baixou.')) return; try { localStorage.removeItem(chaveAtual() + '.corrompido'); } catch { /* ignore */ } UI.dadosCorrompidos = null; mostrarBannerErro(); render(); },
    'exportar-csv': exportarCSV,
    'importar-json': () => $('[data-act="arquivo-json"]').click(),
    'alternar-demo': alternarDemo,
    'importar-base': () => folhaImportarBase(),
    'modelo': () => novoDeModelo(Number(el.dataset.i)),
    'apagar-tudo': () => { if (!confirmar('Apagar TODOS os alimentos, receitas e registros deste modo? Não dá para desfazer. Exporte um backup antes, se quiser.')) return; if (!confirmar('Confirma mesmo? Última chance.')) return; definirD(dadosVazios()); salvar(); render(); toast('Dados apagados.'); },
  };
  if (acoes[act]) acoes[act]();
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-act]'); if (!el || el.closest('#sheet-root')) return;
  if (el.dataset.act === 'data' && el.value) { UI.data = el.value; render(); }
  if (el.dataset.act === 'toggle-off') { D.config.consultarOFF = el.checked; salvar(); toast(el.checked ? 'Consulta ligada.' : 'Consulta desligada.'); }
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
    const novas = METAS_VAZIAS();
    for (const n of NUTR) { const v = f[n.k].value.trim(); if (v === '') continue; const x = num(v); if (!(x > 0)) { toast(`${n.nome}: use um número maior que zero ou deixe em branco.`); return; } novas[n.k] = x; }
    const hoje = hojeISO(); D.config.metas = novas;
    D.config.historicoMetas = (D.config.historicoMetas || []).filter((h) => h.desde !== hoje);
    D.config.historicoMetas.push({ desde: hoje, metas: { ...novas } }); D.config.historicoMetas.sort((a, b) => a.desde.localeCompare(b.desde));
    if (salvar()) { toast(temAlgumaMeta(novas) ? 'Metas salvas, valendo a partir de hoje.' : 'Metas removidas a partir de hoje.'); render(); }
  }
  if (f.dataset.form === 'agua') {
    const meta = num(f.meta.value), copo = num(f.copo.value);
    if (!(meta > 0) || !(copo > 0)) { toast('Meta e copo devem ser números maiores que zero.'); return; }
    D.config.metaAgua = Math.round(meta); D.config.copoAgua = Math.round(copo); if (salvar()) toast('Água salva.');
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
window.MeuPrato = { calc: { nutrientesAlimento, nutrientesReceita: (r, q, u) => nutrientesReceita(r, q, u, D.alimentos), totaisReceita: (r) => totaisReceita(r, D.alimentos) }, dados: () => D, validar: validarDados, busca: { normTexto, pontuarBusca }, ui: UI };
definirD(carregar());
render();
