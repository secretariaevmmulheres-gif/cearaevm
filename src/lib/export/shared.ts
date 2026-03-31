/**
 * export/shared.ts
 * Helpers internos compartilhados por todos os módulos de export.
 * NÃO exportar diretamente — importar apenas dentro de src/lib/export/*.ts
 */
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

/** Timestamp para nome de arquivo: "2025-06-15_14-32" */
export function ts(): string {
  const now = new Date();
  const d = now.toLocaleDateString('pt-BR').split('/').reverse().join('-');
  const t = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', '-');
  return `${d}_${t}`;
}

/** Formata data string "YYYY-MM-DD" sem problema de timezone */
export function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
}

/** Retorna o finalY da última autoTable renderizada */
export function lastY(doc: jsPDF): number {
  return (doc as any).lastAutoTable.finalY as number;
}

// ── Cores institucionais ───────────────────────────────────────────────────────
// Cada tipo de relatório tem uma cor primária para sua capa
export const COVER_COLORS = {
  equipamentos:  { r: 31,  g: 81,  b: 140 } as RGB,  // azul institucional
  solicitacoes:  { r: 234, g: 88,  b: 12  } as RGB,  // laranja
  viaturas:      { r: 6,   g: 182, b: 212 } as RGB,  // cyan
  atividades:    { r: 124, g: 58,  b: 237 } as RGB,  // violeta
  qualificacoes: { r: 88,  g: 28,  b: 135 } as RGB,  // roxo
  diagnostico:   { r: 239, g: 68,  b: 68  } as RGB,  // vermelho
  regional:      { r: 15,  g: 118, b: 110 } as RGB,  // teal
  dashboard:     { r: 31,  g: 81,  b: 140 } as RGB,  // azul
  padrao:        { r: 31,  g: 81,  b: 140 } as RGB,  // azul
} as const;

type RGB = { r: number; g: number; b: number };
type CoverColorKey = keyof typeof COVER_COLORS;

export interface CoverOptions {
  titulo:      string;               // ex: "RELATÓRIO DE EQUIPAMENTOS"
  subtitulo?:  string;               // ex: "Rede de Atendimento à Mulher no Ceará"
  colorKey?:   CoverColorKey;        // chave da paleta
  cor?:        RGB;                  // cor customizada (sobrescreve colorKey)
  descricao?:  string;               // linha extra de contexto
  stats?:      { label: string; valor: string | number }[];  // até 4 cards de resumo
  filtros?:    string;               // ex: "Região: Cariri | Status: Inaugurada"
  landscape?:  boolean;              // default: false
}

/**
 * Adiciona uma capa elegante ao PDF.
 * Deve ser chamada ANTES de qualquer conteúdo — cria uma página nova no início.
 * Retorna o doc para encadeamento.
 */
