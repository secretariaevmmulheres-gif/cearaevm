import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Atividade } from '@/types';
import { getRegiao } from '@/data/municipios';
import { ts, fmtDate, lastY, addPdfCover, addPdfHeader, addPdfFooters, styleWorksheet, saveWb } from './shared';

export async function exportAtividadesToPDF(atividades: Atividade[], filterLabel?: string) {
  const realizadas = atividades.filter(a => a.status === 'Realizado').length;
  const agendadas  = atividades.filter(a => a.status === 'Agendado').length;
  const totalAtend = atividades.reduce((s, a) => s + (a.atendimentos ?? 0), 0);
  const sedes      = new Set(atividades.map(a => a.municipio_sede)).size;

  const doc = new jsPDF('landscape');

  await addPdfCover(doc, {
    titulo:    'ATIVIDADES E ATENDIMENTOS',
    subtitulo: 'Unidades Móveis, Eventos, Tendas Lilás e Palestras — Ceará',
    colorKey:  'atividades',
    landscape: true,
    descricao: filterLabel || undefined,
    stats: [
      { label: 'Total de Atividades', valor: atividades.length },
      { label: 'Realizadas',          valor: realizadas },
      { label: 'Agendadas',           valor: agendadas },
      { label: 'Atendimentos',        valor: totalAtend.toLocaleString('pt-BR') },
    ],
  });

  doc.addPage();
  let startY = addPdfHeader(doc, 'Atividades', 'Relatório de Atividades');
  doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  doc.text(`Total: ${atividades.length} registro(s)${filterLabel ? ` — ${filterLabel}` : ''}`, 14, startY);
  doc.setTextColor(0, 0, 0);
  startY += 5;
  doc.setFontSize(8);
  doc.text(`Realizadas: ${realizadas}  |  Agendadas: ${agendadas}  |  Total de atendimentos: ${totalAtend}`, 14, startY);
  startY += 8;
  const sedesArr = Array.from(new Set(atividades.map(a => a.municipio_sede))).sort();
  sedesArr.forEach((sede, idx) => {
    const grupo = atividades.filter(a => a.municipio_sede === sede);
    const atendSede = grupo.reduce((s, a) => s + (a.atendimentos ?? 0), 0);
    doc.setFontSize(10); doc.setFont(undefined, 'bold');
    doc.setTextColor(124, 58, 237);
    doc.text(`${sede}`, 14, startY);
    doc.setFont(undefined, 'normal'); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text(`${grupo.length} atividade(s) | ${atendSede} atendimento(s)`, 14, startY + 5);
    doc.setTextColor(0, 0, 0);
    autoTable(doc, {
      head: [['Município', 'Região', 'Tipo', 'Recurso', 'Data', 'Dias', 'Horário', 'Status', 'Atend.', 'NUP', 'Evento']],
      body: grupo.map(a => [a.municipio, getRegiao(a.municipio) || '-', a.tipo, a.recurso, fmtDate(a.data), a.dias?.toString() || '-', a.horario || '-', a.status, a.atendimentos?.toString() || '-', a.nup || '-', a.nome_evento || '-']),
      startY: startY + 9,
      styles: { fontSize: 6.5 },
      headStyles: { fillColor: [124, 58, 237] },
      alternateRowStyles: { fillColor: [245, 243, 255] },
    });
    startY = lastY(doc) + 10;
    if (idx < sedesArr.length - 1 && startY > 160) {
      doc.addPage();
      startY = addPdfHeader(doc, 'Atividades', 'Relatório de Atividades (cont.)') + 5;
    }
  });
  addPdfFooters(doc);
  doc.save(`atividades_${ts()}.pdf`);
}

export function exportAtividadesToExcel(atividades: Atividade[]) {
  const data = atividades.map(a => ({
    'Município': a.municipio, 'Região': getRegiao(a.municipio) || '', 'Sede (CMB/CMC)': a.municipio_sede,
    'Tipo': a.tipo, 'Recurso': a.recurso, 'Qtd. Equipe': a.quantidade_equipe ?? '',
    'Status': a.status, 'Data': fmtDate(a.data),
    'Duração (dias)': a.dias ?? '', 'Horário': a.horario || '', 'Atendimentos': a.atendimentos ?? '',
    'NUP': a.nup || '', 'Nome do Evento': a.nome_evento || '', 'Endereço / Tel': a.endereco || '',
    'Observações': a.observacoes || '', 'Data de Criação': fmtDate(a.created_at),
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  styleWorksheet(ws, '7C3AED');
  XLSX.utils.book_append_sheet(wb, ws, 'Atividades');
  saveWb(wb, `atividades_${ts()}.xlsx`);
}