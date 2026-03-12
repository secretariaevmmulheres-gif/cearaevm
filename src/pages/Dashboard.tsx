import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { MotionStatCard } from '@/components/dashboard/MotionStatCard';
import { ChartCard } from '@/components/dashboard/ChartCard';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useEquipamentos } from '@/hooks/useEquipamentos';
import { useViaturas } from '@/hooks/useViaturas';
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import { useAtividades } from '@/hooks/useAtividades';
import { useEvolucaoTemporal } from '@/hooks/useEvolucaoTemporal';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
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
  CalendarDays,
  TrendingUp,
  PackageCheck,
  BarChart2,
  ChevronDown,
  Filter,
  List,
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
  AreaChart,
  Area,
  ComposedChart,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportAllToPDF, exportAllToExcel, exportDashboardWithChartsToPDF, exportCpdiToPDF } from '@/lib/exportUtils';
import { municipiosCeara, abreviarTipo } from '@/data/municipios';
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
  const { atividades } = useAtividades();

  // ── Filtro de ano para gráficos de evolução temporal ──────────────────────
  const anoAtual = new Date().getFullYear();
  const [anoFiltro, setAnoFiltro] = useState<string>('todos');
  const { data: evolucao, isLoading: evolucaoLoading } = useEvolucaoTemporal(
    anoFiltro === 'todos' ? undefined : Number(anoFiltro)
  );

  // ── Municípios sem cobertura — lista expandível ───────────────────────────
  const [semCoberturaExpandido, setSemCoberturaExpandido] = useState(false);
  const municipiosSemCoberturaLista = useMemo(() => {
    const comEquip = new Set(equipamentos.map(e => e.municipio));
    return municipiosCeara.filter(m => !comEquip.has(m)).sort();
  }, [equipamentos]);

  const equipamentoChartData = Object.entries(stats.equipamentosPorTipo).map(([name, value]) => ({
    name: abreviarTipo(name),
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

  // Atividades por tipo
  const atividadesPorTipoData = useMemo(() => {
    const map = new Map<string, number>();
    atividades.forEach(a => map.set(a.tipo, (map.get(a.tipo) ?? 0) + 1));
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .filter(d => d.value > 0);
  }, [atividades]);

  // Evolução temporal
  const evolutionData = useMemo(() => {
    const monthlyData = new Map<string, { equipamentos: number; solicitacoes: number; atendimentos: number }>();

    equipamentos.forEach((e) => {
      const month = format(parseISO(e.created_at), 'yyyy-MM');
      const existing = monthlyData.get(month) || { equipamentos: 0, solicitacoes: 0, atendimentos: 0 };
      existing.equipamentos++;
      monthlyData.set(month, existing);
    });

    solicitacoes.forEach((s) => {
      const month = format(parseISO(s.created_at), 'yyyy-MM');
      const existing = monthlyData.get(month) || { equipamentos: 0, solicitacoes: 0, atendimentos: 0 };
      existing.solicitacoes++;
      monthlyData.set(month, existing);
    });

    // Atendimentos mensais por data da atividade (não acumulado — mostra fluxo mensal)
    atividades.forEach((a) => {
      if (!a.atendimentos) return;
      const month = format(new Date(a.data + 'T00:00:00'), 'yyyy-MM');
      const existing = monthlyData.get(month) || { equipamentos: 0, solicitacoes: 0, atendimentos: 0 };
      existing.atendimentos += a.atendimentos;
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
        atendimentos: data.atendimentos, // mensal (não acumulado — mais útil operacionalmente)
      };
    });
  }, [equipamentos, solicitacoes, atividades]);

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
        name: abreviarTipo(name),
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
    const tipos = ['Casa da Mulher Brasileira', 'Casa da Mulher Cearense', 'Casa da Mulher Municipal', 'Sala Lilás Municipal'];

    return tipos.map((tipo) => {
      const group = solicitacoes.filter((s) => s.tipo_equipamento === tipo);
      const total = group.length;

      if (total === 0) return null;

      const sim = (field: keyof typeof group[0]) => group.filter((s) => s[field] === true).length;
      const nao = (field: keyof typeof group[0]) => total - sim(field);

      return {
        name: tipo.replace('Casa da Mulher ', 'C.M. ').replace('Sala Lilás Municipal', 'S. Lilás'),
        fullName: tipo,
        total,
        // cada item: quantas TÊM o critério
        patrulha_sim: sim('recebeu_patrulha'),
        patrulha_nao: nao('recebeu_patrulha'),
        kit_sim: sim('kit_athena_entregue'),
        kit_nao: nao('kit_athena_entregue'),
        capacitacao_sim: sim('capacitacao_realizada'),
        capacitacao_nao: nao('capacitacao_realizada'),
        suite_sim: sim('nup'),
        suite_nao: nao('nup'),
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


  // Atividades stats
  const totalAtendimentosAtividades = atividades.reduce((s, a) => s + (a.atendimentos ?? 0), 0);
  const atividadesRealizadas = atividades.filter(a => a.status === 'Realizado').length;
  const atividadesPorSede = (['Fortaleza', 'Juazeiro do Norte', 'Sobral', 'Quixadá'] as const).map(sede => ({
    name: sede === 'Juazeiro do Norte' ? 'Juazeiro' : sede,
    total: atividades.filter(a => a.municipio_sede === sede).length,
    realizadas: atividades.filter(a => a.municipio_sede === sede && a.status === 'Realizado').length,
    atendimentos: atividades.filter(a => a.municipio_sede === sede).reduce((s, a) => s + (a.atendimentos ?? 0), 0),
  })).filter(s => s.total > 0);

  // Próximas atividades agendadas (ordenadas por data)
  // Mostra: de 7 dias atrás até o futuro (atividades recentes ainda relevantes + futuras)
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const limitePassado = new Date(hoje); limitePassado.setDate(hoje.getDate() - 7);
  const proximasAtividades = atividades
    .filter(a => a.status === 'Agendado' && new Date(a.data + 'T00:00:00') >= limitePassado)
    .sort((a, b) => new Date(a.data + 'T00:00:00').getTime() - new Date(b.data + 'T00:00:00').getTime())
    .slice(0, 10);

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
            <DropdownMenuItem onClick={() => exportAllToPDF(equipamentos, viaturas, solicitacoes, atividades)}>
              <FileText className="w-4 h-4 mr-2" />
              PDF (Tabelas)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportAllToExcel(equipamentos, viaturas, solicitacoes, atividades)}>
              <FileText className="w-4 h-4 mr-2" />
              Excel
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => exportCpdiToPDF({ equipamentos, solicitacoes, viaturas }).catch(() => toast.error("Erro ao gerar relatório"))}>
              <FileText className="w-4 h-4 mr-2 text-primary" />
              <span className="text-primary font-medium">Relatório EVM</span>
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

      {/* DDM + Sala em Delegacia sub-stats */}
      {((stats.equipamentosPorTipo['DDM'] ?? 0) > 0 || (stats.equipamentosPorTipo['Sala Lilás em Delegacia'] ?? 0) > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
            className="bg-card rounded-2xl border border-green-700/20 shadow-sm p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-700/10 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-green-800" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-green-800">{stats.equipamentosPorTipo['DDM'] ?? 0}</p>
              <p className="text-sm font-medium text-foreground">Delegacias de Defesa da Mulher</p>
              <p className="text-xs text-muted-foreground">DDM — Polícia Civil do Ceará</p>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="bg-card rounded-2xl border border-green-400/20 shadow-sm p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-400/10 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-green-600">{stats.equipamentosPorTipo['Sala Lilás em Delegacia'] ?? 0}</p>
              <p className="text-sm font-medium text-foreground">Salas em Delegacia</p>
              <p className="text-xs text-muted-foreground">Polícia Civil — em funcionamento</p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Atividades Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <MotionStatCard title="Total de Atividades" value={atividades.length} icon={CalendarDays} variant="primary" description="Unidades móveis, eventos e mais" index={9} />
        <MotionStatCard title="Realizadas" value={atividadesRealizadas} icon={CheckCircle2} variant="success" description="Atividades concluídas" index={10} />
        <MotionStatCard title="Pessoas Atendidas" value={totalAtendimentosAtividades} icon={Users} variant="accent" description="Total de atendimentos" index={11} />
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
              <div className="flex items-center gap-2">
                <span className="text-2xl font-display font-bold text-muted-foreground">{stats.municipiosSemEquipamento}</span>
                <button
                  onClick={() => setSemCoberturaExpandido(v => !v)}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title={semCoberturaExpandido ? 'Recolher lista' : 'Ver lista'}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lista expansível de municípios sem cobertura */}
            {semCoberturaExpandido && municipiosSemCoberturaLista.length > 0 && (
              <div className="mt-3 rounded-xl border border-border bg-muted/20 max-h-48 overflow-y-auto">
                <div className="sticky top-0 bg-muted/60 backdrop-blur-sm px-3 py-2 border-b border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {municipiosSemCoberturaLista.length} municípios sem equipamento
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-2 p-2">
                  {municipiosSemCoberturaLista.map(m => (
                    <div key={m} className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-accent/50 transition-colors">
                      <MapPin className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                      <span className="text-xs truncate">{m}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
        <ChartCard title="Evolução Temporal · Atendimentos Mensais" dotColor="bg-warning" delay={11} colSpan={2}>
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
                  <Line type="monotone" dataKey="atendimentos" name="Atendimentos/mês" stroke="hsl(270, 60%, 55%)" strokeWidth={3}
                    strokeDasharray="6 3"
                    dot={{ fill: 'hsl(270, 60%, 55%)', strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 7, fill: 'hsl(270, 60%, 55%)', stroke: 'white', strokeWidth: 3 }}
                    animationDuration={1200} animationEasing="ease-out"
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


        {/* ── Atividades por Sede ── */}
        <ChartCard title="Atividades e Atendimentos por Sede" dotColor="bg-violet-500" delay={12} colSpan={2}>
          <div className="h-72">
            {atividadesPorSede.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={atividadesPorSede} margin={{ top: 10, right: 50, bottom: 10, left: 0 }} barGap={4}>
                  <defs>
                    <linearGradient id="sedeGrad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(215, 70%, 55%)" />
                      <stop offset="100%" stopColor="hsl(215, 70%, 40%)" />
                    </linearGradient>
                    <linearGradient id="sedeGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(160, 55%, 50%)" />
                      <stop offset="100%" stopColor="hsl(160, 55%, 35%)" />
                    </linearGradient>
                    <linearGradient id="sedeGrad3" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(270, 60%, 60%)" />
                      <stop offset="100%" stopColor="hsl(270, 60%, 45%)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--foreground))', fontWeight: 500 }} axisLine={false} tickLine={false} />
                  {/* Eixo esquerdo: atividades */}
                  <YAxis yAxisId="ativ" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} dx={-5} />
                  {/* Eixo direito: atendimentos (escala separada) */}
                  <YAxis yAxisId="atend" orientation="right" tick={{ fontSize: 11, fill: 'hsl(270, 60%, 55%)' }} axisLine={false} tickLine={false} allowDecimals={false} dx={5} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-card border border-border rounded-xl shadow-lg p-3 text-sm">
                          <p className="font-semibold mb-2">{label}</p>
                          {payload.map((p: any) => (
                            <div key={p.name} className="flex items-center gap-2 mb-1">
                              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
                              <span className="text-muted-foreground">{p.name}:</span>
                              <span className="font-medium">{p.value?.toLocaleString('pt-BR')}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                    cursor={{ fill: 'hsl(var(--muted) / 0.3)', radius: 6 }}
                  />
                  <Legend verticalAlign="top" height={36} formatter={(v) => <span className="text-xs font-medium text-foreground">{v}</span>} />
                  <Bar yAxisId="ativ" dataKey="total" name="Total atividades" fill="url(#sedeGrad1)" radius={[6, 6, 0, 0]} animationDuration={1000} />
                  <Bar yAxisId="ativ" dataKey="realizadas" name="Realizadas" fill="url(#sedeGrad2)" radius={[6, 6, 0, 0]} animationDuration={1000} />
                  <Bar yAxisId="atend" dataKey="atendimentos" name="Pessoas atendidas" fill="url(#sedeGrad3)" radius={[6, 6, 0, 0]} animationDuration={1000} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <CalendarDays className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Nenhuma atividade cadastrada</p>
                </div>
              </div>
            )}
          </div>
        </ChartCard>

        {/* ── Atividades por Tipo ── */}
        {atividadesPorTipoData.length > 0 && (
          <ChartCard title="Atividades por Tipo" dotColor="bg-teal-500" delay={13} colSpan={2}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={atividadesPorTipoData} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [`${v} atividade${v !== 1 ? 's' : ''}`, 'Total']}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={28}>
                    {atividadesPorTipoData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        )}

        {/* ── Próximas Atividades Agendadas ── */}
        {proximasAtividades.length > 0 && (
          <ChartCard title="Próximas Atividades Agendadas" dotColor="bg-blue-500" delay={13} colSpan={2}>
            <div className="divide-y divide-border/50">
              {proximasAtividades.map((a, i) => {
                const dataAtiv = new Date(a.data + 'T00:00:00');
                const diffDias = Math.round((dataAtiv.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                const urgente = diffDias <= 7;
                const passado = diffDias < 0;
                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    {/* Data */}
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 font-display font-bold',
                      passado ? 'bg-rose-500/10 text-rose-600' :
                      urgente ? 'bg-amber-500/10 text-amber-600' :
                      'bg-blue-500/10 text-blue-600'
                    )}>
                      <span className="text-xs leading-none">{format(dataAtiv, 'MMM', { locale: ptBR }).toUpperCase()}</span>
                      <span className="text-lg leading-none">{format(dataAtiv, 'dd')}</span>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{a.municipio}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.tipo} · {a.recurso} · {a.municipio_sede}</p>
                    </div>
                    {/* Badge dias */}
                    <div className={cn(
                      'shrink-0 text-xs font-medium px-2.5 py-1 rounded-full',
                      passado ? 'bg-rose-500/10 text-rose-600' :
                      urgente ? 'bg-amber-500/10 text-amber-600' :
                      'bg-blue-500/10 text-blue-600'
                    )}>
                      {passado
                        ? `${Math.abs(diffDias)}d atrás`
                        : diffDias === 0 ? 'Hoje'
                        : diffDias === 1 ? 'Amanhã'
                        : `em ${diffDias}d`}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </ChartCard>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SEÇÃO: EVOLUÇÃO TEMPORAL — dados do historico_alteracoes
            ════════════════════════════════════════════════════════════════ */}

        {/* ── Divisor com título ── */}
        <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Evolução Temporal</h2>
                <p className="text-xs text-muted-foreground">
                  {anoFiltro === 'todos' ? 'Todo o período registrado' : `Ano ${anoFiltro}`}
                </p>
              </div>
            </div>
            {/* Seletor de ano */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <Select value={anoFiltro} onValueChange={setAnoFiltro}>
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {[anoAtual - 2, anoAtual - 1, anoAtual].map(ano => (
                    <SelectItem key={ano} value={String(ano)}>{ano}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ── Gráfico 1: Inaugurações por mês (barras) ── */}
        <ChartCard title="Inaugurações por Mês" dotColor="bg-blue-500" delay={20} colSpan={2}>
          <div className="h-64">
            {evolucaoLoading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground/50">
                <div className="text-center space-y-2">
                  <BarChart2 className="w-8 h-8 mx-auto animate-pulse" />
                  <p className="text-sm">Carregando...</p>
                </div>
              </div>
            ) : evolucao.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={evolucao} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} barSize={18}>
                  <defs>
                    <linearGradient id="inaugGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(215, 70%, 55%)" />
                      <stop offset="100%" stopColor="hsl(215, 70%, 40%)" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} dy={8} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} dx={-4} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-card border border-border rounded-xl shadow-lg px-4 py-3 text-sm">
                          <p className="font-semibold mb-1">{label}</p>
                          <p className="text-blue-500 font-bold">{payload[0].value} inauguraç{Number(payload[0].value) === 1 ? 'ão' : 'ões'}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="inauguracoes" name="Inaugurações" fill="url(#inaugGrad)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground/40 text-sm">
                Sem dados de inauguração no histórico
              </div>
            )}
          </div>
          {/* Mini-resumo */}
          {!evolucaoLoading && evolucao.length > 0 && (() => {
            const total = evolucao.reduce((s, p) => s + p.inauguracoes, 0);
            const ultimo = [...evolucao].reverse().find(p => p.inauguracoes > 0);
            return (
              <div className="mt-3 flex items-center gap-4 pt-3 border-t border-border">
                <div className="text-center flex-1">
                  <p className="text-xl font-bold text-blue-500">{total}</p>
                  <p className="text-xs text-muted-foreground">total registrado</p>
                </div>
                {ultimo && (
                  <div className="text-center flex-1">
                    <p className="text-xl font-bold">{ultimo.inauguracoes}</p>
                    <p className="text-xs text-muted-foreground">em {ultimo.month}</p>
                  </div>
                )}
                <div className="text-center flex-1">
                  <p className="text-xl font-bold">{evolucao.filter(p => p.inauguracoes > 0).length}</p>
                  <p className="text-xs text-muted-foreground">meses com atividade</p>
                </div>
              </div>
            );
          })()}
        </ChartCard>

        {/* ── Gráfico 2: Cobertura Kit Athena acumulada ── */}
        <ChartCard title="Cobertura Kit Athena (acumulado)" dotColor="bg-emerald-500" delay={21} colSpan={2}>
          <div className="h-64">
            {evolucaoLoading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground/50">
                <div className="text-center space-y-2">
                  <PackageCheck className="w-8 h-8 mx-auto animate-pulse" />
                  <p className="text-sm">Carregando...</p>
                </div>
              </div>
            ) : evolucao.some(p => p.kitAthena > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolucao} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="kitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(160, 55%, 50%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(160, 55%, 50%)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} dy={8} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} dx={-4} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const pt = payload[0].payload;
                      return (
                        <div className="bg-card border border-border rounded-xl shadow-lg px-4 py-3 text-sm">
                          <p className="font-semibold mb-1">{label}</p>
                          <p className="text-emerald-500 font-bold">{pt.kitAthena} kits acumulados</p>
                          {pt.kitAthenaMes > 0 && (
                            <p className="text-muted-foreground text-xs mt-1">+{pt.kitAthenaMes} neste mês</p>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="kitAthena"
                    name="Kit Athena"
                    stroke="hsl(160, 55%, 45%)"
                    strokeWidth={3}
                    fill="url(#kitGrad)"
                    dot={false}
                    activeDot={{ r: 6, fill: 'hsl(160, 55%, 45%)', stroke: 'white', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground/40 text-sm">
                Nenhuma entrega de Kit Athena registrada no histórico
              </div>
            )}
          </div>
          {!evolucaoLoading && evolucao.length > 0 && (() => {
            const totalKit = evolucao[evolucao.length - 1]?.kitAthena ?? 0;
            const mesesComKit = evolucao.filter(p => p.kitAthenaMes > 0).length;
            const pico = evolucao.reduce((mx, p) => p.kitAthenaMes > mx.kitAthenaMes ? p : mx, evolucao[0]);
            return (
              <div className="mt-3 flex items-center gap-4 pt-3 border-t border-border">
                <div className="text-center flex-1">
                  <p className="text-xl font-bold text-emerald-500">{totalKit}</p>
                  <p className="text-xs text-muted-foreground">kits entregues</p>
                </div>
                <div className="text-center flex-1">
                  <p className="text-xl font-bold">{mesesComKit}</p>
                  <p className="text-xs text-muted-foreground">meses com entrega</p>
                </div>
                {pico?.kitAthenaMes > 0 && (
                  <div className="text-center flex-1">
                    <p className="text-xl font-bold">{pico.kitAthenaMes}</p>
                    <p className="text-xs text-muted-foreground">pico em {pico.month}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </ChartCard>

        {/* ── Gráfico 3: Solicitações abertas vs. resolvidas (barras empilhadas) ── */}
        <ChartCard title="Solicitações por Mês" dotColor="bg-violet-500" delay={22} colSpan={2}>
          <div className="h-64">
            {evolucaoLoading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground/50">
                <div className="text-center space-y-2">
                  <BarChart2 className="w-8 h-8 mx-auto animate-pulse" />
                  <p className="text-sm">Carregando...</p>
                </div>
              </div>
            ) : evolucao.some(p => p.solicAbertasMes > 0 || p.solicResolvMes > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={evolucao} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} barSize={14}>
                  <defs>
                    <linearGradient id="solicAbertaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(270, 60%, 60%)" />
                      <stop offset="100%" stopColor="hsl(270, 60%, 45%)" stopOpacity={0.8} />
                    </linearGradient>
                    <linearGradient id="solicResolvGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(142, 55%, 50%)" />
                      <stop offset="100%" stopColor="hsl(142, 55%, 35%)" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} dy={8} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} dx={-4} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const pt = payload[0]?.payload;
                      return (
                        <div className="bg-card border border-border rounded-xl shadow-lg px-4 py-3 text-sm min-w-[160px]">
                          <p className="font-semibold mb-2">{label}</p>
                          <div className="space-y-1">
                            <div className="flex justify-between gap-6">
                              <span className="text-violet-500">Abertas</span>
                              <span className="font-bold">{pt?.solicAbertasMes ?? 0}</span>
                            </div>
                            <div className="flex justify-between gap-6">
                              <span className="text-emerald-500">Inauguradas</span>
                              <span className="font-bold">{pt?.solicResolvMes ?? 0}</span>
                            </div>
                            {pt?.solicAbertas !== undefined && (
                              <div className="flex justify-between gap-6 pt-1 border-t border-border mt-1">
                                <span className="text-muted-foreground text-xs">Backlog</span>
                                <span className="font-bold text-xs">{pt.solicAbertas}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    verticalAlign="top" height={32}
                    formatter={(value) => <span className="text-xs font-medium text-foreground">{value}</span>}
                  />
                  <Bar dataKey="solicAbertasMes" name="Abertas" fill="url(#solicAbertaGrad)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="solicResolvMes"  name="Inauguradas" fill="url(#solicResolvGrad)" radius={[3, 3, 0, 0]} />
                  {/* Linha de backlog acumulado */}
                  <Line
                    type="monotone"
                    dataKey="solicAbertas"
                    name="Backlog"
                    stroke="hsl(30, 80%, 55%)"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={false}
                    activeDot={{ r: 5, fill: 'hsl(30, 80%, 55%)', stroke: 'white', strokeWidth: 2 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground/40 text-sm">
                Sem dados de solicitações no histórico
              </div>
            )}
          </div>
          {!evolucaoLoading && evolucao.length > 0 && (() => {
            const totalAbertas = evolucao.reduce((s, p) => s + p.solicAbertasMes, 0);
            const totalResolv  = evolucao.reduce((s, p) => s + p.solicResolvMes, 0);
            const backlog      = evolucao[evolucao.length - 1]?.solicAbertas ?? 0;
            const taxaResolv   = totalAbertas > 0 ? Math.round((totalResolv / totalAbertas) * 100) : 0;
            return (
              <div className="mt-3 flex items-center gap-3 pt-3 border-t border-border">
                <div className="text-center flex-1">
                  <p className="text-xl font-bold text-violet-500">{totalAbertas}</p>
                  <p className="text-xs text-muted-foreground">solicitações</p>
                </div>
                <div className="text-center flex-1">
                  <p className="text-xl font-bold text-emerald-500">{totalResolv}</p>
                  <p className="text-xs text-muted-foreground">inauguradas</p>
                </div>
                <div className="text-center flex-1">
                  <p className="text-xl font-bold text-amber-500">{taxaResolv}%</p>
                  <p className="text-xs text-muted-foreground">taxa resolução</p>
                </div>
                <div className="text-center flex-1">
                  <p className="text-xl font-bold">{backlog}</p>
                  <p className="text-xs text-muted-foreground">backlog atual</p>
                </div>
              </div>
            );
          })()}
        </ChartCard>

      </div>
    </AppLayout>
  );
}