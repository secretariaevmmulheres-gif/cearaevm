import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useEquipamentos } from '@/hooks/useEquipamentos';
import { useViaturas } from '@/hooks/useViaturas';
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import { municipiosCeara, tiposEquipamento, statusSolicitacao, regioesList, getRegiao, getMunicipiosPorRegiao } from '@/data/municipios';
import { CEARA_GEOJSON_URL } from '@/data/ceara-geojson-url';
import {
  Building2, Truck, FileText, X, Loader2, RefreshCw,
  Filter, Search, Download, MapPin, ShieldCheck,
  CheckCircle2, AlertCircle, ChevronRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Layer, PathOptions, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { exportMapToPDF, captureMapImage, CapturedMapImage } from '@/lib/exportUtils';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Equipamento, Viatura, Solicitacao } from '@/types';

const normalizarNome = (nome: string): string => {
  const normalizacao: Record<string, string> = {
    'itapagé': 'itapajé',
    'itapaje': 'itapajé',
  };
  const nomeNormalizado = nome.toLowerCase().trim();
  return normalizacao[nomeNormalizado] || nomeNormalizado;
};

interface MunicipioData {
  nome: string;
  equipamentos: Equipamento[];
  viaturas: Viatura[];
  solicitacoes: Solicitacao[];
  prioridade: number;
  cor: string;
  hexColor: string;
  visible: boolean;
}

const priorityColors: Record<number, string> = {
  1: '#0d9488',
  2: '#7c3aed',
  3: '#ea580c',
  4: '#d946ef',
  5: '#06b6d4',
  6: '#e5e7eb',
  0: '#9ca3af',
};

// Mini progress bar component
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full bg-muted/60 rounded-full h-1.5 overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </div>
  );
}

// Checklist item for modal
function CheckItem({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done
        ? <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
        : <AlertCircle className="w-4 h-4 text-muted-foreground/40 shrink-0" />}
      <span className={done ? 'text-foreground' : 'text-muted-foreground line-through'}>{label}</span>
    </div>
  );
}

