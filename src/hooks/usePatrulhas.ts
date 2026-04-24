import { useState, useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Patrulha, OrgaoPatrulha } from '@/types';
import { toast } from 'sonner';

type PatrulhaInsert = {
  equipamento_id?: string | null;  // CMM inaugurada
  solicitacao_id?: string | null;  // CMM em processo
  municipio: string;
  orgao: OrgaoPatrulha;
  efetivo?: number | null;
  viaturas?: number | null;
  responsavel?: string | null;
  contato?: string | null;
  data_implantacao?: string | null;
  observacoes?: string | null;
};

type PatrulhaUpdate = Partial<PatrulhaInsert>;

export const orgaosPatrulha: OrgaoPatrulha[] = ['PMCE', 'Guarda Municipal', 'Outro'];

interface UsePatrulhasOptions {
  equipamentoId?: string;
  solicitacaoId?: string;
}

export function usePatrulhas(opts: UsePatrulhasOptions = {}) {
  const { equipamentoId, solicitacaoId } = opts;
  const [patrulhas,  setPatrulhas]  = useState<Patrulha[]>([]);
  const [isLoading,  setIsLoading]  = useState(false);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('patrulhas')
        .select('*')
        .order('municipio', { ascending: true });

      if (equipamentoId) query = query.eq('equipamento_id', equipamentoId);
      else if (solicitacaoId) query = query.eq('solicitacao_id', solicitacaoId);

      const { data, error } = await query;
      if (error) throw error;
      setPatrulhas((data ?? []) as unknown as Patrulha[]);
    } catch (e: unknown) {
      toast.error('Erro ao carregar patrulhas');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [equipamentoId, solicitacaoId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addMutation = useMutation({
    mutationFn: async (payload: PatrulhaInsert): Promise<Patrulha> => {
      // Bloqueia orgão duplicado para o mesmo vínculo
      const existente = patrulhas.find(p =>
        p.orgao === payload.orgao && (
          (payload.equipamento_id && p.equipamento_id === payload.equipamento_id) ||
          (payload.solicitacao_id && p.solicitacao_id === payload.solicitacao_id)
        )
      );
      if (existente) {
        throw new Error(`Já existe uma patrulha da ${payload.orgao} para este registro.`);
      }

      const { data, error } = await supabase
        .from('patrulhas')
        .insert(payload as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Patrulha;
    },
    onSuccess: (created) => {
      setPatrulhas(prev => [...prev, created].sort((a, b) => a.municipio.localeCompare(b.municipio)));
      toast.success('Patrulha cadastrada com sucesso!');
    },
    onError: (err: Error) => toast.error(`Erro ao cadastrar: ${err.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: PatrulhaUpdate & { id: string }): Promise<Patrulha> => {
      const update: Record<string, unknown> = {};
      if (payload.orgao            !== undefined) update.orgao            = payload.orgao;
      if (payload.efetivo          !== undefined) update.efetivo          = payload.efetivo ?? null;
      if (payload.viaturas         !== undefined) update.viaturas         = payload.viaturas ?? null;
      if (payload.responsavel      !== undefined) update.responsavel      = payload.responsavel ?? null;
      if (payload.contato          !== undefined) update.contato          = payload.contato ?? null;
      if (payload.data_implantacao !== undefined) update.data_implantacao = payload.data_implantacao ?? null;
      if (payload.observacoes      !== undefined) update.observacoes      = payload.observacoes ?? null;

      const { data, error } = await supabase
        .from('patrulhas')
        .update(update as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Patrulha;
    },
    onSuccess: (updated) => {
      setPatrulhas(prev => prev.map(p => p.id === updated.id ? updated : p));
      toast.success('Patrulha atualizada!');
    },
    onError: (err: Error) => toast.error(`Erro ao atualizar: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string): Promise<string> => {
      const { error } = await supabase.from('patrulhas').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      setPatrulhas(prev => prev.filter(p => p.id !== id));
      toast.success('Patrulha removida.');
    },
    onError: (err: Error) => toast.error(`Erro ao remover: ${err.message}`),
  });

  // Estatísticas derivadas
  const totalEfetivo  = patrulhas.reduce((s, p) => s + (p.efetivo  ?? 0), 0);
  const totalViaturas = patrulhas.reduce((s, p) => s + (p.viaturas ?? 0), 0);
  const porOrgao = patrulhas.reduce<Partial<Record<OrgaoPatrulha, number>>>(
    (acc, p) => ({ ...acc, [p.orgao]: (acc[p.orgao] ?? 0) + 1 }),
    {}
  );

  return {
    patrulhas,
    isLoading,
    totalEfetivo,
    totalViaturas,
    porOrgao,
    refetch: fetchAll,
    addPatrulha:    addMutation.mutate,
    updatePatrulha: updateMutation.mutate,
    deletePatrulha: deleteMutation.mutate,
    isAdding:   addMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}