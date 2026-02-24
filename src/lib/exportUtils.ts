import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { Equipamento, Viatura, Solicitacao, DashboardStats, Atividade } from '@/types';
import { regioesList, getRegiao, getMunicipiosPorRegiao, RegiaoPlanejamento } from '@/data/municipios';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS COMPARTILHADOS
// ─────────────────────────────────────────────────────────────────────────────

/** Timestamp para nome de arquivo: "2025-06-15_14-32" */
function ts(): string {
  const now = new Date();
  const d = now.toLocaleDateString('pt-BR').split('/').reverse().join('-');
  const t = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', '-');
  return `${d}_${t}`;
}

/** Cabeçalho padrão EVM em todas as páginas de um PDF */
function addPdfHeader(doc: jsPDF, title: string, subtitle?: string): number {
  const PW = doc.internal.pageSize.getWidth();

  // Faixa azul no topo
  doc.setFillColor(31, 81, 140);
  doc.rect(0, 0, PW, 16, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.text('EVM — Enfrentamento à Violência contra as Mulheres', 14, 10);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(title, PW - 14, 10, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  let y = 22;
  if (subtitle) {
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(subtitle, 14, y);
    doc.setFont(undefined, 'normal');
    y += 7;
  }

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, y);
  doc.setTextColor(0, 0, 0);
  return y + 6;
}

/** Rodapé com número de página em todas as páginas */
function addPdfFooters(doc: jsPDF): void {
  const totalPages = (doc as any).internal.getNumberOfPages();
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.setDrawColor(200, 200, 200);
    doc.line(14, PH - 8, PW - 14, PH - 8);
    doc.text('EVM Ceará — Secretaria das Mulheres', 14, PH - 4);
    doc.text(`Página ${i} de ${totalPages}`, PW - 14, PH - 4, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
  }
}

/** Estiliza worksheet: header colorido/negrito + auto-largura + zebra */
function styleWorksheet(ws: XLSX.WorkSheet, headerColor = '1F518C'): void {
  if (!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);

  // Auto-largura de colunas
  const colWidths: number[] = [];
  for (let C = range.s.c; C <= range.e.c; C++) {
    let maxLen = 10;
    for (let R = range.s.r; R <= range.e.r; R++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell?.v != null) {
        const len = String(cell.v).length;
        if (len > maxLen) maxLen = len;
      }
    }
    colWidths.push(Math.min(maxLen + 2, 50));
  }
  ws['!cols'] = colWidths.map(w => ({ wch: w }));

  // Cabeçalho em negrito com cor de fundo
  for (let C = range.s.c; C <= range.e.c; C++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[addr]) continue;
    ws[addr].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: headerColor }, patternType: 'solid' },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
        right:  { style: 'thin', color: { rgb: 'CCCCCC' } },
      },
    };
  }

  // Zebra nas linhas de dados
  for (let R = 1; R <= range.e.r; R++) {
    const bg = R % 2 === 0 ? 'EEF2FA' : 'FFFFFF';
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      ws[addr].s = {
        fill: { fgColor: { rgb: bg }, patternType: 'solid' },
        alignment: { vertical: 'center' },
        border: {
          bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
          right:  { style: 'thin', color: { rgb: 'E5E7EB' } },
        },
      };
    }
  }
}

/** Salva workbook com suporte a estilos */
function saveWb(wb: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(wb, filename, { bookType: 'xlsx', type: 'binary', cellStyles: true } as any);
}

// ─────────────────────────────────────────────────────────────────────────────
// Export Dashboard with charts as images
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
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    doc.addPage();
    currentY = 15;

    doc.setFontSize(14);
    doc.text('Gráficos do Dashboard', 14, currentY);
    currentY += 8;

    const pageWidth = doc.internal.pageSize.getWidth() - 28;
    const pageHeight = doc.internal.pageSize.getHeight() - 40;
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
    const finalWidth = imgWidth * ratio;
    const finalHeight = imgHeight * ratio;

    doc.addImage(imgData, 'PNG', 14, currentY, finalWidth, finalHeight);
  } catch (error) {
    console.error('Error capturing charts:', error);
    doc.text('Não foi possível capturar os gráficos.', 14, currentY);
  }

  addPdfFooters(doc);
  doc.save(`dashboard-com-graficos_${ts()}.pdf`);
}

// Regional Dashboard export types
export interface RegionStatsExport {
  regiao: RegiaoPlanejamento;
  totalMunicipios: number;
  municipiosComEquipamento: number;
  totalEquipamentos: number;
  totalViaturas: number;
  viaturasVinculadas: number;
  viaturasNaoVinculadas: number;
  patrulhasEmEquipamentos: number;
  patrulhasDeSolicitacoes?: number;
  totalPatrulhasCasas?: number;
  totalSolicitacoes: number;
  solicitacoesEmAndamento: number;
  cobertura: number;
  equipamentosPorTipo?: {
    brasileira: number;
    cearense: number;
    municipal: number;
    lilas: number;
  };
}

