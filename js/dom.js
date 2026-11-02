import { UI } from './estado.js';

export function mostrarBannerErro() { const b = $('#erro-banner'); if (!b) return; const msg = UI.falhaSalvar || (UI.dadosCorrompidos ? 'Os dados salvos neste navegador estavam ilegíveis e foram preservados à parte. Veja Ajustes → Dados e privacidade.' : ''); b.textContent = msg; b.hidden = !msg; }
export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }
export let toastTimer;
export let toastErroAte = 0;
// toast(msg, { rotulo, acao }) mostra um botão (ex.: Desfazer). { erro: true } segura a tela por mais tempo e
// impede que um toast de sucesso logo em seguida o cubra.
export function toast(msg, op = {}) {
  const t = $('#toast');
  if (!op.erro && Date.now() < toastErroAte) return;
  t.textContent = ''; t.append(document.createTextNode(msg));
  if (op.acao) { const b = document.createElement('button'); b.type = 'button'; b.className = 'toast-acao'; b.textContent = op.rotulo || 'Desfazer'; b.addEventListener('click', () => { t.hidden = true; op.acao(); }); t.append(b); }
  t.classList.toggle('topo', !!$('.sheet-backdrop')); // com folha aberta, não cobrir o botão de confirmar
  t.hidden = false; clearTimeout(toastTimer);
  const dur = op.erro ? 5000 : op.acao ? 5000 : 2600; if (op.erro) toastErroAte = Date.now() + 4000;
  toastTimer = setTimeout(() => { t.hidden = true; }, dur);
}
export function confirmar(msg) { return window.confirm(msg); }
