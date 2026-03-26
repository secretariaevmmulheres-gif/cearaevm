import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Solicitacao } from '@/types';
import { getRegiao } from '@/data/municipios';
import { ts, fmtDate, addPdfHeader, addPdfFooters, styleWorksheet, saveWb } from './shared';
import type { QualificacaoExport } from './exportQualificacoes';

export function exportSolicitacoesToPDF(solicitacoes: Solicitacao[], filterRegiao?: string) {
  const doc = new jsPDF('landscape');
  let startY = addPdfHeader(doc, 'Solicitações', 'Relatório de Solicitações');
  doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  doc.text(`Total: ${solicitacoes.length} registros${filterRegiao && filterRegiao !== 'all' ? ` — Região: ${filterRegiao}` : ''}`, 14, startY);
  doc.setTextColor(0, 0, 0);
  autoTable(doc, {
    head: [['Município', 'Região', 'Tipo', 'Status', 'Data', 'NUP', 'Guarda', 'Patrulha', 'Kit Athena', 'Qualificação']],
    body: solicitacoes.map(s => [s.municipio, getRegiao(s.municipio) || '-', s.tipo_equipamento, s.status, fmtDate(s.data_solicitacao), s.nup || '-', s.guarda_municipal_estruturada ? 'Sim' : 'Não', s.recebeu_patrulha ? 'Sim' : 'Não', s.kit_athena_entregue ? 'Sim' : 'Não', s.capacitacao_realizada ? 'Sim' : 'Não']),
    startY: startY + 6,
    styles: { fontSize: 6.5 },
    headStyles: { fillColor: [31, 81, 140] },
    alternateRowStyles: { fillColor: [240, 244, 250] },
  });
  addPdfFooters(doc);
  doc.save(`solicitacoes_${ts()}.pdf`);
}

export function exportSolicitacoesToExcel(solicitacoes: Solicitacao[], qualificacoes?: QualificacaoExport[]) {
  const qualMap = new Map(qualificacoes?.map(q => [q.id, q.nome]) ?? []);
  const data = solicitacoes.map(s => ({
    'Município':                    s.municipio,
    'Região':                       getRegiao(s.municipio) || '',
    'Tipo de Equipamento':          s.tipo_equipamento,
    'Status':                       s.status,
    'Data da Solicitação':          fmtDate(s.data_solicitacao),
    'NUP':                          s.nup || '',
    'Guarda Municipal Estruturada': s.guarda_municipal_estruturada ? 'Sim' : 'Não',
    'Recebeu Patrulha':             s.recebeu_patrulha ? 'Sim' : 'Não',
    'Kit Athena Entregue':          s.kit_athena_entregue ? 'Sim' : 'Não',
    'Kit Athena (Prévio)':          s.kit_athena_previo  ? 'Sim' : 'Não',
    'Capacitação Realizada':        s.capacitacao_realizada ? 'Sim' : 'Não',
    'Curso Vinculado':              s.qualificacao_id ? (qualMap.get(s.qualificacao_id) ?? s.qualificacao_id) : '',
    'Observações':                  s.observacoes || '',
  }));
  const wb = XLSX.utils.book_new();
  const sWs2 = XLSX.utils.json_to_sheet(data);
  styleWorksheet(sWs2, 'EA580C');
  XLSX.utils.book_append_sheet(wb, sWs2, 'Solicitações');
  saveWb(wb, `solicitacoes_${ts()}.xlsx`);
}