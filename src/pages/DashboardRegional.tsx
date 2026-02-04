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
import { Building2, Truck, FileText, MapPin, CheckCircle2, Clock, TrendingUp, TrendingDown, Minus, Download, FileDown, ChevronDown } from 'lucide-react';
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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  exportRegionalToPDF,
  exportAllRegionsToPDF,
  exportAllRegionsToExcel,
  RegionStatsExport,
} from '@/lib/exportUtils';
import { MonthlyComparisonReport } from '@/components/dashboard/MonthlyComparisonReport';
import { RegionalGoalsPanel } from '@/components/dashboard/RegionalGoalsPanel';

interface RegionStats {
  regiao: RegiaoPlanejamento;
  totalMunicipios: number;
  municipiosComEquipamento: number;
  totalEquipamentos: number;
  totalViaturas: number;
  viaturasVinculadas: number;
  viaturasNaoVinculadas: number;
  patrulhasEmEquipamentos: number;
  patrulhasDeSolicitacoes: number;
  totalPatrulhasCasas: number;
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
      
      const solicitacoesDaRegiao = solicitacoes.filter(s => getRegiao(s.municipio) === regiao);
      const solicitacoesEmAndamento = solicitacoesDaRegiao.filter(s => 
        ['Recebida', 'Em análise', 'Aprovada', 'Em implantação'].includes(s.status)
      ).length;
      
      // Patrulhas de solicitações na região (exclui duplicidade com equipamentos)
      const municipiosComPatrulhaEquip = new Set(
        equipamentosDaRegiao.filter(e => e.possui_patrulha).map(e => e.municipio)
      );
      const patrulhasDeSolicitacoes = solicitacoesDaRegiao.filter(
        s => s.recebeu_patrulha && !municipiosComPatrulhaEquip.has(s.municipio)
      ).length;
      
      // Total de patrulhas das casas = equipamentos + solicitações
      const totalPatrulhasCasas = patrulhasEmEquipamentos + patrulhasDeSolicitacoes;
      
      // Total de viaturas inclui: viaturas PMCE + patrulhas das casas
      const totalViaturas = viaturasDaRegiao.reduce((sum, v) => sum + v.quantidade, 0) + totalPatrulhasCasas;

