import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { Equipamento, Viatura, Solicitacao, DashboardStats, Atividade } from '@/types';
import { getRegiao, RegiaoPlanejamento } from '@/data/municipios';

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
/** Formata data string "YYYY-MM-DD" sem problema de timezone */
function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
}

/** Cabeçalho padrão EVM em todas as páginas de um PDF */
function addPdfHeader(doc: jsPDF, title: string, subtitle?: string): number {
  const PW = doc.internal.pageSize.getWidth();

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
    lilasMunicipal: number;
    lilasEstado: number;
    lilasDelegacia: number;
    ddm?: number;
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

  const allSData = solicitacoes.map(s => ({
    'Município': s.municipio,
    'Região': getRegiao(s.municipio) || '',
    'Tipo de Equipamento': s.tipo_equipamento,
    'Status': s.status,
    'Data da Solicitação': new Date(s.data_solicitacao).toLocaleDateString('pt-BR'),
    'NUP': s.nup || '',
    'Guarda Municipal': s.guarda_municipal_estruturada ? 'Sim' : 'Não',
    'Recebeu Patrulha': s.recebeu_patrulha ? 'Sim' : 'Não',
    'Kit Athena': s.kit_athena_entregue ? 'Sim' : 'Não',
    'Qualificação': s.capacitacao_realizada ? 'Sim' : 'Não',
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
    head: [['Município', 'Região', 'Tipo', 'Status', 'Data', 'NUP', 'Guarda', 'Patrulha', 'Kit Athena', 'Qualificação']],
    body: solicitacoes.map(s => [s.municipio, getRegiao(s.municipio) || '-', s.tipo_equipamento, s.status, new Date(s.data_solicitacao + 'T00:00:00').toLocaleDateString('pt-BR'), s.nup || '-', s.guarda_municipal_estruturada ? 'Sim' : 'Não', s.recebeu_patrulha ? 'Sim' : 'Não', s.kit_athena_entregue ? 'Sim' : 'Não', s.capacitacao_realizada ? 'Sim' : 'Não']),
    startY: startY + 6,
    styles: { fontSize: 6.5 },
    headStyles: { fillColor: [31, 81, 140] },
    alternateRowStyles: { fillColor: [240, 244, 250] },
  });
  addPdfFooters(doc);
  doc.save(`solicitacoes_${ts()}.pdf`);
}

export function exportSolicitacoesToExcel(solicitacoes: Solicitacao[]) {
  const data = solicitacoes.map(s => ({ 'Município': s.municipio, 'Região': getRegiao(s.municipio) || '', 'Tipo de Equipamento': s.tipo_equipamento, 'Status': s.status, 'Data da Solicitação': new Date(s.data_solicitacao).toLocaleDateString('pt-BR'), 'NUP': s.nup || '', 'Guarda Municipal Estruturada': s.guarda_municipal_estruturada ? 'Sim' : 'Não', 'Recebeu Patrulha': s.recebeu_patrulha ? 'Sim' : 'Não', 'Kit Athena Entregue': s.kit_athena_entregue ? 'Sim' : 'Não', 'Qualificação Realizada': s.capacitacao_realizada ? 'Sim' : 'Não', 'Observações': s.observacoes || '' }));
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
    head: [['Município', 'Região', 'Tipo', 'Status', 'Data', 'NUP', 'Guarda', 'Patrulha', 'Kit Athena', 'Qualificação']],
    body: solicitacoes.map(s => [s.municipio, getRegiao(s.municipio) || '-', s.tipo_equipamento, s.status, new Date(s.data_solicitacao + 'T00:00:00').toLocaleDateString('pt-BR'), s.nup || '-', s.guarda_municipal_estruturada ? 'Sim' : 'Não', s.recebeu_patrulha ? 'Sim' : 'Não', s.kit_athena_entregue ? 'Sim' : 'Não', s.capacitacao_realizada ? 'Sim' : 'Não']),
    startY: currentY + 5,
    styles: { fontSize: 6.5 },
    headStyles: { fillColor: [31, 81, 140] },
  });

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
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([...patrulhasEquip.map(e => ({ 'Município': e.municipio, 'Região': getRegiao(e.municipio) || '', 'Tipo de Equipamento': e.tipo, 'Origem': 'Equipamento', 'Status': '-', 'Endereço': e.endereco || '', 'Responsável': e.responsavel || '', 'Telefone': e.telefone || '', 'Kit Athena': e.kit_athena_entregue ? 'Sim' : 'Não', 'Qualificação': e.capacitacao_realizada ? 'Sim' : 'Não', 'NUP': e.nup || '', 'Observações': e.observacoes || '', 'Data Criação': new Date(e.created_at).toLocaleDateString('pt-BR') })), ...patrulhasSolic.map(s => ({ 'Município': s.municipio, 'Região': getRegiao(s.municipio) || '', 'Tipo de Equipamento': s.tipo_equipamento, 'Origem': 'Solicitação', 'Status': s.status, 'Endereço': '', 'Responsável': '', 'Telefone': '', 'Observações': s.observacoes || '', 'Data Criação': new Date(s.created_at).toLocaleDateString('pt-BR') }))]), 'Patrulhas Casas');
  const lilasMunicipalEquip  = equipamentos.filter(e => e.tipo === 'Sala Lilás Municipal');
  const lilasEstadoEquip     = equipamentos.filter(e => e.tipo === 'Sala Lilás Governo do Estado');
  const lilasDelegaciaEquip  = equipamentos.filter(e => e.tipo === 'Sala Lilás em Delegacia');
  const toEquipRow = (e: typeof equipamentos[0]) => ({ 'Município': e.municipio, 'Região': getRegiao(e.municipio) || '', 'Tipo': e.tipo, 'Endereço': e.endereco || '', 'Responsável': e.responsavel || '', 'Telefone': e.telefone || '', 'Kit Athena': e.kit_athena_entregue ? 'Sim' : 'Não', 'Qualificação': e.capacitacao_realizada ? 'Sim' : 'Não', 'NUP': e.nup || '', 'Observações': e.observacoes || '' });
  if (lilasMunicipalEquip.length)  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lilasMunicipalEquip.map(toEquipRow)),  'Salas Lilás Municipal');
  if (lilasEstadoEquip.length)     XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lilasEstadoEquip.map(toEquipRow)),    'Salas Lilás Estado');
  if (lilasDelegaciaEquip.length)  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lilasDelegaciaEquip.map(toEquipRow)), 'Salas Lilás Delegacia');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(solicitacoes.map(s => ({ 'Município': s.municipio, 'Região': getRegiao(s.municipio) || '', 'Tipo de Equipamento': s.tipo_equipamento, 'Status': s.status, 'Data da Solicitação': new Date(s.data_solicitacao + 'T00:00:00').toLocaleDateString('pt-BR'), 'NUP': s.nup || '', 'Guarda Municipal Estruturada': s.guarda_municipal_estruturada ? 'Sim' : 'Não', 'Recebeu Patrulha': s.recebeu_patrulha ? 'Sim' : 'Não', 'Kit Athena Entregue': s.kit_athena_entregue ? 'Sim' : 'Não', 'Qualificação Realizada': s.capacitacao_realizada ? 'Sim' : 'Não', 'Observações': s.observacoes || '' }))), 'Solicitações');
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
export interface MapExportStats { brasileira: number; cearense: number; municipal: number; lilasMunicipal: number; lilasEstado: number; lilasDelegacia: number; ddm: number; viaturaOnly: number; semCobertura: number; }
export interface MapExportOptions { highResolution?: boolean; embedLegend?: boolean; }
export interface MapEquipmentCounts { brasileira: number; cearense: number; municipal: number; lilasMunicipal: number; lilasEstado: number; lilasDelegacia: number; ddm: number; }
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

