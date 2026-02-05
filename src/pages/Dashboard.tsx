import { useMemo, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useEquipamentos } from '@/hooks/useEquipamentos';
import { useViaturas } from '@/hooks/useViaturas';
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Truck,
  FileText,
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  Download,
  Image,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportAllToPDF, exportAllToExcel, exportDashboardWithChartsToPDF } from '@/lib/exportUtils';
import { toast } from 'sonner';

const COLORS = [
  'hsl(280, 65%, 60%)',  // Purple
  'hsl(250, 65%, 60%)',  // Violet  
  'hsl(200, 85%, 55%)',  // Sky blue
  'hsl(330, 75%, 60%)',  // Pink
  'hsl(240, 65%, 60%)',  // Indigo
  'hsl(270, 65%, 55%)',  // Purple darker
];

const GRADIENT_COLORS = {
  primary: ['hsl(280, 65%, 60%)', 'hsl(250, 65%, 60%)'],
  accent: ['hsl(330, 75%, 60%)', 'hsl(280, 65%, 60%)'],
  success: ['hsl(160, 60%, 45%)', 'hsl(180, 70%, 50%)'],
};

// Custom tooltip style
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/95 backdrop-blur-sm border border-border rounded-xl px-4 py-3 shadow-xl">
        <p className="font-semibold text-sm text-foreground mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: <span className="font-bold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Custom pie label
const renderCustomPieLabel = ({ name, value, percent }: any) => {
  return `${name}: ${value} (${(percent * 100).toFixed(0)}%)`;
};

