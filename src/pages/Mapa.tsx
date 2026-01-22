import { useState, useMemo, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useEquipamentos } from '@/hooks/useEquipamentos';
import { useViaturas } from '@/hooks/useViaturas';
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import { municipiosCeara, tiposEquipamento, statusSolicitacao, regioesList, getRegiao } from '@/data/municipios';
import { CEARA_GEOJSON_URL } from '@/data/ceara-geojson-url';
import { Building2, Truck, FileText, X, Loader2, RefreshCw, Filter, Search, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Layer, PathOptions } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { exportMapToPDF } from '@/lib/exportUtils';
import { toast } from 'sonner';

import { Equipamento, Viatura, Solicitacao } from '@/types';
import { TipoEquipamento, StatusSolicitacao } from '@/data/municipios';

// Normalização de nomes de municípios (GeoJSON pode ter variações)
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

// Color mapping for hex colors
const priorityColors: Record<number, string> = {
  1: '#0d9488', // brasileira - teal-600
  2: '#7c3aed', // cearense - violet-600
  3: '#ea580c', // municipal - orange-600
  4: '#d946ef', // lilas - fuchsia-500
  5: '#06b6d4', // viatura - cyan-500
  6: '#e5e7eb', // sem cobertura - gray-200
  0: '#9ca3af', // filtered out - gray-400
};

