import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { useEquipamentos } from '@/hooks/useEquipamentos';
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import { useViaturas } from '@/hooks/useViaturas';
import { useQualificacoes } from '@/hooks/useQualificacoes';
import { usePatrulhas } from '@/hooks/usePatrulhas';
import { getRegiao, regioesList } from '@/data/municipios';
import {
  exportCpdiToPDF,
  exportDiagnosticoToPDF,
  exportDiagnosticoToExcel,
  exportQualificacoesToPDF,
  exportQualificacoesToExcel,
  MapExportStats,
  MapEquipmentCounts,
} from '@/lib/exportUtils';
import { useMapaContext } from '@/contexts/MapaContext';
import { cn } from '@/lib/utils';
import {
  Download, ShieldCheck, Loader2,
  CheckCircle2, Clock, AlertCircle, LayoutList,
  Filter, X, Settings2, Map as MapIcon,
  FileSpreadsheet, AlertTriangle, GraduationCap, MapPin, Users,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Definição das seções disponíveis ─────────────────────────────────────────
const SECOES = [
  { id: 'cmb',            label: 'Casa da Mulher Brasileira (CMB)',      cor: 'bg-teal-500',    dot: 'bg-teal-500'    },
  { id: 'cmc',            label: 'Casa da Mulher Cearense (CMC)',        cor: 'bg-violet-500',  dot: 'bg-violet-500'  },
  { id: 'cmm',            label: 'Casa da Mulher Municipal (CMM)',       cor: 'bg-orange-500',  dot: 'bg-orange-500'  },
  { id: 'lilasMunicipal', label: 'Salas Lilás Municipal',                cor: 'bg-fuchsia-800', dot: 'bg-fuchsia-800' },
  { id: 'lilasEstado',    label: 'Salas Lilás Gov. Estado',              cor: 'bg-fuchsia-500', dot: 'bg-fuchsia-500' },
  { id: 'lilasDelegacia', label: 'Salas Lilás em Delegacia',             cor: 'bg-fuchsia-300', dot: 'bg-fuchsia-300' },
  { id: 'ddm',            label: 'Delegacias de Defesa da Mulher (DDM)', cor: 'bg-green-700',   dot: 'bg-green-700'   },
  { id: 'patrulha',       label: 'Patrulhas Maria da Penha',             cor: 'bg-cyan-500',    dot: 'bg-cyan-500'    },
  { id: 'viaturas',       label: 'Viaturas PMCE',                        cor: 'bg-indigo-500',  dot: 'bg-indigo-500'  },
] as const;

type SecaoId = typeof SECOES[number]['id'];

// ── Cores por tipo ────────────────────────────────────────────────────────────
const SECTION_COLORS = {
  cmb:            { bg: 'bg-teal-500/10',     text: 'text-teal-700',    border: 'border-teal-500/20',    dot: 'bg-teal-500'    },
  cmc:            { bg: 'bg-violet-500/10',   text: 'text-violet-700',  border: 'border-violet-500/20',  dot: 'bg-violet-500'  },
  cmm:            { bg: 'bg-orange-500/10',   text: 'text-orange-700',  border: 'border-orange-500/20',  dot: 'bg-orange-500'  },
  lilasMunicipal: { bg: 'bg-fuchsia-800/10',  text: 'text-fuchsia-900', border: 'border-fuchsia-800/20', dot: 'bg-fuchsia-800' },
  lilasEstado:    { bg: 'bg-fuchsia-500/10',  text: 'text-fuchsia-700', border: 'border-fuchsia-500/20', dot: 'bg-fuchsia-500' },
  lilasDelegacia: { bg: 'bg-fuchsia-300/10',  text: 'text-fuchsia-600', border: 'border-fuchsia-300/20', dot: 'bg-fuchsia-300' },
  ddm:            { bg: 'bg-green-700/10',    text: 'text-green-800',   border: 'border-green-700/20',   dot: 'bg-green-700'   },
  patrulha:       { bg: 'bg-cyan-500/10',     text: 'text-cyan-700',    border: 'border-cyan-500/20',    dot: 'bg-cyan-500'    },
  viaturas:       { bg: 'bg-indigo-500/10',   text: 'text-indigo-700',  border: 'border-indigo-500/20',  dot: 'bg-indigo-500'  },
};

const STATUS_ICON: Record<string, JSX.Element> = {
  'Inaugurada':     <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />,
  'Em implantação': <Clock        className="w-3.5 h-3.5 text-violet-500 shrink-0"  />,
  'Aprovada':       <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0"    />,
  'Em análise':     <Clock        className="w-3.5 h-3.5 text-amber-500 shrink-0"   />,
  'Recebida':       <AlertCircle  className="w-3.5 h-3.5 text-slate-400 shrink-0"   />,
  'Cancelada':      <AlertCircle  className="w-3.5 h-3.5 text-rose-400 shrink-0"    />,
};

// ── Painel de configuração do PDF ─────────────────────────────────────────────
function ConfiguracaoPDF({
  secoesAtivas, setSecoesAtivas,
  regiaoFiltro, setRegiaoFiltro,
  dataRef, setDataRef,
  onExportar, exporting,
  contagens,
  incluirMapa, setIncluirMapa,
  geoJsonData,
  diasSemMovimento, setDiasSemMovimento,
  onDiagnosticoPDF, onDiagnosticoExcel, exportingDiag,
}: {
  secoesAtivas: Set<SecaoId>;
  setSecoesAtivas: (s: Set<SecaoId>) => void;
  regiaoFiltro: string;
  setRegiaoFiltro: (r: string) => void;
  dataRef: string;
  setDataRef: (d: string) => void;
  onExportar: (resumo?: boolean) => void;
  exporting: boolean;
  contagens: Record<SecaoId, number>;
  incluirMapa: boolean;
  setIncluirMapa: (v: boolean) => void;
  geoJsonData: any;
  diasSemMovimento: number;
  setDiasSemMovimento: (d: number) => void;
  onDiagnosticoPDF: () => void;
  onDiagnosticoExcel: () => void;
  exportingDiag: boolean;
}) {
  const toggleSecao = (id: SecaoId) => {
    const novo = new Set(secoesAtivas);
    if (novo.has(id)) { novo.delete(id); } else { novo.add(id); }
    setSecoesAtivas(novo);
  };
  const toggleTudo = () => {
    setSecoesAtivas(
      secoesAtivas.size === SECOES.length
        ? new Set()
        : new Set(SECOES.map(s => s.id))
    );
  };

  const todosAtivos = secoesAtivas.size === SECOES.length;
  const nenhum      = secoesAtivas.size === 0;

  // Opções rápidas de threshold
  const THRESHOLD_OPTIONS = [30, 45, 60, 90, 120];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden mb-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-muted/40 border-b border-border">
        <Settings2 className="w-4 h-4 text-primary" />
        <p className="font-semibold text-sm">Configurar exportação PDF</p>
        <div className="ml-auto flex items-center gap-2">
          {regiaoFiltro !== 'all' && (
            <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-medium">
              {regiaoFiltro}
            </span>
          )}
          {!todosAtivos && (
            <span className="text-xs bg-amber-500/10 text-amber-700 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
              {secoesAtivas.size} de {SECOES.length} seções
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Linha: Data + Região */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
              Data de referência
            </label>
            <input
              type="date"
              value={dataRef}
              onChange={e => setDataRef(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
              Filtrar por região
            </label>
            <select
              value={regiaoFiltro}
              onChange={e => setRegiaoFiltro(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">Todas as regiões</option>
              {regioesList.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Seções */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Seções a incluir no PDF
            </label>
            <button onClick={toggleTudo} className="text-xs text-primary hover:underline font-medium">
              {todosAtivos ? 'Desmarcar tudo' : 'Selecionar tudo'}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SECOES.map(secao => {
              const ativa = secoesAtivas.has(secao.id);
              const count = contagens[secao.id] ?? 0;
              return (
                <button
                  key={secao.id}
                  onClick={() => toggleSecao(secao.id)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all',
                    ativa
                      ? 'border-primary/30 bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border bg-muted/30 opacity-60 hover:opacity-80'
                  )}
                >
                  <div className={cn(
                    'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                    ativa ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                  )}>
                    {ativa && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                  <div className={cn('w-2 h-2 rounded-full shrink-0', secao.dot)} />
                  <span className="text-sm font-medium flex-1 min-w-0 truncate">{secao.label}</span>
                  <span className={cn(
                    'text-xs font-bold px-1.5 py-0.5 rounded-md shrink-0',
                    count > 0 ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground/50'
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview seções ativas */}
        {secoesAtivas.size > 0 && (
          <div className="bg-muted/40 rounded-xl px-4 py-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">O PDF vai incluir:</span>{' '}
            {Array.from(secoesAtivas).map(id => SECOES.find(s => s.id === id)?.label).join(' · ')}
            {regiaoFiltro !== 'all' && (
              <span className="text-primary font-medium"> — apenas {regiaoFiltro}</span>
            )}
          </div>
        )}

        {/* Mapa de Cobertura */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Mapa de Cobertura
            </label>
          </div>
          <div className={cn(
            'flex items-center gap-3 p-3 rounded-xl border transition-all',
            incluirMapa && geoJsonData
              ? 'border-primary/30 bg-primary/5'
              : 'border-border bg-muted/30'
          )}>
            {geoJsonData ? (
              <>
                <div className="w-20 h-14 rounded-lg border border-border bg-gradient-to-br from-blue-100 to-teal-100 flex items-center justify-center shrink-0">
                  <MapIcon className="w-6 h-6 text-primary/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Mapa vetorial disponível</p>
                  <p className="text-xs text-muted-foreground">184 municípios · polígonos GeoJSON</p>
                </div>
                <button
                  onClick={() => setIncluirMapa(!incluirMapa)}
                  className={cn(
                    'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                    incluirMapa ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                  )}
                >
                  {incluirMapa && <CheckCircle2 className="w-3 h-3 text-white" />}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-3 text-muted-foreground/60 py-1">
                <MapIcon className="w-5 h-5 shrink-0" />
                <p className="text-sm">Visite a página <strong>Mapa</strong> primeiro para habilitar esta seção</p>
              </div>
            )}
          </div>
        </div>

        {/* Botões exportar PDF */}
        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="outline"
            onClick={() => onExportar(true)}
            disabled={exporting || nenhum}
            className="gap-2"
          >
            {exporting
              ? <><Loader2 className="w-4 h-4 animate-spin" />Gerando...</>
              : <><Download className="w-4 h-4" />Resumo</>}
          </Button>
          <Button
            onClick={() => onExportar(false)}
            disabled={exporting || nenhum}
            className="gap-2 min-w-[160px]"
          >
            {exporting
              ? <><Loader2 className="w-4 h-4 animate-spin" />Gerando PDF...</>
              : <><Download className="w-4 h-4" />Exportar PDF Completo</>}
          </Button>
        </div>

        {/* ── Item 8 + 5: Diagnóstico com threshold ── */}
        <div className="border-t border-border pt-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Diagnóstico de Pendências
            </label>
          </div>

          {/* Item 5 — threshold configurável */}
          <div className="mb-3">
            <label className="text-xs font-medium text-muted-foreground block mb-2">
              Alertar solicitações paradas há mais de{' '}
              <span className="font-bold text-foreground">{diasSemMovimento} dias</span>
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Botões rápidos */}
              {[30, 45, 60, 90, 120].map(d => (
                <button
                  key={d}
                  onClick={() => setDiasSemMovimento(d)}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-lg border font-medium transition-all',
                    diasSemMovimento === d
                      ? 'bg-red-500 border-red-500 text-white'
                      : 'border-border text-muted-foreground hover:border-red-300 hover:text-red-600'
                  )}
                >
                  {d}d
                </button>
              ))}
              {/* Input livre */}
              <div className="flex items-center gap-1.5 ml-1">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={diasSemMovimento}
                  onChange={e => {
                    const v = parseInt(e.target.value);
                    if (!isNaN(v) && v >= 1 && v <= 365) setDiasSemMovimento(v);
                  }}
                  className="w-16 text-sm border border-border rounded-lg px-2 py-1.5 bg-background text-center focus:outline-none focus:ring-2 focus:ring-red-400/30"
                />
                <span className="text-xs text-muted-foreground">dias</span>
              </div>
            </div>
          </div>

          {/* Botões diagnóstico */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={onDiagnosticoPDF}
              disabled={exportingDiag}
              className="gap-2 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
            >
              {exportingDiag
                ? <><Loader2 className="w-4 h-4 animate-spin" />Gerando...</>
                : <><Download className="w-4 h-4" />PDF Diagnóstico</>}
            </Button>
            <Button
              variant="outline"
              onClick={onDiagnosticoExcel}
              disabled={exportingDiag}
              className="gap-2 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
            >
              {exportingDiag
                ? <><Loader2 className="w-4 h-4 animate-spin" />Gerando...</>
                : <><FileSpreadsheet className="w-4 h-4" />Excel Diagnóstico</>}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-2">
            Usa o filtro de região selecionado acima
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ── Card de seção ─────────────────────────────────────────────────────────────
function SectionCard({
  numero, titulo, cor, funcionando, emAndamento, observacao, children, delay,
}: {
  numero: number; titulo: string; cor: keyof typeof SECTION_COLORS;
  funcionando: number; emAndamento: number; observacao?: string;
  children: React.ReactNode; delay: number;
}) {
  const c = SECTION_COLORS[cor];
  const [expanded, setExpanded] = useState(true);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn('rounded-2xl border shadow-sm overflow-hidden', c.border)}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className={cn('w-full flex items-center gap-4 px-5 py-4 text-left', c.bg)}
      >
        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0', c.dot)}>
          {numero}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('font-bold text-base', c.text)}>{titulo}</p>
          {observacao && <p className="text-xs text-muted-foreground mt-0.5">{observacao}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn('flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full', c.bg, c.text, 'border', c.border)}>
            <CheckCircle2 className="w-3 h-3" />
            {funcionando} ativo{funcionando !== 1 ? 's' : ''}
          </span>
          {emAndamento > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/20">
              <Clock className="w-3 h-3" />
              {emAndamento} prevista{emAndamento !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <LayoutList className={cn('w-4 h-4 shrink-0 transition-transform duration-200', c.text, !expanded && 'rotate-90')} />
      </button>
      {expanded && (
        <div className="px-5 pb-5 pt-3 bg-card space-y-3">{children}</div>
      )}
    </motion.div>
  );
}

function EquipRow({ municipio, tipo, endereco, responsavel, patrulha, cor, extra, kitAthena, kitAthenaPrevio }: {
  municipio: string; tipo: string; endereco?: string; responsavel?: string;
  patrulha?: boolean; cor: keyof typeof SECTION_COLORS;
  extra?: string; kitAthena?: boolean; kitAthenaPrevio?: boolean;
}) {
  const c = SECTION_COLORS[cor];
  const regiao = getRegiao(municipio);
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
      <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', c.dot)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{municipio}</span>
          {regiao && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{regiao}</span>}
          {!['Casa da Mulher Brasileira','Casa da Mulher Cearense','Casa da Mulher Municipal'].includes(tipo) && (
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', c.bg, c.text, c.border)}>{tipo}</span>
          )}
          {patrulha && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 border border-cyan-500/20">
              Patrulha M.P. ✓
            </span>
          )}
        </div>
        {(endereco || responsavel) && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {[endereco, responsavel].filter(Boolean).join(' · ')}
          </p>
        )}
        {extra && <p className="text-xs text-muted-foreground mt-0.5 italic truncate">{extra}</p>}
        {(kitAthena || kitAthenaPrevio) && (
          <div className="flex gap-1 mt-0.5 flex-wrap">
            {kitAthena && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/20">
                {kitAthenaPrevio ? 'Kit Athena (PréVio)' : 'Kit Athena ✓'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SolicRow({ municipio, status, data, nup }: {
  municipio: string; status: string; data?: string; nup?: string; cor?: keyof typeof SECTION_COLORS;
}) {
  const regiao = getRegiao(municipio);
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
      {STATUS_ICON[status] || <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{municipio}</span>
          {regiao && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{regiao}</span>}
          <span className="text-[10px] text-muted-foreground">{status}</span>
          {nup && <span className="text-[10px] text-muted-foreground font-mono">NUP: {nup}</span>}
        </div>
        {data && <p className="text-xs text-muted-foreground">Solicitado em {new Date(data + 'T00:00:00').toLocaleDateString('pt-BR')}</p>}
      </div>
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <p className="text-sm text-muted-foreground/60 italic text-center py-3">{msg}</p>;
}

function SubTitle({ label, count }: { label: string; count: number }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2 mb-1">
      {label} <span className="font-bold text-foreground">({count})</span>
    </p>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function RelatorioEVM() {
  const { equipamentos } = useEquipamentos();
  const { solicitacoes } = useSolicitacoes();
  const { viaturas }     = useViaturas();
  const { qualificacoes } = useQualificacoes();
  const { patrulhas }    = usePatrulhas();

  // ── Dados do mapa — lidos do contexto (populado pelo Mapa.tsx) ────────────
  const {
    geoJsonData,
    municipioColors: municipioColorsCtx,
    mapaStats,
    mapaEquipmentCounts,
  } = useMapaContext();

  const [incluirMapa,        setIncluirMapa]        = useState(true);
  const [exporting,          setExporting]           = useState(false);
  const [exportingDiag,      setExportingDiag]       = useState(false);
  const [dataRef,            setDataRef]             = useState(new Date().toISOString().split('T')[0]);
  const [regiaoFiltro,       setRegiaoFiltro]        = useState('all');
  const [secoesAtivas,       setSecoesAtivas]        = useState<Set<SecaoId>>(new Set(SECOES.map(s => s.id)));
  // Item 5 — threshold configurável
  const [diasSemMovimento,   setDiasSemMovimento]    = useState(60);

  // ── Dados filtrados por região ─────────────────────────────────────────────
  const dadosFiltrados = useMemo(() => {
    const filtrarRegiao = <T extends { municipio: string }>(arr: T[]) =>
      regiaoFiltro === 'all' ? arr : arr.filter(i => getRegiao(i.municipio) === regiaoFiltro);

    const equips = filtrarRegiao(equipamentos);
    const sols   = filtrarRegiao(solicitacoes);
    const viats  = filtrarRegiao(viaturas);

    const cmb            = equips.filter(e => e.tipo === 'Casa da Mulher Brasileira');
    const cmc            = equips.filter(e => e.tipo === 'Casa da Mulher Cearense');
    const cmm            = equips.filter(e => e.tipo === 'Casa da Mulher Municipal');
    const lilasMunicipal = equips.filter(e => e.tipo === 'Sala Lilás Municipal');
    const lilasEstado    = equips.filter(e => e.tipo === 'Sala Lilás Governo do Estado');
    const lilasDelegacia = equips.filter(e => e.tipo === 'Sala Lilás em Delegacia');
    const ddm            = equips.filter(e => e.tipo === 'DDM');

    const municipiosComEquip = new Set(equips.map(e => e.municipio));

    // Sets para lookup via tabela patrulhas
    const equipIdsComPatrulha = new Set(patrulhas.filter(p => p.equipamento_id).map(p => p.equipamento_id!));
    const solicIdsComPatrulha = new Set(patrulhas.filter(p => p.solicitacao_id).map(p => p.solicitacao_id!));
    const equipsComPatrulha   = equips.filter(e => equipIdsComPatrulha.has(e.id));
    const solicsComPatrulha   = sols.filter(s => solicIdsComPatrulha.has(s.id));

    const kitAthenaTotal =
      equips.filter(e => e.kit_athena_entregue).length +
      sols.filter(s => s.kit_athena_entregue && s.status !== 'Inaugurada' && s.status !== 'Cancelada' && !municipiosComEquip.has(s.municipio)).length;

    const qualificacaoTotal =
      equips.filter(e => e.capacitacao_realizada).length +
      sols.filter(s => s.capacitacao_realizada && s.status !== 'Inaugurada' && s.status !== 'Cancelada' && !municipiosComEquip.has(s.municipio)).length;

    const getSolics = (tipo: string) =>
      sols.filter(s => s.tipo_equipamento === tipo && s.status !== 'Cancelada' && s.status !== 'Inaugurada')
          .sort((a, b) => a.status.localeCompare(b.status));

    return {
      cmb, cmc, cmm, lilasMunicipal, lilasEstado, lilasDelegacia, ddm,
      equipsComPatrulha, solicsComPatrulha, viats,
      cmbSolics:            getSolics('Casa da Mulher Brasileira'),
      cmcSolics:            getSolics('Casa da Mulher Cearense'),
      cmmSolics:            getSolics('Casa da Mulher Municipal'),
      lilasMunicipalSolics: getSolics('Sala Lilás Municipal'),
      lilasEstadoSolics:    getSolics('Sala Lilás Governo do Estado'),
      lilasDelegaciaSolics: getSolics('Sala Lilás em Delegacia'),
      totalPatrulhas:       equipsComPatrulha.length + solicsComPatrulha.length,
      totalViaturasPMCE:    viats.reduce((s, v) => s + v.quantidade, 0),
      solicsAtivas:         sols.filter(s => s.status !== 'Cancelada' && s.status !== 'Inaugurada'),
      kitAthenaTotal,
      qualificacaoTotal,
    };
  }, [equipamentos, solicitacoes, viaturas, patrulhas, regiaoFiltro]);

  const contagens = useMemo((): Record<SecaoId, number> => ({
    cmb:            equipamentos.filter(e => e.tipo === 'Casa da Mulher Brasileira').length,
    cmc:            equipamentos.filter(e => e.tipo === 'Casa da Mulher Cearense').length,
    cmm:            equipamentos.filter(e => e.tipo === 'Casa da Mulher Municipal').length,
    lilasMunicipal: equipamentos.filter(e => e.tipo === 'Sala Lilás Municipal').length,
    lilasEstado:    equipamentos.filter(e => e.tipo === 'Sala Lilás Governo do Estado').length,
    lilasDelegacia: equipamentos.filter(e => e.tipo === 'Sala Lilás em Delegacia').length,
    ddm:            equipamentos.filter(e => e.tipo === 'DDM').length,
    patrulha:       patrulhas.length,
    viaturas:       viaturas.reduce((s, v) => s + v.quantidade, 0),
  }), [equipamentos, viaturas]);

  const dados = dadosFiltrados;

  const filtrosDiag = {
    regiaoFiltro:    regiaoFiltro === 'all' ? undefined : regiaoFiltro,
    diasSemMovimento,
  };

  // Normalização — usada para lookup no mapa vetorial
  const normalizarNomeRef = (nome: string) => {
    const m: Record<string,string> = {'itapagé':'itapajé','itapaje':'itapajé'};
    const k = nome.toLowerCase().trim(); return m[k] || k;
  };

  const handleExport = async (resumo = false) => {
    setExporting(true);
    try {
      await new Promise(r => setTimeout(r, 50));
      await exportCpdiToPDF({
        equipamentos, solicitacoes, viaturas,
        qualificacoes,
        dataReferencia: dataRef,
        regiaoFiltro:   regiaoFiltro === 'all' ? undefined : regiaoFiltro,
        secoesAtivas:   Array.from(secoesAtivas),
        modoResumo:     resumo,
        incluirMapa:    incluirMapa && !!geoJsonData && !!mapaStats && !!mapaEquipmentCounts,
        geoJsonData:    geoJsonData,
        // Converte Record → Map aqui, longe dos imports do lucide que sombreiam o global Map
        municipioColors: new globalThis.Map(Object.entries(municipioColorsCtx)),
        normalizeFn:    normalizarNomeRef,
        mapaStats:      mapaStats ?? undefined,
        mapaEquipmentCounts: mapaEquipmentCounts ?? undefined,
      });
      toast.success(resumo ? 'Resumo EVM exportado!' : 'Relatório EVM exportado com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar relatório EVM:', err);
      toast.error('Erro ao exportar o relatório');
    } finally {
      setExporting(false);
    }
  };

  // Item 8 — handlers do diagnóstico (PDF e Excel) usando filtrosDiag
  const handleDiagnosticoPDF = async () => {
    setExportingDiag(true);
    try {
      await exportDiagnosticoToPDF(equipamentos, solicitacoes, filtrosDiag);
      toast.success('Diagnóstico PDF exportado!');
    } catch {
      toast.error('Erro ao gerar diagnóstico');
    } finally {
      setExportingDiag(false);
    }
  };

  const handleDiagnosticoExcel = async () => {
    setExportingDiag(true);
    try {
      await new Promise(r => setTimeout(r, 50));
      exportDiagnosticoToExcel(equipamentos, solicitacoes, filtrosDiag);
      toast.success('Diagnóstico Excel exportado!');
    } catch {
      toast.error('Erro ao gerar diagnóstico Excel');
    } finally {
      setExportingDiag(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <PageHeader
          title="Relatório EVM"
          description="Rede de Proteção à Mulher — Secretaria das Mulheres do Estado do Ceará"
        />
      </div>

      {/* Painel unificado — PDF + Diagnóstico (itens 5, 6, 8) */}
      <ConfiguracaoPDF
        secoesAtivas={secoesAtivas}       setSecoesAtivas={setSecoesAtivas}
        regiaoFiltro={regiaoFiltro}       setRegiaoFiltro={setRegiaoFiltro}
        dataRef={dataRef}                 setDataRef={setDataRef}
        onExportar={handleExport}         exporting={exporting}
        contagens={contagens}
        geoJsonData={geoJsonData}
        incluirMapa={incluirMapa}         setIncluirMapa={setIncluirMapa}
        diasSemMovimento={diasSemMovimento} setDiasSemMovimento={setDiasSemMovimento}
        onDiagnosticoPDF={handleDiagnosticoPDF}
        onDiagnosticoExcel={handleDiagnosticoExcel}
        exportingDiag={exportingDiag}
      />

      {/* Cards de resumo executivo */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3 mb-8">
        {[
          { label: 'CMB',                      value: dados.cmb.length,            cor: 'bg-teal-500',    text: 'text-teal-700'    },
          { label: 'CMC',                      value: dados.cmc.length,            cor: 'bg-violet-500',  text: 'text-violet-700'  },
          { label: 'CMM',                      value: dados.cmm.length,            cor: 'bg-orange-500',  text: 'text-orange-700'  },
          { label: 'S.L. Municipal',           value: dados.lilasMunicipal.length, cor: 'bg-fuchsia-800', text: 'text-fuchsia-900' },
          { label: 'S.L. Estado',              value: dados.lilasEstado.length,    cor: 'bg-fuchsia-500', text: 'text-fuchsia-700' },
          { label: 'S.L. Delegacia',           value: dados.lilasDelegacia.length, cor: 'bg-fuchsia-300', text: 'text-fuchsia-600' },
          { label: 'DDM',                      value: dados.ddm.length,            cor: 'bg-green-700',   text: 'text-green-900'   },
          { label: 'Patrulhas',                value: dados.totalPatrulhas,        cor: 'bg-cyan-500',    text: 'text-cyan-700'    },
          { label: 'Viaturas',                 value: dados.totalViaturasPMCE,     cor: 'bg-indigo-500',  text: 'text-indigo-700'  },
          { label: 'Em andamento',             value: dados.solicsAtivas.length,   cor: 'bg-amber-500',   text: 'text-amber-700'   },
          { label: 'Kit Athena entregues',     value: dados.kitAthenaTotal,        cor: 'bg-amber-500',   text: 'text-amber-700'   },
          { label: 'Qualificações realizadas', value: dados.qualificacaoTotal,     cor: 'bg-emerald-500', text: 'text-emerald-700' },
        ].map(({ label, value, cor, text }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-xl border border-border p-3 text-center shadow-sm"
          >
            <div className={cn('w-2 h-2 rounded-full mx-auto mb-2', cor)} />
            <p className={cn('text-2xl font-bold', text)}>{value}</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Indicador de filtro ativo */}
      {regiaoFiltro !== 'all' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-xl text-sm"
        >
          <Filter className="w-4 h-4 text-primary" />
          <span className="text-primary font-medium">Exibindo apenas: {regiaoFiltro}</span>
          <button
            onClick={() => setRegiaoFiltro('all')}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Limpar filtro
          </button>
        </motion.div>
      )}

      {/* Seções */}
      {/* Set para lookup de patrulha nas linhas de equipamento */}
      {(() => {
        const equipIdsComPatrulhaSet = new Set(dados.equipsComPatrulha.map(e => e.id));
        return (
      <div className="space-y-4">
        <SectionCard numero={1} titulo="Casa da Mulher Brasileira (CMB)" cor="cmb"
          funcionando={dados.cmb.length} emAndamento={dados.cmbSolics.length} delay={0.1}>
          {dados.cmb.length > 0
            ? <><SubTitle label="Em funcionamento" count={dados.cmb.length} />{dados.cmb.map(e => <EquipRow key={e.id} municipio={e.municipio} tipo={e.tipo} endereco={e.endereco} responsavel={e.responsavel} patrulha={equipIdsComPatrulhaSet.has(e.id)} cor="cmb" />)}</>
            : <EmptyState msg="Nenhuma CMB em funcionamento." />}
          {dados.cmbSolics.length > 0 && <><SubTitle label="Em construção / Previstas" count={dados.cmbSolics.length} />{dados.cmbSolics.map(s => <SolicRow key={s.id} municipio={s.municipio} status={s.status} data={s.data_solicitacao} nup={s.nup} />)}</>}
        </SectionCard>

        <SectionCard numero={2} titulo="Casa da Mulher Cearense (CMC)" cor="cmc"
          funcionando={dados.cmc.length} emAndamento={dados.cmcSolics.length} delay={0.15}>
          {dados.cmc.length > 0
            ? <><SubTitle label="Em funcionamento" count={dados.cmc.length} />{dados.cmc.map(e => <EquipRow key={e.id} municipio={e.municipio} tipo={e.tipo} endereco={e.endereco} responsavel={e.responsavel} patrulha={equipIdsComPatrulhaSet.has(e.id)} cor="cmc" />)}</>
            : <EmptyState msg="Nenhuma CMC em funcionamento." />}
          {dados.cmcSolics.length > 0 && <><SubTitle label="Em construção / Previstas" count={dados.cmcSolics.length} />{dados.cmcSolics.map(s => <SolicRow key={s.id} municipio={s.municipio} status={s.status} data={s.data_solicitacao} nup={s.nup} />)}</>}
        </SectionCard>

        <SectionCard numero={3} titulo="Casa da Mulher Municipal (CMM)" cor="cmm"
          funcionando={dados.cmm.length} emAndamento={dados.cmmSolics.length} delay={0.2}>
          {dados.cmm.length > 0
            ? <><SubTitle label="Em funcionamento" count={dados.cmm.length} />{dados.cmm.map(e => <EquipRow key={e.id} municipio={e.municipio} tipo={e.tipo} endereco={e.endereco} responsavel={e.responsavel} patrulha={equipIdsComPatrulhaSet.has(e.id)} cor="cmm" />)}</>
            : <EmptyState msg="Nenhuma CMM em funcionamento." />}
          {dados.cmmSolics.length > 0 && <><SubTitle label="Em construção / Previstas" count={dados.cmmSolics.length} />{dados.cmmSolics.map(s => <SolicRow key={s.id} municipio={s.municipio} status={s.status} data={s.data_solicitacao} nup={s.nup} />)}</>}
        </SectionCard>

        <SectionCard numero={4} titulo="Salas Lilás Municipal" cor="lilasMunicipal"
          funcionando={dados.lilasMunicipal.length} emAndamento={dados.lilasMunicipalSolics.length} delay={0.25}>
          {dados.lilasMunicipal.length > 0
            ? <><SubTitle label="Em funcionamento" count={dados.lilasMunicipal.length} />{dados.lilasMunicipal.map(e => <EquipRow key={e.id} municipio={e.municipio} tipo={e.tipo} endereco={e.endereco} responsavel={e.responsavel} patrulha={equipIdsComPatrulhaSet.has(e.id)} cor="lilasMunicipal" />)}</>
            : <EmptyState msg="Nenhuma Sala Lilás Municipal em funcionamento." />}
          {dados.lilasMunicipalSolics.length > 0 && <><SubTitle label="Em andamento" count={dados.lilasMunicipalSolics.length} />{dados.lilasMunicipalSolics.map(s => <SolicRow key={s.id} municipio={s.municipio} status={s.status} data={s.data_solicitacao} nup={s.nup} />)}</>}
        </SectionCard>

        <SectionCard numero={5} titulo="Salas Lilás Governo do Estado" cor="lilasEstado"
          funcionando={dados.lilasEstado.length} emAndamento={dados.lilasEstadoSolics.length} delay={0.3}>
          {dados.lilasEstado.length > 0
            ? <><SubTitle label="Em funcionamento" count={dados.lilasEstado.length} />{dados.lilasEstado.map(e => <EquipRow key={e.id} municipio={e.municipio} tipo={e.tipo} endereco={e.endereco} responsavel={e.responsavel} patrulha={equipIdsComPatrulhaSet.has(e.id)} cor="lilasEstado" extra={e.observacoes || undefined} />)}</>
            : <EmptyState msg="Nenhuma Sala Lilás Governo do Estado em funcionamento." />}
          {dados.lilasEstadoSolics.length > 0 && <><SubTitle label="Em andamento" count={dados.lilasEstadoSolics.length} />{dados.lilasEstadoSolics.map(s => <SolicRow key={s.id} municipio={s.municipio} status={s.status} />)}</>}
        </SectionCard>

        <SectionCard numero={6} titulo="Salas Lilás em Delegacia" cor="lilasDelegacia"
          funcionando={dados.lilasDelegacia.length} emAndamento={dados.lilasDelegaciaSolics.length} delay={0.35}>
          {dados.lilasDelegacia.length > 0
            ? <><SubTitle label="Em funcionamento" count={dados.lilasDelegacia.length} />{dados.lilasDelegacia.map(e => <EquipRow key={e.id} municipio={e.municipio} tipo={e.tipo} endereco={e.endereco} responsavel={e.responsavel} patrulha={equipIdsComPatrulhaSet.has(e.id)} cor="lilasDelegacia" kitAthena={e.kit_athena_entregue} kitAthenaPrevio={e.kit_athena_previo} />)}</>
            : <EmptyState msg="Nenhuma Sala Lilás em Delegacia em funcionamento." />}
          {dados.lilasDelegaciaSolics.length > 0 && <><SubTitle label="Em andamento" count={dados.lilasDelegaciaSolics.length} />{dados.lilasDelegaciaSolics.map(s => <SolicRow key={s.id} municipio={s.municipio} status={s.status} />)}</>}
        </SectionCard>

        <SectionCard numero={7} titulo="Delegacias de Defesa da Mulher (DDM)" cor="ddm"
          funcionando={dados.ddm.length} emAndamento={0}
          observacao="Gerenciadas pela Polícia Civil do Ceará — não passam pelo fluxo de solicitações desta Secretaria."
          delay={0.3}>
          {dados.ddm.length > 0
            ? <><SubTitle label="Em funcionamento" count={dados.ddm.length} />{dados.ddm.map(e => <EquipRow key={e.id} municipio={e.municipio} tipo={e.tipo} endereco={e.endereco} responsavel={e.responsavel} cor="ddm" />)}</>
            : <EmptyState msg="Nenhuma DDM cadastrada." />}
        </SectionCard>

        <SectionCard numero={8} titulo="Patrulhas Maria da Penha" cor="patrulha"
          funcionando={dados.totalPatrulhas} emAndamento={0} delay={0.35}>
          {dados.equipsComPatrulha.length > 0 && (
            <><SubTitle label="Vinculadas a equipamentos" count={dados.equipsComPatrulha.length} />
              {dados.equipsComPatrulha.map(e => (
                <div key={e.id} className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
                  <ShieldCheck className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{e.municipio}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{getRegiao(e.municipio)}</span>
                      <span className="text-[10px] text-cyan-700 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded-full">via {e.tipo}</span>
                    </div>
                    {e.endereco && <p className="text-xs text-muted-foreground">{e.endereco}</p>}
                  </div>
                </div>
              ))}
            </>
          )}
          {dados.solicsComPatrulha.length > 0 && (
            <><SubTitle label="Aguardando equipamento" count={dados.solicsComPatrulha.length} />
              {dados.solicsComPatrulha.map(s => <SolicRow key={s.id} municipio={s.municipio} status={s.status} data={s.data_solicitacao} nup={s.nup} />)}
            </>
          )}
          {dados.totalPatrulhas === 0 && <EmptyState msg="Nenhuma Patrulha Maria da Penha cadastrada." />}
        </SectionCard>

        <SectionCard numero={9} titulo="Viaturas PMCE" cor="viaturas"
          funcionando={dados.totalViaturasPMCE} emAndamento={0} delay={0.4}>
          {dados.viats.length > 0 ? (
            <>
              <SubTitle label="Total de viaturas cadastradas" count={dados.viats.length} />
              {dados.viats.sort((a, b) => a.municipio.localeCompare(b.municipio, 'pt-BR')).map(v => (
                <div key={v.id} className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-indigo-500" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{v.municipio}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{getRegiao(v.municipio)}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 border border-indigo-500/20">{v.orgao_responsavel}</span>
                      <span className="text-[10px] font-bold text-indigo-700">{v.quantidade} viatura{v.quantidade !== 1 ? 's' : ''}</span>
                    </div>
                    {v.tipo_patrulha && <p className="text-xs text-muted-foreground">{v.tipo_patrulha}</p>}
                  </div>
                </div>
              ))}
              <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total de viaturas</span>
                <span className="text-xl font-bold text-indigo-700">{dados.totalViaturasPMCE}</span>
              </div>
            </>
          ) : <EmptyState msg="Nenhuma viatura PMCE cadastrada." />}
        </SectionCard>

        {/* ── Seção 10: Qualificações ── */}
        {qualificacoes.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Qualificações Realizadas</h3>
                  <p className="text-xs text-muted-foreground">
                    {qualificacoes.length} curso{qualificacoes.length !== 1 ? 's' : ''} · {qualificacoes.reduce((s, q) => s + q.total_pessoas, 0).toLocaleString('pt-BR')} pessoas qualificadas
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { exportQualificacoesToPDF(qualificacoes).catch(console.error); }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
                <button
                  onClick={() => exportQualificacoesToExcel(qualificacoes)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-violet-500/5 border-b border-border">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Curso</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ministrante</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Pessoas</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Municípios</th>
                  </tr>
                </thead>
                <tbody>
                  {qualificacoes.map((q, i) => (
                    <tr key={q.id} className={cn('border-b border-border/50 last:border-0', i % 2 === 0 ? '' : 'bg-muted/20')}>
                      <td className="px-4 py-3 font-medium">{q.nome}</td>
                      <td className="px-4 py-3 text-muted-foreground">{q.ministrante}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {new Date(q.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {q.total_pessoas.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {q.municipios.length > 0 ? (
                          <span className="flex items-center justify-end gap-1">
                            <MapPin className="w-3 h-3" />{q.municipios.length}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-violet-500/5 border-t border-border">
                    <td colSpan={3} className="px-4 py-3 font-semibold">Total</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      {qualificacoes.reduce((s, q) => s + q.total_pessoas, 0).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {new Set(qualificacoes.flatMap(q => q.municipios.map(m => m.municipio))).size} únicos
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
        );
      })()}
    </AppLayout>
  );
}