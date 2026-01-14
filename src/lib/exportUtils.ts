import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Equipamento, Viatura, Solicitacao } from '@/types';

// Equipamentos export
export function exportEquipamentosToPDF(equipamentos: Equipamento[], filterRegiao?: string) {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text('Relatório de Equipamentos', 14, 22);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 30);
  
  let startY = 35;
  if (filterRegiao && filterRegiao !== 'all') {
    doc.setFontSize(11);
    doc.text(`Região: ${filterRegiao}`, 14, 38);
    startY = 45;
  }
  
  const tableData = equipamentos.map((e) => [
    e.municipio,
    e.tipo,
    e.responsavel || '-',
    e.telefone || '-',
    e.possui_patrulha ? 'Sim' : 'Não',
  ]);

  autoTable(doc, {
    head: [['Município', 'Tipo', 'Responsável', 'Telefone', 'Patrulha']],
    body: tableData,
    startY: startY,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [31, 81, 140] },
  });

  doc.save('equipamentos.pdf');
}

export function exportEquipamentosToExcel(equipamentos: Equipamento[]) {
  const data = equipamentos.map((e) => ({
    'Município': e.municipio,
    'Tipo': e.tipo,
    'Responsável': e.responsavel || '',
    'Telefone': e.telefone || '',
    'Endereço': e.endereco || '',
    'Possui Patrulha': e.possui_patrulha ? 'Sim' : 'Não',
    'Observações': e.observacoes || '',
    'Data de Criação': new Date(e.created_at).toLocaleDateString('pt-BR'),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Equipamentos');
  XLSX.writeFile(wb, 'equipamentos.xlsx');
}

// Viaturas export
export function exportViaturasToPDF(viaturas: Viatura[]) {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text('Relatório de Viaturas', 14, 22);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 30);
  
  const tableData = viaturas.map((v) => [
    v.municipio,
    v.tipo_patrulha,
    v.orgao_responsavel,
    v.quantidade.toString(),
    v.responsavel || '-',
    new Date(v.data_implantacao).toLocaleDateString('pt-BR'),
  ]);

  autoTable(doc, {
    head: [['Município', 'Tipo', 'Órgão', 'Qtd', 'Responsável', 'Data Implantação']],
    body: tableData,
    startY: 35,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [31, 81, 140] },
  });

  doc.save('viaturas.pdf');
}

export function exportViaturasToExcel(viaturas: Viatura[]) {
  const data = viaturas.map((v) => ({
    'Município': v.municipio,
    'Tipo de Patrulha': v.tipo_patrulha,
    'Órgão Responsável': v.orgao_responsavel,
    'Quantidade': v.quantidade,
    'Responsável': v.responsavel || '',
    'Vinculada a Equipamento': v.vinculada_equipamento ? 'Sim' : 'Não',
    'Data de Implantação': new Date(v.data_implantacao).toLocaleDateString('pt-BR'),
    'Observações': v.observacoes || '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Viaturas');
  XLSX.writeFile(wb, 'viaturas.xlsx');
}

// Solicitações export
export function exportSolicitacoesToPDF(solicitacoes: Solicitacao[], filterRegiao?: string) {
  const doc = new jsPDF('landscape');
  
  doc.setFontSize(18);
  doc.text('Relatório de Solicitações', 14, 22);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 30);
  
  let startY = 35;
  if (filterRegiao && filterRegiao !== 'all') {
    doc.setFontSize(11);
    doc.text(`Região: ${filterRegiao}`, 14, 38);
    startY = 45;
  }
  
  doc.setFontSize(10);
  doc.text(`Total de registros: ${solicitacoes.length}`, 14, startY);
  startY += 8;
  
  const tableData = solicitacoes.map((s) => [
    s.municipio,
    s.tipo_equipamento,
    s.status,
    new Date(s.data_solicitacao).toLocaleDateString('pt-BR'),
    s.suite_implantada || '-',
    s.guarda_municipal_estruturada ? 'Sim' : 'Não',
    s.recebeu_patrulha ? 'Sim' : 'Não',
    s.kit_athena_entregue ? 'Sim' : 'Não',
    s.capacitacao_realizada ? 'Sim' : 'Não',
    s.observacoes ? (s.observacoes.length > 30 ? s.observacoes.substring(0, 30) + '...' : s.observacoes) : '-',
  ]);

  autoTable(doc, {
    head: [['Município', 'Tipo Equipamento', 'Status', 'Data', 'NUP', 'Guarda', 'Patrulha', 'Kit Athena', 'Capacitação', 'Observações']],
    body: tableData,
    startY: startY,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [31, 81, 140] },
  });

  doc.save('solicitacoes.pdf');
}

export function exportSolicitacoesToExcel(solicitacoes: Solicitacao[]) {
  const data = solicitacoes.map((s) => ({
    'Município': s.municipio,
    'Tipo de Equipamento': s.tipo_equipamento,
    'Status': s.status,
    'Data da Solicitação': new Date(s.data_solicitacao).toLocaleDateString('pt-BR'),
    'NUP': s.suite_implantada || '',
    'Guarda Municipal Estruturada': s.guarda_municipal_estruturada ? 'Sim' : 'Não',
    'Recebeu Patrulha': s.recebeu_patrulha ? 'Sim' : 'Não',
    'Kit Athena Entregue': s.kit_athena_entregue ? 'Sim' : 'Não',
    'Capacitação Realizada': s.capacitacao_realizada ? 'Sim' : 'Não',
    'Observações': s.observacoes || '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Solicitações');
  XLSX.writeFile(wb, 'solicitacoes.xlsx');
}

// All data export - Complete version with all data
export function exportAllToPDF(
  equipamentos: Equipamento[],
  viaturas: Viatura[],
  solicitacoes: Solicitacao[]
) {
  const doc = new jsPDF();
  let currentY = 22;
  
  // Title
  doc.setFontSize(18);
  doc.text('Relatório Completo - EVM', 14, currentY);
  currentY += 8;
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, currentY);
  currentY += 12;
  
  // Calculate stats
  const totalEquipamentos = equipamentos.length;
  const equipamentosComPatrulha = equipamentos.filter(e => e.possui_patrulha).length;
  const viaturasVinculadas = viaturas.filter(v => v.vinculada_equipamento).reduce((sum, v) => sum + v.quantidade, 0);
  const viaturasNaoVinculadas = viaturas.filter(v => !v.vinculada_equipamento).reduce((sum, v) => sum + v.quantidade, 0);
  const totalViaturas = viaturas.reduce((sum, v) => sum + v.quantidade, 0);
  
  // Summary
  doc.setFontSize(12);
  doc.text('Resumo Geral:', 14, currentY);
  currentY += 8;
  doc.setFontSize(10);
  doc.text(`• Total de Equipamentos: ${totalEquipamentos}`, 14, currentY);
  currentY += 6;
  doc.text(`  - Com Patrulha Maria da Penha vinculada: ${equipamentosComPatrulha}`, 14, currentY);
  currentY += 6;
  doc.text(`  - Sem Patrulha Maria da Penha vinculada: ${totalEquipamentos - equipamentosComPatrulha}`, 14, currentY);
  currentY += 8;
  doc.text(`• Total de Viaturas (Patrulha Maria da Penha): ${totalViaturas}`, 14, currentY);
  currentY += 6;
  doc.text(`  - Vinculadas a equipamentos (Casas): ${viaturasVinculadas}`, 14, currentY);
  currentY += 6;
  doc.text(`  - Não vinculadas (PMCE/Polícia): ${viaturasNaoVinculadas}`, 14, currentY);
  currentY += 8;
  doc.text(`• Total de Solicitações: ${solicitacoes.length}`, 14, currentY);
  currentY += 12;
  
  // Equipamentos table - ALL
  doc.setFontSize(12);
  doc.text('Equipamentos:', 14, currentY);
  
  const eqData = equipamentos.map((e) => [
    e.municipio,
    e.tipo,
    e.responsavel || '-',
    e.telefone || '-',
    e.possui_patrulha ? 'Sim' : 'Não',
  ]);

  autoTable(doc, {
    head: [['Município', 'Tipo', 'Responsável', 'Telefone', 'Patrulha M.P.']],
    body: eqData,
    startY: currentY + 5,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [31, 81, 140] },
  });

  // New page for Viaturas
  doc.addPage();
  currentY = 22;
  
  doc.setFontSize(12);
  doc.text('Viaturas (Patrulha Maria da Penha):', 14, currentY);
  
  const vData = viaturas.map((v) => [
    v.municipio,
    v.tipo_patrulha,
    v.orgao_responsavel,
    v.quantidade.toString(),
    v.vinculada_equipamento ? 'Sim' : 'Não',
    v.responsavel || '-',
    new Date(v.data_implantacao).toLocaleDateString('pt-BR'),
  ]);

  autoTable(doc, {
    head: [['Município', 'Tipo', 'Órgão', 'Qtd', 'Vinculada', 'Responsável', 'Data Impl.']],
    body: vData,
    startY: currentY + 5,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [31, 81, 140] },
  });

  // New page for Solicitações
  doc.addPage();
  currentY = 22;
  
  doc.setFontSize(12);
  doc.text('Solicitações:', 14, currentY);
  
  const sData = solicitacoes.map((s) => [
    s.municipio,
    s.tipo_equipamento,
    s.status,
    new Date(s.data_solicitacao).toLocaleDateString('pt-BR'),
    s.suite_implantada || '-',
    s.guarda_municipal_estruturada ? 'Sim' : 'Não',
  ]);

  autoTable(doc, {
    head: [['Município', 'Tipo Equip.', 'Status', 'Data', 'NUP', 'Guarda']],
    body: sData,
    startY: currentY + 5,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [31, 81, 140] },
  });

  doc.save('relatorio-completo.pdf');
}

