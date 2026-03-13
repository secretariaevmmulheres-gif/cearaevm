import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Solicitacao } from '@/types';
import { TipoEquipamento, StatusSolicitacao } from '@/data/municipios';
import { toast } from 'sonner';
import { validateNup } from './useEquipamentos';

// Payload explícito — desacoplado do tipo gerado pelo Supabase CLI
// para não depender do supabase_types.ts estar atualizado.
type SolicitacaoInsert = {
  municipio: string;
  data_solicitacao: string;
  tipo_equipamento: TipoEquipamento;
  status: StatusSolicitacao;
  recebeu_patrulha: boolean;
  guarda_municipal_estruturada: boolean;
  kit_athena_entregue: boolean;
  kit_athena_previo?: boolean;
  capacitacao_realizada: boolean;
  nup?: string | null;
  observacoes?: string | null;
  anexos?: string[];
  qualificacao_id?: string | null;
};

export function useSolicitacoes() {
  const queryClient = useQueryClient();

  const { data: solicitacoes = [], isLoading } = useQuery({
    queryKey: ['solicitacoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solicitacoes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      // cast via unknown para contornar tipos gerados desatualizados
      return (data ?? []) as unknown as Solicitacao[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (solicitacao: SolicitacaoInsert) => {
      const nupCheck = validateNup(solicitacao.nup);
      if (!nupCheck.valid) throw new Error(nupCheck.message);

      const { data, error } = await supabase
        .from('solicitacoes')
        .insert({
          municipio:                    solicitacao.municipio,
          data_solicitacao:             solicitacao.data_solicitacao,
          tipo_equipamento:             solicitacao.tipo_equipamento as TipoEquipamento,
          status:                       solicitacao.status as StatusSolicitacao,
          recebeu_patrulha:             solicitacao.recebeu_patrulha,
          guarda_municipal_estruturada: solicitacao.guarda_municipal_estruturada,
          kit_athena_entregue:          solicitacao.kit_athena_entregue,
          kit_athena_previo:            solicitacao.kit_athena_previo ?? false,
          capacitacao_realizada:        solicitacao.capacitacao_realizada,
          nup:                          solicitacao.nup || null,
          observacoes:                  solicitacao.observacoes,
          anexos:                       solicitacao.anexos,
          qualificacao_id:              solicitacao.qualificacao_id ?? null,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes'] });
      toast.success('Solicitação cadastrada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao cadastrar solicitação: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<SolicitacaoInsert> & { id: string }) => {
      if (data.nup !== undefined) {
        const nupCheck = validateNup(data.nup);
        if (!nupCheck.valid) throw new Error(nupCheck.message);
      }

      const updateData: Record<string, unknown> = {};
      if (data.municipio                    !== undefined) updateData.municipio                    = data.municipio;
      if (data.data_solicitacao             !== undefined) updateData.data_solicitacao             = data.data_solicitacao;
      if (data.tipo_equipamento             !== undefined) updateData.tipo_equipamento             = data.tipo_equipamento;
      if (data.status                       !== undefined) updateData.status                       = data.status;
      if (data.recebeu_patrulha             !== undefined) updateData.recebeu_patrulha             = data.recebeu_patrulha;
      if (data.guarda_municipal_estruturada !== undefined) updateData.guarda_municipal_estruturada = data.guarda_municipal_estruturada;
      if (data.kit_athena_entregue          !== undefined) updateData.kit_athena_entregue          = data.kit_athena_entregue;
      if (data.kit_athena_previo            !== undefined) updateData.kit_athena_previo            = data.kit_athena_previo;
      if (data.capacitacao_realizada        !== undefined) updateData.capacitacao_realizada        = data.capacitacao_realizada;
      if (data.nup                          !== undefined) updateData.nup                          = data.nup || null;
      if (data.observacoes                  !== undefined) updateData.observacoes                  = data.observacoes;
      if (data.anexos                       !== undefined) updateData.anexos                       = data.anexos;
      if (data.qualificacao_id              !== undefined) updateData.qualificacao_id              = data.qualificacao_id ?? null;

      const { error } = await supabase
        .from('solicitacoes')
        .update(updateData as any)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes'] });
      toast.success('Solicitação atualizada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar solicitação: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('solicitacoes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes'] });
      toast.success('Solicitação excluída com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao excluir solicitação: ' + error.message);
    },
  });

  // ── Transformar solicitação em equipamento ────────────────────────────────
  const transformarEmEquipamento = useMutation({
    mutationFn: async (solicitacaoId: string) => {
      const solicitacao = solicitacoes.find((s) => s.id === solicitacaoId);
      if (!solicitacao || solicitacao.status !== 'Inaugurada') {
        throw new Error('Solicitação não pode ser transformada');
      }

      const { error } = await supabase
        .from('equipamentos')
        .insert({
          municipio:             solicitacao.municipio,
          tipo:                  solicitacao.tipo_equipamento,
          possui_patrulha:       solicitacao.recebeu_patrulha,
          kit_athena_entregue:   solicitacao.kit_athena_entregue,
          kit_athena_previo:     solicitacao.kit_athena_previo ?? false,
          capacitacao_realizada: solicitacao.capacitacao_realizada,
          nup:                   solicitacao.nup || null,
          endereco:              '',
          telefone:              '',
          responsavel:           '',
          observacoes:           solicitacao.observacoes
            ? `[Origem: solicitação ${solicitacaoId}] ${solicitacao.observacoes}`
            : `[Origem: solicitação ${solicitacaoId}]`,
        } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipamentos'] });
      toast.success('Equipamento criado com sucesso — dados da solicitação herdados');
    },
    onError: (error) => {
      toast.error('Erro ao transformar em equipamento: ' + error.message);
    },
  });

  return {
    solicitacoes,
    isLoading,
    addSolicitacao:           addMutation.mutate,
    updateSolicitacao:        updateMutation.mutate,
    deleteSolicitacao:        deleteMutation.mutate,
    transformarEmEquipamento: transformarEmEquipamento.mutate,
    isAdding:   addMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}