import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Equipamento, Viatura, Solicitacao } from '@/types';
import { getRegiao } from '@/data/municipios';
import { ts, fmtDate, addPdfCover, addPdfHeader, addPdfFooters, styleWorksheet, saveWb } from './shared';

export async function exportPatrulhasCasasToPDF(equipamentos: Equipamento[], solicitacoes: Solicitacao[]) {
  const patrulhasEquip = equipamentos.filter(e => e.possui_patrulha);
  const municipiosComPatrulhaEquip = new Set(patrulhasEquip.map(e => e.municipio));
  const patrulhasSolic = solicitacoes.filter(s => s.recebeu_patrulha && !municipiosComPatrulhaEquip.has(s.municipio));
  const total = patrulhasEquip.length + patrulhasSolic.length;
  const regioes = new Set([...patrulhasEquip.map(e => getRegiao(e.municipio)), ...patrulhasSolic.map(s => getRegiao(s.municipio))].filter(Boolean)).size;

  const doc = new jsPDF('landscape');

  await addPdfCover(doc, {
    titulo:    'PATRULHAS MARIA DA PENHA',
    subtitulo: 'Patrulhas nas Casas da Mulher e Salas Lilás — Ceará',
    colorKey:  'viaturas',
    landscape: true,
    stats: [
      { label: 'Total de Patrulhas', valor: total },
      { label: 'Em Equipamentos',   valor: patrulhasEquip.length },
      { label: 'Em Solicitações',   valor: patrulhasSolic.length },
      { label: 'Regiões',           valor: regioes },
    ],
  });

  doc.addPage();
  const startY = addPdfHeader(doc, 'Patrulhas das Casas', 'Relatório de Patrulhas Maria da Penha das Casas');
  doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  doc.text(`Total: ${total} registros (${patrulhasEquip.length} de Equipamentos + ${patrulhasSolic.length} de Solicitações)`, 14, startY);
  doc.setTextColor(0, 0, 0);
  autoTable(doc, {
    head: [['Município', 'Região', 'Tipo Equipamento', 'Origem', 'Status', 'Endereço', 'Responsável', 'Telefone']],
    body: [
      ...patrulhasEquip.map(e => [e.municipio, getRegiao(e.municipio) || '-', e.tipo, 'Equipamento', '-', e.endereco || '-', e.responsavel || '-', e.telefone || '-']),
      ...patrulhasSolic.map(s => [s.municipio, getRegiao(s.municipio) || '-', s.tipo_equipamento, 'Solicitação', s.status, '-', '-', '-']),
    ],
    startY: startY + 6,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [6, 182, 212] },
    alternateRowStyles: { fillColor: [236, 254, 255] },
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
  styleWorksheet(ws, '06B6D4');
  XLSX.utils.book_append_sheet(wb, ws, 'Patrulhas Casas');
  saveWb(wb, `patrulhas-casas_${ts()}.xlsx`);
}

export async function exportViaturasToPDF(viaturas: Viatura[]) {
  const totalUnidades  = viaturas.reduce((s, v) => s + v.quantidade, 0);
  const vinculadas     = viaturas.filter(v => v.vinculada_equipamento).reduce((s, v) => s + v.quantidade, 0);
  const naoVinculadas  = totalUnidades - vinculadas;
  const orgaos         = new Set(viaturas.map(v => v.orgao_responsavel)).size;

  const doc = new jsPDF('landscape');

  await addPdfCover(doc, {
    titulo:    'VIATURAS PMCE',
    subtitulo: 'Frota de Patrulhamento — Polícia Militar do Ceará',
    colorKey:  'viaturas',
    landscape: true,
    stats: [
      { label: 'Total de Viaturas',  valor: totalUnidades },
      { label: 'Registros',          valor: viaturas.length },
      { label: 'Vinculadas a Casa',  valor: vinculadas },
      { label: 'Órgãos',            valor: orgaos },
    ],
  });

  doc.addPage();
  const startY = addPdfHeader(doc, 'Viaturas PMCE', 'Relatório de Viaturas PMCE');
  doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  doc.text(`Total: ${viaturas.length} registros | ${totalUnidades} unidades`, 14, startY);
  doc.setTextColor(0, 0, 0);
  autoTable(doc, {
    head: [['Município', 'Região', 'Órgão', 'Qtd', 'Implantação', 'Vinculada', 'Responsável']],
    body: viaturas.map(v => [v.municipio, getRegiao(v.municipio) || '-', v.orgao_responsavel, v.quantidade.toString(), fmtDate(v.data_implantacao), v.vinculada_equipamento ? 'Sim' : 'Não', v.responsavel || '-']),
    startY: startY + 6,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [6, 182, 212] },
    alternateRowStyles: { fillColor: [236, 254, 255] },
  });
  addPdfFooters(doc);
  doc.save(`viaturas-pmce_${ts()}.pdf`);
}

export function exportViaturasToExcel(viaturas: Viatura[]) {
  const data = viaturas.map(v => ({ 'Município': v.municipio, 'Região': getRegiao(v.municipio) || '', 'Tipo de Patrulha': v.tipo_patrulha, 'Órgão Responsável': v.orgao_responsavel, 'Quantidade': v.quantidade, 'Vinculada a Equipamento': v.vinculada_equipamento ? 'Sim' : 'Não', 'Data de Implantação': fmtDate(v.data_implantacao), 'Responsável': v.responsavel || '', 'Observações': v.observacoes || '' }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  styleWorksheet(ws, '06B6D4');
  XLSX.utils.book_append_sheet(wb, ws, 'Viaturas PMCE');
  saveWb(wb, `viaturas-pmce_${ts()}.xlsx`);
}