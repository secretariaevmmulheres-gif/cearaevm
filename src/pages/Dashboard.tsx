import { useMemo } from 'react';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportAllToPDF, exportAllToExcel } from '@/lib/exportUtils';

const COLORS = ['#c026d3', '#7c3aed', '#0ea5e9', '#ec4899', '#6366f1', '#8b5cf6'];

export default function Dashboard() {
  const stats = useDashboardStats();
  const { equipamentos } = useEquipamentos();
  const { viaturas } = useViaturas();
  const { solicitacoes } = useSolicitacoes();

  const equipamentoChartData = Object.entries(stats.equipamentosPorTipo).map(([name, value]) => ({
    name: name.replace('Casa da Mulher ', 'C.M. ').replace('Sala Lilás', 'S. Lilás'),
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
            <DropdownMenuItem onClick={() => exportAllToPDF(equipamentos, viaturas, solicitacoes)}>
              <FileText className="w-4 h-4 mr-2" />
              Exportar PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportAllToExcel(equipamentos, viaturas, solicitacoes)}>
              <FileText className="w-4 h-4 mr-2" />
              Exportar Excel
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Equipamentos por Tipo */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
          <h3 className="font-display font-semibold text-lg mb-4">Equipamentos por Tipo</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={equipamentoChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Solicitações por Status */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
          <h3 className="font-display font-semibold text-lg mb-4">Solicitações por Status</h3>
          <div className="h-64">
            {solicitacoesChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={solicitacoesChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {solicitacoesChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
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
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
          <h3 className="font-display font-semibold text-lg mb-4">Viaturas por Órgão</h3>
          <div className="h-64">
            {viaturasChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={viaturasChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {viaturasChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
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
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
          <h3 className="font-display font-semibold text-lg mb-4">Cobertura do Estado</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">Com Equipamento</span>
              <span className="text-2xl font-display font-bold text-primary">
                {stats.municipiosComEquipamento}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">Com Viatura (sem equipamento)</span>
              <span className="text-2xl font-display font-bold text-info">
                {stats.municipiosComViaturaSemEquipamento}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">Sem Cobertura</span>
              <span className="text-2xl font-display font-bold text-muted-foreground">
                {stats.municipiosSemEquipamento}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-accent transition-all duration-500"
                style={{
                  width: `${(stats.municipiosComEquipamento / 184) * 100}%`,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {((stats.municipiosComEquipamento / 184) * 100).toFixed(1)}% do estado com equipamento
            </p>
          </div>
        </div>

        {/* Evolução Temporal */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm lg:col-span-2">
          <h3 className="font-display font-semibold text-lg mb-4">Evolução Temporal</h3>
          <div className="h-64">
            {evolutionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="equipamentos"
                    name="Equipamentos"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="solicitacoes"
                    name="Solicitações"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--accent))' }}
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
