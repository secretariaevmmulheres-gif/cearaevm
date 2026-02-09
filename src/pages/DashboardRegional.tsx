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

  // Dados para o radar chart - valores absolutos
  const radarData = useMemo(() => {
    if (selectedRegiao === 'all') {
      return regionStats.slice(0, 5).map(r => ({
        regiao: r.regiao,
        Equipamentos: r.totalEquipamentos,
        'Patrulhas M.P.': r.totalViaturas,
        Solicitações: r.totalSolicitacoes,
        'Cobertura (%)': Math.round(r.cobertura),
      }));
    }

    const selected = regionStats.find(r => r.regiao === selectedRegiao);
    if (!selected) return [];

    return [{
      regiao: selected.regiao,
      Equipamentos: selected.totalEquipamentos,
      'Patrulhas M.P.': selected.totalViaturas,
      Solicitações: selected.totalSolicitacoes,
      'Cobertura (%)': Math.round(selected.cobertura),
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
          <div className="group bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-xl p-6 border border-primary/20 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-primary/40 animate-fade-up" style={{ animationDelay: '0ms' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              {getComparisonIcon(selectedStats.totalEquipamentos, totals.equipamentos / 14)}
            </div>
            <span className="text-sm font-medium text-muted-foreground">Equipamentos</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-display font-bold text-primary">{selectedStats.totalEquipamentos}</span>
              <span className="text-sm text-muted-foreground">de {totals.equipamentos}</span>
            </div>
          </div>
          <div className="group bg-gradient-to-br from-accent/10 via-accent/5 to-transparent rounded-xl p-6 border border-accent/20 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-accent/40 animate-fade-up" style={{ animationDelay: '50ms' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center">
                <Truck className="w-5 h-5 text-accent" />
              </div>
              {getComparisonIcon(selectedStats.totalViaturas, totals.viaturas / 14)}
            </div>
            <span className="text-sm font-medium text-muted-foreground">Patrulhas M.P.</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-display font-bold text-accent">{selectedStats.totalViaturas}</span>
              <span className="text-sm text-muted-foreground">({selectedStats.totalPatrulhasCasas} casas)</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedStats.patrulhasEmEquipamentos} equip. + {selectedStats.patrulhasDeSolicitacoes} solic.
            </p>
          </div>
          <div className="group bg-gradient-to-br from-warning/10 via-warning/5 to-transparent rounded-xl p-6 border border-warning/20 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-warning/40 animate-fade-up" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-warning/15 flex items-center justify-center">
                <FileText className="w-5 h-5 text-warning" />
              </div>
              {getComparisonIcon(selectedStats.totalSolicitacoes, totals.solicitacoes / 14)}
            </div>
            <span className="text-sm font-medium text-muted-foreground">Solicitações</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-display font-bold text-warning">{selectedStats.totalSolicitacoes}</span>
              <span className="text-sm text-muted-foreground">({selectedStats.solicitacoesEmAndamento} andamento)</span>
            </div>
          </div>
          <div className="group bg-gradient-to-br from-success/10 via-success/5 to-transparent rounded-xl p-6 border border-success/20 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-success/40 animate-fade-up" style={{ animationDelay: '150ms' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-success/15 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-success" />
              </div>
              {getComparisonIcon(selectedStats.cobertura, totals.mediaCobertura)}
            </div>
            <span className="text-sm font-medium text-muted-foreground">Cobertura</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-display font-bold text-success">{selectedStats.cobertura.toFixed(1)}%</span>
              <span className="text-sm text-muted-foreground">({selectedStats.municipiosComEquipamento}/{selectedStats.totalMunicipios})</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="group bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-xl p-6 border border-primary/20 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 animate-fade-up" style={{ animationDelay: '0ms' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Total Equipamentos</span>
            </div>
            <span className="text-3xl font-display font-bold text-primary">{totals.equipamentos}</span>
          </div>
          <div className="group bg-gradient-to-br from-accent/10 via-accent/5 to-transparent rounded-xl p-6 border border-accent/20 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 animate-fade-up" style={{ animationDelay: '50ms' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center">
                <Truck className="w-5 h-5 text-accent" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Total Patrulhas M.P.</span>
            </div>
            <span className="text-3xl font-display font-bold text-accent">{totals.viaturas}</span>
            <p className="text-xs text-muted-foreground mt-1">
              {totals.totalPatrulhasCasas} casas + {totals.viaturasPMCE} PMCE
            </p>
          </div>
          <div className="group bg-gradient-to-br from-warning/10 via-warning/5 to-transparent rounded-xl p-6 border border-warning/20 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 animate-fade-up" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-warning/15 flex items-center justify-center">
                <FileText className="w-5 h-5 text-warning" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Total Solicitações</span>
            </div>
            <span className="text-3xl font-display font-bold text-warning">{totals.solicitacoes}</span>
          </div>
          <div className="group bg-gradient-to-br from-success/10 via-success/5 to-transparent rounded-xl p-6 border border-success/20 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 animate-fade-up" style={{ animationDelay: '150ms' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-success/15 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-success" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Média de Cobertura</span>
            </div>
            <span className="text-3xl font-display font-bold text-success">{totals.mediaCobertura.toFixed(1)}%</span>
          </div>
        </div>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Gráfico de Barras - Cobertura por Região */}
        <div className="chart-card lg:col-span-2 animate-fade-up" style={{ animationDelay: '200ms' }}>
          <h3 className="chart-title mb-4">
            <div className="chart-title-dot bg-primary" />
            Cobertura por Região (%)
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} layout="vertical">
                <defs>
                  <linearGradient id="coverageGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(215, 70%, 50%)" />
                    <stop offset="100%" stopColor="hsl(280, 65%, 55%)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={true} vertical={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  tick={{ fontSize: 10, fill: 'hsl(var(--foreground))', fontWeight: 500 }} 
                  width={120}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                  }}
                  formatter={(value: number) => [`${value}%`, 'Cobertura']}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                />
                <Bar 
                  dataKey="cobertura" 
                  fill="url(#coverageGradient)" 
                  radius={[0, 8, 8, 0]}
                  animationDuration={1000}
                  label={{ position: 'right', fontSize: 11, fill: 'hsl(var(--foreground))', fontWeight: 600 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Barras - Comparativo */}
        <div className="chart-card animate-fade-up" style={{ animationDelay: '250ms' }}>
          <h3 className="chart-title mb-4">
            <div className="chart-title-dot bg-accent" />
            Recursos por Região
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData}>
                <defs>
                  <linearGradient id="equipGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(320, 60%, 50%)" />
                    <stop offset="100%" stopColor="hsl(320, 60%, 40%)" />
                  </linearGradient>
                  <linearGradient id="viatGradientBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(200, 85%, 55%)" />
                    <stop offset="100%" stopColor="hsl(200, 85%, 45%)" />
                  </linearGradient>
                  <linearGradient id="solicGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(38, 92%, 50%)" />
                    <stop offset="100%" stopColor="hsl(38, 92%, 40%)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} 
                  interval={0}
                  height={80}
                  tickFormatter={(value) => value.length > 10 ? value.substring(0, 8) + '...' : value}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                  }}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                />
                <Legend 
                  formatter={(value) => <span className="text-xs font-medium">{value}</span>}
                />
                <Bar dataKey="equipamentos" name="Equipamentos" fill="url(#equipGradient)" radius={[6, 6, 0, 0]} animationDuration={800} />
                <Bar dataKey="viaturas" name="Viaturas" fill="url(#viatGradientBar)" radius={[6, 6, 0, 0]} animationDuration={800} />
                <Bar dataKey="solicitacoes" name="Solicitações" fill="url(#solicGradient)" radius={[6, 6, 0, 0]} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar Chart - valores absolutos */}
        <div className="chart-card animate-fade-up" style={{ animationDelay: '300ms' }}>
          <h3 className="chart-title mb-4">
            <div className="chart-title-dot bg-success" />
            {selectedRegiao === 'all' ? 'Perfil das Top 5 Regiões (valores absolutos)' : `Perfil: ${selectedRegiao}`}
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={[
                { metric: 'Equipamentos', ...Object.fromEntries(radarData.map(r => [r.regiao, r.Equipamentos])) },
                { metric: 'Patrulhas M.P.', ...Object.fromEntries(radarData.map(r => [r.regiao, r['Patrulhas M.P.']])) },
                { metric: 'Solicitações', ...Object.fromEntries(radarData.map(r => [r.regiao, r.Solicitações])) },
                { metric: 'Cobertura (%)', ...Object.fromEntries(radarData.map(r => [r.regiao, r['Cobertura (%)']])) },
              ]}>
                <PolarGrid stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: 'hsl(var(--foreground))', fontWeight: 500 }} />
                <PolarRadiusAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                {radarData.map((r, idx) => (
                  <Radar
                    key={r.regiao}
                    name={r.regiao}
                    dataKey={r.regiao}
                    stroke={COLORS[idx % COLORS.length]}
                    fill={COLORS[idx % COLORS.length]}
                    fillOpacity={0.25}
                    strokeWidth={2}
                    animationDuration={800}
                  />
                ))}
                <Legend formatter={(value) => <span className="text-xs font-medium">{value}</span>} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Pizza - Equipamentos por Tipo */}
        <div className="chart-card animate-fade-up" style={{ animationDelay: '350ms' }}>
          <h3 className="chart-title mb-4">
            <div className="chart-title-dot bg-warning" />
            Equipamentos por Tipo {selectedRegiao !== 'all' && `(${selectedRegiao})`}
          </h3>
          <div className="h-80">
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {pieChartData.map((entry, index) => (
                      <linearGradient key={index} id={`pieEquipGrad${index}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                        <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="45%"
                    labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }}
                    label={({ value }) => value}
                    innerRadius={45}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    animationDuration={1000}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`url(#pieEquipGrad${index})`} stroke="hsl(var(--background))" strokeWidth={3} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Legend formatter={(value) => <span className="text-xs font-medium">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Building2 className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Nenhum equipamento nesta seleção</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Gráfico de Pizza - Status de Solicitações */}
        <div className="chart-card animate-fade-up" style={{ animationDelay: '400ms' }}>
          <h3 className="chart-title mb-4">
            <div className="chart-title-dot bg-info" />
            Solicitações por Status {selectedRegiao !== 'all' && `(${selectedRegiao})`}
          </h3>
          <div className="h-80">
            {statusChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {statusChartData.map((entry, index) => (
                      <linearGradient key={index} id={`pieStatusGrad${index}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                        <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="45%"
                    labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }}
                    label={({ value }) => value}
                    innerRadius={45}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    animationDuration={1000}
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`url(#pieStatusGrad${index})`} stroke="hsl(var(--background))" strokeWidth={3} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Legend formatter={(value) => <span className="text-xs font-medium">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Nenhuma solicitação nesta seleção</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabela Comparativa */}
      <div className="chart-card overflow-hidden animate-fade-up" style={{ animationDelay: '450ms' }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="chart-title-dot bg-primary" />
          <h3 className="font-display font-semibold text-lg">Ranking por Região</h3>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border/50">
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
                    selectedRegiao === r.regiao && "bg-primary/5 ring-1 ring-inset ring-primary/20"
                  )}
                  style={{ animationDelay: `${450 + idx * 30}ms` }}
                >
                  <td>
                    <span className={cn(
                      "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                      idx === 0 && "bg-yellow-500/20 text-yellow-600",
                      idx === 1 && "bg-gray-400/20 text-gray-600",
                      idx === 2 && "bg-amber-600/20 text-amber-700",
                      idx > 2 && "bg-muted text-muted-foreground"
                    )}>
                      {idx + 1}
                    </span>
                  </td>
                  <td className="font-medium">{r.regiao}</td>
                  <td className="text-center text-muted-foreground">{r.totalMunicipios}</td>
                  <td className="text-center">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10">
                      <Building2 className="w-3.5 h-3.5 text-primary" />
                      <span className="font-semibold text-primary">{r.totalEquipamentos}</span>
                    </span>
                  </td>
                  <td className="text-center">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent/10">
                      <Truck className="w-3.5 h-3.5 text-accent" />
                      <span className="font-semibold text-accent">{r.totalViaturas}</span>
                    </span>
                  </td>
                  <td className="text-center">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-warning/10">
                      <FileText className="w-3.5 h-3.5 text-warning" />
                      <span className="font-semibold text-warning">{r.totalSolicitacoes}</span>
                    </span>
                  </td>
                  <td className="text-center">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-info/10">
                      <Clock className="w-3.5 h-3.5 text-info" />
                      <span className="font-semibold text-info">{r.solicitacoesEmAndamento}</span>
                    </span>
                  </td>
                  <td className="text-center">
                    <div className="flex items-center gap-2 justify-center">
                      <div className="w-20 bg-muted/50 rounded-full h-2.5 overflow-hidden shadow-inner">
                        <div
                          className={cn(
                            "h-full transition-all duration-700 rounded-full",
                            r.cobertura >= 50 ? "bg-gradient-to-r from-success to-emerald-400" : 
                            r.cobertura >= 25 ? "bg-gradient-to-r from-warning to-amber-400" : 
                            "bg-gradient-to-r from-destructive to-red-400"
                          )}
                          style={{ width: `${r.cobertura}%` }}
                        />
                      </div>
                      <span className={cn(
                        "text-sm font-bold tabular-nums",
                        r.cobertura >= 50 ? "text-success" : r.cobertura >= 25 ? "text-warning" : "text-destructive"
                      )}>
                        {r.cobertura.toFixed(1)}%
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
