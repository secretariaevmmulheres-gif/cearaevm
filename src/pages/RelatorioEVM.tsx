import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { useEquipamentos } from '@/hooks/useEquipamentos';
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import { useViaturas } from '@/hooks/useViaturas';
import { getRegiao, regioesList } from '@/data/municipios';
import { exportCpdiToPDF, exportDiagnosticoToPDF } from '@/lib/exportUtils';
import { useMapaContext, MapaCapturada } from '@/contexts/MapaContext';
import { cn } from '@/lib/utils';
import {
  Download, ShieldCheck, Loader2,
  CheckCircle2, Clock, AlertCircle, LayoutList,
  Filter, X, Settings2, Map, ImageOff,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Definição das seções disponíveis ──────────────────────────────────────────
const SECOES = [
  { id: 'cmb',           label: 'Casa da Mulher Brasileira (CMB)', cor: 'bg-teal-500',    dot: 'bg-teal-500'    },
  { id: 'cmc',           label: 'Casa da Mulher Cearense (CMC)',   cor: 'bg-violet-500',  dot: 'bg-violet-500'  },
  { id: 'cmm',           label: 'Casa da Mulher Municipal (CMM)',  cor: 'bg-orange-500',  dot: 'bg-orange-500'  },
  { id: 'lilasMunicipal',  label: 'Salas Lilás Municipal',           cor: 'bg-fuchsia-800', dot: 'bg-fuchsia-800' },
  { id: 'lilasEstado',    label: 'Salas Lilás Gov. Estado',         cor: 'bg-fuchsia-500', dot: 'bg-fuchsia-500' },
  { id: 'lilasDelegacia', label: 'Salas Lilás em Delegacia',        cor: 'bg-fuchsia-300', dot: 'bg-fuchsia-300' },
  { id: 'ddm',           label: 'Delegacias de Defesa da Mulher (DDM)', cor: 'bg-green-700', dot: 'bg-green-700' },
  { id: 'patrulha',      label: 'Patrulhas Maria da Penha',        cor: 'bg-cyan-500',    dot: 'bg-cyan-500'    },
  { id: 'viaturas',      label: 'Viaturas PMCE',                   cor: 'bg-indigo-500',  dot: 'bg-indigo-500'  },
] as const;

type SecaoId = typeof SECOES[number]['id'];

// ── Cores por tipo ────────────────────────────────────────────────────────────
const SECTION_COLORS = {
  cmb:           { bg: 'bg-teal-500/10',   text: 'text-teal-700',   border: 'border-teal-500/20',   dot: 'bg-teal-500'   },
  cmc:           { bg: 'bg-violet-500/10', text: 'text-violet-700', border: 'border-violet-500/20', dot: 'bg-violet-500' },
  cmm:           { bg: 'bg-orange-500/10', text: 'text-orange-700', border: 'border-orange-500/20', dot: 'bg-orange-500' },
  lilasMunicipal:  { bg: 'bg-fuchsia-800/10', text: 'text-fuchsia-900', border: 'border-fuchsia-800/20', dot: 'bg-fuchsia-800' },
  lilasEstado:     { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-700', border: 'border-fuchsia-500/20', dot: 'bg-fuchsia-500' },
  lilasDelegacia:  { bg: 'bg-fuchsia-300/10', text: 'text-fuchsia-600', border: 'border-fuchsia-300/20', dot: 'bg-fuchsia-300' },
  ddm:             { bg: 'bg-green-700/10',   text: 'text-green-800',  border: 'border-green-700/20',  dot: 'bg-green-700'  },
  patrulha:      { bg: 'bg-cyan-500/10',   text: 'text-cyan-700',   border: 'border-cyan-500/20',   dot: 'bg-cyan-500'   },
  viaturas:      { bg: 'bg-indigo-500/10', text: 'text-indigo-700', border: 'border-indigo-500/20', dot: 'bg-indigo-500' },
};

const STATUS_ICON: Record<string, JSX.Element> = {
  'Inaugurada':       <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />,
  'Em implantação':   <Clock className="w-3.5 h-3.5 text-violet-500 shrink-0" />,
  'Aprovada':         <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />,
  'Em análise':       <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />,
  'Recebida':         <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />,
  'Cancelada':        <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
};

// ── Painel de configuração do PDF ─────────────────────────────────────────────
function ConfiguracaoPDF({
  secoesAtivas, setSecoesAtivas,
  regiaoFiltro, setRegiaoFiltro,
  dataRef, setDataRef,
  onExportar, exporting,
  contagens,
  mapaCapturado, dataCapturaMap,
  incluirMapa, setIncluirMapa,
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
  mapaCapturado: MapaCapturada | null;
  dataCapturaMap: Date | null;
  incluirMapa: boolean;
  setIncluirMapa: (v: boolean) => void;
}) {
  const toggleSecao = (id: SecaoId) => {
    const novo = new Set(secoesAtivas);
    if (novo.has(id)) { novo.delete(id); } else { novo.add(id); }
    setSecoesAtivas(novo);
  };
  const toggleTudo = () => {
    if (secoesAtivas.size === SECOES.length) {
      setSecoesAtivas(new Set());
    } else {
      setSecoesAtivas(new Set(SECOES.map(s => s.id)));
    }
  };

  const todosAtivos = secoesAtivas.size === SECOES.length;
  const nenhum = secoesAtivas.size === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden mb-6"
    >
      {/* Header do painel */}
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
            <button
              onClick={toggleTudo}
              className="text-xs text-primary hover:underline font-medium"
            >
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

        {/* Preview do que vai gerar */}
        {secoesAtivas.size > 0 && (
          <div className="bg-muted/40 rounded-xl px-4 py-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">O PDF vai incluir:</span>{' '}
            {Array.from(secoesAtivas).map(id => SECOES.find(s => s.id === id)?.label).join(' · ')}
            {regiaoFiltro !== 'all' && <span className="text-primary font-medium"> — apenas {regiaoFiltro}</span>}
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
            mapaCapturado && incluirMapa
              ? 'border-primary/30 bg-primary/5'
              : 'border-border bg-muted/30'
          )}>
            {mapaCapturado ? (
              <>
                <img
                  src={mapaCapturado.dataUrl}
                  alt="Preview mapa"
                  className="w-20 h-14 object-cover rounded-lg border border-border shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Imagem capturada</p>
                  {dataCapturaMap && (
                    <p className="text-xs text-muted-foreground">
                      {dataCapturaMap.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — {dataCapturaMap.toLocaleDateString('pt-BR')}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground/60">
                    {mapaCapturado.width}×{mapaCapturado.height}px
                  </p>
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
                <ImageOff className="w-5 h-5 shrink-0" />
                <div>
                  <p className="text-sm">Nenhuma captura disponível</p>
                  <p className="text-xs">
                    Acesse a página{' '}
                    <a href="/mapa" className="text-primary hover:underline font-medium">
                      Mapa <Map className="w-3 h-3 inline" />
                    </a>
                    {' '}e clique em "Exportar PDF" para capturar e salvar automaticamente.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Botões exportar */}
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
      </div>
    </motion.div>
  );
}

// ── Card de seção ─────────────────────────────────────────────────────────────
function SectionCard({
  numero, titulo, cor, funcionando, emAndamento, observacao, children, delay,
}: {
  numero: number;
  titulo: string;
  cor: keyof typeof SECTION_COLORS;
  funcionando: number;
  emAndamento: number;
  observacao?: string;
  children: React.ReactNode;
  delay: number;
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
        <div className="px-5 pb-5 pt-3 bg-card space-y-3">
          {children}
        </div>
      )}
    </motion.div>
  );
}

function EquipRow({ municipio, tipo, endereco, responsavel, patrulha, cor, extra, kitAthena, kitAthenaPrevio }: {
  municipio: string; tipo: string; endereco?: string;
  responsavel?: string; patrulha?: boolean; cor: keyof typeof SECTION_COLORS;
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
          {tipo !== 'Casa da Mulher Brasileira' && tipo !== 'Casa da Mulher Cearense' && tipo !== 'Casa da Mulher Municipal' && (
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
        {extra && (
          <p className="text-xs text-muted-foreground mt-0.5 italic truncate">{extra}</p>
        )}
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

function SolicRow({ municipio, status, data, nup, cor }: {
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
        <p className="text-xs text-muted-foreground">Solicitado em {new Date(data + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
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
  const { viaturas } = useViaturas();
  const { mapaCapturado, dataCapturaMap } = useMapaContext();
  const [incluirMapa, setIncluirMapa] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportingDiag, setExportingDiag] = useState(false);
  const [dataRef, setDataRef] = useState(new Date().toISOString().split('T')[0]);
  const [regiaoFiltro, setRegiaoFiltro] = useState('all');
  const [secoesAtivas, setSecoesAtivas] = useState<Set<SecaoId>>(
    new Set(SECOES.map(s => s.id))
  );

  // ── Dados filtrados por região ─────────────────────────────────────────────
  const dadosFiltrados = useMemo(() => {
    const filtrarRegiao = <T extends { municipio: string }>(arr: T[]) =>
      regiaoFiltro === 'all' ? arr : arr.filter(i => getRegiao(i.municipio) === regiaoFiltro);

    const equips = filtrarRegiao(equipamentos);
    const sols   = filtrarRegiao(solicitacoes);
    const viats  = filtrarRegiao(viaturas);

    const cmb           = equips.filter(e => e.tipo === 'Casa da Mulher Brasileira');
    const cmc           = equips.filter(e => e.tipo === 'Casa da Mulher Cearense');
    const cmm           = equips.filter(e => e.tipo === 'Casa da Mulher Municipal');
    const lilasMunicipal  = equips.filter(e => e.tipo === 'Sala Lilás Municipal');
    const lilasEstado     = equips.filter(e => e.tipo === 'Sala Lilás Governo do Estado');
    const lilasDelegacia  = equips.filter(e => e.tipo === 'Sala Lilás em Delegacia');
    const ddm           = equips.filter(e => e.tipo === 'DDM');

    const municipiosComEquip = new Set(equips.map(e => e.municipio));
    const municipiosComPatrulhaEquip = new Set(equips.filter(e => e.possui_patrulha).map(e => e.municipio));
    const equipsComPatrulha  = equips.filter(e => e.possui_patrulha);
    const solicsComPatrulha  = sols.filter(s => s.recebeu_patrulha && !municipiosComPatrulhaEquip.has(s.municipio));

    const kitAthenaTotal =
      equips.filter(e => e.kit_athena_entregue).length +
      sols.filter(s =>
        s.kit_athena_entregue &&
        s.status !== 'Inaugurada' &&
        s.status !== 'Cancelada' &&
        !municipiosComEquip.has(s.municipio)
      ).length;

    const qualificacaoTotal =
      equips.filter(e => e.capacitacao_realizada).length +
      sols.filter(s =>
        s.capacitacao_realizada &&
        s.status !== 'Inaugurada' &&
        s.status !== 'Cancelada' &&
        !municipiosComEquip.has(s.municipio)
      ).length;

    const getSolics = (tipo: string) => sols.filter(
      s => s.tipo_equipamento === tipo && s.status !== 'Cancelada' && s.status !== 'Inaugurada'
    ).sort((a, b) => a.status.localeCompare(b.status));

    return {
      cmb, cmc, cmm, lilasMunicipal, lilasEstado, lilasDelegacia, ddm,
      equipsComPatrulha, solicsComPatrulha,
      viats,
      cmbSolics:             getSolics('Casa da Mulher Brasileira'),
      cmcSolics:             getSolics('Casa da Mulher Cearense'),
      cmmSolics:             getSolics('Casa da Mulher Municipal'),
      lilasMunicipalSolics:  getSolics('Sala Lilás Municipal'),
      lilasEstadoSolics:     getSolics('Sala Lilás Governo do Estado'),
      lilasDelegaciaSolics:  getSolics('Sala Lilás em Delegacia'),
      totalPatrulhas:        equipsComPatrulha.length + solicsComPatrulha.length,
      totalViaturasPMCE:     viats.reduce((s, v) => s + v.quantidade, 0),
      solicsAtivas:          sols.filter(s => s.status !== 'Cancelada' && s.status !== 'Inaugurada'),
      kitAthenaTotal,
      qualificacaoTotal,
    };
  }, [equipamentos, solicitacoes, viaturas, regiaoFiltro]);

  // ── Contagens para o painel de config ─────────────────────────────────────
  const contagens = useMemo((): Record<SecaoId, number> => ({
    cmb:           equipamentos.filter(e => e.tipo === 'Casa da Mulher Brasileira').length,
    cmc:           equipamentos.filter(e => e.tipo === 'Casa da Mulher Cearense').length,
    cmm:           equipamentos.filter(e => e.tipo === 'Casa da Mulher Municipal').length,
    lilasMunicipal:  equipamentos.filter(e => e.tipo === 'Sala Lilás Municipal').length,
    lilasEstado:     equipamentos.filter(e => e.tipo === 'Sala Lilás Governo do Estado').length,
    lilasDelegacia:  equipamentos.filter(e => e.tipo === 'Sala Lilás em Delegacia').length,
    ddm:           equipamentos.filter(e => e.tipo === 'DDM').length,
    patrulha:      equipamentos.filter(e => e.possui_patrulha).length,
    viaturas:      viaturas.reduce((s, v) => s + v.quantidade, 0),
  }), [equipamentos, viaturas]);

  const dados = dadosFiltrados;

  const handleExport = async (resumo = false) => {
    setExporting(true);
    try {
      await new Promise(r => setTimeout(r, 50));
      await exportCpdiToPDF({
        equipamentos,
        solicitacoes,
        viaturas,
        dataReferencia: dataRef,
        regiaoFiltro:   regiaoFiltro === 'all' ? undefined : regiaoFiltro,
        secoesAtivas:   Array.from(secoesAtivas),
        mapaImagem:     incluirMapa && mapaCapturado ? mapaCapturado : undefined,
        modoResumo:     resumo,
      });
      toast.success(resumo ? 'Resumo EVM exportado!' : 'Relatório EVM exportado com sucesso!');
    } catch {
      toast.error('Erro ao exportar o relatório');
    } finally {
      setExporting(false);
    }
  };
  const handleDiagnostico = async () => {
    setExportingDiag(true);
    try {
      await new Promise(r => setTimeout(r, 50));
      exportDiagnosticoToPDF(equipamentos, solicitacoes, {
        regiaoFiltro: regiaoFiltro === 'all' ? undefined : regiaoFiltro,
        diasSemMovimento: 60,
      });
      toast.success('Diagnóstico de pendências exportado!');
    } catch {
      toast.error('Erro ao gerar diagnóstico');
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

      {/* Painel de configuração */}
      <ConfiguracaoPDF
        secoesAtivas={secoesAtivas}
        setSecoesAtivas={setSecoesAtivas}
        regiaoFiltro={regiaoFiltro}
        setRegiaoFiltro={setRegiaoFiltro}
        dataRef={dataRef}
        setDataRef={setDataRef}
        onExportar={handleExport}
        exporting={exporting}
        contagens={contagens}
        mapaCapturado={mapaCapturado}
        dataCapturaMap={dataCapturaMap}
        incluirMapa={incluirMapa}
        setIncluirMapa={setIncluirMapa}
      />
      {/* Botão diagnóstico */}
      <div className="flex justify-end mb-6">
        <Button
          variant="outline"
          onClick={handleDiagnostico}
          disabled={exportingDiag}
          className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
        >
          {exportingDiag
            ? <><Loader2 className="w-4 h-4 animate-spin" />Gerando...</>
            : <><Download className="w-4 h-4" />Diagnóstico de Pendências</>}
        </Button>
      </div>

      {/* Cards de resumo executivo */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3 mb-8">
        {[
          { label: 'CMB',                value: dados.cmb.length,             cor: 'bg-teal-500',    text: 'text-teal-700'    },
          { label: 'CMC',                value: dados.cmc.length,             cor: 'bg-violet-500',  text: 'text-violet-700'  },
          { label: 'CMM',                value: dados.cmm.length,             cor: 'bg-orange-500',  text: 'text-orange-700'  },
          { label: 'S.L. Municipal',     value: dados.lilasMunicipal.length,  cor: 'bg-fuchsia-800', text: 'text-fuchsia-900' },
          { label: 'S.L. Estado',        value: dados.lilasEstado.length,     cor: 'bg-fuchsia-500', text: 'text-fuchsia-700' },
          { label: 'S.L. Delegacia',     value: dados.lilasDelegacia.length,  cor: 'bg-fuchsia-300', text: 'text-fuchsia-600' },
          { label: 'DDM',                value: dados.ddm.length,             cor: 'bg-green-700',   text: 'text-green-900'   },
          { label: 'Patrulhas',          value: dados.totalPatrulhas,         cor: 'bg-cyan-500',    text: 'text-cyan-700'    },
          { label: 'Viaturas',           value: dados.totalViaturasPMCE,      cor: 'bg-indigo-500',  text: 'text-indigo-700'  },
          { label: 'Em andamento',       value: dados.solicsAtivas.length,    cor: 'bg-amber-500',   text: 'text-amber-700'   },
          { label: 'Kit Athena entregues',     value: dados.kitAthenaTotal,      cor: 'bg-amber-500',   text: 'text-amber-700'   },
          { label: 'Qualificações realizadas', value: dados.qualificacaoTotal,   cor: 'bg-emerald-500', text: 'text-emerald-700' },
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
      <div className="space-y-4">

        {/* 1. CMB */}
        <SectionCard numero={1} titulo="Casa da Mulher Brasileira (CMB)" cor="cmb"
          funcionando={dados.cmb.length} emAndamento={dados.cmbSolics.length} delay={0.1}>
          {dados.cmb.length > 0 ? (
            <>{<SubTitle label="Em funcionamento" count={dados.cmb.length} />}
              {dados.cmb.map(e => <EquipRow key={e.id} municipio={e.municipio} tipo={e.tipo} endereco={e.endereco} responsavel={e.responsavel} patrulha={e.possui_patrulha} cor="cmb" />)}
            </>
          ) : <EmptyState msg="Nenhuma CMB em funcionamento." />}
          {dados.cmbSolics.length > 0 && (
            <>{<SubTitle label="Em construção / Previstas" count={dados.cmbSolics.length} />}
              {dados.cmbSolics.map(s => <SolicRow key={s.id} municipio={s.municipio} status={s.status} data={s.data_solicitacao} nup={s.nup} />)}
            </>
          )}
        </SectionCard>

        {/* 2. CMC */}
        <SectionCard numero={2} titulo="Casa da Mulher Cearense (CMC)" cor="cmc"
          funcionando={dados.cmc.length} emAndamento={dados.cmcSolics.length} delay={0.15}>
          {dados.cmc.length > 0 ? (
            <>{<SubTitle label="Em funcionamento" count={dados.cmc.length} />}
              {dados.cmc.map(e => <EquipRow key={e.id} municipio={e.municipio} tipo={e.tipo} endereco={e.endereco} responsavel={e.responsavel} patrulha={e.possui_patrulha} cor="cmc" />)}
            </>
          ) : <EmptyState msg="Nenhuma CMC em funcionamento." />}
          {dados.cmcSolics.length > 0 && (
            <>{<SubTitle label="Em construção / Previstas" count={dados.cmcSolics.length} />}
              {dados.cmcSolics.map(s => <SolicRow key={s.id} municipio={s.municipio} status={s.status} data={s.data_solicitacao} nup={s.nup} />)}
            </>
          )}
        </SectionCard>

        {/* 3. CMM */}
        <SectionCard numero={3} titulo="Casa da Mulher Municipal (CMM)" cor="cmm"
          funcionando={dados.cmm.length} emAndamento={dados.cmmSolics.length} delay={0.2}>
          {dados.cmm.length > 0 ? (
            <>{<SubTitle label="Em funcionamento" count={dados.cmm.length} />}
              {dados.cmm.map(e => <EquipRow key={e.id} municipio={e.municipio} tipo={e.tipo} endereco={e.endereco} responsavel={e.responsavel} patrulha={e.possui_patrulha} cor="cmm" />)}
            </>
          ) : <EmptyState msg="Nenhuma CMM em funcionamento." />}
          {dados.cmmSolics.length > 0 && (
            <>{<SubTitle label="Em construção / Previstas" count={dados.cmmSolics.length} />}
              {dados.cmmSolics.map(s => <SolicRow key={s.id} municipio={s.municipio} status={s.status} data={s.data_solicitacao} nup={s.nup} />)}
            </>
          )}
        </SectionCard>

        {/* 4. Salas Lilás Municipal */}
        <SectionCard numero={4} titulo="Salas Lilás Municipal" cor="lilasMunicipal"
          funcionando={dados.lilasMunicipal.length} emAndamento={dados.lilasMunicipalSolics.length} delay={0.25}>
          {dados.lilasMunicipal.length > 0 ? (
            <>{<SubTitle label="Em funcionamento" count={dados.lilasMunicipal.length} />}
              {dados.lilasMunicipal.map(e => <EquipRow key={e.id} municipio={e.municipio} tipo={e.tipo} endereco={e.endereco} responsavel={e.responsavel} patrulha={e.possui_patrulha} cor="lilasMunicipal" />)}
            </>
          ) : <EmptyState msg="Nenhuma Sala Lilás Municipal em funcionamento." />}
          {dados.lilasMunicipalSolics.length > 0 && (
            <>{<SubTitle label="Em andamento" count={dados.lilasMunicipalSolics.length} />}
              {dados.lilasMunicipalSolics.map(s => <SolicRow key={s.id} municipio={s.municipio} status={s.status} data={s.data_solicitacao} nup={s.nup} />)}
            </>
          )}
        </SectionCard>

        {/* 5. Salas Lilás Governo do Estado */}
        <SectionCard numero={5} titulo="Salas Lilás Governo do Estado" cor="lilasEstado"
          funcionando={dados.lilasEstado.length} emAndamento={dados.lilasEstadoSolics.length} delay={0.3}>
          {dados.lilasEstado.length > 0 ? (
            <>{<SubTitle label="Em funcionamento" count={dados.lilasEstado.length} />}
              {dados.lilasEstado.map(e => <EquipRow key={e.id} municipio={e.municipio} tipo={e.tipo} endereco={e.endereco} responsavel={e.responsavel} patrulha={e.possui_patrulha} cor="lilasEstado" extra={e.observacoes || undefined} />)}
            </>
          ) : <EmptyState msg="Nenhuma Sala Lilás Governo do Estado em funcionamento." />}
          {dados.lilasEstadoSolics.length > 0 && (
            <><SubTitle label="Em andamento" count={dados.lilasEstadoSolics.length} />
              {dados.lilasEstadoSolics.map(s => <SolicRow key={s.id} municipio={s.municipio} status={s.status} cor="lilasEstado" />)}
            </>
          )}
        </SectionCard>

        {/* 6. Salas Lilás em Delegacia */}
        <SectionCard numero={6} titulo="Salas Lilás em Delegacia" cor="lilasDelegacia"
          funcionando={dados.lilasDelegacia.length} emAndamento={dados.lilasDelegaciaSolics.length} delay={0.35}>
          {dados.lilasDelegacia.length > 0 ? (
            <>{<SubTitle label="Em funcionamento" count={dados.lilasDelegacia.length} />}
              {dados.lilasDelegacia.map(e => <EquipRow key={e.id} municipio={e.municipio} tipo={e.tipo} endereco={e.endereco} responsavel={e.responsavel} patrulha={e.possui_patrulha} cor="lilasDelegacia"
                kitAthena={e.kit_athena_entregue} kitAthenaPrevio={e.kit_athena_previo} />)}
            </>
          ) : <EmptyState msg="Nenhuma Sala Lilás em Delegacia em funcionamento." />}
          {dados.lilasDelegaciaSolics.length > 0 && (
            <><SubTitle label="Em andamento" count={dados.lilasDelegaciaSolics.length} />
              {dados.lilasDelegaciaSolics.map(s => <SolicRow key={s.id} municipio={s.municipio} status={s.status} cor="lilasDelegacia" />)}
            </>
          )}
        </SectionCard>

        {/* 7. DDM */}
        <SectionCard numero={7} titulo="Delegacias de Defesa da Mulher (DDM)" cor="ddm"
          funcionando={dados.ddm.length} emAndamento={0}
          observacao="Gerenciadas pela Polícia Civil do Ceará — não passam pelo fluxo de solicitações desta Secretaria."
          delay={0.3}>
          {dados.ddm.length > 0 ? (
            <>{<SubTitle label="Em funcionamento" count={dados.ddm.length} />}
              {dados.ddm.map(e => <EquipRow key={e.id} municipio={e.municipio} tipo={e.tipo} endereco={e.endereco} responsavel={e.responsavel} cor="ddm" />)}
            </>
          ) : <EmptyState msg="Nenhuma DDM cadastrada." />}
        </SectionCard>

        {/* 8. Patrulhas */}
        <SectionCard numero={8} titulo="Patrulhas Maria da Penha" cor="patrulha"
          funcionando={dados.totalPatrulhas} emAndamento={0} delay={0.35}>
          {dados.equipsComPatrulha.length > 0 && (
            <>{<SubTitle label="Vinculadas a equipamentos" count={dados.equipsComPatrulha.length} />}
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
            <>{<SubTitle label="Aguardando equipamento" count={dados.solicsComPatrulha.length} />}
              {dados.solicsComPatrulha.map(s => <SolicRow key={s.id} municipio={s.municipio} status={s.status} data={s.data_solicitacao} nup={s.nup} />)}
            </>
          )}
          {dados.totalPatrulhas === 0 && <EmptyState msg="Nenhuma Patrulha Maria da Penha cadastrada." />}
        </SectionCard>

        {/* 9. Viaturas PMCE */}
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

      </div>
    </AppLayout>
  );
}