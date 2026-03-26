import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getRegiao } from '@/data/municipios';
import { ts, fmtDate, addPdfHeader, addPdfFooters, styleWorksheet, saveWb } from './shared';

export interface QualificacaoExport {
  id: string;
  nome: string;
  ministrante: string;
  data: string;
  total_pessoas: number;
  observacoes: string | null;
  municipios: { municipio: string; quantidade_pessoas: number }[];
}

const REGIOES_LIST = [
  'Cariri', 'Centro Sul', 'Grande Fortaleza', 'Litoral Leste', 'Litoral Norte',
  'Litoral Oeste', 'Maciço de Baturité', 'Serra de Ibiapaba', 'Sertão Central',
  'Sertão de Canindé', 'Sertão de Sobral', 'Sertão do Inhamuns',
  'Sertão dos Crateús', 'Vale do Jaguaribe',
] as const;

export function exportQualificacoesToPDF(qualificacoes: QualificacaoExport[]) {
  const doc = new jsPDF();
  let y = addPdfHeader(doc, 'Qualificações', 'Cursos e Qualificações Realizados');
  const PW = doc.internal.pageSize.getWidth();

  const totalPessoas = qualificacoes.reduce((s, q) => s + q.total_pessoas, 0);
  const municipiosUnicosSet = new Set(qualificacoes.flatMap(q => q.municipios.map(m => m.municipio)));
  const municUnicos = municipiosUnicosSet.size;

  doc.setFontSize(9); doc.setTextColor(100, 100, 100);
  doc.text(
    `Total de cursos: ${qualificacoes.length}  ·  Pessoas qualificadas: ${totalPessoas.toLocaleString('pt-BR')}  ·  Municípios únicos alcançados: ${municUnicos}`,
    14, y
  );
  y += 8;

  doc.setTextColor(0, 0, 0);
  autoTable(doc, {
    startY: y,
    head: [['Curso', 'Ministrante', 'Data', 'Pessoas', 'Munic. do Curso']],
    body: qualificacoes.map(q => [
      q.nome, q.ministrante, fmtDate(q.data),
      q.total_pessoas.toLocaleString('pt-BR'),
      q.municipios.length > 0 ? String(q.municipios.length) : '—',
    ]),
    foot: [['Total', '', '', totalPessoas.toLocaleString('pt-BR'), municUnicos + ' únicos']],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [88, 28, 135], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [237, 233, 254], fontStyle: 'bold', textColor: [60, 20, 100] },
    alternateRowStyles: { fillColor: [245, 243, 255] },
    columnStyles: { 3: { halign: 'right' as const }, 4: { halign: 'right' as const } },
    didDrawPage: () => { addPdfFooters(doc); },
  });

  const statsRegiao = REGIOES_LIST.map(regiao => {
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
    columnStyles: { 1: { halign: 'right' as const }, 2: { halign: 'right' as const }, 3: { halign: 'right' as const } },
    didDrawPage: () => { addPdfFooters(doc); },
  });

  for (const q of qualificacoes) {
    if (q.municipios.length === 0) continue;
    doc.addPage(); addPdfFooters(doc);
    let dy = 20;
    doc.setFillColor(245, 243, 255);
    doc.roundedRect(14, dy - 4, PW - 28, 28, 3, 3, 'F');
    doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.setTextColor(88, 28, 135);
    doc.text(q.nome, 18, dy + 4);
    doc.setFont(undefined, 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
    doc.text(`${q.ministrante}  ·  ${fmtDate(q.data)}  ·  ${q.total_pessoas.toLocaleString('pt-BR')} pessoas`, 18, dy + 12);
    dy += 34;
    if (q.observacoes) {
      doc.setFontSize(8); doc.setTextColor(100, 100, 100);
      const lines = doc.splitTextToSize(q.observacoes, PW - 28) as string[];
      doc.text(lines, 14, dy);
      dy += lines.length * 4 + 4;
    }
    const sortedMun = [...q.municipios].sort((a, b) => b.quantidade_pessoas - a.quantidade_pessoas);
    const totalMun = sortedMun.reduce((s, m) => s + m.quantidade_pessoas, 0);
    autoTable(doc, {
      startY: dy,
      head: [['Município', 'Região', 'Pessoas Qualificadas']],
      body: sortedMun.map(m => [m.municipio, getRegiao(m.municipio) ?? '—', m.quantidade_pessoas.toLocaleString('pt-BR')]),
      foot: [['Total', '', totalMun.toLocaleString('pt-BR')]],
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [88, 28, 135], textColor: [255, 255, 255] },
      footStyles: { fillColor: [237, 233, 254], fontStyle: 'bold', textColor: [60, 20, 100] },
      alternateRowStyles: { fillColor: [250, 249, 255] },
      columnStyles: { 2: { halign: 'right' as const } },
      didDrawPage: () => { addPdfFooters(doc); },
    });
  }

  addPdfFooters(doc);
  doc.save(`qualificacoes-evm_${ts()}.pdf`);
}

export function exportQualificacoesToExcel(qualificacoes: QualificacaoExport[]) {
  const wb = XLSX.utils.book_new();

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

  const statsRegiao = REGIOES_LIST.map(regiao => {
    const municipiosUnicos = new Set<string>();
    const qualIds = new Set<string>();
    let pessoasRegiao = 0;
    qualificacoes.forEach(q => {
      q.municipios.forEach(m => {
        if (getRegiao(m.municipio) === regiao) {
          municipiosUnicos.add(m.municipio); qualIds.add(q.id); pessoasRegiao += m.quantidade_pessoas;
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

  const detData: Record<string, string | number>[] = [];
  for (const q of qualificacoes) {
    for (const m of q.municipios) {
      detData.push({ 'Curso': q.nome, 'Ministrante': q.ministrante, 'Data': fmtDate(q.data), 'Município': m.municipio, 'Região': getRegiao(m.municipio) ?? '—', 'Pessoas': m.quantidade_pessoas });
    }
  }
  if (detData.length > 0) {
    const wsDet = XLSX.utils.json_to_sheet(detData);
    styleWorksheet(wsDet, '7C3AED');
    XLSX.utils.book_append_sheet(wb, wsDet, 'Por Município');
  }

  const alcanceMap = new Map<string, { pessoas: number; cursos: number }>();
  for (const q of qualificacoes) {
    for (const m of q.municipios) {
      const entry = alcanceMap.get(m.municipio) ?? { pessoas: 0, cursos: 0 };
      entry.pessoas += m.quantidade_pessoas; entry.cursos += 1;
      alcanceMap.set(m.municipio, entry);
    }
  }
  const alcanceData = Array.from(alcanceMap.entries())
    .sort((a, b) => b[1].pessoas - a[1].pessoas)
    .map(([municipio, v]) => ({ 'Município': municipio, 'Região': getRegiao(municipio) ?? '—', 'Total Pessoas': v.pessoas, 'Aparece em N Cursos': v.cursos }));
  if (alcanceData.length > 0) {
    const wsAlcance = XLSX.utils.json_to_sheet(alcanceData);
    styleWorksheet(wsAlcance, 'A855F7');
    XLSX.utils.book_append_sheet(wb, wsAlcance, 'Alcance por Município');
  }

  saveWb(wb, `qualificacoes-evm_${ts()}.xlsx`);
}