export interface CapturedMapImage {
  dataUrl: string;
  width: number;
  height: number;
}

export async function captureMapImage(
  mapElement: HTMLElement,
  highResolution: boolean = false
): Promise<CapturedMapImage> {
  const html2canvasLib = (await import('html2canvas')).default;
  const originalScrollY = window.scrollY;
  const elementTop = mapElement.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({ top: elementTop, behavior: 'instant' });
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
    scrollX: 0,
    scrollY: 0,
    foreignObjectRendering: false,
    removeContainer: true,
    onclone: (_clonedDoc, clonedElement) => {
      clonedElement.style.transform = 'none';
      clonedElement.style.position = 'relative';
      clonedElement.style.left = '0';
      clonedElement.style.top = '0';
      const paths = _clonedDoc.querySelectorAll('path');
      paths.forEach(path => {
        const fill = path.getAttribute('fill');
        if (fill) path.style.fill = fill;
        const stroke = path.getAttribute('stroke');
        if (stroke) path.style.stroke = stroke;
      });
    },
  });
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
  const doc = new jsPDF('landscape');
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();

  doc.setFontSize(16); doc.setFont(undefined, 'bold');
  doc.text('Mapa do Ceará — EVM', 14, 18); doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.text('Enfrentamento à Violência contra as Mulheres', 14, 25);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 31);

  doc.setFontSize(11); doc.setFont(undefined, 'bold');
  doc.text('Filtros Aplicados', 14, 44); doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.text(`Região: ${filters.regiao && filters.regiao !== 'all' ? filters.regiao : 'Todas'}`, 14, 51);
  doc.text(`Tipo de Equipamento: ${filters.tipoEquipamento === 'all' ? 'Todos' : filters.tipoEquipamento}`, 14, 57);
  doc.text(`Status de Solicitação: ${filters.statusSolicitacao === 'all' ? 'Todos' : filters.statusSolicitacao}`, 14, 63);
  doc.text(`Apenas com Viatura: ${filters.apenasComViatura ? 'Sim' : 'Não'}`, 14, 69);

  doc.setFontSize(11); doc.setFont(undefined, 'bold');
  doc.text('Estatísticas', 14, 82); doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  const totalComEquipamento = stats.brasileira + stats.cearense + stats.municipal + stats.lilasMunicipal + stats.lilasEstado + stats.lilasDelegacia + stats.ddm;
  const rows = [
    ['Casa da Mulher Brasileira', String(equipmentCounts?.brasileira ?? stats.brasileira)],
    ['Casa da Mulher Cearense',   String(equipmentCounts?.cearense   ?? stats.cearense)],
    ['Casa da Mulher Municipal',  String(equipmentCounts?.municipal  ?? stats.municipal)],
    ['Sala Lilás Municipal',       String(equipmentCounts?.lilasMunicipal  ?? stats.lilasMunicipal)],
    ['Sala Lilás Gov. Estado',     String(equipmentCounts?.lilasEstado     ?? stats.lilasEstado)],
    ['Sala Lilás em Delegacia',    String(equipmentCounts?.lilasDelegacia  ?? stats.lilasDelegacia)],
    ['DDM',                       String(equipmentCounts?.ddm             ?? stats.ddm)],
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

  doc.addPage();
  const captured = preCapturedImage ?? await captureMapImage(mapElement, highResolution);
  const imgAspect = captured.width / captured.height;
  const margin = 10;
  const headerH = 12;
  const footerH = 8;
  const availW = PW - margin * 2;
  const availH = PH - margin * 2 - headerH - footerH;
  let imgW = availW;
  let imgH = imgW / imgAspect;
  if (imgH > availH) { imgH = availH; imgW = imgH * imgAspect; }
  const imgX = margin + (availW - imgW) / 2;
  const imgY = margin + headerH;
  doc.setFontSize(10); doc.setFont(undefined, 'bold');
  doc.text('Mapa de Cobertura — Estado do Ceará', PW / 2, margin + 7, { align: 'center' });
  doc.setFont(undefined, 'normal');
  doc.addImage(captured.dataUrl, 'PNG', imgX, imgY, imgW, imgH);
  doc.setFontSize(7); doc.setTextColor(120, 120, 120);
  doc.text(`Cobertura: ${(totalComEquipamento / 184 * 100).toFixed(1)}% — ${totalComEquipamento} de 184 municípios com equipamento`, PW / 2, imgY + imgH + 5, { align: 'center' });
  doc.setTextColor(0, 0, 0);

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
      { color: [192, 38, 211]  as [number,number,number], label: 'Sala Lilás Municipal',    count: equipmentCounts?.lilasMunicipal  ?? stats.lilasMunicipal  },
      { color: [232, 121, 249] as [number,number,number], label: 'Sala Lilás Gov. Estado',  count: equipmentCounts?.lilasEstado     ?? stats.lilasEstado     },
      { color: [240, 171, 252] as [number,number,number], label: 'Sala Lilás em Delegacia', count: equipmentCounts?.lilasDelegacia  ?? stats.lilasDelegacia  },
      { color: [21, 128, 61]   as [number,number,number], label: 'DDM',                    count: equipmentCounts?.ddm             ?? stats.ddm             },
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
  doc.text(`Total: ${atividades.length} registro(s)${filterLabel ? ` — ${filterLabel}` : ''}`, 14, startY);
  doc.setTextColor(0, 0, 0);
  const realizadas = atividades.filter(a => a.status === 'Realizado').length;
  const agendadas  = atividades.filter(a => a.status === 'Agendado').length;
  const totalAtend = atividades.reduce((s, a) => s + (a.atendimentos ?? 0), 0);
  startY += 5;
  doc.setFontSize(8);
  doc.text(`Realizadas: ${realizadas}  |  Agendadas: ${agendadas}  |  Total de atendimentos: ${totalAtend}`, 14, startY);
  startY += 8;
  const sedes = Array.from(new Set(atividades.map(a => a.municipio_sede))).sort();
  sedes.forEach((sede, idx) => {
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
      body: grupo.map(a => [a.municipio, getRegiao(a.municipio) || '-', a.tipo, a.recurso, new Date(a.data + 'T00:00:00').toLocaleDateString('pt-BR'), a.dias?.toString() || '-', a.horario || '-', a.status, a.atendimentos?.toString() || '-', a.nup || '-', a.nome_evento || '-']),
      startY: startY + 9,
      styles: { fontSize: 6.5 },
      headStyles: { fillColor: [124, 58, 237] },
      alternateRowStyles: { fillColor: [245, 243, 255] },
    });
    startY = (doc as any).lastAutoTable.finalY + 10;
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
    'Município': a.municipio, 'Região': getRegiao(a.municipio) || '', 'Sede (CMB/CMC)': a.municipio_sede,
    'Tipo': a.tipo, 'Recurso': a.recurso, 'Qtd. Equipe': a.quantidade_equipe ?? '',
    'Status': a.status, 'Data': new Date(a.data + 'T00:00:00').toLocaleDateString('pt-BR'),
    'Duração (dias)': a.dias ?? '', 'Horário': a.horario || '', 'Atendimentos': a.atendimentos ?? '',
    'NUP': a.nup || '', 'Nome do Evento': a.nome_evento || '', 'Endereço / Tel': a.endereco || '',
    'Observações': a.observacoes || '', 'Data de Criação': new Date(a.created_at).toLocaleDateString('pt-BR'),
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  styleWorksheet(ws, '7C3AED');
  XLSX.utils.book_append_sheet(wb, ws, 'Atividades');
  saveWb(wb, `atividades_${ts()}.xlsx`);
}

