import { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useHistoricoRecente, getCampoLabel, HistoricoAlteracao } from '@/hooks/useHistorico';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  History, Plus, Pencil, Trash2, Loader2, AlertCircle,
  Search, Filter, Building2, CalendarDays, FileText, RefreshCw,
  ChevronDown, GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ── Configurações visuais ─────────────────────────────────────────────────────
const ACAO_CONFIG = {
  INSERT: { label: 'Criação',  icon: Plus,   bg: 'bg-emerald-500/10', text: 'text-emerald-700', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
  UPDATE: { label: 'Edição',   icon: Pencil, bg: 'bg-blue-500/10',    text: 'text-blue-700',    border: 'border-blue-500/20',    dot: 'bg-blue-500'    },
  DELETE: { label: 'Exclusão', icon: Trash2, bg: 'bg-rose-500/10',    text: 'text-rose-700',    border: 'border-rose-500/20',    dot: 'bg-rose-500'    },
};

const TABELA_CONFIG = {
  equipamentos: { label: 'Equipamento',  icon: Building2,    bg: 'bg-teal-500/10',    text: 'text-teal-700'    },
  solicitacoes: { label: 'Solicitação',  icon: FileText,     bg: 'bg-violet-500/10',  text: 'text-violet-700'  },
  atividades:   { label: 'Atividade',    icon: CalendarDays, bg: 'bg-orange-500/10',  text: 'text-orange-700'  },
  qualificacoes:{ label: 'Qualificação', icon: GraduationCap, bg: 'bg-emerald-500/10', text: 'text-emerald-700' },
};

// ── Formatação de valor ───────────────────────────────────────────────────────
function formatValor(v: string | null): string {
  if (v === null || v === undefined) return '—';
  if (v === 'true')  return 'Sim';
  if (v === 'false') return 'Não';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    try { return new Date(v + 'T00:00:00').toLocaleDateString('pt-BR'); } catch { /**/ }
  }
  if (v.startsWith('{')) {
    try {
      const obj = JSON.parse(v);
      const parts = [obj.municipio, obj.tipo ?? obj.tipo_equipamento].filter(Boolean);
      return parts.length > 0 ? parts.join(' — ') : v.slice(0, 60);
    } catch { return v.slice(0, 60); }
  }
  return v.length > 80 ? v.slice(0, 80) + '…' : v;
}

