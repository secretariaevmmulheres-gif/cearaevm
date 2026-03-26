import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Equipamento, Viatura, Solicitacao } from '@/types';
import { getRegiao } from '@/data/municipios';
import { ts, fmtDate, lastY, addPdfHeader, addPdfFooters } from './shared';
import type { QualificacaoExport } from './exportQualificacoes';
import type { MapExportStats, MapEquipmentCounts } from './exportMapa';
import { addVectorMapPageToDoc } from './exportMapa';

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