export function exportRegionalToPDF(regionStats: RegionStatsExport, equipamentos: Equipamento[], viaturas: Viatura[], solicitacoes: Solicitacao[]) {
  const doc = new jsPDF();
  let currentY = addPdfHeader(doc, 'Dashboard Regional', `Região: ${regionStats.regiao}`);

  doc.setFontSize(12);
  doc.text('Resumo da Região:', 14, currentY);
  currentY += 8;
  doc.setFontSize(10);
  doc.text(`• Total de Municípios: ${regionStats.totalMunicipios}`, 14, currentY); currentY += 6;
  doc.text(`• Municípios com Equipamento: ${regionStats.municipiosComEquipamento}`, 14, currentY); currentY += 6;
  doc.text(`• Cobertura: ${regionStats.cobertura.toFixed(2)}%`, 14, currentY); currentY += 8;
  doc.text(`• Total de Equipamentos: ${regionStats.totalEquipamentos}`, 14, currentY); currentY += 6;
  doc.text(`• Total de Patrulhas M.P.: ${regionStats.totalViaturas}`, 14, currentY); currentY += 6;
  doc.text(`  - Em equipamentos: ${regionStats.patrulhasEmEquipamentos}`, 14, currentY); currentY += 6;
  doc.text(`  - PMCE: ${regionStats.viaturasNaoVinculadas}`, 14, currentY); currentY += 6;
  doc.text(`• Total de Solicitações: ${regionStats.totalSolicitacoes}`, 14, currentY); currentY += 6;
  doc.text(`• Solicitações em Andamento: ${regionStats.solicitacoesEmAndamento}`, 14, currentY); currentY += 12;

  const regionEquipamentos = equipamentos.filter(e => getRegiao(e.municipio) === regionStats.regiao);
  if (regionEquipamentos.length > 0) {
    doc.setFontSize(12);
    doc.text('Equipamentos:', 14, currentY);
    autoTable(doc, {
      head: [['Município', 'Tipo', 'Responsável', 'Telefone', 'Patrulha']],
      body: regionEquipamentos.map(e => [e.municipio, e.tipo, e.responsavel || '-', e.telefone || '-', e.possui_patrulha ? 'Sim' : 'Não']),
      startY: currentY + 5,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [31, 81, 140] },
    });
    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  const regionViaturas = viaturas.filter(v => getRegiao(v.municipio) === regionStats.regiao);
  if (regionViaturas.length > 0) {
    if (currentY > 200) { doc.addPage(); currentY = 22; }
    doc.setFontSize(12);
    doc.text('Viaturas:', 14, currentY);
    autoTable(doc, {
      head: [['Município', 'Tipo', 'Órgão', 'Qtd', 'Vinculada']],
      body: regionViaturas.map(v => [v.municipio, v.tipo_patrulha, v.orgao_responsavel, v.quantidade.toString(), v.vinculada_equipamento ? 'Sim' : 'Não']),
      startY: currentY + 5,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [31, 81, 140] },
    });
    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  const regionSolicitacoes = solicitacoes.filter(s => getRegiao(s.municipio) === regionStats.regiao);
  if (regionSolicitacoes.length > 0) {
    if (currentY > 200) { doc.addPage(); currentY = 22; }
    doc.setFontSize(12);
    doc.text('Solicitações:', 14, currentY);
    autoTable(doc, {
      head: [['Município', 'Tipo', 'Status', 'Data']],
      body: regionSolicitacoes.map(s => [s.municipio, s.tipo_equipamento, s.status, new Date(s.data_solicitacao).toLocaleDateString('pt-BR')]),
      startY: currentY + 5,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [31, 81, 140] },
    });
  }

  addPdfFooters(doc);
  doc.save(`relatorio-regional-${regionStats.regiao.toLowerCase().replace(/\s+/g, '-')}_${ts()}.pdf`);
}

export function exportAllRegionsToPDF(regionStats: RegionStatsExport[], equipamentos: Equipamento[], viaturas: Viatura[], solicitacoes: Solicitacao[]) {
  const doc = new jsPDF();
  let currentY = addPdfHeader(doc, 'Dashboard Regional', 'Relatório Consolidado — 14 Regiões de Planejamento');
  currentY += 4;

  const totalEquipamentos = equipamentos.length;
  const equipamentosComPatrulha = equipamentos.filter(e => e.possui_patrulha).length;
  const municipiosComPatrulhaEquip = new Set(equipamentos.filter(e => e.possui_patrulha).map(e => e.municipio));
  const patrulhasSolicitacoes = solicitacoes.filter(s => s.recebeu_patrulha && !municipiosComPatrulhaEquip.has(s.municipio)).length;
  const totalPatrulhasCasas = equipamentosComPatrulha + patrulhasSolicitacoes;
  const totalViaturasPMCE = viaturas.reduce((sum, v) => sum + v.quantidade, 0);
  const viaturasVinculadas = viaturas.filter(v => v.vinculada_equipamento).reduce((sum, v) => sum + v.quantidade, 0);
  const viaturasNaoVinculadas = viaturas.filter(v => !v.vinculada_equipamento).reduce((sum, v) => sum + v.quantidade, 0);
  const totalSolicitacoes = solicitacoes.length;
  const solicitacoesEmAndamento = solicitacoes.filter(s => ['Recebida', 'Em análise', 'Aprovada', 'Em implantação'].includes(s.status)).length;
  const solicitacoesInauguradas = solicitacoes.filter(s => s.status === 'Inaugurada').length;
  const solicitacoesCanceladas = solicitacoes.filter(s => s.status === 'Cancelada').length;
  const mediaCobertura = regionStats.reduce((sum, r) => sum + r.cobertura, 0) / regionStats.length;

  doc.setFontSize(14);
  doc.text('RESUMO GERAL - ESTADO DO CEARÁ', 14, currentY); currentY += 12;

  doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text('EQUIPAMENTOS', 14, currentY); doc.setFont(undefined, 'normal'); currentY += 6;
  doc.setFontSize(10);
  doc.text(`• Total de Equipamentos: ${totalEquipamentos}`, 14, currentY); currentY += 5;
  doc.text(`  - Com Patrulha M.P.: ${equipamentosComPatrulha}`, 14, currentY); currentY += 5;
  doc.text(`  - Sem Patrulha M.P.: ${totalEquipamentos - equipamentosComPatrulha}`, 14, currentY); currentY += 8;

  doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text('VIATURAS PMCE', 14, currentY); doc.setFont(undefined, 'normal'); currentY += 6;
  doc.setFontSize(10);
  doc.text(`• Total de Viaturas PMCE: ${totalViaturasPMCE}`, 14, currentY); currentY += 5;
  doc.text(`  - Vinculadas a Equipamentos: ${viaturasVinculadas}`, 14, currentY); currentY += 5;
  doc.text(`  - Não Vinculadas: ${viaturasNaoVinculadas}`, 14, currentY); currentY += 8;

  doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text('PATRULHAS DAS CASAS', 14, currentY); doc.setFont(undefined, 'normal'); currentY += 6;
  doc.setFontSize(10);
  doc.text(`• Total de Patrulhas das Casas: ${totalPatrulhasCasas}`, 14, currentY); currentY += 5;
  doc.text(`  - De Equipamentos: ${equipamentosComPatrulha}`, 14, currentY); currentY += 5;
  doc.text(`  - De Solicitações: ${patrulhasSolicitacoes}`, 14, currentY); currentY += 8;

  doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text('SOLICITAÇÕES', 14, currentY); doc.setFont(undefined, 'normal'); currentY += 6;
  doc.setFontSize(10);
  doc.text(`• Total de Solicitações: ${totalSolicitacoes}`, 14, currentY); currentY += 5;
  doc.text(`  - Em Andamento: ${solicitacoesEmAndamento}`, 14, currentY); currentY += 5;
  doc.text(`  - Inauguradas: ${solicitacoesInauguradas}`, 14, currentY); currentY += 5;
  doc.text(`  - Canceladas: ${solicitacoesCanceladas}`, 14, currentY); currentY += 10;

  doc.text(`• Média de Cobertura: ${mediaCobertura.toFixed(2)}%`, 14, currentY); currentY += 12;

  doc.setFontSize(12);
  doc.text('Ranking das Regiões por Cobertura:', 14, currentY);

  autoTable(doc, {
    head: [['#', 'Região', 'Municípios', 'Equip.', 'Viaturas', 'Solic.', 'Cobertura']],
    body: regionStats.map((r, idx) => [(idx + 1).toString(), r.regiao, r.totalMunicipios.toString(), r.totalEquipamentos.toString(), r.totalViaturas.toString(), r.totalSolicitacoes.toString(), `${r.cobertura.toFixed(2)}%`]),
    startY: currentY + 5,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [31, 81, 140] },
  });

  regionStats.forEach((region, index) => {
    doc.addPage();
    currentY = addPdfHeader(doc, 'Dashboard Regional', `${index + 1}. ${region.regiao}`);
    doc.setFontSize(10);
    doc.text(`Municípios: ${region.totalMunicipios} | Com Equipamento: ${region.municipiosComEquipamento} | Cobertura: ${region.cobertura.toFixed(2)}%`, 14, currentY); currentY += 6;
    doc.text(`Equipamentos: ${region.totalEquipamentos} | Patrulhas M.P.: ${region.totalViaturas} | Solicitações: ${region.totalSolicitacoes}`, 14, currentY); currentY += 10;

    const regionEquipamentos = equipamentos.filter(e => getRegiao(e.municipio) === region.regiao);
    if (regionEquipamentos.length > 0) {
      doc.setFontSize(11);
      doc.text('Equipamentos:', 14, currentY);
      autoTable(doc, {
        head: [['Município', 'Tipo', 'Responsável', 'Patrulha']],
        body: regionEquipamentos.map(e => [e.municipio, e.tipo, e.responsavel || '-', e.possui_patrulha ? 'Sim' : 'Não']),
        startY: currentY + 4,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [31, 81, 140] },
      });
      currentY = (doc as any).lastAutoTable.finalY + 8;
    } else {
      doc.setFontSize(10);
      doc.text('Nenhum equipamento cadastrado nesta região.', 14, currentY); currentY += 8;
    }

    const regionViaturas = viaturas.filter(v => getRegiao(v.municipio) === region.regiao);
    if (regionViaturas.length > 0) {
      if (currentY > 220) { doc.addPage(); currentY = 22; }
      doc.setFontSize(11);
      doc.text('Viaturas:', 14, currentY);
      autoTable(doc, {
        head: [['Município', 'Tipo', 'Órgão', 'Qtd']],
        body: regionViaturas.map(v => [v.municipio, v.tipo_patrulha, v.orgao_responsavel, v.quantidade.toString()]),
        startY: currentY + 4,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [31, 81, 140] },
      });
      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    const regionSolicitacoes = solicitacoes.filter(s => getRegiao(s.municipio) === region.regiao);
    if (regionSolicitacoes.length > 0) {
      if (currentY > 220) { doc.addPage(); currentY = 22; }
      doc.setFontSize(11);
      doc.text('Solicitações:', 14, currentY);
      autoTable(doc, {
        head: [['Município', 'Tipo', 'Status', 'Data']],
        body: regionSolicitacoes.map(s => [s.municipio, s.tipo_equipamento, s.status, new Date(s.data_solicitacao).toLocaleDateString('pt-BR')]),
        startY: currentY + 4,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [31, 81, 140] },
      });
    }
  });

  addPdfFooters(doc);
  doc.save(`dashboard-regional-consolidado_${ts()}.pdf`);
}

