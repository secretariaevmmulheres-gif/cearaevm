import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Equipamento, Viatura, Solicitacao } from '@/types';
import { regioesList, getRegiao, getMunicipiosPorRegiao, RegiaoPlanejamento } from '@/data/municipios';

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

// Export single region to PDF
export function exportRegionalToPDF(
  regionStats: RegionStatsExport,
  equipamentos: Equipamento[],
  viaturas: Viatura[],
  solicitacoes: Solicitacao[]
) {
  const doc = new jsPDF();
  let currentY = 22;

  // Header
  doc.setFontSize(16);
  doc.text(`Relatório Regional - ${regionStats.regiao}`, 14, currentY);
  currentY += 8;
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, currentY);
  currentY += 12;

  // Summary
  doc.setFontSize(12);
  doc.text('Resumo da Região:', 14, currentY);
  currentY += 8;
  doc.setFontSize(10);
  doc.text(`• Total de Municípios: ${regionStats.totalMunicipios}`, 14, currentY);
  currentY += 6;
  doc.text(`• Municípios com Equipamento: ${regionStats.municipiosComEquipamento}`, 14, currentY);
  currentY += 6;
  doc.text(`• Cobertura: ${regionStats.cobertura.toFixed(2)}%`, 14, currentY);
  currentY += 8;
  doc.text(`• Total de Equipamentos: ${regionStats.totalEquipamentos}`, 14, currentY);
  currentY += 6;
  doc.text(`• Total de Patrulhas M.P.: ${regionStats.totalViaturas}`, 14, currentY);
  currentY += 6;
  doc.text(`  - Em equipamentos: ${regionStats.patrulhasEmEquipamentos}`, 14, currentY);
  currentY += 6;
  doc.text(`  - PMCE: ${regionStats.viaturasNaoVinculadas}`, 14, currentY);
  currentY += 6;
  doc.text(`• Total de Solicitações: ${regionStats.totalSolicitacoes}`, 14, currentY);
  currentY += 6;
  doc.text(`• Solicitações em Andamento: ${regionStats.solicitacoesEmAndamento}`, 14, currentY);
  currentY += 12;

  // Equipamentos table
  const regionEquipamentos = equipamentos.filter(e => getRegiao(e.municipio) === regionStats.regiao);
  if (regionEquipamentos.length > 0) {
    doc.setFontSize(12);
    doc.text('Equipamentos:', 14, currentY);
    
    const eqData = regionEquipamentos.map((e) => [
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

    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Viaturas table
  const regionViaturas = viaturas.filter(v => getRegiao(v.municipio) === regionStats.regiao);
  if (regionViaturas.length > 0) {
    if (currentY > 200) {
      doc.addPage();
      currentY = 22;
    }
    
    doc.setFontSize(12);
    doc.text('Viaturas:', 14, currentY);
    
    const vData = regionViaturas.map((v) => [
      v.municipio,
      v.tipo_patrulha,
      v.orgao_responsavel,
      v.quantidade.toString(),
      v.vinculada_equipamento ? 'Sim' : 'Não',
    ]);

    autoTable(doc, {
      head: [['Município', 'Tipo', 'Órgão', 'Qtd', 'Vinculada']],
      body: vData,
      startY: currentY + 5,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [31, 81, 140] },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Solicitações table
  const regionSolicitacoes = solicitacoes.filter(s => getRegiao(s.municipio) === regionStats.regiao);
  if (regionSolicitacoes.length > 0) {
    if (currentY > 200) {
      doc.addPage();
      currentY = 22;
    }
    
    doc.setFontSize(12);
    doc.text('Solicitações:', 14, currentY);
    
    const sData = regionSolicitacoes.map((s) => [
      s.municipio,
      s.tipo_equipamento,
      s.status,
      new Date(s.data_solicitacao).toLocaleDateString('pt-BR'),
    ]);

    autoTable(doc, {
      head: [['Município', 'Tipo', 'Status', 'Data']],
      body: sData,
      startY: currentY + 5,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [31, 81, 140] },
    });
  }

  doc.save(`dashboard-regional-${regionStats.regiao.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

// Export ALL regions to single PDF
export function exportAllRegionsToPDF(
  regionStats: RegionStatsExport[],
  equipamentos: Equipamento[],
  viaturas: Viatura[],
  solicitacoes: Solicitacao[]
) {
  const doc = new jsPDF();
  let currentY = 22;

  // Cover page
  doc.setFontSize(20);
  doc.text('Dashboard Regional Consolidado', 14, currentY);
  currentY += 10;
  doc.setFontSize(12);
  doc.text('EVM - Enfrentamento à Violência contra as Mulheres', 14, currentY);
  currentY += 8;
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, currentY);
  currentY += 15;

  // Overall summary
  const totalEquipamentos = equipamentos.length;
  const totalViaturas = viaturas.reduce((sum, v) => sum + v.quantidade, 0);
  const patrulhasEmCasas = equipamentos.filter(e => e.possui_patrulha).length;
  const totalSolicitacoes = solicitacoes.length;
  const mediaCobertura = regionStats.reduce((sum, r) => sum + r.cobertura, 0) / regionStats.length;

  doc.setFontSize(12);
  doc.text('Resumo Geral - Estado do Ceará:', 14, currentY);
  currentY += 8;
  doc.setFontSize(10);
  doc.text(`• Total de Equipamentos: ${totalEquipamentos}`, 14, currentY);
  currentY += 6;
  doc.text(`• Total de Patrulhas M.P.: ${totalViaturas + patrulhasEmCasas}`, 14, currentY);
  currentY += 6;
  doc.text(`• Total de Solicitações: ${totalSolicitacoes}`, 14, currentY);
  currentY += 6;
  doc.text(`• Média de Cobertura: ${mediaCobertura.toFixed(2)}%`, 14, currentY);
  currentY += 12;

  // Ranking table
  doc.setFontSize(12);
  doc.text('Ranking das Regiões por Cobertura:', 14, currentY);

  const rankingData = regionStats.map((r, idx) => [
    (idx + 1).toString(),
    r.regiao,
    r.totalMunicipios.toString(),
    r.totalEquipamentos.toString(),
    r.totalViaturas.toString(),
    r.totalSolicitacoes.toString(),
    `${r.cobertura.toFixed(2)}%`,
  ]);

  autoTable(doc, {
    head: [['#', 'Região', 'Municípios', 'Equip.', 'Viaturas', 'Solic.', 'Cobertura']],
    body: rankingData,
    startY: currentY + 5,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [31, 81, 140] },
  });

  // Individual region pages
  regionStats.forEach((region, index) => {
    doc.addPage();
    currentY = 22;

    // Region header
    doc.setFontSize(16);
    doc.text(`${index + 1}. ${region.regiao}`, 14, currentY);
    currentY += 10;
    
    // Region stats
    doc.setFontSize(10);
    doc.text(`Municípios: ${region.totalMunicipios} | Com Equipamento: ${region.municipiosComEquipamento} | Cobertura: ${region.cobertura.toFixed(2)}%`, 14, currentY);
    currentY += 6;
    doc.text(`Equipamentos: ${region.totalEquipamentos} | Patrulhas M.P.: ${region.totalViaturas} | Solicitações: ${region.totalSolicitacoes}`, 14, currentY);
    currentY += 10;

    // Equipamentos da região
    const regionEquipamentos = equipamentos.filter(e => getRegiao(e.municipio) === region.regiao);
    if (regionEquipamentos.length > 0) {
      doc.setFontSize(11);
      doc.text('Equipamentos:', 14, currentY);
      
      const eqData = regionEquipamentos.map((e) => [
        e.municipio,
        e.tipo,
        e.responsavel || '-',
        e.possui_patrulha ? 'Sim' : 'Não',
      ]);

      autoTable(doc, {
        head: [['Município', 'Tipo', 'Responsável', 'Patrulha']],
        body: eqData,
        startY: currentY + 4,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [31, 81, 140] },
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    } else {
      doc.setFontSize(10);
      doc.text('Nenhum equipamento cadastrado nesta região.', 14, currentY);
      currentY += 8;
    }

    // Viaturas da região
    const regionViaturas = viaturas.filter(v => getRegiao(v.municipio) === region.regiao);
    if (regionViaturas.length > 0) {
      if (currentY > 220) {
        doc.addPage();
        currentY = 22;
      }
      
      doc.setFontSize(11);
      doc.text('Viaturas:', 14, currentY);
      
      const vData = regionViaturas.map((v) => [
        v.municipio,
        v.tipo_patrulha,
        v.orgao_responsavel,
        v.quantidade.toString(),
      ]);

      autoTable(doc, {
        head: [['Município', 'Tipo', 'Órgão', 'Qtd']],
        body: vData,
        startY: currentY + 4,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [31, 81, 140] },
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    // Solicitações da região
    const regionSolicitacoes = solicitacoes.filter(s => getRegiao(s.municipio) === region.regiao);
    if (regionSolicitacoes.length > 0) {
      if (currentY > 220) {
        doc.addPage();
        currentY = 22;
      }
      
      doc.setFontSize(11);
      doc.text('Solicitações:', 14, currentY);
      
      const sData = regionSolicitacoes.map((s) => [
        s.municipio,
        s.tipo_equipamento,
        s.status,
        new Date(s.data_solicitacao).toLocaleDateString('pt-BR'),
      ]);

      autoTable(doc, {
        head: [['Município', 'Tipo', 'Status', 'Data']],
        body: sData,
        startY: currentY + 4,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [31, 81, 140] },
      });
    }
  });

  doc.save('dashboard-regional-consolidado.pdf');
}

// Export ALL regions to Excel
export function exportAllRegionsToExcel(
  regionStats: RegionStatsExport[],
  equipamentos: Equipamento[],
  viaturas: Viatura[],
  solicitacoes: Solicitacao[]
) {
  const wb = XLSX.utils.book_new();

  // Summary sheet
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
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumo Regiões');

  // Equipamentos by region
  regioesList.forEach((regiao) => {
    const regionEquipamentos = equipamentos.filter(e => getRegiao(e.municipio) === regiao);
    if (regionEquipamentos.length > 0) {
      const eqData = regionEquipamentos.map((e) => ({
        'Município': e.municipio,
        'Tipo': e.tipo,
        'Responsável': e.responsavel || '',
        'Telefone': e.telefone || '',
        'Endereço': e.endereco || '',
        'Patrulha M.P.': e.possui_patrulha ? 'Sim' : 'Não',
      }));
      const sheetName = regiao.length > 28 ? regiao.substring(0, 28) + '...' : regiao;
      const ws = XLSX.utils.json_to_sheet(eqData);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
  });

  XLSX.writeFile(wb, 'dashboard-regional-consolidado.xlsx');
}

// Patrulhas das Casas export
export function exportPatrulhasCasasToPDF(equipamentos: Equipamento[]) {
  const patrulhas = equipamentos.filter((e) => e.possui_patrulha);
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text('Relatório de Patrulhas Maria da Penha das Casas', 14, 22);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 30);
  doc.text(`Total de registros: ${patrulhas.length}`, 14, 38);
  
  const tableData = patrulhas.map((e) => [
    e.municipio,
    e.tipo,
    e.endereco || '-',
    e.responsavel || '-',
    e.telefone || '-',
  ]);

  autoTable(doc, {
    head: [['Município', 'Tipo de Equipamento', 'Endereço', 'Responsável', 'Telefone']],
    body: tableData,
    startY: 45,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [16, 185, 129] },
  });

  doc.save('patrulhas-casas.pdf');
}

export function exportPatrulhasCasasToExcel(equipamentos: Equipamento[]) {
  const patrulhas = equipamentos.filter((e) => e.possui_patrulha);
  
  const data = patrulhas.map((e) => ({
    'Município': e.municipio,
    'Tipo de Equipamento': e.tipo,
    'Endereço': e.endereco || '',
    'Responsável': e.responsavel || '',
    'Telefone': e.telefone || '',
    'Observações': e.observacoes || '',
    'Data de Criação': new Date(e.created_at).toLocaleDateString('pt-BR'),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Patrulhas Casas');
  XLSX.writeFile(wb, 'patrulhas-casas.xlsx');
}

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

// Regional goals (monthly) export types
export interface RegionalGoalsExportRow {
  regiao: string;
  status: string;
  equipamentos: { current: number; goal: number; progress: number };
  viaturas: { current: number; goal: number; progress: number };
  cobertura: { current: number; goal: number; progress: number };
  overallProgress: number;
  expectedProgress: number;
}

export interface RegionalGoalsExportPayload {
  monthLabel: string;
  generatedAt: Date;
  summary: {
    achieved: number;
    onTrack: number;
    atRisk: number;
    behind: number;
    avgProgress: number;
  };
  rows: RegionalGoalsExportRow[];
}

export function exportRegionalGoalsToPDF(payload: RegionalGoalsExportPayload) {
  const doc = new jsPDF('landscape');

  doc.setFontSize(16);
  doc.text('Painel de Metas Mensais - Regiões (Consolidado)', 14, 18);
  doc.setFontSize(10);
  doc.text(`Mês: ${payload.monthLabel}`, 14, 26);
  doc.text(
    `Gerado em: ${payload.generatedAt.toLocaleDateString('pt-BR')} às ${payload.generatedAt.toLocaleTimeString('pt-BR')}`,
    14,
    32
  );

  // Summary badges
  doc.setFontSize(10);
  doc.text(
    `Resumo: ${payload.summary.achieved} atingidas • ${payload.summary.onTrack} no caminho • ${payload.summary.atRisk} em risco • ${payload.summary.behind} atrasadas • Média ${payload.summary.avgProgress.toFixed(0)}%`,
    14,
    40
  );

  autoTable(doc, {
    startY: 46,
    head: [[
      'Região',
      'Status',
      'Equip. (atual/meta)',
      'Equip. %',
      'Viaturas (atual/meta)',
      'Viaturas %',
      'Cobertura (atual/meta)',
      'Cobertura %',
      'Geral %',
      'Esperado %',
    ]],
    body: payload.rows.map((r) => [
      r.regiao,
      r.status,
      `${r.equipamentos.current}/${r.equipamentos.goal}`,
      `${Math.round(r.equipamentos.progress)}%`,
      `${r.viaturas.current}/${r.viaturas.goal}`,
      `${Math.round(r.viaturas.progress)}%`,
      `${r.cobertura.current.toFixed(1)}%/${r.cobertura.goal}%`,
      `${Math.round(r.cobertura.progress)}%`,
      `${Math.round(r.overallProgress)}%`,
      `${Math.round(r.expectedProgress)}%`,
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [31, 81, 140] },
    didDrawCell: (data) => {
      // Render mini progress bars in percentage columns
      const col = data.column.index;
      const isPercentCol = [3, 5, 7, 8].includes(col);
      if (!isPercentCol || data.section !== 'body') return;

      const text = String(data.cell.text?.[0] ?? '').replace('%', '');
      const pct = Math.max(0, Math.min(100, Number(text)));
      if (Number.isNaN(pct)) return;

      const barX = data.cell.x + 1;
      const barY = data.cell.y + data.cell.height - 2.5;
      const barW = data.cell.width - 2;
      const fillW = (barW * pct) / 100;

      // background
      doc.setFillColor(229, 231, 235);
      doc.rect(barX, barY, barW, 1.5, 'F');

      // fill (green >=100, blue >=75, amber >=50, red <50)
      if (pct >= 100) doc.setFillColor(16, 185, 129);
      else if (pct >= 75) doc.setFillColor(59, 130, 246);
      else if (pct >= 50) doc.setFillColor(245, 158, 11);
      else doc.setFillColor(239, 68, 68);

      doc.rect(barX, barY, fillW, 1.5, 'F');
    },
  });

  doc.save(`metas-regionais-${payload.monthLabel.toLowerCase().replace(/\s+/g, '-')}.pdf`);
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
  
  // Capture map screenshot - use the SVG overlay for proper colors
  let mapCaptured = false;
  try {
    // Prefer capturing the wrapper element (stable positioning) and let html2canvas compute bounds
    const targetElement = mapElement;

    // Wait for tiles to fully render
    await new Promise(resolve => setTimeout(resolve, 900));

    const canvas = await html2canvas(targetElement, {
      useCORS: true,
      allowTaint: true,
      scale: 2,
      logging: false,
      backgroundColor: '#f8fafc',
      // Critical to avoid offset/skew when the page is scrolled or the element isn't at (0,0)
      scrollX: -window.scrollX,
      scrollY: -window.scrollY,
      onclone: (clonedDoc) => {
        // Ensure SVG paths render with correct colors
        const paths = clonedDoc.querySelectorAll('path');
        paths.forEach(path => {
          const fill = path.getAttribute('fill');
          if (fill) path.style.fill = fill;
          const stroke = path.getAttribute('stroke');
          if (stroke) path.style.stroke = stroke;
        });
      },
    });
    
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 155;
    const imgHeight = (canvas.height / canvas.width) * imgWidth;
    
    doc.addImage(imgData, 'PNG', 135, 35, imgWidth, Math.min(imgHeight, 160));
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