export default function Mapa() {
  const { equipamentos } = useEquipamentos();
  const { viaturas } = useViaturas();
  const { solicitacoes } = useSolicitacoes();
  const [selectedMunicipio, setSelectedMunicipio] = useState<MunicipioData | null>(null);
  const [geoJsonData, setGeoJsonData] = useState<FeatureCollection | null>(null);
  const [isLoadingGeoJson, setIsLoadingGeoJson] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Filters
  const [filterTipoEquipamento, setFilterTipoEquipamento] = useState<string>('all');
  const [filterStatusSolicitacao, setFilterStatusSolicitacao] = useState<string>('all');
  const [filterApenasComViatura, setFilterApenasComViatura] = useState(false);
  const [filterRegiao, setFilterRegiao] = useState<string>('all');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);

  // Export options state
  const [exportHighRes, setExportHighRes] = useState(false);
  const [exportEmbedLegend, setExportEmbedLegend] = useState(true);

  // Export handler
  const handleExportMap = async () => {
    if (!mapContainerRef.current) {
      toast.error('Não foi possível capturar o mapa');
      return;
    }
    
    setIsExporting(true);
    try {
      await exportMapToPDF(
        mapContainerRef.current,
        {
          tipoEquipamento: filterTipoEquipamento,
          statusSolicitacao: filterStatusSolicitacao,
          apenasComViatura: filterApenasComViatura,
          regiao: filterRegiao,
        },
        stats,
        {
          highResolution: exportHighRes,
          embedLegend: exportEmbedLegend,
        },
        equipmentCounts
      );
      toast.success('Mapa exportado com sucesso!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erro ao exportar o mapa');
    } finally {
      setIsExporting(false);
    }
  };
  // Fetch GeoJSON data
  useEffect(() => {
    fetch(CEARA_GEOJSON_URL)
      .then(res => res.json())
      .then((data: FeatureCollection) => {
        setGeoJsonData(data);
        setIsLoadingGeoJson(false);
      })
      .catch(err => {
        console.error('Error loading GeoJSON:', err);
        setIsLoadingGeoJson(false);
      });
  }, []);

  const municipiosData = useMemo(() => {
    const dataMap = new Map<string, MunicipioData>();
    
    municipiosCeara.forEach((nome) => {
      const eqs = equipamentos.filter((e) => e.municipio === nome);
      const viats = viaturas.filter((v) => v.municipio === nome);
      const sols = solicitacoes.filter((s) => s.municipio === nome);

      // Apply filters
      let visible = true;
      
      // Filter by region
      if (filterRegiao !== 'all') {
        const municipioRegiao = getRegiao(nome);
        if (municipioRegiao !== filterRegiao) visible = false;
      }
      
      // Filter by equipment type
      if (filterTipoEquipamento !== 'all') {
        const hasEquipType = eqs.some((e) => e.tipo === filterTipoEquipamento);
        if (!hasEquipType) visible = false;
      }
      
      // Filter by solicitacao status
      if (filterStatusSolicitacao !== 'all') {
        const hasSolStatus = sols.some((s) => s.status === filterStatusSolicitacao);
        if (!hasSolStatus) visible = false;
      }
      
      // Filter only with viatura (includes patrulhas das casas from equipamentos and solicitações)
      if (filterApenasComViatura) {
        const hasViatura = viats.length > 0;
        const hasPatrulhaEquipamento = eqs.some((e) => e.possui_patrulha);
        const hasPatrulhaSolicitacao = sols.some((s) => s.recebeu_patrulha);
        
        if (!hasViatura && !hasPatrulhaEquipamento && !hasPatrulhaSolicitacao) {
          visible = false;
        }
      }

      // Determinar prioridade e cor
      let prioridade = 6;
      let cor = 'bg-muted';
      let hexColor = priorityColors[6];

      if (!visible) {
        prioridade = 0;
        cor = 'bg-muted/50';
        hexColor = priorityColors[0];
      } else if (eqs.some((e) => e.tipo === 'Casa da Mulher Brasileira')) {
        prioridade = 1;
        cor = 'bg-equipment-brasileira';
        hexColor = priorityColors[1];
      } else if (eqs.some((e) => e.tipo === 'Casa da Mulher Cearense')) {
        prioridade = 2;
        cor = 'bg-equipment-cearense';
        hexColor = priorityColors[2];
      } else if (eqs.some((e) => e.tipo === 'Casa da Mulher Municipal')) {
        prioridade = 3;
        cor = 'bg-equipment-municipal';
        hexColor = priorityColors[3];
      } else if (eqs.some((e) => e.tipo === 'Sala Lilás')) {
        prioridade = 4;
        cor = 'bg-equipment-lilas';
        hexColor = priorityColors[4];
      } else if (viats.length > 0) {
        prioridade = 5;
        cor = 'bg-equipment-viatura';
        hexColor = priorityColors[5];
      }

      dataMap.set(normalizarNome(nome), {
        nome,
        equipamentos: eqs,
        viaturas: viats,
        solicitacoes: sols,
        prioridade,
        cor,
        hexColor,
        visible,
      });
    });

    return dataMap;
  }, [equipamentos, viaturas, solicitacoes, filterTipoEquipamento, filterStatusSolicitacao, filterApenasComViatura, filterRegiao]);

  // Contagem de equipamentos por tipo (contagem real, não por prioridade de município)
  const equipmentCounts = useMemo(() => {
    const counts = {
      brasileira: 0,
      cearense: 0,
      municipal: 0,
      lilas: 0,
    };

    // Filtrar equipamentos visíveis baseado nos filtros ativos
    let visibleEquipamentos = equipamentos;
    
    if (filterRegiao !== 'all') {
      visibleEquipamentos = visibleEquipamentos.filter(e => getRegiao(e.municipio) === filterRegiao);
    }
    
    if (filterTipoEquipamento !== 'all') {
      visibleEquipamentos = visibleEquipamentos.filter(e => e.tipo === filterTipoEquipamento);
    }

    visibleEquipamentos.forEach((e) => {
      switch (e.tipo) {
        case 'Casa da Mulher Brasileira':
          counts.brasileira++;
          break;
        case 'Casa da Mulher Cearense':
          counts.cearense++;
          break;
        case 'Casa da Mulher Municipal':
          counts.municipal++;
          break;
        case 'Sala Lilás':
          counts.lilas++;
          break;
      }
    });

    return counts;
  }, [equipamentos, filterRegiao, filterTipoEquipamento]);

  // Contagem de municípios por prioridade (para visualização do mapa)
  const stats = useMemo(() => {
    const counts = {
      brasileira: 0,
      cearense: 0,
      municipal: 0,
      lilas: 0,
      viaturaOnly: 0,
      semCobertura: 0,
      filteredOut: 0,
    };

    municipiosData.forEach((m) => {
      if (!m.visible) {
        counts.filteredOut++;
        return;
      }
      switch (m.prioridade) {
        case 1:
          counts.brasileira++;
          break;
        case 2:
          counts.cearense++;
          break;
        case 3:
          counts.municipal++;
          break;
        case 4:
          counts.lilas++;
          break;
        case 5:
          counts.viaturaOnly++;
          break;
        default:
          counts.semCobertura++;
      }
    });

    return counts;
  }, [municipiosData]);

  // Get style for each feature
  const getFeatureStyle = (feature: Feature<Geometry> | undefined): PathOptions => {
    if (!feature?.properties) {
      return {
        fillColor: priorityColors[6],
        weight: 1,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: 0.7,
      };
    }

    // GeoJSON uses "name" property for municipality name
    const municipioName = feature.properties.name as string;
    const municipioData = municipiosData.get(normalizarNome(municipioName));

    return {
      fillColor: municipioData?.hexColor || priorityColors[6],
      weight: 1,
      opacity: 1,
      color: '#ffffff',
      fillOpacity: 0.7,
    };
  };

  // Handle feature interactions
  const onEachFeature = (feature: Feature<Geometry>, layer: Layer) => {
    const municipioName = feature.properties?.name as string;
    const municipioData = municipiosData.get(normalizarNome(municipioName));

    layer.on({
      mouseover: (e) => {
        const target = e.target;
        target.setStyle({
          weight: 3,
          color: '#1f2937',
          fillOpacity: 0.9,
        });
        target.bringToFront();
      },
      mouseout: (e) => {
        const target = e.target;
        target.setStyle({
          weight: 1,
          color: '#ffffff',
          fillOpacity: 0.7,
        });
      },
      click: () => {
        if (municipioData) {
          setSelectedMunicipio(municipioData);
        } else {
          // Create default data for municipalities not in our list
          setSelectedMunicipio({
            nome: municipioName,
            equipamentos: [],
            viaturas: [],
            solicitacoes: [],
            prioridade: 6,
            cor: 'bg-muted',
            hexColor: priorityColors[6],
            visible: true,
          });
        }
      },
    });

    layer.bindTooltip(municipioName, {
      permanent: false,
      direction: 'center',
      className: 'bg-card text-foreground border border-border rounded-md px-2 py-1 text-xs shadow-lg',
    });
  };

  return (
    <AppLayout>
      <PageHeader title="Mapa do Ceará" description="Visualização geográfica da cobertura estadual" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Legenda e Filtros */}
        <div className="lg:col-span-1 space-y-4">
          {/* Filtros */}
          {/* Busca */}
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-4 h-4 text-primary" />
              <h3 className="font-display font-semibold">Buscar Município</h3>
            </div>
            <div className="relative">
              <Input
                placeholder="Digite o nome..."
                value={searchQuery}
                onChange={(e) => {
                  const query = e.target.value;
                  setSearchQuery(query);
                  if (query.length >= 2) {
                    const results = municipiosCeara.filter((m) =>
                      m.toLowerCase().includes(query.toLowerCase())
                    );
                    setSearchResults(results.slice(0, 5));
                  } else {
                    setSearchResults([]);
                  }
                }}
                className="pr-8"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
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
                        onClick={() => {
                          if (data) {
                            setSelectedMunicipio(data);
                          } else {
                            setSelectedMunicipio({
                              nome: municipio,
                              equipamentos: [],
                              viaturas: [],
                              solicitacoes: [],
                              prioridade: 6,
                              cor: 'bg-muted',
                              hexColor: priorityColors[6],
                              visible: true,
                            });
                          }
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left rounded hover:bg-muted transition-colors"
                      >
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: data?.hexColor || priorityColors[6] }}
                        />
                        {municipio}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Filtros */}
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-primary" />
              <h3 className="font-display font-semibold">Filtros</h3>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Região de Planejamento</Label>
                <Select value={filterRegiao} onValueChange={setFilterRegiao}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as regiões</SelectItem>
                    {regioesList.map((regiao) => (
                      <SelectItem key={regiao} value={regiao}>{regiao}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Tipo de Equipamento</Label>
                <Select value={filterTipoEquipamento} onValueChange={setFilterTipoEquipamento}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {tiposEquipamento.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Status da Solicitação</Label>
                <Select value={filterStatusSolicitacao} onValueChange={setFilterStatusSolicitacao}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    {statusSolicitacao.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Apenas com Viatura</Label>
                <Switch
                  checked={filterApenasComViatura}
                  onCheckedChange={setFilterApenasComViatura}
                />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
            <h3 className="font-display font-semibold mb-4">Legenda (Equipamentos)</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: priorityColors[1] }} />
                <span className="text-sm">Casa da Mulher Brasileira ({equipmentCounts.brasileira})</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: priorityColors[2] }} />
                <span className="text-sm">Casa da Mulher Cearense ({equipmentCounts.cearense})</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: priorityColors[3] }} />
                <span className="text-sm">Casa da Mulher Municipal ({equipmentCounts.municipal})</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: priorityColors[4] }} />
                <span className="text-sm">Sala Lilás ({equipmentCounts.lilas})</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: priorityColors[5] }} />
                <span className="text-sm">Só Viatura ({stats.viaturaOnly} municípios)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded border border-border" style={{ backgroundColor: priorityColors[6] }} />
                <span className="text-sm">Sem Cobertura ({stats.semCobertura} municípios)</span>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
            <h3 className="font-display font-semibold mb-2">Cobertura Total</h3>
            <p className="text-3xl font-display font-bold text-primary">
              {((stats.brasileira + stats.cearense + stats.municipal + stats.lilas) / 184 * 100).toFixed(1)}%
            </p>
            <p className="text-sm text-muted-foreground">
              {stats.brasileira + stats.cearense + stats.municipal + stats.lilas} de 184 municípios com equipamento
            </p>
          </div>

          {/* Exportar Mapa */}
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm space-y-3">
            <h3 className="font-display font-semibold text-sm">Exportar Mapa</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Alta Resolução</Label>
                <Switch
                  checked={exportHighRes}
                  onCheckedChange={setExportHighRes}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Legenda Embutida</Label>
                <Switch
                  checked={exportEmbedLegend}
                  onCheckedChange={setExportEmbedLegend}
                />
              </div>
            </div>
            <Button
              onClick={handleExportMap}
              disabled={isExporting || isLoadingGeoJson}
              className="w-full gap-2"
              variant="outline"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Exportar Mapa PDF
            </Button>
          </div>
        </div>

        {/* Mapa Leaflet */}
        <div className="lg:col-span-3">
          <div
            ref={mapContainerRef}
            className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
            style={{ height: '600px' }}
          >
            {isLoadingGeoJson ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Carregando mapa...</span>
              </div>
            ) : (
              <ErrorBoundary
                fallback={
                  <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                    <RefreshCw className="w-8 h-8 text-muted-foreground mb-3" />
                    <p className="font-medium text-foreground">Erro ao carregar o mapa</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Isso normalmente acontece após uma atualização de dependências. Recarregue a página (Ctrl+Shift+R).
                    </p>
                  </div>
                }
              >
                <MapContainer
                  center={[-5.2, -39.5]}
                  zoom={7}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {geoJsonData && (
                    <GeoJSON data={geoJsonData} style={getFeatureStyle} onEachFeature={onEachFeature} />
                  )}
                </MapContainer>
              </ErrorBoundary>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Clique em um município para ver detalhes
          </p>
        </div>
      </div>

      {/* Modal de detalhes */}
      {selectedMunicipio && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-lg max-w-md w-full max-h-[80vh] overflow-y-auto animate-scale-in">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: selectedMunicipio.hexColor }} />
                  <h2 className="font-display text-xl font-bold">{selectedMunicipio.nome}</h2>
                </div>
                <button
                  onClick={() => setSelectedMunicipio(null)}
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Equipamentos */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-sm">
                    Equipamentos ({selectedMunicipio.equipamentos.length})
                  </h3>
                </div>
                {selectedMunicipio.equipamentos.length === 0 ? (
                  <p className="text-sm text-muted-foreground pl-6">Nenhum equipamento</p>
                ) : (
                  <ul className="space-y-1 pl-6">
                    {selectedMunicipio.equipamentos.map((e) => (
                      <li key={e.id} className="text-sm">
                        • {e.tipo}
                        {e.possui_patrulha && (
                          <span className="text-success ml-1">(com Patrulha)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Viaturas */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="w-4 h-4 text-info" />
                  <h3 className="font-semibold text-sm">
                    Viaturas ({(() => {
                      const viaturasCount = selectedMunicipio.viaturas.reduce((sum, v) => sum + v.quantidade, 0);
                      const patrulhasEquip = selectedMunicipio.equipamentos.filter(e => e.possui_patrulha).length;
                      const patrulhasSolic = selectedMunicipio.solicitacoes.filter(s => s.recebeu_patrulha).length;
                      return viaturasCount + patrulhasEquip + patrulhasSolic;
                    })()})
                  </h3>
                </div>
                {selectedMunicipio.viaturas.length === 0 && 
                 !selectedMunicipio.equipamentos.some(e => e.possui_patrulha) && 
                 !selectedMunicipio.solicitacoes.some(s => s.recebeu_patrulha) ? (
                  <p className="text-sm text-muted-foreground pl-6">Nenhuma viatura</p>
                ) : (
                  <ul className="space-y-1 pl-6">
                    {selectedMunicipio.viaturas.map((v) => (
                      <li key={v.id} className="text-sm">
                        • {v.quantidade}x {v.orgao_responsavel}
                        {v.vinculada_equipamento && (
                          <span className="text-muted-foreground ml-1">(vinculada a equipamento)</span>
                        )}
                      </li>
                    ))}
                    {selectedMunicipio.equipamentos.filter(e => e.possui_patrulha).map((e) => (
                      <li key={`patrulha-equip-${e.id}`} className="text-sm">
                        • 1x Patrulha das Casas <span className="text-success">(via {e.tipo})</span>
                      </li>
                    ))}
                    {selectedMunicipio.solicitacoes.filter(s => s.recebeu_patrulha).map((s) => (
                      <li key={`patrulha-solic-${s.id}`} className="text-sm">
                        • 1x Patrulha das Casas <span className="text-warning">(via Solicitação - {s.status})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Solicitações */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-warning" />
                  <h3 className="font-semibold text-sm">
                    Solicitações ({selectedMunicipio.solicitacoes.length})
                  </h3>
                </div>
                {selectedMunicipio.solicitacoes.length === 0 ? (
                  <p className="text-sm text-muted-foreground pl-6">Nenhuma solicitação</p>
                ) : (
                  <ul className="space-y-1 pl-6">
                    {selectedMunicipio.solicitacoes.map((s) => (
                      <li key={s.id} className="text-sm">
                        • {s.tipo_equipamento}{' '}
                        <span className="text-muted-foreground">({s.status})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