export function exportAllRegionsToExcel(regionStats: RegionStatsExport[], equipamentos: Equipamento[], viaturas: Viatura[], solicitacoes: Solicitacao[]) {
  const wb = XLSX.utils.book_new();

  // Aba 1 - Resumo por região
  const summaryData = regionStats.map((r, idx) => ({
    'Posição': idx + 1,
    'Região': r.regiao,
    'Total Municípios': r.totalMunicipios,
    'Municípios c/ Equipamento': r.municipiosComEquipamento,
    'Cobertura (%)': Number(r.cobertura.toFixed(2)),
    'Equipamentos': r.totalEquipamentos,
    'Patrulhas M.P.': r.totalViaturas,
    'Patrulhas em Casas': r.patrulhasEmEquipamentos,
    'Viaturas PMCE': r.viaturasNaoVinculadas,
    'Solicitações': r.totalSolicitacoes,
    'Em Andamento': r.solicitacoesEmAndamento,
  }));
  const summaryWs = XLSX.utils.json_to_sheet(summaryData);
  styleWorksheet(summaryWs, '1F518C');
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumo Regiões');

  // Aba 2 - Equipamentos completos (todas as regiões)
  const allEqData = equipamentos.map(e => ({
    'Município': e.municipio,
    'Região': getRegiao(e.municipio) || '',
    'Tipo': e.tipo,
    'Patrulha M.P.': e.possui_patrulha ? 'Sim' : 'Não',
    'Endereço': e.endereco || '',
    'Responsável': e.responsavel || '',
    'Telefone': e.telefone || '',
    'Observações': e.observacoes || '',
  }));
  const allEqWs = XLSX.utils.json_to_sheet(allEqData);
  styleWorksheet(allEqWs, '0D9488');
  XLSX.utils.book_append_sheet(wb, allEqWs, 'Equipamentos');

  // Aba 3 - Viaturas completas (todas as regiões)
  const allVData = viaturas.map(v => ({
    'Município': v.municipio,
    'Região': getRegiao(v.municipio) || '',
    'Órgão Responsável': v.orgao_responsavel,
    'Quantidade': v.quantidade,
    'Data de Implantação': new Date(v.data_implantacao).toLocaleDateString('pt-BR'),
    'Vinculada a Equipamento': v.vinculada_equipamento ? 'Sim' : 'Não',
    'Responsável': v.responsavel || '',
    'Observações': v.observacoes || '',
  }));
  const allVWs = XLSX.utils.json_to_sheet(allVData);
  styleWorksheet(allVWs, '7C3AED');
  XLSX.utils.book_append_sheet(wb, allVWs, 'Viaturas PMCE');

  // Aba 4 - Solicitações completas (todas as regiões)
  const allSData = solicitacoes.map(s => ({
    'Município': s.municipio,
    'Região': getRegiao(s.municipio) || '',
    'Tipo de Equipamento': s.tipo_equipamento,
    'Status': s.status,
    'Data da Solicitação': new Date(s.data_solicitacao).toLocaleDateString('pt-BR'),
    'NUP': s.suite_implantada || '',
    'Guarda Municipal': s.guarda_municipal_estruturada ? 'Sim' : 'Não',
    'Recebeu Patrulha': s.recebeu_patrulha ? 'Sim' : 'Não',
    'Kit Athena': s.kit_athena_entregue ? 'Sim' : 'Não',
    'Capacitação': s.capacitacao_realizada ? 'Sim' : 'Não',
    'Observações': s.observacoes || '',
  }));
  const allSWs = XLSX.utils.json_to_sheet(allSData);
  styleWorksheet(allSWs, 'EA580C');
  XLSX.utils.book_append_sheet(wb, allSWs, 'Solicitações');

  saveWb(wb, `dashboard-regional-consolidado_${ts()}.xlsx`);
}

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
    ...patrulhasEquip.map(e => ({ 'Município': e.municipio, 'Região': getRegiao(e.municipio) || '', 'Tipo de Equipamento': e.tipo, 'Origem': 'Equipamento', 'Status': '-', 'Endereço': e.endereco || '', 'Responsável': e.responsavel || '', 'Telefone': e.telefone || '', 'Observações': e.observacoes || '', 'Data de Criação': new Date(e.created_at).toLocaleDateString('pt-BR') })),
    ...patrulhasSolic.map(s => ({ 'Município': s.municipio, 'Região': getRegiao(s.municipio) || '', 'Tipo de Equipamento': s.tipo_equipamento, 'Origem': 'Solicitação', 'Status': s.status, 'Endereço': '', 'Responsável': '', 'Telefone': '', 'Observações': s.observacoes || '', 'Data de Criação': new Date(s.created_at).toLocaleDateString('pt-BR') })),
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  styleWorksheet(ws, '10B981');
  XLSX.utils.book_append_sheet(wb, ws, 'Patrulhas Casas');
  saveWb(wb, `patrulhas-casas_${ts()}.xlsx`);
}

