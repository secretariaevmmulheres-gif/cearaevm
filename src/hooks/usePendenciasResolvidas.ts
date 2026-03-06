import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

export interface PendenciaResolvida {
  id: string;
  chave: string;
  municipio: string;
  tipo: string;
  origem: string;
  pendencia: string;
  resolvido_por: string | null;
  resolvido_email: string | null;
  created_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function usePendenciasResolvidas() {
  const { user } = useAuthContext();
  const [resolvidos,  setResolvidos]  = useState<PendenciaResolvida[]>([]);
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Chave composta: identifica unicamente um item+pendência
  const buildChave = (municipio: string, tipo: string, origem: string) =>
    `${municipio}|${tipo}|${origem}`;

  // Conjunto de chaves+pendência para lookup O(1)
  const resolvidosSet = new Set(
    resolvidos.map(r => `${r.chave}||${r.pendencia}`)
  );

  const isResolvido = (municipio: string, tipo: string, origem: string, pendencia: string) =>
    resolvidosSet.has(`${buildChave(municipio, tipo, origem)}||${pendencia}`);

  // ── Carrega todos os resolvidos ───────────────────────────────────────────
  const fetchResolvidos = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: err } = await db
        .from('pendencias_resolvidas')
        .select('*')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setResolvidos((data ?? []) as PendenciaResolvida[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar resolvidos');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchResolvidos(); }, [fetchResolvidos]);

  // ── Marcar como resolvido ─────────────────────────────────────────────────
  const marcarResolvido = useCallback(async (
    municipio: string,
    tipo: string,
    origem: string,
    pendencia: string
  ) => {
    const chave = buildChave(municipio, tipo, origem);
    try {
      const { data, error: err } = await db
        .from('pendencias_resolvidas')
        .insert({
          chave,
          municipio,
          tipo,
          origem,
          pendencia,
          resolvido_por:    user?.id    ?? null,
          resolvido_email:  user?.email ?? null,
        })
        .select()
        .single();
      if (err) throw err;
      setResolvidos(prev => [data as PendenciaResolvida, ...prev]);
    } catch (e: unknown) {
      // Ignora erro de unicidade (já marcado por outro usuário)
      const msg = e instanceof Error ? e.message : '';
      if (!msg.includes('unique')) {
        console.error('Erro ao marcar como resolvido:', msg);
      }
      // Re-fetch para sincronizar
      fetchResolvidos();
    }
  }, [user, fetchResolvidos]);

  // ── Desmarcar resolvido ───────────────────────────────────────────────────
  const desmarcarResolvido = useCallback(async (
    municipio: string,
    tipo: string,
    origem: string,
    pendencia: string
  ) => {
    const chave = buildChave(municipio, tipo, origem);
    try {
      const { error: err } = await db
        .from('pendencias_resolvidas')
        .delete()
        .eq('chave', chave)
        .eq('pendencia', pendencia);
      if (err) throw err;
      setResolvidos(prev =>
        prev.filter(r => !(r.chave === chave && r.pendencia === pendencia))
      );
    } catch (e: unknown) {
      console.error('Erro ao desmarcar resolvido:', e);
      fetchResolvidos();
    }
  }, [fetchResolvidos]);

  // ── Toggle (marcar ou desmarcar) ──────────────────────────────────────────
  const toggleResolvido = useCallback(async (
    municipio: string,
    tipo: string,
    origem: string,
    pendencia: string
  ) => {
    if (isResolvido(municipio, tipo, origem, pendencia)) {
      await desmarcarResolvido(municipio, tipo, origem, pendencia);
    } else {
      await marcarResolvido(municipio, tipo, origem, pendencia);
    }
  }, [isResolvido, marcarResolvido, desmarcarResolvido]);

  // ── Limpar todos os resolvidos ────────────────────────────────────────────
  const limparTodos = useCallback(async () => {
    try {
      const ids = resolvidos.map(r => r.id);
      if (ids.length === 0) return;
      const { error: err } = await db
        .from('pendencias_resolvidas')
        .delete()
        .in('id', ids);
      if (err) throw err;
      setResolvidos([]);
    } catch (e: unknown) {
      console.error('Erro ao limpar resolvidos:', e);
      fetchResolvidos();
    }
  }, [resolvidos, fetchResolvidos]);

  return {
    resolvidos,
    isLoading,
    error,
    isResolvido,
    toggleResolvido,
    limparTodos,
    refetch: fetchResolvidos,
  };
}