      return {
        regiao,
        totalMunicipios,
        municipiosComEquipamento,
        totalEquipamentos: equipamentosDaRegiao.length,
        totalViaturas,
        viaturasVinculadas,
        viaturasNaoVinculadas,
        patrulhasEmEquipamentos,
        patrulhasDeSolicitacoes,
        totalPatrulhasCasas,
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

  // Dados para gráfico de pizza - Equipamentos por tipo
  const pieChartData = useMemo(() => {
    const targetStats = selectedRegiao === 'all' ? null : regionStats.find(r => r.regiao === selectedRegiao);
    const filteredEquipamentos = targetStats 
      ? equipamentos.filter(e => getRegiao(e.municipio) === selectedRegiao)
      : equipamentos;
    
    const counts = {
      'Casa da Mulher Brasileira': 0,
      'Casa da Mulher Cearense': 0,
      'Casa da Mulher Municipal': 0,
      'Sala Lilás': 0,
    };

    filteredEquipamentos.forEach(e => {
      if (counts[e.tipo as keyof typeof counts] !== undefined) {
        counts[e.tipo as keyof typeof counts]++;
      }
    });

    return [
      { name: 'Brasileira', value: counts['Casa da Mulher Brasileira'], color: '#0d9488' },
      { name: 'Cearense', value: counts['Casa da Mulher Cearense'], color: '#7c3aed' },
      { name: 'Municipal', value: counts['Casa da Mulher Municipal'], color: '#ea580c' },
      { name: 'Sala Lilás', value: counts['Sala Lilás'], color: '#d946ef' },
    ].filter(item => item.value > 0);
  }, [equipamentos, selectedRegiao, regionStats]);

  // Dados para gráfico de status de solicitações
  const statusChartData = useMemo(() => {
    const targetStats = selectedRegiao === 'all' ? null : regionStats.find(r => r.regiao === selectedRegiao);
    const filteredSolicitacoes = targetStats 
      ? solicitacoes.filter(s => getRegiao(s.municipio) === selectedRegiao)
      : solicitacoes;
    
    const statusCounts: Record<string, number> = {};
    filteredSolicitacoes.forEach(s => {
      statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
    });

    const statusColors: Record<string, string> = {
      'Recebida': '#f59e0b',
      'Em análise': '#3b82f6',
      'Aprovada': '#22c55e',
      'Em implantação': '#8b5cf6',
      'Inaugurada': '#10b981',
      'Cancelada': '#ef4444',
    };

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status,
      value: count,
      color: statusColors[status] || '#6b7280',
    }));
  }, [solicitacoes, selectedRegiao, regionStats]);

  // Estatísticas totais
  const patrulhasEmEquipamentos = equipamentos.filter(e => e.possui_patrulha).length;
  const municipiosComPatrulhaEquipGlobal = new Set(
    equipamentos.filter(e => e.possui_patrulha).map(e => e.municipio)
  );
  const patrulhasDeSolicitacoesGlobal = solicitacoes.filter(
    s => s.recebeu_patrulha && !municipiosComPatrulhaEquipGlobal.has(s.municipio)
  ).length;
  const totalPatrulhasCasasGlobal = patrulhasEmEquipamentos + patrulhasDeSolicitacoesGlobal;
  
  const totals = useMemo(() => ({
    equipamentos: equipamentos.length,
    viaturasPMCE: viaturas.reduce((sum, v) => sum + v.quantidade, 0),
    totalPatrulhasCasas: totalPatrulhasCasasGlobal,
    patrulhasEmEquipamentos,
    patrulhasDeSolicitacoes: patrulhasDeSolicitacoesGlobal,
    viaturas: viaturas.reduce((sum, v) => sum + v.quantidade, 0) + totalPatrulhasCasasGlobal,
    viaturasNaoVinculadas: viaturas.filter(v => !v.vinculada_equipamento).reduce((sum, v) => sum + v.quantidade, 0),
    solicitacoes: solicitacoes.length,
    mediaCobertura: regionStats.reduce((sum, r) => sum + r.cobertura, 0) / regionStats.length,
  }), [equipamentos, viaturas, solicitacoes, regionStats, patrulhasEmEquipamentos, patrulhasDeSolicitacoesGlobal, totalPatrulhasCasasGlobal]);

  // Região selecionada
  const selectedStats = selectedRegiao !== 'all' 
    ? regionStats.find(r => r.regiao === selectedRegiao) 
    : null;

  const getComparisonIcon = (value: number, average: number) => {
    if (value > average * 1.2) return <TrendingUp className="w-4 h-4 text-success" />;
    if (value < average * 0.8) return <TrendingDown className="w-4 h-4 text-destructive" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  // Export handlers
  const handleExportSingleRegion = () => {
    if (!selectedStats) {
      toast.error('Selecione uma região para exportar');
      return;
    }
    exportRegionalToPDF(selectedStats as RegionStatsExport, equipamentos, viaturas, solicitacoes);
    toast.success(`Relatório da região ${selectedStats.regiao} exportado!`);
  };

  const handleExportAllRegionsPDF = () => {
    exportAllRegionsToPDF(regionStats as RegionStatsExport[], equipamentos, viaturas, solicitacoes);
    toast.success('Relatório consolidado de todas as regiões exportado!');
  };

  const handleExportAllRegionsExcel = () => {
    exportAllRegionsToExcel(regionStats as RegionStatsExport[], equipamentos, viaturas, solicitacoes);
    toast.success('Relatório consolidado em Excel exportado!');
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <PageHeader
          title="Dashboard Regional"
          description="Estatísticas comparativas entre as 14 regiões de planejamento do Ceará"
        />
        <div className="flex items-center gap-3">
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
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Exportar
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {selectedStats && (
                <>
                  <DropdownMenuItem onClick={handleExportSingleRegion} className="gap-2">
                    <FileDown className="w-4 h-4" />
                    Exportar {selectedStats.regiao} (PDF)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={handleExportAllRegionsPDF} className="gap-2">
                <FileDown className="w-4 h-4" />
                Todas as Regiões (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportAllRegionsExcel} className="gap-2">
                <FileDown className="w-4 h-4" />
                Todas as Regiões (Excel)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
              <span className="text-sm text-muted-foreground">({selectedStats.totalPatrulhasCasas} em casas)</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedStats.patrulhasEmEquipamentos} equip. + {selectedStats.patrulhasDeSolicitacoes} solic.
            </p>
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
            <p className="text-xs text-muted-foreground mt-1">
              {totals.totalPatrulhasCasas} casas ({totals.patrulhasEmEquipamentos} equip. + {totals.patrulhasDeSolicitacoes} solic.) + {totals.viaturasPMCE} PMCE
            </p>
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

        {/* Gráfico de Pizza - Equipamentos por Tipo */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
          <h3 className="font-display font-semibold text-lg mb-4">
            Equipamentos por Tipo {selectedRegiao !== 'all' && `(${selectedRegiao})`}
          </h3>
          <div className="h-80">
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Nenhum equipamento nesta seleção
              </div>
            )}
          </div>
        </div>

        {/* Gráfico de Pizza - Status de Solicitações */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
          <h3 className="font-display font-semibold text-lg mb-4">
            Solicitações por Status {selectedRegiao !== 'all' && `(${selectedRegiao})`}
          </h3>
          <div className="h-80">
            {statusChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, value, percent }) => `${name}: ${value}`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Nenhuma solicitação nesta seleção
              </div>
            )}
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

      {/* Painel de Metas Mensais */}
      <div className="mt-8">
        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <RegionalGoalsPanel 
            equipamentos={equipamentos}
            viaturas={viaturas}
            solicitacoes={solicitacoes}
          />
        </div>
      </div>

      {/* Relatório Mensal Comparativo */}
      <div className="mt-8">
        <MonthlyComparisonReport 
          equipamentos={equipamentos}
          viaturas={viaturas}
          solicitacoes={solicitacoes}
        />
      </div>
    </AppLayout>
  );
}
