import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Equipamento, Viatura, Solicitacao } from '@/types';
import { getRegiao, RegiaoPlanejamento } from '@/data/municipios';
import { ts, fmtDate, lastY, addPdfCover, addPdfHeader, addPdfFooters, styleWorksheet, saveWb } from './shared';

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

export async function exportRegionalToPDF(regionStats: RegionStatsExport, equipamentos: Equipamento[], viaturas: Viatura[], solicitacoes: Solicitacao[]) {
  const doc = new jsPDF();

  // ── Capa ──────────────────────────────────────────────────────────────────
  await addPdfCover(doc, {
    titulo:    `REGIÃO ${regionStats.regiao.toUpperCase()}`,
    subtitulo: 'Dashboard Regional — Rede EVM de Proteção à Mulher',
    colorKey:  'regional',
    landscape: false,
    stats: [
      { label: 'Equipamentos',      valor: regionStats.totalEquipamentos },
      { label: 'Cobertura',         valor: `${regionStats.cobertura.toFixed(1)}%` },
      { label: 'Solicitações',      valor: regionStats.totalSolicitacoes },
      { label: 'Municípios',        valor: `${regionStats.municipiosComEquipamento}/${regionStats.totalMunicipios}` },
    ],
  });

  doc.addPage();
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

export async function exportAllRegionsToPDF(regionStats: RegionStatsExport[], equipamentos: Equipamento[], viaturas: Viatura[], solicitacoes: Solicitacao[]) {
  const doc = new jsPDF();

  // ── Pré-calcular totais para a capa ───────────────────────────────────────
  const totalEquipamentos      = equipamentos.length;
  const equipamentosComPatrulha = equipamentos.filter(e => e.possui_patrulha).length;
  const municipiosComPatrulhaEquip = new Set(equipamentos.filter(e => e.possui_patrulha).map(e => e.municipio));
  const patrulhasSolicitacoes  = solicitacoes.filter(s => s.recebeu_patrulha && !municipiosComPatrulhaEquip.has(s.municipio)).length;
  const totalPatrulhasCasas    = equipamentosComPatrulha + patrulhasSolicitacoes;
  const totalViaturasPMCE      = viaturas.reduce((sum, v) => sum + v.quantidade, 0);
  const viaturasVinculadas     = viaturas.filter(v => v.vinculada_equipamento).reduce((sum, v) => sum + v.quantidade, 0);
  const viaturasNaoVinculadas  = viaturas.filter(v => !v.vinculada_equipamento).reduce((sum, v) => sum + v.quantidade, 0);
  const totalSolicitacoes      = solicitacoes.length;
  const solicitacoesEmAndamento = solicitacoes.filter(s => ['Recebida', 'Em análise', 'Aprovada', 'Em implantação'].includes(s.status)).length;
  const solicitacoesInauguradas = solicitacoes.filter(s => s.status === 'Inaugurada').length;
  const solicitacoesCanceladas  = solicitacoes.filter(s => s.status === 'Cancelada').length;
  const mediaCobertura         = regionStats.reduce((sum, r) => sum + r.cobertura, 0) / regionStats.length;

  // ── Capa ──────────────────────────────────────────────────────────────────
  await addPdfCover(doc, {
    titulo:    'DASHBOARD REGIONAL CONSOLIDADO',
    subtitulo: '14 Regiões de Planejamento — Estado do Ceará',
    colorKey:  'regional',
    landscape: false,
    stats: [
      { label: 'Equipamentos',        valor: totalEquipamentos },
      { label: 'Cobertura Média',     valor: `${mediaCobertura.toFixed(1)}%` },
      { label: 'Viaturas PMCE',       valor: totalViaturasPMCE },
      { label: 'Solicitações',        valor: totalSolicitacoes },
    ],
  });

  // ── Resumo geral ──────────────────────────────────────────────────────────
  doc.addPage();
  let currentY = addPdfHeader(doc, 'Dashboard Regional', 'Relatório Consolidado — 14 Regiões de Planejamento');
  currentY += 4;

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