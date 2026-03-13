import { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useEquipamentos } from '@/hooks/useEquipamentos';
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import { useViaturas } from '@/hooks/useViaturas';
import { useAtividades } from '@/hooks/useAtividades';
import { useQualificacoes } from '@/hooks/useQualificacoes';
import { useHistoricoRecente, getCampoLabel } from '@/hooks/useHistorico';
import { getRegiao, municipiosCeara } from '@/data/municipios';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Building2, Truck, FileText, CalendarDays,
  GraduationCap, CheckCircle, XCircle, MapPin, ChevronRight,
  PackageCheck, Shield, AlertCircle, Search, History,
  Plus, Pencil, Trash2,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(d: string | undefined | null) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd/MM/yyyy'); } catch { return d; }
}

function BoolBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium',
      ok ? 'bg-emerald-500/10 text-emerald-700' : 'bg-muted text-muted-foreground'
    )}>
      {ok
        ? <CheckCircle className="w-3 h-3" />
        : <XCircle className="w-3 h-3 opacity-50" />}
      {label}
    </span>
  );
}

// ── Cores por tipo de equipamento ─────────────────────────────────────────────

const TIPO_COR: Record<string, { bg: string; text: string; dot: string }> = {
  'Casa da Mulher Brasileira':      { bg: 'bg-teal-500/10',   text: 'text-teal-700',   dot: 'bg-teal-500'   },
  'Casa da Mulher Cearense':        { bg: 'bg-violet-500/10', text: 'text-violet-700', dot: 'bg-violet-500' },
  'Casa da Mulher Municipal':       { bg: 'bg-orange-500/10', text: 'text-orange-700', dot: 'bg-orange-500' },
  'Sala Lilás Municipal':           { bg: 'bg-fuchsia-500/10',text: 'text-fuchsia-700',dot: 'bg-fuchsia-500'},
  'Sala Lilás Governo do Estado':   { bg: 'bg-pink-500/10',   text: 'text-pink-700',   dot: 'bg-pink-500'   },
  'Sala Lilás em Delegacia':        { bg: 'bg-purple-500/10', text: 'text-purple-700', dot: 'bg-purple-500' },
  'DDM':                            { bg: 'bg-green-500/10',  text: 'text-green-700',  dot: 'bg-green-600'  },
};

const STATUS_COR: Record<string, string> = {
  'Inaugurada':      'bg-emerald-500/10 text-emerald-700',
  'Em implantação':  'bg-blue-500/10 text-blue-700',
  'Aprovada':        'bg-indigo-500/10 text-indigo-700',
  'Em análise':      'bg-amber-500/10 text-amber-700',
  'Recebida':        'bg-slate-500/10 text-slate-700',
  'Cancelada':       'bg-rose-500/10 text-rose-700',
};

// ── Sub-componentes ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, count, color = 'text-primary' }: {
  icon: React.ReactNode; title: string; count?: number; color?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className={cn('', color)}>{icon}</span>
      <h3 className="font-semibold text-sm">{title}</h3>
      {count !== undefined && (
        <span className="ml-auto text-xs text-muted-foreground">{count} registro{count !== 1 ? 's' : ''}</span>
      )}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <p className="text-sm text-muted-foreground italic py-3 text-center">{msg}</p>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

