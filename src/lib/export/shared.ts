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

/** Cabeçalho padrão EVM em todas as páginas de um PDF */
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