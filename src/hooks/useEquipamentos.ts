import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Equipamento } from '@/types';
import { TipoEquipamento } from '@/data/municipios';
import { toast } from 'sonner';

type EquipamentoInsert = Omit<Equipamento, 'id' | 'created_at' | 'updated_at'>;

export function useEquipamentos() {
  const queryClient = useQueryClient();

  const { data: equipamentos = [], isLoading } = useQuery({
    queryKey: ['equipamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipamentos')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Equipamento[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (equipamento: EquipamentoInsert) => {
      const { data, error } = await supabase
        .from('equipamentos')
        .insert({
          municipio: equipamento.municipio,
          tipo: equipamento.tipo as TipoEquipamento,
          possui_patrulha: equipamento.possui_patrulha,
          endereco: equipamento.endereco,
          telefone: equipamento.telefone,
          responsavel: equipamento.responsavel,
          observacoes: equipamento.observacoes,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipamentos'] });
      toast.success('Equipamento cadastrado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao cadastrar equipamento: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Equipamento> & { id: string }) => {
      const updateData: Record<string, unknown> = {};
      if (data.municipio !== undefined) updateData.municipio = data.municipio;
      if (data.tipo !== undefined) updateData.tipo = data.tipo;
      if (data.possui_patrulha !== undefined) updateData.possui_patrulha = data.possui_patrulha;
      if (data.endereco !== undefined) updateData.endereco = data.endereco;
      if (data.telefone !== undefined) updateData.telefone = data.telefone;
      if (data.responsavel !== undefined) updateData.responsavel = data.responsavel;
      if (data.observacoes !== undefined) updateData.observacoes = data.observacoes;

      const { error } = await supabase
        .from('equipamentos')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipamentos'] });
      toast.success('Equipamento atualizado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar equipamento: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('equipamentos')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipamentos'] });
      toast.success('Equipamento excluído com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao excluir equipamento: ' + error.message);
    },
  });

  return {
    equipamentos,
    isLoading,
    addEquipamento: addMutation.mutate,
    updateEquipamento: updateMutation.mutate,
    deleteEquipamento: deleteMutation.mutate,
    isAdding: addMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
