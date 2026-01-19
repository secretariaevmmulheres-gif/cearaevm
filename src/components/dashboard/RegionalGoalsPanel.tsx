import { useMemo, useState } from 'react';
import { regioesList, getRegiao, getMunicipiosPorRegiao } from '@/data/municipios';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Target, TrendingUp, Award, AlertTriangle, Settings2, Save, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Equipamento, Viatura, Solicitacao } from '@/types';

interface RegionalGoalsPanelProps {
  equipamentos: Equipamento[];
  viaturas: Viatura[];
  solicitacoes: Solicitacao[];
}

interface RegionGoals {
  equipamentos: number;
  viaturas: number;
  cobertura: number;
}

const DEFAULT_GOALS: RegionGoals = {
  equipamentos: 5,
  viaturas: 10,
  cobertura: 50,
};

const STORAGE_KEY = 'evm-regional-goals';

export function RegionalGoalsPanel({ equipamentos, viaturas, solicitacoes }: RegionalGoalsPanelProps) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [goalsDialogOpen, setGoalsDialogOpen] = useState(false);
  const [editingGoals, setEditingGoals] = useState<Record<string, RegionGoals>>({});

  // Load goals from localStorage
  const savedGoals = useMemo(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as Record<string, RegionGoals>;
      }
    } catch (e) {
      console.error('Error loading goals:', e);
    }
    return {};
  }, []);

  const getGoalsForRegion = (regiao: string): RegionGoals => {
    return savedGoals[regiao] || DEFAULT_GOALS;
  };

  // Calculate progress for each region
  const regionProgress = useMemo(() => {
    const currentDate = new Date();
    const [year, month] = selectedMonth.split('-').map(Number);
    const isCurrentMonth = currentDate.getFullYear() === year && currentDate.getMonth() + 1 === month;
    const daysInMonth = new Date(year, month, 0).getDate();
    const dayOfMonth = currentDate.getDate();
    const monthProgress = isCurrentMonth ? (dayOfMonth / daysInMonth) * 100 : 100;

    return regioesList.map(regiao => {
      const goals = getGoalsForRegion(regiao);
      const municipiosDaRegiao = getMunicipiosPorRegiao(regiao);
      
      // Filter data for the selected month
      const equipamentosDaRegiao = equipamentos.filter(e => {
        const regiaoEquip = getRegiao(e.municipio);
        const createdDate = new Date(e.created_at);
        return regiaoEquip === regiao && 
          createdDate.getFullYear() === year && 
          createdDate.getMonth() + 1 === month;
      });

      const viaturasDaRegiao = viaturas.filter(v => {
        const regiaoViatura = getRegiao(v.municipio);
        const createdDate = new Date(v.created_at);
        return regiaoViatura === regiao && 
          createdDate.getFullYear() === year && 
          createdDate.getMonth() + 1 === month;
      });

      // Total equipment in region (all time) for coverage calculation
      const allEquipamentosRegiao = equipamentos.filter(e => getRegiao(e.municipio) === regiao);
      const municipiosComEquipamento = new Set(allEquipamentosRegiao.map(e => e.municipio)).size;
      const currentCobertura = municipiosDaRegiao.length > 0 
        ? (municipiosComEquipamento / municipiosDaRegiao.length) * 100 
        : 0;

      const equipamentosCount = equipamentosDaRegiao.length;
      const viaturasCount = viaturasDaRegiao.reduce((sum, v) => sum + v.quantidade, 0);

      // Calculate progress percentages
      const equipProgress = goals.equipamentos > 0 ? (equipamentosCount / goals.equipamentos) * 100 : 0;
      const viaturasProgress = goals.viaturas > 0 ? (viaturasCount / goals.viaturas) * 100 : 0;
      const coberturaProgress = goals.cobertura > 0 ? (currentCobertura / goals.cobertura) * 100 : 0;

      // Calculate overall progress
      const overallProgress = (equipProgress + viaturasProgress + coberturaProgress) / 3;

      // Status based on progress vs time
      let status: 'on-track' | 'at-risk' | 'behind' | 'achieved';
      if (overallProgress >= 100) {
        status = 'achieved';
      } else if (overallProgress >= monthProgress - 10) {
        status = 'on-track';
      } else if (overallProgress >= monthProgress - 30) {
        status = 'at-risk';
      } else {
        status = 'behind';
      }

      return {
        regiao,
        goals,
        current: {
          equipamentos: equipamentosCount,
          viaturas: viaturasCount,
          cobertura: currentCobertura,
        },
        progress: {
          equipamentos: Math.min(equipProgress, 100),
          viaturas: Math.min(viaturasProgress, 100),
          cobertura: Math.min(coberturaProgress, 100),
          overall: Math.min(overallProgress, 100),
        },
        status,
        totalMunicipios: municipiosDaRegiao.length,
        monthProgress,
      };
    });
  }, [equipamentos, viaturas, selectedMonth, savedGoals]);

  // Summary statistics
  const summary = useMemo(() => {
    const achieved = regionProgress.filter(r => r.status === 'achieved').length;
    const onTrack = regionProgress.filter(r => r.status === 'on-track').length;
    const atRisk = regionProgress.filter(r => r.status === 'at-risk').length;
    const behind = regionProgress.filter(r => r.status === 'behind').length;
    const avgProgress = regionProgress.reduce((sum, r) => sum + r.progress.overall, 0) / regionProgress.length;

    return { achieved, onTrack, atRisk, behind, avgProgress };
  }, [regionProgress]);

  // Generate month options
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  }, []);

  const handleSaveGoals = () => {
    try {
      const merged = { ...savedGoals, ...editingGoals };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      setGoalsDialogOpen(false);
      setEditingGoals({});
      toast.success('Metas salvas com sucesso!');
      window.location.reload();
    } catch (e) {
      toast.error('Erro ao salvar metas');
    }
  };

  const handleResetGoals = () => {
    localStorage.removeItem(STORAGE_KEY);
    setGoalsDialogOpen(false);
    toast.success('Metas restauradas para valores padrão');
    window.location.reload();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'achieved': return 'text-success bg-success/10 border-success/30';
      case 'on-track': return 'text-info bg-info/10 border-info/30';
      case 'at-risk': return 'text-warning bg-warning/10 border-warning/30';
      case 'behind': return 'text-destructive bg-destructive/10 border-destructive/30';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'achieved': return 'Meta Atingida';
      case 'on-track': return 'No Caminho';
      case 'at-risk': return 'Em Risco';
      case 'behind': return 'Atrasado';
      default: return 'Indefinido';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'achieved': return <Award className="w-4 h-4" />;
      case 'on-track': return <TrendingUp className="w-4 h-4" />;
      case 'at-risk': return <AlertTriangle className="w-4 h-4" />;
      case 'behind': return <AlertTriangle className="w-4 h-4" />;
      default: return <Target className="w-4 h-4" />;
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-success';
    if (progress >= 75) return 'bg-info';
    if (progress >= 50) return 'bg-warning';
    return 'bg-destructive';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="font-display font-semibold text-lg flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Painel de Metas Mensais por Região
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe o progresso das metas de cada região
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione o mês" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Dialog open={goalsDialogOpen} onOpenChange={setGoalsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings2 className="w-4 h-4" />
                Configurar Metas
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Configurar Metas por Região</DialogTitle>
                <DialogDescription>
                  Defina as metas mensais para cada região. As metas são salvas localmente.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {regioesList.map(regiao => {
                  const currentGoals = editingGoals[regiao] || getGoalsForRegion(regiao);
                  return (
                    <div key={regiao} className="border rounded-lg p-4 space-y-3">
                      <h4 className="font-medium text-sm">{regiao}</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs">Equipamentos</Label>
                          <Input
                            type="number"
                            min={0}
                            value={currentGoals.equipamentos}
                            onChange={(e) => setEditingGoals(prev => ({
                              ...prev,
                              [regiao]: { ...currentGoals, equipamentos: Number(e.target.value) }
                            }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Viaturas</Label>
                          <Input
                            type="number"
                            min={0}
                            value={currentGoals.viaturas}
                            onChange={(e) => setEditingGoals(prev => ({
                              ...prev,
                              [regiao]: { ...currentGoals, viaturas: Number(e.target.value) }
                            }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Cobertura (%)</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={currentGoals.cobertura}
                            onChange={(e) => setEditingGoals(prev => ({
                              ...prev,
                              [regiao]: { ...currentGoals, cobertura: Number(e.target.value) }
                            }))}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <DialogFooter className="flex gap-2">
                <Button variant="outline" onClick={handleResetGoals} className="gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Restaurar Padrão
                </Button>
                <Button onClick={handleSaveGoals} className="gap-2">
                  <Save className="w-4 h-4" />
                  Salvar Metas
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm text-center">
          <div className="text-2xl font-bold text-success">{summary.achieved}</div>
          <div className="text-xs text-muted-foreground">Metas Atingidas</div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm text-center">
          <div className="text-2xl font-bold text-info">{summary.onTrack}</div>
          <div className="text-xs text-muted-foreground">No Caminho</div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm text-center">
          <div className="text-2xl font-bold text-warning">{summary.atRisk}</div>
          <div className="text-xs text-muted-foreground">Em Risco</div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm text-center">
          <div className="text-2xl font-bold text-destructive">{summary.behind}</div>
          <div className="text-xs text-muted-foreground">Atrasados</div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm text-center col-span-2 sm:col-span-1">
          <div className="text-2xl font-bold text-primary">{summary.avgProgress.toFixed(0)}%</div>
          <div className="text-xs text-muted-foreground">Média Geral</div>
        </div>
      </div>

      {/* Region Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {regionProgress.map(region => (
          <div 
            key={region.regiao} 
            className="bg-card rounded-xl p-5 border border-border shadow-sm space-y-4"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-display font-semibold text-sm">{region.regiao}</h4>
                <p className="text-xs text-muted-foreground">{region.totalMunicipios} municípios</p>
              </div>
              <span className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border",
                getStatusColor(region.status)
              )}>
                {getStatusIcon(region.status)}
                {getStatusLabel(region.status)}
              </span>
            </div>

            {/* Overall Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progresso Geral</span>
                <span className="font-medium">{region.progress.overall.toFixed(0)}%</span>
              </div>
              <div className="relative">
                <Progress value={region.progress.overall} className="h-3" />
                {/* Time indicator */}
                <div 
                  className="absolute top-0 h-3 w-0.5 bg-foreground/50 rounded"
                  style={{ left: `${region.monthProgress}%` }}
                  title={`Progresso esperado: ${region.monthProgress.toFixed(0)}%`}
                />
              </div>
            </div>

            {/* Individual Metrics */}
            <div className="space-y-3">
              {/* Equipamentos */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Equipamentos</span>
                  <span className="font-medium">
                    {region.current.equipamentos} / {region.goals.equipamentos}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div 
                    className={cn("h-full transition-all duration-500 rounded-full", getProgressColor(region.progress.equipamentos))}
                    style={{ width: `${region.progress.equipamentos}%` }}
                  />
                </div>
              </div>

              {/* Viaturas */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Viaturas</span>
                  <span className="font-medium">
                    {region.current.viaturas} / {region.goals.viaturas}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div 
                    className={cn("h-full transition-all duration-500 rounded-full", getProgressColor(region.progress.viaturas))}
                    style={{ width: `${region.progress.viaturas}%` }}
                  />
                </div>
              </div>

              {/* Cobertura */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Cobertura</span>
                  <span className="font-medium">
                    {region.current.cobertura.toFixed(1)}% / {region.goals.cobertura}%
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div 
                    className={cn("h-full transition-all duration-500 rounded-full", getProgressColor(region.progress.cobertura))}
                    style={{ width: `${region.progress.cobertura}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
