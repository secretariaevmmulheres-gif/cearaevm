import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { ts, addPdfHeader, addPdfFooters } from './shared';

export interface MapExportFilters { tipoEquipamento: string; statusSolicitacao: string; apenasComViatura: boolean; regiao?: string; }
export interface MapExportStats { brasileira: number; cearense: number; municipal: number; lilasMunicipal: number; lilasEstado: number; lilasDelegacia: number; ddm: number; viaturaOnly: number; semCobertura: number; }
export interface MapExportOptions { highResolution?: boolean; embedLegend?: boolean; }
export interface MapEquipmentCounts { brasileira: number; cearense: number; municipal: number; lilasMunicipal: number; lilasEstado: number; lilasDelegacia: number; ddm: number; }
export interface RegionalGoalsExportRow { regiao: string; status: string; equipamentos: { current: number; goal: number; progress: number }; viaturas: { current: number; goal: number; progress: number }; cobertura: { current: number; goal: number; progress: number }; overallProgress: number; expectedProgress: number; }
export interface RegionalGoalsExportPayload { monthLabel: string; generatedAt: Date; summary: { achieved: number; onTrack: number; atRisk: number; behind: number; avgProgress: number; }; rows: RegionalGoalsExportRow[]; }

export function exportRegionalGoalsToPDF(payload: RegionalGoalsExportPayload) {
  const doc = new jsPDF('landscape');
  doc.setFontSize(16);
  doc.text('Painel de Metas Mensais - Regiões (Consolidado)', 14, 18);
  doc.setFontSize(10);
  doc.text(`Mês: ${payload.monthLabel}`, 14, 26);
  doc.text(`Gerado em: ${payload.generatedAt.toLocaleDateString('pt-BR')} às ${payload.generatedAt.toLocaleTimeString('pt-BR')}`, 14, 32);
  doc.text(`Resumo: ${payload.summary.achieved} atingidas • ${payload.summary.onTrack} no caminho • ${payload.summary.atRisk} em risco • ${payload.summary.behind} atrasadas • Média ${payload.summary.avgProgress.toFixed(0)}%`, 14, 40);
  autoTable(doc, {
    startY: 46,
    head: [['Região', 'Status', 'Equip. (atual/meta)', 'Equip. %', 'Viaturas (atual/meta)', 'Viaturas %', 'Cobertura (atual/meta)', 'Cobertura %', 'Geral %', 'Esperado %']],
    body: payload.rows.map(r => [r.regiao, r.status, `${r.equipamentos.current}/${r.equipamentos.goal}`, `${Math.round(r.equipamentos.progress)}%`, `${r.viaturas.current}/${r.viaturas.goal}`, `${Math.round(r.viaturas.progress)}%`, `${r.cobertura.current.toFixed(1)}%/${r.cobertura.goal}%`, `${Math.round(r.cobertura.progress)}%`, `${Math.round(r.overallProgress)}%`, `${Math.round(r.expectedProgress)}%`]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [31, 81, 140] },
    didDrawCell: (data) => {
      const col = data.column.index;
      if (![3, 5, 7, 8].includes(col) || data.section !== 'body') return;
      const text = String(data.cell.text?.[0] ?? '').replace('%', '');
      const pct = Math.max(0, Math.min(100, Number(text)));
      if (Number.isNaN(pct)) return;
      const barX = data.cell.x + 1, barY = data.cell.y + data.cell.height - 2.5, barW = data.cell.width - 2, fillW = (barW * pct) / 100;
      doc.setFillColor(229, 231, 235);
      doc.rect(barX, barY, barW, 1.5, 'F');
      if (pct >= 100) doc.setFillColor(16, 185, 129);
      else if (pct >= 75) doc.setFillColor(59, 130, 246);
      else if (pct >= 50) doc.setFillColor(245, 158, 11);
      else doc.setFillColor(239, 68, 68);
      doc.rect(barX, barY, fillW, 1.5, 'F');
    },
  });
  addPdfFooters(doc);
  doc.save(`metas-regionais-${payload.monthLabel.toLowerCase().replace(/\s+/g, '-')}_${ts()}.pdf`);
}

export interface CapturedMapImage {
  dataUrl: string;
  width: number;
  height: number;
}

