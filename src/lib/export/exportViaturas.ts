import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Equipamento, Viatura, Solicitacao } from '@/types';
import { getRegiao } from '@/data/municipios';
import { ts, fmtDate, addPdfHeader, addPdfFooters, styleWorksheet, saveWb } from './shared';

export function exportPatrulhasCasasToPDF(equipamentos: Equipamento[], solicitacoes: Solicitacao[]) {
  const patrulhasEquip = equipamentos.filter(e => e.possui_patrulha);
  const municipiosComPatrulhaEquip = new Set(patrulhasEquip.map(e => e.municipio));
  const patrulhasSolic = solicitacoes.filter(s => s.recebeu_patrulha && !municipiosComPatrulhaEquip.has(s.municipio));
  const doc = new jsPDF('landscape');
  const startY = addPdfHeader(doc, 'Patrulhas das Casas', 'Relatório de Patrulhas Maria da Penha das Casas');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Total: ${patrulhasEquip.length + patrulhasSolic.length} registros (${patrulhasEquip.length} de Equipamentos + ${patrulhasSolic.length} de Solicitações)`, 14, startY);
  doc.setTextColor(0, 0, 0);
  autoTable(doc, {
    head: [['Município', 'Região', 'Tipo Equipamento', 'Origem', 'Status', 'Endereço', 'Responsável', 'Telefone']],
    body: [
      ...patrulhasEquip.map(e => [e.municipio, getRegiao(e.municipio) || '-', e.tipo, 'Equipamento', '-', e.endereco || '-', e.responsavel || '-', e.telefone || '-']),
      ...patrulhasSolic.map(s => [s.municipio, getRegiao(s.municipio) || '-', s.tipo_equipamento, 'Solicitação', s.status, '-', '-', '-']),
    ],
    startY: startY + 6,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [16, 185, 129] },
  });
  addPdfFooters(doc);
  doc.save(`patrulhas-casas_${ts()}.pdf`);
}

export function exportPatrulhasCasasToExcel(equipamentos: Equipamento[], solicitacoes: Solicitacao[]) {
  const patrulhasEquip = equipamentos.filter(e => e.possui_patrulha);
  const municipiosComPatrulhaEquip = new Set(patrulhasEquip.map(e => e.municipio));
  const patrulhasSolic = solicitacoes.filter(s => s.recebeu_patrulha && !municipiosComPatrulhaEquip.has(s.municipio));
  const data = [
    ...patrulhasEquip.map(e => ({ 'Município': e.municipio, 'Região': getRegiao(e.municipio) || '', 'Tipo de Equipamento': e.tipo, 'Origem': 'Equipamento', 'Status': '-', 'Endereço': e.endereco || '', 'Responsável': e.responsavel || '', 'Telefone': e.telefone || '', 'Observações': e.observacoes || '', 'Data de Criação': fmtDate(e.created_at) })),
    ...patrulhasSolic.map(s => ({ 'Município': s.municipio, 'Região': getRegiao(s.municipio) || '', 'Tipo de Equipamento': s.tipo_equipamento, 'Origem': 'Solicitação', 'Status': s.status, 'Endereço': '', 'Responsável': '', 'Telefone': '', 'Observações': s.observacoes || '', 'Data de Criação': fmtDate(s.created_at) })),
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  styleWorksheet(ws, '10B981');
  XLSX.utils.book_append_sheet(wb, ws, 'Patrulhas Casas');
  saveWb(wb, `patrulhas-casas_${ts()}.xlsx`);
}

export function exportViaturasToPDF(viaturas: Viatura[]) {
  const doc = new jsPDF('landscape');
  const startY = addPdfHeader(doc, 'Viaturas PMCE', 'Relatório de Viaturas PMCE');
  doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  doc.text(`Total: ${viaturas.length} registros`, 14, startY);
  doc.setTextColor(0, 0, 0);
  autoTable(doc, {
    head: [['Município', 'Região', 'Órgão', 'Qtd', 'Implantação', 'Vinculada', 'Responsável']],
    body: viaturas.map(v => [v.municipio, getRegiao(v.municipio) || '-', v.orgao_responsavel, v.quantidade.toString(), fmtDate(v.data_implantacao), v.vinculada_equipamento ? 'Sim' : 'Não', v.responsavel || '-']),
    startY: startY + 6,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [31, 81, 140] },
    alternateRowStyles: { fillColor: [240, 244, 250] },
  });
  addPdfFooters(doc);
  doc.save(`viaturas-pmce_${ts()}.pdf`);
}

export function exportViaturasToExcel(viaturas: Viatura[]) {
  const data = viaturas.map(v => ({ 'Município': v.municipio, 'Região': getRegiao(v.municipio) || '', 'Tipo de Patrulha': v.tipo_patrulha, 'Órgão Responsável': v.orgao_responsavel, 'Quantidade': v.quantidade, 'Vinculada a Equipamento': v.vinculada_equipamento ? 'Sim' : 'Não', 'Data de Implantação': fmtDate(v.data_implantacao), 'Responsável': v.responsavel || '', 'Observações': v.observacoes || '' }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  styleWorksheet(ws, '7C3AED');
  XLSX.utils.book_append_sheet(wb, ws, 'Viaturas PMCE');
  saveWb(wb, `viaturas-pmce_${ts()}.xlsx`);
}