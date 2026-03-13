/**
 * HistoricoPanel — painel de histórico de alterações reutilizável.
 * Usado dentro das linhas expandíveis de Solicitações, Equipamentos e Atividades.
 *
 * Props:
 *   registroId — UUID do registro monitorado
 *   tabela     — 'equipamentos' | 'solicitacoes' | 'atividades'
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, ChevronDown, Plus, Pencil, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHistorico, getCampoLabel } from '@/hooks/useHistorico';

// ── Helpers de exibição ───────────────────────────────────────────────────────
function formatValor(v: string | null): string {
  if (v === null || v === undefined) return '—';
  if (v === 'true')  return 'Sim';
  if (v === 'false') return 'Não';
  // Tentar formatar data ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    try { return new Date(v + 'T00:00:00').toLocaleDateString('pt-BR'); } catch { /**/ }
  }
  // JSON de INSERT/DELETE — extrair municipio + tipo para resumo
  if (v.startsWith('{')) {
    try {
      const obj = JSON.parse(v);
      const parts = [obj.municipio, obj.tipo ?? obj.tipo_equipamento].filter(Boolean);
      return parts.length > 0 ? parts.join(' — ') : v.slice(0, 60);
    } catch { return v.slice(0, 60); }
  }
  return v.length > 80 ? v.slice(0, 80) + '…' : v;
}

const ACAO_CONFIG = {
  INSERT: { label: 'Criação',  icon: Plus,   bg: 'bg-emerald-500/10', text: 'text-emerald-700', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
  UPDATE: { label: 'Edição',   icon: Pencil, bg: 'bg-blue-500/10',    text: 'text-blue-700',    border: 'border-blue-500/20',    dot: 'bg-blue-500'    },
  DELETE: { label: 'Exclusão', icon: Trash2, bg: 'bg-rose-500/10',    text: 'text-rose-700',    border: 'border-rose-500/20',    dot: 'bg-rose-500'    },
};

// ── Linha de histórico ────────────────────────────────────────────────────────
function HistoricoLinha({ item }: { item: ReturnType<typeof useHistorico>['historico'][number] }) {
  const cfg  = ACAO_CONFIG[item.acao] ?? ACAO_CONFIG.UPDATE;
  const Icon = cfg.icon;
  const date = new Date(item.created_at);

  return (
    <div className={cn(
      'flex gap-3 py-2.5 border-b border-border/30 last:border-0 items-start'
    )}>
      {/* Ícone */}
      <div className={cn('w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5', cfg.bg, cfg.border, 'border')}>
        <Icon className={cn('w-3 h-3', cfg.text)} />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded-md', cfg.bg, cfg.text)}>
            {cfg.label}
          </span>
          {item.acao === 'UPDATE' && item.campo && (
            <span className="text-xs font-medium text-foreground">
              {getCampoLabel(item.campo)}
            </span>
          )}
          <span className="text-xs text-muted-foreground ml-auto shrink-0">
            {format(date, "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>

        {/* Valores antes/depois (apenas UPDATE) */}
        {item.acao === 'UPDATE' && (item.valor_antes !== null || item.valor_depois !== null) && (
          <div className="flex items-center gap-2 mt-1 text-xs">
            {item.valor_antes !== null && (
              <span className="line-through text-muted-foreground/70 bg-rose-500/5 px-1.5 py-0.5 rounded truncate max-w-[120px]">
                {formatValor(item.valor_antes)}
              </span>
            )}
            {item.valor_antes !== null && item.valor_depois !== null && (
              <span className="text-muted-foreground shrink-0">→</span>
            )}
            {item.valor_depois !== null && (
              <span className="text-emerald-700 bg-emerald-500/5 px-1.5 py-0.5 rounded truncate max-w-[120px]">
                {formatValor(item.valor_depois)}
              </span>
            )}
          </div>
        )}

        {/* Quem fez */}
        {item.usuario_email && (
          <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">
            por {item.usuario_email}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export function HistoricoPanel({
  registroId,
  tabela,
  className,
}: {
  registroId: string;
  tabela: 'equipamentos' | 'solicitacoes' | 'atividades' | 'qualificacoes';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { historico, isLoading, error } = useHistorico(open ? registroId : undefined, tabela);

  const temHistorico = historico.length > 0;

  return (
    <div className={cn('rounded-xl border border-border overflow-hidden', className)}>
      {/* Toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <History className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-semibold text-muted-foreground flex-1">
          Histórico de alterações
        </span>
        {open && !isLoading && temHistorico && (
          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
            {historico.length}
          </span>
        )}
        <ChevronDown className={cn(
          'w-3.5 h-3.5 text-muted-foreground transition-transform duration-200',
          open && 'rotate-180'
        )} />
      </button>

      {/* Conteúdo */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 py-2 max-h-72 overflow-y-auto">
              {isLoading && (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Carregando...</span>
                </div>
              )}
              {error && (
                <div className="flex items-center gap-2 py-3 text-xs text-rose-600">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </div>
              )}
              {!isLoading && !error && !temHistorico && (
                <p className="text-xs text-muted-foreground/60 italic text-center py-4">
                  Nenhuma alteração registrada ainda.
                </p>
              )}
              {!isLoading && !error && historico.map(item => (
                <HistoricoLinha key={item.id} item={item} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}