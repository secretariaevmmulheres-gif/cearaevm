import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { regioesList } from '@/data/municipios';

export interface RegionalGoal {
  id: string;
  regiao: string;
  ano: number;
  mes: number;
  meta_equipamentos: number;
  meta_viaturas: number;
  meta_cobertura: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface RegionalGoalInput {
  regiao: string;
  ano: number;
  mes: number;
  meta_equipamentos: number;
  meta_viaturas: number;
  meta_cobertura: number;
}

const DEFAULT_GOALS = {
  meta_equipamentos: 5,
  meta_viaturas: 10,
  meta_cobertura: 50,
};

export function useRegionalGoals(ano?: number, mes?: number) {
  const queryClient = useQueryClient();

  const { data: goals = [], isLoading, error } = useQuery({
    queryKey: ['regional-goals', ano, mes],
    queryFn: async () => {
      let query = supabase.from('regional_goals').select('*');
      
      if (ano !== undefined) {
        query = query.eq('ano', ano);
      }
      if (mes !== undefined) {
        query = query.eq('mes', mes);
      }
      
      const { data, error } = await query.order('regiao');
      
      if (error) throw error;
      return data as RegionalGoal[];
    },
  });

  // Get goals as a map for easy lookup
  const goalsMap = goals.reduce((acc, goal) => {
    const key = `${goal.regiao}-${goal.ano}-${goal.mes}`;
    acc[key] = goal;
    return acc;
  }, {} as Record<string, RegionalGoal>);

  const getGoalForRegion = (regiao: string, targetAno: number, targetMes: number) => {
    const key = `${regiao}-${targetAno}-${targetMes}`;
    return goalsMap[key] || null;
  };

  const getGoalsWithDefaults = (targetAno: number, targetMes: number) => {
    return regioesList.map(regiao => {
      const existing = getGoalForRegion(regiao, targetAno, targetMes);
      return {
        regiao,
        ano: targetAno,
        mes: targetMes,
        meta_equipamentos: existing?.meta_equipamentos ?? DEFAULT_GOALS.meta_equipamentos,
        meta_viaturas: existing?.meta_viaturas ?? DEFAULT_GOALS.meta_viaturas,
        meta_cobertura: existing?.meta_cobertura ?? DEFAULT_GOALS.meta_cobertura,
        id: existing?.id,
      };
    });
  };

  const upsertGoalMutation = useMutation({
    mutationFn: async (input: RegionalGoalInput) => {
      const { data, error } = await supabase
        .from('regional_goals')
        .upsert({
          regiao: input.regiao,
          ano: input.ano,
          mes: input.mes,
          meta_equipamentos: input.meta_equipamentos,
          meta_viaturas: input.meta_viaturas,
          meta_cobertura: input.meta_cobertura,
        }, { onConflict: 'regiao,ano,mes' })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regional-goals'] });
    },
  });

  const upsertMultipleGoalsMutation = useMutation({
    mutationFn: async (inputs: RegionalGoalInput[]) => {
      const { data, error } = await supabase
        .from('regional_goals')
        .upsert(
          inputs.map(input => ({
            regiao: input.regiao,
            ano: input.ano,
            mes: input.mes,
            meta_equipamentos: input.meta_equipamentos,
            meta_viaturas: input.meta_viaturas,
            meta_cobertura: input.meta_cobertura,
          })),
          { onConflict: 'regiao,ano,mes' }
        )
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regional-goals'] });
      toast.success('Metas salvas com sucesso!');
    },
    onError: (error) => {
      console.error('Error saving goals:', error);
      toast.error('Erro ao salvar metas');
    },
  });

  // Get historical goals for comparison
  const { data: historicalGoals = [] } = useQuery({
    queryKey: ['regional-goals-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regional_goals')
        .select('*')
        .order('ano', { ascending: false })
        .order('mes', { ascending: false });
      
      if (error) throw error;
      return data as RegionalGoal[];
    },
  });

  // Get unique months available in history
  const availableMonths = [...new Set(
    historicalGoals.map(g => `${g.ano}-${String(g.mes).padStart(2, '0')}`)
  )].sort().reverse();

  return {
    goals,
    goalsMap,
    isLoading,
    error,
    getGoalForRegion,
    getGoalsWithDefaults,
    upsertGoal: upsertGoalMutation.mutate,
    upsertMultipleGoals: upsertMultipleGoalsMutation.mutate,
    isUpsertingGoals: upsertMultipleGoalsMutation.isPending,
    historicalGoals,
    availableMonths,
  };
}