export async function addPdfCover(doc: jsPDF, opts: CoverOptions): Promise<void> {
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();

  const rgb = opts.cor ?? COVER_COLORS[opts.colorKey ?? 'padrao'];
  const { r, g, b } = rgb;

  // ── Fundo superior (60% da página) ───────────────────────────────────────
  const splitY = PH * 0.62;
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, PW, splitY, 'F');

  // ── Faixa decorativa diagonal ─────────────────────────────────────────────
  // Triângulo que suaviza a transição entre o fundo colorido e o branco
  doc.setFillColor(r, g, b);
  doc.triangle(0, splitY, PW, splitY - 20, PW, splitY, 'F');

  // ── Faixa lateral esquerda (accent) ──────────────────────────────────────
  const accentR = Math.min(255, r + 40);
  const accentG = Math.min(255, g + 40);
  const accentB = Math.min(255, b + 40);
  doc.setFillColor(accentR, accentG, accentB);
  doc.rect(0, 0, 5, splitY, 'F');

  // ── Logo / ícone (tenta carregar /logo.png, fallback é monograma) ─────────
  const logoY = opts.landscape ? 14 : 18;
  try {
    const res = await fetch('/logo.png');
    if (res.ok) {
      const blob = await res.blob();
      const b64: string = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      const logoW = opts.landscape ? 50 : 40;
      const logoH = opts.landscape ? 15 : 12;
      doc.addImage(b64, 'PNG', (PW - logoW) / 2, logoY, logoW, logoH, undefined, 'FAST');
    }
  } catch (_) {
    // Monograma "EVM" como fallback
    doc.setFillColor(255, 255, 255, 0.2);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(opts.landscape ? 18 : 22);
    doc.setFont(undefined, 'bold');
    doc.text('EVM', PW / 2, logoY + 8, { align: 'center' });
  }

  // ── Secretaria (linha acima do título) ────────────────────────────────────
  const secY = opts.landscape ? 38 : 44;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(opts.landscape ? 7.5 : 8);
  doc.setFont(undefined, 'normal');
  doc.text('SECRETARIA DAS MULHERES DO ESTADO DO CEARÁ', PW / 2, secY, { align: 'center' });

  // ── Linha separadora fina ─────────────────────────────────────────────────
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.line(PW * 0.25, secY + 3, PW * 0.75, secY + 3);

  // ── Título principal ──────────────────────────────────────────────────────
  const titleY = opts.landscape ? 50 : 58;
  doc.setFontSize(opts.landscape ? 18 : 22);
  doc.setFont(undefined, 'bold');
  doc.text(opts.titulo, PW / 2, titleY, { align: 'center' });

  // ── Subtítulo ─────────────────────────────────────────────────────────────
  if (opts.subtitulo) {
    doc.setFontSize(opts.landscape ? 9 : 10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(220, 230, 255);
    doc.text(opts.subtitulo, PW / 2, titleY + (opts.landscape ? 9 : 11), { align: 'center' });
  }

  // ── Descrição extra ───────────────────────────────────────────────────────
  if (opts.descricao) {
    const descY = titleY + (opts.subtitulo ? (opts.landscape ? 18 : 22) : (opts.landscape ? 9 : 11));
    doc.setFontSize(8);
    doc.setTextColor(200, 215, 245);
    doc.text(opts.descricao, PW / 2, descY, { align: 'center' });
  }

  // ── Cards de resumo (stats) ───────────────────────────────────────────────
  if (opts.stats && opts.stats.length > 0) {
    const stats  = opts.stats.slice(0, 4);
    const cardW  = (PW - 28 - (stats.length - 1) * 6) / stats.length;
    const cardY  = splitY + (opts.landscape ? 8 : 10);
    const cardH  = opts.landscape ? 22 : 26;

    stats.forEach((s, i) => {
      const cx = 14 + i * (cardW + 6);
      // Sombra leve
      doc.setFillColor(0, 0, 0);
      doc.setGState(new (doc as any).GState({ opacity: 0.06 }));
      doc.roundedRect(cx + 1, cardY + 1, cardW, cardH, 3, 3, 'F');
      // Card branco
      doc.setGState(new (doc as any).GState({ opacity: 1 }));
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(cx, cardY, cardW, cardH, 3, 3, 'F');
      // Barra superior colorida
      doc.setFillColor(r, g, b);
      doc.roundedRect(cx, cardY, cardW, 3, 1.5, 1.5, 'F');
      doc.rect(cx, cardY + 1.5, cardW, 1.5, 'F'); // quadrar embaixo
      // Valor
      doc.setTextColor(r, g, b);
      doc.setFontSize(opts.landscape ? 14 : 16);
      doc.setFont(undefined, 'bold');
      doc.text(String(s.valor), cx + cardW / 2, cardY + (opts.landscape ? 12 : 15), { align: 'center' });
      // Label
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(opts.landscape ? 6.5 : 7);
      doc.setFont(undefined, 'normal');
      doc.text(s.label, cx + cardW / 2, cardY + (opts.landscape ? 19 : 23), { align: 'center', maxWidth: cardW - 4 });
    });
  }

  // ── Filtros aplicados ─────────────────────────────────────────────────────
  if (opts.filtros) {
    const filtY = opts.stats
      ? splitY + (opts.landscape ? 38 : 44)
      : splitY + (opts.landscape ? 12 : 14);
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(7.5);
    doc.setFont(undefined, 'italic');
    doc.text(`Filtros: ${opts.filtros}`, PW / 2, filtY, { align: 'center' });
  }

  // ── Rodapé da capa ────────────────────────────────────────────────────────
  const footY = PH - (opts.landscape ? 10 : 12);
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(14, footY - 4, PW - 14, footY - 4);
  doc.setTextColor(160, 160, 160);
  doc.setFontSize(7);
  doc.setFont(undefined, 'normal');
  doc.text('EVM Ceará — Enfrentamento à Violência contra as Mulheres', 14, footY);
  doc.text(
    `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    PW - 14, footY, { align: 'right' }
  );
}

/** Cabeçalho padrão EVM em páginas de conteúdo (não capa) */
export function addPdfHeader(doc: jsPDF, title: string, subtitle?: string): number {
  const PW = doc.internal.pageSize.getWidth();

  doc.setFillColor(31, 81, 140);
  doc.rect(0, 0, PW, 16, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.text('EVM — Enfrentamento à Violência contra as Mulheres', 14, 10);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(title, PW - 14, 10, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  let y = 22;
  if (subtitle) {
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(subtitle, 14, y);
    doc.setFont(undefined, 'normal');
    y += 7;
  }

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, y);
  doc.setTextColor(0, 0, 0);
  return y + 6;
}

/** Rodapé com número de página em todas as páginas */
export function addPdfFooters(doc: jsPDF): void {
  const totalPages = (doc as any).internal.getNumberOfPages();
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.setDrawColor(200, 200, 200);
    doc.line(14, PH - 8, PW - 14, PH - 8);
    doc.text('EVM Ceará — Secretaria das Mulheres', 14, PH - 4);
    doc.text(`Página ${i} de ${totalPages}`, PW - 14, PH - 4, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
  }
}

/** Estiliza worksheet: header colorido/negrito + auto-largura + zebra */
export function styleWorksheet(ws: XLSX.WorkSheet, headerColor = '1F518C'): void {
  if (!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);

  const colWidths: number[] = [];
  for (let C = range.s.c; C <= range.e.c; C++) {
    let maxLen = 10;
    for (let R = range.s.r; R <= range.e.r; R++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell?.v != null) {
        const len = String(cell.v).length;
        if (len > maxLen) maxLen = len;
      }
    }
    colWidths.push(Math.min(maxLen + 2, 50));
  }
  ws['!cols'] = colWidths.map(w => ({ wch: w }));

  for (let C = range.s.c; C <= range.e.c; C++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[addr]) continue;
    ws[addr].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: headerColor }, patternType: 'solid' },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
        right:  { style: 'thin', color: { rgb: 'CCCCCC' } },
      },
    };
  }

  for (let R = 1; R <= range.e.r; R++) {
    const bg = R % 2 === 0 ? 'EEF2FA' : 'FFFFFF';
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      ws[addr].s = {
        fill: { fgColor: { rgb: bg }, patternType: 'solid' },
        alignment: { vertical: 'center' },
        border: {
          bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
          right:  { style: 'thin', color: { rgb: 'E5E7EB' } },
        },
      };
    }
  }
}

/** Salva workbook com suporte a estilos */
export function saveWb(wb: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(wb, filename, { bookType: 'xlsx', type: 'binary', cellStyles: true } as any);
}