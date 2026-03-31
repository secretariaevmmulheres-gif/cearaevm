import { useState, useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Equipamento } from '@/types';
import { TipoEquipamento } from '@/data/municipios';
import { toast } from 'sonner';

const PAGE_SIZE = 100;

// Payload completo para insert/update — desacoplado do tipo gerado pelo Supabase
type EquipamentoInsert = {
  municipio: string;
  tipo: TipoEquipamento;
  possui_patrulha: boolean;
  endereco?: string | null;
  telefone?: string | null;
  responsavel?: string | null;
  observacoes?: string | null;
  kit_athena_entregue?: boolean;
  kit_athena_previo?: boolean;
  capacitacao_realizada?: boolean;
  nup?: string | null;
  qualificacao_id?: string | null;
};

// Formato: 62000.001753/2025-56
const NUP_REGEX = /^\d{5}\.\d{6}\/\d{4}-\d{2}$/;

export function validateNup(nup: string | null | undefined): { valid: boolean; message?: string } {
  if (!nup || nup.trim() === '') return { valid: true };
  if (!NUP_REGEX.test(nup.trim())) {
    return { valid: false, message: 'NUP invalido. Formato esperado: 62000.001753/2025-56' };
  }
  return { valid: true };
}

// CMB, CMC e CMM sao unicos por municipio -> bloquear cadastro.
// DDM e Salas Lilas podem ter multiplos -> apenas avisar.
const TIPOS_UNICOS: string[] = [
  'Casa da Mulher Brasileira',
  'Casa da Mulher Cearense',
  'Casa da Mulher Municipal',
];

export function checkDuplicata(
  equipamentos: { municipio: string; tipo: string; id?: string }[],
  municipio: string,
  tipo: string,
  ignorarId?: string
): { bloquear: boolean; message: string } | null {
  const existe = equipamentos.find(
    e => e.municipio === municipio && e.tipo === tipo && e.id !== ignorarId
  );
  if (!existe) return null;
  const bloquear = TIPOS_UNICOS.includes(tipo);
  return {
    bloquear,
    message: bloquear
      ? `Ja existe um equipamento do tipo "${tipo}" em ${municipio}. Este tipo so pode ter um por municipio.`
      : `${municipio} ja possui um equipamento do tipo "${tipo}". Confirme se este e realmente um novo equipamento distinto.`,
  };
}

