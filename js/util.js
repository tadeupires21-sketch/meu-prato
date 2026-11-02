// ---------- Utilidades ----------
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export function hojeISO() { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; }
export function p2(n) { return String(n).padStart(2, '0'); }
export function somarDias(iso, n) { const [a, m, d] = iso.split('-').map(Number); const dt = new Date(a, m - 1, d + n); return `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`; }
export function rotuloData(iso) {
  if (iso === hojeISO()) return 'Hoje';
  if (iso === somarDias(hojeISO(), -1)) return 'Ontem';
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
}
export function dataCurta(iso) { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', ''); }
export function fmt(n, dec = 0) { if (n == null || !isFinite(n)) return '–'; return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: dec }); }
// Aceita "1,5", "1.5", "2.000" (milhar pt-BR) e "1.234,5". Ponto só é decimal quando não houver vírgula e não
// casar com o padrão de milhar.
export function num(str) {
  if (typeof str === 'number') return str; if (str == null) return NaN;
  let t = String(str).trim().replace(/\s/g, ''); if (t === '') return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  return Number(t);
}
// Valor para dentro de <input>: sem separador de milhar, para o que se mostra ser o que se lê de volta.
export function fmtIn(n, dec = 2) { if (n == null || !isFinite(n)) return ''; return Number(n).toLocaleString('pt-BR', { useGrouping: false, minimumFractionDigits: 0, maximumFractionDigits: dec }); }
// Busca: ignora acentos, caixa e ordem das palavras; nome vale mais que marca.
export function normTexto(t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
export function pontuarBusca(q, nome, marca = '') {
  const palavras = normTexto(q).split(' ').filter(Boolean); if (!palavras.length) return 1;
  const n = normTexto(nome), m = normTexto(marca), nm = n + ' ' + m;
  if (!palavras.every((p) => nm.includes(p))) return 0;
  if (palavras.every((p) => n.includes(p))) return n.startsWith(palavras[0]) ? 3 : 2;
  return 1;
}
export function filtrarOrdenar(lista, q, nomeDe, marcaDe = () => '') {
  return lista.map((x) => ({ x, p: pontuarBusca(q, nomeDe(x), marcaDe(x)) })).filter((o) => o.p > 0)
    .sort((a, b) => b.p - a.p || nomeDe(a.x).localeCompare(nomeDe(b.x), 'pt-BR')).map((o) => o.x);
}
export function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
// ---------- Backup ----------
export function baixar(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
