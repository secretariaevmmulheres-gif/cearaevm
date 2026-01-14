import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useEquipamentos } from '@/hooks/useEquipamentos';
import { useViaturas } from '@/hooks/useViaturas';
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import { regioesList, getRegiao, getMunicipiosPorRegiao, RegiaoPlanejamento } from '@/data/municipios';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Truck, FileText, MapPin, CheckCircle2, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

interface RegionStats {
  regiao: RegiaoPlanejamento;
  totalMunicipios: number;
  municipiosComEquipamento: number;
  totalEquipamentos: number;
  totalViaturas: number;
  viaturasVinculadas: number;
  viaturasNaoVinculadas: number;
  patrulhasEmEquipamentos: number;
  totalSolicitacoes: number;
  solicitacoesEmAndamento: number;
  cobertura: number;
}

const COLORS = [
  '#c026d3', '#7c3aed', '#0ea5e9', '#ec4899', '#6366f1', 
  '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444', '#22c55e',
  '#3b82f6', '#a855f7', '#06b6d4', '#84cc16'
];

export default function DashboardRegional() {
  const { equipamentos } = useEquipamentos();
  const { viaturas } = useViaturas();
  const { solicitacoes } = useSolicitacoes();
  const [selectedRegiao, setSelectedRegiao] = useState<string>('all');

  // Calcula estatísticas por região
  const regionStats = useMemo(() => {
    const stats: RegionStats[] = regioesList.map((regiao) => {
      const municipiosDaRegiao = getMunicipiosPorRegiao(regiao);
      const totalMunicipios = municipiosDaRegiao.length;
      
      const equipamentosDaRegiao = equipamentos.filter(e => getRegiao(e.municipio) === regiao);
      const municipiosComEquipamento = new Set(equipamentosDaRegiao.map(e => e.municipio)).size;
      const patrulhasEmEquipamentos = equipamentosDaRegiao.filter(e => e.possui_patrulha).length;
      
      const viaturasDaRegiao = viaturas.filter(v => getRegiao(v.municipio) === regiao);
      const viaturasNaoVinculadas = viaturasDaRegiao.filter(v => !v.vinculada_equipamento).reduce((sum, v) => sum + v.quantidade, 0);
      const viaturasVinculadas = viaturasDaRegiao.filter(v => v.vinculada_equipamento).reduce((sum, v) => sum + v.quantidade, 0);
      // Total de viaturas inclui: viaturas cadastradas + patrulhas vinculadas aos equipamentos
      const totalViaturas = viaturasDaRegiao.reduce((sum, v) => sum + v.quantidade, 0) + patrulhasEmEquipamentos;
      
      const solicitacoesDaRegiao = solicitacoes.filter(s => getRegiao(s.municipio) === regiao);
      const solicitacoesEmAndamento = solicitacoesDaRegiao.filter(s => 
        ['Recebida', 'Em análise', 'Aprovada', 'Em implantação'].includes(s.status)
      ).length;

      return {
        regiao,
        totalMunicipios,
        municipiosComEquipamento,
        totalEquipamentos: equipamentosDaRegiao.length,
        totalViaturas,
        viaturasVinculadas,
        viaturasNaoVinculadas,
        patrulhasEmEquipamentos,
        totalSolicitacoes: solicitacoesDaRegiao.length,
        solicitacoesEmAndamento,
        cobertura: totalMunicipios > 0 ? (municipiosComEquipamento / totalMunicipios) * 100 : 0,
      };
    });

    return stats.sort((a, b) => b.cobertura - a.cobertura);
  }, [equipamentos, viaturas, solicitacoes]);

  // Dados para o gráfico de barras comparativo
  const barChartData = useMemo(() => {
    return regionStats.map((r, idx) => ({
      name: r.regiao.length > 15 ? r.regiao.substring(0, 12) + '...' : r.regiao,
      fullName: r.regiao,
      equipamentos: r.totalEquipamentos,
      viaturas: r.totalViaturas,
      solicitacoes: r.totalSolicitacoes,
      cobertura: Math.round(r.cobertura),
      color: COLORS[idx % COLORS.length],
    }));
  }, [regionStats]);

  // Dados para o radar chart
  const radarData = useMemo(() => {
    const maxValues = {
      equipamentos: Math.max(...regionStats.map(r => r.totalEquipamentos), 1),
      viaturas: Math.max(...regionStats.map(r => r.totalViaturas), 1),
      solicitacoes: Math.max(...regionStats.map(r => r.totalSolicitacoes), 1),
      cobertura: 100,
      municipios: Math.max(...regionStats.map(r => r.totalMunicipios), 1),
    };

    if (selectedRegiao === 'all') {
      // Mostra top 5 regiões no radar
      return regionStats.slice(0, 5).map(r => ({
        regiao: r.regiao,
        Equipamentos: (r.totalEquipamentos / maxValues.equipamentos) * 100,
        Viaturas: (r.totalViaturas / maxValues.viaturas) * 100,
        Solicitações: (r.totalSolicitacoes / maxValues.solicitacoes) * 100,
        Cobertura: r.cobertura,
      }));
    }

    const selected = regionStats.find(r => r.regiao === selectedRegiao);
    if (!selected) return [];

    return [{
      regiao: selected.regiao,
      Equipamentos: (selected.totalEquipamentos / maxValues.equipamentos) * 100,
      Viaturas: (selected.totalViaturas / maxValues.viaturas) * 100,
      Solicitações: (selected.totalSolicitacoes / maxValues.solicitacoes) * 100,
      Cobertura: selected.cobertura,
    }];
  }, [regionStats, selectedRegiao]);

  // Estatísticas totais
  const patrulhasEmEquipamentos = equipamentos.filter(e => e.possui_patrulha).length;
  const totals = useMemo(() => ({
    equipamentos: equipamentos.length,
    viaturas: viaturas.reduce((sum, v) => sum + v.quantidade, 0) + patrulhasEmEquipamentos,
    viaturasNaoVinculadas: viaturas.filter(v => !v.vinculada_equipamento).reduce((sum, v) => sum + v.quantidade, 0),
    patrulhasEmEquipamentos,
    solicitacoes: solicitacoes.length,
    mediaCobertura: regionStats.reduce((sum, r) => sum + r.cobertura, 0) / regionStats.length,
  }), [equipamentos, viaturas, solicitacoes, regionStats, patrulhasEmEquipamentos]);

  // Região selecionada
  const selectedStats = selectedRegiao !== 'all' 
    ? regionStats.find(r => r.regiao === selectedRegiao) 
    : null;

  const getComparisonIcon = (value: number, average: number) => {
    if (value > average * 1.2) return <TrendingUp className="w-4 h-4 text-success" />;
    if (value < average * 0.8) return <TrendingDown className="w-4 h-4 text-destructive" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <PageHeader
          title="Dashboard Regional"
          description="Estatísticas comparativas entre as 14 regiões de planejamento do Ceará"
        />
        <Select value={selectedRegiao} onValueChange={setSelectedRegiao}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Selecione uma região" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Regiões</SelectItem>
            {regioesList.map((regiao) => (
              <SelectItem key={regiao} value={regiao}>
                {regiao}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cards de Resumo */}
      {selectedStats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Equipamentos</span>
              {getComparisonIcon(selectedStats.totalEquipamentos, totals.equipamentos / 14)}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-bold text-primary">{selectedStats.totalEquipamentos}</span>
              <span className="text-sm text-muted-foreground">de {totals.equipamentos} total</span>
            </div>
          </div>
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Patrulhas M.P.</span>
              {getComparisonIcon(selectedStats.totalViaturas, totals.viaturas / 14)}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-bold text-accent">{selectedStats.totalViaturas}</span>
              <span className="text-sm text-muted-foreground">({selectedStats.patrulhasEmEquipamentos} em casas)</span>
            </div>
          </div>
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Solicitações</span>
              {getComparisonIcon(selectedStats.totalSolicitacoes, totals.solicitacoes / 14)}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-bold text-warning">{selectedStats.totalSolicitacoes}</span>
              <span className="text-sm text-muted-foreground">({selectedStats.solicitacoesEmAndamento} em andamento)</span>
            </div>
          </div>
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Cobertura</span>
              {getComparisonIcon(selectedStats.cobertura, totals.mediaCobertura)}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-bold text-success">{selectedStats.cobertura.toFixed(2)}%</span>
              <span className="text-sm text-muted-foreground">({selectedStats.municipiosComEquipamento}/{selectedStats.totalMunicipios} municípios)</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">Total Equipamentos</span>
            </div>
            <span className="text-3xl font-display font-bold">{totals.equipamentos}</span>
          </div>
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Truck className="w-5 h-5 text-accent" />
              <span className="text-sm text-muted-foreground">Total Patrulhas M.P.</span>
            </div>
            <span className="text-3xl font-display font-bold">{totals.viaturas}</span>
            <p className="text-xs text-muted-foreground mt-1">{totals.patrulhasEmEquipamentos} em casas + {totals.viaturasNaoVinculadas} PMCE</p>
          </div>
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-warning" />
              <span className="text-sm text-muted-foreground">Total Solicitações</span>
            </div>
            <span className="text-3xl font-display font-bold">{totals.solicitacoes}</span>
          </div>
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <MapPin className="w-5 h-5 text-success" />
              <span className="text-sm text-muted-foreground">Média de Cobertura</span>
            </div>
            <span className="text-3xl font-display font-bold">{totals.mediaCobertura.toFixed(2)}%</span>
          </div>
        </div>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Gráfico de Barras - Cobertura por Região */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm lg:col-span-2">
          <h3 className="font-display font-semibold text-lg mb-4">Cobertura por Região (%)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  tick={{ fontSize: 10 }} 
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number, name: string) => [`${value}%`, 'Cobertura']}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                />
                <Bar 
                  dataKey="cobertura" 
                  fill="hsl(var(--primary))" 
                  radius={[0, 4, 4, 0]}
                  label={{ position: 'right', fontSize: 11, fill: 'hsl(var(--foreground))' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Barras - Comparativo */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
          <h3 className="font-display font-semibold text-lg mb-4">Recursos por Região</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 9 }} 
                  interval={0}
                  height={80}
                  tickFormatter={(value) => value.length > 10 ? value.substring(0, 8) + '...' : value}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                />
                <Legend />
                <Bar dataKey="equipamentos" name="Equipamentos" fill="#c026d3" radius={[4, 4, 0, 0]} />
                <Bar dataKey="viaturas" name="Viaturas" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="solicitacoes" name="Solicitações" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar Chart */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
          <h3 className="font-display font-semibold text-lg mb-4">
            {selectedRegiao === 'all' ? 'Perfil das Top 5 Regiões' : `Perfil: ${selectedRegiao}`}
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={[
                { metric: 'Equipamentos', ...Object.fromEntries(radarData.map(r => [r.regiao, r.Equipamentos])) },
                { metric: 'Viaturas', ...Object.fromEntries(radarData.map(r => [r.regiao, r.Viaturas])) },
                { metric: 'Solicitações', ...Object.fromEntries(radarData.map(r => [r.regiao, r.Solicitações])) },
                { metric: 'Cobertura', ...Object.fromEntries(radarData.map(r => [r.regiao, r.Cobertura])) },
              ]}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                {radarData.map((r, idx) => (
                  <Radar
                    key={r.regiao}
                    name={r.regiao}
                    dataKey={r.regiao}
                    stroke={COLORS[idx % COLORS.length]}
                    fill={COLORS[idx % COLORS.length]}
                    fillOpacity={0.3}
                  />
                ))}
                <Legend />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabela Comparativa */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-display font-semibold text-lg">Ranking por Região</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10">#</th>
                <th>Região</th>
                <th className="text-center">Municípios</th>
                <th className="text-center">Equipamentos</th>
                <th className="text-center">Viaturas</th>
                <th className="text-center">Solicitações</th>
                <th className="text-center">Em Andamento</th>
                <th className="text-center">Cobertura</th>
              </tr>
            </thead>
            <tbody>
              {regionStats.map((r, idx) => (
                <tr 
                  key={r.regiao} 
                  className={cn(
                    "animate-fade-in",
                    selectedRegiao === r.regiao && "bg-primary/5"
                  )}
                >
                  <td className="font-bold text-muted-foreground">{idx + 1}</td>
                  <td className="font-medium">{r.regiao}</td>
                  <td className="text-center">{r.totalMunicipios}</td>
                  <td className="text-center">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="w-4 h-4 text-primary" />
                      {r.totalEquipamentos}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className="inline-flex items-center gap-1">
                      <Truck className="w-4 h-4 text-accent" />
                      {r.totalViaturas}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className="inline-flex items-center gap-1">
                      <FileText className="w-4 h-4 text-warning" />
                      {r.totalSolicitacoes}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-4 h-4 text-info" />
                      {r.solicitacoesEmAndamento}
                    </span>
                  </td>
                  <td className="text-center">
                    <div className="flex items-center gap-2 justify-center">
                      <div className="w-16 bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all duration-500",
                            r.cobertura >= 50 ? "bg-success" : r.cobertura >= 25 ? "bg-warning" : "bg-destructive"
                          )}
                          style={{ width: `${r.cobertura}%` }}
                        />
                      </div>
                      <span className={cn(
                        "text-sm font-medium",
                        r.cobertura >= 50 ? "text-success" : r.cobertura >= 25 ? "text-warning" : "text-destructive"
                      )}>
                        {r.cobertura.toFixed(2)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