export function useEquipamentos() {
  // Carrega TODOS os equipamentos de uma vez.
  // PAGE_SIZE só é usado no botão "Carregar mais" da UI de listagem
  // para renderização progressiva — os dados em memória são sempre completos.
  const [equipamentos,   setEquipamentos]   = useState<Equipamento[]>([]);
  const [isLoading,      setIsLoading]      = useState(false);
  const [isLoadingMore,  setIsLoadingMore]  = useState(false);
  const [hasMore,        setHasMore]        = useState(false);
  const [total,          setTotal]          = useState<number | null>(null);
  // visibleCount controla quantos registros a UI mostra (renderização progressiva)
  const [visibleCount,   setVisibleCount]   = useState(PAGE_SIZE);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error, count } = await supabase
        .from('equipamentos')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as unknown as Equipamento[];
      setEquipamentos(rows);
      setTotal(count ?? rows.length);
      setVisibleCount(PAGE_SIZE);
      setHasMore(rows.length > PAGE_SIZE);
    } catch (e: unknown) {
      toast.error('Erro ao carregar equipamentos');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // "Carregar mais" apenas expande o visibleCount — os dados já estão em memória
  const loadMore = useCallback(() => {
    setVisibleCount(prev => {
      const next = prev + PAGE_SIZE;
      setHasMore(next < equipamentos.length);
      return next;
    });
    setIsLoadingMore(false);
  }, [equipamentos.length]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addMutation = useMutation({
    mutationFn: async (equipamento: EquipamentoInsert) => {
      const nupCheck = validateNup(equipamento.nup);
      if (!nupCheck.valid) throw new Error(nupCheck.message);

      const dup = checkDuplicata(equipamentos, equipamento.municipio, equipamento.tipo as string);
      if (dup?.bloquear) throw new Error(dup.message);

      const { data, error } = await supabase
        .from('equipamentos')
        .insert({
          municipio:             equipamento.municipio,
          tipo:                  equipamento.tipo as TipoEquipamento,
          possui_patrulha:       equipamento.possui_patrulha,
          endereco:              equipamento.endereco,
          telefone:              equipamento.telefone,
          responsavel:           equipamento.responsavel,
          observacoes:           equipamento.observacoes,
          kit_athena_entregue:   equipamento.kit_athena_entregue  ?? false,
          kit_athena_previo:     equipamento.kit_athena_previo     ?? false,
          capacitacao_realizada: equipamento.capacitacao_realizada ?? false,
          nup:                   equipamento.nup ?? null,
          qualificacao_id:       equipamento.qualificacao_id || null,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      fetchAll();
      toast.success('Equipamento cadastrado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao cadastrar equipamento: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<EquipamentoInsert> & { id: string }) => {
      if (data.nup !== undefined) {
        const nupCheck = validateNup(data.nup);
        if (!nupCheck.valid) throw new Error(nupCheck.message);
      }

      if (data.municipio !== undefined || data.tipo !== undefined) {
        const atual = equipamentos.find(e => e.id === id);
        const novoMunicipio = data.municipio ?? atual?.municipio ?? '';
        const novoTipo = data.tipo ?? atual?.tipo ?? '';
        const dup = checkDuplicata(equipamentos, novoMunicipio, novoTipo as string, id);
        if (dup?.bloquear) throw new Error(dup.message);
      }

      const updateData: Record<string, unknown> = {};
      if (data.municipio             !== undefined) updateData.municipio             = data.municipio;
      if (data.tipo                  !== undefined) updateData.tipo                  = data.tipo;
      if (data.possui_patrulha       !== undefined) updateData.possui_patrulha       = data.possui_patrulha;
      if (data.endereco              !== undefined) updateData.endereco              = data.endereco;
      if (data.telefone              !== undefined) updateData.telefone              = data.telefone;
      if (data.responsavel           !== undefined) updateData.responsavel           = data.responsavel;
      if (data.observacoes           !== undefined) updateData.observacoes           = data.observacoes;
      if (data.kit_athena_entregue   !== undefined) updateData.kit_athena_entregue   = data.kit_athena_entregue;
      if (data.kit_athena_previo     !== undefined) updateData.kit_athena_previo     = data.kit_athena_previo;
      if (data.capacitacao_realizada !== undefined) updateData.capacitacao_realizada = data.capacitacao_realizada;
      if (data.nup                   !== undefined) updateData.nup                   = data.nup ?? null;
      if (data.qualificacao_id       !== undefined) updateData.qualificacao_id       = data.qualificacao_id ?? null;

      const { data: updated, error } = await supabase
        .from('equipamentos')
        .update(updateData as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated as unknown as Equipamento;
    },
    onSuccess: (updated) => {
      setEquipamentos(prev => prev.map(e => e.id === updated.id ? updated : e));
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
      return id;
    },
    onSuccess: (id) => {
      setEquipamentos(prev => prev.filter(e => e.id !== id));
      setTotal(prev => prev !== null ? prev - 1 : null);
      toast.success('Equipamento excluido com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao excluir equipamento: ' + error.message);
    },
  });

  return {
    equipamentos,           // array COMPLETO — usado por Dashboard, filtros, exports
    isLoading,
    isLoadingMore,
    hasMore,
    total,
    visibleCount,           // UI de listagem usa equipamentos.slice(0, visibleCount)
    loadMore,
    refetch: fetchAll,
    addEquipamento:    addMutation.mutate,
    updateEquipamento: updateMutation.mutate,
    deleteEquipamento: deleteMutation.mutate,
    isAdding:   addMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}