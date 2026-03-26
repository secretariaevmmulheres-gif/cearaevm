import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { Equipamento, Viatura, Solicitacao, DashboardStats, Atividade } from '@/types';
import { getRegiao } from '@/data/municipios';
import { ts, fmtDate, addPdfFooters, styleWorksheet, saveWb } from './shared';

export async function exportDashboardWithChartsToPDF(
  chartsContainer: HTMLElement,
  equipamentos: Equipamento[],
  viaturas: Viatura[],
  solicitacoes: Solicitacao[],
  stats: DashboardStats
) {
  const doc = new jsPDF('landscape');
  let currentY = 20;

  doc.setFontSize(20);
  doc.text('Dashboard - EVM Ceará', 14, currentY);
  currentY += 8;
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, currentY);
  currentY += 12;

  doc.setFontSize(14);
  doc.text('Resumo Geral', 14, currentY);
  currentY += 8;

  const equipamentosComPatrulha = equipamentos.filter(e => e.possui_patrulha).length;
  const municipiosComPatrulhaEquip = new Set(equipamentos.filter(e => e.possui_patrulha).map(e => e.municipio));
  const patrulhasSolicitacoes = solicitacoes.filter(s => s.recebeu_patrulha && !municipiosComPatrulhaEquip.has(s.municipio)).length;
  const totalPatrulhasCasas = equipamentosComPatrulha + patrulhasSolicitacoes;
  const totalViaturasPMCE = viaturas.reduce((sum, v) => sum + v.quantidade, 0);

  doc.setFontSize(10);
  doc.text(`Equipamentos: ${stats.totalEquipamentos}`, 14, currentY);
  doc.text(`Viaturas PMCE: ${totalViaturasPMCE}`, 84, currentY);
  doc.text(`Patrulhas das Casas: ${totalPatrulhasCasas}`, 154, currentY);
  doc.text(`Solicitações: ${stats.totalSolicitacoes}`, 224, currentY);
  currentY += 5;
  doc.text(`  - Com Patrulha: ${equipamentosComPatrulha}`, 14, currentY);
  doc.text(`  - Vinculadas: ${viaturas.filter(v => v.vinculada_equipamento).reduce((sum, v) => sum + v.quantidade, 0)}`, 84, currentY);
  doc.text(`  - De Equipamentos: ${equipamentosComPatrulha}`, 154, currentY);
  doc.text(`  - Inauguradas: ${stats.solicitacoesPorStatus['Inaugurada'] || 0}`, 224, currentY);
  currentY += 5;
  doc.text(`  - Sem Patrulha: ${stats.totalEquipamentos - equipamentosComPatrulha}`, 14, currentY);
  doc.text(`  - Não Vinculadas: ${viaturas.filter(v => !v.vinculada_equipamento).reduce((sum, v) => sum + v.quantidade, 0)}`, 84, currentY);
  doc.text(`  - De Solicitações: ${patrulhasSolicitacoes}`, 154, currentY);
  doc.text(`  - Em Andamento: ${solicitacoes.filter(s => ['Recebida', 'Em análise', 'Aprovada', 'Em implantação'].includes(s.status)).length}`, 224, currentY);
  currentY += 10;

  doc.text(`Municípios com Equipamento: ${stats.municipiosComEquipamento} / 184 (${((stats.municipiosComEquipamento / 184) * 100).toFixed(1)}%)`, 14, currentY);
  currentY += 10;

  try {
    const canvas = await html2canvas(chartsContainer, {
      scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
    });
    const imgData = canvas.toDataURL('image/png');
    doc.addPage();
    currentY = 15;
    doc.setFontSize(14);
    doc.text('Gráficos do Dashboard', 14, currentY);
    currentY += 8;
    const pageWidth  = doc.internal.pageSize.getWidth() - 28;
    const pageHeight = doc.internal.pageSize.getHeight() - 40;
    const ratio       = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
    doc.addImage(imgData, 'PNG', 14, currentY, canvas.width * ratio, canvas.height * ratio);
  } catch (error) {
    console.error('Error capturing charts:', error);
    doc.text('Não foi possível capturar os gráficos.', 14, currentY);
  }

  addPdfFooters(doc);
  doc.save(`dashboard-com-graficos_${ts()}.pdf`);
}

