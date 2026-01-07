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

// All data export
export function exportAllToPDF(
  equipamentos: Equipamento[],
  viaturas: Viatura[],
  solicitacoes: Solicitacao[]
) {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text('Relatório Completo - Sistema de Gestão', 14, 22);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 30);
  
  // Summary
  doc.setFontSize(12);
  doc.text('Resumo:', 14, 42);
  doc.setFontSize(10);
  doc.text(`• Total de Equipamentos: ${equipamentos.length}`, 14, 50);
  doc.text(`• Total de Viaturas: ${viaturas.reduce((sum, v) => sum + v.quantidade, 0)}`, 14, 56);
  doc.text(`• Total de Solicitações: ${solicitacoes.length}`, 14, 62);
  
  // Equipamentos table
  doc.setFontSize(12);
  doc.text('Equipamentos:', 14, 75);
  
  const eqData = equipamentos.slice(0, 15).map((e) => [
    e.municipio,
    e.tipo,
    e.possui_patrulha ? 'Sim' : 'Não',
  ]);

  autoTable(doc, {
    head: [['Município', 'Tipo', 'Patrulha']],
    body: eqData,
    startY: 80,
    styles: { fontSize: 8 },
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

  // Equipamentos sheet
  const eqData = equipamentos.map((e) => ({
    'Município': e.municipio,
    'Tipo': e.tipo,
    'Responsável': e.responsavel || '',
    'Telefone': e.telefone || '',
    'Possui Patrulha': e.possui_patrulha ? 'Sim' : 'Não',
  }));
  const eqWs = XLSX.utils.json_to_sheet(eqData);
  XLSX.utils.book_append_sheet(wb, eqWs, 'Equipamentos');

  // Viaturas sheet
  const vData = viaturas.map((v) => ({
    'Município': v.municipio,
    'Tipo de Patrulha': v.tipo_patrulha,
    'Órgão Responsável': v.orgao_responsavel,
    'Quantidade': v.quantidade,
    'Data de Implantação': new Date(v.data_implantacao).toLocaleDateString('pt-BR'),
  }));
  const vWs = XLSX.utils.json_to_sheet(vData);
  XLSX.utils.book_append_sheet(wb, vWs, 'Viaturas');

  // Solicitações sheet
  const sData = solicitacoes.map((s) => ({
    'Município': s.municipio,
    'Tipo de Equipamento': s.tipo_equipamento,
    'Status': s.status,
    'Data da Solicitação': new Date(s.data_solicitacao).toLocaleDateString('pt-BR'),
    'NUP': s.suite_implantada || '',
  }));
  const sWs = XLSX.utils.json_to_sheet(sData);
  XLSX.utils.book_append_sheet(wb, sWs, 'Solicitações');

  XLSX.writeFile(wb, 'relatorio-completo.xlsx');
}