export default function MunicipioPage() {
  const { nome } = useParams<{ nome: string }>();
  const navigate = useNavigate();

  const municipio = decodeURIComponent(nome ?? '');
  const regiao    = getRegiao(municipio);
  const existe    = municipiosCeara.includes(municipio);

  const { equipamentos: todosEq }       = useEquipamentos();
  const { solicitacoes: todasSolic }    = useSolicitacoes();
  const { viaturas: todasViat }         = useViaturas();
  const { atividades: todasAtiv }       = useAtividades();
  const { qualificacoes: todasQual }    = useQualificacoes();
  const { historico: todoHist }         = useHistoricoRecente(200);

  const eqs   = useMemo(() => todosEq.filter(e => e.municipio === municipio), [todosEq, municipio]);
  const solics = useMemo(() => todasSolic.filter(s => s.municipio === municipio), [todasSolic, municipio]);
  const viats  = useMemo(() => todasViat.filter(v => v.municipio === municipio), [todasViat, municipio]);
  const ativs  = useMemo(() => todasAtiv.filter(a => a.municipio === municipio).sort((a, b) => b.data.localeCompare(a.data)), [todasAtiv, municipio]);
  const quals  = useMemo(() =>
    todasQual.filter(q => q.municipios.some(m => m.municipio === municipio)),
    [todasQual, municipio]
  );
  const hist   = useMemo(() =>
    todoHist.filter(h => h.municipio === municipio).slice(0, 15),
    [todoHist, municipio]
  );

  // Município não encontrado
  if (!existe) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
          <Search className="w-12 h-12 opacity-20" />
          <p className="font-medium text-lg">Município não encontrado</p>
          <p className="text-sm">"{municipio}" não está na lista de municípios do Ceará</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
        </div>
      </AppLayout>
    );
  }

  const temEquipamento = eqs.length > 0;
  const temViatura     = viats.length > 0;

  return (
    <AppLayout>
      {/* ── Header ── */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{municipio}</h1>
            <div className="flex items-center gap-2 mt-1">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{regiao}</span>
              {temEquipamento && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 font-medium">
                  Com Equipamento
                </span>
              )}
              {!temEquipamento && temViatura && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 font-medium">
                  Só Viatura
                </span>
              )}
              {!temEquipamento && !temViatura && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                  Sem Cobertura
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Cards de resumo rápido ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Equipamentos', value: eqs.length,   icon: <Building2 className="w-4 h-4" />,    color: 'text-primary'       },
          { label: 'Viaturas',     value: viats.reduce((s,v)=>s+v.quantidade,0), icon: <Truck className="w-4 h-4" />, color: 'text-cyan-600' },
          { label: 'Solicitações', value: solics.length, icon: <FileText className="w-4 h-4" />,    color: 'text-amber-600'     },
          { label: 'Atividades',   value: ativs.length,  icon: <CalendarDays className="w-4 h-4" />,color: 'text-violet-600'    },
          { label: 'Qualificações',value: quals.length,  icon: <GraduationCap className="w-4 h-4" />,color: 'text-emerald-600'  },
          { label: 'Alterações',   value: hist.length > 0 ? hist.length + (hist.length === 15 ? '+' as any : '') : 0, icon: <History className="w-4 h-4" />, color: 'text-slate-600' },
        ].map(({ label, value, icon, color }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-4 text-center"
          >
            <span className={cn('flex justify-center mb-1', color)}>{icon}</span>
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Equipamentos ── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <SectionHeader
            icon={<Building2 className="w-4 h-4" />}
            title="Equipamentos"
            count={eqs.length}
            color="text-primary"
          />
          {eqs.length === 0 ? (
            <EmptyState msg="Nenhum equipamento cadastrado." />
          ) : (
            <div className="space-y-3">
              {eqs.map(e => {
                const cor = TIPO_COR[e.tipo] ?? { bg: 'bg-muted/30', text: 'text-foreground', dot: 'bg-muted-foreground' };
                return (
                  <div key={e.id} className={cn('rounded-xl p-3 border border-border', cor.bg)}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn('w-2 h-2 rounded-full', cor.dot)} />
                      <span className={cn('text-sm font-semibold', cor.text)}>{e.tipo}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <BoolBadge ok={e.possui_patrulha}      label="Patrulha" />
                      <BoolBadge ok={e.kit_athena_entregue}  label="Kit Athena" />
                      <BoolBadge ok={e.capacitacao_realizada} label="Qualificação" />
                    </div>
                    {e.responsavel && (
                      <p className="text-xs text-muted-foreground truncate">Resp.: {e.responsavel}</p>
                    )}
                    {e.nup && (
                      <p className="text-xs text-muted-foreground">NUP: {e.nup}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Solicitações ── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <SectionHeader
            icon={<FileText className="w-4 h-4" />}
            title="Solicitações"
            count={solics.length}
            color="text-amber-600"
          />
          {solics.length === 0 ? (
            <EmptyState msg="Nenhuma solicitação encontrada." />
          ) : (
            <div className="space-y-2">
              {solics
                .sort((a, b) => b.data_solicitacao.localeCompare(a.data_solicitacao))
                .map(s => (
                  <div key={s.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{s.tipo_equipamento}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COR[s.status] ?? 'bg-muted text-muted-foreground')}>
                          {s.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {fmtDate(s.data_solicitacao)}
                        {s.nup && <span className="ml-2">· {s.nup}</span>}
                      </p>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {s.kit_athena_entregue  && <BoolBadge ok label="Kit Athena" />}
                        {s.recebeu_patrulha     && <BoolBadge ok label="Patrulha" />}
                        {s.capacitacao_realizada && <BoolBadge ok label="Qualificação" />}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* ── Viaturas ── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <SectionHeader
            icon={<Truck className="w-4 h-4" />}
            title="Viaturas"
            count={viats.length}
            color="text-cyan-600"
          />
          {viats.length === 0 ? (
            <EmptyState msg="Nenhuma viatura cadastrada." />
          ) : (
            <div className="space-y-2">
              {viats.map(v => (
                <div key={v.id} className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Truck className="w-4 h-4 text-cyan-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{v.tipo_patrulha}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 font-medium">
                        {v.orgao_responsavel}
                      </span>
                      {v.vinculada_equipamento && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700">
                          Vinculada ao equipamento
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                      <p className="text-xs text-muted-foreground">
                        {v.quantidade} unidade{v.quantidade !== 1 ? 's' : ''}
                      </p>
                      {v.data_implantacao && (
                        <p className="text-xs text-muted-foreground">
                          Implantação: {fmtDate(v.data_implantacao)}
                        </p>
                      )}
                      {v.responsavel && (
                        <p className="text-xs text-muted-foreground">
                          Resp.: {v.responsavel}
                        </p>
                      )}
                    </div>
                    {v.observacoes && (
                      <p className="text-xs text-muted-foreground/70 mt-1 italic">{v.observacoes}</p>
                    )}
                  </div>
                </div>
              ))}
              {/* Total de unidades */}
              {viats.length > 1 && (
                <div className="pt-1 flex justify-end">
                  <p className="text-xs font-medium text-muted-foreground">
                    Total: {viats.reduce((s, v) => s + v.quantidade, 0)} unidades em {viats.length} registro{viats.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Qualificações ── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <SectionHeader
            icon={<GraduationCap className="w-4 h-4" />}
            title="Qualificações"
            count={quals.length}
            color="text-emerald-600"
          />
          {quals.length === 0 ? (
            <EmptyState msg="Nenhuma qualificação registrada para este município." />
          ) : (
            <div className="space-y-2">
              {quals.map(q => {
                const munItem = q.municipios.find(m => m.municipio === municipio);
                return (
                  <div key={q.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <GraduationCap className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">{q.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {q.ministrante} · {fmtDate(q.data)}
                      </p>
                      {munItem && (
                        <p className="text-xs text-emerald-700 mt-0.5">
                          {munItem.quantidade_pessoas} pessoa{munItem.quantidade_pessoas !== 1 ? 's' : ''} deste município
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Atividades ── */}
        <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-violet-600"><CalendarDays className="w-4 h-4" /></span>
            <h3 className="font-semibold text-sm">Atividades Registradas</h3>
            {ativs.length > 0 && (
              <span className="ml-auto text-xs text-muted-foreground">{ativs.length} registro{ativs.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          {ativs.length === 0 ? (
            <EmptyState msg="Nenhuma atividade registrada para este município." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Data</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Tipo</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">Status</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground text-xs">Atendimentos</th>
                  </tr>
                </thead>
                <tbody>
                  {ativs.slice(0, 10).map((a, i) => (
                    <tr key={a.id} className={cn('border-b border-border/40 last:border-0', i % 2 === 0 ? '' : 'bg-muted/20')}>
                      <td className="py-2 px-3 tabular-nums text-xs">{fmtDate(a.data)}</td>
                      <td className="py-2 px-3 text-xs">{a.tipo}</td>
                      <td className="py-2 px-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                          a.status === 'Realizado' ? 'bg-emerald-500/10 text-emerald-700' :
                          a.status === 'Cancelado' ? 'bg-rose-500/10 text-rose-700' :
                          'bg-blue-500/10 text-blue-700'
                        )}>
                          {a.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-xs font-medium">
                        {a.atendimentos ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ativs.length > 10 && (
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground">
                    Mostrando 10 de {ativs.length} atividades
                  </p>
                  <Link
                    to={`/atividades?municipio=${encodeURIComponent(municipio)}`}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    Ver todas <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Histórico de Alterações ── */}
        {hist.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-slate-600"><History className="w-4 h-4" /></span>
              <h3 className="font-semibold text-sm">Histórico de Alterações</h3>
              <span className="ml-auto text-xs text-muted-foreground">últimas {hist.length}</span>
            </div>
            <div className="space-y-0">
              {hist.map((h, i) => {
                const ACAO_COR: Record<string, string> = {
                  INSERT: 'text-emerald-600 bg-emerald-500/10',
                  UPDATE: 'text-blue-600 bg-blue-500/10',
                  DELETE: 'text-rose-600 bg-rose-500/10',
                };
                const ACAO_LABEL: Record<string, string> = {
                  INSERT: 'Criação', UPDATE: 'Edição', DELETE: 'Exclusão',
                };
                const TABELA_LABEL: Record<string, string> = {
                  equipamentos: 'Equipamento', solicitacoes: 'Solicitação', atividades: 'Atividade',
                };
                const AcaoIcon = h.acao === 'INSERT' ? Plus : h.acao === 'DELETE' ? Trash2 : Pencil;
                return (
                  <div key={h.id} className={cn(
                    'flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0',
                    i % 2 === 0 ? '' : 'bg-muted/10 -mx-1 px-1 rounded'
                  )}>
                    <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium shrink-0', ACAO_COR[h.acao])}>
                      <AcaoIcon className="w-3 h-3 inline mr-0.5" />
                      {ACAO_LABEL[h.acao]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{TABELA_LABEL[h.tabela] ?? h.tabela}</p>
                      {h.acao === 'UPDATE' && h.campo && (
                        <p className="text-xs text-muted-foreground">
                          {getCampoLabel(h.campo)}
                          {h.valor_antes !== null && h.valor_depois !== null && (
                            <span> · <span className="line-through">{h.valor_antes === 'true' ? 'Sim' : h.valor_antes === 'false' ? 'Não' : h.valor_antes?.slice(0,20)}</span> → <span className="text-emerald-700">{h.valor_depois === 'true' ? 'Sim' : h.valor_depois === 'false' ? 'Não' : h.valor_depois?.slice(0,20)}</span></span>
                          )}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground/60 shrink-0 tabular-nums">
                      {format(new Date(h.created_at), 'dd/MM/yy', { locale: ptBR })}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-2 border-t border-border/50 flex justify-end">
              <Link
                to="/historico"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Ver histórico completo <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}