export function exportAllToPDF(
  equipamentos: Equipamento[],
  viaturas: Viatura[],
  solicitacoes: Solicitacao[],
  atividades: Atividade[] = []
) {
  const doc = new jsPDF('landscape');
  let currentY = 22;

  doc.setFontSize(18);
  doc.text('Relatório Completo - EVM', 14, currentY); currentY += 8;
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, currentY); currentY += 12;

  const totalEquipamentos       = equipamentos.length;
  const equipamentosComPatrulha = equipamentos.filter(e => e.possui_patrulha).length;
  const municipiosComPatrulhaEquip = new Set(equipamentos.filter(e => e.possui_patrulha).map(e => e.municipio));
  const patrulhasSolicitacoes   = solicitacoes.filter(s => s.recebeu_patrulha && !municipiosComPatrulhaEquip.has(s.municipio)).length;
  const totalPatrulhasCasas     = equipamentosComPatrulha + patrulhasSolicitacoes;
  const totalViaturasPMCE       = viaturas.reduce((sum, v) => sum + v.quantidade, 0);
  const viaturasVinculadas      = viaturas.filter(v => v.vinculada_equipamento).reduce((sum, v) => sum + v.quantidade, 0);
  const viaturasNaoVinculadas   = viaturas.filter(v => !v.vinculada_equipamento).reduce((sum, v) => sum + v.quantidade, 0);
  const solicitacoesEmAndamento = solicitacoes.filter(s => ['Recebida', 'Em análise', 'Aprovada', 'Em implantação'].includes(s.status)).length;
  const solicitacoesInauguradas = solicitacoes.filter(s => s.status === 'Inaugurada').length;
  const solicitacoesCanceladas  = solicitacoes.filter(s => s.status === 'Cancelada').length;

  doc.setFontSize(14);
  doc.text('RESUMO GERAL - ESTADO DO CEARÁ', 14, currentY); currentY += 10;

  doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text('EQUIPAMENTOS', 14, currentY); doc.setFont(undefined, 'normal'); doc.setFontSize(9);
  doc.text(`• Total: ${totalEquipamentos}`, 14, currentY + 5);
  doc.text(`  - Com Patrulha M.P.: ${equipamentosComPatrulha}`, 14, currentY + 9);
  doc.text(`  - Sem Patrulha M.P.: ${totalEquipamentos - equipamentosComPatrulha}`, 14, currentY + 13);

  doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text('VIATURAS PMCE', 84, currentY); doc.setFont(undefined, 'normal'); doc.setFontSize(9);
  doc.text(`• Total: ${totalViaturasPMCE}`, 84, currentY + 5);
  doc.text(`  - Vinculadas a Equipamentos: ${viaturasVinculadas}`, 84, currentY + 9);
  doc.text(`  - Não Vinculadas: ${viaturasNaoVinculadas}`, 84, currentY + 13);

  doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text('PATRULHAS DAS CASAS', 164, currentY); doc.setFont(undefined, 'normal'); doc.setFontSize(9);
  doc.text(`• Total: ${totalPatrulhasCasas}`, 164, currentY + 5);
  doc.text(`  - De Equipamentos: ${equipamentosComPatrulha}`, 164, currentY + 9);
  doc.text(`  - De Solicitações: ${patrulhasSolicitacoes}`, 164, currentY + 13);

  doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text('SOLICITAÇÕES', 234, currentY); doc.setFont(undefined, 'normal'); doc.setFontSize(9);
  doc.text(`• Total: ${solicitacoes.length}`, 234, currentY + 5);
  doc.text(`  - Em Andamento: ${solicitacoesEmAndamento}`, 234, currentY + 9);
  doc.text(`  - Inauguradas: ${solicitacoesInauguradas}`, 234, currentY + 13);
  doc.text(`  - Canceladas: ${solicitacoesCanceladas}`, 234, currentY + 17);
  currentY += 28;

  doc.setFontSize(12); doc.text('Equipamentos:', 14, currentY);
  autoTable(doc, {
    head: [['Município', 'Região', 'Tipo', 'Endereço', 'Responsável', 'Telefone', 'Patrulha M.P.']],
    body: equipamentos.map(e => [e.municipio, getRegiao(e.municipio) || '-', e.tipo, e.endereco || '-', e.responsavel || '-', e.telefone || '-', e.possui_patrulha ? 'Sim' : 'Não']),
    startY: currentY + 5, styles: { fontSize: 6.5 }, headStyles: { fillColor: [31, 81, 140] },
  });

  doc.addPage(); currentY = 22;
  doc.setFontSize(12); doc.text('Viaturas PMCE:', 14, currentY);
  autoTable(doc, {
    head: [['Município', 'Região', 'Órgão', 'Qtd', 'Data Impl.', 'Vinculada', 'Responsável']],
    body: viaturas.map(v => [v.municipio, getRegiao(v.municipio) || '-', v.orgao_responsavel, v.quantidade.toString(), fmtDate(v.data_implantacao), v.vinculada_equipamento ? 'Sim' : 'Não', v.responsavel || '-']),
    startY: currentY + 5, styles: { fontSize: 7 }, headStyles: { fillColor: [31, 81, 140] },
  });

  doc.addPage(); currentY = 22;
  doc.setFontSize(12);
  doc.text(`Patrulhas das Casas (${totalPatrulhasCasas} registros):`, 14, currentY);
  const patrulhasEquip = equipamentos.filter(e => e.possui_patrulha);
  const patrulhasSolic = solicitacoes.filter(s => s.recebeu_patrulha && !municipiosComPatrulhaEquip.has(s.municipio));
  autoTable(doc, {
    head: [['Município', 'Região', 'Tipo', 'Origem', 'Status', 'Endereço', 'Responsável']],
    body: [
      ...patrulhasEquip.map(e => [e.municipio, getRegiao(e.municipio) || '-', e.tipo, 'Equipamento', '-', e.endereco || '-', e.responsavel || '-']),
      ...patrulhasSolic.map(s => [s.municipio, getRegiao(s.municipio) || '-', s.tipo_equipamento, 'Solicitação', s.status, '-', '-']),
    ],
    startY: currentY + 5, styles: { fontSize: 7 }, headStyles: { fillColor: [16, 185, 129] },
  });

  doc.addPage(); currentY = 22;
  doc.setFontSize(12); doc.text('Solicitações:', 14, currentY);
  autoTable(doc, {
    head: [['Município', 'Região', 'Tipo', 'Status', 'Data', 'NUP', 'Guarda', 'Patrulha', 'Kit Athena', 'Qualificação']],
    body: solicitacoes.map(s => [s.municipio, getRegiao(s.municipio) || '-', s.tipo_equipamento, s.status, fmtDate(s.data_solicitacao), s.nup || '-', s.guarda_municipal_estruturada ? 'Sim' : 'Não', s.recebeu_patrulha ? 'Sim' : 'Não', s.kit_athena_entregue ? 'Sim' : 'Não', s.capacitacao_realizada ? 'Sim' : 'Não']),
    startY: currentY + 5, styles: { fontSize: 6.5 }, headStyles: { fillColor: [31, 81, 140] },
  });

  if (atividades.length > 0) {
    doc.addPage(); currentY = 22;
    const totalAtend = atividades.reduce((s, a) => s + (a.atendimentos ?? 0), 0);
    doc.setFontSize(12);
    doc.text(`Atividades (${atividades.length} registros | ${totalAtend} atendimentos):`, 14, currentY);
    autoTable(doc, {
      head: [['Município', 'Sede', 'Tipo', 'Recurso', 'Data', 'Status', 'Atend.']],
      body: atividades.map(a => [a.municipio, a.municipio_sede, a.tipo, a.recurso, fmtDate(a.data), a.status, a.atendimentos?.toString() || '-']),
      startY: currentY + 5, styles: { fontSize: 6.5 }, headStyles: { fillColor: [124, 58, 237] }, alternateRowStyles: { fillColor: [245, 243, 255] },
    });
  }

  addPdfFooters(doc);
  doc.save(`relatorio-completo_${ts()}.pdf`);
}