// ─────────────────────────────────────────────────────────────────────────────
// RELATÓRIO EVM — Rede de Proteção à Mulher
// ─────────────────────────────────────────────────────────────────────────────

export interface CpdiReportData {
  equipamentos: Equipamento[];
  solicitacoes: Solicitacao[];
  viaturas: Viatura[];
  dataReferencia?: string;
  regiaoFiltro?: string;
  secoesAtivas?: string[];
  mapaImagem?: CapturedMapImage;
  modoResumo?: boolean; // true = apenas resumo executivo + equipamentos em funcionamento (sem solicitações)
}

export async function exportCpdiToPDF(data: CpdiReportData): Promise<void> {
  const { equipamentos: eqAll, solicitacoes: solAll, viaturas: viAll, dataReferencia, regiaoFiltro, secoesAtivas, mapaImagem, modoResumo = false } = data;

  const inclui = (regiao?: string | null) => !regiaoFiltro || !regiao || regiao === regiaoFiltro;
  const equipamentos  = eqAll.filter(e => inclui(getRegiao(e.municipio)));
  const solicitacoes  = solAll.filter(s => inclui(getRegiao(s.municipio)));
  const viaturas      = viAll.filter(v  => inclui(getRegiao(v.municipio)));

  const temSecao = (id: string) => !secoesAtivas || secoesAtivas.includes(id);
  const refDate = dataReferencia ? new Date(dataReferencia + 'T00:00:00') : new Date();
  const doc = new jsPDF();
  const PW = doc.internal.pageSize.getWidth();

  // ── Capa ──────────────────────────────────────────────────────────────────
  doc.setFillColor(31, 81, 140);
  doc.rect(0, 0, PW, 55, 'F');

  try {
    const res = await fetch('/logo.png');
    if (res.ok) {
      const blob = await res.blob();
      const logoB64: string = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      doc.addImage(logoB64, 'PNG', (PW - 64) / 2, 6, 64, 18, undefined, 'FAST');
    }
  } catch (_) {
    doc.setFillColor(255, 255, 255);
    doc.circle(PW / 2, 15, 8, 'F');
    doc.setFillColor(31, 81, 140);
    doc.circle(PW / 2, 15, 5, 'F');
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16); doc.setFont(undefined, 'bold');
  doc.text('RELATÓRIO DA REDE DE PROTEÇÃO', PW / 2, 38, { align: 'center' });
  doc.setFontSize(10); doc.setFont(undefined, 'normal');
  doc.text('Secretaria das Mulheres do Estado do Ceará', PW / 2, 45, { align: 'center' });
  doc.text('Enfrentamento à Violência contra as Mulheres — EVM', PW / 2, 51, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9); doc.setTextColor(100, 100, 100);
  doc.text(
    `Data de referência: ${refDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}${regiaoFiltro ? ' | Região: ' + regiaoFiltro : ''}`,
    PW / 2, 62, { align: 'center' }
  );
  doc.setTextColor(0, 0, 0);

  // ── Categorias ────────────────────────────────────────────────────────────
  const cmb           = equipamentos.filter(e => e.tipo === 'Casa da Mulher Brasileira');
  const cmc           = equipamentos.filter(e => e.tipo === 'Casa da Mulher Cearense');
  const cmm           = equipamentos.filter(e => e.tipo === 'Casa da Mulher Municipal');
  const lilasMunicipal  = equipamentos.filter(e => e.tipo === 'Sala Lilás Municipal');
  const lilasEstado     = equipamentos.filter(e => e.tipo === 'Sala Lilás Governo do Estado');
  const lilasDelegacia  = equipamentos.filter(e => e.tipo === 'Sala Lilás em Delegacia');
  const ddm             = equipamentos.filter(e => e.tipo === 'DDM');
  const totalEquipamentos = cmb.length + cmc.length + cmm.length + lilasMunicipal.length + lilasEstado.length + lilasDelegacia.length + ddm.length;

  const municipiosComPatrulhaEquip = new Set(equipamentos.filter(e => e.possui_patrulha).map(e => e.municipio));
  const equipsComPatrulha = equipamentos.filter(e => e.possui_patrulha);
  const solicsComPatrulha = solicitacoes.filter(s => s.recebeu_patrulha && !municipiosComPatrulhaEquip.has(s.municipio));
  const totalPatrulhas    = equipsComPatrulha.length + solicsComPatrulha.length;
  const totalViaturasPMCE = viaturas.reduce((s, v) => s + v.quantidade, 0);
  const solicsAtivas      = solicitacoes.filter(s => s.status !== 'Cancelada' && s.status !== 'Inaugurada');

  // ── Resumo executivo ──────────────────────────────────────────────────────
  let y = 72;
  doc.setFontSize(12); doc.setFont(undefined, 'bold');
  doc.text('Resumo Executivo', 14, y);
  doc.setFont(undefined, 'normal');
  y += 2;
  doc.setDrawColor(31, 81, 140); doc.setLineWidth(0.5);
  doc.line(14, y, PW - 14, y);
  y += 6;

  const resumoItems: { label: string; valor: number; cor: [number,number,number] }[] = [
    { label: 'CMB — Casa da Mulher Brasileira',  valor: cmb.length,           cor: [13,148,136]  },
    { label: 'CMC — Casa da Mulher Cearense',    valor: cmc.length,           cor: [124,58,237]  },
    { label: 'CMM — Casa da Mulher Municipal',   valor: cmm.length,           cor: [234,88,12]   },
    { label: 'Salas Lilás Municipal',             valor: lilasMunicipal.length,  cor: [192,38,211]  },
    { label: 'Salas Lilás Gov. Estado',          valor: lilasEstado.length,     cor: [217,70,239]  },
    { label: 'Salas Lilás em Delegacia',         valor: lilasDelegacia.length,  cor: [240,171,252] },
    { label: 'DDM — Delegacia de Defesa da Mulher', valor: ddm.length,          cor: [21,128,61]   },
    { label: 'Qualificações realizadas',
      valor: (() => { const ms = new Set(equipamentos.map(e => e.municipio)); return equipamentos.filter(e => e.capacitacao_realizada).length + solicitacoes.filter(s => s.capacitacao_realizada && s.status !== 'Inaugurada' && s.status !== 'Cancelada' && !ms.has(s.municipio)).length; })(),
      cor: [16,185,129] },
    { label: 'Kit Athena entregues',
      valor: (() => { const ms = new Set(equipamentos.map(e => e.municipio)); return equipamentos.filter(e => e.kit_athena_entregue).length + solicitacoes.filter(s => s.kit_athena_entregue && s.status !== 'Inaugurada' && s.status !== 'Cancelada' && !ms.has(s.municipio)).length; })(),
      cor: [245,158,11] },
    { label: '  — dos quais via PréVio',
      valor: equipamentos.filter(e => e.kit_athena_previo).length + solicitacoes.filter(s => s.kit_athena_previo && s.status !== 'Inaugurada' && s.status !== 'Cancelada').length,
      cor: [251,191,36] },
    { label: 'Patrulhas Maria da Penha',         valor: totalPatrulhas,       cor: [6,182,212]   },
    { label: 'Viaturas PMCE',                    valor: totalViaturasPMCE,    cor: [99,102,241]  },
    { label: 'Solicitações em andamento',        valor: solicsAtivas.length,  cor: [251,146,60]  },
    { label: 'Total de Equipamentos',            valor: totalEquipamentos,    cor: [75,85,99]    },
  ];

  const cardW = (PW - 28 - 6) / 2;
  const cardH = 14;
  resumoItems.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx  = 14 + col * (cardW + 6);
    const cy  = y + row * (cardH + 4);
    doc.setFillColor(item.cor[0], item.cor[1], item.cor[2]);
    doc.roundedRect(cx, cy, 4, cardH, 1, 1, 'F');
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(cx + 4, cy, cardW - 4, cardH, 1, 1, 'F');
    doc.setFontSize(18); doc.setFont(undefined, 'bold');
    doc.setTextColor(item.cor[0], item.cor[1], item.cor[2]);
    doc.text(String(item.valor), cx + cardW - 6, cy + 10, { align: 'right' });
    doc.setFontSize(7.5); doc.setFont(undefined, 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(item.label, cx + 8, cy + 5.5);
    doc.setTextColor(0, 0, 0);
  });

  y += Math.ceil(resumoItems.length / 2) * (cardH + 4) + 8;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function addSecHeader(title: string, color: [number,number,number], yPos: number): number {
    if (yPos > 245) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); yPos = 30; }
    doc.setFillColor(color[0], color[1], color[2]);
    doc.roundedRect(14, yPos, PW - 28, 8, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont(undefined, 'bold');
    doc.text(title, 18, yPos + 5.5);
    doc.setTextColor(0, 0, 0); doc.setFont(undefined, 'normal');
    return yPos + 12;
  }

  function addNote(note: string, yPos: number): number {
    doc.setFontSize(7.5); doc.setTextColor(120, 120, 120); doc.setFont(undefined, 'italic');
    const lines = doc.splitTextToSize(note, PW - 28) as string[];
    doc.text(lines, 14, yPos);
    doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0);
    return yPos + lines.length * 4 + 3;
  }

  // ── tableEquip ────────────────────────────────────────────────────────────
  // Todas as tabelas de equipamentos usam as MESMAS larguras absolutas (182mm total).
  // A diferença entre variantes é apenas quais colunas de status aparecem no final.
  //
  // Variante A (semPatrulha + semKitAthena): CMB, CMC, DDM
  //   Município(40) | Região(28) | Endereço(72) | Responsável(42)  = 182mm
  // Variante B (semPatrulha, com Kit Athena): Salas Lilás
  //   Município(36) | Região(26) | Endereço(62) | Responsável(36) | Kit Athena(11) | Qualificação(11) = 182mm
  // Variante C (padrão, com Patrulha + Kit Athena): CMM
  //   Município(34) | Região(24) | Endereço(56) | Responsável(34) | Patrulha(11) | KitAthena(11) | Qualif(12) = 182mm
  //
  // No modoResumo a tabela é ainda mais compacta: só Município | Região | Endereço
  function tableEquip(
    items: Equipamento[],
    yPos: number,
    hColor: [number,number,number],
    solics?: Solicitacao[],
    opcoes?: { semPatrulha?: boolean; semKitAthena?: boolean },
  ): number {
    const semPatrulha  = opcoes?.semPatrulha  ?? false;
    const semKitAthena = opcoes?.semKitAthena ?? false;

    // Modo resumo: tabela mínima Município | Região | Endereço
    if (modoResumo) {
      if (items.length === 0) {
        doc.setFontSize(8); doc.setTextColor(150, 150, 150);
        doc.text('Nenhuma unidade em funcionamento.', 18, yPos);
        doc.setTextColor(0, 0, 0); return yPos + 8;
      }
      if (yPos > 240) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); yPos = 30; }
      autoTable(doc, {
        head: [['Município','Região','Endereço']],
        body: items.map(e => [e.municipio, getRegiao(e.municipio) || '—', e.endereco || '—']),
        startY: yPos,
        styles: { fontSize: 7, cellPadding: 2.5 },
        headStyles: { fillColor: hColor, textColor: [255,255,255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248,250,252] },
        columnStyles: { 0:{cellWidth:50},1:{cellWidth:42},2:{cellWidth:90} },
        margin: { left: 14, right: 14, top: 32 },
        didDrawPage: (d) => { if (d.pageNumber > 1) addPdfHeader(doc, 'Relatório EVM'); },
      });
      return (doc as any).lastAutoTable.finalY + 8;
    }

    // Modo completo
    const headEquip =
      semPatrulha && semKitAthena
        ? [['Município','Região','Endereço','Responsável']]
        : semPatrulha
        ? [['Município','Região','Endereço','Responsável','Kit Athena','Qualificação']]
        : [['Município','Região','Endereço','Responsável','Patrulha M.P.','Kit Athena','Qualificação']];

    // Larguras padronizadas: todas somam 182mm (margens left=14 right=14 em A4=210mm)
    // Colunas de status com mínimo 20mm para evitar quebra de linha
    const colEquip =
      semPatrulha && semKitAthena
        ? { 0:{cellWidth:40},1:{cellWidth:28},2:{cellWidth:72},3:{cellWidth:42} }
        : semPatrulha
        ? { 0:{cellWidth:34},1:{cellWidth:24},2:{cellWidth:56},3:{cellWidth:30},4:{cellWidth:19,halign:'center' as const},5:{cellWidth:19,halign:'center' as const} }
        : { 0:{cellWidth:30},1:{cellWidth:22},2:{cellWidth:44},3:{cellWidth:28},4:{cellWidth:19,halign:'center' as const},5:{cellWidth:20,halign:'center' as const},6:{cellWidth:19,halign:'center' as const} };

    const bodyEquip = (e: Equipamento) => {
      const base = [e.municipio, getRegiao(e.municipio) || '—', e.endereco || '—', e.responsavel || '—'];
      if (semPatrulha && semKitAthena) {
        return base;
      } else if (semPatrulha) {
        return [...base,
          e.kit_athena_entregue ? (e.kit_athena_previo ? 'Sim (PréVio)' : 'Sim') : 'Não',
          e.capacitacao_realizada ? 'Sim' : 'Não',
        ];
      } else {
        return [...base,
          e.possui_patrulha ? 'Sim' : 'Não',
          e.kit_athena_entregue ? (e.kit_athena_previo ? 'Sim (PréVio)' : 'Sim') : 'Não',
          e.capacitacao_realizada ? 'Sim' : 'Não',
        ];
      }
    };

    if (items.length > 0) {
      if (yPos > 240) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); yPos = 30; }
      doc.setFontSize(8); doc.setFont(undefined, 'bold'); doc.setTextColor(60, 60, 60);
      doc.text('Em funcionamento (' + items.length + ')', 14, yPos);
      doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0);
      yPos += 3;
      autoTable(doc, {
        head: headEquip,
        body: items.map(bodyEquip),
        startY: yPos,
        styles: { fontSize: 7, cellPadding: 2.5 },
        headStyles: { fillColor: hColor, textColor: [255,255,255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248,250,252] },
        columnStyles: colEquip,
        margin: { left: 14, right: 14, top: 32 },
        didDrawPage: (d) => { if (d.pageNumber > 1) addPdfHeader(doc, 'Relatório EVM'); },
      });
      yPos = (doc as any).lastAutoTable.finalY + 6;
    } else {
      doc.setFontSize(8); doc.setTextColor(150, 150, 150);
      doc.text('Nenhuma unidade em funcionamento.', 18, yPos);
      doc.setTextColor(0, 0, 0); yPos += 8;
    }

    // Solicitações só aparecem no modo completo
    if (!modoResumo && solics && solics.length > 0) {
      if (yPos > 240) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); yPos = 30; }
      doc.setFontSize(8); doc.setFont(undefined, 'bold'); doc.setTextColor(60, 60, 60);
      doc.text('Em andamento / Previstas (' + solics.length + ')', 14, yPos);
      doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0);
      yPos += 3;
      autoTable(doc, {
        head: [['Município','Região','Status','Data Solicitação','NUP','Patrulha','Kit Athena','Qualificação']],
        body: solics.map(s => [
          s.municipio, getRegiao(s.municipio) || '—', s.status,
          new Date(s.data_solicitacao + 'T00:00:00').toLocaleDateString('pt-BR'),
          s.nup || '—',
          s.recebeu_patrulha ? 'Sim' : 'Não',
          s.kit_athena_entregue ? 'Sim' : 'Não',
          s.capacitacao_realizada ? 'Sim' : 'Não',
        ]),
        startY: yPos,
        styles: { fontSize: 6.5, cellPadding: 2 },
        headStyles: { fillColor: [Math.round(hColor[0]*0.6), Math.round(hColor[1]*0.6), Math.round(hColor[2]*0.6)] as [number,number,number], textColor:[255,255,255], fontStyle:'bold' },
        alternateRowStyles: { fillColor: [252,252,248] },
        columnStyles: { 0:{cellWidth:35},1:{cellWidth:26},2:{cellWidth:22},3:{cellWidth:20},4:{cellWidth:22},5:{cellWidth:14,halign:'center' as const},6:{cellWidth:14,halign:'center' as const},7:{cellWidth:16,halign:'center' as const} },
        margin: { left: 14, right: 14, top: 32 },
        didDrawPage: (d) => { if (d.pageNumber > 1) addPdfHeader(doc, 'Relatório EVM'); },
      });
      yPos = (doc as any).lastAutoTable.finalY + 8;
    }
    return yPos;
  }

  // ── Seções ────────────────────────────────────────────────────────────────

  // 1. CMB — sem Patrulha, sem Kit Athena
  if (temSecao('cmb')) {
    if (y > 240) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); y = 30; }
    y = addSecHeader('1. Casa da Mulher Brasileira (CMB)', [13,148,136], y);
    y = tableEquip(cmb, y, [13,148,136],
      solicitacoes.filter(s => s.tipo_equipamento === 'Casa da Mulher Brasileira' && s.status !== 'Cancelada' && s.status !== 'Inaugurada'),
      { semPatrulha: true, semKitAthena: true });
  }

  // 2. CMC — sem Patrulha, sem Kit Athena
  if (temSecao('cmc')) {
    if (y > 240) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); y = 30; }
    y = addSecHeader('2. Casa da Mulher Cearense (CMC)', [124,58,237], y);
    y = tableEquip(cmc, y, [124,58,237],
      solicitacoes.filter(s => s.tipo_equipamento === 'Casa da Mulher Cearense' && s.status !== 'Cancelada' && s.status !== 'Inaugurada'),
      { semPatrulha: true, semKitAthena: true });
  }

  // 3. CMM — com Patrulha e Kit Athena (única com patrulha)
  if (temSecao('cmm')) {
    if (y > 240) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); y = 30; }
    y = addSecHeader('3. Casa da Mulher Municipal (CMM)', [234,88,12], y);
    y = tableEquip(cmm, y, [234,88,12],
      solicitacoes.filter(s => s.tipo_equipamento === 'Casa da Mulher Municipal' && s.status !== 'Cancelada' && s.status !== 'Inaugurada'));
  }

  // 4. Salas Lilás Municipal — sem Patrulha, com Kit Athena
  if (temSecao('lilasMunicipal')) {
    if (y > 240) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); y = 30; }
    y = addSecHeader('4. Salas Lilás Municipal', [192,38,211], y);
    y = tableEquip(lilasMunicipal, y, [192,38,211],
      solicitacoes.filter(s => s.tipo_equipamento === 'Sala Lilás Municipal' && s.status !== 'Cancelada' && s.status !== 'Inaugurada'),
      { semPatrulha: true });
  }

  // 5. Salas Lilás Estado — sem Patrulha, com Kit Athena
  if (temSecao('lilasEstado')) {
    if (y > 240) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); y = 30; }
    y = addSecHeader('5. Salas Lilás Governo do Estado', [232,121,249], y);
    y = tableEquip(lilasEstado, y, [232,121,249],
      solicitacoes.filter(s => s.tipo_equipamento === 'Sala Lilás Governo do Estado' && s.status !== 'Cancelada' && s.status !== 'Inaugurada'),
      { semPatrulha: true });
  }

  // 6. Salas Lilás Delegacia — sem Patrulha, com Kit Athena
  if (temSecao('lilasDelegacia')) {
    if (y > 240) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); y = 30; }
    y = addSecHeader('6. Salas Lilás em Delegacia', [240,171,252], y);
    y = tableEquip(lilasDelegacia, y, [240,171,252],
      solicitacoes.filter(s => s.tipo_equipamento === 'Sala Lilás em Delegacia' && s.status !== 'Cancelada' && s.status !== 'Inaugurada'),
      { semPatrulha: true });
  }

  // 7. DDM — sem Patrulha, sem Kit Athena
  if (temSecao('ddm')) {
    if (y > 240) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); y = 30; }
    y = addSecHeader('7. Delegacias de Defesa da Mulher (DDM)', [21,128,61], y);
    y = addNote('As DDMs são gerenciadas pela Polícia Civil do Ceará e não passam pelo fluxo de solicitações desta Secretaria.', y);
    y = tableEquip(ddm, y, [21,128,61], undefined, { semPatrulha: true, semKitAthena: true });
  }

  // 8. Patrulhas Maria da Penha
  if (temSecao('patrulha')) {
    if (y > 240) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); y = 30; }
    y = addSecHeader('8. Patrulhas Maria da Penha', [6,182,212], y);

    if (equipsComPatrulha.length > 0) {
      if (y > 240) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); y = 30; }
      doc.setFontSize(8); doc.setFont(undefined, 'bold'); doc.setTextColor(60, 60, 60);
      doc.text('Vinculadas a equipamentos (' + equipsComPatrulha.length + ')', 14, y);
      doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0); y += 3;
      autoTable(doc, {
        head: [['Município','Região','Equipamento','Endereço','Responsável']],
        body: equipsComPatrulha.map(e => [e.municipio, getRegiao(e.municipio)||'—', e.tipo, e.endereco||'—', e.responsavel||'—']),
        startY: y,
        styles: { fontSize: 7, cellPadding: 2.5 },
        headStyles: { fillColor: [6,182,212], textColor:[255,255,255], fontStyle:'bold' },
        alternateRowStyles: { fillColor: [240,253,254] },
        columnStyles: { 0:{cellWidth:38},1:{cellWidth:30},2:{cellWidth:45},3:{cellWidth:45},4:{cellWidth:25} },
        margin: { left: 14, right: 14, top: 32 },
        didDrawPage: (d) => { if (d.pageNumber > 1) addPdfHeader(doc, 'Relatório EVM'); },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    if (solicsComPatrulha.length > 0) {
      if (y > 240) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); y = 30; }
      doc.setFontSize(8); doc.setFont(undefined, 'bold'); doc.setTextColor(60, 60, 60);
      doc.text('Aguardando equipamento — já com patrulha (' + solicsComPatrulha.length + ')', 14, y);
      doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0); y += 3;
      autoTable(doc, {
        head: [['Município','Região','Tipo Solicitado','Status','Kit Athena','Qualificação']],
        body: solicsComPatrulha.map(s => [s.municipio, getRegiao(s.municipio)||'—', s.tipo_equipamento, s.status, s.kit_athena_entregue?'Sim':'Não', s.capacitacao_realizada?'Sim':'Não']),
        startY: y,
        styles: { fontSize: 7, cellPadding: 2.5 },
        headStyles: { fillColor: [8,145,178], textColor:[255,255,255], fontStyle:'bold' },
        alternateRowStyles: { fillColor: [240,253,254] },
        columnStyles: { 0:{cellWidth:38},1:{cellWidth:30},2:{cellWidth:42},3:{cellWidth:32},4:{cellWidth:20,halign:'center' as const},5:{cellWidth:20,halign:'center' as const} },
        margin: { left: 14, right: 14, top: 32 },
        didDrawPage: (d) => { if (d.pageNumber > 1) addPdfHeader(doc, 'Relatório EVM'); },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    if (totalPatrulhas === 0) {
      doc.setFontSize(8); doc.setTextColor(150, 150, 150);
      doc.text('Nenhuma Patrulha Maria da Penha cadastrada.', 18, y);
      doc.setTextColor(0, 0, 0);
    }
  }

  // 9. Viaturas PMCE
  if (temSecao('viaturas')) {
    if (y > 240) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); y = 30; }
    y = addSecHeader('9. Viaturas PMCE', [99,102,241], y);

    if (viaturas.length > 0) {
      autoTable(doc, {
        head: [['Município','Região','Tipo de Patrulha','Órgão','Qtd.','Vinc. Equipamento','Data Implantação']],
        body: viaturas.map(v => [v.municipio, getRegiao(v.municipio)||'—', v.tipo_patrulha, v.orgao_responsavel, String(v.quantidade), v.vinculada_equipamento ? '✓ Sim' : 'Não', new Date(v.data_implantacao + 'T00:00:00').toLocaleDateString('pt-BR')]),
        startY: y,
        styles: { fontSize: 7, cellPadding: 2.5 },
        headStyles: { fillColor: [99,102,241], textColor:[255,255,255], fontStyle:'bold' },
        alternateRowStyles: { fillColor: [245,245,255] },
        columnStyles: { 0:{cellWidth:35},1:{cellWidth:28},2:{cellWidth:35},3:{cellWidth:22},4:{cellWidth:10,halign:'center' as const},5:{cellWidth:22,halign:'center' as const},6:{cellWidth:24} },
        margin: { left: 14, right: 14, top: 32 },
        didDrawPage: (d) => { if (d.pageNumber > 1) addPdfHeader(doc, 'Relatório EVM'); },
        foot: [['Total','','','',String(totalViaturasPMCE),'','']],
        footStyles: { fillColor: [99,102,241], textColor:[255,255,255], fontStyle:'bold' },
      });
    } else {
      doc.setFontSize(8); doc.setTextColor(150, 150, 150);
      doc.text('Nenhuma viatura PMCE cadastrada.', 18, y);
      doc.setTextColor(0, 0, 0);
    }
  }

  // ── Página do Mapa ────────────────────────────────────────────────────────
  if (mapaImagem) {
    doc.addPage();
    const PW2 = doc.internal.pageSize.getWidth();
    const PH2 = doc.internal.pageSize.getHeight();
    doc.setFillColor(31, 81, 140);
    doc.rect(0, 0, PW2, 14, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont(undefined, 'bold');
    doc.text('Mapa de Cobertura — Estado do Ceará', PW2 / 2, 9, { align: 'center' });
    doc.setTextColor(0, 0, 0); doc.setFont(undefined, 'normal');
    const margin2 = 10;
    const topOffset = 18;
    const botOffset = 14;
    const availW2 = PW2 - margin2 * 2;
    const availH2 = PH2 - topOffset - botOffset;
    const aspect = mapaImagem.width / mapaImagem.height;
    let mW = availW2;
    let mH = mW / aspect;
    if (mH > availH2) { mH = availH2; mW = mH * aspect; }
    const mX = margin2 + (availW2 - mW) / 2;
    const mY = topOffset;
    doc.addImage(mapaImagem.dataUrl, 'PNG', mX, mY, mW, mH);
    const lgW = 56, lgItemH = 7;
    const legendItems2 = [
      { color: [13, 148, 136]  as [number,number,number], label: 'C.M. Brasileira'  },
      { color: [124, 58, 237]  as [number,number,number], label: 'C.M. Cearense'    },
      { color: [234, 88, 12]   as [number,number,number], label: 'C.M. Municipal'   },
      { color: [217, 70, 239]  as [number,number,number], label: 'Sala Lilás Municipal' },
      { color: [21, 128, 61]   as [number,number,number], label: 'DDM'              },
      { color: [74, 222, 128]  as [number,number,number], label: 'Sala Lilás em Delegacia' },
      { color: [6, 182, 212]   as [number,number,number], label: 'Só Viatura'       },
      { color: [229, 231, 235] as [number,number,number], label: 'Sem Cobertura'    },
    ];
    const lgH2 = 10 + legendItems2.length * lgItemH;
    const lgX2 = mX + mW - lgW - 3;
    const lgY2 = mY + mH - lgH2 - 3;
    doc.setFillColor(255, 255, 255); doc.setDrawColor(180, 180, 180);
    doc.roundedRect(lgX2, lgY2, lgW, lgH2, 2, 2, 'FD');
    doc.setFontSize(6.5); doc.setFont(undefined, 'bold'); doc.setTextColor(0, 0, 0);
    doc.text('Legenda', lgX2 + 3, lgY2 + 5.5); doc.setFont(undefined, 'normal');
    legendItems2.forEach((item, i) => {
      const ly = lgY2 + 10 + i * lgItemH;
      doc.setFillColor(...item.color);
      doc.rect(lgX2 + 3, ly - 2.5, 3.5, 3.5, 'F');
      doc.setTextColor(0, 0, 0);
      doc.text(item.label, lgX2 + 9, ly);
    });
    doc.setFontSize(7); doc.setTextColor(120, 120, 120);
    doc.text('Imagem capturada da página Mapa do sistema EVM', PW2 / 2, PH2 - 6, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }

  addPdfFooters(doc);
  doc.save((modoResumo ? 'relatorio-evm-resumo_' : 'relatorio-evm_') + ts() + '.pdf');
}
// ─────────────────────────────────────────────────────────────────────────────
// DIAGNÓSTICO DE PENDÊNCIAS
// ─────────────────────────────────────────────────────────────────────────────

const TIPOS_COM_PATRULHA = new Set(['Casa da Mulher Municipal']);
const TIPOS_SEM_KIT = new Set(['Casa da Mulher Brasileira', 'Casa da Mulher Cearense', 'DDM']);

export interface DiagnosticoFiltros {
  regiaoFiltro?: string;
  diasSemMovimento?: number; // default: 60
}

interface PendenciaMunicipio {
  municipio: string;
  regiao: string;
  tipo: string;
  pendencias: string[];
  origem: 'Equipamento' | 'Solicitação';
  status?: string;
  diasSemMovimento?: number;
}

export function gerarDiagnostico(
  equipamentos: Equipamento[],
  solicitacoes: Solicitacao[],
  filtros: DiagnosticoFiltros = {}
): PendenciaMunicipio[] {
  const { regiaoFiltro, diasSemMovimento = 60 } = filtros;
  const hoje = new Date();
  const resultado: PendenciaMunicipio[] = [];

  const equips = regiaoFiltro
    ? equipamentos.filter(e => getRegiao(e.municipio) === regiaoFiltro)
    : equipamentos;

  equips.forEach(e => {
    const pendencias: string[] = [];
    if (TIPOS_COM_PATRULHA.has(e.tipo) && !e.possui_patrulha)  pendencias.push('Sem Patrulha M.P.');
    if (!TIPOS_SEM_KIT.has(e.tipo) && !e.kit_athena_entregue)  pendencias.push('Sem Kit Athena');
    if (!e.capacitacao_realizada)                               pendencias.push('Sem Qualificação');
    if (pendencias.length > 0) {
      resultado.push({
        municipio: e.municipio,
        regiao:    getRegiao(e.municipio) || '—',
        tipo:      e.tipo,
        pendencias,
        origem:    'Equipamento',
      });
    }
  });

  const solics = regiaoFiltro
    ? solicitacoes.filter(s => getRegiao(s.municipio) === regiaoFiltro)
    : solicitacoes;

  solics
    .filter(s => s.status !== 'Cancelada' && s.status !== 'Inaugurada')
    .forEach(s => {
      const dataRef = new Date(((s as any).updated_at || s.data_solicitacao) + 'T00:00:00');
      const dias    = Math.floor((hoje.getTime() - dataRef.getTime()) / 86_400_000);
      const pendencias: string[] = [];
      if (dias >= diasSemMovimento) pendencias.push(`Parada há ${dias} dias`);
      if (!s.nup)                   pendencias.push('Sem NUP registrado');
      if (pendencias.length > 0) {
        resultado.push({
          municipio:        s.municipio,
          regiao:           getRegiao(s.municipio) || '—',
          tipo:             s.tipo_equipamento,
          pendencias,
          origem:           'Solicitação',
          status:           s.status,
          diasSemMovimento: dias,
        });
      }
    });

  return resultado.sort(
    (a, b) =>
      a.regiao.localeCompare(b.regiao, 'pt-BR') ||
      a.municipio.localeCompare(b.municipio, 'pt-BR')
  );
}

export function exportDiagnosticoToPDF(
  equipamentos: Equipamento[],
  solicitacoes: Solicitacao[],
  filtros: DiagnosticoFiltros = {}
): void {
  const pendencias = gerarDiagnostico(equipamentos, solicitacoes, filtros);
  const doc = new jsPDF();
  const PW  = doc.internal.pageSize.getWidth();
  const PH  = doc.internal.pageSize.getHeight();

  const checkPage = (y: number, threshold = 230): number => {
    if (y > threshold) {
      doc.addPage();
      return addPdfHeader(doc, 'Diagnóstico EVM');
    }
    return y;
  };

  let y = addPdfHeader(doc, 'Diagnóstico EVM', 'Diagnóstico de Pendências por Município');

  doc.setFontSize(8); doc.setTextColor(100, 100, 100);
  doc.text(
    [
      filtros.regiaoFiltro ? `Região: ${filtros.regiaoFiltro}` : 'Todas as regiões',
      `Solicitações paradas há +${filtros.diasSemMovimento ?? 60} dias`,
      `Gerado em: ${new Date().toLocaleDateString('pt-BR')}`,
    ].join('  |  '),
    14, y
  );
  doc.setTextColor(0, 0, 0);
  y += 7;

  // ── Sem pendências ────────────────────────────────────────────────────────
  if (pendencias.length === 0) {
    doc.setFontSize(12); doc.setTextColor(16, 185, 129);
    doc.text('✓ Nenhuma pendência identificada para os filtros aplicados.', 14, y + 10);
    addPdfFooters(doc);
    doc.save(`diagnostico-evm_${ts()}.pdf`);
    return;
  }

  // ── Resumo por tipo de pendência ──────────────────────────────────────────
  const contPorTipo: Record<string, number> = {};
  pendencias.forEach(p => p.pendencias.forEach(pen => {
    contPorTipo[pen] = (contPorTipo[pen] || 0) + 1;
  }));

  doc.setFontSize(10); doc.setFont(undefined, 'bold');
  doc.text('Resumo das Pendências', 14, y);
  doc.setFont(undefined, 'normal');
  y += 3;
  doc.setDrawColor(239, 68, 68); doc.setLineWidth(0.4);
  doc.line(14, y, PW - 14, y);
  y += 5;

  const cardW = (PW - 28 - 6) / 2;
  const coresCard: [number, number, number][] = [
    [239,68,68],[245,158,11],[234,88,12],[124,58,237],[6,182,212],[21,128,61],
  ];
  const tiposOrdenados = Object.entries(contPorTipo).sort((a, b) => b[1] - a[1]);
  tiposOrdenados.forEach(([pen, cnt], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const cx  = 14 + col * (cardW + 6);
    const cy  = y + row * 18;
    const cor = coresCard[i % coresCard.length];
    doc.setFillColor(...cor); doc.roundedRect(cx, cy, 4, 14, 1, 1, 'F');
    doc.setFillColor(255, 245, 245); doc.roundedRect(cx + 4, cy, cardW - 4, 14, 1, 1, 'F');
    doc.setFontSize(16); doc.setFont(undefined, 'bold'); doc.setTextColor(...cor);
    doc.text(String(cnt), cx + cardW - 6, cy + 10, { align: 'right' });
    doc.setFontSize(7); doc.setFont(undefined, 'normal'); doc.setTextColor(60, 60, 60);
    doc.text(pen, cx + 8, cy + 5.5);
    doc.setTextColor(0, 0, 0);
  });
  y += Math.ceil(tiposOrdenados.length / 2) * 18 + 8;

  // ── Tabelas por região ────────────────────────────────────────────────────
  const regioes = Array.from(new Set(pendencias.map(p => p.regiao))).sort();

  regioes.forEach(regiao => {
    const grupo     = pendencias.filter(p => p.regiao === regiao);
    const grpEquips = grupo.filter(p => p.origem === 'Equipamento');
    const grpSolics = grupo.filter(p => p.origem === 'Solicitação');

    y = checkPage(y, 200);

    // Header da região
    doc.setFillColor(239, 68, 68);
    doc.roundedRect(14, y, PW - 28, 7, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont(undefined, 'bold');
    doc.text(`${regiao}  (${grupo.length} ocorrência${grupo.length !== 1 ? 's' : ''})`, 18, y + 5);
    doc.setTextColor(0, 0, 0); doc.setFont(undefined, 'normal');
    y += 10;

    if (grpEquips.length > 0) {
      y = checkPage(y, 230);
      doc.setFontSize(7.5); doc.setFont(undefined, 'bold'); doc.setTextColor(60, 60, 60);
      doc.text(`Equipamentos em funcionamento — ${grpEquips.length} pendência(s)`, 16, y);
      doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0); y += 3;
      autoTable(doc, {
        head: [['Município', 'Tipo de Equipamento', 'Pendências']],
        body: grpEquips.map(p => [p.municipio, p.tipo, p.pendencias.join(' · ')]),
        startY: y,
        styles: { fontSize: 7, cellPadding: 2.5 },
        headStyles: { fillColor: [239,68,68], textColor: [255,255,255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [255,245,245] },
        columnStyles: { 0:{cellWidth:42}, 1:{cellWidth:52}, 2:{cellWidth:88} },
        margin: { left: 14, right: 14, top: 32 },
        didDrawPage: () => { addPdfHeader(doc, 'Diagnóstico EVM'); },
      });
      y = (doc as any).lastAutoTable.finalY + 5;
    }

    if (grpSolics.length > 0) {
      y = checkPage(y, 230);
      doc.setFontSize(7.5); doc.setFont(undefined, 'bold'); doc.setTextColor(60, 60, 60);
      doc.text(`Solicitações em andamento — ${grpSolics.length} alerta(s)`, 16, y);
      doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0); y += 3;
      autoTable(doc, {
        head: [['Município', 'Tipo', 'Status', 'Alertas']],
        body: grpSolics.map(p => [p.municipio, p.tipo, p.status || '—', p.pendencias.join(' · ')]),
        startY: y,
        styles: { fontSize: 7, cellPadding: 2.5 },
        headStyles: { fillColor: [245,158,11], textColor: [255,255,255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [255,251,235] },
        columnStyles: { 0:{cellWidth:42}, 1:{cellWidth:52}, 2:{cellWidth:30}, 3:{cellWidth:58} },
        margin: { left: 14, right: 14, top: 32 },
        didDrawPage: () => { addPdfHeader(doc, 'Diagnóstico EVM'); },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }
  });

  addPdfFooters(doc);
  doc.save(`diagnostico-evm_${ts()}.pdf`);
}