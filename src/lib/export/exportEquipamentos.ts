import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Equipamento, Patrulha, Solicitacao } from '@/types';
import { getRegiao } from '@/data/municipios';
import { ts, fmtDate, addPdfCover, addPdfHeader, addPdfFooters, styleWorksheet, saveWb } from './shared';
import type { QualificacaoExport } from './exportQualificacoes';

// Ordem e cores dos tipos de equipamento
const TIPOS_EQUIPAMENTO = [
  { tipo: 'Casa da Mulher Brasileira',    sigla: 'CMB',  cor: [16,  185, 129] as [number,number,number] },
  { tipo: 'Casa da Mulher Cearense',      sigla: 'CMC',  cor: [99,  102, 241] as [number,number,number] },
  { tipo: 'Casa da Mulher Municipal',     sigla: 'CMM',  cor: [59,  130, 246] as [number,number,number] },
  { tipo: 'Sala Lilás Municipal',         sigla: 'SLM',  cor: [168, 85,  247] as [number,number,number] },
  { tipo: 'Sala Lilás Governo do Estado', sigla: 'SLE',  cor: [139, 92,  246] as [number,number,number] },
  { tipo: 'Sala Lilás em Delegacia',      sigla: 'SLD',  cor: [124, 58,  237] as [number,number,number] },
  { tipo: 'DDM',                          sigla: 'DDM',  cor: [234, 88,  12]  as [number,number,number] },
];

