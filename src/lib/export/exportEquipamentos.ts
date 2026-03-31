import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Equipamento } from '@/types';
import { getRegiao } from '@/data/municipios';
import { ts, fmtDate, addPdfCover, addPdfHeader, addPdfFooters, styleWorksheet, saveWb } from './shared';
import type { QualificacaoExport } from './exportQualificacoes';

export async function exportEquipamentosToPDF(equipamentos: Equipamento[], filterRegiao?: string) {
  const doc = new jsPDF('landscape');

  // ── Capa ──────────────────────────────────────────────────────────────────
  const comPatrulha = equipamentos.filter(e => e.possui_patrulha).length;
  const comKit      = equipamentos.filter(e => e.kit_athena_entregue).length;
  const comCap      = equipamentos.filter(e => e.capacitacao_realizada).length;
  const regioes     = new Set(equipamentos.map(e => getRegiao(e.municipio)).filter(Boolean)).size;

  await addPdfCover(doc, {
    titulo:     'EQUIPAMENTOS DA REDE',
    subtitulo:  'Casas da Mulher, Salas Lilás e DDMs — Ceará',
    colorKey:   'equipamentos',
    landscape:  true,
    descricao:  filterRegiao && filterRegiao !== 'all' ? `Região: ${filterRegiao}` : 'Todos os municípios do Estado',
    stats: [
      { label: 'Equipamentos', valor: equipamentos.length },
      { label: 'Com Patrulha M.P.', valor: comPatrulha },
      { label: 'Com Kit Athena', valor: comKit },
      { label: 'Regiões', valor: regioes },
    ],
  });

  // ── Conteúdo ──────────────────────────────────────────────────────────────
  doc.addPage();
  let startY = addPdfHeader(doc, 'Equipamentos', 'Relatório de Equipamentos');
  doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  doc.text(`Total: ${equipamentos.length} registros${filterRegiao && filterRegiao !== 'all' ? ` — Região: ${filterRegiao}` : ''}`, 14, startY);
  doc.setTextColor(0, 0, 0);
  autoTable(doc, {
    head: [['Município', 'Região', 'Tipo', 'Patrulha M.P.', 'Endereço', 'Responsável', 'Telefone']],
    body: equipamentos.map(e => [e.municipio, getRegiao(e.municipio) || '-', e.tipo, e.possui_patrulha ? 'Sim' : 'Não', e.endereco || '-', e.responsavel || '-', e.telefone || '-']),
    startY: startY + 6,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [31, 81, 140] },
    alternateRowStyles: { fillColor: [240, 244, 250] },
  });
  addPdfFooters(doc);
  doc.save(`equipamentos_${ts()}.pdf`);
}

export function exportEquipamentosToExcel(equipamentos: Equipamento[], qualificacoes?: QualificacaoExport[]) {
  const qualMap = new Map(qualificacoes?.map(q => [q.id, q.nome]) ?? []);
  const data = equipamentos.map(e => ({
    'Município':           e.municipio,
    'Região':              getRegiao(e.municipio) || '',
    'Tipo':                e.tipo,
    'Patrulha M.P.':       e.possui_patrulha ? 'Sim' : 'Não',
    'Kit Athena':          e.kit_athena_entregue ? 'Sim' : 'Não',
    'Kit Athena (Prévio)': e.kit_athena_previo  ? 'Sim' : 'Não',
    'Capacitação':         e.capacitacao_realizada ? 'Sim' : 'Não',
    'Curso Vinculado':     e.qualificacao_id ? (qualMap.get(e.qualificacao_id) ?? e.qualificacao_id) : '',
    'NUP':                 e.nup || '',
    'Endereço':            e.endereco || '',
    'Responsável':         e.responsavel || '',
    'Telefone':            e.telefone || '',
    'Observações':         e.observacoes || '',
    'Data de Criação':     fmtDate(e.created_at),
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  styleWorksheet(ws, '1F518C');
  XLSX.utils.book_append_sheet(wb, ws, 'Equipamentos');
  saveWb(wb, `equipamentos_${ts()}.xlsx`);
}