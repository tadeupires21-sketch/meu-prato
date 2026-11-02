import { METAS_VAZIAS } from './nutrientes.js';
import { hojeISO, somarDias, uid } from './util.js';
import { toast } from './dom.js';
import { escalar } from './calculos.js';
import { carregar, CHAVE_MODO, definirD, modoDemo, REFEICOES_PADRAO, salvar, UI } from './estado.js';
import { render } from './ui.js';

// ---------- Demonstração ----------
export function semearDemo(d) {
  const mk = (nome, marca, refQtd, refUnidade, kcal, prot, carb, gord, medidas = [], estado = 'na', favorito = false) => ({ id: uid(), nome, marca, estado, refQtd, refUnidade, kcal, prot, carb, gord, medidas, favorito, criadoEm: new Date().toISOString() });
  const ovo = mk('Ovo de galinha (exemplo)', '', 100, 'g', 143, 13, 1, 10, [{ nome: 'unidade', equivale: 50 }], 'cozido', true);
  const pao = mk('Pão francês (exemplo)', '', 100, 'g', 300, 8, 58, 3, [{ nome: 'unidade', equivale: 50 }]);
  const arroz = mk('Arroz branco cozido (exemplo)', '', 100, 'g', 128, 2.5, 28, 0.2, [{ nome: 'colher de servir', equivale: 45 }], 'cozido');
  const feijao = mk('Feijão carioca cozido (exemplo)', '', 100, 'g', 76, 4.8, 13.6, 0.5, [{ nome: 'concha', equivale: 80 }], 'cozido');
  const frango = mk('Peito de frango grelhado (exemplo)', '', 100, 'g', 159, 32, 0, 2.5, [], 'cozido', true);
  const whey = mk('Whey protein (exemplo)', 'Marca X', 30, 'g', 120, 24, 3, 2, [{ nome: 'scoop', equivale: 30 }], 'na', true);
  const iog = mk('Iogurte natural (exemplo)', '', 100, 'g', 60, 4, 5, 3);
  d.config.metas = { ...METAS_VAZIAS(), kcal: 2000, prot: 120 }; d.config.historicoMetas = [{ desde: '1970-01-01', metas: { ...d.config.metas }, origem: 'demonstração' }];
  d.alimentos.push(ovo, pao, arroz, feijao, frango, whey, iog);
  d.alimentos.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
  const ing = (a, qtd, unidade) => ({ alimentoId: a.id, rotulo: a.nome, qtd, unidade, ...nutrientesAlimentoDe(a, qtd, unidade) });
  d.receitas.push({ id: uid(), nome: 'Pão com ovo (exemplo)', porcoes: 1, pesoFinal: null, favorito: true, ingredientes: [ing(pao, 1, 'unidade'), ing(ovo, 1, 'unidade')], criadoEm: new Date().toISOString() },
    { id: uid(), nome: 'Iogurte com whey (exemplo)', porcoes: 1, pesoFinal: 230, favorito: false, ingredientes: [ing(iog, 200, 'g'), ing(whey, 1, 'scoop')], criadoEm: new Date().toISOString() });
  const hoje = hojeISO();
  for (let i = 1; i <= 5; i++) {
    const iso = somarDias(hoje, -i);
    const dia = { refeicoes: REFEICOES_PADRAO.map((n) => ({ id: uid(), nome: n, itens: [] })), concluido: i !== 2, agua: [] };
    const add = (ref, a, qtd, unidade) => dia.refeicoes[ref].itens.push({ id: uid(), tipo: 'alimento', refId: a.id, rotulo: a.nome, qtd, unidade, criadoEm: new Date().toISOString(), ...nutrientesAlimentoDe(a, qtd, unidade) });
    dia.agua = [250, 500, 250, 350].slice(0, 2 + (i % 3)).map((ml) => ({ id: uid(), ml, em: new Date().toISOString() }));
    add(0, pao, 2, 'unidade'); add(0, ovo, 2, 'unidade'); add(1, arroz, 150 + i * 10, 'g'); add(1, feijao, 1, 'concha'); add(1, frango, 150, 'g'); add(2, whey, 1, 'scoop'); add(3, frango, 120, 'g'); add(3, arroz, 100, 'g');
    d.dias[iso] = dia;
  }
}
export function nutrientesAlimentoDe(a, qtd, unidade) { const u = [{ nome: a.refUnidade, fator: 1 }, ...a.medidas.map((m) => ({ nome: m.nome, fator: m.equivale }))].find((x) => x.nome === unidade); return escalar(a, (qtd * u.fator) / a.refQtd); }
export function alternarDemo() {
  const entrando = !modoDemo();
  try { if (entrando) localStorage.setItem(CHAVE_MODO, 'demo'); else localStorage.removeItem(CHAVE_MODO); } catch { toast('Sem acesso ao armazenamento.'); return; }
  definirD(carregar()); if (entrando) salvar(); UI.data = hojeISO(); UI.aba = 'hoje'; render();
  toast(entrando ? 'Modo demonstração ativado.' : 'De volta aos seus dados reais.');
}