export function exportAllToExcel(
  equipamentos: Equipamento[],
  viaturas: Viatura[],
  solicitacoes: Solicitacao[]
) {
  const wb = XLSX.utils.book_new();

  // Equipamentos sheet - Complete data
  const eqData = equipamentos.map((e) => ({
    'Município': e.municipio,
    'Tipo': e.tipo,
    'Responsável': e.responsavel || '',
    'Telefone': e.telefone || '',
    'Endereço': e.endereco || '',
    'Possui Patrulha': e.possui_patrulha ? 'Sim' : 'Não',
    'Observações': e.observacoes || '',
    'Data Criação': new Date(e.created_at).toLocaleDateString('pt-BR'),
  }));
  const eqWs = XLSX.utils.json_to_sheet(eqData);
  XLSX.utils.book_append_sheet(wb, eqWs, 'Equipamentos');

  // Viaturas sheet - Complete data
  const vData = viaturas.map((v) => ({
    'Município': v.municipio,
    'Tipo de Patrulha': v.tipo_patrulha,
    'Órgão Responsável': v.orgao_responsavel,
    'Quantidade': v.quantidade,
    'Responsável': v.responsavel || '',
    'Vinculada a Equipamento': v.vinculada_equipamento ? 'Sim' : 'Não',
    'Data de Implantação': new Date(v.data_implantacao).toLocaleDateString('pt-BR'),
    'Observações': v.observacoes || '',
  }));
  const vWs = XLSX.utils.json_to_sheet(vData);
  XLSX.utils.book_append_sheet(wb, vWs, 'Viaturas');

  // Solicitações sheet - Complete data
  const sData = solicitacoes.map((s) => ({
    'Município': s.municipio,
    'Tipo de Equipamento': s.tipo_equipamento,
    'Status': s.status,
    'Data da Solicitação': new Date(s.data_solicitacao).toLocaleDateString('pt-BR'),
    'NUP': s.suite_implantada || '',
    'Guarda Municipal Estruturada': s.guarda_municipal_estruturada ? 'Sim' : 'Não',
    'Recebeu Patrulha': s.recebeu_patrulha ? 'Sim' : 'Não',
    'Kit Athena Entregue': s.kit_athena_entregue ? 'Sim' : 'Não',
    'Capacitação Realizada': s.capacitacao_realizada ? 'Sim' : 'Não',
    'Observações': s.observacoes || '',
  }));
  const sWs = XLSX.utils.json_to_sheet(sData);
  XLSX.utils.book_append_sheet(wb, sWs, 'Solicitações');

  XLSX.writeFile(wb, 'relatorio-completo.xlsx');
}

