import { baixar, hojeISO } from './util.js';
import { confirmar, toast } from './dom.js';
import { D, definirD, modoDemo, normalizar, repararAguaLegada, salvar, UI, validarDados } from './estado.js';
import { aguaDia, diaTemRegistro } from './dominio.js';
import { render } from './ui.js';

function nomeBackup() { return `meu-prato-backup-${hojeISO()}${modoDemo() ? '-demo' : ''}.json`; }
function conteudoBackup() { return JSON.stringify({ ...D, exportadoEm: new Date().toISOString(), app: 'Meu Prato' }, null, 2); }
export function exportarJSON() { baixar(nomeBackup(), conteudoBackup(), 'application/json'); toast('Backup gerado.'); }
// Abre a tela de compartilhamento do sistema com o arquivo (no Android, o Drive aparece ali).
// O Chrome só compartilha alguns tipos de arquivo (texto, imagem, áudio, vídeo, PDF) e no Android recusa .json.
// Por isso pergunta ao navegador: tenta .json e, se recusado, o mesmo conteúdo como .txt. A importação aceita os dois.
function arquivoCompartilhavel(conteudo) {
  const base = nomeBackup().replace(/\.json$/, '');
  const candidatos = [new File([conteudo], base + '.json', { type: 'application/json' }), new File([conteudo], base + '.txt', { type: 'text/plain' })];
  try { if (navigator.canShare && navigator.share) return candidatos.find((f) => navigator.canShare({ files: [f] })) || null; } catch { /* sem suporte */ }
  return null;
}
export function podeCompartilharArquivo() { return !!arquivoCompartilhavel('{}'); }
export async function compartilharBackup() {
  const conteudo = conteudoBackup();
  const arquivo = arquivoCompartilhavel(conteudo);
  if (arquivo) {
    try {
      await navigator.share({ files: [arquivo], title: 'Backup do Meu Prato', text: `Backup do Meu Prato de ${hojeISO().split('-').reverse().join('/')}.` });
      toast(arquivo.name.endsWith('.txt') ? 'Backup compartilhado como .txt (o Android não aceita .json); a importação aceita esse arquivo.' : 'Backup enviado para compartilhar.');
      return 'compartilhado';
    } catch (e) {
      if (e && e.name === 'AbortError') { toast('Compartilhamento cancelado.'); return 'cancelado'; }
      console.warn('share falhou, baixando', e);
    }
  }
  baixar(nomeBackup(), conteudo, 'application/json');
  toast('Este navegador não compartilha arquivos: o backup foi baixado. Envie-o ao Drive pelo app de arquivos.');
  return 'baixado';
}

export function exportarCSV() {
  const linhas = [['data', 'refeicao', 'alimento', 'tipo', 'quantidade', 'unidade', 'kcal', 'proteina_g', 'carboidrato_g', 'gordura_g', 'fibra_g', 'sodio_mg', 'dia_concluido']];
  const opc = (v, d) => v == null ? '' : v.toFixed(d); // vazio = não informado
  const datas = Object.keys(D.dias).sort();
  for (const data of datas) {
    for (const r of D.dias[data].refeicoes) for (const it of r.itens)
      linhas.push([data, r.nome, it.rotulo, it.tipo, it.qtd, it.unidade, it.kcal.toFixed(1), it.prot.toFixed(2), it.carb.toFixed(2), it.gord.toFixed(2), opc(it.fibra, 2), opc(it.sodio, 0), D.dias[data].concluido ? 'sim' : 'nao']);
    const ml = aguaDia(D.dias[data]); if (ml) linhas.push([data, 'Água', 'Água', 'agua', ml, 'ml', '0.0', '0.00', '0.00', '0.00', '', '', D.dias[data].concluido ? 'sim' : 'nao']);
  }
  const cel = (v) => { const s = String(v); return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  // Números com vírgula decimal e separador ";" para abrir direto no Excel/LibreOffice em pt-BR.
  const csv = '﻿' + linhas.map((l) => l.map((v, i) => (typeof v === 'number' || (i >= 6 && i <= 11)) ? String(v).replace('.', ',') : cel(v)).join(';')).join('\r\n');
  baixar(`meu-prato-historico-${hojeISO()}.csv`, csv, 'text/csv;charset=utf-8'); toast(linhas.length - 1 ? 'CSV gerado.' : 'CSV gerado (sem registros).');
}
function resumoBackup(dados) {
  const dias = Object.values(dados.dias);
  const refeicoes = dias.filter(diaTemRegistro).length;
  const agua = dias.filter((dia) => aguaDia(dia) > 0).length;
  return `${dados.alimentos.length} alimentos, ${dados.receitas.length} receitas. Dias com refeições: ${refeicoes}. Dias com água: ${agua}.`;
}

export function importarJSON(arquivo) {
  const leitor = new FileReader();
  leitor.onload = async () => {
    let obj; try { obj = JSON.parse(leitor.result); } catch { alert('Arquivo não é um JSON válido.'); return; }
    repararAguaLegada(obj);
    const v = validarDados(obj); if (!v.ok) { alert('Backup inválido: ' + v.erro); return; }
    const atual = `Dados atuais: ${resumoBackup(D)}`;
    const novo = `Backup: ${resumoBackup(obj)}` + (obj.exportadoEm ? ` Exportado em ${new Date(obj.exportadoEm).toLocaleString('pt-BR')}.` : '');
    if (!confirmar(`${novo}\n\n${atual}\n\nSUBSTITUIR os dados atuais pelo backup? Esta ação não pode ser desfeita.`)) return;
    definirD(normalizar(obj)); await salvar(); UI.data = hojeISO(); render(); toast('Backup importado.');
  };
  leitor.readAsText(arquivo);
}
