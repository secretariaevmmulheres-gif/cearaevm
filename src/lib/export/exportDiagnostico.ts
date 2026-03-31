import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Equipamento, Solicitacao } from '@/types';
import { getRegiao } from '@/data/municipios';
import { ts, lastY, addPdfCover, addPdfHeader, addPdfFooters, styleWorksheet, saveWb } from './shared';

const TIPOS_COM_PATRULHA = new Set(['Casa da Mulher Municipal']);
const TIPOS_SEM_KIT      = new Set(['Casa da Mulher Brasileira', 'Casa da Mulher Cearense', 'DDM']);

export interface DiagnosticoFiltros {
  regiaoFiltro?: string;
  diasSemMovimento?: number;
}

export interface PendenciaMunicipio {
  itemId: string;
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
    if (!TIPOS_SEM_KIT.has(e.tipo)     && !e.kit_athena_entregue) pendencias.push('Sem Kit Athena');
    if (!e.capacitacao_realizada)                                pendencias.push('Sem Qualificação');
    if (pendencias.length > 0) {
      resultado.push({ itemId: e.id, municipio: e.municipio, regiao: getRegiao(e.municipio) || '—', tipo: e.tipo, pendencias, origem: 'Equipamento' });
    }
  });

  const solics = regiaoFiltro
    ? solicitacoes.filter(s => getRegiao(s.municipio) === regiaoFiltro)
    : solicitacoes;

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

export async function exportDiagnosticoToPDF(
  equipamentos: Equipamento[],
  solicitacoes: Solicitacao[],
  filtros: DiagnosticoFiltros = {}
): Promise<void> {
  const pendencias = gerarDiagnostico(equipamentos, solicitacoes, filtros);
  const doc = new jsPDF();
  const PW  = doc.internal.pageSize.getWidth();

  // ── Capa ──────────────────────────────────────────────────────────────────
  const totalEquips  = pendencias.filter(p => p.origem === 'Equipamento').length;
  const totalSolics  = pendencias.filter(p => p.origem === 'Solicitação').length;
  const regioesCnt   = new Set(pendencias.map(p => p.regiao)).size;

  await addPdfCover(doc, {
    titulo:    'DIAGNÓSTICO DE PENDÊNCIAS',
    subtitulo: 'Análise de equipamentos e solicitações com alertas — Ceará',
    colorKey:  'diagnostico',
    landscape: false,
    descricao: filtros.regiaoFiltro ? `Região: ${filtros.regiaoFiltro}` : 'Todas as regiões do Estado',
    stats: pendencias.length > 0 ? [
      { label: 'Total de Pendências',   valor: pendencias.length },
      { label: 'Em Equipamentos',       valor: totalEquips },
      { label: 'Em Solicitações',       valor: totalSolics },
      { label: 'Regiões com Alertas',   valor: regioesCnt },
    ] : undefined,
  });

  doc.addPage();

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

export function exportDiagnosticoToExcel(
  equipamentos: Equipamento[],
  solicitacoes: Solicitacao[],
  filtros: DiagnosticoFiltros = {}
): void {
  const pendencias = gerarDiagnostico(equipamentos, solicitacoes, filtros);
  const wb = XLSX.utils.book_new();

  const contPorTipo: Record<string, number> = {};
  const contPorRegiao: Record<string, number> = {};
  pendencias.forEach(p => {
    p.pendencias.forEach(pen => { contPorTipo[pen] = (contPorTipo[pen] || 0) + 1; });
    contPorRegiao[p.regiao] = (contPorRegiao[p.regiao] || 0) + 1;
  });

  const resumoData = [
    ...Object.entries(contPorTipo).sort((a, b) => b[1] - a[1]).map(([pendencia, total]) => ({ 'Tipo de Pendência': pendencia, 'Total': total, 'Categoria': 'Por tipo' })),
    ...Object.entries(contPorRegiao).sort((a, b) => b[1] - a[1]).map(([regiao, total]) => ({ 'Tipo de Pendência': regiao, 'Total': total, 'Categoria': 'Por região' })),
  ];
  const wsResumo = XLSX.utils.json_to_sheet(resumoData);
  styleWorksheet(wsResumo, 'EF4444');
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

  const equipsData = pendencias.filter(p => p.origem === 'Equipamento').map(p => ({
    'Município': p.municipio, 'Região': p.regiao, 'Tipo de Equipamento': p.tipo,
    'Pendências': p.pendencias.join(' · '), 'Qtd. Pendências': p.pendencias.length,
    'Sem Patrulha M.P.': p.pendencias.includes('Sem Patrulha M.P.') ? 'Sim' : '',
    'Sem Kit Athena':    p.pendencias.includes('Sem Kit Athena') ? 'Sim' : '',
    'Sem Qualificação':  p.pendencias.includes('Sem Qualificação') ? 'Sim' : '',
  }));
  if (equipsData.length > 0) {
    const wsEquips = XLSX.utils.json_to_sheet(equipsData);
    styleWorksheet(wsEquips, 'EF4444');
    XLSX.utils.book_append_sheet(wb, wsEquips, 'Equipamentos');
  }

  const solicsData = pendencias.filter(p => p.origem === 'Solicitação').map(p => ({
    'Município': p.municipio, 'Região': p.regiao, 'Tipo': p.tipo, 'Status': p.status || '',
    'Alertas': p.pendencias.join(' · '), 'Dias sem movimento': p.diasSemMovimento ?? '',
    'Sem NUP': p.pendencias.includes('Sem NUP registrado') ? 'Sim' : '',
  }));
  if (solicsData.length > 0) {
    const wsSolics = XLSX.utils.json_to_sheet(solicsData);
    styleWorksheet(wsSolics, 'F59E0B');
    XLSX.utils.book_append_sheet(wb, wsSolics, 'Solicitações');
  }

  const todosData = pendencias.map(p => ({
    'Município': p.municipio, 'Região': p.regiao, 'Tipo': p.tipo, 'Origem': p.origem,
    'Status': p.status || '', 'Pendências': p.pendencias.join(' · '),
    'Qtd. Pendências': p.pendencias.length, 'Dias sem movimento': p.diasSemMovimento ?? '',
    'Filtro Região': filtros.regiaoFiltro || 'Todas', 'Threshold (dias)': filtros.diasSemMovimento ?? 60,
    'Gerado em': new Date().toLocaleString('pt-BR'),
  }));
  const wsTodos = XLSX.utils.json_to_sheet(todosData);
  styleWorksheet(wsTodos, 'EF4444');
  XLSX.utils.book_append_sheet(wb, wsTodos, 'Todos');

  saveWb(wb, `diagnostico-evm_${ts()}.xlsx`);
}