// Map export types
export interface MapExportFilters {
  tipoEquipamento: string;
  statusSolicitacao: string;
  apenasComViatura: boolean;
  regiao?: string;
}

export interface MapExportStats {
  brasileira: number;
  cearense: number;
  municipal: number;
  lilas: number;
  viaturaOnly: number;
  semCobertura: number;
}

export async function exportMapToPDF(
  mapElement: HTMLElement,
  filters: MapExportFilters,
  stats: MapExportStats
) {
  // Dynamic import of html2canvas
  const html2canvas = (await import('html2canvas')).default;
  
  const doc = new jsPDF('landscape');
  
  // Title
  doc.setFontSize(18);
  doc.text('Mapa do Ceará - EVM - Enfrentamento à Violência contra as Mulheres', 14, 22);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 30);
  
  // Capture map screenshot FIRST - wait for tiles to load
  let mapCaptured = false;
  try {
    // Find the leaflet container specifically
    const leafletContainer = mapElement.querySelector('.leaflet-container') as HTMLElement;
    const targetElement = leafletContainer || mapElement;
    
    // Wait a bit for tiles to render
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const canvas = await html2canvas(targetElement, {
      useCORS: true,
      allowTaint: true,
      scale: 2,
      logging: false,
      backgroundColor: '#f3f4f6',
      onclone: (clonedDoc) => {
        // Ensure SVG elements render properly
        const svgs = clonedDoc.querySelectorAll('svg');
        svgs.forEach(svg => {
          svg.setAttribute('width', svg.getBoundingClientRect().width.toString());
          svg.setAttribute('height', svg.getBoundingClientRect().height.toString());
        });
      }
    });
    
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 160;
    const imgHeight = (canvas.height / canvas.width) * imgWidth;
    
    doc.addImage(imgData, 'PNG', 130, 35, imgWidth, Math.min(imgHeight, 165));
    mapCaptured = true;
  } catch (error) {
    console.error('Error capturing map:', error);
  }
  
  // Filters applied
  doc.setFontSize(12);
  doc.text('Filtros Aplicados:', 14, 42);
  doc.setFontSize(10);
  doc.text(`• Região: ${filters.regiao && filters.regiao !== 'all' ? filters.regiao : 'Todas'}`, 14, 50);
  doc.text(`• Tipo de Equipamento: ${filters.tipoEquipamento === 'all' ? 'Todos' : filters.tipoEquipamento}`, 14, 56);
  doc.text(`• Status de Solicitação: ${filters.statusSolicitacao === 'all' ? 'Todos' : filters.statusSolicitacao}`, 14, 62);
  doc.text(`• Apenas com Viatura: ${filters.apenasComViatura ? 'Sim' : 'Não'}`, 14, 68);
  
  // Stats
  doc.setFontSize(12);
  doc.text('Estatísticas:', 14, 81);
  doc.setFontSize(10);
  doc.text(`• Casa da Mulher Brasileira: ${stats.brasileira}`, 14, 89);
  doc.text(`• Casa da Mulher Cearense: ${stats.cearense}`, 14, 95);
  doc.text(`• Casa da Mulher Municipal: ${stats.municipal}`, 14, 101);
  doc.text(`• Sala Lilás: ${stats.lilas}`, 14, 107);
  doc.text(`• Apenas Viatura: ${stats.viaturaOnly}`, 14, 113);
  doc.text(`• Sem Cobertura: ${stats.semCobertura}`, 14, 119);
  
  const totalComEquipamento = stats.brasileira + stats.cearense + stats.municipal + stats.lilas;
  doc.setFontSize(12);
  doc.text(`Cobertura Total: ${(totalComEquipamento / 184 * 100).toFixed(2)}% (${totalComEquipamento}/184 municípios)`, 14, 131);
  
  if (!mapCaptured) {
    doc.setFontSize(10);
    doc.text('(Não foi possível capturar a imagem do mapa)', 180, 105);
  }
  
  doc.save('mapa-ceara.pdf');
}