export async function exportEquipamentosToPDF(
  equipamentos: Equipamento[],
  filterRegiao?: string,
  patrulhas: Patrulha[] = [],
  solicitacoes: Solicitacao[] = []
) {
  const doc = new jsPDF('landscape');

  const equipIdsComPatrulha = new Set(patrulhas.filter(p => p.equipamento_id).map(p => p.equipamento_id!));
  const solicIdsComPatrulha = new Set(patrulhas.filter(p => p.solicitacao_id).map(p => p.solicitacao_id!));
  const municipiosComPatrulhaEquip = new Set(
    equipamentos.filter(e => equipIdsComPatrulha.has(e.id)).map(e => e.municipio)
  );
  const patrulhasSolic = solicitacoes.filter(s =>
    solicIdsComPatrulha.has(s.id) && !municipiosComPatrulhaEquip.has(s.municipio)
  ).length;
  const comPatrulha = municipiosComPatrulhaEquip.size + patrulhasSolic;
  const comKit  = equipamentos.filter(e => e.kit_athena_entregue).length;
  const regioes = new Set(equipamentos.map(e => getRegiao(e.municipio)).filter(Boolean)).size;

  // ── Capa ──────────────────────────────────────────────────────────────────
  await addPdfCover(doc, {
    titulo:    'EQUIPAMENTOS DA REDE',
    subtitulo: 'Casas da Mulher, Salas Lilás e DDMs — Ceará',
    colorKey:  'equipamentos',
    landscape: true,
    descricao: filterRegiao && filterRegiao !== 'all' ? `Região: ${filterRegiao}` : 'Todos os municípios do Estado',
    stats: [
      { label: 'Total Equipamentos', valor: equipamentos.length },
      { label: 'Com Patrulha M.P.',  valor: comPatrulha },
      { label: 'Com Kit Athena',     valor: comKit },
      { label: 'Regiões',            valor: regioes },
    ],
  });

  // ── Página 2: Cards por tipo ───────────────────────────────────────────────
  doc.addPage();
  const startY2 = addPdfHeader(doc, 'Resumo por Tipo', 'Distribuição dos equipamentos por tipo');

  const cardW = 55; const cardH = 28; const cols = 4;
  const marginX = 14; const gap = 5;
  const startCards = startY2 + 10;

  TIPOS_EQUIPAMENTO.forEach((t, idx) => {
    const count = equipamentos.filter(e => e.tipo === t.tipo).length;
    const col   = idx % cols;
    const row   = Math.floor(idx / cols);
    const x = marginX + col * (cardW + gap);
    const y = startCards + row * (cardH + gap);
    const [r, g, b] = t.cor;

    // Fundo colorido
    doc.setFillColor(r, g, b);
    doc.roundedRect(x, y, cardW, cardH, 3, 3, 'F');

    // Sigla pequena
    doc.setFontSize(7); doc.setTextColor(255, 255, 255); doc.setFont(undefined, 'bold');
    doc.text(t.sigla, x + 4, y + 7);

    // Número grande
    doc.setFontSize(22); doc.setFont(undefined, 'bold');
    doc.text(String(count), x + 4, y + 20);

    // Nome do tipo (wrap se necessário)
    doc.setFontSize(6.5); doc.setFont(undefined, 'normal');
    const nomeLinhas = doc.splitTextToSize(t.tipo, cardW - 8);
    doc.text(nomeLinhas, x + cardW - 4, y + 7, { align: 'right' });
  });

  doc.setTextColor(0, 0, 0);

  // ── Página 3: Tabela completa ─────────────────────────────────────────────
  doc.addPage();
  const startY3 = addPdfHeader(doc, 'Lista Completa', 'Todos os equipamentos');
  doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  doc.text(`Total: ${equipamentos.length} registros${filterRegiao && filterRegiao !== 'all' ? ` — Região: ${filterRegiao}` : ''}`, 14, startY3);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    head: [['Município', 'Região', 'Tipo', 'Patrulha M.P.', 'Endereço', 'Responsável', 'Telefone']],
    body: equipamentos.map(e => [
      e.municipio,
      getRegiao(e.municipio) || '-',
      e.tipo,
      equipIdsComPatrulha.has(e.id) ? 'Sim' : 'Não',
      e.endereco || '-',
      e.responsavel || '-',
      e.telefone || '-',
    ]),
    startY: startY3 + 6,
    styles:            { fontSize: 7 },
    headStyles:        { fillColor: [31, 81, 140] },
    alternateRowStyles: { fillColor: [240, 244, 250] },
    didParseCell(data) {
      // Colorir "Sim" na coluna Patrulha
      if (data.column.index === 3 && data.section === 'body') {
        if (data.cell.raw === 'Sim') {
          data.cell.styles.textColor = [16, 185, 129];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  addPdfFooters(doc);
  doc.save(`equipamentos_${ts()}.pdf`);
}

export function exportEquipamentosToExcel(
  equipamentos: Equipamento[],
  qualificacoes?: QualificacaoExport[],
  patrulhas: Patrulha[] = []
) {
  const qualMap = new Map(qualificacoes?.map(q => [q.id, q.nome]) ?? []);
  const equipIdsComPatrulha = new Set(patrulhas.filter(p => p.equipamento_id).map(p => p.equipamento_id!));

  const wb = XLSX.utils.book_new();

  // ── Aba Resumo por Tipo ────────────────────────────────────────────────────
  const resumoData = TIPOS_EQUIPAMENTO.map(t => {
    const lista = equipamentos.filter(e => e.tipo === t.tipo);
    const comPatrulha = lista.filter(e => equipIdsComPatrulha.has(e.id)).length;
    const comKit      = lista.filter(e => e.kit_athena_entregue).length;
    const comCap      = lista.filter(e => e.capacitacao_realizada).length;
    return {
      'Tipo':              t.tipo,
      'Sigla':             t.sigla,
      'Total':             lista.length,
      'Com Patrulha M.P.': comPatrulha,
      'Com Kit Athena':    comKit,
      'Com Qualificação':  comCap,
    };
  });
  // Linha de total
  resumoData.push({
    'Tipo':              'TOTAL',
    'Sigla':             '',
    'Total':             equipamentos.length,
    'Com Patrulha M.P.': equipamentos.filter(e => equipIdsComPatrulha.has(e.id)).length,
    'Com Kit Athena':    equipamentos.filter(e => e.kit_athena_entregue).length,
    'Com Qualificação':  equipamentos.filter(e => e.capacitacao_realizada).length,
  });

  const wsResumo = XLSX.utils.json_to_sheet(resumoData);
  wsResumo['!cols'] = [{ wch:32 }, { wch:8 }, { wch:8 }, { wch:16 }, { wch:14 }, { wch:16 }];
  styleWorksheet(wsResumo, '1F518C');
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo por Tipo');

  // ── Aba Lista Completa ────────────────────────────────────────────────────
  const data = equipamentos.map(e => ({
    'Município':           e.municipio,
    'Região':              getRegiao(e.municipio) || '',
    'Tipo':                e.tipo,
    'Patrulha M.P.':       equipIdsComPatrulha.has(e.id) ? 'Sim' : 'Não',
    'Kit Athena':          e.kit_athena_entregue ? 'Sim' : 'Não',
    'Kit Athena (Prévio)': e.kit_athena_previo   ? 'Sim' : 'Não',
    'Capacitação':         e.capacitacao_realizada ? 'Sim' : 'Não',
    'Curso Vinculado':     e.qualificacao_id ? (qualMap.get(e.qualificacao_id) ?? e.qualificacao_id) : '',
    'NUP':                 e.nup || '',
    'Endereço':            e.endereco || '',
    'Responsável':         e.responsavel || '',
    'Telefone':            e.telefone || '',
    'Observações':         e.observacoes || '',
    'Data de Criação':     fmtDate(e.created_at),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  styleWorksheet(ws, '1F518C');
  XLSX.utils.book_append_sheet(wb, ws, 'Equipamentos');

  saveWb(wb, `equipamentos_${ts()}.xlsx`);
}