export function exportEquipamentosToPDF(equipamentos: Equipamento[], filterRegiao?: string) {
  const doc = new jsPDF('landscape');
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

export function exportEquipamentosToExcel(equipamentos: Equipamento[]) {
  const data = equipamentos.map(e => ({ 'Município': e.municipio, 'Região': getRegiao(e.municipio) || '', 'Tipo': e.tipo, 'Patrulha M.P.': e.possui_patrulha ? 'Sim' : 'Não', 'Endereço': e.endereco || '', 'Responsável': e.responsavel || '', 'Telefone': e.telefone || '', 'Observações': e.observacoes || '', 'Data de Criação': new Date(e.created_at).toLocaleDateString('pt-BR') }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  styleWorksheet(ws, '1F518C');
  XLSX.utils.book_append_sheet(wb, ws, 'Equipamentos');
  saveWb(wb, `equipamentos_${ts()}.xlsx`);
}

export function exportViaturasToPDF(viaturas: Viatura[]) {
  const doc = new jsPDF('landscape');
  const startY = addPdfHeader(doc, 'Viaturas PMCE', 'Relatório de Viaturas PMCE');
  doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  doc.text(`Total: ${viaturas.length} registros`, 14, startY);
  doc.setTextColor(0, 0, 0);
  autoTable(doc, {
    head: [['Município', 'Região', 'Órgão', 'Qtd', 'Implantação', 'Vinculada', 'Responsável']],
    body: viaturas.map(v => [v.municipio, getRegiao(v.municipio) || '-', v.orgao_responsavel, v.quantidade.toString(), new Date(v.data_implantacao).toLocaleDateString('pt-BR'), v.vinculada_equipamento ? 'Sim' : 'Não', v.responsavel || '-']),
    startY: startY + 6,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [31, 81, 140] },
    alternateRowStyles: { fillColor: [240, 244, 250] },
  });
  addPdfFooters(doc);
  doc.save(`viaturas-pmce_${ts()}.pdf`);
}

export function exportViaturasToExcel(viaturas: Viatura[]) {
  const data = viaturas.map(v => ({ 'Município': v.municipio, 'Região': getRegiao(v.municipio) || '', 'Tipo de Patrulha': v.tipo_patrulha, 'Órgão Responsável': v.orgao_responsavel, 'Quantidade': v.quantidade, 'Vinculada a Equipamento': v.vinculada_equipamento ? 'Sim' : 'Não', 'Data de Implantação': new Date(v.data_implantacao).toLocaleDateString('pt-BR'), 'Responsável': v.responsavel || '', 'Observações': v.observacoes || '' }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  styleWorksheet(ws, '7C3AED');
  XLSX.utils.book_append_sheet(wb, ws, 'Viaturas PMCE');
  saveWb(wb, `viaturas-pmce_${ts()}.xlsx`);
}

export function exportSolicitacoesToPDF(solicitacoes: Solicitacao[], filterRegiao?: string) {
  const doc = new jsPDF('landscape');
  let startY = addPdfHeader(doc, 'Solicitações', 'Relatório de Solicitações');
  doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  doc.text(`Total: ${solicitacoes.length} registros${filterRegiao && filterRegiao !== 'all' ? ` — Região: ${filterRegiao}` : ''}`, 14, startY);
  doc.setTextColor(0, 0, 0);
  autoTable(doc, {
    head: [['Município', 'Região', 'Tipo', 'Status', 'Data', 'NUP', 'Guarda', 'Patrulha', 'Kit Athena', 'Capacitação']],
    body: solicitacoes.map(s => [s.municipio, getRegiao(s.municipio) || '-', s.tipo_equipamento, s.status, new Date(s.data_solicitacao + 'T00:00:00').toLocaleDateString('pt-BR'), s.suite_implantada || '-', s.guarda_municipal_estruturada ? 'Sim' : 'Não', s.recebeu_patrulha ? 'Sim' : 'Não', s.kit_athena_entregue ? 'Sim' : 'Não', s.capacitacao_realizada ? 'Sim' : 'Não']),
    startY: startY + 6,
    styles: { fontSize: 6.5 },
    headStyles: { fillColor: [31, 81, 140] },
    alternateRowStyles: { fillColor: [240, 244, 250] },
  });
  addPdfFooters(doc);
  doc.save(`solicitacoes_${ts()}.pdf`);
}

export function exportSolicitacoesToExcel(solicitacoes: Solicitacao[]) {
  const data = solicitacoes.map(s => ({ 'Município': s.municipio, 'Região': getRegiao(s.municipio) || '', 'Tipo de Equipamento': s.tipo_equipamento, 'Status': s.status, 'Data da Solicitação': new Date(s.data_solicitacao).toLocaleDateString('pt-BR'), 'NUP': s.suite_implantada || '', 'Guarda Municipal Estruturada': s.guarda_municipal_estruturada ? 'Sim' : 'Não', 'Recebeu Patrulha': s.recebeu_patrulha ? 'Sim' : 'Não', 'Kit Athena Entregue': s.kit_athena_entregue ? 'Sim' : 'Não', 'Capacitação Realizada': s.capacitacao_realizada ? 'Sim' : 'Não', 'Observações': s.observacoes || '' }));
  const wb = XLSX.utils.book_new();
  const sWs2 = XLSX.utils.json_to_sheet(data);
  styleWorksheet(sWs2, 'EA580C');
  XLSX.utils.book_append_sheet(wb, sWs2, 'Solicitações');
  saveWb(wb, `solicitacoes_${ts()}.xlsx`);
}

export function exportAllToPDF(equipamentos: Equipamento[], viaturas: Viatura[], solicitacoes: Solicitacao[], atividades: Atividade[] = []) {
  const doc = new jsPDF('landscape');
  let currentY = 22;

  doc.setFontSize(18);
  doc.text('Relatório Completo - EVM', 14, currentY); currentY += 8;
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, currentY); currentY += 12;

  const totalEquipamentos = equipamentos.length;
  const equipamentosComPatrulha = equipamentos.filter(e => e.possui_patrulha).length;
  const municipiosComPatrulhaEquip = new Set(equipamentos.filter(e => e.possui_patrulha).map(e => e.municipio));
  const patrulhasSolicitacoes = solicitacoes.filter(s => s.recebeu_patrulha && !municipiosComPatrulhaEquip.has(s.municipio)).length;
  const totalPatrulhasCasas = equipamentosComPatrulha + patrulhasSolicitacoes;
  const totalViaturasPMCE = viaturas.reduce((sum, v) => sum + v.quantidade, 0);
  const viaturasVinculadas = viaturas.filter(v => v.vinculada_equipamento).reduce((sum, v) => sum + v.quantidade, 0);
  const viaturasNaoVinculadas = viaturas.filter(v => !v.vinculada_equipamento).reduce((sum, v) => sum + v.quantidade, 0);
  const solicitacoesEmAndamento = solicitacoes.filter(s => ['Recebida', 'Em análise', 'Aprovada', 'Em implantação'].includes(s.status)).length;
  const solicitacoesInauguradas = solicitacoes.filter(s => s.status === 'Inaugurada').length;
  const solicitacoesCanceladas = solicitacoes.filter(s => s.status === 'Cancelada').length;

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
  doc.setFontSize(12);
  doc.text('Equipamentos:', 14, currentY);
  autoTable(doc, {
    head: [['Município', 'Região', 'Tipo', 'Endereço', 'Responsável', 'Telefone', 'Patrulha M.P.']],
    body: equipamentos.map(e => [e.municipio, getRegiao(e.municipio) || '-', e.tipo, e.endereco || '-', e.responsavel || '-', e.telefone || '-', e.possui_patrulha ? 'Sim' : 'Não']),
    startY: currentY + 5,
    styles: { fontSize: 6.5 },
    headStyles: { fillColor: [31, 81, 140] },
  });

  doc.addPage(); currentY = 22;
  doc.setFontSize(12);
  doc.text('Viaturas PMCE:', 14, currentY);
  autoTable(doc, {
    head: [['Município', 'Região', 'Órgão', 'Qtd', 'Data Impl.', 'Vinculada', 'Responsável']],
    body: viaturas.map(v => [v.municipio, getRegiao(v.municipio) || '-', v.orgao_responsavel, v.quantidade.toString(), new Date(v.data_implantacao).toLocaleDateString('pt-BR'), v.vinculada_equipamento ? 'Sim' : 'Não', v.responsavel || '-']),
    startY: currentY + 5,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [31, 81, 140] },
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
    startY: currentY + 5,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [16, 185, 129] },
  });

  doc.addPage(); currentY = 22;
  doc.setFontSize(12);
  doc.text('Solicitações:', 14, currentY);
  autoTable(doc, {
    head: [['Município', 'Região', 'Tipo', 'Status', 'Data', 'NUP', 'Guarda', 'Patrulha', 'Kit Athena', 'Capacitação']],
    body: solicitacoes.map(s => [s.municipio, getRegiao(s.municipio) || '-', s.tipo_equipamento, s.status, new Date(s.data_solicitacao + 'T00:00:00').toLocaleDateString('pt-BR'), s.suite_implantada || '-', s.guarda_municipal_estruturada ? 'Sim' : 'Não', s.recebeu_patrulha ? 'Sim' : 'Não', s.kit_athena_entregue ? 'Sim' : 'Não', s.capacitacao_realizada ? 'Sim' : 'Não']),
    startY: currentY + 5,
    styles: { fontSize: 6.5 },
    headStyles: { fillColor: [31, 81, 140] },
  });

  // Atividades
  if (atividades.length > 0) {
    doc.addPage(); currentY = 22;
    doc.setFontSize(12);
    const totalAtend = atividades.reduce((s, a) => s + (a.atendimentos ?? 0), 0);
    doc.text(`Atividades (${atividades.length} registros | ${totalAtend} atendimentos):`, 14, currentY);
    autoTable(doc, {
      head: [['Município', 'Sede', 'Tipo', 'Recurso', 'Data', 'Status', 'Atend.']],
      body: atividades.map(a => [
        a.municipio, a.municipio_sede, a.tipo, a.recurso,
        new Date(a.data + 'T00:00:00').toLocaleDateString('pt-BR'),
        a.status, a.atendimentos?.toString() || '-',
      ]),
      startY: currentY + 5,
      styles: { fontSize: 6.5 },
      headStyles: { fillColor: [124, 58, 237] },
      alternateRowStyles: { fillColor: [245, 243, 255] },
    });
  }

  addPdfFooters(doc);
  doc.save(`relatorio-completo_${ts()}.pdf`);
}

export function exportAllToExcel(equipamentos: Equipamento[], viaturas: Viatura[], solicitacoes: Solicitacao[], atividades: Atividade[] = []) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(equipamentos.map(e => ({ 'Município': e.municipio, 'Região': getRegiao(e.municipio) || '', 'Tipo': e.tipo, 'Patrulha M.P.': e.possui_patrulha ? 'Sim' : 'Não', 'Endereço': e.endereco || '', 'Responsável': e.responsavel || '', 'Telefone': e.telefone || '', 'Observações': e.observacoes || '', 'Data Criação': new Date(e.created_at).toLocaleDateString('pt-BR') }))), 'Equipamentos');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(viaturas.map(v => ({ 'Município': v.municipio, 'Região': getRegiao(v.municipio) || '', 'Tipo de Patrulha': v.tipo_patrulha, 'Órgão Responsável': v.orgao_responsavel, 'Quantidade': v.quantidade, 'Vinculada a Equipamento': v.vinculada_equipamento ? 'Sim' : 'Não', 'Data de Implantação': new Date(v.data_implantacao).toLocaleDateString('pt-BR'), 'Responsável': v.responsavel || '', 'Observações': v.observacoes || '' }))), 'Viaturas PMCE');
  const patrulhasEquip = equipamentos.filter(e => e.possui_patrulha);
  const municipiosComPatrulhaEquip = new Set(patrulhasEquip.map(e => e.municipio));
  const patrulhasSolic = solicitacoes.filter(s => s.recebeu_patrulha && !municipiosComPatrulhaEquip.has(s.municipio));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([...patrulhasEquip.map(e => ({ 'Município': e.municipio, 'Região': getRegiao(e.municipio) || '', 'Tipo de Equipamento': e.tipo, 'Origem': 'Equipamento', 'Status': '-', 'Endereço': e.endereco || '', 'Responsável': e.responsavel || '', 'Telefone': e.telefone || '', 'Observações': e.observacoes || '', 'Data Criação': new Date(e.created_at).toLocaleDateString('pt-BR') })), ...patrulhasSolic.map(s => ({ 'Município': s.municipio, 'Região': getRegiao(s.municipio) || '', 'Tipo de Equipamento': s.tipo_equipamento, 'Origem': 'Solicitação', 'Status': s.status, 'Endereço': '', 'Responsável': '', 'Telefone': '', 'Observações': s.observacoes || '', 'Data Criação': new Date(s.created_at).toLocaleDateString('pt-BR') }))]), 'Patrulhas Casas');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(solicitacoes.map(s => ({ 'Município': s.municipio, 'Região': getRegiao(s.municipio) || '', 'Tipo de Equipamento': s.tipo_equipamento, 'Status': s.status, 'Data da Solicitação': new Date(s.data_solicitacao + 'T00:00:00').toLocaleDateString('pt-BR'), 'NUP': s.suite_implantada || '', 'Guarda Municipal Estruturada': s.guarda_municipal_estruturada ? 'Sim' : 'Não', 'Recebeu Patrulha': s.recebeu_patrulha ? 'Sim' : 'Não', 'Kit Athena Entregue': s.kit_athena_entregue ? 'Sim' : 'Não', 'Capacitação Realizada': s.capacitacao_realizada ? 'Sim' : 'Não', 'Observações': s.observacoes || '' }))), 'Solicitações');
  if (atividades.length > 0) {
    const atividadesWs = XLSX.utils.json_to_sheet(atividades.map(a => ({
      'Município': a.municipio, 'Sede (CMB/CMC)': a.municipio_sede,
      'Região': getRegiao(a.municipio) || '',
      'Tipo': a.tipo, 'Recurso': a.recurso,
      'Status': a.status,
      'Data': new Date(a.data + 'T00:00:00').toLocaleDateString('pt-BR'),
      'Duração (dias)': a.dias ?? '',
      'Atendimentos': a.atendimentos ?? '',
      'NUP': a.nup || '', 'Nome do Evento': a.nome_evento || '',
    })));
    styleWorksheet(atividadesWs, '7C3AED');
    XLSX.utils.book_append_sheet(wb, atividadesWs, 'Atividades');
  }
  saveWb(wb, `relatorio-completo_${ts()}.xlsx`);
}

