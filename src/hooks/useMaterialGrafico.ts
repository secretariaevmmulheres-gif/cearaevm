import { useState, useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  MgItem, MgEstoque, MgPedido,
  MgSituacao, MgFormaEntrega, MgTipoItem, MgUnidade,
} from '@/types';
import { toast } from 'sonner';

// ── Tipos de payload ──────────────────────────────────────────────────────────

export type MgItemPayload = {
  item_id: string;
  unidade_medida: MgUnidade;
  qtd_solicitada: number;
  qtd_autorizada?: number | null;
};

export type MgPedidoInsert = {
  municipio?: string | null;
  destino_avulso?: string | null;
  nup?: string | null;
  oficio?: string | null;
  data_pedido?: string | null;
  data_entrega?: string | null;
  situacao?: MgSituacao;
  forma_entrega?: MgFormaEntrega | null;
  tipo_pedido?: string | null;
  observacoes?: string | null;
  itens: MgItemPayload[];
};

export type MgPedidoUpdate = Omit<MgPedidoInsert, 'itens'> & {
  id: string;
  itens?: MgItemPayload[];
};

// Tipo alinhado com o Insert do Supabase
type MgPedidoRow = {
  municipio?: string | null;
  destino_avulso?: string | null;
  nup?: string | null;
  oficio?: string | null;
  data_pedido?: string | null;
  data_entrega?: string | null;
  situacao?: string;
  forma_entrega?: string | null;
  tipo_pedido?: string | null;
  observacoes?: string | null;
  estoque_abatido?: boolean;
};

// ── Hook principal ────────────────────────────────────────────────────────────

