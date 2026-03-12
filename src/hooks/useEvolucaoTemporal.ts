/**
 * useEvolucaoTemporal
 *
 * Dados analíticos para os 3 gráficos de evolução temporal do Dashboard.
 *
 * Fonte de cada dado:
 *  1. Inaugurações por mês   — solicitações com status='Inaugurada', pela data_solicitacao
 *                              (data_solicitacao é a data real do evento, não do cadastro)
 *  2. Cobertura Kit Athena   — historico_alteracoes: UPDATE kit_athena_entregue → 'true'
 *  3. Solicitações abertas   — todas as solicitações, pela data_solicitacao
 *     Resolvidas             — solicitações com status='Inaugurada', pela data_solicitacao
 *
 * Não usamos created_at das tabelas principais porque os registros podem ter sido
 * cadastrados em massa muito depois das datas reais.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface PontoMensal {
  month: string;            // "Jan/24"
  monthKey: string;         // "2024-01" — para ordenação
  inauguracoes: number;     // inaugurações neste mês (solicitações Inauguradas)
  kitAthenaMes: number;     // kits entregues neste mês (histórico)
  kitAthena: number;        // acumulado Kit Athena até este mês
  solicAbertasMes: number;  // solicitações abertas neste mês (pela data_solicitacao)
  solicResolvMes: number;   // solicitações inauguradas neste mês
  solicAbertas: number;     // backlog acumulado (abertas - inauguradas)
}

export interface EvolucaoTemporalResult {
  data: PontoMensal[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useEvolucaoTemporal(anoFiltro?: number): EvolucaoTemporalResult {
  const [data,      setData]      = useState<PontoMensal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // ── 1. Solicitações: data_solicitacao para quando foram abertas ────────
      const { data: solics, error: errSolics } = await db
        .from('solicitacoes')
        .select('data_solicitacao, status, id');
      if (errSolics) throw errSolics;

      // ── 2. Histórico: quando cada solicitação virou 'Inaugurada' ──────────
      // created_at aqui = data real em que o status foi alterado para Inaugurada
      const { data: histInauguradas, error: errInauguradas } = await db
        .from('historico_alteracoes')
        .select('created_at, registro_id')
        .eq('tabela', 'solicitacoes')
        .eq('campo', 'status')
        .eq('valor_depois', 'Inaugurada');
      if (errInauguradas) throw errInauguradas;

      // Monta Set de ids que têm registro no histórico de inauguração
      const inauguradaNoHistorico = new Map<string, string>(); // id → created_at
      for (const h of (histInauguradas ?? [])) {
        inauguradaNoHistorico.set(h.registro_id, h.created_at);
      }

      // ── 3. Histórico: Kit Athena (UPDATE → 'true') ────────────────────────
      const { data: histKit, error: errHist } = await db
        .from('historico_alteracoes')
        .select('created_at')
        .eq('tabela', 'equipamentos')
        .eq('acao', 'UPDATE')
        .eq('campo', 'kit_athena_entregue')
        .eq('valor_depois', 'true');
      if (errHist) throw errHist;

      // ── Agrega por mês ────────────────────────────────────────────────────
      type MesData = {
        inauguracoes: number;
        kitAthenaMes: number;
        solicAbertasMes: number;
        solicResolvMes: number;
      };
      const monthly = new Map<string, MesData>();
      const get = (key: string): MesData => {
        if (!monthly.has(key))
          monthly.set(key, { inauguracoes: 0, kitAthenaMes: 0, solicAbertasMes: 0, solicResolvMes: 0 });
        return monthly.get(key)!;
      };

      for (const s of (solics ?? [])) {
        // Solicitação aberta: conta pela data_solicitacao
        const keyAberta = format(parseISO(s.data_solicitacao), 'yyyy-MM');
        get(keyAberta).solicAbertasMes++;

        if (s.status === 'Inaugurada') {
          // Inauguração: usa o created_at do histórico (quando o status mudou)
          // Se não tiver no histórico (cadastrada já como Inaugurada), usa data_solicitacao
          const dataInauguracao = inauguradaNoHistorico.get(s.id) ?? s.data_solicitacao;
          const keyInaug = format(parseISO(dataInauguracao), 'yyyy-MM');
          get(keyInaug).inauguracoes++;
          get(keyInaug).solicResolvMes++;
        }
      }

      for (const h of (histKit ?? [])) {
        get(format(parseISO(h.created_at), 'yyyy-MM')).kitAthenaMes++;
      }

      // ── Ordena e calcula acumulados ────────────────────────────────────────
      const sorted = Array.from(monthly.entries()).sort(([a], [b]) => a.localeCompare(b));
      let accKit = 0;
      let accBacklog = 0;

      const points: PontoMensal[] = sorted.map(([key, m]) => {
        accKit     += m.kitAthenaMes;
        accBacklog += m.solicAbertasMes - m.solicResolvMes;
        return {
          month:           format(parseISO(`${key}-01`), 'MMM/yy', { locale: ptBR }),
          monthKey:        key,
          inauguracoes:    m.inauguracoes,
          kitAthenaMes:    m.kitAthenaMes,
          kitAthena:       accKit,
          solicAbertasMes: m.solicAbertasMes,
          solicResolvMes:  m.solicResolvMes,
          solicAbertas:    Math.max(0, accBacklog),
        };
      });

      // ── Aplica filtro de ano se especificado ──────────────────────────────
      const pointsFiltrados = anoFiltro
        ? points.filter(p => p.monthKey.startsWith(String(anoFiltro)))
        : points;

      setData(pointsFiltrados);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar evolução temporal');
    } finally {
      setIsLoading(false);
    }
  }, [anoFiltro]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}