// Map export types
export interface MapExportFilters { tipoEquipamento: string; statusSolicitacao: string; apenasComViatura: boolean; regiao?: string; }
export interface MapExportStats { brasileira: number; cearense: number; municipal: number; lilas: number; viaturaOnly: number; semCobertura: number; }
export interface MapExportOptions { highResolution?: boolean; embedLegend?: boolean; }
export interface MapEquipmentCounts { brasileira: number; cearense: number; municipal: number; lilas: number; }
export interface RegionalGoalsExportRow { regiao: string; status: string; equipamentos: { current: number; goal: number; progress: number }; viaturas: { current: number; goal: number; progress: number }; cobertura: { current: number; goal: number; progress: number }; overallProgress: number; expectedProgress: number; }
export interface RegionalGoalsExportPayload { monthLabel: string; generatedAt: Date; summary: { achieved: number; onTrack: number; atRisk: number; behind: number; avgProgress: number; }; rows: RegionalGoalsExportRow[]; }

export function exportRegionalGoalsToPDF(payload: RegionalGoalsExportPayload) {
  const doc = new jsPDF('landscape');
  doc.setFontSize(16);
  doc.text('Painel de Metas Mensais - Regiões (Consolidado)', 14, 18);
  doc.setFontSize(10);
  doc.text(`Mês: ${payload.monthLabel}`, 14, 26);
  doc.text(`Gerado em: ${payload.generatedAt.toLocaleDateString('pt-BR')} às ${payload.generatedAt.toLocaleTimeString('pt-BR')}`, 14, 32);
  doc.text(`Resumo: ${payload.summary.achieved} atingidas • ${payload.summary.onTrack} no caminho • ${payload.summary.atRisk} em risco • ${payload.summary.behind} atrasadas • Média ${payload.summary.avgProgress.toFixed(0)}%`, 14, 40);
  autoTable(doc, {
    startY: 46,
    head: [['Região', 'Status', 'Equip. (atual/meta)', 'Equip. %', 'Viaturas (atual/meta)', 'Viaturas %', 'Cobertura (atual/meta)', 'Cobertura %', 'Geral %', 'Esperado %']],
    body: payload.rows.map(r => [r.regiao, r.status, `${r.equipamentos.current}/${r.equipamentos.goal}`, `${Math.round(r.equipamentos.progress)}%`, `${r.viaturas.current}/${r.viaturas.goal}`, `${Math.round(r.viaturas.progress)}%`, `${r.cobertura.current.toFixed(1)}%/${r.cobertura.goal}%`, `${Math.round(r.cobertura.progress)}%`, `${Math.round(r.overallProgress)}%`, `${Math.round(r.expectedProgress)}%`]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [31, 81, 140] },
    didDrawCell: (data) => {
      const col = data.column.index;
      if (![3, 5, 7, 8].includes(col) || data.section !== 'body') return;
      const text = String(data.cell.text?.[0] ?? '').replace('%', '');
      const pct = Math.max(0, Math.min(100, Number(text)));
      if (Number.isNaN(pct)) return;
      const barX = data.cell.x + 1, barY = data.cell.y + data.cell.height - 2.5, barW = data.cell.width - 2, fillW = (barW * pct) / 100;
      doc.setFillColor(229, 231, 235);
      doc.rect(barX, barY, barW, 1.5, 'F');
      if (pct >= 100) doc.setFillColor(16, 185, 129);
      else if (pct >= 75) doc.setFillColor(59, 130, 246);
      else if (pct >= 50) doc.setFillColor(245, 158, 11);
      else doc.setFillColor(239, 68, 68);
      doc.rect(barX, barY, fillW, 1.5, 'F');
    },
  });
  addPdfFooters(doc);
  doc.save(`metas-regionais-${payload.monthLabel.toLowerCase().replace(/\s+/g, '-')}_${ts()}.pdf`);
}

