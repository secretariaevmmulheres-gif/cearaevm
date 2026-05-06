import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { Equipamento, Viatura, Solicitacao, DashboardStats, Atividade, Patrulha } from '@/types';
import { getRegiao } from '@/data/municipios';
import { ts, fmtDate, addPdfCover, addPdfHeader, addPdfFooters, styleWorksheet, saveWb } from './shared';

export async function exportDashboardWithChartsToPDF(
  chartsContainer: HTMLElement,
  equipamentos: Equipamento[],
  viaturas: Viatura[],
  solicitacoes: Solicitacao[],
  stats: DashboardStats,
  patrulhas: Patrulha[] = []
) {
  const doc = new jsPDF('landscape');

  // ── Capa ──────────────────────────────────────────────────────────────────
  const totalViaturasPMCE = viaturas.reduce((sum, v) => sum + v.quantidade, 0);
  const patrulhasAtivas   = patrulhas.filter(p => p.equipamento_id !== null).length;
  const patrulhasProcesso = patrulhas.filter(p => p.solicitacao_id !== null).length;
  const totalPatrulhas    = patrulhas.length;

  await addPdfCover(doc, {
    titulo:    'DASHBOARD EVM CEARÁ',
    subtitulo: 'Visão Geral da Rede de Proteção à Mulher',
    colorKey:  'dashboard',
    landscape: true,
    stats: [
      { label: 'Equipamentos',        valor: stats.totalEquipamentos },
      { label: 'Viaturas PMCE',       valor: totalViaturasPMCE },
      { label: 'Patrulhas das Casas', valor: totalPatrulhas },
      { label: 'Solicitações',        valor: stats.totalSolicitacoes },
    ],
  });

  doc.addPage();
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

  doc.setFontSize(10);
  doc.text(`Equipamentos: ${stats.totalEquipamentos}`, 14, currentY);
  doc.text(`Viaturas PMCE: ${totalViaturasPMCE}`, 84, currentY);
  doc.text(`Patrulhas das Casas: ${totalPatrulhas}`, 154, currentY);
  doc.text(`Solicitações: ${stats.totalSolicitacoes}`, 224, currentY);
  currentY += 5;
  doc.text(`  - Com Patrulha: ${patrulhasAtivas}`, 14, currentY);
  doc.text(`  - Vinculadas: ${viaturas.filter(v => v.vinculada_equipamento).reduce((sum, v) => sum + v.quantidade, 0)}`, 84, currentY);
  doc.text(`  - CMM Inaugurada: ${patrulhasAtivas}`, 154, currentY);
  doc.text(`  - Inauguradas: ${stats.solicitacoesPorStatus['Inaugurada'] || 0}`, 224, currentY);
  currentY += 5;
  doc.text(`  - Sem Patrulha: ${stats.totalEquipamentos - patrulhasAtivas}`, 14, currentY);
  doc.text(`  - Não Vinculadas: ${viaturas.filter(v => !v.vinculada_equipamento).reduce((sum, v) => sum + v.quantidade, 0)}`, 84, currentY);
  doc.text(`  - Em Processo: ${patrulhasProcesso}`, 154, currentY);
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

export async function exportAllToPDF(
  equipamentos: Equipamento[],
  viaturas: Viatura[],
  solicitacoes: Solicitacao[],
  atividades: Atividade[] = [],
  patrulhas: Patrulha[] = []
) {
  const doc = new jsPDF('landscape');

  // ── Pré-cálculos ──────────────────────────────────────────────────────────
  const totalEquipamentos     = equipamentos.length;
  const patrulhasAtivas       = patrulhas.filter(p => p.equipamento_id !== null).length;
  const patrulhasProcesso     = patrulhas.filter(p => p.solicitacao_id !== null).length;
  const totalPatrulhasCasas   = patrulhas.length;
  const totalViaturasPMCE     = viaturas.reduce((sum, v) => sum + v.quantidade, 0);
  const viaturasVinculadas    = viaturas.filter(v => v.vinculada_equipamento).reduce((sum, v) => sum + v.quantidade, 0);
  const viaturasNaoVinculadas = viaturas.filter(v => !v.vinculada_equipamento).reduce((sum, v) => sum + v.quantidade, 0);
  const solicitacoesEmAndamento = solicitacoes.filter(s => ['Recebida', 'Em análise', 'Aprovada', 'Em implantação'].includes(s.status)).length;
  const solicitacoesInauguradas = solicitacoes.filter(s => s.status === 'Inaugurada').length;
  const solicitacoesCanceladas  = solicitacoes.filter(s => s.status === 'Cancelada').length;

  // Sets para lookup O(1)
  const equipIdsComPatrulha = new Set(patrulhas.filter(p => p.equipamento_id).map(p => p.equipamento_id!));
  const solicIdsComPatrulha = new Set(patrulhas.filter(p => p.solicitacao_id).map(p => p.solicitacao_id!));

  await addPdfCover(doc, {
    titulo:    'RELATÓRIO COMPLETO EVM',
    subtitulo: 'Rede de Enfrentamento à Violência contra as Mulheres — Ceará',
    colorKey:  'dashboard',
    landscape: true,
    stats: [
      { label: 'Equipamentos',        valor: totalEquipamentos },
      { label: 'Viaturas PMCE',       valor: totalViaturasPMCE },
      { label: 'Patrulhas das Casas', valor: totalPatrulhasCasas },
      { label: 'Solicitações',        valor: solicitacoes.length },
    ],
  });

  doc.addPage();
  addPdfHeader(doc, 'Relatório Completo', 'Relatório Completo EVM — Estado do Ceará');
  let currentY = 36;

  doc.setFontSize(14);
  doc.text('RESUMO GERAL - ESTADO DO CEARÁ', 14, currentY); currentY += 10;

  doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text('EQUIPAMENTOS', 14, currentY); doc.setFont(undefined, 'normal'); doc.setFontSize(9);
  doc.text(`• Total: ${totalEquipamentos}`, 14, currentY + 5);
  doc.text(`  - Com Patrulha M.P.: ${patrulhasAtivas}`, 14, currentY + 9);
  doc.text(`  - Sem Patrulha M.P.: ${totalEquipamentos - patrulhasAtivas}`, 14, currentY + 13);

  doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text('VIATURAS PMCE', 84, currentY); doc.setFont(undefined, 'normal'); doc.setFontSize(9);
  doc.text(`• Total: ${totalViaturasPMCE}`, 84, currentY + 5);
  doc.text(`  - Vinculadas a Equipamentos: ${viaturasVinculadas}`, 84, currentY + 9);
  doc.text(`  - Não Vinculadas: ${viaturasNaoVinculadas}`, 84, currentY + 13);

  doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text('PATRULHAS DAS CASAS', 164, currentY); doc.setFont(undefined, 'normal'); doc.setFontSize(9);
  doc.text(`• Total: ${totalPatrulhasCasas}`, 164, currentY + 5);
  doc.text(`  - CMM Inaugurada: ${patrulhasAtivas}`, 164, currentY + 9);
  doc.text(`  - Em Processo: ${patrulhasProcesso}`, 164, currentY + 13);

  doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text('SOLICITAÇÕES', 234, currentY); doc.setFont(undefined, 'normal'); doc.setFontSize(9);
  doc.text(`• Total: ${solicitacoes.length}`, 234, currentY + 5);
  doc.text(`  - Em Andamento: ${solicitacoesEmAndamento}`, 234, currentY + 9);
  doc.text(`  - Inauguradas: ${solicitacoesInauguradas}`, 234, currentY + 13);
  doc.text(`  - Canceladas: ${solicitacoesCanceladas}`, 234, currentY + 17);
  currentY += 28;

  doc.setFontSize(12); doc.text('Equipamentos:', 14, currentY);
  autoTable(doc, {
    head: [['Município', 'Região', 'Tipo', 'Endereço', 'Responsável', 'Telefone', 'Patrulha M.P.']],
    body: equipamentos.map(e => [e.municipio, getRegiao(e.municipio) || '-', e.tipo, e.endereco || '-', e.responsavel || '-', e.telefone || '-', equipIdsComPatrulha.has(e.id) ? 'Sim' : 'Não']),
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
  autoTable(doc, {
    head: [['Município', 'Região', 'Órgão', 'Efetivo', 'Responsável', 'Situação']],
    body: patrulhas.map(p => {
      const equip = equipamentos.find(e => e.id === p.equipamento_id);
      const solic = solicitacoes.find(s => s.id === p.solicitacao_id);
      const situacao = equip ? 'CMM Inaugurada' : solic ? `Em processo (${solic.status})` : '—';
      return [p.municipio, getRegiao(p.municipio) || '-', p.orgao, p.efetivo?.toString() || '-', p.responsavel || '-', situacao];
    }),
    startY: currentY + 5, styles: { fontSize: 7 }, headStyles: { fillColor: [16, 185, 129] },
  });

  doc.addPage(); currentY = 22;
  doc.setFontSize(12); doc.text('Solicitações:', 14, currentY);
  autoTable(doc, {
    head: [['Município', 'Região', 'Tipo', 'Status', 'Data', 'NUP', 'Guarda', 'Patrulha', 'Kit Athena', 'Qualificação']],
    body: solicitacoes.map(s => [s.municipio, getRegiao(s.municipio) || '-', s.tipo_equipamento, s.status, fmtDate(s.data_solicitacao), s.nup || '-', s.guarda_municipal_estruturada ? 'Sim' : 'Não', solicIdsComPatrulha.has(s.id) ? 'Sim' : 'Não', s.kit_athena_entregue ? 'Sim' : 'Não', s.capacitacao_realizada ? 'Sim' : 'Não']),
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
  atividades: Atividade[] = [],
  patrulhas: Patrulha[] = []
) {
  const equipIdsComPatrulha = new Set(patrulhas.filter(p => p.equipamento_id).map(p => p.equipamento_id!));
  const solicIdsComPatrulha = new Set(patrulhas.filter(p => p.solicitacao_id).map(p => p.solicitacao_id!));

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(equipamentos.map(e => ({
    'Município':    e.municipio,
    'Região':       getRegiao(e.municipio) || '',
    'Tipo':         e.tipo,
    'Patrulha M.P.': equipIdsComPatrulha.has(e.id) ? 'Sim' : 'Não',
    'Endereço':     e.endereco || '',
    'Responsável':  e.responsavel || '',
    'Telefone':     e.telefone || '',
    'Observações':  e.observacoes || '',
    'Data Criação': fmtDate(e.created_at),
  }))), 'Equipamentos');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(viaturas.map(v => ({
    'Município':               v.municipio,
    'Região':                  getRegiao(v.municipio) || '',
    'Tipo de Patrulha':        v.tipo_patrulha,
    'Órgão Responsável':       v.orgao_responsavel,
    'Quantidade':              v.quantidade,
    'Vinculada a Equipamento': v.vinculada_equipamento ? 'Sim' : 'Não',
    'Data de Implantação':     fmtDate(v.data_implantacao),
    'Responsável':             v.responsavel || '',
    'Observações':             v.observacoes || '',
  }))), 'Viaturas PMCE');

  // Aba Patrulhas M.P. com dados reais da tabela patrulhas
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(patrulhas.map(p => {
    const equip = equipamentos.find(e => e.id === p.equipamento_id);
    const solic = solicitacoes.find(s => s.id === p.solicitacao_id);
    return {
      'Município':       p.municipio,
      'Região':          getRegiao(p.municipio) || '',
      'Órgão':           p.orgao,
      'Efetivo':         p.efetivo ?? '',
      'Viaturas Próprias': p.viaturas ?? '',
      'Responsável':     p.responsavel || '',
      'Contato':         p.contato || '',
      'Data Implantação': fmtDate(p.data_implantacao),
      'Situação':        equip ? 'CMM Inaugurada' : solic ? `Em processo (${solic.status})` : '—',
      'Observações':     p.observacoes || '',
    };
  })), 'Patrulhas M.P.');

  const toEquipRow = (e: (typeof equipamentos)[0]) => ({
    'Município':   e.municipio,
    'Região':      getRegiao(e.municipio) || '',
    'Tipo':        e.tipo,
    'Endereço':    e.endereco || '',
    'Responsável': e.responsavel || '',
    'Telefone':    e.telefone || '',
    'Kit Athena':  e.kit_athena_entregue ? 'Sim' : 'Não',
    'Qualificação': e.capacitacao_realizada ? 'Sim' : 'Não',
    'NUP':         e.nup || '',
    'Observações': e.observacoes || '',
  });
  const lilasMunicipal = equipamentos.filter(e => e.tipo === 'Sala Lilás Municipal');
  const lilasEstado    = equipamentos.filter(e => e.tipo === 'Sala Lilás Governo do Estado');
  const lilasDelegacia = equipamentos.filter(e => e.tipo === 'Sala Lilás em Delegacia');
  if (lilasMunicipal.length)  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lilasMunicipal.map(toEquipRow)),  'Salas Lilás Municipal');
  if (lilasEstado.length)     XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lilasEstado.map(toEquipRow)),    'Salas Lilás Estado');
  if (lilasDelegacia.length)  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lilasDelegacia.map(toEquipRow)), 'Salas Lilás Delegacia');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(solicitacoes.map(s => ({
    'Município':                    s.municipio,
    'Região':                       getRegiao(s.municipio) || '',
    'Tipo de Equipamento':          s.tipo_equipamento,
    'Status':                       s.status,
    'Data da Solicitação':          fmtDate(s.data_solicitacao),
    'NUP':                          s.nup || '',
    'Guarda Municipal Estruturada': s.guarda_municipal_estruturada ? 'Sim' : 'Não',
    'Patrulha M.P.':                solicIdsComPatrulha.has(s.id) ? 'Sim' : 'Não',
    'Kit Athena Entregue':          s.kit_athena_entregue ? 'Sim' : 'Não',
    'Qualificação Realizada':       s.capacitacao_realizada ? 'Sim' : 'Não',
    'Observações':                  s.observacoes || '',
  }))), 'Solicitações');

  if (atividades.length > 0) {
    const wsAtiv = XLSX.utils.json_to_sheet(atividades.map(a => ({
      'Município':       a.municipio,
      'Sede (CMB/CMC)':  a.municipio_sede,
      'Região':          getRegiao(a.municipio) || '',
      'Tipo':            a.tipo,
      'Recurso':         a.recurso,
      'Status':          a.status,
      'Data':            fmtDate(a.data),
      'Duração (dias)':  a.dias ?? '',
      'Atendimentos':    a.atendimentos ?? '',
      'NUP':             a.nup || '',
      'Nome do Evento':  a.nome_evento || '',
    })));
    styleWorksheet(wsAtiv, '7C3AED');
    XLSX.utils.book_append_sheet(wb, wsAtiv, 'Atividades');
  }

  saveWb(wb, `relatorio-completo_${ts()}.xlsx`);
}