export default function Mapa() {
  const { equipamentos } = useEquipamentos();
  const { viaturas } = useViaturas();
  const { solicitacoes } = useSolicitacoes();
  const [selectedMunicipio, setSelectedMunicipio] = useState<MunicipioData | null>(null);
  const [geoJsonData, setGeoJsonData] = useState<FeatureCollection | null>(null);
  const [isLoadingGeoJson, setIsLoadingGeoJson] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<LeafletMap | null>(null);

  const [filterTipoEquipamento, setFilterTipoEquipamento] = useState<string>('all');
  const [filterStatusSolicitacao, setFilterStatusSolicitacao] = useState<string>('all');
  const [filterApenasComViatura, setFilterApenasComViatura] = useState(false);
  const [filterRegiao, setFilterRegiao] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [exportHighRes, setExportHighRes] = useState(false);
  const [exportEmbedLegend, setExportEmbedLegend] = useState(true);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [previewImageData, setPreviewImageData] = useState<CapturedMapImage | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCaptureForPreview = async () => {
    if (!mapContainerRef.current) { toast.error('Não foi possível capturar o mapa'); return; }
    setIsCapturing(true);
    try {
      leafletMapRef.current?.invalidateSize(true);
      await new Promise((r) => setTimeout(r, 350));
      const captured = await captureMapImage(mapContainerRef.current, exportHighRes);
      setPreviewImageData(captured);
      setShowExportPreview(true);
    } catch {
      toast.error('Erro ao capturar o mapa');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRecapture = async () => { setPreviewImageData(null); await handleCaptureForPreview(); };

  const handleConfirmExport = async () => {
    if (!mapContainerRef.current || !previewImageData) { toast.error('Erro ao exportar'); return; }
    setIsExporting(true);
    try {
      await exportMapToPDF(
        mapContainerRef.current,
        { tipoEquipamento: filterTipoEquipamento, statusSolicitacao: filterStatusSolicitacao, apenasComViatura: filterApenasComViatura, regiao: filterRegiao },
        stats,
        { highResolution: exportHighRes, embedLegend: exportEmbedLegend },
        equipmentCounts,
        previewImageData
      );
      toast.success('Mapa exportado com sucesso!');
      setShowExportPreview(false);
      setPreviewImageData(null);
    } catch {
      toast.error('Erro ao exportar o mapa');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    fetch(CEARA_GEOJSON_URL)
      .then(r => r.json())
      .then((data: FeatureCollection) => { setGeoJsonData(data); setIsLoadingGeoJson(false); })
      .catch(() => setIsLoadingGeoJson(false));
  }, []);

  const municipiosData = useMemo(() => {
    const dataMap = new Map<string, MunicipioData>();
    municipiosCeara.forEach((nome) => {
      const eqs = equipamentos.filter((e) => e.municipio === nome);
      const viats = viaturas.filter((v) => v.municipio === nome);
      const sols = solicitacoes.filter((s) => s.municipio === nome);
      let visible = true;
      if (filterRegiao !== 'all' && getRegiao(nome) !== filterRegiao) visible = false;
      if (filterTipoEquipamento !== 'all' && !eqs.some((e) => e.tipo === filterTipoEquipamento)) visible = false;
      if (filterStatusSolicitacao !== 'all' && !sols.some((s) => s.status === filterStatusSolicitacao)) visible = false;
      if (filterApenasComViatura) {
        const hasViatura = viats.length > 0 || eqs.some((e) => e.possui_patrulha) || sols.some((s) => s.recebeu_patrulha);
        if (!hasViatura) visible = false;
      }
      let prioridade = 6; let cor = 'bg-muted'; let hexColor = priorityColors[6];
      if (!visible) { prioridade = 0; cor = 'bg-muted/50'; hexColor = priorityColors[0]; }
      else if (eqs.some((e) => e.tipo === 'Casa da Mulher Brasileira')) { prioridade = 1; cor = 'bg-equipment-brasileira'; hexColor = priorityColors[1]; }
      else if (eqs.some((e) => e.tipo === 'Casa da Mulher Cearense')) { prioridade = 2; cor = 'bg-equipment-cearense'; hexColor = priorityColors[2]; }
      else if (eqs.some((e) => e.tipo === 'Casa da Mulher Municipal')) { prioridade = 3; cor = 'bg-equipment-municipal'; hexColor = priorityColors[3]; }
      else if (eqs.some((e) => e.tipo === 'Sala Lilás')) { prioridade = 4; cor = 'bg-equipment-lilas'; hexColor = priorityColors[4]; }
      else if (viats.length > 0) { prioridade = 5; cor = 'bg-equipment-viatura'; hexColor = priorityColors[5]; }
      dataMap.set(normalizarNome(nome), { nome, equipamentos: eqs, viaturas: viats, solicitacoes: sols, prioridade, cor, hexColor, visible });
    });
    return dataMap;
  }, [equipamentos, viaturas, solicitacoes, filterTipoEquipamento, filterStatusSolicitacao, filterApenasComViatura, filterRegiao]);

  const equipmentCounts = useMemo(() => {
    const counts = { brasileira: 0, cearense: 0, municipal: 0, lilas: 0 };
    let vis = equipamentos;
    if (filterRegiao !== 'all') vis = vis.filter(e => getRegiao(e.municipio) === filterRegiao);
    if (filterTipoEquipamento !== 'all') vis = vis.filter(e => e.tipo === filterTipoEquipamento);
    vis.forEach((e) => {
      if (e.tipo === 'Casa da Mulher Brasileira') counts.brasileira++;
      else if (e.tipo === 'Casa da Mulher Cearense') counts.cearense++;
      else if (e.tipo === 'Casa da Mulher Municipal') counts.municipal++;
      else if (e.tipo === 'Sala Lilás') counts.lilas++;
    });
    return counts;
  }, [equipamentos, filterRegiao, filterTipoEquipamento]);

  const stats = useMemo(() => {
    const counts = { brasileira: 0, cearense: 0, municipal: 0, lilas: 0, viaturaOnly: 0, semCobertura: 0, filteredOut: 0 };
    municipiosData.forEach((m) => {
      if (!m.visible) { counts.filteredOut++; return; }
      if (m.prioridade === 1) counts.brasileira++;
      else if (m.prioridade === 2) counts.cearense++;
      else if (m.prioridade === 3) counts.municipal++;
      else if (m.prioridade === 4) counts.lilas++;
      else if (m.prioridade === 5) counts.viaturaOnly++;
      else counts.semCobertura++;
    });
    return counts;
  }, [municipiosData]);

  // Cobertura por região para barras de progresso
  const coberturaPorRegiao = useMemo(() => {
    return regioesList.map((regiao) => {
      const municipios = getMunicipiosPorRegiao(regiao);
      const total = municipios.length;
      const comEquipamento = municipios.filter((m) => {
        const data = municipiosData.get(normalizarNome(m));
        return data && data.visible && data.prioridade >= 1 && data.prioridade <= 4;
      }).length;
      return { regiao, total, comEquipamento, pct: total > 0 ? (comEquipamento / total) * 100 : 0 };
    }).sort((a, b) => b.pct - a.pct);
  }, [municipiosData]);

  const getFeatureStyle = (feature: Feature<Geometry> | undefined): PathOptions => {
    if (!feature?.properties) return { fillColor: priorityColors[6], weight: 1, opacity: 1, color: '#ffffff', fillOpacity: 0.7 };
    const municipioData = municipiosData.get(normalizarNome(feature.properties.name as string));
    return { fillColor: municipioData?.hexColor || priorityColors[6], weight: 1, opacity: 1, color: '#ffffff', fillOpacity: 0.7 };
  };

  const onEachFeature = (feature: Feature<Geometry>, layer: Layer) => {
    const municipioName = feature.properties?.name as string;
    const municipioData = municipiosData.get(normalizarNome(municipioName));
    layer.on({
      mouseover: (e) => { e.target.setStyle({ weight: 3, color: '#1f2937', fillOpacity: 0.9 }); e.target.bringToFront(); },
      mouseout: (e) => { e.target.setStyle({ weight: 1, color: '#ffffff', fillOpacity: 0.7 }); },
      click: () => {
        setSelectedMunicipio(municipioData || { nome: municipioName, equipamentos: [], viaturas: [], solicitacoes: [], prioridade: 6, cor: 'bg-muted', hexColor: priorityColors[6], visible: true });
      },
    });
    layer.bindTooltip(municipioName, { permanent: false, direction: 'center', className: 'bg-card text-foreground border border-border rounded-md px-2 py-1 text-xs shadow-lg' });
  };

  const totalComEquipamento = stats.brasileira + stats.cearense + stats.municipal + stats.lilas;
  const coberturaGeral = ((totalComEquipamento / 184) * 100);

  const legendItems = [
    { color: priorityColors[1], label: 'Casa da Mulher Brasileira', count: equipmentCounts.brasileira },
    { color: priorityColors[2], label: 'Casa da Mulher Cearense', count: equipmentCounts.cearense },
    { color: priorityColors[3], label: 'Casa da Mulher Municipal', count: equipmentCounts.municipal },
    { color: priorityColors[4], label: 'Sala Lilás', count: equipmentCounts.lilas },
    { color: priorityColors[5], label: 'Só Viatura', count: stats.viaturaOnly },
    { color: priorityColors[6], label: 'Sem Cobertura', count: stats.semCobertura },
  ];

  return (
    <AppLayout>
      <PageHeader title="Mapa do Ceará" description="Visualização geográfica da cobertura estadual" />

      {/* ── Layout principal: sidebar + mapa ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* ── Painel lateral: apenas cobertura geral, busca e filtros ── */}
        <div className="lg:col-span-1 space-y-4">

          {/* Card de cobertura geral */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-primary/10 via-card to-card rounded-2xl p-4 border border-primary/20 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cobertura Geral</p>
                <p className="text-2xl font-bold text-primary leading-none">{coberturaGeral.toFixed(1)}%</p>
              </div>
            </div>
            <ProgressBar value={totalComEquipamento} max={184} color="hsl(var(--primary))" />
            <p className="text-xs text-muted-foreground mt-1.5">{totalComEquipamento} de 184 municípios com equipamento</p>
          </motion.div>

          {/* Busca */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-card rounded-2xl p-4 border border-border shadow-sm"
          >
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Buscar Município</h3>
            </div>
            <div className="relative">
              <Input
                placeholder="Digite o nome..."
                value={searchQuery}
                onChange={(e) => {
                  const q = e.target.value;
                  setSearchQuery(q);
                  setSearchResults(q.length >= 2 ? municipiosCeara.filter(m => m.toLowerCase().includes(q.toLowerCase())).slice(0, 5) : []);
                }}
                className="pr-8 rounded-xl"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {searchResults.length > 0 && (
              <ul className="mt-2 space-y-1">
                {searchResults.map((municipio) => {
                  const data = municipiosData.get(normalizarNome(municipio));
                  return (
                    <li key={municipio}>
                      <button
                        onClick={() => { setSelectedMunicipio(data || { nome: municipio, equipamentos: [], viaturas: [], solicitacoes: [], prioridade: 6, cor: 'bg-muted', hexColor: priorityColors[6], visible: true }); setSearchQuery(''); setSearchResults([]); }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left rounded-lg hover:bg-muted transition-colors"
                      >
                        <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: data?.hexColor || priorityColors[6] }} />
                        {municipio}
                        <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>

          {/* Filtros */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-card rounded-2xl p-4 border border-border shadow-sm"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Filter className="w-3.5 h-3.5 text-primary" />
              </div>
              <h3 className="font-semibold text-sm">Filtros</h3>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Região de Planejamento</Label>
                <Select value={filterRegiao} onValueChange={setFilterRegiao}>
                  <SelectTrigger className="rounded-xl h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as regiões</SelectItem>
                    {regioesList.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tipo de Equipamento</Label>
                <Select value={filterTipoEquipamento} onValueChange={setFilterTipoEquipamento}>
                  <SelectTrigger className="rounded-xl h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {tiposEquipamento.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status da Solicitação</Label>
                <Select value={filterStatusSolicitacao} onValueChange={setFilterStatusSolicitacao}>
                  <SelectTrigger className="rounded-xl h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    {statusSolicitacao.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between py-1">
                <Label className="text-xs text-muted-foreground">Apenas com Viatura</Label>
                <Switch checked={filterApenasComViatura} onCheckedChange={setFilterApenasComViatura} />
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Mapa ── */}
        <div className="lg:col-span-3">
          <motion.div initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
            <div
              ref={mapContainerRef}
              className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
              style={{ height: '600px' }}
            >
              {isLoadingGeoJson ? (
                <div className="flex items-center justify-center h-full gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-muted-foreground text-sm">Carregando mapa...</span>
                </div>
              ) : (
                <ErrorBoundary fallback={
                  <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                    <RefreshCw className="w-8 h-8 text-muted-foreground mb-3" />
                    <p className="font-medium">Erro ao carregar o mapa</p>
                    <p className="text-sm text-muted-foreground mt-1">Recarregue a página (Ctrl+Shift+R).</p>
                  </div>
                }>
                  <MapContainer
                    ref={leafletMapRef as any}
                    center={[-5.2, -39.5]}
                    zoom={7}
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom={true}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {geoJsonData && <GeoJSON data={geoJsonData} style={getFeatureStyle} onEachFeature={onEachFeature} />}
                  </MapContainer>
                </ErrorBoundary>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Clique em um município para ver detalhes
            </p>
          </motion.div>
        </div>
      </div>

      {/* ── Faixa abaixo do mapa: Legenda | Cobertura por Região | Exportar ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">

        {/* Legenda */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-card rounded-2xl p-4 border border-border shadow-sm"
        >
          <h3 className="font-semibold text-sm mb-3">Legenda</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {legendItems.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-sm shrink-0 shadow-sm" style={{ backgroundColor: item.color, border: item.color === priorityColors[6] ? '1px solid #d1d5db' : 'none' }} />
                <span className="text-xs text-foreground flex-1 truncate">{item.label}</span>
                <span className="text-xs font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{item.count}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Cobertura por Região */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-card rounded-2xl p-4 border border-border shadow-sm"
        >
          <h3 className="font-semibold text-sm mb-3">Cobertura por Região</h3>
          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
            {coberturaPorRegiao.map((r) => (
              <div key={r.regiao}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-foreground truncate max-w-[160px]" title={r.regiao}>{r.regiao}</span>
                  <span className="text-xs font-semibold text-primary ml-2 shrink-0">{r.pct.toFixed(0)}%</span>
                </div>
                <ProgressBar
                  value={r.comEquipamento}
                  max={r.total}
                  color={r.pct >= 50 ? 'hsl(160, 60%, 45%)' : r.pct >= 25 ? 'hsl(40, 85%, 55%)' : 'hsl(0, 70%, 55%)'}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">{r.comEquipamento}/{r.total} municípios</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Exportar */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-card rounded-2xl p-4 border border-border shadow-sm flex flex-col justify-between"
        >
          <div>
            <h3 className="font-semibold text-sm mb-3">Exportar Mapa</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Alta Resolução</Label>
                <Switch checked={exportHighRes} onCheckedChange={setExportHighRes} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Legenda Embutida</Label>
                <Switch checked={exportEmbedLegend} onCheckedChange={setExportEmbedLegend} />
              </div>
            </div>
          </div>
          <Button
            onClick={handleCaptureForPreview}
            disabled={isCapturing || isExporting || isLoadingGeoJson}
            className="w-full gap-2 rounded-xl mt-4"
            variant="outline"
          >
            {isCapturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isCapturing ? 'Capturando...' : 'Exportar PDF'}
          </Button>
        </motion.div>
      </div>

      {/* ── Modal de preview de exportação ── */}
      <Dialog open={showExportPreview} onOpenChange={setShowExportPreview}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Preview da Exportação</DialogTitle>
            <DialogDescription>Verifique se o mapa está correto antes de exportar.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center items-center p-2 bg-muted/30 rounded-xl min-h-[300px]">
            {previewImageData ? (
              <img src={previewImageData.dataUrl} alt="Preview do mapa" className="max-w-full max-h-[50vh] rounded-xl shadow-md object-contain" />
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Capturando imagem...</span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleRecapture} disabled={isCapturing} className="gap-2 rounded-xl">
              <RefreshCw className={cn('w-4 h-4', isCapturing && 'animate-spin')} />
              Recapturar
            </Button>
            <Button variant="ghost" onClick={() => { setShowExportPreview(false); setPreviewImageData(null); }}>Cancelar</Button>
            <Button onClick={handleConfirmExport} disabled={isExporting || !previewImageData} className="gap-2 rounded-xl">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Exportar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal de detalhes do município ── */}
      <AnimatePresence>
        {selectedMunicipio && (
          <motion.div
            key="municipio-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-[1000] flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedMunicipio(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 16 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="bg-card rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto border border-border"
            >
              {/* Header do modal */}
              <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border px-5 py-4 flex items-center justify-between z-10 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-sm shadow-sm" style={{ backgroundColor: selectedMunicipio.hexColor }} />
                  <h2 className="font-bold text-lg">{selectedMunicipio.nome}</h2>
                </div>
                <button onClick={() => setSelectedMunicipio(null)} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Barras de progresso do checklist (solicitações) */}
                {selectedMunicipio.solicitacoes.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      Checklist das Solicitações
                    </h3>
                    {selectedMunicipio.solicitacoes.map((s) => {
                      const checks = [
                        { label: 'Patrulha M.P.', done: s.recebeu_patrulha },
                        { label: 'Kit Athena', done: s.kit_athena_entregue },
                        { label: 'Capacitação', done: s.capacitacao_realizada },
                        { label: 'Suíte Implantada', done: !!s.suite_implantada },
                        { label: 'Guarda Municipal', done: s.guarda_municipal_estruturada },
                      ];
                      const done = checks.filter(c => c.done).length;
                      return (
                        <div key={s.id} className="bg-muted/40 rounded-xl p-3 mb-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium">{s.tipo_equipamento}</span>
                            <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full border">{s.status}</span>
                          </div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-muted-foreground">{done}/{checks.length} itens concluídos</span>
                            <span className="text-xs font-semibold text-primary">{Math.round((done / checks.length) * 100)}%</span>
                          </div>
                          <ProgressBar value={done} max={checks.length} color={done === checks.length ? 'hsl(160, 60%, 45%)' : done >= 3 ? 'hsl(215, 70%, 55%)' : 'hsl(40, 85%, 55%)'} />
                          <div className="mt-2 space-y-1">
                            {checks.map(c => <CheckItem key={c.label} label={c.label} done={c.done} />)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Equipamentos */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-sm">Equipamentos ({selectedMunicipio.equipamentos.length})</h3>
                  </div>
                  {selectedMunicipio.equipamentos.length === 0 ? (
                    <p className="text-sm text-muted-foreground pl-8">Nenhum equipamento</p>
                  ) : (
                    <div className="space-y-1.5 pl-8">
                      {selectedMunicipio.equipamentos.map((e) => (
                        <div key={e.id} className="flex items-center gap-2 text-sm bg-muted/30 rounded-lg px-2.5 py-1.5">
                          <span className="flex-1">{e.tipo}</span>
                          {e.possui_patrulha && <span className="text-xs text-success bg-success/10 px-1.5 py-0.5 rounded-full">Patrulha ✓</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Viaturas */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-info/10 flex items-center justify-center">
                      <Truck className="w-3.5 h-3.5 text-info" />
                    </div>
                    <h3 className="font-semibold text-sm">
                      Viaturas ({(() => {
                        const viaturasCount = selectedMunicipio.viaturas.reduce((s, v) => s + v.quantidade, 0);
                        const patrulhasEquip = selectedMunicipio.equipamentos.filter(e => e.possui_patrulha).length;
                        const patrulhasSolic = selectedMunicipio.solicitacoes.filter(s => s.recebeu_patrulha).length;
                        return viaturasCount + patrulhasEquip + patrulhasSolic;
                      })()})
                    </h3>
                  </div>
                  {selectedMunicipio.viaturas.length === 0 && !selectedMunicipio.equipamentos.some(e => e.possui_patrulha) && !selectedMunicipio.solicitacoes.some(s => s.recebeu_patrulha) ? (
                    <p className="text-sm text-muted-foreground pl-8">Nenhuma viatura</p>
                  ) : (
                    <div className="space-y-1.5 pl-8">
                      {selectedMunicipio.viaturas.map((v) => (
                        <div key={v.id} className="flex items-center gap-2 text-sm bg-muted/30 rounded-lg px-2.5 py-1.5">
                          <span className="flex-1">{v.quantidade}x {v.orgao_responsavel}</span>
                          {v.vinculada_equipamento && <span className="text-xs text-muted-foreground">vinculada</span>}
                        </div>
                      ))}
                      {selectedMunicipio.equipamentos.filter(e => e.possui_patrulha).map((e) => (
                        <div key={`pe-${e.id}`} className="flex items-center gap-2 text-sm bg-success/5 rounded-lg px-2.5 py-1.5 border border-success/20">
                          <span className="flex-1">1x Patrulha das Casas</span>
                          <span className="text-xs text-success">via {e.tipo}</span>
                        </div>
                      ))}
                      {selectedMunicipio.solicitacoes.filter(s => s.recebeu_patrulha).map((s) => (
                        <div key={`ps-${s.id}`} className="flex items-center gap-2 text-sm bg-warning/5 rounded-lg px-2.5 py-1.5 border border-warning/20">
                          <span className="flex-1">1x Patrulha das Casas</span>
                          <span className="text-xs text-warning">Solicitação · {s.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Solicitações sem checklist (já mostradas acima) */}
                {selectedMunicipio.solicitacoes.length === 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-lg bg-warning/10 flex items-center justify-center">
                        <FileText className="w-3.5 h-3.5 text-warning" />
                      </div>
                      <h3 className="font-semibold text-sm">Solicitações (0)</h3>
                    </div>
                    <p className="text-sm text-muted-foreground pl-8">Nenhuma solicitação</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}