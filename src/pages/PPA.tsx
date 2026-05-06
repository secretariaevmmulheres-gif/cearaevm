import { useState } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Home, Users, FileSpreadsheet, CheckCircle2, TrendingUp,
  Info, Copy, Check, BookOpen, MapPin, ClipboardList,
} from 'lucide-react';
import {
  usePPA, REGIOES_PPA, MESES, CMC_REGIOES, CMC_LABEL,
  TabelaRegiaoPPA, Mes, QualificacaoPPA, ResumoMensal,
} from '@/hooks/useppa';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Helpers ───────────────────────────────────────────────────────────────────
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function fmtData(d: string | null | undefined): string {
  if (!d) return '';
  try { return format(parseISO(d), 'dd/MM', { locale: ptBR }); } catch { return d; }
}

function useCopiar() {
  const [copiados, setCop] = useState<Set<string>>(new Set());
  const copiar = (texto: string, id: string) => {
    navigator.clipboard.writeText(texto).then(() => {
      setCop(prev => new Set([...prev, id]));
      toast.success('Copiado!');
      setTimeout(() => setCop(prev => { const n = new Set(prev); n.delete(id); return n; }), 2000);
    });
  };
  return { copiar, copiados };
}

// ── Tabela região × mês ───────────────────────────────────────────────────────
function TabelaPPA({ tabela, label, cor = 'violet', notas }: {
  tabela: TabelaRegiaoPPA; label: string;
  cor?: 'violet'|'rose'|'emerald'|'blue'|'amber'; notas?: Record<string, string[]>;
}) {
  const H = { violet:'bg-violet-600', rose:'bg-rose-600', emerald:'bg-emerald-600', blue:'bg-blue-600', amber:'bg-amber-600' }[cor];
  const T = { violet:'bg-violet-50 text-violet-800', rose:'bg-rose-50 text-rose-800', emerald:'bg-emerald-50 text-emerald-800', blue:'bg-blue-50 text-blue-800', amber:'bg-amber-50 text-amber-800' }[cor];
  return (
    <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
      <table className="w-full text-xs">
        <thead><tr>
          <th className={cn('text-left px-3 py-2.5 font-semibold sticky left-0 text-white border-r border-white/20 min-w-[180px]', H)}>{label}</th>
          {MESES.map((m,i) => <th key={m} className={cn('text-center px-2 py-2.5 font-medium whitespace-nowrap text-white min-w-[36px]', H)}>
            {MESES_ABREV[i]}{notas?.[m]?.length ? <span className="ml-0.5 text-white/70 text-[9px]">({notas[m].length})</span> : null}
          </th>)}
          <th className={cn('text-center px-3 py-2.5 font-semibold text-white', H)}>Total</th>
        </tr></thead>
        <tbody>
          {REGIOES_PPA.map((r, ri) => {
            const total = MESES.reduce((s, m) => s + (tabela[r][m] ?? 0), 0);
            return (
              <tr key={r} className={cn('border-b border-border/40', ri % 2 === 1 ? 'bg-muted/20' : 'bg-background')}>
                <td className="px-3 py-2 font-medium sticky left-0 bg-inherit border-r border-border/30 min-w-[180px]">{r}</td>
                {MESES.map(m => { const v = tabela[r][m] ?? 0; return (
                  <td key={m} className="text-center px-2 py-2 tabular-nums">
                    {v === 0 ? <span className="text-muted-foreground/30">—</span> : <span className="font-semibold">{v}</span>}
                  </td>); })}
                <td className="text-center px-3 py-2 tabular-nums font-bold">{total === 0 ? <span className="text-muted-foreground/30">—</span> : total}</td>
              </tr>);
          })}
          <tr className={cn('border-t-2 border-border font-semibold', T)}>
            <td className="px-3 py-2.5 sticky left-0 bg-inherit border-r border-border/30 font-bold">Total</td>
            {MESES.map(m => { const v = REGIOES_PPA.reduce((s, r) => s + (tabela[r][m] ?? 0), 0); return <td key={m} className="text-center px-2 py-2.5 tabular-nums">{v === 0 ? '—' : v}</td>; })}
            <td className="text-center px-3 py-2.5 tabular-nums">{REGIOES_PPA.reduce((s, r) => s + MESES.reduce((ss, m) => ss + (tabela[r][m] ?? 0), 0), 0) || '—'}</td>
          </tr>
        </tbody>
      </table>
      {notas && Object.entries(notas).some(([, v]) => v.length > 0) && (
        <div className="px-4 py-2.5 bg-muted/30 border-t border-border text-xs text-muted-foreground">
          <span className="font-medium">Municípios: </span>
          {MESES.map((m, i) => notas[m]?.length ? <span key={m} className="mr-3"><span className="font-medium">{MESES_ABREV[i]}:</span> {notas[m].join(', ')}</span> : null)}
        </div>
      )}
    </div>
  );
}

