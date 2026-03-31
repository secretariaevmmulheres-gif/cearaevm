import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Atividade } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  Agendado:  { color: 'bg-blue-500',   text: 'text-blue-700',   light: 'bg-blue-500/10',   icon: Clock       },
  Realizado: { color: 'bg-emerald-500',text: 'text-emerald-700',light: 'bg-emerald-500/10', icon: CheckCircle2 },
  Cancelado: { color: 'bg-rose-400',   text: 'text-rose-700',   light: 'bg-rose-400/10',   icon: XCircle     },
} as const;

// ── Dot de atividade no dia ───────────────────────────────────────────────────
function AtividadeDot({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.Agendado;
  return <span className={cn('inline-block w-1.5 h-1.5 rounded-full shrink-0', cfg.color)} />;
}

// ── Popover de atividades do dia ──────────────────────────────────────────────
function DayPopover({ atividades, onClose }: {
  atividades: Atividade[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="bg-card border border-border rounded-2xl shadow-xl max-w-sm w-full p-4 space-y-2"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-sm">
            {format(parseISO(atividades[0].data + 'T00:00:00'), "dd 'de' MMMM", { locale: ptBR })}
          </p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">fechar</button>
        </div>
        {atividades.map(a => {
          const cfg = STATUS_CONFIG[a.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.Agendado;
          const Icon = cfg.icon;
          return (
            <div key={a.id} className={cn('flex items-start gap-3 p-3 rounded-xl', cfg.light)}>
              <Icon className={cn('w-4 h-4 shrink-0 mt-0.5', cfg.text)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{a.municipio}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {a.tipo} · {a.recurso} · {a.municipio_sede}
                </p>
                {a.horario && (
                  <p className="text-xs text-muted-foreground">{a.horario}</p>
                )}
                {a.atendimentos != null && a.atendimentos > 0 && (
                  <p className={cn('text-xs font-medium mt-0.5', cfg.text)}>
                    {a.atendimentos} atendimento{a.atendimentos !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0', cfg.light, cfg.text)}>
                {a.status}
              </span>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
interface CalendarioAtividadesProps {
  atividades: Atividade[];
}

export function CalendarioAtividades({ atividades }: CalendarioAtividadesProps) {
  const [mesAtual, setMesAtual]   = useState(new Date());
  const [diaAberto, setDiaAberto] = useState<string | null>(null); // "YYYY-MM-DD"

  // Monta o grid do calendário (6 semanas × 7 dias)
  const diasGrid = useMemo(() => {
    const inicio = startOfWeek(startOfMonth(mesAtual), { weekStartsOn: 0 });
    const fim    = endOfWeek(endOfMonth(mesAtual), { weekStartsOn: 0 });
    const dias: Date[] = [];
    let d = inicio;
    while (d <= fim) { dias.push(d); d = addDays(d, 1); }
    return dias;
  }, [mesAtual]);

  // Agrupa atividades por data "YYYY-MM-DD"
  const porData = useMemo(() => {
    const map = new Map<string, Atividade[]>();
    atividades.forEach(a => {
      const key = a.data;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return map;
  }, [atividades]);

  // Resumo do mês
  const resumoMes = useMemo(() => {
    const mesStr = format(mesAtual, 'yyyy-MM');
    const doMes  = atividades.filter(a => a.data.startsWith(mesStr));
    return {
      total:      doMes.length,
      agendadas:  doMes.filter(a => a.status === 'Agendado').length,
      realizadas: doMes.filter(a => a.status === 'Realizado').length,
      canceladas: doMes.filter(a => a.status === 'Cancelado').length,
      atendimentos: doMes.reduce((s, a) => s + (a.atendimentos ?? 0), 0),
    };
  }, [atividades, mesAtual]);

  const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const atividadesDiaAberto = diaAberto ? (porData.get(diaAberto) ?? []) : [];

  return (
    <div className="space-y-4">
      {/* ── Cabeçalho: navegação de mês ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-base font-semibold capitalize">
            {format(mesAtual, 'MMMM yyyy', { locale: ptBR })}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setMesAtual(m => subMonths(m, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMesAtual(new Date())} className="text-xs h-8 px-3">
            Hoje
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setMesAtual(m => addMonths(m, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── Resumo do mês ── */}
      {resumoMes.total > 0 && (
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
            <span className="font-semibold text-foreground">{resumoMes.total}</span> atividades
          </span>
          {resumoMes.agendadas > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-700">
              <AtividadeDot status="Agendado" />
              {resumoMes.agendadas} agendada{resumoMes.agendadas !== 1 ? 's' : ''}
            </span>
          )}
          {resumoMes.realizadas > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700">
              <AtividadeDot status="Realizado" />
              {resumoMes.realizadas} realizada{resumoMes.realizadas !== 1 ? 's' : ''}
            </span>
          )}
          {resumoMes.atendimentos > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-700">
              {resumoMes.atendimentos} atendimento{resumoMes.atendimentos !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* ── Grid ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 border-b border-border">
          {SEMANA.map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Dias */}
        <div className="grid grid-cols-7">
          {diasGrid.map((dia, i) => {
            const key      = format(dia, 'yyyy-MM-dd');
            const atividsDia = porData.get(key) ?? [];
            const deste    = isSameMonth(dia, mesAtual);
            const hoje     = isToday(dia);
            const temAtiv  = atividsDia.length > 0;

            return (
              <button
                key={i}
                onClick={() => temAtiv && setDiaAberto(diaAberto === key ? null : key)}
                className={cn(
                  'relative min-h-[64px] p-1.5 text-left border-r border-b border-border/50 last:border-r-0 transition-colors',
                  !deste && 'bg-muted/20',
                  temAtiv && 'cursor-pointer hover:bg-muted/50',
                  !temAtiv && 'cursor-default',
                  diaAberto === key && 'bg-primary/5'
                )}
              >
                {/* Número do dia */}
                <span className={cn(
                  'inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-medium',
                  hoje ? 'bg-primary text-primary-foreground' : deste ? 'text-foreground' : 'text-muted-foreground/40'
                )}>
                  {format(dia, 'd')}
                </span>

                {/* Dots das atividades */}
                {atividsDia.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-0.5 px-0.5">
                    {atividsDia.slice(0, 3).map(a => (
                      <AtividadeDot key={a.id} status={a.status} />
                    ))}
                    {atividsDia.length > 3 && (
                      <span className="text-[10px] text-muted-foreground leading-none">+{atividsDia.length - 3}</span>
                    )}
                  </div>
                )}

                {/* Preview da primeira atividade (telas largas) */}
                {atividsDia.length > 0 && (
                  <p className="hidden sm:block mt-1 text-[10px] text-muted-foreground truncate leading-tight px-0.5">
                    {atividsDia[0].municipio}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
          <span key={status} className="flex items-center gap-1.5">
            <AtividadeDot status={status} />
            {status}
          </span>
        ))}
      </div>

      {/* Popover de detalhes do dia */}
      {diaAberto && atividadesDiaAberto.length > 0 && (
        <DayPopover
          atividades={atividadesDiaAberto}
          onClose={() => setDiaAberto(null)}
        />
      )}
    </div>
  );
}

export default CalendarioAtividades;