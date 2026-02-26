import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ── Tipos ─────────────────────────────────────────────────────────────────────
export interface HistoricoAlteracao {
  id: string;
  tabela: 'equipamentos' | 'solicitacoes' | 'atividades';
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
};

export function getCampoLabel(campo: string | null): string {
  if (!campo) return '—';
  return CAMPO_LABELS[campo] ?? campo;
}

// ── Hook principal ────────────────────────────────────────────────────────────
export function useHistorico(registroId?: string, tabela?: string) {
  const [historico, setHistorico]   = useState<HistoricoAlteracao[]>([]);
  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState<string | null>(null);

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
      const msg = e instanceof Error ? e.message : 'Erro ao carregar histórico';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [registroId, tabela]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { historico, isLoading, error, refetch: fetchData };
}

// ── Hook para histórico geral (feed recente) ──────────────────────────────────
export function useHistoricoRecente(limit = 50, filtroTabela?: string) {
  const [historico, setHistorico]   = useState<HistoricoAlteracao[]>([]);
  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let query = db
        .from('historico_alteracoes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (filtroTabela) query = query.eq('tabela', filtroTabela);

      const { data, error: err } = await query;
      if (err) throw err;
      setHistorico((data ?? []) as HistoricoAlteracao[]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar histórico';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [limit, filtroTabela]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { historico, isLoading, error, refetch: fetchData };
}