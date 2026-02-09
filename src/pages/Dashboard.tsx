import { useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { MotionStatCard } from '@/components/dashboard/MotionStatCard';
import { ChartCard } from '@/components/dashboard/ChartCard';
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
    .filter(([_, value]) => (value as number) > 0)
    .map(([name, value]) => ({ name, value: value as number }));

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
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Exportar Tudo
              </Button>
            </motion.div>
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
        <MotionStatCard
          title="Total de Equipamentos"
          value={stats.totalEquipamentos}
          icon={Building2}
          variant="primary"
          description="Unidades cadastradas"
          index={0}
        />
        <MotionStatCard
          title="Viaturas PMCE"
          value={stats.viaturasPMCE}
          icon={Truck}
          variant="accent"
          description="Batalhão PMCE"
          index={1}
        />
        <MotionStatCard
          title="Patrulhas das Casas"
          value={stats.viaturasPatrulhasCasas}
          icon={Truck}
          variant="success"
          description="Vinculadas a equipamentos"
          index={2}
        />
        <MotionStatCard
          title="Solicitações"
          value={stats.totalSolicitacoes}
          icon={FileText}
          variant="warning"
          description="Em acompanhamento"
          index={3}
        />
        <MotionStatCard
          title="Municípios Cobertos"
          value={stats.municipiosComEquipamento}
          icon={MapPin}
          description="de 184 municípios"
          index={4}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MotionStatCard
          title="Com Patrulha M.P."
          value={stats.equipamentosComPatrulha}
          icon={CheckCircle2}
          description="Equipamentos com patrulha"
          index={5}
        />
        <MotionStatCard
          title="Viatura s/ Equipamento"
          value={stats.municipiosComViaturaSemEquipamento}
          icon={Truck}
          description="Municípios"
          index={6}
        />
        <MotionStatCard
          title="Sem Cobertura"
          value={stats.municipiosSemEquipamento}
          icon={AlertCircle}
          description="Municípios"
          index={7}
        />
        <MotionStatCard
          title="Inauguradas"
          value={stats.solicitacoesPorStatus['Inaugurada'] || 0}
          icon={Users}
          description="Solicitações concluídas"
          index={8}
        />
      </div>

      {/* Charts - with ref for export */}
      <div ref={chartsRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Equipamentos por Tipo" dotColor="bg-primary" delay={4}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={equipamentoChartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(320, 60%, 50%)" />
                    <stop offset="100%" stopColor="hsl(280, 65%, 55%)" />
                  </linearGradient>
                  <filter id="barShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="hsl(320, 60%, 50%)" floodOpacity="0.3"/>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={true} vertical={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  tick={{ fontSize: 11, fill: 'hsl(var(--foreground))', fontWeight: 500 }} 
                  width={85} 
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--primary) / 0.05)', radius: 8 }} />
                <Bar 
                  dataKey="value" 
                  fill="url(#barGradient)" 
                  radius={[0, 10, 10, 0]} 
                  name="Quantidade"
                  animationDuration={1000}
                  animationEasing="ease-out"
                  filter="url(#barShadow)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Solicitações por Status" dotColor="bg-accent" delay={5}>
          <div className="h-72">
            {solicitacoesChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {COLORS.map((color, index) => (
                      <linearGradient key={index} id={`pieGradient${index}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={1} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.75} />
                      </linearGradient>
                    ))}
                    <filter id="pieShadow">
                      <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.15"/>
                    </filter>
                  </defs>
                  <Pie
                    data={solicitacoesChartData}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ value }) => value}
                    labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }}
                    animationDuration={1000}
                    animationEasing="ease-out"
                  >
                    {solicitacoesChartData.map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`url(#pieGradient${index % COLORS.length})`}
                        stroke="hsl(var(--background))"
                        strokeWidth={3}
                        filter="url(#pieShadow)"
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={40}
                    formatter={(value) => <span className="text-xs font-medium text-foreground">{value}</span>}
                    wrapperStyle={{ paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Nenhuma solicitação cadastrada</p>
                </div>
              </div>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Viaturas por Órgão" dotColor="bg-success" delay={6}>
          <div className="h-72">
            {viaturasChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    <linearGradient id="viatGradient0" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="hsl(215, 70%, 50%)" />
                      <stop offset="100%" stopColor="hsl(215, 70%, 35%)" />
                    </linearGradient>
                    <linearGradient id="viatGradient1" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="hsl(160, 60%, 45%)" />
                      <stop offset="100%" stopColor="hsl(160, 60%, 30%)" />
                    </linearGradient>
                    <filter id="viatShadow">
                      <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.15"/>
                    </filter>
                  </defs>
                  <Pie
                    data={viaturasChartData}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ value, percent }) => `${value} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }}
                    animationDuration={1000}
                    animationEasing="ease-out"
                  >
                    {viaturasChartData.map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`url(#viatGradient${index})`}
                        stroke="hsl(var(--background))"
                        strokeWidth={3}
                        filter="url(#viatShadow)"
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={40}
                    formatter={(value) => <span className="text-xs font-medium text-foreground">{value}</span>}
                    wrapperStyle={{ paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Truck className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Nenhuma viatura cadastrada</p>
                </div>
              </div>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Cobertura do Estado" dotColor="bg-info" delay={7}>
          <div className="space-y-3">
            <div className="group flex items-center justify-between p-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-xl border border-primary/20 transition-all duration-300 hover:border-primary/40 hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <span className="text-sm font-medium">Com Equipamento</span>
              </div>
              <span className="text-2xl font-display font-bold text-primary">
                {stats.municipiosComEquipamento}
              </span>
            </div>
            <div className="group flex items-center justify-between p-4 bg-gradient-to-r from-info/10 via-info/5 to-transparent rounded-xl border border-info/20 transition-all duration-300 hover:border-info/40 hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-info/15 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-info" />
                </div>
                <span className="text-sm font-medium">Com Viatura (sem equipamento)</span>
              </div>
              <span className="text-2xl font-display font-bold text-info">
                {stats.municipiosComViaturaSemEquipamento}
              </span>
            </div>
            <div className="group flex items-center justify-between p-4 bg-gradient-to-r from-muted/40 via-muted/20 to-transparent rounded-xl border border-border transition-all duration-300 hover:border-muted-foreground/30 hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium">Sem Cobertura</span>
              </div>
              <span className="text-2xl font-display font-bold text-muted-foreground">
                {stats.municipiosSemEquipamento}
              </span>
            </div>
            <div className="relative mt-4">
              <div className="relative w-full h-5 bg-muted/50 rounded-full overflow-hidden shadow-inner">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-accent to-primary rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${(stats.municipiosComEquipamento / 184) * 100}%` }}
                />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.15)_50%,transparent_100%)] animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
              </div>
              <p className="text-sm text-muted-foreground text-center font-medium mt-3">
                <span className="text-xl font-bold text-primary">{((stats.municipiosComEquipamento / 184) * 100).toFixed(1)}%</span>
                <span className="ml-2">do estado com equipamento</span>
              </p>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Evolução Temporal (Acumulado)" dotColor="bg-warning" delay={8} colSpan={2}>
          <div className="h-80">
            {evolutionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionData} margin={{ top: 20, right: 30, bottom: 10, left: 0 }}>
                  <defs>
                    <linearGradient id="lineGradient1" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(215, 70%, 50%)" />
                      <stop offset="100%" stopColor="hsl(280, 65%, 55%)" />
                    </linearGradient>
                    <linearGradient id="lineGradient2" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(320, 60%, 50%)" />
                      <stop offset="100%" stopColor="hsl(280, 65%, 55%)" />
                    </linearGradient>
                    <filter id="lineShadow1">
                      <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="hsl(215, 70%, 50%)" floodOpacity="0.4"/>
                    </filter>
                    <filter id="lineShadow2">
                      <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="hsl(320, 60%, 50%)" floodOpacity="0.4"/>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }} 
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
                    axisLine={false}
                    tickLine={false}
                    dx={-10}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="top" 
                    height={40}
                    formatter={(value) => <span className="text-sm font-medium text-foreground">{value}</span>}
                    wrapperStyle={{ paddingBottom: '10px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="equipamentos"
                    name="Equipamentos"
                    stroke="url(#lineGradient1)"
                    strokeWidth={4}
                    dot={{ fill: 'hsl(215, 70%, 50%)', strokeWidth: 0, r: 5 }}
                    activeDot={{ r: 8, fill: 'hsl(215, 70%, 50%)', stroke: 'white', strokeWidth: 3 }}
                    animationDuration={1200}
                    animationEasing="ease-out"
                    filter="url(#lineShadow1)"
                  />
                  <Line
                    type="monotone"
                    dataKey="solicitacoes"
                    name="Solicitações"
                    stroke="url(#lineGradient2)"
                    strokeWidth={4}
                    dot={{ fill: 'hsl(320, 60%, 50%)', strokeWidth: 0, r: 5 }}
                    activeDot={{ r: 8, fill: 'hsl(320, 60%, 50%)', stroke: 'white', strokeWidth: 3 }}
                    animationDuration={1200}
                    animationEasing="ease-out"
                    filter="url(#lineShadow2)"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Clock className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Nenhum dado para exibir evolução temporal</p>
                </div>
              </div>
            )}
          </div>
        </ChartCard>
      </div>
    </AppLayout>
  );
}