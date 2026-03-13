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

// ── ITEM 2: helper lastY() elimina todos os (doc as any).lastAutoTable.finalY ──
/** Retorna o finalY da última autoTable renderizada */
function lastY(doc: jsPDF): number {
  return (doc as any).lastAutoTable.finalY as number;
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
    currentY = lastY(doc) + 10;
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
    currentY = lastY(doc) + 10;
  }

  const regionSolicitacoes = solicitacoes.filter(s => getRegiao(s.municipio) === regionStats.regiao);
  if (regionSolicitacoes.length > 0) {
    if (currentY > 200) { doc.addPage(); currentY = 22; }
    doc.setFontSize(12);
    doc.text('Solicitações:', 14, currentY);
    autoTable(doc, {
      head: [['Município', 'Tipo', 'Status', 'Data']],
      body: regionSolicitacoes.map(s => [s.municipio, s.tipo_equipamento, s.status, fmtDate(s.data_solicitacao)]),
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
      currentY = lastY(doc) + 8;
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
      currentY = lastY(doc) + 8;
    }

    const regionSolicitacoes = solicitacoes.filter(s => getRegiao(s.municipio) === region.regiao);
    if (regionSolicitacoes.length > 0) {
      if (currentY > 220) { doc.addPage(); currentY = 22; }
      doc.setFontSize(11);
      doc.text('Solicitações:', 14, currentY);
      autoTable(doc, {
        head: [['Município', 'Tipo', 'Status', 'Data']],
        body: regionSolicitacoes.map(s => [s.municipio, s.tipo_equipamento, s.status, fmtDate(s.data_solicitacao)]),
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
    'Data de Implantação': fmtDate(v.data_implantacao),
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
    'Data da Solicitação': fmtDate(s.data_solicitacao),
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
    ...patrulhasEquip.map(e => ({ 'Município': e.municipio, 'Região': getRegiao(e.municipio) || '', 'Tipo de Equipamento': e.tipo, 'Origem': 'Equipamento', 'Status': '-', 'Endereço': e.endereco || '', 'Responsável': e.responsavel || '', 'Telefone': e.telefone || '', 'Observações': e.observacoes || '', 'Data de Criação': fmtDate(e.created_at) })),
    ...patrulhasSolic.map(s => ({ 'Município': s.municipio, 'Região': getRegiao(s.municipio) || '', 'Tipo de Equipamento': s.tipo_equipamento, 'Origem': 'Solicitação', 'Status': s.status, 'Endereço': '', 'Responsável': '', 'Telefone': '', 'Observações': s.observacoes || '', 'Data de Criação': fmtDate(s.created_at) })),
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

export function exportEquipamentosToExcel(equipamentos: Equipamento[], qualificacoes?: QualificacaoExport[]) {
  const qualMap = new Map(qualificacoes?.map(q => [q.id, q.nome]) ?? []);
  const data = equipamentos.map(e => ({
    'Município':          e.municipio,
    'Região':             getRegiao(e.municipio) || '',
    'Tipo':               e.tipo,
    'Patrulha M.P.':      e.possui_patrulha ? 'Sim' : 'Não',
    'Kit Athena':         e.kit_athena_entregue ? 'Sim' : 'Não',
    'Kit Athena (Prévio)':e.kit_athena_previo  ? 'Sim' : 'Não',
    'Capacitação':        e.capacitacao_realizada ? 'Sim' : 'Não',
    'Curso Vinculado':    e.qualificacao_id ? (qualMap.get(e.qualificacao_id) ?? e.qualificacao_id) : '',
    'NUP':                e.nup || '',
    'Endereço':           e.endereco || '',
    'Responsável':        e.responsavel || '',
    'Telefone':           e.telefone || '',
    'Observações':        e.observacoes || '',
    'Data de Criação':    fmtDate(e.created_at),
  }));
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
    body: viaturas.map(v => [v.municipio, getRegiao(v.municipio) || '-', v.orgao_responsavel, v.quantidade.toString(), fmtDate(v.data_implantacao), v.vinculada_equipamento ? 'Sim' : 'Não', v.responsavel || '-']),
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
    body: solicitacoes.map(s => [s.municipio, getRegiao(s.municipio) || '-', s.tipo_equipamento, s.status, fmtDate(s.data_solicitacao), s.nup || '-', s.guarda_municipal_estruturada ? 'Sim' : 'Não', s.recebeu_patrulha ? 'Sim' : 'Não', s.kit_athena_entregue ? 'Sim' : 'Não', s.capacitacao_realizada ? 'Sim' : 'Não']),
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
      body: atividades.map(a => [a.municipio, a.municipio_sede, a.tipo, a.recurso, fmtDate(a.data), a.status, a.atendimentos?.toString() || '-']),
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
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(equipamentos.map(e => ({ 'Município': e.municipio, 'Região': getRegiao(e.municipio) || '', 'Tipo': e.tipo, 'Patrulha M.P.': e.possui_patrulha ? 'Sim' : 'Não', 'Endereço': e.endereco || '', 'Responsável': e.responsavel || '', 'Telefone': e.telefone || '', 'Observações': e.observacoes || '', 'Data Criação': fmtDate(e.created_at) }))), 'Equipamentos');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(viaturas.map(v => ({ 'Município': v.municipio, 'Região': getRegiao(v.municipio) || '', 'Tipo de Patrulha': v.tipo_patrulha, 'Órgão Responsável': v.orgao_responsavel, 'Quantidade': v.quantidade, 'Vinculada a Equipamento': v.vinculada_equipamento ? 'Sim' : 'Não', 'Data de Implantação': fmtDate(v.data_implantacao), 'Responsável': v.responsavel || '', 'Observações': v.observacoes || '' }))), 'Viaturas PMCE');
  const patrulhasEquip = equipamentos.filter(e => e.possui_patrulha);
  const municipiosComPatrulhaEquip = new Set(patrulhasEquip.map(e => e.municipio));
  const patrulhasSolic = solicitacoes.filter(s => s.recebeu_patrulha && !municipiosComPatrulhaEquip.has(s.municipio));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([...patrulhasEquip.map(e => ({ 'Município': e.municipio, 'Região': getRegiao(e.municipio) || '', 'Tipo de Equipamento': e.tipo, 'Origem': 'Equipamento', 'Status': '-', 'Endereço': e.endereco || '', 'Responsável': e.responsavel || '', 'Telefone': e.telefone || '', 'Kit Athena': e.kit_athena_entregue ? 'Sim' : 'Não', 'Qualificação': e.capacitacao_realizada ? 'Sim' : 'Não', 'NUP': e.nup || '', 'Observações': e.observacoes || '', 'Data Criação': fmtDate(e.created_at) })), ...patrulhasSolic.map(s => ({ 'Município': s.municipio, 'Região': getRegiao(s.municipio) || '', 'Tipo de Equipamento': s.tipo_equipamento, 'Origem': 'Solicitação', 'Status': s.status, 'Endereço': '', 'Responsável': '', 'Telefone': '', 'Observações': s.observacoes || '', 'Data Criação': fmtDate(s.created_at) }))]), 'Patrulhas Casas');
  const lilasMunicipalEquip  = equipamentos.filter(e => e.tipo === 'Sala Lilás Municipal');
  const lilasEstadoEquip     = equipamentos.filter(e => e.tipo === 'Sala Lilás Governo do Estado');
  const lilasDelegaciaEquip  = equipamentos.filter(e => e.tipo === 'Sala Lilás em Delegacia');
  const toEquipRow = (e: typeof equipamentos[0]) => ({ 'Município': e.municipio, 'Região': getRegiao(e.municipio) || '', 'Tipo': e.tipo, 'Endereço': e.endereco || '', 'Responsável': e.responsavel || '', 'Telefone': e.telefone || '', 'Kit Athena': e.kit_athena_entregue ? 'Sim' : 'Não', 'Qualificação': e.capacitacao_realizada ? 'Sim' : 'Não', 'NUP': e.nup || '', 'Observações': e.observacoes || '' });
  if (lilasMunicipalEquip.length)  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lilasMunicipalEquip.map(toEquipRow)),  'Salas Lilás Municipal');
  if (lilasEstadoEquip.length)     XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lilasEstadoEquip.map(toEquipRow)),    'Salas Lilás Estado');
  if (lilasDelegaciaEquip.length)  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lilasDelegaciaEquip.map(toEquipRow)), 'Salas Lilás Delegacia');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(solicitacoes.map(s => ({ 'Município': s.municipio, 'Região': getRegiao(s.municipio) || '', 'Tipo de Equipamento': s.tipo_equipamento, 'Status': s.status, 'Data da Solicitação': fmtDate(s.data_solicitacao), 'NUP': s.nup || '', 'Guarda Municipal Estruturada': s.guarda_municipal_estruturada ? 'Sim' : 'Não', 'Recebeu Patrulha': s.recebeu_patrulha ? 'Sim' : 'Não', 'Kit Athena Entregue': s.kit_athena_entregue ? 'Sim' : 'Não', 'Qualificação Realizada': s.capacitacao_realizada ? 'Sim' : 'Não', 'Observações': s.observacoes || '' }))), 'Solicitações');
  if (atividades.length > 0) {
    const atividadesWs = XLSX.utils.json_to_sheet(atividades.map(a => ({
      'Município': a.municipio, 'Sede (CMB/CMC)': a.municipio_sede,
      'Região': getRegiao(a.municipio) || '',
      'Tipo': a.tipo, 'Recurso': a.recurso,
      'Status': a.status,
      'Data': fmtDate(a.data),
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
  const scale = highResolution ? 3 : 2;
  const W = 900;
  const H = 600;

  // Cria um iframe oculto para renderizar o mapa isolado do layout principal
  // Alternativa: copia o canvas do Leaflet diretamente
  // O Leaflet renderiza polígonos num SVG e tiles num layer de <img> com CORS
  // Vamos compor manualmente: fundo neutro + SVG dos polígonos

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width  = W * scale;
  outputCanvas.height = H * scale;
  const ctx = outputCanvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // Fundo cor dos tiles OSM (bege claro)
  ctx.fillStyle = '#f0ede8';
  ctx.fillRect(0, 0, W, H);

  // Pega o bounding rect do elemento mapa para calcular offsets
  const mapRect = mapElement.getBoundingClientRect();

  // Coleta todos os SVGs do Leaflet (polígonos GeoJSON)
  const svgs = mapElement.querySelectorAll<SVGSVGElement>('svg');
  const promises: Promise<void>[] = [];

  svgs.forEach(svg => {
    const svgRect = svg.getBoundingClientRect();
    const dx = svgRect.left - mapRect.left;
    const dy = svgRect.top  - mapRect.top;
    const sw = svgRect.width  || svg.viewBox?.baseVal?.width  || W;
    const sh = svgRect.height || svg.viewBox?.baseVal?.height || H;

    // Clona o SVG e aplica estilos inline dos paths
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width',  String(sw));
    clone.setAttribute('height', String(sh));

    const origPaths  = svg.querySelectorAll<SVGPathElement>('path');
    const clonePaths = clone.querySelectorAll<SVGPathElement>('path');
    origPaths.forEach((orig, i) => {
      const cp = clonePaths[i];
      if (!cp) return;
      const cs = window.getComputedStyle(orig);
      const fill   = orig.style.fill   || cs.fill   || orig.getAttribute('fill')         || 'transparent';
      const stroke = orig.style.stroke || cs.stroke || orig.getAttribute('stroke')       || '#666';
      const fo     = orig.style.fillOpacity || orig.getAttribute('fill-opacity') || '0.85';
      const sw2    = orig.style.strokeWidth || orig.getAttribute('stroke-width') || '0.5';
      cp.setAttribute('fill',         fill);
      cp.setAttribute('stroke',       stroke);
      cp.setAttribute('fill-opacity', fo);
      cp.setAttribute('stroke-width', sw2);
      // Remove classes que referenciam estilos externos
      cp.removeAttribute('class');
    });

    const serialized = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
    const url  = URL.createObjectURL(blob);

    promises.push(new Promise<void>(resolve => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, dx, dy, sw, sh);
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      img.src = url;
    }));
  });

  await Promise.all(promises);

  return {
    dataUrl: outputCanvas.toDataURL('image/png', 1.0),
    width:   outputCanvas.width,
    height:  outputCanvas.height,
  };
}



/**
 * Desenha uma página de mapa vetorial no doc jsPDF existente.
 * Reutilizável tanto no export standalone quanto no Relatório EVM.
 */
function drawVectorMapPage(
  doc: jsPDF,
  geoJsonData: any,
  municipioColors: Map<string, string>,
  stats: MapExportStats,
  equipmentCounts: MapEquipmentCounts,
  normalizeFn: (nome: string) => string,
  totalComEquipamento: number,
) {
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();

  // Cabeçalho
  doc.setFillColor(31, 81, 140);
  doc.rect(0, 0, PW, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10); doc.setFont(undefined, 'bold');
  doc.text('Mapa de Cobertura — Estado do Ceará', PW / 2, 9, { align: 'center' });
  doc.setTextColor(0, 0, 0); doc.setFont(undefined, 'normal');

  const MAP_MARGIN = 8;
  const LEGEND_W   = 70;
  const mapX = MAP_MARGIN;
  const mapY = 18;
  const mapW = PW - MAP_MARGIN * 2 - LEGEND_W - 4;
  const mapH = PH - mapY - 16;

  // Fundo
  doc.setFillColor(210, 230, 245);
  doc.rect(mapX, mapY, mapW, mapH, 'F');
  doc.setDrawColor(180, 180, 180);
  doc.rect(mapX, mapY, mapW, mapH, 'S');

  // Bounding box do GeoJSON
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  if (geoJsonData?.features) {
    geoJsonData.features.forEach((f: any) => {
      const coords = f.geometry?.type === 'MultiPolygon'
        ? f.geometry.coordinates.flat(2)
        : f.geometry?.coordinates?.flat?.(1) ?? [];
      coords.forEach(([lon, lat]: number[]) => {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      });
    });
  }

  const lonRange = maxLon - minLon || 1;
  const latRange = maxLat - minLat || 1;
  const pad = 4;

  // Preserva o aspect ratio geográfico — não estica o mapa para preencher a área
  // O Ceará tem proporção estreita/alta (~lon:lat ≈ 1:2.2), então limitamos pelo eixo mais restritivo
  const availW = mapW - pad * 2;
  const availH = mapH - pad * 2;
  const geoAspect = lonRange / latRange;   // largura / altura em graus
  let drawW: number, drawH: number;
  if (availW / availH > geoAspect) {
    // Limitado pela altura — centraliza horizontalmente
    drawH = availH;
    drawW = drawH * geoAspect;
  } else {
    // Limitado pela largura — centraliza verticalmente
    drawW = availW;
    drawH = drawW / geoAspect;
  }
  const offsetX = (availW - drawW) / 2;
  const offsetY = (availH - drawH) / 2;

  const project = (lon: number, lat: number): [number, number] => [
    mapX + pad + offsetX + ((lon - minLon) / lonRange) * drawW,
    mapY + pad + offsetY + ((maxLat - lat) / latRange) * drawH,
  ];

  const drawPolygon = (ring: number[][]) => {
    if (ring.length < 3) return;
    const pts = ring.map(([lon, lat]) => project(lon, lat));
    doc.lines(
      pts.slice(1).map(([x2, y2], i) => {
        const [x1, y1] = pts[i];
        return [x2 - x1, y2 - y1] as [number, number];
      }),
      pts[0][0], pts[0][1],
      [1, 1], 'FD', true
    );
  };

  if (geoJsonData?.features) {
    geoJsonData.features.forEach((feature: any) => {
      const hex = municipioColors.get(normalizeFn(feature.properties?.name ?? '')) ?? '#e5e7eb';
      doc.setFillColor(parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16));
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.2);
      if (feature.geometry?.type === 'Polygon') {
        feature.geometry.coordinates.forEach((ring: number[][]) => drawPolygon(ring));
      } else if (feature.geometry?.type === 'MultiPolygon') {
        feature.geometry.coordinates.forEach((poly: number[][][]) =>
          poly.forEach((ring: number[][]) => drawPolygon(ring))
        );
      }
    });
  }

  // Legenda
  const legendColors: [number,number,number][] = [
    [13,148,136],[124,58,237],[234,88,12],[192,38,211],[232,121,249],[240,171,252],[21,128,61],[6,182,212],[229,231,235]
  ];
  const lgX = mapX + mapW + 4;
  const lgY = mapY;
  const lgW = LEGEND_W;
  doc.setFillColor(255,255,255); doc.setDrawColor(200,200,200);
  doc.roundedRect(lgX, lgY, lgW, mapH, 2, 2, 'FD');
  doc.setFontSize(7); doc.setFont(undefined, 'bold');
  doc.text('LEGENDA', lgX + 3, lgY + 7);
  doc.setFont(undefined, 'normal');
  const lgItems = [
    { color: legendColors[0], label: 'C.M. Brasileira',         count: equipmentCounts.brasileira },
    { color: legendColors[1], label: 'C.M. Cearense',           count: equipmentCounts.cearense },
    { color: legendColors[2], label: 'C.M. Municipal',          count: equipmentCounts.municipal },
    { color: legendColors[3], label: 'Sala Lilás Municipal',    count: equipmentCounts.lilasMunicipal },
    { color: legendColors[4], label: 'Sala Lilás Gov.Estado',   count: equipmentCounts.lilasEstado },
    { color: legendColors[5], label: 'Sala Lilás Delegacia',    count: equipmentCounts.lilasDelegacia },
    { color: legendColors[6], label: 'DDM',                     count: equipmentCounts.ddm },
    { color: legendColors[7], label: 'Só Viatura',              count: stats.viaturaOnly },
    { color: legendColors[8], label: 'Sem Cobertura',           count: stats.semCobertura },
  ];
  lgItems.forEach((item, i) => {
    const ly = lgY + 13 + i * 9;
    doc.setFillColor(...item.color); doc.rect(lgX+3, ly-3, 4, 4, 'F');
    doc.setDrawColor(180,180,180); doc.rect(lgX+3, ly-3, 4, 4, 'S');
    doc.setTextColor(0,0,0); doc.setFontSize(6.5);
    doc.text(item.label, lgX+9, ly);
    doc.setFont(undefined,'bold');
    doc.text(String(item.count), lgX+lgW-6, ly, { align: 'right' });
    doc.setFont(undefined,'normal');
  });
  const covLy = lgY + 13 + lgItems.length * 9 + 4;
  doc.setDrawColor(200,200,200);
  doc.line(lgX+3, covLy-3, lgX+lgW-3, covLy-3);
  doc.setFontSize(7); doc.setFont(undefined,'bold');
  doc.text('Cobertura:', lgX+3, covLy+2);
  doc.text(`${(totalComEquipamento/184*100).toFixed(1)}%`, lgX+3, covLy+8);
  doc.setFont(undefined,'normal'); doc.setFontSize(6);
  doc.text(`${totalComEquipamento}/184 municípios`, lgX+3, covLy+13);

  doc.setFontSize(6); doc.setTextColor(120,120,120);
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} — EVM Ceará`, PW/2, PH-4, { align: 'center' });
  doc.setTextColor(0,0,0);
}

/**
 * Exporta o mapa do Ceará diretamente no jsPDF desenhando os polígonos GeoJSON —
 * sem html2canvas, sem captura de tela, funciona independente de scroll/modal.
 */
export async function exportMapToPDFDirect(
  geoJsonData: any,
  municipioColors: Map<string, string>,  // normalizedName → hexColor
  filters: MapExportFilters,
  stats: MapExportStats,
  equipmentCounts: MapEquipmentCounts,
  normalizeFn: (nome: string) => string,
) {
  const doc = new jsPDF('landscape');
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const totalComEquipamento = stats.brasileira + stats.cearense + stats.municipal
    + stats.lilasMunicipal + stats.lilasEstado + stats.lilasDelegacia + stats.ddm;

  // ── Página 1: cabeçalho + estatísticas ──────────────────────────────────────
  doc.setFillColor(31, 81, 140);
  doc.rect(0, 0, PW, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12); doc.setFont(undefined, 'bold');
  doc.text('Mapa do Ceará — EVM', 14, 10);
  doc.setFontSize(8); doc.setFont(undefined, 'normal');
  doc.text('Enfrentamento à Violência contra as Mulheres', 14, 14);
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(9); doc.setFont(undefined, 'bold');
  doc.text('Filtros Aplicados', 14, 26); doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  doc.text(`Região: ${filters.regiao && filters.regiao !== 'all' ? filters.regiao : 'Todas'}`, 14, 33);
  doc.text(`Tipo: ${filters.tipoEquipamento === 'all' ? 'Todos' : filters.tipoEquipamento}`, 14, 38);
  doc.text(`Status solicitação: ${filters.statusSolicitacao === 'all' ? 'Todos' : filters.statusSolicitacao}`, 14, 43);
  doc.text(`Apenas com viatura: ${filters.apenasComViatura ? 'Sim' : 'Não'}`, 14, 48);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 53);

  doc.setFontSize(9); doc.setFont(undefined, 'bold');
  doc.text('Estatísticas de Cobertura', 14, 63); doc.setFont(undefined, 'normal');
  const statRows = [
    ['Casa da Mulher Brasileira', equipmentCounts.brasileira],
    ['Casa da Mulher Cearense', equipmentCounts.cearense],
    ['Casa da Mulher Municipal', equipmentCounts.municipal],
    ['Sala Lilás Municipal', equipmentCounts.lilasMunicipal],
    ['Sala Lilás Gov. Estado', equipmentCounts.lilasEstado],
    ['Sala Lilás em Delegacia', equipmentCounts.lilasDelegacia],
    ['DDM', equipmentCounts.ddm],
    ['Só Viatura', stats.viaturaOnly],
    ['Sem Cobertura', stats.semCobertura],
  ] as [string, number][];
  const legendColors: [number,number,number][] = [
    [13,148,136],[124,58,237],[234,88,12],[192,38,211],[232,121,249],[240,171,252],[21,128,61],[6,182,212],[229,231,235]
  ];
  statRows.forEach(([label, count], i) => {
    const y = 70 + i * 8;
    doc.setFillColor(...legendColors[i]);
    doc.rect(14, y - 3, 4, 4, 'F');
    doc.setFontSize(8);
    doc.text(`${label}:`, 21, y);
    doc.setFont(undefined, 'bold');
    doc.text(String(count), 80, y);
    doc.setFont(undefined, 'normal');
  });
  const covY = 70 + statRows.length * 8 + 4;
  doc.setFontSize(9); doc.setFont(undefined, 'bold');
  doc.text(`Cobertura total: ${(totalComEquipamento/184*100).toFixed(1)}%  (${totalComEquipamento} de 184 municípios)`, 14, covY);

  // ── Página 2: mapa vetorial (via helper reutilizável) ──────────────────────
  doc.addPage();
  drawVectorMapPage(doc, geoJsonData, municipioColors, stats, equipmentCounts, normalizeFn, totalComEquipamento);

  doc.save(`mapa-ceara_${ts()}.pdf`);
}

/**
 * Versão para o Relatório EVM: adiciona a página do mapa num doc jsPDF existente.
 * Recebe o geoJsonData e o mapa de cores — não depende de html2canvas.
 */
export function addVectorMapPageToDoc(
  doc: jsPDF,
  geoJsonData: any,
  municipioColors: Map<string, string>,
  stats: MapExportStats,
  equipmentCounts: MapEquipmentCounts,
  normalizeFn: (nome: string) => string,
  totalComEquipamento: number,
) {
  doc.addPage();
  drawVectorMapPage(doc, geoJsonData, municipioColors, stats, equipmentCounts, normalizeFn, totalComEquipamento);
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
      body: grupo.map(a => [a.municipio, getRegiao(a.municipio) || '-', a.tipo, a.recurso, fmtDate(a.data), a.dias?.toString() || '-', a.horario || '-', a.status, a.atendimentos?.toString() || '-', a.nup || '-', a.nome_evento || '-']),
      startY: startY + 9,
      styles: { fontSize: 6.5 },
      headStyles: { fillColor: [124, 58, 237] },
      alternateRowStyles: { fillColor: [245, 243, 255] },
    });
    startY = lastY(doc) + 10;
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

// ─────────────────────────────────────────────────────────────────────────────
// RELATÓRIO EVM — Rede de Proteção à Mulher
// ─────────────────────────────────────────────────────────────────────────────

export interface CpdiReportData {
  equipamentos: Equipamento[];
  solicitacoes: Solicitacao[];
  viaturas: Viatura[];
  qualificacoes?: QualificacaoExport[];
  dataReferencia?: string;
  regiaoFiltro?: string;
  secoesAtivas?: string[];
  modoResumo?: boolean;
  // Mapa vetorial — substitui mapaImagem (sem html2canvas)
  geoJsonData?: any;
  municipioColors?: Map<string, string>;
  normalizeFn?: (nome: string) => string;
  incluirMapa?: boolean;
  // Stats do mapa para legenda
  mapaStats?: MapExportStats;
  mapaEquipmentCounts?: MapEquipmentCounts;
}

export async function exportCpdiToPDF(data: CpdiReportData): Promise<void> {
  const { equipamentos: eqAll, solicitacoes: solAll, viaturas: viAll, qualificacoes, dataReferencia, regiaoFiltro, secoesAtivas, modoResumo = false, geoJsonData, municipioColors, normalizeFn, incluirMapa, mapaStats, mapaEquipmentCounts } = data;

  const inclui = (regiao?: string | null) => !regiaoFiltro || !regiao || regiao === regiaoFiltro;
  const equipamentos  = eqAll.filter(e => inclui(getRegiao(e.municipio)));
  const solicitacoes  = solAll.filter(s => inclui(getRegiao(s.municipio)));
  const viaturas      = viAll.filter(v  => inclui(getRegiao(v.municipio)));

  const temSecao = (id: string) => !secoesAtivas || secoesAtivas.includes(id);
  const refDate = dataReferencia ? new Date(dataReferencia + 'T00:00:00') : new Date();
  const doc = new jsPDF('landscape');
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

  // ── Helpers locais ────────────────────────────────────────────────────────
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

  function tableEquip(
    items: Equipamento[],
    yPos: number,
    hColor: [number,number,number],
    solics?: Solicitacao[],
    opcoes?: { semPatrulha?: boolean; semKitAthena?: boolean },
  ): number {
    const semPatrulha  = opcoes?.semPatrulha  ?? false;
    const semKitAthena = opcoes?.semKitAthena ?? false;

    if (modoResumo) {
      if (items.length === 0) {
        doc.setFontSize(8); doc.setTextColor(150, 150, 150);
        doc.text('Nenhuma unidade em funcionamento.', 18, yPos);
        doc.setTextColor(0, 0, 0); return yPos + 8;
      }
      if (yPos > 165) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); yPos = 30; }
      autoTable(doc, {
        head: [['Município','Região','Endereço']],
        body: items.map(e => [e.municipio, getRegiao(e.municipio) || '—', e.endereco || '—']),
        startY: yPos,
        styles: { fontSize: 7, cellPadding: 2.5 },
        headStyles: { fillColor: hColor, textColor: [255,255,255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248,250,252] },
        columnStyles: {},
        margin: { left: 14, right: 14, top: 32 },
        didDrawPage: (d) => { if (d.pageNumber > 1) addPdfHeader(doc, 'Relatório EVM'); },
      });
      return lastY(doc) + 8;
    }

    const headEquip =
      semPatrulha && semKitAthena
        ? [['Município','Região','Endereço','Responsável']]
        : semPatrulha
        ? [['Município','Região','Endereço','Responsável','Kit Athena','Qualificação']]
        : [['Município','Região','Endereço','Responsável','Patrulha M.P.','Kit Athena','Qualificação']];

    const colEquip =
      semPatrulha && semKitAthena
        ? {}
        : semPatrulha
        ? { 4:{halign:'center' as const},5:{halign:'center' as const} }
        : { 4:{halign:'center' as const},5:{halign:'center' as const},6:{halign:'center' as const} };

    const bodyEquip = (e: Equipamento) => {
      const base = [e.municipio, getRegiao(e.municipio) || '—', e.endereco || '—', e.responsavel || '—'];
      if (semPatrulha && semKitAthena) return base;
      if (semPatrulha) return [...base, e.kit_athena_entregue ? (e.kit_athena_previo ? 'Sim (PréVio)' : 'Sim') : 'Não', e.capacitacao_realizada ? 'Sim' : 'Não'];
      return [...base, e.possui_patrulha ? 'Sim' : 'Não', e.kit_athena_entregue ? (e.kit_athena_previo ? 'Sim (PréVio)' : 'Sim') : 'Não', e.capacitacao_realizada ? 'Sim' : 'Não'];
    };

    if (items.length > 0) {
      if (yPos > 165) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); yPos = 30; }
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
      yPos = lastY(doc) + 6;
    } else {
      doc.setFontSize(8); doc.setTextColor(150, 150, 150);
      doc.text('Nenhuma unidade em funcionamento.', 18, yPos);
      doc.setTextColor(0, 0, 0); yPos += 8;
    }

    if (!modoResumo && solics && solics.length > 0) {
      if (yPos > 165) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); yPos = 30; }
      doc.setFontSize(8); doc.setFont(undefined, 'bold'); doc.setTextColor(60, 60, 60);
      doc.text('Em andamento / Previstas (' + solics.length + ')', 14, yPos);
      doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0);
      yPos += 3;
      autoTable(doc, {
        head: [['Município','Região','Status','Data Solicitação','NUP','Patrulha','Kit Athena','Qualificação']],
        body: solics.map(s => [s.municipio, getRegiao(s.municipio) || '—', s.status, fmtDate(s.data_solicitacao), s.nup || '—', s.recebeu_patrulha ? 'Sim' : 'Não', s.kit_athena_entregue ? 'Sim' : 'Não', s.capacitacao_realizada ? 'Sim' : 'Não']),
        startY: yPos,
        styles: { fontSize: 6.5, cellPadding: 2 },
        headStyles: { fillColor: [Math.round(hColor[0]*0.6), Math.round(hColor[1]*0.6), Math.round(hColor[2]*0.6)] as [number,number,number], textColor:[255,255,255], fontStyle:'bold' },
        alternateRowStyles: { fillColor: [252,252,248] },
        columnStyles: { 5:{halign:'center' as const},6:{halign:'center' as const},7:{halign:'center' as const} },
        margin: { left: 14, right: 14, top: 32 },
        didDrawPage: (d) => { if (d.pageNumber > 1) addPdfHeader(doc, 'Relatório EVM'); },
      });
      yPos = lastY(doc) + 8;
    }
    return yPos;
  }

  // ── Seções ────────────────────────────────────────────────────────────────
  if (temSecao('cmb')) {
    if (y > 165) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); y = 30; }
    y = addSecHeader('1. Casa da Mulher Brasileira (CMB)', [13,148,136], y);
    y = tableEquip(cmb, y, [13,148,136], solicitacoes.filter(s => s.tipo_equipamento === 'Casa da Mulher Brasileira' && s.status !== 'Cancelada' && s.status !== 'Inaugurada'), { semPatrulha: true, semKitAthena: true });
  }
  if (temSecao('cmc')) {
    if (y > 165) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); y = 30; }
    y = addSecHeader('2. Casa da Mulher Cearense (CMC)', [124,58,237], y);
    y = tableEquip(cmc, y, [124,58,237], solicitacoes.filter(s => s.tipo_equipamento === 'Casa da Mulher Cearense' && s.status !== 'Cancelada' && s.status !== 'Inaugurada'), { semPatrulha: true, semKitAthena: true });
  }
  if (temSecao('cmm')) {
    if (y > 165) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); y = 30; }
    y = addSecHeader('3. Casa da Mulher Municipal (CMM)', [234,88,12], y);
    y = tableEquip(cmm, y, [234,88,12], solicitacoes.filter(s => s.tipo_equipamento === 'Casa da Mulher Municipal' && s.status !== 'Cancelada' && s.status !== 'Inaugurada'));
  }
  if (temSecao('lilasMunicipal')) {
    if (y > 165) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); y = 30; }
    y = addSecHeader('4. Salas Lilás Municipal', [192,38,211], y);
    y = tableEquip(lilasMunicipal, y, [192,38,211], solicitacoes.filter(s => s.tipo_equipamento === 'Sala Lilás Municipal' && s.status !== 'Cancelada' && s.status !== 'Inaugurada'), { semPatrulha: true });
  }
  if (temSecao('lilasEstado')) {
    if (y > 165) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); y = 30; }
    y = addSecHeader('5. Salas Lilás Governo do Estado', [232,121,249], y);
    y = tableEquip(lilasEstado, y, [232,121,249], solicitacoes.filter(s => s.tipo_equipamento === 'Sala Lilás Governo do Estado' && s.status !== 'Cancelada' && s.status !== 'Inaugurada'), { semPatrulha: true });
  }
  if (temSecao('lilasDelegacia')) {
    if (y > 165) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); y = 30; }
    y = addSecHeader('6. Salas Lilás em Delegacia', [240,171,252], y);
    y = tableEquip(lilasDelegacia, y, [240,171,252], solicitacoes.filter(s => s.tipo_equipamento === 'Sala Lilás em Delegacia' && s.status !== 'Cancelada' && s.status !== 'Inaugurada'), { semPatrulha: true });
  }
  if (temSecao('ddm')) {
    if (y > 165) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); y = 30; }
    y = addSecHeader('7. Delegacias de Defesa da Mulher (DDM)', [21,128,61], y);
    y = addNote('As DDMs são gerenciadas pela Polícia Civil do Ceará e não passam pelo fluxo de solicitações desta Secretaria.', y);
    y = tableEquip(ddm, y, [21,128,61], undefined, { semPatrulha: true, semKitAthena: true });
  }
  if (temSecao('patrulha')) {
    if (y > 165) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); y = 30; }
    y = addSecHeader('8. Patrulhas Maria da Penha', [6,182,212], y);
    if (equipsComPatrulha.length > 0) {
      if (y > 165) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); y = 30; }
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
        columnStyles: {},
        margin: { left: 14, right: 14, top: 32 },
        didDrawPage: (d) => { if (d.pageNumber > 1) addPdfHeader(doc, 'Relatório EVM'); },
      });
      y = lastY(doc) + 6;
    }
    if (solicsComPatrulha.length > 0) {
      if (y > 165) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); y = 30; }
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
        columnStyles: { 4:{halign:'center' as const},5:{halign:'center' as const} },
        margin: { left: 14, right: 14, top: 32 },
        didDrawPage: (d) => { if (d.pageNumber > 1) addPdfHeader(doc, 'Relatório EVM'); },
      });
      y = lastY(doc) + 6;
    }
    if (totalPatrulhas === 0) {
      doc.setFontSize(8); doc.setTextColor(150, 150, 150);
      doc.text('Nenhuma Patrulha Maria da Penha cadastrada.', 18, y);
      doc.setTextColor(0, 0, 0);
    }
  }
  if (temSecao('viaturas')) {
    if (y > 165) { doc.addPage(); addPdfHeader(doc, 'Relatório EVM'); y = 30; }
    y = addSecHeader('9. Viaturas PMCE', [99,102,241], y);
    if (viaturas.length > 0) {
      autoTable(doc, {
        head: [['Município','Região','Tipo de Patrulha','Órgão','Qtd.','Vinc. Equipamento','Data Implantação']],
        body: viaturas.map(v => [v.municipio, getRegiao(v.municipio)||'—', v.tipo_patrulha, v.orgao_responsavel, String(v.quantidade), v.vinculada_equipamento ? '✓ Sim' : 'Não', fmtDate(v.data_implantacao)]),
        startY: y,
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [99,102,241], textColor:[255,255,255], fontStyle:'bold' },
        alternateRowStyles: { fillColor: [245,245,255] },
        columnStyles: { 4:{halign:'center' as const},5:{halign:'center' as const} },
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

  if (incluirMapa && geoJsonData && municipioColors && normalizeFn && mapaStats && mapaEquipmentCounts) {
    const totalMapaCom = mapaStats.brasileira + mapaStats.cearense + mapaStats.municipal
      + mapaStats.lilasMunicipal + mapaStats.lilasEstado + mapaStats.lilasDelegacia + mapaStats.ddm;
    addVectorMapPageToDoc(doc, geoJsonData, municipioColors, mapaStats, mapaEquipmentCounts, normalizeFn, totalMapaCom);
  }

  // ── Seção de Qualificações ─────────────────────────────────────────────────
  if (qualificacoes && qualificacoes.length > 0 && !modoResumo) {
    doc.addPage();
    let qY = addPdfHeader(doc, 'Qualificações Realizadas');
    const qPW = doc.internal.pageSize.getWidth();
    const checkQY = (needed = 10) => {
      if (qY + needed > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        qY = addPdfHeader(doc, 'Qualificações Realizadas');
      }
    };

    const totalPessoas = qualificacoes.reduce((s, q) => s + q.total_pessoas, 0);
    const municUnicosSet = new Set(qualificacoes.flatMap(q => q.municipios.map(m => m.municipio)));
    const municUnicos = municUnicosSet.size;

    // Resumo
    doc.setFontSize(10); doc.setFont(undefined, 'normal'); doc.setTextColor(80, 80, 80);
    doc.text(
      `${qualificacoes.length} curso${qualificacoes.length !== 1 ? 's' : ''}  ·  ${totalPessoas.toLocaleString('pt-BR')} pessoas qualificadas  ·  ${municUnicos} municípios únicos alcançados`,
      qPW / 2, qY, { align: 'center' }
    );
    qY += 8;

    // Tabela de cursos — "Munic. do Curso" = municípios cadastrados naquele curso
    // O footer mostra municípios ÚNICOS no total (sem repetição entre cursos)
    autoTable(doc, {
      startY: qY,
      head: [['Curso', 'Ministrante', 'Data', 'Pessoas', 'Munic. do Curso']],
      body: qualificacoes.map(q => [
        q.nome,
        q.ministrante,
        new Date(q.data + 'T00:00:00').toLocaleDateString('pt-BR'),
        q.total_pessoas.toLocaleString('pt-BR'),
        String(q.municipios.length),
      ]),
      foot: [['Total', '', '', totalPessoas.toLocaleString('pt-BR'), municUnicos + ' únicos']],
      headStyles:    { fillColor: [109, 40, 217], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      footStyles:    { fillColor: [237, 233, 254], textColor: [60, 20, 120], fontStyle: 'bold', fontSize: 9 },
      bodyStyles:    { fontSize: 8 },
      alternateRowStyles: { fillColor: [250, 248, 255] },
      columnStyles:  { 3: { halign: 'right' as const }, 4: { halign: 'right' as const } },
      margin:        { left: 14, right: 14 },
      didDrawPage:   () => { addPdfFooters(doc); },
    });

    // ── Tabela de cobertura por região ──────────────────────────────────────
    const qRegioesList = [
      'Cariri', 'Centro Sul', 'Grande Fortaleza', 'Litoral Leste', 'Litoral Norte',
      'Litoral Oeste', 'Maciço de Baturité', 'Serra de Ibiapaba', 'Sertão Central',
      'Sertão de Canindé', 'Sertão de Sobral', 'Sertão do Inhamuns',
      'Sertão dos Crateús', 'Vale do Jaguaribe',
    ] as const;

    const statsRegiao = qRegioesList.map(regiao => {
      const municipiosUnicos = new Set<string>();
      const qualIds = new Set<string>();
      let pessoasRegiao = 0;
      qualificacoes.forEach(q => {
        q.municipios.forEach(m => {
          if (getRegiao(m.municipio) === regiao) {
            municipiosUnicos.add(m.municipio);
            qualIds.add(q.id);
            pessoasRegiao += m.quantidade_pessoas;
          }
        });
      });
      return { regiao, numQual: qualIds.size, numMunic: municipiosUnicos.size, pessoas: pessoasRegiao };
    }).sort((a, b) => b.numQual - a.numQual || b.numMunic - a.numMunic);

    qY = (doc as any).lastAutoTable?.finalY ?? qY;
    qY += 10;
    checkQY(60);

    doc.setFontSize(10); doc.setFont(undefined, 'bold'); doc.setTextColor(60, 20, 120);
    doc.text('Cobertura por Região de Planejamento', 14, qY); qY += 6;

    autoTable(doc, {
      startY: qY,
      head: [['Região de Planejamento', 'Qualificações', 'Municípios Únicos', 'Pessoas']],
      body: statsRegiao.map(r => [
        r.regiao,
        r.numQual > 0 ? String(r.numQual) : '—',
        r.numMunic > 0 ? String(r.numMunic) : '—',
        r.pessoas > 0 ? r.pessoas.toLocaleString('pt-BR') : '—',
      ]),
      foot: [[
        `${statsRegiao.filter(r => r.numQual > 0).length} de 14 regiões alcançadas`,
        String(qualificacoes.length),
        String(municUnicos),
        totalPessoas.toLocaleString('pt-BR'),
      ]],
      headStyles:    { fillColor: [109, 40, 217], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      footStyles:    { fillColor: [237, 233, 254], textColor: [60, 20, 120], fontStyle: 'bold', fontSize: 9 },
      bodyStyles:    { fontSize: 8 },
      alternateRowStyles: { fillColor: [250, 248, 255] },
      columnStyles:  { 1: { halign: 'right' as const }, 2: { halign: 'right' as const }, 3: { halign: 'right' as const } },
      margin:        { left: 14, right: 14 },
      didDrawPage:   () => { addPdfFooters(doc); },
    });
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

export interface PendenciaMunicipio {
  itemId: string;  // id do equipamento ou solicitação — garante key única no React
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
      resultado.push({ itemId: e.id, municipio: e.municipio, regiao: getRegiao(e.municipio) || '—', tipo: e.tipo, pendencias, origem: 'Equipamento' });
    }
  });

  const solics = regiaoFiltro
    ? solicitacoes.filter(s => getRegiao(s.municipio) === regiaoFiltro)
    : solicitacoes;

  // ── ITEM 4: updated_at agora é tipado — sem cast (as any) ──
  solics
    .filter(s => s.status !== 'Cancelada' && s.status !== 'Inaugurada')
    .forEach(s => {
      const dataRef = new Date((s.updated_at || s.data_solicitacao) + 'T00:00:00');
      const dias    = Math.floor((hoje.getTime() - dataRef.getTime()) / 86_400_000);
      const pendencias: string[] = [];
      if (dias >= diasSemMovimento) pendencias.push(`Parada há ${dias} dias`);
      if (!s.nup)                   pendencias.push('Sem NUP registrado');
      if (pendencias.length > 0) {
        resultado.push({ itemId: s.id, municipio: s.municipio, regiao: getRegiao(s.municipio) || '—', tipo: s.tipo_equipamento, pendencias, origem: 'Solicitação', status: s.status, diasSemMovimento: dias });
      }
    });

  return resultado.sort(
    (a, b) => a.regiao.localeCompare(b.regiao, 'pt-BR') || a.municipio.localeCompare(b.municipio, 'pt-BR')
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
  // ── ITEM 3: PH removido — era declarado mas nunca usado ──

  const checkPage = (y: number, threshold = 230): number => {
    if (y > threshold) { doc.addPage(); return addPdfHeader(doc, 'Diagnóstico EVM'); }
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

  if (pendencias.length === 0) {
    doc.setFontSize(12); doc.setTextColor(16, 185, 129);
    doc.text('✓ Nenhuma pendência identificada para os filtros aplicados.', 14, y + 10);
    addPdfFooters(doc);
    doc.save(`diagnostico-evm_${ts()}.pdf`);
    return;
  }

  const contPorTipo: Record<string, number> = {};
  pendencias.forEach(p => p.pendencias.forEach(pen => { contPorTipo[pen] = (contPorTipo[pen] || 0) + 1; }));

  doc.setFontSize(10); doc.setFont(undefined, 'bold');
  doc.text('Resumo das Pendências', 14, y);
  doc.setFont(undefined, 'normal');
  y += 3;
  doc.setDrawColor(239, 68, 68); doc.setLineWidth(0.4);
  doc.line(14, y, PW - 14, y);
  y += 5;

  const cardW = (PW - 28 - 6) / 2;
  const coresCard: [number, number, number][] = [[239,68,68],[245,158,11],[234,88,12],[124,58,237],[6,182,212],[21,128,61]];
  const tiposOrdenados = Object.entries(contPorTipo).sort((a, b) => b[1] - a[1]);
  tiposOrdenados.forEach(([pen, cnt], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const cx = 14 + col * (cardW + 6), cy = y + row * 18;
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

  const regioes = Array.from(new Set(pendencias.map(p => p.regiao))).sort();
  regioes.forEach(regiao => {
    const grupo     = pendencias.filter(p => p.regiao === regiao);
    const grpEquips = grupo.filter(p => p.origem === 'Equipamento');
    const grpSolics = grupo.filter(p => p.origem === 'Solicitação');

    y = checkPage(y, 200);
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
      y = lastY(doc) + 5;
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
      y = lastY(doc) + 8;
    }
  });

  addPdfFooters(doc);
  doc.save(`diagnostico-evm_${ts()}.pdf`);
}

// ── Item 6: Exportar diagnóstico para Excel ───────────────────────────────────
export function exportDiagnosticoToExcel(
  equipamentos: Equipamento[],
  solicitacoes: Solicitacao[],
  filtros: DiagnosticoFiltros = {}
): void {
  const pendencias = gerarDiagnostico(equipamentos, solicitacoes, filtros);
  const wb = XLSX.utils.book_new();

  // Aba 1 — Resumo por tipo de pendência
  const contPorTipo: Record<string, number> = {};
  const contPorRegiao: Record<string, number> = {};
  pendencias.forEach(p => {
    p.pendencias.forEach(pen => { contPorTipo[pen] = (contPorTipo[pen] || 0) + 1; });
    contPorRegiao[p.regiao] = (contPorRegiao[p.regiao] || 0) + 1;
  });

  const resumoData = [
    ...Object.entries(contPorTipo)
      .sort((a, b) => b[1] - a[1])
      .map(([pendencia, total]) => ({ 'Tipo de Pendência': pendencia, 'Total': total, 'Categoria': 'Por tipo' })),
    ...Object.entries(contPorRegiao)
      .sort((a, b) => b[1] - a[1])
      .map(([regiao, total]) => ({ 'Tipo de Pendência': regiao, 'Total': total, 'Categoria': 'Por região' })),
  ];
  const wsResumo = XLSX.utils.json_to_sheet(resumoData);
  styleWorksheet(wsResumo, 'EF4444');
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

  // Aba 2 — Equipamentos com pendências
  const equipsData = pendencias
    .filter(p => p.origem === 'Equipamento')
    .map(p => ({
      'Município':           p.municipio,
      'Região':              p.regiao,
      'Tipo de Equipamento': p.tipo,
      'Pendências':          p.pendencias.join(' · '),
      'Qtd. Pendências':     p.pendencias.length,
      'Sem Patrulha M.P.':   p.pendencias.includes('Sem Patrulha M.P.') ? 'Sim' : '',
      'Sem Kit Athena':      p.pendencias.includes('Sem Kit Athena') ? 'Sim' : '',
      'Sem Qualificação':    p.pendencias.includes('Sem Qualificação') ? 'Sim' : '',
    }));
  if (equipsData.length > 0) {
    const wsEquips = XLSX.utils.json_to_sheet(equipsData);
    styleWorksheet(wsEquips, 'EF4444');
    XLSX.utils.book_append_sheet(wb, wsEquips, 'Equipamentos');
  }

  // Aba 3 — Solicitações com alertas
  const solicsData = pendencias
    .filter(p => p.origem === 'Solicitação')
    .map(p => ({
      'Município':        p.municipio,
      'Região':           p.regiao,
      'Tipo':             p.tipo,
      'Status':           p.status || '',
      'Alertas':          p.pendencias.join(' · '),
      'Dias sem movimento': p.diasSemMovimento ?? '',
      'Sem NUP':          p.pendencias.includes('Sem NUP registrado') ? 'Sim' : '',
    }));
  if (solicsData.length > 0) {
    const wsSolics = XLSX.utils.json_to_sheet(solicsData);
    styleWorksheet(wsSolics, 'F59E0B');
    XLSX.utils.book_append_sheet(wb, wsSolics, 'Solicitações');
  }

  // Aba 4 — Todos os dados brutos
  const todosData = pendencias.map(p => ({
    'Município':        p.municipio,
    'Região':           p.regiao,
    'Tipo':             p.tipo,
    'Origem':           p.origem,
    'Status':           p.status || '',
    'Pendências':       p.pendencias.join(' · '),
    'Qtd. Pendências':  p.pendencias.length,
    'Dias sem movimento': p.diasSemMovimento ?? '',
    'Filtro Região':    filtros.regiaoFiltro || 'Todas',
    'Threshold (dias)': filtros.diasSemMovimento ?? 60,
    'Gerado em':        new Date().toLocaleString('pt-BR'),
  }));
  const wsTodos = XLSX.utils.json_to_sheet(todosData);
  styleWorksheet(wsTodos, 'EF4444');
  XLSX.utils.book_append_sheet(wb, wsTodos, 'Todos');

  saveWb(wb, `diagnostico-evm_${ts()}.xlsx`);
}

// ─────────────────────────────────────────────────────────────────────────────
// QUALIFICAÇÕES — Export PDF e Excel
// ─────────────────────────────────────────────────────────────────────────────

export interface QualificacaoExport {
  id: string;
  nome: string;
  ministrante: string;
  data: string;
  total_pessoas: number;
  observacoes: string | null;
  municipios: { municipio: string; quantidade_pessoas: number }[];
}

export function exportQualificacoesToPDF(qualificacoes: QualificacaoExport[]) {
  const doc = new jsPDF();
  let y = addPdfHeader(doc, 'Qualificações', 'Cursos e Qualificações Realizados');

  const PW = doc.internal.pageSize.getWidth();

  // ── Resumo geral ──────────────────────────────────────────────────────────
  const totalPessoas = qualificacoes.reduce((s, q) => s + q.total_pessoas, 0);
  const municipiosUnicosSet = new Set(qualificacoes.flatMap(q => q.municipios.map(m => m.municipio)));
  const municUnicos = municipiosUnicosSet.size;

  doc.setFontSize(9); doc.setTextColor(100, 100, 100);
  doc.text(
    `Total de cursos: ${qualificacoes.length}  ·  Pessoas qualificadas: ${totalPessoas.toLocaleString('pt-BR')}  ·  Municípios únicos alcançados: ${municUnicos}`,
    14, y
  );
  y += 8;

  // ── Tabela de resumo (uma linha por curso) ─────────────────────────────────
  // "Munic. do Curso" = municípios cadastrados naquele curso específico
  doc.setTextColor(0, 0, 0);
  autoTable(doc, {
    startY: y,
    head: [['Curso', 'Ministrante', 'Data', 'Pessoas', 'Munic. do Curso']],
    body: qualificacoes.map(q => [
      q.nome,
      q.ministrante,
      fmtDate(q.data),
      q.total_pessoas.toLocaleString('pt-BR'),
      q.municipios.length > 0 ? String(q.municipios.length) : '—',
    ]),
    foot: [['Total', '', '', totalPessoas.toLocaleString('pt-BR'), municUnicos + ' únicos']],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [88, 28, 135], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [237, 233, 254], fontStyle: 'bold', textColor: [60, 20, 100] },
    alternateRowStyles: { fillColor: [245, 243, 255] },
    columnStyles: {
      3: { halign: 'right' as const },
      4: { halign: 'right' as const },
    },
    didDrawPage: () => { addPdfFooters(doc); },
  });

  // ── Tabela de cobertura por região ────────────────────────────────────────
  const regioesPDF = [
    'Cariri', 'Centro Sul', 'Grande Fortaleza', 'Litoral Leste', 'Litoral Norte',
    'Litoral Oeste', 'Maciço de Baturité', 'Serra de Ibiapaba', 'Sertão Central',
    'Sertão de Canindé', 'Sertão de Sobral', 'Sertão do Inhamuns',
    'Sertão dos Crateús', 'Vale do Jaguaribe',
  ] as const;

  const statsRegiao = regioesPDF.map(regiao => {
    const municipiosUnicos = new Set<string>();
    const qualIds = new Set<string>();
    let pessoasRegiao = 0;
    qualificacoes.forEach(q => {
      q.municipios.forEach(m => {
        if (getRegiao(m.municipio) === regiao) {
          municipiosUnicos.add(m.municipio);
          qualIds.add(q.id);
          pessoasRegiao += m.quantidade_pessoas;
        }
      });
    });
    return { regiao, numQual: qualIds.size, numMunic: municipiosUnicos.size, pessoas: pessoasRegiao };
  }).sort((a, b) => b.numQual - a.numQual || b.numMunic - a.numMunic);

  const regioesCom = statsRegiao.filter(r => r.numQual > 0).length;

  y = (doc as any).lastAutoTable?.finalY ?? y;
  y += 10;
  if (y > doc.internal.pageSize.getHeight() - 80) { doc.addPage(); y = 20; addPdfFooters(doc); }

  doc.setFontSize(10); doc.setFont(undefined, 'bold'); doc.setTextColor(88, 28, 135);
  doc.text('Cobertura por Região de Planejamento', 14, y); y += 6;

  autoTable(doc, {
    startY: y,
    head: [['Região de Planejamento', 'Qualificações', 'Municípios Únicos', 'Pessoas']],
    body: statsRegiao.map(r => [
      r.regiao,
      r.numQual > 0 ? String(r.numQual) : '—',
      r.numMunic > 0 ? String(r.numMunic) : '—',
      r.pessoas > 0 ? r.pessoas.toLocaleString('pt-BR') : '—',
    ]),
    foot: [[
      `${regioesCom} de 14 regiões alcançadas`,
      String(qualificacoes.length),
      String(municUnicos),
      totalPessoas.toLocaleString('pt-BR'),
    ]],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [88, 28, 135], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [237, 233, 254], fontStyle: 'bold', textColor: [60, 20, 100] },
    alternateRowStyles: { fillColor: [245, 243, 255] },
    columnStyles: {
      1: { halign: 'right' as const },
      2: { halign: 'right' as const },
      3: { halign: 'right' as const },
    },
    didDrawPage: () => { addPdfFooters(doc); },
  });

  // ── Detalhe por curso ──────────────────────────────────────────────────────
  for (const q of qualificacoes) {
    if (q.municipios.length === 0) continue;

    doc.addPage();
    addPdfFooters(doc);
    let dy = 20;

    // Cabeçalho do curso
    doc.setFillColor(245, 243, 255);
    doc.roundedRect(14, dy - 4, PW - 28, 28, 3, 3, 'F');
    doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.setTextColor(88, 28, 135);
    doc.text(q.nome, 18, dy + 4);
    doc.setFont(undefined, 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
    doc.text(`${q.ministrante}  ·  ${fmtDate(q.data)}  ·  ${q.total_pessoas.toLocaleString('pt-BR')} pessoas`, 18, dy + 12);
    dy += 34;

    // Observações
    if (q.observacoes) {
      doc.setFontSize(8); doc.setTextColor(100, 100, 100);
      const lines = doc.splitTextToSize(q.observacoes, PW - 28) as string[];
      doc.text(lines, 14, dy);
      dy += lines.length * 4 + 4;
    }

    // Tabela de municípios — com região
    const sortedMun = [...q.municipios].sort((a, b) => b.quantidade_pessoas - a.quantidade_pessoas);
    const totalMun = sortedMun.reduce((s, m) => s + m.quantidade_pessoas, 0);

    autoTable(doc, {
      startY: dy,
      head: [['Município', 'Região', 'Pessoas Qualificadas']],
      body: sortedMun.map(m => [
        m.municipio,
        getRegiao(m.municipio) ?? '—',
        m.quantidade_pessoas.toLocaleString('pt-BR'),
      ]),
      foot: [['Total', '', totalMun.toLocaleString('pt-BR')]],
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [88, 28, 135], textColor: [255, 255, 255] },
      footStyles: { fillColor: [237, 233, 254], fontStyle: 'bold', textColor: [60, 20, 100] },
      alternateRowStyles: { fillColor: [250, 249, 255] },
      columnStyles: {
        2: { halign: 'right' as const },
      },
      didDrawPage: () => { addPdfFooters(doc); },
    });
  }

  addPdfFooters(doc);
  doc.save(`qualificacoes-evm_${ts()}.pdf`);
}

export function exportQualificacoesToExcel(qualificacoes: QualificacaoExport[]) {
  const wb = XLSX.utils.book_new();

  // ── Aba 1: Resumo ──────────────────────────────────────────────────────────
  const resumoData = qualificacoes.map(q => ({
    'Curso':             q.nome,
    'Ministrante':       q.ministrante,
    'Data':              fmtDate(q.data),
    'Pessoas (total)':   q.total_pessoas,
    'Qtd. Municípios':   q.municipios.length,
    'Pessoas (municípios)': q.municipios.reduce((s, m) => s + m.quantidade_pessoas, 0),
    'Observações':       q.observacoes ?? '',
  }));
  const wsResumo = XLSX.utils.json_to_sheet(resumoData);
  styleWorksheet(wsResumo, '581C87');
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

  // ── Aba 2: Cobertura por Região ────────────────────────────────────────────
  const regioesList = [
    'Cariri', 'Centro Sul', 'Grande Fortaleza', 'Litoral Leste', 'Litoral Norte',
    'Litoral Oeste', 'Maciço de Baturité', 'Serra de Ibiapaba', 'Sertão Central',
    'Sertão de Canindé', 'Sertão de Sobral', 'Sertão do Inhamuns',
    'Sertão dos Crateús', 'Vale do Jaguaribe',
  ] as const;

  const statsRegiao = regioesList.map(regiao => {
    const municipiosUnicos = new Set<string>();
    const qualIds = new Set<string>();
    let pessoasRegiao = 0;
    qualificacoes.forEach(q => {
      q.municipios.forEach(m => {
        if (getRegiao(m.municipio) === regiao) {
          municipiosUnicos.add(m.municipio);
          qualIds.add(q.id);
          pessoasRegiao += m.quantidade_pessoas;
        }
      });
    });
    return {
      'Região de Planejamento': regiao,
      'Qualificações':          qualIds.size,
      'Municípios Únicos':      municipiosUnicos.size,
      'Pessoas Qualificadas':   pessoasRegiao,
      'Municípios':             Array.from(municipiosUnicos).sort().join(', '),
    };
  }).sort((a, b) => b['Qualificações'] - a['Qualificações'] || b['Municípios Únicos'] - a['Municípios Únicos']);

  const wsRegioes = XLSX.utils.json_to_sheet(statsRegiao);
  styleWorksheet(wsRegioes, '6D28D9');
  XLSX.utils.book_append_sheet(wb, wsRegioes, 'Por Região');

  // ── Aba 3: Municípios (detalhe) ────────────────────────────────────────────
  const detData: Record<string, string | number>[] = [];
  for (const q of qualificacoes) {
    for (const m of q.municipios) {
      detData.push({
        'Curso':             q.nome,
        'Ministrante':       q.ministrante,
        'Data':              fmtDate(q.data),
        'Município':         m.municipio,
        'Região':            getRegiao(m.municipio) ?? '—',
        'Pessoas':           m.quantidade_pessoas,
      });
    }
  }
  if (detData.length > 0) {
    const wsDet = XLSX.utils.json_to_sheet(detData);
    styleWorksheet(wsDet, '7C3AED');
    XLSX.utils.book_append_sheet(wb, wsDet, 'Por Município');
  }

  // ── Aba 4: Municípios únicos alcançados ────────────────────────────────────
  const alcanceMap = new Map<string, { pessoas: number; cursos: number }>();
  for (const q of qualificacoes) {
    for (const m of q.municipios) {
      const entry = alcanceMap.get(m.municipio) ?? { pessoas: 0, cursos: 0 };
      entry.pessoas += m.quantidade_pessoas;
      entry.cursos  += 1;
      alcanceMap.set(m.municipio, entry);
    }
  }
  const alcanceData = Array.from(alcanceMap.entries())
    .sort((a, b) => b[1].pessoas - a[1].pessoas)
    .map(([municipio, v]) => ({
      'Município':           municipio,
      'Região':              getRegiao(municipio) ?? '—',
      'Total Pessoas':       v.pessoas,
      'Aparece em N Cursos': v.cursos,
    }));
  if (alcanceData.length > 0) {
    const wsAlcance = XLSX.utils.json_to_sheet(alcanceData);
    styleWorksheet(wsAlcance, 'A855F7');
    XLSX.utils.book_append_sheet(wb, wsAlcance, 'Alcance por Município');
  }

  saveWb(wb, `qualificacoes-evm_${ts()}.xlsx`);
}