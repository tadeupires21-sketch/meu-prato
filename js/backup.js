import { baixar, hojeISO } from './util.js';
import { confirmar, toast } from './dom.js';
import { D, definirD, modoDemo, normalizar, salvar, UI, validarDados } from './estado.js';
import { aguaDia, diaTemRegistro } from './dominio.js';
import { render } from './ui.js';

export function exportarJSON() { baixar(`meu-prato-backup-${hojeISO()}${modoDemo() ? '-demo' : ''}.json`, JSON.stringify({ ...D, exportadoEm: new Date().toISOString(), app: 'Meu Prato' }, null, 2), 'application/json'); toast('Backup gerado.'); }
export function exportarCSV() {
  const linhas = [['data', 'refeicao', 'alimento', 'tipo', 'quantidade', 'unidade', 'kcal', 'proteina_g', 'carboidrato_g', 'gordura_g', 'fibra_g', 'sodio_mg', 'dia_concluido']];
  const opc = (v, d) => v == null ? '' : v.toFixed(d); // vazio = não informado
  const datas = Object.keys(D.dias).sort();
  for (const data of datas) {
    for (const r of D.dias[data].refeicoes) for (const it of r.itens)
      linhas.push([data, r.nome, it.rotulo, it.tipo, it.qtd, it.unidade, it.kcal.toFixed(1), it.prot.toFixed(2), it.carb.toFixed(2), it.gord.toFixed(2), opc(it.fibra, 2), opc(it.sodio, 0), D.dias[data].concluido ? 'sim' : 'nao']);
    const ml = aguaDia(D.dias[data]); if (ml) linhas.push([data, 'Água', 'Água', 'agua', ml, 'ml', '0.0', '0.00', '0.00', '0.00', '', '', D.dias[data].concluido ? 'sim' : 'nao']);
  }
  const cel = (v) => { const s = String(v).replace(/\./g, ',' ); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  // Números com vírgula decimal e separador ";" para abrir direto no Excel/LibreOffice em pt-BR.
  const csv = '﻿' + linhas.map((l) => l.map((v, i) => (typeof v === 'number' || (i >= 6 && i <= 11)) ? String(v).replace('.', ',') : cel(v)).join(';')).join('\r\n');
  baixar(`meu-prato-historico-${hojeISO()}.csv`, csv, 'text/csv;charset=utf-8'); toast(linhas.length - 1 ? 'CSV gerado.' : 'CSV gerado (sem registros).');
}
export function importarJSON(arquivo) {
  const leitor = new FileReader();
  leitor.onload = () => {
    let obj; try { obj = JSON.parse(leitor.result); } catch { alert('Arquivo não é um JSON válido.'); return; }
    const v = validarDados(obj); if (!v.ok) { alert('Backup inválido: ' + v.erro); return; }
    const nDias = Object.values(obj.dias).filter(diaTemRegistro).length;
    const atual = `Dados atuais: ${D.alimentos.length} alimentos, ${D.receitas.length} receitas, ${Object.values(D.dias).filter(diaTemRegistro).length} dias com registro.`;
    const novo = `Backup: ${obj.alimentos.length} alimentos, ${obj.receitas.length} receitas, ${nDias} dias com registro${obj.exportadoEm ? ` (exportado em ${new Date(obj.exportadoEm).toLocaleString('pt-BR')})` : ''}.`;
    if (!confirmar(`${novo}\n\n${atual}\n\nSUBSTITUIR os dados atuais pelo backup? Esta ação não pode ser desfeita.`)) return;
    definirD(normalizar(obj)); salvar(); UI.data = hojeISO(); render(); toast('Backup importado.');
  };
  leitor.readAsText(arquivo);
}
