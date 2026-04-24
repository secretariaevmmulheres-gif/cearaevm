import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getRegiao } from '@/data/municipios';
import { ts, fmtDate, addPdfCover, addPdfHeader, addPdfFooters, styleWorksheet, saveWb } from './shared';
import { MgPedido, MgItem, MgEstoque, MgSituacao } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function resumoItens(pedido: MgPedido, itens: MgItem[]): string {
  if (!pedido.itens?.length) return '—';
  return pedido.itens.map(ip => {
    const item = itens.find(i => i.id === ip.item_id);
    const nome = item ? `${item.tipo} — ${item.campanha}` : 'Item';
    const qtd  = ip.qtd_autorizada ?? ip.qtd_solicitada ?? 0;
    const un   = ip.unidade_medida === 'caixas' ? 'cx' : 'un';
    return `${nome}: ${qtd} ${un}`;
  }).join(' | ');
}

const SITUACAO_COR: Record<MgSituacao, [number, number, number]> = {
  'Aguardando':   [245, 158, 11],
  'Em separação': [59,  130, 246],
  'Atendido':     [16,  185, 129],
  'Cancelado':    [239, 68,  68],
};

// ── PDF — Pedidos ─────────────────────────────────────────────────────────────

export async function exportMgPedidosToPDF(pedidos: MgPedido[], itens: MgItem[]) {
  const atendidos   = pedidos.filter(p => p.situacao === 'Atendido').length;
  const aguardando  = pedidos.filter(p => p.situacao === 'Aguardando' || p.situacao === 'Em separação').length;
  const municipios  = new Set(pedidos.filter(p => p.municipio).map(p => p.municipio!)).size;

  const doc = new jsPDF('landscape');

  await addPdfCover(doc, {
    titulo:    'MATERIAL GRÁFICO',
    subtitulo: 'Controle de Distribuição — Secretaria das Mulheres do Ceará',
    colorKey:  'atividades',
    landscape: true,
    stats: [
      { label: 'Total de Pedidos',  valor: pedidos.length },
      { label: 'Atendidos',         valor: atendidos },
      { label: 'Pendentes',         valor: aguardando },
      { label: 'Municípios',        valor: municipios },
    ],
  });

  doc.addPage();
  const startY = addPdfHeader(doc, 'Pedidos de Material Gráfico', 'Registro completo de distribuição');
  doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  doc.text(
    `Total: ${pedidos.length} pedidos  ·  Atendidos: ${atendidos}  ·  Pendentes: ${aguardando}  ·  Municípios: ${municipios}`,
    14, startY
  );
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: startY + 6,
    head: [['Destino', 'Região', 'NUP/SUITE', 'Data Pedido', 'Data Entrega', 'Situação', 'Forma', 'Tipo', 'Materiais']],
    body: pedidos.map(p => {
      const destino = p.municipio ?? p.destino_avulso ?? '—';
      const regiao  = p.municipio ? (getRegiao(p.municipio) || '—') : 'Avulso';
      return [
        destino,
        regiao,
        p.nup      || '—',
        fmtDate(p.data_pedido),
        fmtDate(p.data_entrega),
        p.situacao,
        p.forma_entrega  || '—',
        p.tipo_pedido    || '—',
        resumoItens(p, itens),
      ];
    }),
    styles:            { fontSize: 6.5, cellPadding: 2 },
    headStyles:        { fillColor: [124, 58, 237] },
    alternateRowStyles: { fillColor: [245, 243, 255] },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 22 },
      2: { cellWidth: 32 },
      3: { cellWidth: 20 },
      4: { cellWidth: 20 },
      5: { cellWidth: 22 },
      6: { cellWidth: 16 },
      7: { cellWidth: 28 },
      8: { cellWidth: 'auto' },
    },
    didParseCell(data) {
      // Colorir coluna Situação
      if (data.column.index === 5 && data.section === 'body') {
        const sit = data.cell.raw as MgSituacao;
        const cor = SITUACAO_COR[sit];
        if (cor) {
          data.cell.styles.textColor = cor;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  addPdfFooters(doc);
  doc.save(`material-grafico-pedidos_${ts()}.pdf`);
}

// ── PDF — Estoque ─────────────────────────────────────────────────────────────

export async function exportMgEstoqueToPDF(itens: MgItem[], estoque: MgEstoque[]) {
  const totalCaixas = estoque.reduce((s, e) => s + e.caixas, 0);

  const doc = new jsPDF('landscape');

  await addPdfCover(doc, {
    titulo:    'ESTOQUE — MATERIAL GRÁFICO',
    subtitulo: 'Posição de Estoque por Item — Castelão e SEM',
    colorKey:  'atividades',
    landscape: true,
    stats: [
      { label: 'Itens no Catálogo', valor: itens.length },
      { label: 'Total de Caixas',   valor: totalCaixas },
      { label: 'Locais',            valor: 2 },
      { label: 'Data',              valor: new Date().toLocaleDateString('pt-BR') },
    ],
  });

  doc.addPage();
  const startY = addPdfHeader(doc, 'Estoque de Material Gráfico', 'Castelão (almoxarifado) e SEM');

  autoTable(doc, {
    startY: startY + 4,
    head: [[
      'Tipo', 'Campanha', 'Un/Cx',
      'Castelão\ncaixas', 'Castelão\n≈ unidades',
      'SEM\ncaixas', 'SEM\nun avulsas', 'SEM\n≈ total un',
      'Total\ncaixas', 'Est. total\nunidades',
    ]],
    body: itens.map(item => {
      const eCastelao  = estoque.find(e => e.item_id === item.id && e.local === 'Castelão');
      const eSEM       = estoque.find(e => e.item_id === item.id && e.local === 'SEM');
      const cxCastelao = eCastelao?.caixas ?? 0;
      const cxSEM      = eSEM?.caixas ?? 0;
      const unAvSEM    = eSEM?.unidades_avulsas ?? 0;
      const unPorCx    = item.unidades_por_cx;
      const fmt = (n: number) => n.toLocaleString('pt-BR');
      return [
        item.tipo,
        item.campanha,
        unPorCx ? `≈ ${unPorCx}` : '—',
        cxCastelao,
        unPorCx ? fmt(cxCastelao * unPorCx) : '—',
        cxSEM,
        unAvSEM || '—',
        unPorCx ? fmt(cxSEM * unPorCx + unAvSEM) : '—',
        cxCastelao + cxSEM,
        unPorCx ? fmt((cxCastelao + cxSEM) * unPorCx + unAvSEM) : '—',
      ];
    }),
    styles:             { fontSize: 7.5, cellPadding: 2 },
    headStyles:         { fillColor: [124, 58, 237], fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 243, 255] },
    columnStyles: {
      2: { halign: 'center', textColor: [120, 120, 120] },
      3: { halign: 'center', fontStyle: 'bold' },
      4: { halign: 'center', textColor: [100, 100, 100] },
      5: { halign: 'center', fontStyle: 'bold' },
      6: { halign: 'center' },
      7: { halign: 'center', textColor: [100, 100, 100] },
      8: { halign: 'center', fontStyle: 'bold' },
      9: { halign: 'center', fontStyle: 'bold', textColor: [124, 58, 237] },
    },
  });

  addPdfFooters(doc);
  doc.save(`material-grafico-estoque_${ts()}.pdf`);
}

// ── Excel — Estoque ───────────────────────────────────────────────────────────

export function exportMgEstoqueToExcel(itens: MgItem[], estoque: MgEstoque[]) {
  const data = itens.map(item => {
    const eCastelao  = estoque.find(e => e.item_id === item.id && e.local === 'Castelão');
    const eSEM       = estoque.find(e => e.item_id === item.id && e.local === 'SEM');
    const cxCastelao = eCastelao?.caixas ?? 0;
    const cxSEM      = eSEM?.caixas ?? 0;
    const unAvSEM    = eSEM?.unidades_avulsas ?? 0;
    const unPorCx    = item.unidades_por_cx;

    const row: Record<string, string | number> = {
      'Tipo':                    item.tipo,
      'Campanha':                item.campanha,
      'Un/Cx (aprox.)':         unPorCx ?? '',
      'Castelão — Caixas':      cxCastelao,
      'Castelão — Est. Un':     unPorCx ? cxCastelao * unPorCx : '',
      'SEM — Caixas':           cxSEM,
      'SEM — Un. Avulsas':      unAvSEM,
      'SEM — Est. Un Total':    unPorCx ? cxSEM * unPorCx + unAvSEM : '',
      'Total Caixas':           cxCastelao + cxSEM,
      'Est. Total Unidades':    unPorCx ? (cxCastelao + cxSEM) * unPorCx + unAvSEM : '',
    };
    return row;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  styleWorksheet(ws, '7C3AED');
  XLSX.utils.book_append_sheet(wb, ws, 'Estoque');
  saveWb(wb, `material-grafico-estoque_${ts()}.xlsx`);
}

export function exportMgPedidosToExcel(pedidos: MgPedido[], itens: MgItem[]) {
  // Aba 1: Resumo por pedido
  const resumo = pedidos.map(p => ({
    'Destino':        p.municipio ?? p.destino_avulso ?? '—',
    'Região':         p.municipio ? (getRegiao(p.municipio) || '—') : 'Avulso',
    'NUP/SUITE':      p.nup      || '',
    'Ofício':         p.oficio   || '',
    'Data Pedido':    fmtDate(p.data_pedido),
    'Data Entrega':   fmtDate(p.data_entrega),
    'Situação':       p.situacao,
    'Forma Entrega':  p.forma_entrega  || '',
    'Tipo Pedido':    p.tipo_pedido    || '',
    'Observações':    p.observacoes    || '',
    'Estoque Abatido': p.estoque_abatido ? 'Sim' : 'Não',
    'Materiais':      resumoItens(p, itens),
  }));

  // Aba 2: Detalhamento por item de pedido
  const detalhes: Record<string, string | number>[] = [];
  for (const p of pedidos) {
    for (const ip of p.itens ?? []) {
      const item = itens.find(i => i.id === ip.item_id);
      detalhes.push({
        'Destino':           p.municipio ?? p.destino_avulso ?? '—',
        'Data Pedido':       fmtDate(p.data_pedido),
        'Situação':          p.situacao,
        'Tipo Material':     item?.tipo    || '—',
        'Campanha':          item?.campanha || '—',
        'Unidade':           ip.unidade_medida,
        'Qtd Solicitada':    ip.qtd_solicitada,
        'Qtd Autorizada':    ip.qtd_autorizada ?? ip.qtd_solicitada ?? 0,
      });
    }
  }

  const wb  = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(resumo);
  const ws2 = XLSX.utils.json_to_sheet(detalhes);
  styleWorksheet(ws1, '7C3AED');
  styleWorksheet(ws2, '7C3AED');
  XLSX.utils.book_append_sheet(wb, ws1, 'Pedidos');
  XLSX.utils.book_append_sheet(wb, ws2, 'Detalhamento');
  saveWb(wb, `material-grafico-pedidos_${ts()}.xlsx`);
}