export function exportAllToExcel(
  equipamentos: Equipamento[],
  viaturas: Viatura[],
  solicitacoes: Solicitacao[],
  atividades: Atividade[] = []
) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(equipamentos.map(e => ({ 'Município': e.municipio, 'Região': getRegiao(e.municipio) || '', 'Tipo': e.tipo, 'Patrulha M.P.': e.possui_patrulha ? 'Sim' : 'Não', 'Endereço': e.endereco || '', 'Responsável': e.responsavel || '', 'Telefone': e.telefone || '', 'Observações': e.observacoes || '', 'Data Criação': fmtDate(e.created_at) }))), 'Equipamentos');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(viaturas.map(v => ({ 'Município': v.municipio, 'Região': getRegiao(v.municipio) || '', 'Tipo de Patrulha': v.tipo_patrulha, 'Órgão Responsável': v.orgao_responsavel, 'Quantidade': v.quantidade, 'Vinculada a Equipamento': v.vinculada_equipamento ? 'Sim' : 'Não', 'Data de Implantação': fmtDate(v.data_implantacao), 'Responsável': v.responsavel || '', 'Observações': v.observacoes || '' }))), 'Viaturas PMCE');

  const patrulhasEquip = equipamentos.filter(e => e.possui_patrulha);
  const municipiosComPatrulhaEquip = new Set(patrulhasEquip.map(e => e.municipio));
  const patrulhasSolic = solicitacoes.filter(s => s.recebeu_patrulha && !municipiosComPatrulhaEquip.has(s.municipio));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    ...patrulhasEquip.map(e => ({ 'Município': e.municipio, 'Região': getRegiao(e.municipio) || '', 'Tipo de Equipamento': e.tipo, 'Origem': 'Equipamento', 'Status': '-', 'Endereço': e.endereco || '', 'Responsável': e.responsavel || '', 'Telefone': e.telefone || '', 'Kit Athena': e.kit_athena_entregue ? 'Sim' : 'Não', 'Qualificação': e.capacitacao_realizada ? 'Sim' : 'Não', 'NUP': e.nup || '', 'Observações': e.observacoes || '', 'Data Criação': fmtDate(e.created_at) })),
    ...patrulhasSolic.map(s => ({ 'Município': s.municipio, 'Região': getRegiao(s.municipio) || '', 'Tipo de Equipamento': s.tipo_equipamento, 'Origem': 'Solicitação', 'Status': s.status, 'Endereço': '', 'Responsável': '', 'Telefone': '', 'Observações': s.observacoes || '', 'Data Criação': fmtDate(s.created_at) })),
  ]), 'Patrulhas Casas');

  const toEquipRow = (e: (typeof equipamentos)[0]) => ({ 'Município': e.municipio, 'Região': getRegiao(e.municipio) || '', 'Tipo': e.tipo, 'Endereço': e.endereco || '', 'Responsável': e.responsavel || '', 'Telefone': e.telefone || '', 'Kit Athena': e.kit_athena_entregue ? 'Sim' : 'Não', 'Qualificação': e.capacitacao_realizada ? 'Sim' : 'Não', 'NUP': e.nup || '', 'Observações': e.observacoes || '' });
  const lilasMunicipal = equipamentos.filter(e => e.tipo === 'Sala Lilás Municipal');
  const lilasEstado    = equipamentos.filter(e => e.tipo === 'Sala Lilás Governo do Estado');
  const lilasDelegacia = equipamentos.filter(e => e.tipo === 'Sala Lilás em Delegacia');
  if (lilasMunicipal.length)  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lilasMunicipal.map(toEquipRow)),  'Salas Lilás Municipal');
  if (lilasEstado.length)     XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lilasEstado.map(toEquipRow)),    'Salas Lilás Estado');
  if (lilasDelegacia.length)  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lilasDelegacia.map(toEquipRow)), 'Salas Lilás Delegacia');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(solicitacoes.map(s => ({ 'Município': s.municipio, 'Região': getRegiao(s.municipio) || '', 'Tipo de Equipamento': s.tipo_equipamento, 'Status': s.status, 'Data da Solicitação': fmtDate(s.data_solicitacao), 'NUP': s.nup || '', 'Guarda Municipal Estruturada': s.guarda_municipal_estruturada ? 'Sim' : 'Não', 'Recebeu Patrulha': s.recebeu_patrulha ? 'Sim' : 'Não', 'Kit Athena Entregue': s.kit_athena_entregue ? 'Sim' : 'Não', 'Qualificação Realizada': s.capacitacao_realizada ? 'Sim' : 'Não', 'Observações': s.observacoes || '' }))), 'Solicitações');

  if (atividades.length > 0) {
    const wsAtiv = XLSX.utils.json_to_sheet(atividades.map(a => ({ 'Município': a.municipio, 'Sede (CMB/CMC)': a.municipio_sede, 'Região': getRegiao(a.municipio) || '', 'Tipo': a.tipo, 'Recurso': a.recurso, 'Status': a.status, 'Data': fmtDate(a.data), 'Duração (dias)': a.dias ?? '', 'Atendimentos': a.atendimentos ?? '', 'NUP': a.nup || '', 'Nome do Evento': a.nome_evento || '' })));
    styleWorksheet(wsAtiv, '7C3AED');
    XLSX.utils.book_append_sheet(wb, wsAtiv, 'Atividades');
  }

  saveWb(wb, `relatorio-completo_${ts()}.xlsx`);
}