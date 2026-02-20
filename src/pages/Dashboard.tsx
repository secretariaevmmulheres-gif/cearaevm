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
  ShieldCheck,
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
  'hsl(280, 65%, 60%)',
  'hsl(250, 65%, 60%)',
  'hsl(200, 85%, 55%)',
  'hsl(330, 75%, 60%)',
  'hsl(240, 65%, 60%)',
  'hsl(270, 65%, 55%)',
];

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

// Tooltip customizado para o checklist com percentuais
const ChecklistTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
    return (
      <div className="bg-card/95 backdrop-blur-sm border border-border rounded-xl px-4 py-3 shadow-xl min-w-[200px]">
        <p className="font-semibold text-sm text-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4 text-sm mb-1">
            <span style={{ color: entry.color }}>{entry.name}</span>
            <span className="font-bold text-foreground">
              {entry.value} <span className="text-muted-foreground font-normal">({total > 0 ? ((entry.value / total) * 100).toFixed(0) : 0}%)</span>
            </span>
          </div>
        ))}
        <div className="border-t border-border mt-2 pt-2 flex justify-between text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="font-bold">{total}</span>
        </div>
      </div>
    );
  }
  return null;
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

  // Solicitações por status — exclui inauguradas
  const solicitacoesChartData = Object.entries(stats.solicitacoesPorStatus)
    .filter(([name, value]) => (value as number) > 0 && name !== 'Inaugurada')
    .map(([name, value]) => ({ name, value: value as number }));

  const viaturasChartData = [
    { name: 'PMCE', value: stats.viaturasPMCE },
    { name: 'Patrulhas das Casas', value: stats.viaturasPatrulhasCasas },
  ].filter(item => item.value > 0);

  // Evolução temporal
  const evolutionData = useMemo(() => {
    const monthlyData = new Map<string, { equipamentos: number; solicitacoes: number }>();

    equipamentos.forEach((e) => {
      const month = format(parseISO(e.created_at), 'yyyy-MM');
      const existing = monthlyData.get(month) || { equipamentos: 0, solicitacoes: 0 };
      existing.equipamentos++;
      monthlyData.set(month, existing);
    });

    solicitacoes.forEach((s) => {
      const month = format(parseISO(s.created_at), 'yyyy-MM');
      const existing = monthlyData.get(month) || { equipamentos: 0, solicitacoes: 0 };
      existing.solicitacoes++;
      monthlyData.set(month, existing);
    });

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

  // Solicitações por tipo_equipamento — exclui inauguradas
  const solicitacoesPorTipo = useMemo(() => {
    const map = new Map<string, number>();

    solicitacoes
      .filter((s) => s.status !== 'Inaugurada')
      .forEach((s) => {
        const tipo = s.tipo_equipamento || 'Não informado';
        map.set(tipo, (map.get(tipo) || 0) + 1);
      });

    return Array.from(map.entries())
      .map(([name, value]) => ({
        name: name.replace('Casa da Mulher ', 'C.M. ').replace('Sala Lilás', 'S. Lilás'),
        fullName: name,
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [solicitacoes]);

  // Patrulha das Casas
  const patrulhaData = useMemo(() => {
    const municipiosComEquipamentoEPatrulha = new Set(
      equipamentos.filter((e) => e.possui_patrulha).map((e) => e.municipio)
    );

    const municipiosEmSolicitacaoComPatrulha = new Set(
      solicitacoes
        .filter((s) => s.recebeu_patrulha && s.status !== 'Inaugurada')
        .map((s) => s.municipio)
        .filter((m) => !municipiosComEquipamentoEPatrulha.has(m))
    );

    return [
      { name: 'Com Equipamento', value: municipiosComEquipamentoEPatrulha.size, color: 'hsl(160, 60%, 45%)', gradient: 'patrulhaGrad0' },
      { name: 'Em Solicitação', value: municipiosEmSolicitacaoComPatrulha.size, color: 'hsl(40, 85%, 55%)', gradient: 'patrulhaGrad1' },
    ].filter(item => item.value > 0);
  }, [equipamentos, solicitacoes]);

  // ✅ NOVO: Progresso do checklist por tipo de equipamento (histórico completo)
  const checklistData = useMemo(() => {
    const tipos = ['Casa da Mulher Brasileira', 'Casa da Mulher Cearense', 'Casa da Mulher Municipal', 'Sala Lilás'];

    return tipos.map((tipo) => {
      const group = solicitacoes.filter((s) => s.tipo_equipamento === tipo);
      const total = group.length;

      if (total === 0) return null;

      const sim = (field: keyof typeof group[0]) => group.filter((s) => s[field] === true).length;
      const nao = (field: keyof typeof group[0]) => total - sim(field);

      return {
        name: tipo.replace('Casa da Mulher ', 'C.M. ').replace('Sala Lilás', 'S. Lilás'),
        fullName: tipo,
        total,
        // cada item: quantas TÊM o critério
        patrulha_sim: sim('recebeu_patrulha'),
        patrulha_nao: nao('recebeu_patrulha'),
        kit_sim: sim('kit_athena_entregue'),
        kit_nao: nao('kit_athena_entregue'),
        capacitacao_sim: sim('capacitacao_realizada'),
        capacitacao_nao: nao('capacitacao_realizada'),
        suite_sim: sim('suite_implantada'),
        suite_nao: nao('suite_implantada'),
        guarda_sim: sim('guarda_municipal_estruturada'),
        guarda_nao: nao('guarda_municipal_estruturada'),
      };
    }).filter(Boolean);
  }, [solicitacoes]);

  // Transforma checklistData em formato por item do checklist (uma barra por critério)
  const checklistBarData = useMemo(() => {
    const criterios = [
      { key: 'patrulha', label: 'Patrulha M.P.' },
      { key: 'kit', label: 'Kit Athena' },
      { key: 'capacitacao', label: 'Capacitação' },
      { key: 'suite', label: 'Suíte Implantada' },
      { key: 'guarda', label: 'Guarda Municipal' },
    ];

    return criterios.map(({ key, label }) => {
      const entry: Record<string, any> = { name: label };
      checklistData.forEach((tipo: any) => {
        entry[`${tipo.name}_sim`] = tipo[`${key}_sim`];
        entry[`${tipo.name}_nao`] = tipo[`${key}_nao`];
        entry[`${tipo.name}_total`] = tipo.total;
      });
      return entry;
    });
  }, [checklistData]);

  // Cores por tipo de equipamento
  const tipoColors: Record<string, string> = {
    'C.M. Brasileira': 'hsl(215, 70%, 55%)',
    'C.M. Cearense':   'hsl(160, 60%, 45%)',
    'C.M. Municipal':  'hsl(40, 85%, 55%)',
    'S. Lilás':        'hsl(280, 65%, 60%)',
  };

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
        <MotionStatCard title="Total de Equipamentos" value={stats.totalEquipamentos} icon={Building2} variant="primary" description="Unidades cadastradas" index={0} />
        <MotionStatCard title="Viaturas PMCE" value={stats.viaturasPMCE} icon={Truck} variant="accent" description="Batalhão PMCE" index={1} />
        <MotionStatCard title="Patrulhas das Casas" value={stats.viaturasPatrulhasCasas} icon={Truck} variant="success" description="Vinculadas a equipamentos" index={2} />
        <MotionStatCard title="Solicitações" value={stats.totalSolicitacoes} icon={FileText} variant="warning" description="Em acompanhamento" index={3} />
        <MotionStatCard title="Municípios Cobertos" value={stats.municipiosComEquipamento} icon={MapPin} description="de 184 municípios" index={4} />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MotionStatCard title="Com Patrulha M.P." value={stats.equipamentosComPatrulha} icon={CheckCircle2} description="Equipamentos com patrulha" index={5} />
        <MotionStatCard title="Viatura s/ Equipamento" value={stats.municipiosComViaturaSemEquipamento} icon={Truck} description="Municípios" index={6} />
        <MotionStatCard title="Sem Cobertura" value={stats.municipiosSemEquipamento} icon={AlertCircle} description="Municípios" index={7} />
        <MotionStatCard title="Inauguradas" value={stats.solicitacoesPorStatus['Inaugurada'] || 0} icon={Users} description="Solicitações concluídas" index={8} />
      </div>

      {/* Charts */}
      <div ref={chartsRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Linha 1: Equipamentos por Tipo | Solicitações por Status ── */}
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
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: 'hsl(var(--foreground))', fontWeight: 500 }} width={85} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--primary) / 0.05)', radius: 8 }} />
                <Bar dataKey="value" fill="url(#barGradient)" radius={[0, 10, 10, 0]} name="Quantidade" animationDuration={1000} animationEasing="ease-out" filter="url(#barShadow)" />
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
                  <Pie data={solicitacoesChartData} cx="50%" cy="45%" innerRadius={50} outerRadius={85} paddingAngle={4} dataKey="value"
                    label={({ value }) => value}
                    labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }}
                    animationDuration={1000} animationEasing="ease-out"
                  >
                    {solicitacoesChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={`url(#pieGradient${index % COLORS.length})`} stroke="hsl(var(--background))" strokeWidth={3} filter="url(#pieShadow)" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={40} formatter={(value) => <span className="text-xs font-medium text-foreground">{value}</span>} wrapperStyle={{ paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Nenhuma solicitação ativa</p>
                </div>
              </div>
            )}
          </div>
        </ChartCard>

        {/* ── Linha 2: Patrulha das Casas | Solicitações por Tipo ── */}
        <ChartCard title="Patrulha das Casas" dotColor="bg-success" delay={6}>
          <div className="h-72">
            {patrulhaData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="80%">
                  <PieChart>
                    <defs>
                      <linearGradient id="patrulhaGrad0" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="hsl(160, 60%, 45%)" />
                        <stop offset="100%" stopColor="hsl(160, 60%, 30%)" />
                      </linearGradient>
                      <linearGradient id="patrulhaGrad1" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="hsl(40, 85%, 55%)" />
                        <stop offset="100%" stopColor="hsl(40, 85%, 40%)" />
                      </linearGradient>
                      <filter id="patrulhaShadow">
                        <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.15"/>
                      </filter>
                    </defs>
                    <Pie data={patrulhaData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={5} dataKey="value"
                      label={({ value, percent }) => `${value} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }}
                      animationDuration={1000} animationEasing="ease-out"
                    >
                      {patrulhaData.map((item, index) => (
                        <Cell key={`cell-${index}`} fill={`url(#${item.gradient})`} stroke="hsl(var(--background))" strokeWidth={3} filter="url(#patrulhaShadow)" />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-6 mt-1">
                  {patrulhaData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: item.color }} />
                      <span className="text-xs font-medium text-foreground">{item.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <ShieldCheck className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Nenhum dado de patrulha</p>
                </div>
              </div>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Solicitações por Tipo de Equipamento" dotColor="bg-accent" delay={7}>
          <div className="h-72">
            {solicitacoesPorTipo.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={solicitacoesPorTipo} margin={{ top: 10, right: 20, bottom: 60, left: 0 }}>
                  <defs>
                    <linearGradient id="barTipoGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(330, 75%, 60%)" />
                      <stop offset="100%" stopColor="hsl(280, 65%, 50%)" />
                    </linearGradient>
                    <filter id="barTipoShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="hsl(330, 75%, 55%)" floodOpacity="0.3" />
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={true} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--foreground))', fontWeight: 500 }} axisLine={false} tickLine={false} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} dx={-5} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--accent) / 0.05)', radius: 8 }} />
                  <Bar dataKey="value" fill="url(#barTipoGradient)" radius={[8, 8, 0, 0]} name="Solicitações" animationDuration={1000} animationEasing="ease-out" filter="url(#barTipoShadow)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Nenhuma solicitação ativa</p>
                </div>
              </div>
            )}
          </div>
        </ChartCard>

        {/* ── Linha 3: Checklist das Solicitações (full width) ── */}
        <ChartCard title="Progresso do Checklist por Tipo de Equipamento" dotColor="bg-warning" delay={8} colSpan={2}>
          <div className="h-96">
            {checklistBarData.length > 0 && checklistData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="88%">
                  <BarChart
                    data={checklistBarData}
                    margin={{ top: 10, right: 30, bottom: 10, left: 0 }}
                    barCategoryGap="25%"
                    barGap={3}
                  >
                    <defs>
                      {(checklistData as any[]).map((tipo: any) => (
                        <linearGradient key={tipo.name} id={`checkGrad_${tipo.name.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={tipoColors[tipo.name]} stopOpacity={1} />
                          <stop offset="100%" stopColor={tipoColors[tipo.name]} stopOpacity={0.7} />
                        </linearGradient>
                      ))}
                      <filter id="checkShadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.2"/>
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: 'hsl(var(--foreground))', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                      dx={-5}
                    />
                    <Tooltip content={<ChecklistTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.3)', radius: 6 }} />

                    {(checklistData as any[]).map((tipo: any) => (
                      <Bar
                        key={tipo.name}
                        dataKey={`${tipo.name}_sim`}
                        name={tipo.fullName}
                        stackId="a"
                        fill={`url(#checkGrad_${tipo.name.replace(/\s/g, '')})`}
                        radius={[0, 0, 0, 0]}
                        animationDuration={1000}
                        animationEasing="ease-out"
                        filter="url(#checkShadow)"
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>

                {/* Legenda manual por tipo */}
                <div className="flex justify-center gap-6 mt-1 flex-wrap">
                  {(checklistData as any[]).map((tipo: any) => (
                    <div key={tipo.name} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: tipoColors[tipo.name] }} />
                      <span className="text-xs font-medium text-foreground">{tipo.fullName}</span>
                      <span className="text-xs text-muted-foreground">({tipo.total} total)</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Nenhuma solicitação cadastrada</p>
                </div>
              </div>
            )}
          </div>
        </ChartCard>

        {/* ── Linha 4: Viaturas por Órgão | Cobertura do Estado ── */}
        <ChartCard title="Viaturas por Órgão" dotColor="bg-success" delay={9}>
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
                  <Pie data={viaturasChartData} cx="50%" cy="45%" innerRadius={50} outerRadius={85} paddingAngle={5} dataKey="value"
                    label={({ value, percent }) => `${value} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }}
                    animationDuration={1000} animationEasing="ease-out"
                  >
                    {viaturasChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={`url(#viatGradient${index})`} stroke="hsl(var(--background))" strokeWidth={3} filter="url(#viatShadow)" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={40} formatter={(value) => <span className="text-xs font-medium text-foreground">{value}</span>} wrapperStyle={{ paddingTop: '10px' }} />
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

        <ChartCard title="Cobertura do Estado" dotColor="bg-info" delay={10}>
          <div className="space-y-3">
            <div className="group flex items-center justify-between p-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-xl border border-primary/20 transition-all duration-300 hover:border-primary/40 hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <span className="text-sm font-medium">Com Equipamento</span>
              </div>
              <span className="text-2xl font-display font-bold text-primary">{stats.municipiosComEquipamento}</span>
            </div>
            <div className="group flex items-center justify-between p-4 bg-gradient-to-r from-info/10 via-info/5 to-transparent rounded-xl border border-info/20 transition-all duration-300 hover:border-info/40 hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-info/15 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-info" />
                </div>
                <span className="text-sm font-medium">Com Viatura (sem equipamento)</span>
              </div>
              <span className="text-2xl font-display font-bold text-info">{stats.municipiosComViaturaSemEquipamento}</span>
            </div>
            <div className="group flex items-center justify-between p-4 bg-gradient-to-r from-muted/40 via-muted/20 to-transparent rounded-xl border border-border transition-all duration-300 hover:border-muted-foreground/30 hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium">Sem Cobertura</span>
              </div>
              <span className="text-2xl font-display font-bold text-muted-foreground">{stats.municipiosSemEquipamento}</span>
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

        {/* ── Linha 5: Evolução Temporal (full width) ── */}
        <ChartCard title="Evolução Temporal (Acumulado)" dotColor="bg-warning" delay={11} colSpan={2}>
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
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} dx={-10} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={40} formatter={(value) => <span className="text-sm font-medium text-foreground">{value}</span>} wrapperStyle={{ paddingBottom: '10px' }} />
                  <Line type="monotone" dataKey="equipamentos" name="Equipamentos" stroke="url(#lineGradient1)" strokeWidth={4}
                    dot={{ fill: 'hsl(215, 70%, 50%)', strokeWidth: 0, r: 5 }}
                    activeDot={{ r: 8, fill: 'hsl(215, 70%, 50%)', stroke: 'white', strokeWidth: 3 }}
                    animationDuration={1200} animationEasing="ease-out" filter="url(#lineShadow1)"
                  />
                  <Line type="monotone" dataKey="solicitacoes" name="Solicitações" stroke="url(#lineGradient2)" strokeWidth={4}
                    dot={{ fill: 'hsl(320, 60%, 50%)', strokeWidth: 0, r: 5 }}
                    activeDot={{ r: 8, fill: 'hsl(320, 60%, 50%)', stroke: 'white', strokeWidth: 3 }}
                    animationDuration={1200} animationEasing="ease-out" filter="url(#lineShadow2)"
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