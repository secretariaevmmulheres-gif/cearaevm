import { useMemo, useState } from 'react';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Building2, 
  Truck, 
  FileText,
  Calendar,
  Download,
  FileDown,
  ChevronDown,
  BarChart3,
  ArrowRight
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Equipamento, Viatura, Solicitacao } from '@/types';
import { getRegiao, regioesList, RegiaoPlanejamento } from '@/data/municipios';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MonthlyComparisonReportProps {
  equipamentos: Equipamento[];
  viaturas: Viatura[];
  solicitacoes: Solicitacao[];
}

interface PeriodStats {
  totalEquipamentos: number;
  novosEquipamentos: number;
  totalViaturas: number;
  novasViaturas: number;
  totalSolicitacoes: number;
  novasSolicitacoes: number;
  solicitacoesAprovadas: number;
  solicitacoesInauguradas: number;
  equipamentosComPatrulha: number;
  porRegiao: Record<string, {
    equipamentos: number;
    viaturas: number;
    solicitacoes: number;
    novosEquipamentos: number;
    novasViaturas: number;
    novasSolicitacoes: number;
  }>;
}

const generateMonthOptions = () => {
  const options = [];
  const now = new Date();
  
  for (let i = 0; i < 12; i++) {
    const date = subMonths(now, i);
    options.push({
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: ptBR }),
    });
  }
  
  return options;
};

