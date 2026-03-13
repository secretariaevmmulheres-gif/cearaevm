import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ── Tipos ─────────────────────────────────────────────────────────────────────
export interface HistoricoAlteracao {
  id: string;
  tabela: 'equipamentos' | 'solicitacoes' | 'atividades' | 'qualificacoes';
  registro_id: string;
  acao: 'INSERT' | 'UPDATE' | 'DELETE';
  campo: string | null;
  valor_antes: string | null;
  valor_depois: string | null;
  usuario_email: string | null;
  municipio: string | null;
  created_at: string;
}

// Alias sem tipagem para acessar tabela não presente nos tipos gerados
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// Labels legíveis para campos técnicos
const CAMPO_LABELS: Record<string, string> = {
  municipio:                    'Município',
  tipo:                         'Tipo',
  tipo_equipamento:             'Tipo de Equipamento',
  possui_patrulha:              'Patrulha M.P.',
  endereco:                     'Endereço',
  telefone:                     'Telefone',
  responsavel:                  'Responsável',
  observacoes:                  'Observações',
  status:                       'Status',
  data_solicitacao:             'Data de Solicitação',
  suite_implantada:             'NUP',
  recebeu_patrulha:             'Recebeu Patrulha',
  kit_athena_entregue:          'Kit Athena',
  capacitacao_realizada:        'Capacitação',
  guarda_municipal_estruturada: 'Guarda Municipal',
  data:                         'Data',
  recurso:                      'Recurso',
  atendimentos:                 'Atendimentos',
  nome_evento:                  'Nome do Evento',
  nup:                          'NUP',
  quantidade_equipe:            'Qtd. Equipe',
  // Qualificações
  nome:                         'Nome do Curso',
  ministrante:                  'Ministrante / Órgão',
  total_pessoas:                'Total de Pessoas',
  municipios:                   'Municípios do Curso',
  municipio_pessoas:            'Pessoas por Município',
};

export function getCampoLabel(campo: string | null): string {
  if (!campo) return '—';
  return CAMPO_LABELS[campo] ?? campo;
}

// ── Hook para histórico de um registro específico ─────────────────────────────
export function useHistorico(registroId?: string, tabela?: string) {
  const [historico, setHistorico] = useState<HistoricoAlteracao[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!registroId) { setHistorico([]); return; }
    setIsLoading(true);
    setError(null);
    try {
      let query = db
        .from('historico_alteracoes')
        .select('*')
        .eq('registro_id', registroId)
        .order('created_at', { ascending: false });

      if (tabela) query = query.eq('tabela', tabela);

      const { data, error: err } = await query;
      if (err) throw err;
      setHistorico((data ?? []) as HistoricoAlteracao[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar histórico');
    } finally {
      setIsLoading(false);
    }
  }, [registroId, tabela]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { historico, isLoading, error, refetch: fetchData };
}

// ── Item 11: paginação cursor-based ──────────────────────────────────────────
// Estratégia: cursor = created_at do último item carregado.
// Cada página usa `.lt('created_at', cursor)` para buscar registros anteriores.
// Isso evita offset e é eficiente mesmo com milhares de registros.

const PAGE_SIZE = 50;

export interface UseHistoricoRecenteResult {
  historico: HistoricoAlteracao[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  total: number | null;
  refetch: () => void;
  loadMore: () => void;
}

export function useHistoricoRecente(
  _limit = 50,             // mantido por compatibilidade, não usado internamente
  filtroTabela?: string
): UseHistoricoRecenteResult {
  const [historico,     setHistorico]     = useState<HistoricoAlteracao[]>([]);
  const [isLoading,     setIsLoading]     = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [cursor,        setCursor]        = useState<string | null>(null);   // created_at do último item
  const [hasMore,       setHasMore]       = useState(true);
  const [total,         setTotal]         = useState<number | null>(null);

  // ── Carrega a primeira página + total ──────────────────────────────────────
  const fetchFirst = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setHasMore(true);
    setCursor(null);

    try {
      // Query de contagem total (respeita filtro de tabela)
      let countQuery = db
        .from('historico_alteracoes')
        .select('*', { count: 'exact', head: true });
      if (filtroTabela) countQuery = countQuery.eq('tabela', filtroTabela);
      const { count } = await countQuery;
      setTotal(count ?? null);

      // Primeira página
      let query = db
        .from('historico_alteracoes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (filtroTabela) query = query.eq('tabela', filtroTabela);

      const { data, error: err } = await query;
      if (err) throw err;

      const rows = (data ?? []) as HistoricoAlteracao[];
      setHistorico(rows);
      setHasMore(rows.length === PAGE_SIZE);
      setCursor(rows.length > 0 ? rows[rows.length - 1].created_at : null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar histórico');
    } finally {
      setIsLoading(false);
    }
  }, [filtroTabela]);

  // ── Carrega próxima página via cursor ─────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (!cursor || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    try {
      let query = db
        .from('historico_alteracoes')
        .select('*')
        .order('created_at', { ascending: false })
        .lt('created_at', cursor)          // cursor-based: pega registros mais antigos
        .limit(PAGE_SIZE);
      if (filtroTabela) query = query.eq('tabela', filtroTabela);

      const { data, error: err } = await query;
      if (err) throw err;

      const rows = (data ?? []) as HistoricoAlteracao[];
      setHistorico(prev => [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
      setCursor(rows.length > 0 ? rows[rows.length - 1].created_at : null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar mais registros');
    } finally {
      setIsLoadingMore(false);
    }
  }, [cursor, filtroTabela, hasMore, isLoadingMore]);

  // Re-busca quando filtro muda
  useEffect(() => { fetchFirst(); }, [fetchFirst]);

  return {
    historico,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    total,
    refetch: fetchFirst,
    loadMore,
  };
}