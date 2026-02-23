import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Atividade } from '@/types';
import { toast } from 'sonner';

// Cast explícito necessário porque o supabase-js infere o tipo da tabela
// a partir do Database type — o `as Atividade[]` resolve o conflito de tipos.

async function fetchAtividades(): Promise<Atividade[]> {
  const { data, error } = await supabase
    .from('atividades')
    .select('*')
    .order('data', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Atividade[];
}

async function insertAtividade(
  payload: Omit<Atividade, 'id' | 'created_at' | 'updated_at'>
): Promise<Atividade> {
  const { data, error } = await supabase
    .from('atividades')
    .insert(payload as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Atividade;
}

async function patchAtividade(
  { id, ...payload }: Partial<Atividade> & { id: string }
): Promise<Atividade> {
  const { data, error } = await supabase
    .from('atividades')
    .update(payload as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Atividade;
}

async function removeAtividade(id: string): Promise<void> {
  const { error } = await supabase.from('atividades').delete().eq('id', id);
  if (error) throw error;
}

export function useAtividades() {
  const qc = useQueryClient();

  const { data: atividades = [], isLoading } = useQuery({
    queryKey: ['atividades'],
    queryFn: fetchAtividades,
  });

  const { mutate: addAtividade, isPending: isAdding } = useMutation({
    mutationFn: insertAtividade,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['atividades'] });
      toast.success('Atividade cadastrada com sucesso!');
    },
    onError: (err: Error) => toast.error(`Erro ao cadastrar: ${err.message}`),
  });

  const { mutate: updateAtividade, isPending: isUpdating } = useMutation({
    mutationFn: patchAtividade,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['atividades'] });
      toast.success('Atividade atualizada!');
    },
    onError: (err: Error) => toast.error(`Erro ao atualizar: ${err.message}`),
  });

  const { mutate: deleteAtividade, isPending: isDeleting } = useMutation({
    mutationFn: removeAtividade,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['atividades'] });
      toast.success('Atividade excluída.');
    },
    onError: (err: Error) => toast.error(`Erro ao excluir: ${err.message}`),
  });

  return {
    atividades,
    isLoading,
    addAtividade,
    isAdding,
    updateAtividade,
    isUpdating,
    deleteAtividade,
    isDeleting,
  };
}