export function MonthlyComparisonReport({ 
  equipamentos, 
  viaturas, 
  solicitacoes 
}: MonthlyComparisonReportProps) {
  const monthOptions = useMemo(() => generateMonthOptions(), []);
  const [currentPeriod, setCurrentPeriod] = useState(monthOptions[0].value);
  const [comparisonPeriod, setComparisonPeriod] = useState(monthOptions[1].value);

  // Calculate stats for a given period
  const calculatePeriodStats = (
    period: string,
    eqs: Equipamento[],
    viats: Viatura[],
    sols: Solicitacao[]
  ): PeriodStats => {
    const [year, month] = period.split('-').map(Number);
    const periodStart = startOfMonth(new Date(year, month - 1));
    const periodEnd = endOfMonth(new Date(year, month - 1));

    const isInPeriod = (dateStr: string) => {
      try {
        const date = parseISO(dateStr);
        return isWithinInterval(date, { start: periodStart, end: periodEnd });
      } catch {
        return false;
      }
    };

    const novosEquipamentos = eqs.filter(e => isInPeriod(e.created_at));
    const novasViaturas = viats.filter(v => isInPeriod(v.created_at));
    const novasSolicitacoes = sols.filter(s => isInPeriod(s.created_at));

    // Calculate up to end of period
    const equipamentosAtePeriodo = eqs.filter(e => {
      try {
        return parseISO(e.created_at) <= periodEnd;
      } catch {
        return true;
      }
    });

    const viaturasAtePeriodo = viats.filter(v => {
      try {
        return parseISO(v.created_at) <= periodEnd;
      } catch {
        return true;
      }
    });

    const solicitacoesAtePeriodo = sols.filter(s => {
      try {
        return parseISO(s.created_at) <= periodEnd;
      } catch {
        return true;
      }
    });

    // Stats by region
    const porRegiao: PeriodStats['porRegiao'] = {};
    regioesList.forEach(regiao => {
      const regionEqs = equipamentosAtePeriodo.filter(e => getRegiao(e.municipio) === regiao);
      const regionViats = viaturasAtePeriodo.filter(v => getRegiao(v.municipio) === regiao);
      const regionSols = solicitacoesAtePeriodo.filter(s => getRegiao(s.municipio) === regiao);
      
      porRegiao[regiao] = {
        equipamentos: regionEqs.length,
        viaturas: regionViats.reduce((sum, v) => sum + v.quantidade, 0),
        solicitacoes: regionSols.length,
        novosEquipamentos: novosEquipamentos.filter(e => getRegiao(e.municipio) === regiao).length,
        novasViaturas: novasViaturas.filter(v => getRegiao(v.municipio) === regiao).reduce((sum, v) => sum + v.quantidade, 0),
        novasSolicitacoes: novasSolicitacoes.filter(s => getRegiao(s.municipio) === regiao).length,
      };
    });

    return {
      totalEquipamentos: equipamentosAtePeriodo.length,
      novosEquipamentos: novosEquipamentos.length,
      totalViaturas: viaturasAtePeriodo.reduce((sum, v) => sum + v.quantidade, 0),
      novasViaturas: novasViaturas.reduce((sum, v) => sum + v.quantidade, 0),
      totalSolicitacoes: solicitacoesAtePeriodo.length,
      novasSolicitacoes: novasSolicitacoes.length,
      solicitacoesAprovadas: novasSolicitacoes.filter(s => s.status === 'Aprovada').length,
      solicitacoesInauguradas: novasSolicitacoes.filter(s => s.status === 'Inaugurada').length,
      equipamentosComPatrulha: equipamentosAtePeriodo.filter(e => e.possui_patrulha).length,
      porRegiao,
    };
  };

  const currentStats = useMemo(
    () => calculatePeriodStats(currentPeriod, equipamentos, viaturas, solicitacoes),
    [currentPeriod, equipamentos, viaturas, solicitacoes]
  );

  const comparisonStats = useMemo(
    () => calculatePeriodStats(comparisonPeriod, equipamentos, viaturas, solicitacoes),
    [comparisonPeriod, equipamentos, viaturas, solicitacoes]
  );

  // Calculate variation
  const calculateVariation = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const variations = useMemo(() => ({
    equipamentos: calculateVariation(currentStats.totalEquipamentos, comparisonStats.totalEquipamentos),
    viaturas: calculateVariation(currentStats.totalViaturas, comparisonStats.totalViaturas),
    solicitacoes: calculateVariation(currentStats.totalSolicitacoes, comparisonStats.totalSolicitacoes),
    novosEquipamentos: currentStats.novosEquipamentos - comparisonStats.novosEquipamentos,
    novasViaturas: currentStats.novasViaturas - comparisonStats.novasViaturas,
    novasSolicitacoes: currentStats.novasSolicitacoes - comparisonStats.novasSolicitacoes,
  }), [currentStats, comparisonStats]);

  // Comparison chart data by region
  const regionComparisonData = useMemo(() => {
    return regioesList.map(regiao => ({
      name: regiao.length > 12 ? regiao.substring(0, 10) + '...' : regiao,
      fullName: regiao,
      atual: currentStats.porRegiao[regiao]?.novosEquipamentos || 0,
      anterior: comparisonStats.porRegiao[regiao]?.novosEquipamentos || 0,
    })).filter(r => r.atual > 0 || r.anterior > 0);
  }, [currentStats, comparisonStats]);

  // Evolution data (last 6 months)
  const evolutionData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const period = format(date, 'yyyy-MM');
      const stats = calculatePeriodStats(period, equipamentos, viaturas, solicitacoes);
      data.push({
        month: format(date, 'MMM/yy', { locale: ptBR }),
        equipamentos: stats.totalEquipamentos,
        viaturas: stats.totalViaturas,
        solicitacoes: stats.totalSolicitacoes,
      });
    }
    return data;
  }, [equipamentos, viaturas, solicitacoes]);

  // Get period label
  const getCurrentPeriodLabel = () => 
    monthOptions.find(m => m.value === currentPeriod)?.label || currentPeriod;
  
  const getComparisonPeriodLabel = () => 
    monthOptions.find(m => m.value === comparisonPeriod)?.label || comparisonPeriod;

  // Export comparative report
  const handleExportComparativeReport = () => {
    const doc = new jsPDF();
    let y = 22;

    // Title
    doc.setFontSize(16);
    doc.text('Relatório Mensal Comparativo', 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 14, y);
    y += 12;

    // Period comparison header
    doc.setFontSize(12);
    doc.text(`Comparativo: ${getCurrentPeriodLabel()} vs ${getComparisonPeriodLabel()}`, 14, y);
    y += 10;

    // Summary table
    const summaryData = [
      ['Métrica', getCurrentPeriodLabel(), getComparisonPeriodLabel(), 'Variação'],
      ['Total Equipamentos', currentStats.totalEquipamentos.toString(), comparisonStats.totalEquipamentos.toString(), 
       `${variations.equipamentos >= 0 ? '+' : ''}${variations.equipamentos.toFixed(1)}%`],
      ['Novos Equipamentos', currentStats.novosEquipamentos.toString(), comparisonStats.novosEquipamentos.toString(),
       `${variations.novosEquipamentos >= 0 ? '+' : ''}${variations.novosEquipamentos}`],
      ['Total Viaturas', currentStats.totalViaturas.toString(), comparisonStats.totalViaturas.toString(),
       `${variations.viaturas >= 0 ? '+' : ''}${variations.viaturas.toFixed(1)}%`],
      ['Novas Viaturas', currentStats.novasViaturas.toString(), comparisonStats.novasViaturas.toString(),
       `${variations.novasViaturas >= 0 ? '+' : ''}${variations.novasViaturas}`],
      ['Total Solicitações', currentStats.totalSolicitacoes.toString(), comparisonStats.totalSolicitacoes.toString(),
       `${variations.solicitacoes >= 0 ? '+' : ''}${variations.solicitacoes.toFixed(1)}%`],
      ['Novas Solicitações', currentStats.novasSolicitacoes.toString(), comparisonStats.novasSolicitacoes.toString(),
       `${variations.novasSolicitacoes >= 0 ? '+' : ''}${variations.novasSolicitacoes}`],
    ];

    autoTable(doc, {
      head: [summaryData[0]],
      body: summaryData.slice(1),
      startY: y,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [31, 81, 140] },
    });

    y = (doc as any).lastAutoTable.finalY + 15;

    // Regional breakdown
    doc.setFontSize(12);
    doc.text('Detalhamento por Região', 14, y);
    y += 5;

    const regionalData = regioesList.map(regiao => {
      const current = currentStats.porRegiao[regiao];
      const prev = comparisonStats.porRegiao[regiao];
      return [
        regiao,
        current?.equipamentos?.toString() || '0',
        (current?.novosEquipamentos || 0) > 0 ? `+${current?.novosEquipamentos}` : '0',
        current?.solicitacoes?.toString() || '0',
        (current?.novasSolicitacoes || 0) > 0 ? `+${current?.novasSolicitacoes}` : '0',
      ];
    });

    autoTable(doc, {
      head: [['Região', 'Equip. Total', 'Novos Equip.', 'Solic. Total', 'Novas Solic.']],
      body: regionalData,
      startY: y,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [31, 81, 140] },
    });

    doc.save(`relatorio-comparativo-${currentPeriod}-vs-${comparisonPeriod}.pdf`);
    toast.success('Relatório comparativo exportado!');
  };

  const VariationIndicator = ({ value, isPercentage = false }: { value: number; isPercentage?: boolean }) => {
    const isPositive = value > 0;
    const isNeutral = value === 0;
    
    return (
      <div className={cn(
        "flex items-center gap-1 text-sm font-medium",
        isPositive && "text-success",
        !isPositive && !isNeutral && "text-destructive",
        isNeutral && "text-muted-foreground"
      )}>
        {isPositive ? (
          <TrendingUp className="w-4 h-4" />
        ) : isNeutral ? (
          <Minus className="w-4 h-4" />
        ) : (
          <TrendingDown className="w-4 h-4" />
        )}
        <span>
          {isPositive && '+'}{isPercentage ? `${value.toFixed(1)}%` : value}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with period selection */}
      <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-lg">Relatório Comparativo Mensal</h3>
              <p className="text-sm text-muted-foreground">Análise de evolução entre períodos</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Select value={comparisonPeriod} onValueChange={setComparisonPeriod}>
                <SelectTrigger className="w-[160px]">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              
              <Select value={currentPeriod} onValueChange={setCurrentPeriod}>
                <SelectTrigger className="w-[160px]">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" onClick={handleExportComparativeReport} className="gap-2">
              <Download className="w-4 h-4" />
              Exportar PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Equipamentos */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Equipamentos</span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-muted-foreground">{getComparisonPeriodLabel()}</p>
                <p className="text-2xl font-bold text-muted-foreground">{comparisonStats.totalEquipamentos}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground mb-2" />
              <div>
                <p className="text-xs text-muted-foreground">{getCurrentPeriodLabel()}</p>
                <p className="text-2xl font-bold">{currentStats.totalEquipamentos}</p>
              </div>
            </div>
            <div className="pt-2 border-t border-border flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Variação</span>
              <VariationIndicator value={variations.equipamentos} isPercentage />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Novos no período</span>
              <span className="font-medium text-success">+{currentStats.novosEquipamentos}</span>
            </div>
          </div>
        </div>

        {/* Viaturas */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Truck className="w-5 h-5 text-accent" />
            </div>
            <span className="text-sm text-muted-foreground">Patrulhas M.P.</span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-muted-foreground">{getComparisonPeriodLabel()}</p>
                <p className="text-2xl font-bold text-muted-foreground">{comparisonStats.totalViaturas}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground mb-2" />
              <div>
                <p className="text-xs text-muted-foreground">{getCurrentPeriodLabel()}</p>
                <p className="text-2xl font-bold">{currentStats.totalViaturas}</p>
              </div>
            </div>
            <div className="pt-2 border-t border-border flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Variação</span>
              <VariationIndicator value={variations.viaturas} isPercentage />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Novas no período</span>
              <span className="font-medium text-success">+{currentStats.novasViaturas}</span>
            </div>
          </div>
        </div>

        {/* Solicitações */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-warning/10 rounded-lg">
              <FileText className="w-5 h-5 text-warning" />
            </div>
            <span className="text-sm text-muted-foreground">Solicitações</span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-muted-foreground">{getComparisonPeriodLabel()}</p>
                <p className="text-2xl font-bold text-muted-foreground">{comparisonStats.totalSolicitacoes}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground mb-2" />
              <div>
                <p className="text-xs text-muted-foreground">{getCurrentPeriodLabel()}</p>
                <p className="text-2xl font-bold">{currentStats.totalSolicitacoes}</p>
              </div>
            </div>
            <div className="pt-2 border-t border-border flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Variação</span>
              <VariationIndicator value={variations.solicitacoes} isPercentage />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Novas no período</span>
              <span className="font-medium text-success">+{currentStats.novasSolicitacoes}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolution Chart */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
          <h3 className="font-display font-semibold text-lg mb-4">Evolução dos Últimos 6 Meses</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
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
                  stroke="#c026d3" 
                  strokeWidth={2}
                  dot={{ fill: '#c026d3' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="viaturas" 
                  name="Viaturas" 
                  stroke="#0ea5e9" 
                  strokeWidth={2}
                  dot={{ fill: '#0ea5e9' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="solicitacoes" 
                  name="Solicitações" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  dot={{ fill: '#f59e0b' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Regional Comparison */}
        {regionComparisonData.length > 0 && (
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <h3 className="font-display font-semibold text-lg mb-4">
              Novos Equipamentos por Região
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regionComparisonData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    tick={{ fontSize: 10 }} 
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                  />
                  <Legend />
                  <Bar dataKey="anterior" name={getComparisonPeriodLabel()} fill="#94a3b8" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="atual" name={getCurrentPeriodLabel()} fill="#c026d3" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Summary Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-display font-semibold text-lg">Resumo Comparativo por Região</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Região</th>
                <th className="text-center">Equip. Atual</th>
                <th className="text-center">Novos Equip.</th>
                <th className="text-center">Viat. Atual</th>
                <th className="text-center">Novas Viat.</th>
                <th className="text-center">Solic. Atual</th>
                <th className="text-center">Novas Solic.</th>
              </tr>
            </thead>
            <tbody>
              {regioesList.map((regiao) => {
                const current = currentStats.porRegiao[regiao];
                return (
                  <tr key={regiao} className="animate-fade-in">
                    <td className="font-medium">{regiao}</td>
                    <td className="text-center">{current?.equipamentos || 0}</td>
                    <td className="text-center">
                      {(current?.novosEquipamentos || 0) > 0 ? (
                        <span className="text-success font-medium">+{current?.novosEquipamentos}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="text-center">{current?.viaturas || 0}</td>
                    <td className="text-center">
                      {(current?.novasViaturas || 0) > 0 ? (
                        <span className="text-success font-medium">+{current?.novasViaturas}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="text-center">{current?.solicitacoes || 0}</td>
                    <td className="text-center">
                      {(current?.novasSolicitacoes || 0) > 0 ? (
                        <span className="text-success font-medium">+{current?.novasSolicitacoes}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