export function useMaterialGrafico() {
  const [itens,     setItens]     = useState<MgItem[]>([]);
  const [estoque,   setEstoque]   = useState<MgEstoque[]>([]);
  const [pedidos,   setPedidos]   = useState<MgPedido[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [resItens, resEstoque, resPedidos] = await Promise.all([
        supabase.from('mg_itens').select('*').eq('ativo', true).order('tipo').order('campanha'),
        supabase.from('mg_estoque').select('*').order('local'),
        supabase.from('mg_pedidos')
          .select('*, itens:mg_itens_pedido(*, item:mg_itens(*))')
          .order('created_at', { ascending: false }),
      ]);
      if (resItens.error)   throw resItens.error;
      if (resEstoque.error) throw resEstoque.error;
      if (resPedidos.error) throw resPedidos.error;
      setItens(   (resItens.data   ?? []) as unknown as MgItem[]);
      setEstoque( (resEstoque.data ?? []) as unknown as MgEstoque[]);
      setPedidos( (resPedidos.data ?? []) as unknown as MgPedido[]);
    } catch (e) {
      toast.error('Erro ao carregar material gráfico');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Estoque derivado ────────────────────────────────────────────────────────

  /** Caixas em um local específico */
  const caixasPorLocal = useCallback((itemId: string, local: string): number =>
    estoque.find(e => e.item_id === itemId && e.local === local)?.caixas ?? 0,
  [estoque]);

  /** Unidades avulsas em um local específico */
  const unidadesPorLocal = useCallback((itemId: string, local: string): number =>
    estoque.find(e => e.item_id === itemId && e.local === local)?.unidades_avulsas ?? 0,
  [estoque]);

  /** Total de caixas (todos os locais) */
  const totalCaixas = useCallback((itemId: string): number =>
    estoque.filter(e => e.item_id === itemId).reduce((s, e) => s + e.caixas, 0),
  [estoque]);

  /** Total de unidades avulsas (todos os locais) */
  const totalUnidades = useCallback((itemId: string): number =>
    estoque.filter(e => e.item_id === itemId).reduce((s, e) => s + e.unidades_avulsas, 0),
  [estoque]);

  /** Total distribuído em caixas (pedidos Atendidos em 'caixas') */
  const totalDistribuidoCaixas = useCallback((itemId: string): number =>
    pedidos
      .filter(p => p.situacao === 'Atendido')
      .flatMap(p => p.itens ?? [])
      .filter(ip => ip.item_id === itemId && ip.unidade_medida === 'caixas')
      .reduce((s, ip) => s + (ip.qtd_autorizada ?? ip.qtd_solicitada ?? 0), 0),
  [pedidos]);

  /** Total distribuído em unidades (pedidos Atendidos em 'unidades') */
  const totalDistribuidoUnidades = useCallback((itemId: string): number =>
    pedidos
      .filter(p => p.situacao === 'Atendido')
      .flatMap(p => p.itens ?? [])
      .filter(ip => ip.item_id === itemId && ip.unidade_medida === 'unidades')
      .reduce((s, ip) => s + (ip.qtd_autorizada ?? ip.qtd_solicitada ?? 0), 0),
  [pedidos]);

  // ── Adicionar pedido ────────────────────────────────────────────────────────

  const addMutation = useMutation({
    mutationFn: async (payload: MgPedidoInsert): Promise<MgPedido> => {
      if (!payload.municipio && !payload.destino_avulso)
        throw new Error('Informe o município ou destino do pedido');

      const { itens: itensPayload, ...rest } = payload;
      const insertData: MgPedidoRow = {
        situacao:       rest.situacao       ?? 'Aguardando',
        municipio:      rest.municipio      ?? null,
        destino_avulso: rest.destino_avulso ?? null,
        nup:            rest.nup            ?? null,
        oficio:         rest.oficio         ?? null,
        data_pedido:    rest.data_pedido    ?? null,
        data_entrega:   rest.data_entrega   ?? null,
        forma_entrega:  rest.forma_entrega  ?? null,
        tipo_pedido:    rest.tipo_pedido    ?? null,
        observacoes:    rest.observacoes    ?? null,
      };

      const { data: pedido, error: pedidoErr } = await supabase
        .from('mg_pedidos').insert(insertData).select().single();
      if (pedidoErr) throw pedidoErr;

      if (itensPayload?.length) {
        const { error: itensErr } = await supabase.from('mg_itens_pedido').insert(
          itensPayload.map(i => ({
            pedido_id:      pedido.id,
            item_id:        i.item_id,
            unidade_medida: i.unidade_medida,
            qtd_solicitada: i.qtd_solicitada,
            qtd_autorizada: i.qtd_autorizada ?? null,
          }))
        );
        if (itensErr) throw itensErr;
      }
      return pedido as unknown as MgPedido;
    },
    onSuccess: () => { fetchAll(); toast.success('Pedido cadastrado!'); },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  // ── Atualizar pedido ────────────────────────────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: async ({ id, itens: itensPayload, ...rest }: MgPedidoUpdate) => {
      const upd: MgPedidoRow = {};
      if (rest.situacao      !== undefined) upd.situacao      = rest.situacao;
      if (rest.municipio     !== undefined) upd.municipio     = rest.municipio;
      if (rest.destino_avulso !== undefined) upd.destino_avulso = rest.destino_avulso;
      if (rest.nup           !== undefined) upd.nup           = rest.nup;
      if (rest.oficio        !== undefined) upd.oficio        = rest.oficio;
      if (rest.data_pedido   !== undefined) upd.data_pedido   = rest.data_pedido;
      if (rest.data_entrega  !== undefined) upd.data_entrega  = rest.data_entrega;
      if (rest.forma_entrega !== undefined) upd.forma_entrega = rest.forma_entrega;
      if (rest.tipo_pedido   !== undefined) upd.tipo_pedido   = rest.tipo_pedido;
      if (rest.observacoes   !== undefined) upd.observacoes   = rest.observacoes;

      const { error } = await supabase.from('mg_pedidos').update(upd).eq('id', id);
      if (error) throw error;

      if (itensPayload !== undefined) {
        await supabase.from('mg_itens_pedido').delete().eq('pedido_id', id);
        if (itensPayload.length) {
          const { error: ie } = await supabase.from('mg_itens_pedido').insert(
            itensPayload.map(i => ({
              pedido_id:      id,
              item_id:        i.item_id,
              unidade_medida: i.unidade_medida,
              qtd_solicitada: i.qtd_solicitada,
              qtd_autorizada: i.qtd_autorizada ?? null,
            }))
          );
          if (ie) throw ie;
        }
      }
    },
    onSuccess: () => { fetchAll(); toast.success('Pedido atualizado!'); },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  // ── Deletar pedido ──────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('mg_pedidos').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      setPedidos(prev => prev.filter(p => p.id !== id));
      fetchAll();
      toast.success('Pedido removido.');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  // ── Atualizar estoque ───────────────────────────────────────────────────────

  const updateEstoqueMutation = useMutation({
    mutationFn: async ({
      item_id, local, caixas, unidades_avulsas,
    }: {
      item_id: string;
      local: string;
      caixas: number;
      unidades_avulsas: number;
    }) => {
      // Castelão nunca tem unidades avulsas — garante no cliente também
      const avulsas = local === 'Castelão' ? 0 : unidades_avulsas;
      const { error } = await supabase
        .from('mg_estoque')
        .upsert({ item_id, local, caixas, unidades_avulsas: avulsas }, { onConflict: 'item_id,local' });
      if (error) throw error;
    },
    onSuccess: () => { fetchAll(); toast.success('Estoque atualizado!'); },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  // ── Transferir caixas Castelão → SEM ─────────────────────────────────────────

  const transferirMutation = useMutation({
    mutationFn: async ({ item_id, caixas }: { item_id: string; caixas: number }) => {
      const { data, error } = await supabase.rpc('mg_transferir', {
        p_item_id: item_id,
        p_caixas:  caixas,
      });
      if (error) throw error;
      const result = data as { ok: boolean; erro?: string; caixas_movidas?: number };
      if (!result.ok) throw new Error(result.erro ?? 'Erro na transferência');
      return result;
    },
    onSuccess: (result) => {
      fetchAll();
      toast.success(`${result.caixas_movidas} cx movidas do Castelão para a SEM!`);
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  return {
    itens, estoque, pedidos, isLoading,
    refetch: fetchAll,
    // estoque derivado
    caixasPorLocal, unidadesPorLocal,
    totalCaixas, totalUnidades,
    totalDistribuidoCaixas, totalDistribuidoUnidades,
    // mutations
    addPedido:         addMutation.mutate,
    updatePedido:      updateMutation.mutate,
    deletePedido:      deleteMutation.mutate,
    updateEstoque:     updateEstoqueMutation.mutate,
    isAdding:          addMutation.isPending,
    isUpdating:        updateMutation.isPending,
    isDeleting:        deleteMutation.isPending,
    isUpdatingEstoque: updateEstoqueMutation.isPending,
    transferirParaSEM: transferirMutation.mutate,
    isTransferindo:    transferirMutation.isPending,
  };
}

// ── Constantes ────────────────────────────────────────────────────────────────

export const MG_SITUACAO_CORES: Record<MgSituacao, string> = {
  'Aguardando':   'bg-amber-500/10 text-amber-700 border-amber-500/20',
  'Em separação': 'bg-blue-500/10  text-blue-700  border-blue-500/20',
  'Atendido':     'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  'Cancelado':    'bg-rose-500/10  text-rose-700  border-rose-500/20',
};

export const MG_TIPO_CORES: Record<MgTipoItem, string> = {
  Folder:    'bg-violet-500/10 text-violet-700',
  Panfleto:  'bg-sky-500/10    text-sky-700',
  Ventarola: 'bg-teal-500/10   text-teal-700',
  Bottom:    'bg-orange-500/10 text-orange-700',
  Cartaz:    'bg-pink-500/10   text-pink-700',
  Outro:     'bg-muted         text-muted-foreground',
};

export const MG_TIPOS: MgTipoItem[]            = ['Folder','Panfleto','Ventarola','Bottom','Cartaz','Outro'];
export const MG_SITUACOES: MgSituacao[]        = ['Aguardando','Em separação','Atendido','Cancelado'];
export const MG_FORMAS_ENTREGA: MgFormaEntrega[] = ['Entregue','Retirada'];
export const MG_UNIDADES: MgUnidade[]          = ['caixas','unidades'];