export async function captureMapImage(
  mapElement: HTMLElement,
  highResolution: boolean = false
): Promise<CapturedMapImage> {
  const html2canvasLib = (await import('html2canvas')).default;
  const scale = highResolution ? 3 : 2;
  const W = 900;
  const H = 600;

  // Cria um iframe oculto para renderizar o mapa isolado do layout principal
  // Alternativa: copia o canvas do Leaflet diretamente
  // O Leaflet renderiza polígonos num SVG e tiles num layer de <img> com CORS
  // Vamos compor manualmente: fundo neutro + SVG dos polígonos

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width  = W * scale;
  outputCanvas.height = H * scale;
  const ctx = outputCanvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // Fundo cor dos tiles OSM (bege claro)
  ctx.fillStyle = '#f0ede8';
  ctx.fillRect(0, 0, W, H);

  // Pega o bounding rect do elemento mapa para calcular offsets
  const mapRect = mapElement.getBoundingClientRect();

  // Coleta todos os SVGs do Leaflet (polígonos GeoJSON)
  const svgs = mapElement.querySelectorAll<SVGSVGElement>('svg');
  const promises: Promise<void>[] = [];

  svgs.forEach(svg => {
    const svgRect = svg.getBoundingClientRect();
    const dx = svgRect.left - mapRect.left;
    const dy = svgRect.top  - mapRect.top;
    const sw = svgRect.width  || svg.viewBox?.baseVal?.width  || W;
    const sh = svgRect.height || svg.viewBox?.baseVal?.height || H;

    // Clona o SVG e aplica estilos inline dos paths
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width',  String(sw));
    clone.setAttribute('height', String(sh));

    const origPaths  = svg.querySelectorAll<SVGPathElement>('path');
    const clonePaths = clone.querySelectorAll<SVGPathElement>('path');
    origPaths.forEach((orig, i) => {
      const cp = clonePaths[i];
      if (!cp) return;
      const cs = window.getComputedStyle(orig);
      const fill   = orig.style.fill   || cs.fill   || orig.getAttribute('fill')         || 'transparent';
      const stroke = orig.style.stroke || cs.stroke || orig.getAttribute('stroke')       || '#666';
      const fo     = orig.style.fillOpacity || orig.getAttribute('fill-opacity') || '0.85';
      const sw2    = orig.style.strokeWidth || orig.getAttribute('stroke-width') || '0.5';
      cp.setAttribute('fill',         fill);
      cp.setAttribute('stroke',       stroke);
      cp.setAttribute('fill-opacity', fo);
      cp.setAttribute('stroke-width', sw2);
      // Remove classes que referenciam estilos externos
      cp.removeAttribute('class');
    });

    const serialized = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
    const url  = URL.createObjectURL(blob);

    promises.push(new Promise<void>(resolve => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, dx, dy, sw, sh);
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      img.src = url;
    }));
  });

  await Promise.all(promises);

  return {
    dataUrl: outputCanvas.toDataURL('image/png', 1.0),
    width:   outputCanvas.width,
    height:  outputCanvas.height,
  };
}



/**
 * Desenha uma página de mapa vetorial no doc jsPDF existente.
 * Reutilizável tanto no export standalone quanto no Relatório EVM.
 */