// Captured map image data type
export interface CapturedMapImage {
  dataUrl: string;
  width: number;
  height: number;
}

// Capture map image for preview
// FIX: scroll the element to the top of the viewport before capturing,
// then pass scrollX:0/scrollY:0 so html2canvas captures it without offset.
export async function captureMapImage(
  mapElement: HTMLElement,
  highResolution: boolean = false
): Promise<CapturedMapImage> {
  const html2canvasLib = (await import('html2canvas')).default;

  // Save current scroll position
  const originalScrollY = window.scrollY;

  // Scroll so the map is flush with the top of the viewport
  const elementTop = mapElement.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({ top: elementTop, behavior: 'instant' });

  // Wait for repaint + tile re-render after scroll
  await new Promise(resolve => setTimeout(resolve, 1200));

  const scale = highResolution ? 3 : 2;

  const canvas = await html2canvasLib(mapElement, {
    useCORS: true,
    allowTaint: true,
    scale: scale,
    logging: false,
    backgroundColor: '#f8fafc',
    width: mapElement.offsetWidth,
    height: mapElement.offsetHeight,
    // After scrolling to the element, it sits at top of viewport → no offset needed
    scrollX: 0,
    scrollY: 0,
    foreignObjectRendering: false,
    removeContainer: true,
    onclone: (_clonedDoc, clonedElement) => {
      clonedElement.style.transform = 'none';
      clonedElement.style.position = 'relative';
      clonedElement.style.left = '0';
      clonedElement.style.top = '0';

      // Ensure SVG path fills are preserved in the clone
      const paths = _clonedDoc.querySelectorAll('path');
      paths.forEach(path => {
        const fill = path.getAttribute('fill');
        if (fill) path.style.fill = fill;
        const stroke = path.getAttribute('stroke');
        if (stroke) path.style.stroke = stroke;
      });
    },
  });

  // Restore original scroll position
  window.scrollTo({ top: originalScrollY, behavior: 'instant' });

  return {
    dataUrl: canvas.toDataURL('image/png', 1.0),
    width: canvas.width,
    height: canvas.height,
  };
}

