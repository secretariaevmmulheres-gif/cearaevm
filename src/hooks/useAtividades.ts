import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Atividade } from '@/types';
import { toast } from 'sonner';

const PAGE_SIZE = 100;

// Tipo intermediário que mapeia exatamente o que o Supabase espera na tabela atividades.
type AtividadeInsert = {
  municipio: string;
  municipio_sede: string;
  tipo: string;
  recurso: string;
  status: string;
  data: string;
  quantidade_equipe?: number | null;
  nup?: string | null;
  nome_evento?: string | null;
  dias?: number | null;
  horario?: string | null;
  atendimentos?: number | null;
  endereco?: string | null;
  observacoes?: string | null;
  municipios_participantes?: string[];
};

type AtividadeUpdate = Partial<AtividadeInsert>;

function toInsert(payload: Omit<Atividade, 'id' | 'created_at' | 'updated_at'>): AtividadeInsert {
  return {
    municipio:                payload.municipio,
    municipio_sede:           payload.municipio_sede,
    tipo:                     payload.tipo,
    recurso:                  payload.recurso,
    status:                   payload.status,
    data:                     payload.data,
    quantidade_equipe:        payload.quantidade_equipe ?? null,
    nup:                      payload.nup ?? null,
    nome_evento:              payload.nome_evento ?? null,
    dias:                     payload.dias ?? null,
    horario:                  payload.horario ?? null,
    atendimentos:             payload.atendimentos ?? null,
    endereco:                 payload.endereco ?? null,
    observacoes:              payload.observacoes ?? null,
    municipios_participantes: payload.municipios_participantes ?? [],
  };
}

async function insertAtividade(
  payload: Omit<Atividade, 'id' | 'created_at' | 'updated_at'>
): Promise<Atividade> {
  const { data, error } = await supabase
    .from('atividades')
    .insert(toInsert(payload))
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Atividade;
}

async function patchAtividade(
  { id, ...payload }: Partial<Atividade> & { id: string }
): Promise<Atividade> {
  const update: AtividadeUpdate = {};
  if (payload.municipio         !== undefined) update.municipio         = payload.municipio;
  if (payload.municipio_sede    !== undefined) update.municipio_sede    = payload.municipio_sede;
  if (payload.tipo              !== undefined) update.tipo              = payload.tipo;
  if (payload.recurso           !== undefined) update.recurso           = payload.recurso;
  if (payload.status            !== undefined) update.status            = payload.status;
  if (payload.data              !== undefined) update.data              = payload.data;
  if (payload.quantidade_equipe !== undefined) update.quantidade_equipe = payload.quantidade_equipe;
  if (payload.nup               !== undefined) update.nup               = payload.nup;
  if (payload.nome_evento       !== undefined) update.nome_evento       = payload.nome_evento;
  if (payload.dias              !== undefined) update.dias              = payload.dias;
  if (payload.horario           !== undefined) update.horario           = payload.horario;
  if (payload.atendimentos      !== undefined) update.atendimentos      = payload.atendimentos;
  if (payload.endereco          !== undefined) update.endereco          = payload.endereco;
  if (payload.observacoes       !== undefined) update.observacoes       = payload.observacoes;

  const { data, error } = await supabase
    .from('atividades')
    .update(update)
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

  // ── Estado e fetch completo ───────────────────────────────────────────────
  const [atividades,     setAtividades]     = useState<Atividade[]>([]);
  const [isLoading,      setIsLoading]      = useState(false);
  const [isLoadingMore,  setIsLoadingMore]  = useState(false);
  const [hasMore,        setHasMore]        = useState(false);
  const [total,          setTotal]          = useState<number | null>(null);
  const [visibleCount,   setVisibleCount]   = useState(PAGE_SIZE);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error, count } = await supabase
        .from('atividades')
        .select('*', { count: 'exact' })
        .order('data', { ascending: false })
        .order('id',   { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as unknown as Atividade[];
      setAtividades(rows);
      setTotal(count ?? rows.length);
      setVisibleCount(PAGE_SIZE);
      setHasMore(rows.length > PAGE_SIZE);
    } catch (e: unknown) {
      toast.error('Erro ao carregar atividades');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(() => {
    setVisibleCount(prev => {
      const next = prev + PAGE_SIZE;
      setHasMore(next < atividades.length);
      return next;
    });
    setIsLoadingMore(false);
  }, [atividades.length]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const { mutate: addAtividade, isPending: isAdding } = useMutation({
    mutationFn: insertAtividade,
    onSuccess: () => { fetchAll(); toast.success('Atividade cadastrada com sucesso!'); },
    onError: (err: Error) => toast.error(`Erro ao cadastrar: ${err.message}`),
  });

  const { mutate: updateAtividade, isPending: isUpdating } = useMutation({
    mutationFn: patchAtividade,
    onSuccess: (updated) => {
      setAtividades(prev => prev.map(a => a.id === updated.id ? updated : a));
      toast.success('Atividade atualizada!');
    },
    onError: (err: Error) => toast.error(`Erro ao atualizar: ${err.message}`),
  });

  const { mutate: deleteAtividade, isPending: isDeleting } = useMutation({
    mutationFn: removeAtividade,
    onSuccess: (_, id) => {
      setAtividades(prev => prev.filter(a => a.id !== id));
      setTotal(prev => prev !== null ? prev - 1 : null);
      toast.success('Atividade excluída.');
    },
    onError: (err: Error) => toast.error(`Erro ao excluir: ${err.message}`),
  });

  return {
    atividades,
    isLoading,
    isLoadingMore,
    hasMore,
    total,
    visibleCount,
    loadMore,
    refetch: fetchAll,
    addAtividade,
    isAdding,
    updateAtividade,
    isUpdating,
    deleteAtividade,
    isDeleting,
  };
}