// ── Tabela simples ────────────────────────────────────────────────────────────
function TabelaSimples({ dados, label, cor = 'blue' }: {
  dados: Record<string, Record<string, number>>; label: string;
  cor?: 'violet'|'rose'|'emerald'|'blue'|'amber';
}) {
  const H = { violet:'bg-violet-600', rose:'bg-rose-600', emerald:'bg-emerald-600', blue:'bg-blue-600', amber:'bg-amber-600' }[cor];
  return (
    <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
      <table className="w-full text-xs">
        <thead><tr>
          <th className={cn('text-left px-3 py-2.5 font-semibold sticky left-0 text-white min-w-[220px] border-r border-white/20', H)}>{label}</th>
          {MESES.map((m,i) => <th key={m} className={cn('text-center px-2 py-2.5 font-medium whitespace-nowrap text-white min-w-[36px]', H)}>{MESES_ABREV[i]}</th>)}
          <th className={cn('text-center px-3 py-2.5 font-semibold text-white', H)}>Total</th>
        </tr></thead>
        <tbody>
          {Object.entries(dados).map(([linha, meses], ri) => {
            const total = MESES.reduce((s, m) => s + (meses[m] ?? 0), 0);
            return (
              <tr key={linha} className={cn('border-b border-border/40', ri % 2 === 0 ? 'bg-background' : 'bg-muted/20')}>
                <td className="px-3 py-2 font-medium sticky left-0 bg-inherit border-r border-border/30 min-w-[220px]">{linha}</td>
                {MESES.map(m => { const v = meses[m] ?? 0; return <td key={m} className="text-center px-2 py-2 tabular-nums">{v === 0 ? <span className="text-muted-foreground/30">—</span> : <span className="font-semibold">{v.toLocaleString('pt-BR')}</span>}</td>; })}
                <td className="text-center px-3 py-2 tabular-nums font-bold">{total === 0 ? '—' : total.toLocaleString('pt-BR')}</td>
              </tr>);
          })}
          <tr className="border-t-2 border-border bg-muted/40 font-semibold">
            <td className="px-3 py-2.5 sticky left-0 bg-inherit border-r border-border/30 font-bold">Total</td>
            {MESES.map(m => { const v = Object.values(dados).reduce((s, r) => s + (r[m] ?? 0), 0); return <td key={m} className="text-center px-2 py-2.5 tabular-nums">{v === 0 ? '—' : v.toLocaleString('pt-BR')}</td>; })}
            <td className="text-center px-3 py-2.5 tabular-nums">{Object.values(dados).reduce((s, r) => s + MESES.reduce((ss, m) => ss + (r[m] ?? 0), 0), 0).toLocaleString('pt-BR') || '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Card de ações mensais ─────────────────────────────────────────────────────
function CardAcoesMes({ rm, copiar, copiado }: {
  rm: ResumoMensal; copiar: (t: string, id: string) => void; copiado: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = `acoes-${rm.mes}`;

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Header com contadores */}
      <div className="flex items-center gap-0 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex-1 px-4 py-3">
          <p className="font-semibold text-sm">{rm.mes}</p>
          <div className="flex items-center gap-4 mt-1.5">
            {[
              { label: 'Qualificações', v: rm.qualificacoes, cor: 'text-violet-600' },
              { label: 'Atendimentos', v: rm.atendimentos, cor: 'text-blue-600' },
              { label: 'Un. Móvel',    v: rm.unidadesMoveis, cor: 'text-teal-600' },
              { label: 'Outros',       v: rm.palestras, cor: 'text-amber-600' },
              { label: 'Total ações',  v: rm.totalAcoes, cor: 'text-foreground font-bold' },
            ].map(c => (
              <div key={c.label} className="text-center">
                <p className={cn('text-lg font-bold tabular-nums leading-none', c.cor)}>{c.v.toLocaleString('pt-BR')}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 px-3">
          {rm.textoNarrativo && (
            <Button variant="ghost" size="sm" className={cn('h-7 px-2 text-xs gap-1', copiado && 'text-emerald-600')}
              onClick={e => { e.stopPropagation(); copiar(rm.textoNarrativo, id); }}>
              {copiado ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copiado ? 'Copiado!' : 'Copiar'}
            </Button>
          )}
          <span className={cn('text-muted-foreground transition-transform text-xs', expanded && 'rotate-180')}>▼</span>
        </div>
      </div>

      {/* Texto narrativo expandido por sede */}
      {expanded && rm.textoNarrativo && (
        <div className="border-t border-border/50 divide-y divide-border/30">
          {Object.entries(rm.acoesPorSede).map(([sede, acoes]) => (
            <div key={sede} className="px-4 py-3">
              <p className="text-xs font-bold text-primary mb-1.5">{sede}</p>
              <div className="space-y-1">
                {acoes.map(a => (
                  <p key={a.id} className="text-xs text-foreground leading-relaxed">
                    {a.texto}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Card de qualificação ──────────────────────────────────────────────────────
function CardQualificacao({ q, copiar, copiado }: {
  q: QualificacaoPPA; copiar: (t: string, id: string) => void; copiado: boolean;
}) {
  const dataLabel = q.data_fim ? `${fmtData(q.data)} e ${fmtData(q.data_fim)}` : fmtData(q.data);
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{q.sede}</span>
            <span className="text-xs text-muted-foreground">{dataLabel}</span>
            <span className="text-xs text-muted-foreground">· {q.total_municipios} município(s)</span>
          </div>
          {q.nome_evento && <p className="font-semibold text-sm mt-1.5">{q.nome_evento}</p>}
        </div>
      </div>
      <div className="bg-muted/40 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Texto para o PPA</p>
          <Button variant="ghost" size="sm" className={cn('h-6 px-2 text-xs gap-1', copiado && 'text-emerald-600')}
            onClick={() => copiar(q.texto_narrativo, q.id)}>
            {copiado ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copiado ? 'Copiado!' : 'Copiar'}
          </Button>
        </div>
        <p className="text-xs text-foreground leading-relaxed">{q.texto_narrativo}</p>
      </div>
      <div className="flex flex-wrap gap-1">
        {q.municipios_participantes.map(m => (
          <span key={m} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{m}</span>
        ))}
      </div>
    </div>
  );
}

// ── Export Excel ──────────────────────────────────────────────────────────────
function exportPPAToExcel(ppa: ReturnType<typeof usePPA>) {
  const wb = XLSX.utils.book_new();
  const H = ['Região', ...MESES_ABREV, 'Total'];

  // Entregas
  const r1: (string|number)[][] = [];
  r1.push([`ENTREGAS COAPV — PPA ${ppa.ano}`]); r1.push([]);
  r1.push(['Sala Lilás Implantada']); r1.push(H);
  REGIOES_PPA.forEach(r => r1.push([r, ...MESES.map(m => ppa.salasLilasImplantadas[r][m] || ''), ppa.totalLinha(ppa.salasLilasImplantadas[r]) || '']));
  r1.push(['Total', ...MESES.map(m => ppa.totalColuna(ppa.salasLilasImplantadas, m) || ''), '']);
  r1.push(['Municípios', ...MESES.map(m => (ppa.salasLilasImplantadasMunicipios[m] || []).join(', ')), '']); r1.push([]);
  r1.push(['Sala Lilás Mantida (Gov. Estado)']); r1.push(H);
  REGIOES_PPA.forEach(r => { const v = ppa.salasLilasMantidas[r][MESES[0]] ?? 0; r1.push([r, ...MESES.map(() => v || ''), v || '']); }); r1.push([]);
  r1.push(['CMM Apoiada na Implantação']); r1.push(H);
  REGIOES_PPA.forEach(r => r1.push([r, ...MESES.map(m => ppa.cmmApoiadas[r][m] || ''), ppa.totalLinha(ppa.cmmApoiadas[r]) || '']));
  r1.push(['Total', ...MESES.map(m => ppa.totalColuna(ppa.cmmApoiadas, m) || ''), '']);
  r1.push(['Municípios', ...MESES.map(m => (ppa.cmmApoiadasMunicipios[m] || []).join(', ')), '']);
  const ws1 = XLSX.utils.aoa_to_sheet(r1); ws1['!cols'] = [{ wch:28 }, ...MESES.map(() => ({ wch:7 })), { wch:7 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Entregas_COAPV');

  // Indicadores
  const r2: (string|number)[][] = [];
  r2.push([`INDICADORES — PPA ${ppa.ano}`]); r2.push([]);
  r2.push(['CMB — Grande Fortaleza']); r2.push(['CMB', ...MESES_ABREV, 'Total']);
  r2.push(['CMB', ...MESES.map(m => ppa.atendCMB[m] || ''), MESES.reduce((s,m) => s+(ppa.atendCMB[m]??0),0) || '']); r2.push([]);
  r2.push(['CMCs']); r2.push(['CMC / Região', ...MESES_ABREV, 'Total']);
  Object.entries(CMC_REGIOES).forEach(([c, reg]) => { const row = ppa.atendCMC[c] ?? {}; r2.push([`${c} (${reg})`, ...MESES.map(m => row[m] || ''), MESES.reduce((s,m) => s+(row[m]??0),0) || '']); }); r2.push([]);
  r2.push(['Unidade Móvel']); r2.push(H);
  REGIOES_PPA.forEach(r => r2.push([r, ...MESES.map(m => ppa.atendVan[r][m] || ''), ppa.totalLinha(ppa.atendVan[r]) || '']));
  r2.push(['Total', ...MESES.map(m => ppa.totalColuna(ppa.atendVan, m) || ''), '']);
  const ws2 = XLSX.utils.aoa_to_sheet(r2); ws2['!cols'] = [{ wch:32 }, ...MESES.map(() => ({ wch:7 })), { wch:7 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Indicadores');

  // Ações Realizadas
  const r3: (string|number)[][] = [];
  r3.push([`AÇÕES REALIZADAS — PPA ${ppa.ano}`]); r3.push([]);
  r3.push(['Mês', 'Qualif.', 'Atend.', 'Un.Móvel', 'Outros', 'Total', 'Texto Narrativo']);
  MESES.forEach(m => {
    const rm = ppa.resumoMensal[m];
    if (rm.totalAcoes === 0) return;
    r3.push([m, rm.qualificacoes, rm.atendimentos, rm.unidadesMoveis, rm.palestras, rm.totalAcoes, rm.textoNarrativo]);
  });
  const ws3 = XLSX.utils.aoa_to_sheet(r3);
  ws3['!cols'] = [{ wch:12 }, { wch:8 }, { wch:8 }, { wch:8 }, { wch:8 }, { wch:8 }, { wch:120 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Ações Realizadas');

  // Qualificações
  if (ppa.qualificacoesPPA.length > 0) {
    const r4: (string|number)[][] = [];
    r4.push([`QUALIFICAÇÕES — PPA ${ppa.ano}`]); r4.push([]);
    r4.push(['Data', 'Sede', 'Evento', 'Nº Municípios', 'Texto PPA', 'Municípios']);
    ppa.qualificacoesPPA.forEach(q => {
      r4.push([q.data_fim ? `${fmtData(q.data)} e ${fmtData(q.data_fim)}` : fmtData(q.data), q.sede, q.nome_evento || '', q.total_municipios, q.texto_narrativo, q.municipios_participantes.join(', ')]);
    });
    const ws4 = XLSX.utils.aoa_to_sheet(r4); ws4['!cols'] = [{ wch:14 }, { wch:12 }, { wch:36 }, { wch:12 }, { wch:80 }, { wch:60 }];
    XLSX.utils.book_append_sheet(wb, ws4, 'Qualificações');
  }

  XLSX.writeFile(wb, `PPA_${ppa.ano}_Monitoramento_EVM.xlsx`);
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function PPA() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const ppa = usePPA(ano);
  const { copiar, copiados } = useCopiar();

  const dadosCMC: Record<string, Record<string, number>> = {};
  Object.entries(CMC_REGIOES).forEach(([c, r]) => { dadosCMC[`${c} — ${r}`] = ppa.atendCMC[c] ?? {}; });
  const dadosCMB = { 'Grande Fortaleza — CMB': ppa.atendCMB };
  const totalAtendCMBano = MESES.reduce((s, m) => s + (ppa.atendCMB[m] ?? 0), 0);
  const mesesComAcoes = MESES.filter(m => ppa.resumoMensal[m]?.totalAcoes > 0);

  return (
    <AppLayout>
      <PageHeader title="Monitoramento PPA" description="Dados organizados no formato do PPA — prontos para copiar para o Drive da Secretaria">
        <div className="flex items-center gap-3">
          <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{[2025,2026,2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={() => { try { exportPPAToExcel(ppa); toast.success('Planilha exportada!'); } catch { toast.error('Erro ao exportar'); } }} className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />Exportar Excel
          </Button>
        </div>
      </PageHeader>

      {/* Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label:'Salas Lilás Implantadas', value:ppa.totalSalasLilasInauguradasAno, icon:CheckCircle2, bg:'bg-violet-500/10', ic:'text-violet-600', sub:`em ${ano}` },
          { label:'Salas Lilás Mantidas',    value:ppa.totalSalasLilasAtivas,          icon:Home,         bg:'bg-rose-500/10',   ic:'text-rose-600',   sub:'Gov. Estado ativas' },
          { label:'CMMs Apoiadas',            value:ppa.totalCMMInauguradasAno,         icon:CheckCircle2, bg:'bg-emerald-500/10', ic:'text-emerald-600', sub:`em ${ano}` },
          { label:'Ações no Ano',             value:MESES.reduce((s,m) => s+(ppa.resumoMensal[m]?.totalAcoes??0),0), icon:ClipboardList, bg:'bg-blue-500/10', ic:'text-blue-600', sub:'total registradas' },
        ].map((c,i) => (
          <motion.div key={c.label} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}
            className="bg-card rounded-xl p-3 border border-border shadow-sm">
            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center mb-2', c.bg)}>
              <c.icon className={cn('w-3.5 h-3.5', c.ic)} />
            </div>
            <p className="text-2xl font-bold tabular-nums">{c.value.toLocaleString('pt-BR')}</p>
            <p className="text-[11px] text-muted-foreground">{c.label}</p>
            <p className="text-[10px] text-muted-foreground/60">{c.sub}</p>
          </motion.div>
        ))}
      </div>

      <div className="flex items-start gap-3 p-4 mb-6 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs text-amber-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
        <div>
          <span className="font-medium">Como usar: </span>
          Exporte o Excel para copiar para o Drive. Na aba <strong>Ações Realizadas</strong>, cada mês tem os contadores e o texto narrativo completo por sede — clique <strong>Copiar</strong> para usar diretamente no PPA.
          Qualificações com municípios participantes aparecem na aba Qualificações.
          Sala Lilás Mantida conta apenas as salas do <strong>Governo do Estado</strong>.
        </div>
      </div>

      <Tabs defaultValue="acoes" className="space-y-6">
        <TabsList>
          <TabsTrigger value="acoes" className="gap-2">
            <ClipboardList className="w-4 h-4" />Ações ({mesesComAcoes.length} meses)
          </TabsTrigger>
          <TabsTrigger value="qualificacoes" className="gap-2">
            <BookOpen className="w-4 h-4" />Qualificações ({ppa.qualificacoesPPA.length})
          </TabsTrigger>
          <TabsTrigger value="entregas" className="gap-2">
            <Home className="w-4 h-4" />Entregas COAPV
          </TabsTrigger>
          <TabsTrigger value="indicadores" className="gap-2">
            <TrendingUp className="w-4 h-4" />Indicadores
          </TabsTrigger>
        </TabsList>

        {/* ── Ações Realizadas ── */}
        <TabsContent value="acoes" className="space-y-3">
          {mesesComAcoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <ClipboardList className="w-12 h-12 opacity-20 mb-3" />
              <p className="font-medium">Nenhuma atividade registrada em {ano}</p>
              <p className="text-sm mt-1">Cadastre atividades no módulo Atividades.</p>
            </div>
          ) : (
            MESES.map(mes => {
              const rm = ppa.resumoMensal[mes];
              if (!rm || rm.totalAcoes === 0) return null;
              return <CardAcoesMes key={mes} rm={rm} copiar={copiar} copiado={copiados.has(`acoes-${mes}`)} />;
            })
          )}
        </TabsContent>

        {/* ── Qualificações ── */}
        <TabsContent value="qualificacoes" className="space-y-6">
          {ppa.qualificacoesPPA.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <BookOpen className="w-12 h-12 opacity-20 mb-3" />
              <p className="font-medium">Nenhuma qualificação com municípios participantes em {ano}</p>
              <p className="text-sm mt-1">Cadastre atividades do tipo <strong>Qualificação</strong> e adicione os municípios participantes.</p>
            </div>
          ) : (
            MESES.map(mes => {
              const lista = ppa.qualificacoesPorMes[mes];
              if (!lista?.length) return null;
              return (
                <div key={mes}>
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />{mes}
                    <span className="text-xs font-normal">— {lista.length} qualificação(ões) · {new Set(lista.flatMap(q => q.municipios_participantes)).size} municípios únicos</span>
                  </h3>
                  <div className="space-y-3">
                    {lista.map(q => <CardQualificacao key={q.id} q={q} copiar={copiar} copiado={copiados.has(q.id)} />)}
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* ── Entregas ── */}
        <TabsContent value="entregas" className="space-y-8">
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Entrega: Sala Lilás Implantada</h3>
            <p className="text-xs text-muted-foreground">Solicitações de Sala Lilás inauguradas no ano.</p>
            <TabelaPPA tabela={ppa.salasLilasImplantadas} label="Região" cor="violet" notas={ppa.salasLilasImplantadasMunicipios as any} />
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Entrega: Sala Lilás Mantida (Governo do Estado)</h3>
            <p className="text-xs text-muted-foreground">Apenas salas do tipo <strong>Sala Lilás Governo do Estado</strong> ativas no sistema.</p>
            <TabelaPPA tabela={ppa.salasLilasMantidas} label="Região" cor="rose" />
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Indicador: CMMs apoiadas na implantação</h3>
            <p className="text-xs text-muted-foreground">CMMs inauguradas no ano por região e mês.</p>
            <TabelaPPA tabela={ppa.cmmApoiadas} label="Região" cor="emerald" notas={ppa.cmmApoiadasMunicipios as any} />
          </div>
        </TabsContent>

        {/* ── Indicadores ── */}
        <TabsContent value="indicadores" className="space-y-8">
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Indicador: Mulheres atendidas na CMB</h3>
            <p className="text-xs text-muted-foreground">Atividades com sede <strong>CMB</strong>. Total: <strong>{totalAtendCMBano.toLocaleString('pt-BR')}</strong></p>
            <TabelaSimples dados={dadosCMB} label="CMB — Grande Fortaleza" cor="blue" />
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Indicador: Mulheres atendidas nas CMCs</h3>
            <p className="text-xs text-muted-foreground">Atividades com sede igual ao nome da cidade da CMC.</p>
            <TabelaSimples dados={dadosCMC} label="CMC / Região" cor="violet" />
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Indicador: Mulheres atendidas na Unidade Móvel</h3>
            <p className="text-xs text-muted-foreground">Atividades do tipo Unidade Móvel por região e mês.</p>
            <TabelaPPA tabela={ppa.atendVan} label="Região" cor="amber" />
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}