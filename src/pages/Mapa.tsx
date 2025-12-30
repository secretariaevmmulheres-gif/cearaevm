import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useDataStore } from '@/store/dataStore';
import { municipiosCeara } from '@/data/municipios';
import { Building2, Truck, FileText, MapPin, X } from 'lucide-react';
import { cn } from '@/lib/utils';

import { Equipamento, Viatura, Solicitacao } from '@/types';

interface MunicipioData {
  nome: string;
  equipamentos: Equipamento[];
  viaturas: Viatura[];
  solicitacoes: Solicitacao[];
  prioridade: number;
  cor: string;
}

export default function Mapa() {
  const { equipamentos, viaturas, solicitacoes } = useDataStore();
  const [selectedMunicipio, setSelectedMunicipio] = useState<MunicipioData | null>(null);
  const [hoveredMunicipio, setHoveredMunicipio] = useState<string | null>(null);

  const municipiosData = useMemo(() => {
    return municipiosCeara.map((nome) => {
      const eqs = equipamentos.filter((e) => e.municipio === nome);
      const viats = viaturas.filter((v) => v.municipio === nome);
      const sols = solicitacoes.filter((s) => s.municipio === nome);

      // Determinar prioridade e cor
      let prioridade = 6;
      let cor = 'bg-muted';

      if (eqs.some((e) => e.tipo === 'Casa da Mulher Brasileira')) {
        prioridade = 1;
        cor = 'bg-equipment-brasileira';
      } else if (eqs.some((e) => e.tipo === 'Casa da Mulher Cearense')) {
        prioridade = 2;
        cor = 'bg-equipment-cearense';
      } else if (eqs.some((e) => e.tipo === 'Casa da Mulher Municipal')) {
        prioridade = 3;
        cor = 'bg-equipment-municipal';
      } else if (eqs.some((e) => e.tipo === 'Sala Lilás')) {
        prioridade = 4;
        cor = 'bg-equipment-lilas';
      } else if (viats.length > 0) {
        prioridade = 5;
        cor = 'bg-equipment-viatura';
      }

      return {
        nome,
        equipamentos: eqs,
        viaturas: viats,
        solicitacoes: sols,
        prioridade,
        cor,
      };
    });
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
                <div className="w-4 h-4 rounded bg-equipment-brasileira" />
                <span className="text-sm">Casa da Mulher Brasileira ({stats.brasileira})</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-equipment-cearense" />
                <span className="text-sm">Casa da Mulher Cearense ({stats.cearense})</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-equipment-municipal" />
                <span className="text-sm">Casa da Mulher Municipal ({stats.municipal})</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-equipment-lilas" />
                <span className="text-sm">Sala Lilás ({stats.lilas})</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-equipment-viatura" />
                <span className="text-sm">Só Viatura ({stats.viaturaOnly})</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-muted border border-border" />
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

        {/* Mapa Grid */}
        <div className="lg:col-span-3">
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
            <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-14 gap-1">
              {municipiosData.map((m) => (
                <button
                  key={m.nome}
                  className={cn(
                    'aspect-square rounded-sm transition-all duration-200 relative group',
                    m.cor,
                    hoveredMunicipio === m.nome && 'ring-2 ring-primary ring-offset-1 scale-110 z-10',
                    selectedMunicipio?.nome === m.nome && 'ring-2 ring-foreground'
                  )}
                  onClick={() => setSelectedMunicipio(m)}
                  onMouseEnter={() => setHoveredMunicipio(m.nome)}
                  onMouseLeave={() => setHoveredMunicipio(null)}
                  title={m.nome}
                >
                  <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-foreground text-background text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                    {m.nome}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Clique em um município para ver detalhes
            </p>
          </div>
        </div>
      </div>

      {/* Modal de detalhes */}
      {selectedMunicipio && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-lg max-w-md w-full max-h-[80vh] overflow-y-auto animate-scale-in">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn('w-4 h-4 rounded', selectedMunicipio.cor)} />
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
                        {e.possuiPatrulha && (
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
                        • {v.quantidade}x {v.orgaoResponsavel}
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
                        • {s.tipoEquipamento}{' '}
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
