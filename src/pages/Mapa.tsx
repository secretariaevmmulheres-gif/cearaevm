import { useState, useMemo, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useEquipamentos } from '@/hooks/useEquipamentos';
import { useViaturas } from '@/hooks/useViaturas';
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import { municipiosCeara } from '@/data/municipios';
import { CEARA_GEOJSON_URL } from '@/data/ceara-geojson-url';
import { Building2, Truck, FileText, X, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Layer, PathOptions } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';

import { Equipamento, Viatura, Solicitacao } from '@/types';

interface MunicipioData {
  nome: string;
  equipamentos: Equipamento[];
  viaturas: Viatura[];
  solicitacoes: Solicitacao[];
  prioridade: number;
  cor: string;
  hexColor: string;
}

// Color mapping for hex colors
const priorityColors: Record<number, string> = {
  1: '#0d9488', // brasileira - teal-600
  2: '#7c3aed', // cearense - violet-600
  3: '#ea580c', // municipal - orange-600
  4: '#d946ef', // lilas - fuchsia-500
  5: '#06b6d4', // viatura - cyan-500
  6: '#e5e7eb', // sem cobertura - gray-200
};

export default function Mapa() {
  const { equipamentos } = useEquipamentos();
  const { viaturas } = useViaturas();
  const { solicitacoes } = useSolicitacoes();
  const [selectedMunicipio, setSelectedMunicipio] = useState<MunicipioData | null>(null);
  const [geoJsonData, setGeoJsonData] = useState<FeatureCollection | null>(null);
  const [isLoadingGeoJson, setIsLoadingGeoJson] = useState(true);

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

      // Determinar prioridade e cor
      let prioridade = 6;
      let cor = 'bg-muted';
      let hexColor = priorityColors[6];

      if (eqs.some((e) => e.tipo === 'Casa da Mulher Brasileira')) {
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

      dataMap.set(nome.toLowerCase(), {
        nome,
        equipamentos: eqs,
        viaturas: viats,
        solicitacoes: sols,
        prioridade,
        cor,
        hexColor,
      });
    });

    return dataMap;
  }, [equipamentos, viaturas, solicitacoes]);

  const stats = useMemo(() => {
    const counts = {
      brasileira: 0,
      cearense: 0,
      municipal: 0,
      lilas: 0,
      viaturaOnly: 0,
      semCobertura: 0,
    };

    municipiosData.forEach((m) => {
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
    const municipioData = municipiosData.get(municipioName.toLowerCase());

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
    const municipioData = municipiosData.get(municipioName.toLowerCase());

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
        {/* Legenda */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
            <h3 className="font-display font-semibold mb-4">Legenda</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: priorityColors[1] }} />
                <span className="text-sm">Casa da Mulher Brasileira ({stats.brasileira})</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: priorityColors[2] }} />
                <span className="text-sm">Casa da Mulher Cearense ({stats.cearense})</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: priorityColors[3] }} />
                <span className="text-sm">Casa da Mulher Municipal ({stats.municipal})</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: priorityColors[4] }} />
                <span className="text-sm">Sala Lilás ({stats.lilas})</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: priorityColors[5] }} />
                <span className="text-sm">Só Viatura ({stats.viaturaOnly})</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded border border-border" style={{ backgroundColor: priorityColors[6] }} />
                <span className="text-sm">Sem Cobertura ({stats.semCobertura})</span>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
            <h3 className="font-display font-semibold mb-2">Cobertura Total</h3>
            <p className="text-3xl font-display font-bold text-primary">
              {((184 - stats.semCobertura) / 184 * 100).toFixed(1)}%
            </p>
            <p className="text-sm text-muted-foreground">
              {184 - stats.semCobertura} de 184 municípios
            </p>
          </div>
        </div>

        {/* Mapa Leaflet */}
        <div className="lg:col-span-3">
          <div
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
                    Viaturas (
                    {selectedMunicipio.viaturas.reduce((sum, v) => sum + v.quantidade, 0)})
                  </h3>
                </div>
                {selectedMunicipio.viaturas.length === 0 ? (
                  <p className="text-sm text-muted-foreground pl-6">Nenhuma viatura</p>
                ) : (
                  <ul className="space-y-1 pl-6">
                    {selectedMunicipio.viaturas.map((v) => (
                      <li key={v.id} className="text-sm">
                        • {v.quantidade}x {v.orgao_responsavel}
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