function drawVectorMapPage(
  doc: jsPDF,
  geoJsonData: any,
  municipioColors: Map<string, string>,
  stats: MapExportStats,
  equipmentCounts: MapEquipmentCounts,
  normalizeFn: (nome: string) => string,
  totalComEquipamento: number,
) {
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();

  // Cabeçalho
  doc.setFillColor(31, 81, 140);
  doc.rect(0, 0, PW, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10); doc.setFont(undefined, 'bold');
  doc.text('Mapa de Cobertura — Estado do Ceará', PW / 2, 9, { align: 'center' });
  doc.setTextColor(0, 0, 0); doc.setFont(undefined, 'normal');

  const MAP_MARGIN = 8;
  const LEGEND_W   = 70;
  const mapX = MAP_MARGIN;
  const mapY = 18;
  const mapW = PW - MAP_MARGIN * 2 - LEGEND_W - 4;
  const mapH = PH - mapY - 16;

  // Fundo
  doc.setFillColor(210, 230, 245);
  doc.rect(mapX, mapY, mapW, mapH, 'F');
  doc.setDrawColor(180, 180, 180);
  doc.rect(mapX, mapY, mapW, mapH, 'S');

  // Bounding box do GeoJSON
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  if (geoJsonData?.features) {
    geoJsonData.features.forEach((f: any) => {
      const coords = f.geometry?.type === 'MultiPolygon'
        ? f.geometry.coordinates.flat(2)
        : f.geometry?.coordinates?.flat?.(1) ?? [];
      coords.forEach(([lon, lat]: number[]) => {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      });
    });
  }

  const lonRange = maxLon - minLon || 1;
  const latRange = maxLat - minLat || 1;
  const pad = 4;

  // Preserva o aspect ratio geográfico — não estica o mapa para preencher a área
  // O Ceará tem proporção estreita/alta (~lon:lat ≈ 1:2.2), então limitamos pelo eixo mais restritivo
  const availW = mapW - pad * 2;
  const availH = mapH - pad * 2;
  const geoAspect = lonRange / latRange;   // largura / altura em graus
  let drawW: number, drawH: number;
  if (availW / availH > geoAspect) {
    // Limitado pela altura — centraliza horizontalmente
    drawH = availH;
    drawW = drawH * geoAspect;
  } else {
    // Limitado pela largura — centraliza verticalmente
    drawW = availW;
    drawH = drawW / geoAspect;
  }
  const offsetX = (availW - drawW) / 2;
  const offsetY = (availH - drawH) / 2;

  const project = (lon: number, lat: number): [number, number] => [
    mapX + pad + offsetX + ((lon - minLon) / lonRange) * drawW,
    mapY + pad + offsetY + ((maxLat - lat) / latRange) * drawH,
  ];

  const drawPolygon = (ring: number[][]) => {
    if (ring.length < 3) return;
    const pts = ring.map(([lon, lat]) => project(lon, lat));
    doc.lines(
      pts.slice(1).map(([x2, y2], i) => {
        const [x1, y1] = pts[i];
        return [x2 - x1, y2 - y1] as [number, number];
      }),
      pts[0][0], pts[0][1],
      [1, 1], 'FD', true
    );
  };

  if (geoJsonData?.features) {
    geoJsonData.features.forEach((feature: any) => {
      const hex = municipioColors.get(normalizeFn(feature.properties?.name ?? '')) ?? '#e5e7eb';
      doc.setFillColor(parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16));
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.2);
      if (feature.geometry?.type === 'Polygon') {
        feature.geometry.coordinates.forEach((ring: number[][]) => drawPolygon(ring));
      } else if (feature.geometry?.type === 'MultiPolygon') {
        feature.geometry.coordinates.forEach((poly: number[][][]) =>
          poly.forEach((ring: number[][]) => drawPolygon(ring))
        );
      }
    });
  }

  // Legenda
  const legendColors: [number,number,number][] = [
    [13,148,136],[124,58,237],[234,88,12],[192,38,211],[232,121,249],[240,171,252],[21,128,61],[6,182,212],[229,231,235]
  ];
  const lgX = mapX + mapW + 4;
  const lgY = mapY;
  const lgW = LEGEND_W;
  doc.setFillColor(255,255,255); doc.setDrawColor(200,200,200);
  doc.roundedRect(lgX, lgY, lgW, mapH, 2, 2, 'FD');
  doc.setFontSize(7); doc.setFont(undefined, 'bold');
  doc.text('LEGENDA', lgX + 3, lgY + 7);
  doc.setFont(undefined, 'normal');
  const lgItems = [
    { color: legendColors[0], label: 'C.M. Brasileira',         count: equipmentCounts.brasileira },
    { color: legendColors[1], label: 'C.M. Cearense',           count: equipmentCounts.cearense },
    { color: legendColors[2], label: 'C.M. Municipal',          count: equipmentCounts.municipal },
    { color: legendColors[3], label: 'Sala Lilás Municipal',    count: equipmentCounts.lilasMunicipal },
    { color: legendColors[4], label: 'Sala Lilás Gov.Estado',   count: equipmentCounts.lilasEstado },
    { color: legendColors[5], label: 'Sala Lilás Delegacia',    count: equipmentCounts.lilasDelegacia },
    { color: legendColors[6], label: 'DDM',                     count: equipmentCounts.ddm },
    { color: legendColors[7], label: 'Só Viatura',              count: stats.viaturaOnly },
    { color: legendColors[8], label: 'Sem Cobertura',           count: stats.semCobertura },
  ];
  lgItems.forEach((item, i) => {
    const ly = lgY + 13 + i * 9;
    doc.setFillColor(...item.color); doc.rect(lgX+3, ly-3, 4, 4, 'F');
    doc.setDrawColor(180,180,180); doc.rect(lgX+3, ly-3, 4, 4, 'S');
    doc.setTextColor(0,0,0); doc.setFontSize(6.5);
    doc.text(item.label, lgX+9, ly);
    doc.setFont(undefined,'bold');
    doc.text(String(item.count), lgX+lgW-6, ly, { align: 'right' });
    doc.setFont(undefined,'normal');
  });
  const covLy = lgY + 13 + lgItems.length * 9 + 4;
  doc.setDrawColor(200,200,200);
  doc.line(lgX+3, covLy-3, lgX+lgW-3, covLy-3);
  doc.setFontSize(7); doc.setFont(undefined,'bold');
  doc.text('Cobertura:', lgX+3, covLy+2);
  doc.text(`${(totalComEquipamento/184*100).toFixed(1)}%`, lgX+3, covLy+8);
  doc.setFont(undefined,'normal'); doc.setFontSize(6);
  doc.text(`${totalComEquipamento}/184 municípios`, lgX+3, covLy+13);

  doc.setFontSize(6); doc.setTextColor(120,120,120);
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} — EVM Ceará`, PW/2, PH-4, { align: 'center' });
  doc.setTextColor(0,0,0);
}

/**
 * Exporta o mapa do Ceará diretamente no jsPDF desenhando os polígonos GeoJSON —
 * sem html2canvas, sem captura de tela, funciona independente de scroll/modal.
 */
export async function exportMapToPDFDirect(
  geoJsonData: any,
  municipioColors: Map<string, string>,  // normalizedName → hexColor
  filters: MapExportFilters,
  stats: MapExportStats,
  equipmentCounts: MapEquipmentCounts,
  normalizeFn: (nome: string) => string,
) {
  const doc = new jsPDF('landscape');
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const totalComEquipamento = stats.brasileira + stats.cearense + stats.municipal
    + stats.lilasMunicipal + stats.lilasEstado + stats.lilasDelegacia + stats.ddm;

  // ── Página 1: cabeçalho + estatísticas ──────────────────────────────────────
  doc.setFillColor(31, 81, 140);
  doc.rect(0, 0, PW, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12); doc.setFont(undefined, 'bold');
  doc.text('Mapa do Ceará — EVM', 14, 10);
  doc.setFontSize(8); doc.setFont(undefined, 'normal');
  doc.text('Enfrentamento à Violência contra as Mulheres', 14, 14);
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(9); doc.setFont(undefined, 'bold');
  doc.text('Filtros Aplicados', 14, 26); doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  doc.text(`Região: ${filters.regiao && filters.regiao !== 'all' ? filters.regiao : 'Todas'}`, 14, 33);
  doc.text(`Tipo: ${filters.tipoEquipamento === 'all' ? 'Todos' : filters.tipoEquipamento}`, 14, 38);
  doc.text(`Status solicitação: ${filters.statusSolicitacao === 'all' ? 'Todos' : filters.statusSolicitacao}`, 14, 43);
  doc.text(`Apenas com viatura: ${filters.apenasComViatura ? 'Sim' : 'Não'}`, 14, 48);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 53);

  doc.setFontSize(9); doc.setFont(undefined, 'bold');
  doc.text('Estatísticas de Cobertura', 14, 63); doc.setFont(undefined, 'normal');
  const statRows = [
    ['Casa da Mulher Brasileira', equipmentCounts.brasileira],
    ['Casa da Mulher Cearense', equipmentCounts.cearense],
    ['Casa da Mulher Municipal', equipmentCounts.municipal],
    ['Sala Lilás Municipal', equipmentCounts.lilasMunicipal],
    ['Sala Lilás Gov. Estado', equipmentCounts.lilasEstado],
    ['Sala Lilás em Delegacia', equipmentCounts.lilasDelegacia],
    ['DDM', equipmentCounts.ddm],
    ['Só Viatura', stats.viaturaOnly],
    ['Sem Cobertura', stats.semCobertura],
  ] as [string, number][];
  const legendColors: [number,number,number][] = [
    [13,148,136],[124,58,237],[234,88,12],[192,38,211],[232,121,249],[240,171,252],[21,128,61],[6,182,212],[229,231,235]
  ];
  statRows.forEach(([label, count], i) => {
    const y = 70 + i * 8;
    doc.setFillColor(...legendColors[i]);
    doc.rect(14, y - 3, 4, 4, 'F');
    doc.setFontSize(8);
    doc.text(`${label}:`, 21, y);
    doc.setFont(undefined, 'bold');
    doc.text(String(count), 80, y);
    doc.setFont(undefined, 'normal');
  });
  const covY = 70 + statRows.length * 8 + 4;
  doc.setFontSize(9); doc.setFont(undefined, 'bold');
  doc.text(`Cobertura total: ${(totalComEquipamento/184*100).toFixed(1)}%  (${totalComEquipamento} de 184 municípios)`, 14, covY);

  // ── Página 2: mapa vetorial (via helper reutilizável) ──────────────────────
  doc.addPage();
  drawVectorMapPage(doc, geoJsonData, municipioColors, stats, equipmentCounts, normalizeFn, totalComEquipamento);

  doc.save(`mapa-ceara_${ts()}.pdf`);
}

/**
 * Versão para o Relatório EVM: adiciona a página do mapa num doc jsPDF existente.
 * Recebe o geoJsonData e o mapa de cores — não depende de html2canvas.
 */
export function addVectorMapPageToDoc(
  doc: jsPDF,
  geoJsonData: any,
  municipioColors: Map<string, string>,
  stats: MapExportStats,
  equipmentCounts: MapEquipmentCounts,
  normalizeFn: (nome: string) => string,
  totalComEquipamento: number,
) {
  doc.addPage();
  drawVectorMapPage(doc, geoJsonData, municipioColors, stats, equipmentCounts, normalizeFn, totalComEquipamento);
}

export async function exportMapToPDF(
  mapElement: HTMLElement,
  filters: MapExportFilters,
  stats: MapExportStats,
  options: MapExportOptions = {},
  equipmentCounts?: MapEquipmentCounts,
  preCapturedImage?: CapturedMapImage
) {
  const { highResolution = false, embedLegend = false } = options;
  const doc = new jsPDF('landscape');
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();

  doc.setFontSize(16); doc.setFont(undefined, 'bold');
  doc.text('Mapa do Ceará — EVM', 14, 18); doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.text('Enfrentamento à Violência contra as Mulheres', 14, 25);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 31);

  doc.setFontSize(11); doc.setFont(undefined, 'bold');
  doc.text('Filtros Aplicados', 14, 44); doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.text(`Região: ${filters.regiao && filters.regiao !== 'all' ? filters.regiao : 'Todas'}`, 14, 51);
  doc.text(`Tipo de Equipamento: ${filters.tipoEquipamento === 'all' ? 'Todos' : filters.tipoEquipamento}`, 14, 57);
  doc.text(`Status de Solicitação: ${filters.statusSolicitacao === 'all' ? 'Todos' : filters.statusSolicitacao}`, 14, 63);
  doc.text(`Apenas com Viatura: ${filters.apenasComViatura ? 'Sim' : 'Não'}`, 14, 69);

  doc.setFontSize(11); doc.setFont(undefined, 'bold');
  doc.text('Estatísticas', 14, 82); doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  const totalComEquipamento = stats.brasileira + stats.cearense + stats.municipal + stats.lilasMunicipal + stats.lilasEstado + stats.lilasDelegacia + stats.ddm;
  const rows = [
    ['Casa da Mulher Brasileira', String(equipmentCounts?.brasileira ?? stats.brasileira)],
    ['Casa da Mulher Cearense',   String(equipmentCounts?.cearense   ?? stats.cearense)],
    ['Casa da Mulher Municipal',  String(equipmentCounts?.municipal  ?? stats.municipal)],
    ['Sala Lilás Municipal',       String(equipmentCounts?.lilasMunicipal  ?? stats.lilasMunicipal)],
    ['Sala Lilás Gov. Estado',     String(equipmentCounts?.lilasEstado     ?? stats.lilasEstado)],
    ['Sala Lilás em Delegacia',    String(equipmentCounts?.lilasDelegacia  ?? stats.lilasDelegacia)],
    ['DDM',                       String(equipmentCounts?.ddm             ?? stats.ddm)],
    ['Só Viatura (sem equipamento)', String(stats.viaturaOnly)],
    ['Sem Cobertura',             String(stats.semCobertura)],
    ['Cobertura Total (%)',       `${(totalComEquipamento / 184 * 100).toFixed(2)}% (${totalComEquipamento}/184)`],
  ];
  rows.forEach(([label, value], i) => {
    doc.text(`${label}:`, 14, 89 + i * 7);
    doc.setFont(undefined, 'bold');
    doc.text(value, 80, 89 + i * 7);
    doc.setFont(undefined, 'normal');
  });

  doc.addPage();
  const captured = preCapturedImage ?? await captureMapImage(mapElement, highResolution);
  const imgAspect = captured.width / captured.height;
  const margin = 10;
  const headerH = 12;
  const footerH = 8;
  const availW = PW - margin * 2;
  const availH = PH - margin * 2 - headerH - footerH;
  let imgW = availW;
  let imgH = imgW / imgAspect;
  if (imgH > availH) { imgH = availH; imgW = imgH * imgAspect; }
  const imgX = margin + (availW - imgW) / 2;
  const imgY = margin + headerH;
  doc.setFontSize(10); doc.setFont(undefined, 'bold');
  doc.text('Mapa de Cobertura — Estado do Ceará', PW / 2, margin + 7, { align: 'center' });
  doc.setFont(undefined, 'normal');
  doc.addImage(captured.dataUrl, 'PNG', imgX, imgY, imgW, imgH);
  doc.setFontSize(7); doc.setTextColor(120, 120, 120);
  doc.text(`Cobertura: ${(totalComEquipamento / 184 * 100).toFixed(1)}% — ${totalComEquipamento} de 184 municípios com equipamento`, PW / 2, imgY + imgH + 5, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  if (embedLegend) {
    const lgW = 62, lgH = 62;
    const lgX = imgX + imgW - lgW - 3;
    const lgY = imgY + imgH - lgH - 3;
    doc.setFillColor(255, 255, 255); doc.setDrawColor(180, 180, 180);
    doc.roundedRect(lgX, lgY, lgW, lgH, 2, 2, 'FD');
    doc.setFontSize(7); doc.setFont(undefined, 'bold'); doc.setTextColor(0, 0, 0);
    doc.text('Legenda', lgX + 3, lgY + 6); doc.setFont(undefined, 'normal');
    const legendItems = [
      { color: [13, 148, 136]  as [number,number,number], label: 'C.M. Brasileira',  count: equipmentCounts?.brasileira ?? stats.brasileira },
      { color: [124, 58, 237]  as [number,number,number], label: 'C.M. Cearense',    count: equipmentCounts?.cearense   ?? stats.cearense   },
      { color: [234, 88, 12]   as [number,number,number], label: 'C.M. Municipal',   count: equipmentCounts?.municipal  ?? stats.municipal  },
      { color: [192, 38, 211]  as [number,number,number], label: 'Sala Lilás Municipal',    count: equipmentCounts?.lilasMunicipal  ?? stats.lilasMunicipal  },
      { color: [232, 121, 249] as [number,number,number], label: 'Sala Lilás Gov. Estado',  count: equipmentCounts?.lilasEstado     ?? stats.lilasEstado     },
      { color: [240, 171, 252] as [number,number,number], label: 'Sala Lilás em Delegacia', count: equipmentCounts?.lilasDelegacia  ?? stats.lilasDelegacia  },
      { color: [21, 128, 61]   as [number,number,number], label: 'DDM',                    count: equipmentCounts?.ddm             ?? stats.ddm             },
      { color: [6, 182, 212]   as [number,number,number], label: 'Só Viatura',        count: stats.viaturaOnly },
      { color: [229, 231, 235] as [number,number,number], label: 'Sem Cobertura',     count: stats.semCobertura },
    ];
    legendItems.forEach((item, i) => {
      const ly = lgY + 11 + i * 8;
      doc.setFillColor(...item.color);
      doc.rect(lgX + 3, ly - 2.5, 4, 4, 'F');
      doc.setTextColor(0, 0, 0);
      doc.text(`${item.label} (${item.count})`, lgX + 9, ly);
    });
  }

  doc.save(highResolution ? `mapa-ceara-alta-resolucao_${ts()}.pdf` : `mapa-ceara_${ts()}.pdf`);
}