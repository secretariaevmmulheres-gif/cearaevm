import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Equipamento, Viatura, Solicitacao } from '@/types';

// Equipamentos export
export function exportEquipamentosToPDF(equipamentos: Equipamento[]) {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text('Relatório de Equipamentos', 14, 22);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 30);
  
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
    startY: 35,
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
export function exportSolicitacoesToPDF(solicitacoes: Solicitacao[]) {
  const doc = new jsPDF('landscape');
  
  doc.setFontSize(18);
  doc.text('Relatório de Solicitações', 14, 22);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 30);
  
  const tableData = solicitacoes.map((s) => [
    s.municipio,
    s.tipo_equipamento,
    s.status,
    new Date(s.data_solicitacao).toLocaleDateString('pt-BR'),
    s.suite_implantada || '-',
    s.guarda_municipal_estruturada ? 'Sim' : 'Não',
    s.recebeu_patrulha ? 'Sim' : 'Não',
  ]);

  autoTable(doc, {
    head: [['Município', 'Tipo Equipamento', 'Status', 'Data', 'NUP', 'Guarda', 'Patrulha']],
    body: tableData,
    startY: 35,
    styles: { fontSize: 8 },
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
  doc.text('Relatório Completo - Sistema de Gestão', 14, currentY);
  currentY += 8;
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, currentY);
  currentY += 12;
  
  // Summary
  doc.setFontSize(12);
  doc.text('Resumo Geral:', 14, currentY);
  currentY += 8;
  doc.setFontSize(10);
  doc.text(`• Total de Equipamentos: ${equipamentos.length}`, 14, currentY);
  currentY += 6;
  doc.text(`• Total de Viaturas: ${viaturas.reduce((sum, v) => sum + v.quantidade, 0)}`, 14, currentY);
  currentY += 6;
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
    head: [['Município', 'Tipo', 'Responsável', 'Telefone', 'Patrulha']],
    body: eqData,
    startY: currentY + 5,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [31, 81, 140] },
  });

  // New page for Viaturas
  doc.addPage();
  currentY = 22;
  
  doc.setFontSize(12);
  doc.text('Viaturas:', 14, currentY);
  
  const vData = viaturas.map((v) => [
    v.municipio,
    v.tipo_patrulha,
    v.orgao_responsavel,
    v.quantidade.toString(),
    v.responsavel || '-',
    new Date(v.data_implantacao).toLocaleDateString('pt-BR'),
  ]);

  autoTable(doc, {
    head: [['Município', 'Tipo', 'Órgão', 'Qtd', 'Responsável', 'Data Implantação']],
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
  doc.text('Mapa do Ceará - Rede de Atendimento à Mulher', 14, 22);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 30);
  
  // Filters applied
  doc.setFontSize(12);
  doc.text('Filtros Aplicados:', 14, 42);
  doc.setFontSize(10);
  doc.text(`• Tipo de Equipamento: ${filters.tipoEquipamento === 'all' ? 'Todos' : filters.tipoEquipamento}`, 14, 50);
  doc.text(`• Status de Solicitação: ${filters.statusSolicitacao === 'all' ? 'Todos' : filters.statusSolicitacao}`, 14, 56);
  doc.text(`• Apenas com Viatura: ${filters.apenasComViatura ? 'Sim' : 'Não'}`, 14, 62);
  
  // Stats
  doc.setFontSize(12);
  doc.text('Estatísticas:', 14, 75);
  doc.setFontSize(10);
  doc.text(`• Casa da Mulher Brasileira: ${stats.brasileira}`, 14, 83);
  doc.text(`• Casa da Mulher Cearense: ${stats.cearense}`, 14, 89);
  doc.text(`• Casa da Mulher Municipal: ${stats.municipal}`, 14, 95);
  doc.text(`• Sala Lilás: ${stats.lilas}`, 14, 101);
  doc.text(`• Apenas Viatura: ${stats.viaturaOnly}`, 14, 107);
  doc.text(`• Sem Cobertura: ${stats.semCobertura}`, 14, 113);
  
  const totalComEquipamento = stats.brasileira + stats.cearense + stats.municipal + stats.lilas;
  doc.setFontSize(12);
  doc.text(`Cobertura Total: ${(totalComEquipamento / 184 * 100).toFixed(1)}% (${totalComEquipamento}/184 municípios)`, 14, 125);
  
  // Capture map screenshot
  try {
    const canvas = await html2canvas(mapElement, {
      useCORS: true,
      allowTaint: true,
      scale: 2,
    });
    
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 150;
    const imgHeight = (canvas.height / canvas.width) * imgWidth;
    
    doc.addImage(imgData, 'PNG', 140, 40, imgWidth, Math.min(imgHeight, 160));
  } catch (error) {
    console.error('Error capturing map:', error);
    doc.text('(Não foi possível capturar a imagem do mapa)', 180, 100);
  }
  
  doc.save('mapa-ceara.pdf');
}