export default function Dashboard() {
  const chartsRef = useRef<HTMLDivElement>(null);
  const stats = useDashboardStats();
  const { equipamentos } = useEquipamentos();
  const { viaturas } = useViaturas();
  const { solicitacoes } = useSolicitacoes();

  const equipamentoChartData = Object.entries(stats.equipamentosPorTipo).map(([name, value]) => ({
    name: name.replace('Casa da Mulher ', 'C.M. ').replace('Sala Lilás', 'S. Lilás'),
    fullName: name,
    value,
  }));

  const solicitacoesChartData = Object.entries(stats.solicitacoesPorStatus)
    .filter(([_, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));

  // Gráfico de viaturas: PMCE + Patrulhas das Casas
  const viaturasChartData = [
    { name: 'PMCE', value: stats.viaturasPMCE },
    { name: 'Patrulhas das Casas', value: stats.viaturasPatrulhasCasas },
  ].filter(item => item.value > 0);

  // Evolução temporal - agrupa por mês
  const evolutionData = useMemo(() => {
    const monthlyData = new Map<string, { equipamentos: number; solicitacoes: number }>();

    // Processa equipamentos
    equipamentos.forEach((e) => {
      const month = format(parseISO(e.created_at), 'yyyy-MM');
      const existing = monthlyData.get(month) || { equipamentos: 0, solicitacoes: 0 };
      existing.equipamentos++;
      monthlyData.set(month, existing);
    });

    // Processa solicitações
    solicitacoes.forEach((s) => {
      const month = format(parseISO(s.created_at), 'yyyy-MM');
      const existing = monthlyData.get(month) || { equipamentos: 0, solicitacoes: 0 };
      existing.solicitacoes++;
      monthlyData.set(month, existing);
    });

    // Ordena e calcula acumulado
    const sorted = Array.from(monthlyData.entries()).sort(([a], [b]) => a.localeCompare(b));
    
    let accEquip = 0;
    let accSolic = 0;

    return sorted.map(([month, data]) => {
      accEquip += data.equipamentos;
      accSolic += data.solicitacoes;
      return {
        month: format(parseISO(`${month}-01`), 'MMM/yy', { locale: ptBR }),
        equipamentos: accEquip,
        solicitacoes: accSolic,
      };
    });
  }, [equipamentos, solicitacoes]);

  const handleExportWithCharts = async () => {
    if (!chartsRef.current) return;
    toast.loading('Gerando PDF com gráficos...', { id: 'export-charts' });
    try {
      await exportDashboardWithChartsToPDF(chartsRef.current, equipamentos, viaturas, solicitacoes, stats);
      toast.success('PDF com gráficos exportado!', { id: 'export-charts' });
    } catch (error) {
      toast.error('Erro ao exportar PDF', { id: 'export-charts' });
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <PageHeader
          title="Dashboard"
          description="Visão geral da Rede de Atendimento à Mulher no Ceará"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Exportar Tudo
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportWithCharts}>
              <Image className="w-4 h-4 mr-2" />
              PDF com Gráficos
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => exportAllToPDF(equipamentos, viaturas, solicitacoes)}>
              <FileText className="w-4 h-4 mr-2" />
              PDF (Tabelas)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportAllToExcel(equipamentos, viaturas, solicitacoes)}>
              <FileText className="w-4 h-4 mr-2" />
              Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          title="Total de Equipamentos"
          value={stats.totalEquipamentos}
          icon={Building2}
          variant="primary"
          description="Unidades cadastradas"
        />
        <StatCard
          title="Viaturas PMCE"
          value={stats.viaturasPMCE}
          icon={Truck}
          variant="accent"
          description="Batalhão PMCE"
        />
        <StatCard
          title="Patrulhas das Casas"
          value={stats.viaturasPatrulhasCasas}
          icon={Truck}
          variant="success"
          description="Vinculadas a equipamentos"
        />
        <StatCard
          title="Solicitações"
          value={stats.totalSolicitacoes}
          icon={FileText}
          variant="warning"
          description="Em acompanhamento"
        />
        <StatCard
          title="Municípios Cobertos"
          value={stats.municipiosComEquipamento}
          icon={MapPin}
          description={`de 184 municípios`}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Com Patrulha M.P."
          value={stats.equipamentosComPatrulha}
          icon={CheckCircle2}
          description="Equipamentos com patrulha"
        />
        <StatCard
          title="Viatura s/ Equipamento"
          value={stats.municipiosComViaturaSemEquipamento}
          icon={Truck}
          description="Municípios"
        />
        <StatCard
          title="Sem Cobertura"
          value={stats.municipiosSemEquipamento}
          icon={AlertCircle}
          description="Municípios"
        />
        <StatCard
          title="Inauguradas"
          value={stats.solicitacoesPorStatus['Inaugurada'] || 0}
          icon={Users}
          description="Solicitações concluídas"
        />
      </div>

      {/* Charts - with ref for export */}
      <div ref={chartsRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Equipamentos por Tipo */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow">
          <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            Equipamentos por Tipo
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={equipamentoChartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(280, 65%, 55%)" />
                    <stop offset="100%" stopColor="hsl(250, 65%, 60%)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }} 
                  width={85} 
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
                <Bar 
                  dataKey="value" 
                  fill="url(#barGradient)" 
                  radius={[0, 8, 8, 0]} 
                  name="Quantidade"
                  animationDuration={800}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Solicitações por Status */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow">
          <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent" />
            Solicitações por Status
          </h3>
          <div className="h-72">
            {solicitacoesChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {COLORS.map((color, index) => (
                      <linearGradient key={index} id={`pieGradient${index}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={1} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={solicitacoesChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${value}`}
                    labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                    animationDuration={800}
                  >
                    {solicitacoesChartData.map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`url(#pieGradient${index % COLORS.length})`}
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Nenhuma solicitação cadastrada
              </div>
            )}
          </div>
        </div>

        {/* Viaturas por Órgão */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow">
          <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success" />
            Viaturas por Órgão
          </h3>
          <div className="h-72">
            {viaturasChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    <linearGradient id="viatGradient0" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="hsl(280, 65%, 60%)" />
                      <stop offset="100%" stopColor="hsl(280, 65%, 45%)" />
                    </linearGradient>
                    <linearGradient id="viatGradient1" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="hsl(160, 60%, 50%)" />
                      <stop offset="100%" stopColor="hsl(160, 60%, 35%)" />
                    </linearGradient>
                  </defs>
                  <Pie
                    data={viaturasChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, value, percent }) => `${value} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                    animationDuration={800}
                  >
                    {viaturasChartData.map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`url(#viatGradient${index})`}
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Nenhuma viatura cadastrada
              </div>
            )}
          </div>
        </div>

        {/* Cobertura do Estado */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow">
          <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-info" />
            Cobertura do Estado
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
              <span className="text-sm font-medium">Com Equipamento</span>
              <span className="text-2xl font-display font-bold text-primary">
                {stats.municipiosComEquipamento}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-info/10 to-info/5 rounded-lg border border-info/20">
              <span className="text-sm font-medium">Com Viatura (sem equipamento)</span>
              <span className="text-2xl font-display font-bold text-info">
                {stats.municipiosComViaturaSemEquipamento}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-muted/50 to-muted/30 rounded-lg border border-border">
              <span className="text-sm font-medium">Sem Cobertura</span>
              <span className="text-2xl font-display font-bold text-muted-foreground">
                {stats.municipiosSemEquipamento}
              </span>
            </div>
            <div className="relative w-full h-4 bg-muted rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-accent to-primary rounded-full transition-all duration-700"
                style={{
                  width: `${(stats.municipiosComEquipamento / 184) * 100}%`,
                }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.1)_50%,transparent_100%)] animate-pulse" />
            </div>
            <p className="text-sm text-muted-foreground text-center font-medium">
              <span className="text-primary text-lg">{((stats.municipiosComEquipamento / 184) * 100).toFixed(1)}%</span> do estado com equipamento
            </p>
          </div>
        </div>

        {/* Evolução Temporal */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow lg:col-span-2">
          <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-warning" />
            Evolução Temporal (Acumulado)
          </h3>
          <div className="h-72">
            {evolutionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionData} margin={{ top: 5, right: 30, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="lineGradient1" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(280, 65%, 55%)" />
                      <stop offset="100%" stopColor="hsl(250, 65%, 60%)" />
                    </linearGradient>
                    <linearGradient id="lineGradient2" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(330, 75%, 60%)" />
                      <stop offset="100%" stopColor="hsl(280, 65%, 60%)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="top" 
                    height={36}
                    formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
                  />
                  <Line
                    type="monotone"
                    dataKey="equipamentos"
                    name="Equipamentos"
                    stroke="url(#lineGradient1)"
                    strokeWidth={3}
                    dot={{ fill: 'hsl(280, 65%, 55%)', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: 'hsl(280, 65%, 55%)', stroke: 'white', strokeWidth: 2 }}
                    animationDuration={1000}
                  />
                  <Line
                    type="monotone"
                    dataKey="solicitacoes"
                    name="Solicitações"
                    stroke="url(#lineGradient2)"
                    strokeWidth={3}
                    dot={{ fill: 'hsl(330, 75%, 60%)', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: 'hsl(330, 75%, 60%)', stroke: 'white', strokeWidth: 2 }}
                    animationDuration={1000}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Nenhum dado para exibir evolução temporal
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}