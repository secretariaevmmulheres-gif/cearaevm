import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Equipamento, Viatura, Solicitacao, Patrulha } from '@/types';
import { getRegiao } from '@/data/municipios';
import { ts, fmtDate, addPdfCover, addPdfHeader, addPdfFooters, styleWorksheet, saveWb } from './shared';

export async function exportPatrulhasCasasToPDF(patrulhas: Patrulha[], equipamentos: Equipamento[], solicitacoes: Solicitacao[]) {
  const comEquipamento = patrulhas.filter(p => p.equipamento_id !== null);
  const emSolicitacao  = patrulhas.filter(p => p.solicitacao_id !== null);
  const total   = patrulhas.length;
  const regioes = new Set(patrulhas.map(p => getRegiao(p.municipio)).filter(Boolean)).size;

  const doc = new jsPDF('landscape');

  await addPdfCover(doc, {
    titulo:    'PATRULHAS MARIA DA PENHA',
    subtitulo: 'Patrulhas nas Casas da Mulher — Ceará',
    colorKey:  'viaturas',
    landscape: true,
    stats: [
      { label: 'Total de Patrulhas', valor: total },
      { label: 'CMM Inaugurada',     valor: comEquipamento.length },
      { label: 'CMM em Processo',    valor: emSolicitacao.length },
      { label: 'Regiões',            valor: regioes },
    ],
  });

  doc.addPage();
  const startY = addPdfHeader(doc, 'Patrulhas Maria da Penha', 'Relatório de Patrulhas M.P. das Casas da Mulher');
  doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  doc.text(`Total: ${total} patrulhas (${comEquipamento.length} em CMMs inauguradas · ${emSolicitacao.length} em processo)`, 14, startY);
  doc.setTextColor(0, 0, 0);

  // Enriquecer com dados de equipamento/solicitação
  const rows = patrulhas.map(p => {
    const equip = p.equipamento_id ? equipamentos.find(e => e.id === p.equipamento_id) : null;
    const solic = p.solicitacao_id ? solicitacoes.find(s => s.id === p.solicitacao_id) : null;
    const situacao = equip ? 'CMM Inaugurada' : solic ? `Em processo (${solic.status})` : '—';
    return [
      p.municipio,
      getRegiao(p.municipio) || '—',
      p.orgao,
      p.efetivo != null ? String(p.efetivo) : '—',
      p.viaturas != null ? String(p.viaturas) : '—',
      p.data_implantacao ? fmtDate(p.data_implantacao) : '—',
      p.responsavel || '—',
      situacao,
    ];
  });

  autoTable(doc, {
    head: [['Município', 'Região', 'Órgão', 'Efetivo', 'Viaturas', 'Implantação', 'Responsável', 'Situação']],
    body: rows,
    startY: startY + 6,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [6, 182, 212] },
    alternateRowStyles: { fillColor: [236, 254, 255] },
  });
  addPdfFooters(doc);
  doc.save(`patrulhas-maria-da-penha_${ts()}.pdf`);
}

export function exportPatrulhasCasasToExcel(patrulhas: Patrulha[], equipamentos: Equipamento[], solicitacoes: Solicitacao[]) {
  const data = patrulhas.map(p => {
    const equip = p.equipamento_id ? equipamentos.find(e => e.id === p.equipamento_id) : null;
    const solic = p.solicitacao_id ? solicitacoes.find(s => s.id === p.solicitacao_id) : null;
    const situacao = equip ? 'CMM Inaugurada' : solic ? `Em processo (${solic.status})` : '—';
    return {
      'Município':       p.municipio,
      'Região':          getRegiao(p.municipio) || '',
      'Órgão':           p.orgao,
      'Efetivo':         p.efetivo ?? '',
      'Viaturas Próprias': p.viaturas ?? '',
      'Responsável':     p.responsavel || '',
      'Contato':         p.contato || '',
      'Data Implantação': p.data_implantacao ? fmtDate(p.data_implantacao) : '',
      'Situação':        situacao,
      'Observações':     p.observacoes || '',
    };
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  styleWorksheet(ws, '06B6D4');
  XLSX.utils.book_append_sheet(wb, ws, 'Patrulhas M.P.');
  saveWb(wb, `patrulhas-maria-da-penha_${ts()}.xlsx`);
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