export async function exportMapToPDF(
  mapElement: HTMLElement,
  filters: MapExportFilters,
  stats: MapExportStats,
  options: MapExportOptions = {},
  equipmentCounts?: MapEquipmentCounts,
  preCapturedImage?: CapturedMapImage
) {
  const { highResolution = false, embedLegend = false } = options;

  // ── Page 1: capa com filtros e estatísticas ──
  const doc = new jsPDF('landscape');
  const PW = doc.internal.pageSize.getWidth();   // 297mm
  const PH = doc.internal.pageSize.getHeight();  // 210mm

  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('Mapa do Ceará — EVM', 14, 18);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.text('Enfrentamento à Violência contra as Mulheres', 14, 25);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 31);

  // Filtros
  doc.setFontSize(11); doc.setFont(undefined, 'bold');
  doc.text('Filtros Aplicados', 14, 44); doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.text(`Região: ${filters.regiao && filters.regiao !== 'all' ? filters.regiao : 'Todas'}`, 14, 51);
  doc.text(`Tipo de Equipamento: ${filters.tipoEquipamento === 'all' ? 'Todos' : filters.tipoEquipamento}`, 14, 57);
  doc.text(`Status de Solicitação: ${filters.statusSolicitacao === 'all' ? 'Todos' : filters.statusSolicitacao}`, 14, 63);
  doc.text(`Apenas com Viatura: ${filters.apenasComViatura ? 'Sim' : 'Não'}`, 14, 69);

  // Estatísticas
  doc.setFontSize(11); doc.setFont(undefined, 'bold');
  doc.text('Estatísticas', 14, 82); doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  const totalComEquipamento = stats.brasileira + stats.cearense + stats.municipal + stats.lilas;
  const rows = [
    ['Casa da Mulher Brasileira', String(equipmentCounts?.brasileira ?? stats.brasileira)],
    ['Casa da Mulher Cearense',   String(equipmentCounts?.cearense   ?? stats.cearense)],
    ['Casa da Mulher Municipal',  String(equipmentCounts?.municipal  ?? stats.municipal)],
    ['Sala Lilás',                String(equipmentCounts?.lilas      ?? stats.lilas)],
    ['Só Viatura (sem equipamento)', String(stats.viaturaOnly)],
    ['Sem Cobertura',             String(stats.semCobertura)],
    ['Cobertura Total (%)',       `${(totalComEquipamento / 184 * 100).toFixed(2)}% (${totalComEquipamento}/184)`],
  ];
  rows.forEach(([label, value], i) => {
    doc.text(`${label}:`, 14, 89 + i * 7);
    doc.setFont(undefined, 'bold');
    doc.text(value, 80, 89 + i * 7);
    doc.setFont(undefined, 'normal');
  });

  // ── Page 2: mapa grande e centralizado ──
  doc.addPage();

  const captured = preCapturedImage ?? await captureMapImage(mapElement, highResolution);
  const imgAspect = captured.width / captured.height;

  // Margens
  const margin = 10;
  const headerH = 12; // espaço para título no topo
  const footerH = 8;
  const availW = PW - margin * 2;
  const availH = PH - margin * 2 - headerH - footerH;

  // Calcular dimensões mantendo aspect ratio, ocupando o máximo possível
  let imgW = availW;
  let imgH = imgW / imgAspect;
  if (imgH > availH) {
    imgH = availH;
    imgW = imgH * imgAspect;
  }

  // Centralizar na página
  const imgX = margin + (availW - imgW) / 2;
  const imgY = margin + headerH;

  // Título da página
  doc.setFontSize(10); doc.setFont(undefined, 'bold');
  doc.text('Mapa de Cobertura — Estado do Ceará', PW / 2, margin + 7, { align: 'center' });
  doc.setFont(undefined, 'normal');

  // Imagem do mapa
  doc.addImage(captured.dataUrl, 'PNG', imgX, imgY, imgW, imgH);

  // Rodapé
  doc.setFontSize(7); doc.setTextColor(120, 120, 120);
  doc.text(`Cobertura: ${(totalComEquipamento / 184 * 100).toFixed(1)}% — ${totalComEquipamento} de 184 municípios com equipamento`, PW / 2, imgY + imgH + 5, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // Legenda sobreposta (canto inferior direito da imagem)
  if (embedLegend) {
    const lgW = 62, lgH = 62;
    const lgX = imgX + imgW - lgW - 3;
    const lgY = imgY + imgH - lgH - 3;

    doc.setFillColor(255, 255, 255); doc.setDrawColor(180, 180, 180);
    doc.roundedRect(lgX, lgY, lgW, lgH, 2, 2, 'FD');

    doc.setFontSize(7); doc.setFont(undefined, 'bold'); doc.setTextColor(0, 0, 0);
    doc.text('Legenda', lgX + 3, lgY + 6); doc.setFont(undefined, 'normal');

    const legendItems = [
      { color: [13, 148, 136]  as [number,number,number], label: 'C.M. Brasileira',  count: equipmentCounts?.brasileira ?? stats.brasileira },
      { color: [124, 58, 237]  as [number,number,number], label: 'C.M. Cearense',    count: equipmentCounts?.cearense   ?? stats.cearense   },
      { color: [234, 88, 12]   as [number,number,number], label: 'C.M. Municipal',   count: equipmentCounts?.municipal  ?? stats.municipal  },
      { color: [217, 70, 239]  as [number,number,number], label: 'Sala Lilás',        count: equipmentCounts?.lilas      ?? stats.lilas      },
      { color: [6, 182, 212]   as [number,number,number], label: 'Só Viatura',        count: stats.viaturaOnly },
      { color: [229, 231, 235] as [number,number,number], label: 'Sem Cobertura',     count: stats.semCobertura },
    ];
    legendItems.forEach((item, i) => {
      const ly = lgY + 11 + i * 8;
      doc.setFillColor(...item.color);
      doc.rect(lgX + 3, ly - 2.5, 4, 4, 'F');
      doc.setTextColor(0, 0, 0);
      doc.text(`${item.label} (${item.count})`, lgX + 9, ly);
    });
  }

  doc.save(highResolution ? `mapa-ceara-alta-resolucao_${ts()}.pdf` : `mapa-ceara_${ts()}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Atividades export
// ─────────────────────────────────────────────────────────────────────────────
export function exportAtividadesToPDF(atividades: Atividade[], filterLabel?: string) {
  const doc = new jsPDF('landscape');
  let startY = addPdfHeader(doc, 'Atividades', 'Relatório de Atividades');

  doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  doc.text(
    `Total: ${atividades.length} registro(s)${filterLabel ? ` — ${filterLabel}` : ''}`,
    14, startY,
  );
  doc.setTextColor(0, 0, 0);

  const realizadas = atividades.filter(a => a.status === 'Realizado').length;
  const agendadas  = atividades.filter(a => a.status === 'Agendado').length;
  const totalAtend = atividades.reduce((s, a) => s + (a.atendimentos ?? 0), 0);

  startY += 5;
  doc.setFontSize(8);
  doc.text(`Realizadas: ${realizadas}  |  Agendadas: ${agendadas}  |  Total de atendimentos: ${totalAtend}`, 14, startY);
  startY += 8;

  // Agrupar por sede e gerar uma tabela por grupo
  const sedes = Array.from(new Set(atividades.map(a => a.municipio_sede))).sort();

  sedes.forEach((sede, idx) => {
    const grupo = atividades.filter(a => a.municipio_sede === sede);
    const atendSede = grupo.reduce((s, a) => s + (a.atendimentos ?? 0), 0);

    // Título do grupo
    doc.setFontSize(10); doc.setFont(undefined, 'bold');
    doc.setTextColor(124, 58, 237);
    doc.text(`${sede}`, 14, startY);
    doc.setFont(undefined, 'normal'); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text(`${grupo.length} atividade(s) | ${atendSede} atendimento(s)`, 14, startY + 5);
    doc.setTextColor(0, 0, 0);

    autoTable(doc, {
      head: [['Município', 'Região', 'Tipo', 'Recurso', 'Data', 'Dias', 'Horário', 'Status', 'Atend.', 'NUP', 'Evento']],
      body: grupo.map(a => [
        a.municipio,
        getRegiao(a.municipio) || '-',
        a.tipo,
        a.recurso,
        new Date(a.data + 'T00:00:00').toLocaleDateString('pt-BR'),
        a.dias?.toString() || '-',
        a.horario || '-',
        a.status,
        a.atendimentos?.toString() || '-',
        a.nup || '-',
        a.nome_evento || '-',
      ]),
      startY: startY + 9,
      styles: { fontSize: 6.5 },
      headStyles: { fillColor: [124, 58, 237] },
      alternateRowStyles: { fillColor: [245, 243, 255] },
    });

    startY = (doc as any).lastAutoTable.finalY + 10;

    // Nova página entre sedes (exceto na última)
    if (idx < sedes.length - 1 && startY > 160) {
      doc.addPage();
      startY = addPdfHeader(doc, 'Atividades', 'Relatório de Atividades (cont.)') + 5;
    }
  });

  addPdfFooters(doc);
  doc.save(`atividades_${ts()}.pdf`);
}

export function exportAtividadesToExcel(atividades: Atividade[]) {
  const data = atividades.map(a => ({
    'Município':           a.municipio,
    'Região':              getRegiao(a.municipio) || '',
    'Sede (CMB/CMC)':     a.municipio_sede,
    'Tipo':                a.tipo,
    'Recurso':             a.recurso,
    'Qtd. Equipe':         a.quantidade_equipe ?? '',
    'Status':              a.status,
    'Data':                new Date(a.data + 'T00:00:00').toLocaleDateString('pt-BR'),
    'Duração (dias)':      a.dias ?? '',
    'Horário':             a.horario || '',
    'Atendimentos':        a.atendimentos ?? '',
    'NUP':                 a.nup || '',
    'Nome do Evento':      a.nome_evento || '',
    'Endereço / Tel':      a.endereco || '',
    'Observações':         a.observacoes || '',
    'Data de Criação':     new Date(a.created_at).toLocaleDateString('pt-BR'),
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  styleWorksheet(ws, '7C3AED');
  XLSX.utils.book_append_sheet(wb, ws, 'Atividades');
  saveWb(wb, `atividades_${ts()}.xlsx`);
}