// ── Linha de evento ───────────────────────────────────────────────────────────
function EventoLinha({ item, delay }: { item: HistoricoAlteracao; delay: number }) {
  const acao       = ACAO_CONFIG[item.acao] ?? ACAO_CONFIG.UPDATE;
  const tabela     = TABELA_CONFIG[item.tabela] ?? TABELA_CONFIG.equipamentos;
  const AcaoIcon   = acao.icon;
  const TabelaIcon = tabela.icon;
  const date       = new Date(item.created_at);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(delay, 0.3) }} // limita delay p/ evitar lentidão com muitos itens
      className="flex gap-4 py-4 border-b border-border/40 last:border-0"
    >
      {/* Ícone da ação */}
      <div className={cn(
        'w-9 h-9 rounded-full flex items-center justify-center shrink-0 border',
        acao.bg, acao.border
      )}>
        <AcaoIcon className={cn('w-4 h-4', acao.text)} />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        {/* Linha 1: ação + módulo + município */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border', acao.bg, acao.text, acao.border)}>
            {acao.label}
          </span>
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', tabela.bg, tabela.text)}>
            <TabelaIcon className="w-3 h-3 inline mr-1" />
            {tabela.label}
          </span>
          {item.municipio && (
            <span className="text-xs font-semibold text-foreground">{item.municipio}</span>
          )}
        </div>

        {/* Linha 2: campo alterado + valores */}
        {item.acao === 'UPDATE' && item.campo && (
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-sm font-medium text-foreground">
              {getCampoLabel(item.campo)}
            </span>
            {item.valor_antes !== null && (
              <span className="text-xs line-through text-muted-foreground bg-rose-500/5 border border-rose-500/10 px-1.5 py-0.5 rounded max-w-[160px] truncate">
                {formatValor(item.valor_antes)}
              </span>
            )}
            {item.valor_antes !== null && item.valor_depois !== null && (
              <span className="text-xs text-muted-foreground">→</span>
            )}
            {item.valor_depois !== null && (
              <span className="text-xs text-emerald-700 bg-emerald-500/5 border border-emerald-500/10 px-1.5 py-0.5 rounded max-w-[160px] truncate">
                {formatValor(item.valor_depois)}
              </span>
            )}
          </div>
        )}

        {(item.acao === 'INSERT' || item.acao === 'DELETE') && (item.valor_antes || item.valor_depois) ? (
          <p className="text-xs text-muted-foreground mt-1">
            {item.acao === 'INSERT' ? 'Registro criado' : 'Registro excluído'}
            {item.municipio ? ` em ${item.municipio}` : ''}
          </p>
        ) : null}

        {/* Linha 3: usuário + data */}
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-xs text-muted-foreground font-medium">
            {item.usuario_email ?? 'Usuário desconhecido'}
          </span>
          <span className="text-xs text-muted-foreground/60">·</span>
          <span className="text-xs text-muted-foreground/60">
            {format(date, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>
      </div>

      {/* Data compacta (desktop) */}
      <div className="hidden sm:flex flex-col items-end shrink-0 pt-0.5">
        <span className="text-xs font-medium text-muted-foreground">
          {format(date, 'dd/MM/yy', { locale: ptBR })}
        </span>
        <span className="text-xs text-muted-foreground/60">
          {format(date, 'HH:mm', { locale: ptBR })}
        </span>
      </div>
    </motion.div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Historico() {
  const [filtroTabela,  setFiltroTabela]  = useState<string>('');
  const [filtroAcao,    setFiltroAcao]    = useState<string>('');
  const [filtroCampo,   setFiltroCampo]   = useState<string>('');
  const [filtroUsuario, setFiltroUsuario] = useState<string>('');
  const [busca,         setBusca]         = useState('');

  // Item 11 — paginação cursor-based
  const {
    historico,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    total,
    refetch,
    loadMore,
  } = useHistoricoRecente(50, filtroTabela || undefined);

  // Sentinel para infinite scroll automático
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && hasMore && !isLoadingMore) loadMore(); },
      { rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMore]);

  // Filtros locais (ação + busca — sem re-fetch, só filtram o que já veio)
  const filtrado = useMemo(() => {
    let list = historico;
    if (filtroAcao)    list = list.filter(h => h.acao === filtroAcao);
    if (filtroCampo)   list = list.filter(h => h.campo === filtroCampo);
    if (filtroUsuario) list = list.filter(h => (h.usuario_email ?? '').toLowerCase().includes(filtroUsuario.toLowerCase()));
    if (busca) {
      const q = busca.toLowerCase();
      list = list.filter(h =>
        (h.municipio      ?? '').toLowerCase().includes(q) ||
        (h.usuario_email  ?? '').toLowerCase().includes(q) ||
        (h.campo          ?? '').toLowerCase().includes(q) ||
        (h.valor_antes    ?? '').toLowerCase().includes(q) ||
        (h.valor_depois   ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [historico, filtroAcao, filtroCampo, filtroUsuario, busca]);

  // Contadores por ação (sobre o total já carregado)
  const contadores = useMemo(() => ({
    INSERT: historico.filter(h => h.acao === 'INSERT').length,
    UPDATE: historico.filter(h => h.acao === 'UPDATE').length,
    DELETE: historico.filter(h => h.acao === 'DELETE').length,
  }), [historico]);

  // Listas únicas para os selects de filtro
  const camposUnicos = useMemo(() =>
    Array.from(new Set(historico.map(h => h.campo).filter(Boolean))).sort() as string[],
    [historico]
  );
  const usuariosUnicos = useMemo(() =>
    Array.from(new Set(historico.map(h => h.usuario_email).filter(Boolean))).sort() as string[],
    [historico]
  );

  const temFiltro = filtroAcao || filtroTabela || filtroCampo || filtroUsuario || busca;

  return (
    <AppLayout>
      <div className="flex items-start justify-between gap-4 mb-6">
        <PageHeader
          title="Histórico de Alterações"
          description="Registro completo de todas as criações, edições e exclusões no sistema"
        />
        <Button variant="outline" size="sm" onClick={refetch} className="gap-2 shrink-0">
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {/* Cards de contagem */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {(([
          { acao: 'INSERT', label: 'Criações',  ...ACAO_CONFIG.INSERT },
          { acao: 'UPDATE', label: 'Edições',   ...ACAO_CONFIG.UPDATE },
          { acao: 'DELETE', label: 'Exclusões', ...ACAO_CONFIG.DELETE },
        ]) as const).map(({ acao, label, bg, text, border, dot }) => (
          <button
            key={acao}
            onClick={() => setFiltroAcao(filtroAcao === acao ? '' : acao)}
            className={cn(
              'rounded-xl border p-4 text-left transition-all',
              filtroAcao === acao
                ? cn(bg, border, 'ring-2 ring-offset-1', border.replace('border-', 'ring-'))
                : 'bg-card border-border hover:border-primary/30'
            )}
          >
            <div className={cn('w-2 h-2 rounded-full mb-2', dot)} />
            <p className={cn('text-2xl font-bold', text)}>{contadores[acao]}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por município, usuário, campo..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={filtroTabela}
          onChange={e => setFiltroTabela(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Todos os módulos</option>
          <option value="equipamentos">Equipamentos</option>
          <option value="solicitacoes">Solicitações</option>
          <option value="atividades">Atividades</option>
          <option value="qualificacoes">Qualificações</option>
        </select>
        <select
          value={filtroCampo}
          onChange={e => setFiltroCampo(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Todos os campos</option>
          {camposUnicos.map(c => (
            <option key={c} value={c}>{getCampoLabel(c)}</option>
          ))}
        </select>
        <select
          value={filtroUsuario}
          onChange={e => setFiltroUsuario(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 max-w-48"
        >
          <option value="">Todos os usuários</option>
          {usuariosUnicos.map(u => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        {temFiltro && (
          <Button
            variant="ghost" size="sm"
            onClick={() => { setFiltroAcao(''); setFiltroTabela(''); setFiltroCampo(''); setFiltroUsuario(''); setBusca(''); }}
            className="gap-1.5 text-muted-foreground shrink-0"
          >
            <Filter className="w-3.5 h-3.5" />
            Limpar
          </Button>
        )}
      </div>

      {/* Lista */}
      <div className="bg-card rounded-2xl border border-border shadow-sm px-6 py-2">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Carregando histórico...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 py-8 text-rose-600 justify-center">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {!isLoading && !error && filtrado.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <History className="w-10 h-10 opacity-20" />
            <p className="text-sm">
              {historico.length === 0
                ? 'Nenhuma alteração registrada ainda.'
                : 'Nenhum resultado para os filtros aplicados.'}
            </p>
          </div>
        )}

        {!isLoading && !error && filtrado.map((item, i) => (
          <EventoLinha key={item.id} item={item} delay={i * 0.02} />
        ))}

        {/* Sentinel para scroll infinito */}
        <div ref={sentinelRef} />

        {/* Loading more */}
        {isLoadingMore && (
          <div className="flex items-center justify-center gap-2 py-6">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Carregando mais registros...</span>
          </div>
        )}

        {/* Botão manual "Carregar mais" (fallback se scroll não disparar) */}
        {!isLoading && !isLoadingMore && hasMore && !temFiltro && (
          <div className="flex justify-center py-4">
            <Button variant="ghost" size="sm" onClick={loadMore} className="gap-2 text-muted-foreground">
              <ChevronDown className="w-4 h-4" />
              Carregar mais
            </Button>
          </div>
        )}
      </div>

      {/* Rodapé com contagem */}
      {!isLoading && historico.length > 0 && (
        <p className="text-xs text-muted-foreground text-center mt-4">
          {temFiltro
            ? `${filtrado.length} resultado${filtrado.length !== 1 ? 's' : ''} (de ${historico.length} carregados)`
            : `${historico.length} registros carregados${total !== null && total > historico.length ? ` de ${total} no total` : ''}`
          }
          {hasMore && !temFiltro && (
            <span className="text-muted-foreground/50"> · role para ver mais</span>
          )}
        </p>
      )}
    </AppLayout>
  );
}