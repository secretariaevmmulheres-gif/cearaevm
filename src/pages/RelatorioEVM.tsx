import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { useEquipamentos } from '@/hooks/useEquipamentos';
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import { useViaturas } from '@/hooks/useViaturas';
import { getRegiao } from '@/data/municipios';
import { exportCpdiToPDF } from '@/lib/exportUtils';
import { cn } from '@/lib/utils';
import {
  Download, FileText, Building2, ShieldCheck, Loader2,
  CheckCircle2, Clock, AlertCircle, LayoutList,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Cores por tipo ────────────────────────────────────────────────────────────
const SECTION_COLORS = {
  cmb:           { bg: 'bg-teal-500/10',   text: 'text-teal-700',   border: 'border-teal-500/20',   dot: 'bg-teal-500'   },
  cmc:           { bg: 'bg-violet-500/10', text: 'text-violet-700', border: 'border-violet-500/20', dot: 'bg-violet-500' },
  cmm:           { bg: 'bg-orange-500/10', text: 'text-orange-700', border: 'border-orange-500/20', dot: 'bg-orange-500' },
  lilas:         { bg: 'bg-fuchsia-500/10',text: 'text-fuchsia-700',border: 'border-fuchsia-500/20',dot: 'bg-fuchsia-500'},
  ddm:           { bg: 'bg-green-700/10',  text: 'text-green-800',  border: 'border-green-700/20',  dot: 'bg-green-700'  },
  salaDelegacia: { bg: 'bg-green-400/10',  text: 'text-green-700',  border: 'border-green-400/20',  dot: 'bg-green-500'  },
  patrulha:      { bg: 'bg-cyan-500/10',   text: 'text-cyan-700',   border: 'border-cyan-500/20',   dot: 'bg-cyan-500'   },
};

const STATUS_ICON: Record<string, JSX.Element> = {
  'Inaugurada':       <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />,
  'Em implantação':   <Clock className="w-3.5 h-3.5 text-violet-500 shrink-0" />,
  'Aprovada':         <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />,
  'Em análise':       <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />,
  'Recebida':         <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />,
  'Cancelada':        <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
};

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
      {/* Header da seção */}
      <button
        onClick={() => setExpanded(v => !v)}
        className={cn('w-full flex items-center gap-4 px-5 py-4 text-left', c.bg)}
      >
        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0', c.dot)}>
          {numero}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('font-bold text-base', c.text)}>{titulo}</p>
          {observacao && (
            <p className="text-xs text-muted-foreground mt-0.5">{observacao}</p>
          )}
        </div>
        {/* Badges de contagem */}
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

      {/* Conteúdo expansível */}
      {expanded && (
        <div className="px-5 pb-5 pt-3 bg-card space-y-3">
          {children}
        </div>
      )}
    </motion.div>
  );
}

// ── Linha de equipamento ──────────────────────────────────────────────────────
function EquipRow({ municipio, tipo, endereco, responsavel, patrulha, cor }: {
  municipio: string; tipo: string; endereco?: string;
  responsavel?: string; patrulha?: boolean;
  cor: keyof typeof SECTION_COLORS;
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
      </div>
    </div>
  );
}

// ── Linha de solicitação ──────────────────────────────────────────────────────
function SolicRow({ municipio, status, data, nup }: {
  municipio: string; status: string; data: string; nup?: string;
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

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ msg }: { msg: string }) {
  return (
    <p className="text-sm text-muted-foreground/60 italic text-center py-3">{msg}</p>
  );
}

