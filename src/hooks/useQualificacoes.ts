import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface QualificacaoMunicipio {
  id: string;
  qualificacao_id: string;
  municipio: string;
  quantidade_pessoas: number;
}

export interface Qualificacao {
  id: string;
  nome: string;
  ministrante: string;
  data: string;
  total_pessoas: number;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  municipios: QualificacaoMunicipio[];
}

// Tipo para criação (sem id/timestamps)
export type QualificacaoPayload = {
  nome: string;
  ministrante: string;
  data: string;
  total_pessoas: number;
  observacoes?: string | null;
  municipios: { municipio: string; quantidade_pessoas: number }[];
};

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchQualificacoes(): Promise<Qualificacao[]> {
  const { data, error } = await db
    .from('qualificacoes')
    .select(`
      *,
      municipios:qualificacoes_municipios(*)
    `)
    .order('data', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Qualificacao[];
}

// ── Insert ────────────────────────────────────────────────────────────────────

async function insertQualificacao(payload: QualificacaoPayload): Promise<Qualificacao> {
  // 1. Insere a qualificação principal
  const { data: qual, error: errQual } = await db
    .from('qualificacoes')
    .insert({
      nome:          payload.nome,
      ministrante:   payload.ministrante,
      data:          payload.data,
      total_pessoas: payload.total_pessoas,
      observacoes:   payload.observacoes ?? null,
    })
    .select()
    .single();
  if (errQual) throw errQual;

  // 2. Insere os municípios
  if (payload.municipios.length > 0) {
    const { error: errMun } = await db
      .from('qualificacoes_municipios')
      .insert(
        payload.municipios.map(m => ({
          qualificacao_id:   qual.id,
          municipio:         m.municipio,
          quantidade_pessoas: m.quantidade_pessoas,
        }))
      );
    if (errMun) throw errMun;
  }

  return { ...qual, municipios: [] };
}

// ── Update ────────────────────────────────────────────────────────────────────

async function updateQualificacao(
  { id, ...payload }: QualificacaoPayload & { id: string }
): Promise<void> {
  // 1. Atualiza campos principais
  const { error: errQual } = await db
    .from('qualificacoes')
    .update({
      nome:          payload.nome,
      ministrante:   payload.ministrante,
      data:          payload.data,
      total_pessoas: payload.total_pessoas,
      observacoes:   payload.observacoes ?? null,
    })
    .eq('id', id);
  if (errQual) throw errQual;

  // 2. Substitui municípios (delete + insert)
  const { error: errDel } = await db
    .from('qualificacoes_municipios')
    .delete()
    .eq('qualificacao_id', id);
  if (errDel) throw errDel;

  if (payload.municipios.length > 0) {
    const { error: errMun } = await db
      .from('qualificacoes_municipios')
      .insert(
        payload.municipios.map(m => ({
          qualificacao_id:   id,
          municipio:         m.municipio,
          quantidade_pessoas: m.quantidade_pessoas,
        }))
      );
    if (errMun) throw errMun;
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function deleteQualificacao(id: string): Promise<void> {
  // Municípios são removidos via ON DELETE CASCADE
  const { error } = await db.from('qualificacoes').delete().eq('id', id);
  if (error) throw error;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useQualificacoes() {
  const qc = useQueryClient();

  const { data: qualificacoes = [], isLoading } = useQuery({
    queryKey: ['qualificacoes'],
    queryFn: fetchQualificacoes,
  });

  const { mutate: addQualificacao, isPending: isAdding } = useMutation({
    mutationFn: insertQualificacao,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qualificacoes'] });
      toast.success('Qualificação cadastrada com sucesso!');
    },
    onError: (err: Error) => toast.error(`Erro ao cadastrar: ${err.message}`),
  });

  const { mutate: editQualificacao, isPending: isUpdating } = useMutation({
    mutationFn: updateQualificacao,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qualificacoes'] });
      toast.success('Qualificação atualizada!');
    },
    onError: (err: Error) => toast.error(`Erro ao atualizar: ${err.message}`),
  });

  const { mutate: removeQualificacao, isPending: isDeleting } = useMutation({
    mutationFn: deleteQualificacao,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qualificacoes'] });
      toast.success('Qualificação excluída.');
    },
    onError: (err: Error) => toast.error(`Erro ao excluir: ${err.message}`),
  });

  return {
    qualificacoes,
    isLoading,
    addQualificacao,
    isAdding,
    editQualificacao,
    isUpdating,
    removeQualificacao,
    isDeleting,
  };
}