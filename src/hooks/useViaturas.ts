import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Viatura } from '@/types';
import { OrgaoResponsavel } from '@/data/municipios';
import { toast } from 'sonner';

type ViaturaInsert = Omit<Viatura, 'id' | 'created_at' | 'updated_at'>;

export function useViaturas() {
  const queryClient = useQueryClient();

  const { data: viaturas = [], isLoading } = useQuery({
    queryKey: ['viaturas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('viaturas')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Viatura[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (viatura: ViaturaInsert) => {
      const { data, error } = await supabase
        .from('viaturas')
        .insert({
          municipio: viatura.municipio,
          tipo_patrulha: viatura.tipo_patrulha,
          vinculada_equipamento: viatura.vinculada_equipamento,
          equipamento_id: viatura.equipamento_id || null,
          orgao_responsavel: viatura.orgao_responsavel as OrgaoResponsavel,
          quantidade: viatura.quantidade,
          data_implantacao: viatura.data_implantacao,
          responsavel: viatura.responsavel,
          observacoes: viatura.observacoes,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['viaturas'] });
      toast.success('Viatura cadastrada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao cadastrar viatura: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Viatura> & { id: string }) => {
      const updateData: Record<string, unknown> = {};
      if (data.municipio !== undefined) updateData.municipio = data.municipio;
      if (data.tipo_patrulha !== undefined) updateData.tipo_patrulha = data.tipo_patrulha;
      if (data.vinculada_equipamento !== undefined) updateData.vinculada_equipamento = data.vinculada_equipamento;
      if (data.equipamento_id !== undefined) updateData.equipamento_id = data.equipamento_id || null;
      if (data.orgao_responsavel !== undefined) updateData.orgao_responsavel = data.orgao_responsavel;
      if (data.quantidade !== undefined) updateData.quantidade = data.quantidade;
      if (data.data_implantacao !== undefined) updateData.data_implantacao = data.data_implantacao;
      if (data.responsavel !== undefined) updateData.responsavel = data.responsavel;
      if (data.observacoes !== undefined) updateData.observacoes = data.observacoes;

      const { error } = await supabase
        .from('viaturas')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['viaturas'] });
      toast.success('Viatura atualizada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar viatura: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('viaturas')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['viaturas'] });
      toast.success('Viatura excluída com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao excluir viatura: ' + error.message);
    },
  });

  return {
    viaturas,
    isLoading,
    addViatura: addMutation.mutate,
    updateViatura: updateMutation.mutate,
    deleteViatura: deleteMutation.mutate,
    isAdding: addMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