// ── Subtítulo de sub-lista ────────────────────────────────────────────────────
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
  const [exporting, setExporting] = useState(false);
  const [dataRef, setDataRef] = useState(new Date().toISOString().split('T')[0]);

  // ── Dados por categoria ────────────────────────────────────────────────────
  const dados = useMemo(() => {
    const cmb = equipamentos.filter(e => e.tipo === 'Casa da Mulher Brasileira');
    const cmc = equipamentos.filter(e => e.tipo === 'Casa da Mulher Cearense');
    const cmm = equipamentos.filter(e => e.tipo === 'Casa da Mulher Municipal');
    const lilas = equipamentos.filter(e => e.tipo === 'Sala Lilás');
    const salaDelegacia = equipamentos.filter(e => e.tipo === 'Sala em Delegacia');
    const ddm = equipamentos.filter(e => e.tipo === 'DDM');

    const municipiosComPatrulhaEquip = new Set(
      equipamentos.filter(e => e.possui_patrulha).map(e => e.municipio)
    );
    const equipsComPatrulha = equipamentos.filter(e => e.possui_patrulha);
    const solicsComPatrulha = solicitacoes.filter(
      s => s.recebeu_patrulha && !municipiosComPatrulhaEquip.has(s.municipio)
    );

    const getSolics = (tipo: string) => solicitacoes.filter(
      s => s.tipo_equipamento === tipo && s.status !== 'Cancelada' && s.status !== 'Inaugurada'
    ).sort((a, b) => a.status.localeCompare(b.status));


    return {
      cmb, cmc, cmm, lilas, salaDelegacia, ddm,
      equipsComPatrulha, solicsComPatrulha,
      cmbSolics: getSolics('Casa da Mulher Brasileira'),
      cmcSolics: getSolics('Casa da Mulher Cearense'),
      cmmSolics: getSolics('Casa da Mulher Municipal'),
      lilasSolics: getSolics('Sala Lilás'),
      salaDelegaciaSolics: getSolics('Sala em Delegacia'),
      totalPatrulhas: equipsComPatrulha.length + solicsComPatrulha.length,
      totalViaturasPMCE: viaturas.reduce((s, v) => s + v.quantidade, 0),
      solicsAtivas: solicitacoes.filter(s => s.status !== 'Cancelada' && s.status !== 'Inaugurada'),
    };
  }, [equipamentos, solicitacoes]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await new Promise(r => setTimeout(r, 50)); // deixa UI atualizar
      await exportCpdiToPDF({ equipamentos, solicitacoes, viaturas, dataReferencia: dataRef });
      toast.success('Relatório EVM exportado com sucesso!');
    } catch (e) {
      toast.error('Erro ao exportar o relatório');
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <PageHeader
          title="Relatório EVM"
          description="Rede de Proteção à Mulher — Secretaria das Mulheres do Estado do Ceará"
        />
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
          <Button onClick={handleExport} disabled={exporting} className="gap-2 shrink-0">
            {exporting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Download className="w-4 h-4" />}
            {exporting ? 'Gerando PDF...' : 'Exportar PDF'}
          </Button>
        </motion.div>
      </div>

      {/* Banner informativo */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 mb-6"
      >
        <div className="flex gap-3 flex-1">
          <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-primary">Relatório da Rede de Proteção</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Consolida o status atual de toda a rede de proteção à mulher no Ceará,
              conforme os dados cadastrados no sistema EVM.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-xs text-muted-foreground whitespace-nowrap">Data de referência:</label>
          <input
            type="date"
            value={dataRef}
            onChange={e => setDataRef(e.target.value)}
            className="text-sm border border-border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </motion.div>

      {/* Cards de resumo executivo */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3 mb-8">
        {[
          { label: 'CMB',             value: dados.cmb.length,           cor: 'bg-teal-500',    text: 'text-teal-700'    },
          { label: 'CMC',             value: dados.cmc.length,           cor: 'bg-violet-500',  text: 'text-violet-700'  },
          { label: 'CMM',             value: dados.cmm.length,           cor: 'bg-orange-500',  text: 'text-orange-700'  },
          { label: 'Sala Lilás',      value: dados.lilas.length,         cor: 'bg-fuchsia-500', text: 'text-fuchsia-700' },
          { label: 'Sala Deleg.',     value: dados.salaDelegacia.length, cor: 'bg-green-400',   text: 'text-green-700'   },
          { label: 'DDM',             value: dados.ddm.length,           cor: 'bg-green-700',   text: 'text-green-800'   },
          { label: 'Patrulhas M.P.', value: dados.totalPatrulhas,       cor: 'bg-cyan-500',    text: 'text-cyan-700'    },
          { label: 'Viaturas PMCE',  value: dados.totalViaturasPMCE,    cor: 'bg-indigo-500',  text: 'text-indigo-700'  },
          { label: 'Solicitações',   value: dados.solicsAtivas.length,  cor: 'bg-amber-500',   text: 'text-amber-700'   },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className="bg-card rounded-xl border border-border shadow-sm p-3 text-center"
          >
            <div className={cn('w-2 h-2 rounded-full mx-auto mb-2', item.cor)} />
            <p className={cn('text-2xl font-bold', item.text)}>{item.value}</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{item.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Seções detalhadas */}
      <div className="space-y-4">

        {/* 1. CMB */}
        <SectionCard numero={1} titulo="Casa da Mulher Brasileira (CMB)" cor="cmb"
          funcionando={dados.cmb.length} emAndamento={dados.cmbSolics.length} delay={0.1}>
          {dados.cmb.length > 0 ? (
            <>
              <SubTitle label="Em funcionamento" count={dados.cmb.length} />
              {dados.cmb.map(e => (
                <EquipRow key={e.id} municipio={e.municipio} tipo={e.tipo}
                  endereco={e.endereco} responsavel={e.responsavel} patrulha={e.possui_patrulha} cor="cmb" />
              ))}
            </>
          ) : <EmptyState msg="Nenhuma CMB em funcionamento." />}
          {dados.cmbSolics.length > 0 && (
            <>
              <SubTitle label="Em construção / Previstas" count={dados.cmbSolics.length} />
              {dados.cmbSolics.map(s => (
                <SolicRow key={s.id} municipio={s.municipio} status={s.status}
                  data={s.data_solicitacao} nup={s.suite_implantada} />
              ))}
            </>
          )}
        </SectionCard>

        {/* 2. CMC */}
        <SectionCard numero={2} titulo="Casa da Mulher Cearense (CMC)" cor="cmc"
          funcionando={dados.cmc.length} emAndamento={dados.cmcSolics.length} delay={0.15}>
          {dados.cmc.length > 0 ? (
            <>
              <SubTitle label="Em funcionamento" count={dados.cmc.length} />
              {dados.cmc.map(e => (
                <EquipRow key={e.id} municipio={e.municipio} tipo={e.tipo}
                  endereco={e.endereco} responsavel={e.responsavel} patrulha={e.possui_patrulha} cor="cmc" />
              ))}
            </>
          ) : <EmptyState msg="Nenhuma CMC em funcionamento." />}
          {dados.cmcSolics.length > 0 && (
            <>
              <SubTitle label="Em construção / Previstas" count={dados.cmcSolics.length} />
              {dados.cmcSolics.map(s => (
                <SolicRow key={s.id} municipio={s.municipio} status={s.status}
                  data={s.data_solicitacao} nup={s.suite_implantada} />
              ))}
            </>
          )}
        </SectionCard>

        {/* 3. CMM */}
        <SectionCard numero={3} titulo="Casa da Mulher Municipal (CMM)" cor="cmm"
          funcionando={dados.cmm.length} emAndamento={dados.cmmSolics.length} delay={0.2}>
          {dados.cmm.length > 0 ? (
            <>
              <SubTitle label="Em funcionamento" count={dados.cmm.length} />
              {dados.cmm.map(e => (
                <EquipRow key={e.id} municipio={e.municipio} tipo={e.tipo}
                  endereco={e.endereco} responsavel={e.responsavel} patrulha={e.possui_patrulha} cor="cmm" />
              ))}
            </>
          ) : <EmptyState msg="Nenhuma CMM em funcionamento." />}
          {dados.cmmSolics.length > 0 && (
            <>
              <SubTitle label="Em construção / Previstas" count={dados.cmmSolics.length} />
              {dados.cmmSolics.map(s => (
                <SolicRow key={s.id} municipio={s.municipio} status={s.status}
                  data={s.data_solicitacao} nup={s.suite_implantada} />
              ))}
            </>
          )}
        </SectionCard>

        {/* 4. Salas Lilás */}
        <SectionCard numero={4} titulo="Salas Lilás" cor="lilas"
          funcionando={dados.lilas.length} emAndamento={dados.lilasSolics.length} delay={0.25}>
          {dados.lilas.length > 0 ? (
            <>
              <SubTitle label="Em funcionamento" count={dados.lilas.length} />
              {dados.lilas.map(e => (
                <EquipRow key={e.id} municipio={e.municipio} tipo={e.tipo}
                  endereco={e.endereco} responsavel={e.responsavel} patrulha={e.possui_patrulha} cor="lilas" />
              ))}
            </>
          ) : <EmptyState msg="Nenhuma Sala Lilás em funcionamento." />}
          {dados.lilasSolics.length > 0 && (
            <>
              <SubTitle label="Previstas" count={dados.lilasSolics.length} />
              {dados.lilasSolics.map(s => (
                <SolicRow key={s.id} municipio={s.municipio} status={s.status}
                  data={s.data_solicitacao} nup={s.suite_implantada} />
              ))}
            </>
          )}
        </SectionCard>

        {/* 5. Sala em Delegacia */}
        <SectionCard numero={5} titulo="Salas em Delegacia (Polícia Civil)" cor="salaDelegacia"
          funcionando={dados.salaDelegacia.length} emAndamento={dados.salaDelegaciaSolics.length} delay={0.28}>
          {dados.salaDelegacia.length > 0 ? (
            <>
              <SubTitle label="Em funcionamento" count={dados.salaDelegacia.length} />
              {dados.salaDelegacia.map(e => (
                <EquipRow key={e.id} municipio={e.municipio} tipo={e.tipo}
                  endereco={e.endereco} responsavel={e.responsavel} patrulha={e.possui_patrulha} cor="salaDelegacia" />
              ))}
            </>
          ) : <EmptyState msg="Nenhuma Sala em Delegacia em funcionamento." />}
          {dados.salaDelegaciaSolics.length > 0 && (
            <>
              <SubTitle label="Previstas" count={dados.salaDelegaciaSolics.length} />
              {dados.salaDelegaciaSolics.map(s => (
                <SolicRow key={s.id} municipio={s.municipio} status={s.status}
                  data={s.data_solicitacao} nup={s.suite_implantada} />
              ))}
            </>
          )}
        </SectionCard>

        {/* 6. DDM */}
        <SectionCard numero={6} titulo="Delegacias de Defesa da Mulher (DDM)" cor="ddm"
          funcionando={dados.ddm.length} emAndamento={0}
          observacao="Gerenciadas pela Polícia Civil do Ceará — não passam pelo fluxo de solicitações desta Secretaria."
          delay={0.3}>
          {dados.ddm.length > 0 ? (
            <>
              <SubTitle label="Em funcionamento" count={dados.ddm.length} />
              {dados.ddm.map(e => (
                <EquipRow key={e.id} municipio={e.municipio} tipo={e.tipo}
                  endereco={e.endereco} responsavel={e.responsavel} cor="ddm" />
              ))}
            </>
          ) : <EmptyState msg="Nenhuma DDM cadastrada." />}
        </SectionCard>

        {/* 7. Patrulhas Maria da Penha */}
        <SectionCard numero={7} titulo="Patrulhas Maria da Penha" cor="patrulha"
          funcionando={dados.totalPatrulhas} emAndamento={0} delay={0.35}>
          {dados.equipsComPatrulha.length > 0 && (
            <>
              <SubTitle label="Vinculadas a equipamentos" count={dados.equipsComPatrulha.length} />
              {dados.equipsComPatrulha.map(e => (
                <div key={e.id} className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
                  <ShieldCheck className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{e.municipio}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        {getRegiao(e.municipio)}
                      </span>
                      <span className="text-[10px] text-cyan-700 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded-full">
                        via {e.tipo}
                      </span>
                    </div>
                    {e.endereco && <p className="text-xs text-muted-foreground">{e.endereco}</p>}
                  </div>
                </div>
              ))}
            </>
          )}
          {dados.solicsComPatrulha.length > 0 && (
            <>
              <SubTitle label="Aguardando equipamento" count={dados.solicsComPatrulha.length} />
              {dados.solicsComPatrulha.map(s => (
                <SolicRow key={s.id} municipio={s.municipio} status={s.status}
                  data={s.data_solicitacao} nup={s.suite_implantada} />
              ))}
            </>
          )}
          {dados.totalPatrulhas === 0 && <EmptyState msg="Nenhuma Patrulha Maria da Penha cadastrada." />}
        </SectionCard>

        {/* 8. Viaturas PMCE */}
        <SectionCard numero={8} titulo="Viaturas PMCE" cor="patrulha"
          funcionando={dados.totalViaturasPMCE} emAndamento={0} delay={0.4}>
          {viaturas.length > 0 ? (
            <>
              <SubTitle label="Total de viaturas cadastradas" count={viaturas.length} />
              {viaturas.sort((a, b) => a.municipio.localeCompare(b.municipio, 'pt-BR')).map(v => (
                <div key={v.id} className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-indigo-500" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{v.municipio}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        {getRegiao(v.municipio)}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 border border-indigo-500/20">
                        {v.orgao_responsavel}
                      </span>
                      <span className="text-[10px] font-bold text-indigo-700">
                        {v.quantidade} viatura{v.quantidade !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {v.tipo_patrulha && (
                      <p className="text-xs text-muted-foreground">{v.tipo_patrulha}</p>
                    )}
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