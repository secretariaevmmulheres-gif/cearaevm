import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useEquipamentos } from '@/hooks/useEquipamentos';
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import { usePendenciasResolvidas } from '@/hooks/usePendenciasResolvidas';
import { regioesList, statusSolicitacao, StatusSolicitacao } from '@/data/municipios';
import {
  gerarDiagnostico, exportDiagnosticoToPDF, exportDiagnosticoToExcel, PendenciaMunicipio,
} from '@/lib/exportUtils';
import { Equipamento, Solicitacao } from '@/types';
import { cn } from '@/lib/utils';
import {
  CheckCircle2, Download, FileSpreadsheet, Loader2, Search, Filter, X,
  ChevronUp, ChevronDown, ChevronsUpDown, RefreshCw, Eye, EyeOff,
  ChevronDown as ExpandIcon, Pencil, ShieldCheck, Package, GraduationCap,
  Hash, MapPin, Phone, User, StickyNote, Building2, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Config visual ─────────────────────────────────────────────────────────────
const PENDENCIA_CORES: Record<string, { bg: string; text: string; border: string }> = {
  'Sem Patrulha M.P.':  { bg: 'bg-cyan-500/10',   text: 'text-cyan-700',   border: 'border-cyan-500/20'   },
  'Sem Kit Athena':     { bg: 'bg-amber-500/10',  text: 'text-amber-700',  border: 'border-amber-500/20'  },
  'Sem Qualificação':   { bg: 'bg-violet-500/10', text: 'text-violet-700', border: 'border-violet-500/20' },
  'Sem NUP registrado': { bg: 'bg-slate-500/10',  text: 'text-slate-600',  border: 'border-slate-500/20'  },
  'default':            { bg: 'bg-red-500/10',    text: 'text-red-700',    border: 'border-red-500/20'    },
};
const getPendenciaCor = (p: string) => PENDENCIA_CORES[p] ?? PENDENCIA_CORES['default'];
const ORIGEM_COR = {
  'Equipamento': { bg: 'bg-teal-500/10',  text: 'text-teal-700',  dot: 'bg-teal-500',  badge: 'border-teal-300 text-teal-700'  },
  'Solicitação': { bg: 'bg-amber-500/10', text: 'text-amber-700', dot: 'bg-amber-500', badge: 'border-amber-300 text-amber-700' },
};
const THRESHOLD_OPTIONS = [30, 45, 60, 90, 120] as const;
type SortField = 'municipio' | 'regiao' | 'tipo' | 'pendencias' | 'origem';
type SortDir   = 'asc' | 'desc';

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground/40 ml-1 shrink-0" />;
  return sortDir === 'asc'
    ? <ChevronUp   className="w-3.5 h-3.5 text-primary ml-1 shrink-0" />
    : <ChevronDown className="w-3.5 h-3.5 text-primary ml-1 shrink-0" />;
}

function PendenciaBadge({ texto, resolvido, onToggle }: { texto: string; resolvido: boolean; onToggle: () => void }) {
  const cor = getPendenciaCor(texto);
  return (
    <button onClick={e => { e.stopPropagation(); onToggle(); }}
      title={resolvido ? 'Desmarcar como resolvido' : 'Marcar como resolvido'}
      className={cn(
        'text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap transition-all',
        resolvido
          ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 line-through opacity-60'
          : cn(cor.bg, cor.text, cor.border, 'hover:opacity-80')
      )}>
      {resolvido && <CheckCircle2 className="w-2.5 h-2.5 inline mr-1" />}
      {texto}
    </button>
  );
}

// ── Linha expansível ──────────────────────────────────────────────────────────
function LinhaTabela({
  item, delay, isResolvido, onTogglePendencia, itemResolvido,
  equipamento, solicitacao, onEditEquipamento, onEditSolicitacao,
}: {
  item: PendenciaMunicipio;
  delay: number;
  isResolvido: (p: string) => boolean;
  onTogglePendencia: (p: string) => void;
  itemResolvido: boolean;
  equipamento?: Equipamento;
  solicitacao?: Solicitacao;
  onEditEquipamento: (e: Equipamento) => void;
  onEditSolicitacao: (s: Solicitacao) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const origemCor = ORIGEM_COR[item.origem as keyof typeof ORIGEM_COR] ?? ORIGEM_COR['Equipamento'];

  const detalhes = item.origem === 'Equipamento' && equipamento ? (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {[
        { icon: <MapPin className="w-3 h-3" />, label: 'Endereço', val: equipamento.endereco },
        { icon: <Phone  className="w-3 h-3" />, label: 'Telefone', val: equipamento.telefone },
        { icon: <User   className="w-3 h-3" />, label: 'Responsável', val: equipamento.responsavel },
        { icon: <Hash   className="w-3 h-3" />, label: 'NUP', val: equipamento.nup },
      ].filter(d => d.val).map(d => (
        <div key={d.label} className="flex items-start gap-2">
          <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-primary">{d.icon}</div>
          <div><p className="text-[10px] text-muted-foreground">{d.label}</p><p className="text-xs font-medium">{d.val}</p></div>
        </div>
      ))}
      <div className="flex items-start gap-2">
        <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-primary"><ShieldCheck className="w-3 h-3" /></div>
        <div><p className="text-[10px] text-muted-foreground">Patrulha M.P.</p><p className="text-xs font-medium">{equipamento.possui_patrulha ? 'Sim' : 'Não'}</p></div>
      </div>
      <div className="flex items-start gap-2">
        <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-primary"><Package className="w-3 h-3" /></div>
        <div><p className="text-[10px] text-muted-foreground">Kit Athena</p><p className="text-xs font-medium">{equipamento.kit_athena_entregue ? (equipamento.kit_athena_previo ? 'Sim (PréVio)' : 'Sim') : 'Não'}</p></div>
      </div>
      <div className="flex items-start gap-2">
        <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-primary"><GraduationCap className="w-3 h-3" /></div>
        <div><p className="text-[10px] text-muted-foreground">Qualificação</p><p className="text-xs font-medium">{equipamento.capacitacao_realizada ? 'Sim' : 'Não'}</p></div>
      </div>
      {equipamento.observacoes && (
        <div className="sm:col-span-2 lg:col-span-3 flex items-start gap-2">
          <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-primary"><StickyNote className="w-3 h-3" /></div>
          <div><p className="text-[10px] text-muted-foreground">Observações</p><p className="text-xs">{equipamento.observacoes}</p></div>
        </div>
      )}
    </div>
  ) : item.origem === 'Solicitação' && solicitacao ? (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div className="flex items-start gap-2">
        <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-primary"><Hash className="w-3 h-3" /></div>
        <div><p className="text-[10px] text-muted-foreground">NUP</p><p className="text-xs font-mono font-medium">{solicitacao.nup || '—'}</p></div>
      </div>
      <div className="flex items-start gap-2">
        <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-primary"><ShieldCheck className="w-3 h-3" /></div>
        <div><p className="text-[10px] text-muted-foreground">Patrulha M.P.</p><p className="text-xs font-medium">{solicitacao.recebeu_patrulha ? 'Sim' : 'Não'}</p></div>
      </div>
      <div className="flex items-start gap-2">
        <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-primary"><Package className="w-3 h-3" /></div>
        <div><p className="text-[10px] text-muted-foreground">Kit Athena</p><p className="text-xs font-medium">{solicitacao.kit_athena_entregue ? (solicitacao.kit_athena_previo ? 'Sim (PréVio)' : 'Sim') : 'Não'}</p></div>
      </div>
      <div className="flex items-start gap-2">
        <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-primary"><GraduationCap className="w-3 h-3" /></div>
        <div><p className="text-[10px] text-muted-foreground">Qualificação</p><p className="text-xs font-medium">{solicitacao.capacitacao_realizada ? 'Sim' : 'Não'}</p></div>
      </div>
      <div className="flex items-start gap-2">
        <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-primary"><Building2 className="w-3 h-3" /></div>
        <div><p className="text-[10px] text-muted-foreground">Guarda Municipal</p><p className="text-xs font-medium">{solicitacao.guarda_municipal_estruturada ? 'Sim' : 'Não'}</p></div>
      </div>
      <div className="flex items-start gap-2">
        <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-primary"><ArrowRight className="w-3 h-3" /></div>
        <div>
          <p className="text-[10px] text-muted-foreground">Data da Solicitação</p>
          <p className="text-xs font-medium">{format(new Date(solicitacao.data_solicitacao + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })}</p>
        </div>
      </div>
      {solicitacao.observacoes && (
        <div className="sm:col-span-2 lg:col-span-3 flex items-start gap-2">
          <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-primary"><StickyNote className="w-3 h-3" /></div>
          <div><p className="text-[10px] text-muted-foreground">Observações</p><p className="text-xs">{solicitacao.observacoes}</p></div>
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      <tr
        onClick={() => setExpanded(v => !v)}
        className={cn('cursor-pointer transition-colors', expanded ? 'bg-muted/40' : 'hover:bg-muted/20',
          itemResolvido && 'opacity-40')}
      >
        <td className="py-3 pl-3 pr-2">
          <ExpandIcon className={cn('w-4 h-4 text-muted-foreground/40 transition-transform duration-200 shrink-0', expanded && 'rotate-180')} />
        </td>
        <td className="py-3 pr-3">
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(delay, 0.2) }}>
            <div className="flex items-center gap-2">
              <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', origemCor.dot)} />
              <Link to={`/municipio/${encodeURIComponent(item.municipio)}`} className={cn('text-sm font-semibold hover:text-primary hover:underline underline-offset-2 transition-colors', itemResolvido && 'line-through text-muted-foreground')}>{item.municipio}</Link>
            </div>
          </motion.div>
        </td>
        <td className="py-3 px-3 hidden md:table-cell">
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{item.regiao}</span>
        </td>
        <td className="py-3 px-3 hidden lg:table-cell">
          <span className="text-xs text-muted-foreground max-w-[180px] truncate block">{item.tipo}</span>
        </td>
        <td className="py-3 px-3 hidden sm:table-cell">
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', origemCor.bg, origemCor.text)}>{item.origem}</span>
        </td>
        <td className="py-3 px-3">
          <div className="flex flex-wrap gap-1">
            {item.pendencias.map(p => (
              <PendenciaBadge key={p} texto={p} resolvido={isResolvido(p)} onToggle={() => onTogglePendencia(p)} />
            ))}
          </div>
          {item.diasSemMovimento !== undefined && (
            <p className="text-[10px] text-muted-foreground/60 mt-1">{item.diasSemMovimento} dias sem atualização</p>
          )}
        </td>
      </tr>

      {/* Linha expandida */}
      <AnimatePresence>
        {expanded && (
          <tr className="bg-muted/20">
            <td colSpan={6} className="p-0">
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-6 py-4 border-t border-border/50">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Detalhes do item</p>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/municipio/${encodeURIComponent(item.municipio)}`}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
                        onClick={e => e.stopPropagation()}
                      >
                        Ver ficha →
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 text-xs"
                        onClick={e => {
                          e.stopPropagation();
                          if (item.origem === 'Equipamento' && equipamento) onEditEquipamento(equipamento);
                          if (item.origem === 'Solicitação' && solicitacao) onEditSolicitacao(solicitacao);
                        }}
                      >
                        <Pencil className="w-3 h-3" /> Editar
                      </Button>
                    </div>
                  </div>
                  {detalhes ?? <p className="text-xs text-muted-foreground/60 italic">Dados não encontrados.</p>}
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Modal de Edição Equipamento ───────────────────────────────────────────────
function ModalEquipamento({
  equipamento, onClose, onSave,
}: { equipamento: Equipamento; onClose: () => void; onSave: (data: Partial<Equipamento> & { id: string }) => void }) {
  const [form, setForm] = useState({
    possui_patrulha:       equipamento.possui_patrulha,
    kit_athena_entregue:   equipamento.kit_athena_entregue,
    kit_athena_previo:     equipamento.kit_athena_previo ?? false,
    capacitacao_realizada: equipamento.capacitacao_realizada,
    nup:                   equipamento.nup || '',
    endereco:              equipamento.endereco || '',
    telefone:              equipamento.telefone || '',
    responsavel:           equipamento.responsavel || '',
    observacoes:           equipamento.observacoes || '',
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Equipamento</DialogTitle>
          <DialogDescription>{equipamento.municipio} — {equipamento.tipo}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-2"><Label>Endereço</Label>
              <Input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Responsável</Label>
                <Input value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Telefone</Label>
                <Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} /></div>
            </div>
            <div className="space-y-2"><Label>NUP</Label>
              <Input value={form.nup} onChange={e => {
                const v = e.target.value.replace(/\D/g, '');
                let fmt = '';
                for (let i = 0; i < v.length && i < 17; i++) {
                  if (i === 5) fmt += '.'; if (i === 11) fmt += '/'; if (i === 15) fmt += '-';
                  fmt += v[i];
                }
                setForm(f => ({ ...f, nup: fmt }));
              }} placeholder="62000.001753/2025-56" /></div>
          </div>

          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <Label className="text-sm font-semibold">Acompanhamento</Label>
            {[
              { id: 'patrulha', label: 'Patrulha M.P.',    key: 'possui_patrulha'       },
              { id: 'kit',      label: 'Kit Athena',        key: 'kit_athena_entregue'   },
              { id: 'qualif',   label: 'Qualificação',      key: 'capacitacao_realizada' },
            ].map(item => (
              <div key={item.id} className="flex items-center justify-between">
                <Label htmlFor={item.id} className="text-sm font-normal">{item.label}</Label>
                <Switch id={item.id} checked={form[item.key as keyof typeof form] as boolean}
                  onCheckedChange={v => setForm(f => ({ ...f, [item.key]: v }))} />
              </div>
            ))}
            {form.kit_athena_entregue && (
              <div className="flex items-center justify-between pl-4 border-l-2 border-amber-400">
                <Label htmlFor="previo" className="text-sm font-normal text-amber-700">Entregue via <strong>PréVio</strong></Label>
                <Switch id="previo" checked={form.kit_athena_previo}
                  onCheckedChange={v => setForm(f => ({ ...f, kit_athena_previo: v }))} />
              </div>
            )}
          </div>

          <div className="space-y-2"><Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={3} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => { onSave({ id: equipamento.id, ...form }); onClose(); }}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal de Edição Solicitação ───────────────────────────────────────────────
function ModalSolicitacao({
  solicitacao, onClose, onSave,
}: { solicitacao: Solicitacao; onClose: () => void; onSave: (data: Partial<Solicitacao> & { id: string }) => void }) {
  const [form, setForm] = useState({
    status:                       solicitacao.status,
    recebeu_patrulha:             solicitacao.recebeu_patrulha,
    guarda_municipal_estruturada: solicitacao.guarda_municipal_estruturada,
    kit_athena_entregue:          solicitacao.kit_athena_entregue,
    kit_athena_previo:            solicitacao.kit_athena_previo ?? false,
    capacitacao_realizada:        solicitacao.capacitacao_realizada,
    nup:                          solicitacao.nup || '',
    observacoes:                  solicitacao.observacoes || '',
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Solicitação</DialogTitle>
          <DialogDescription>{solicitacao.municipio} — {solicitacao.tipo_equipamento}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as StatusSolicitacao }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusSolicitacao.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2"><Label>NUP</Label>
            <Input value={form.nup} onChange={e => {
              const v = e.target.value.replace(/\D/g, '');
              let fmt = '';
              for (let i = 0; i < v.length && i < 17; i++) {
                if (i === 5) fmt += '.'; if (i === 11) fmt += '/'; if (i === 15) fmt += '-';
                fmt += v[i];
              }
              setForm(f => ({ ...f, nup: fmt }));
            }} placeholder="62000.001753/2025-56" /></div>

          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <Label className="text-sm font-semibold">Acompanhamento</Label>
            {[
              { id: 'patrulha', label: 'Patrulha M.P.',    key: 'recebeu_patrulha'             },
              { id: 'guarda',   label: 'Guarda Municipal',  key: 'guarda_municipal_estruturada' },
              { id: 'kit',      label: 'Kit Athena',        key: 'kit_athena_entregue'          },
              { id: 'qualif',   label: 'Qualificação',      key: 'capacitacao_realizada'        },
            ].map(item => (
              <div key={item.id} className="flex items-center justify-between">
                <Label htmlFor={item.id} className="text-sm font-normal">{item.label}</Label>
                <Switch id={item.id} checked={form[item.key as keyof typeof form] as boolean}
                  onCheckedChange={v => setForm(f => ({ ...f, [item.key]: v }))} />
              </div>
            ))}
            {form.kit_athena_entregue && (
              <div className="flex items-center justify-between pl-4 border-l-2 border-amber-400">
                <Label htmlFor="previo" className="text-sm font-normal text-amber-700">Entregue via <strong>PréVio</strong></Label>
                <Switch id="previo" checked={form.kit_athena_previo}
                  onCheckedChange={v => setForm(f => ({ ...f, kit_athena_previo: v }))} />
              </div>
            )}
          </div>

          <div className="space-y-2"><Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={3} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => { onSave({ id: solicitacao.id, ...form }); onClose(); }}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Diagnostico() {
  const { equipamentos, updateEquipamento } = useEquipamentos();
  const { solicitacoes, updateSolicitacao } = useSolicitacoes();
  const { isResolvido, toggleResolvido, limparTodos, isLoading: isLoadingResolvidos } = usePendenciasResolvidas();

  const [regiaoFiltro,     setRegiaoFiltro]     = useState('');
  const [origemFiltro,     setOrigemFiltro]     = useState('');
  const [pendenciaFiltro,  setPendenciaFiltro]  = useState('');
  const [busca,            setBusca]            = useState('');
  const [diasSemMovimento, setDiasSemMovimento] = useState(60);
  const [sortField,        setSortField]        = useState<SortField>('pendencias');
  const [sortDir,          setSortDir]          = useState<SortDir>('desc');
  const [ocultarResolvidos, setOcultarResolvidos] = useState(false);
  const [exporting,        setExporting]        = useState(false);

  // Modais de edição
  const [editEquipamento,  setEditEquipamento]  = useState<Equipamento | null>(null);
  const [editSolicitacao,  setEditSolicitacao]  = useState<Solicitacao | null>(null);

  const todasPendencias = useMemo(() =>
    gerarDiagnostico(equipamentos, solicitacoes, { regiaoFiltro: regiaoFiltro || undefined, diasSemMovimento }),
    [equipamentos, solicitacoes, regiaoFiltro, diasSemMovimento]
  );

  const itemTotalmenteResolvido = (item: PendenciaMunicipio) =>
    item.pendencias.every(p => isResolvido(item.municipio, item.tipo, item.origem, p));

  const totalResolvidos = todasPendencias.filter(itemTotalmenteResolvido).length;

  const pendenciasFiltradas = useMemo(() => {
    let list = todasPendencias;
    if (origemFiltro)    list = list.filter(p => p.origem === origemFiltro);
    if (pendenciaFiltro) list = list.filter(p => p.pendencias.some(pen => pen === pendenciaFiltro));
    if (busca) {
      const q = busca.toLowerCase();
      list = list.filter(p =>
        p.municipio.toLowerCase().includes(q) || p.regiao.toLowerCase().includes(q) ||
        p.tipo.toLowerCase().includes(q) || p.pendencias.some(pen => pen.toLowerCase().includes(q))
      );
    }
    if (ocultarResolvidos) list = list.filter(p => !itemTotalmenteResolvido(p));
    list = [...list].sort((a, b) => {
      let va: string | number = '', vb: string | number = '';
      if (sortField === 'municipio')  { va = a.municipio;         vb = b.municipio;         }
      if (sortField === 'regiao')     { va = a.regiao;            vb = b.regiao;            }
      if (sortField === 'tipo')       { va = a.tipo;              vb = b.tipo;              }
      if (sortField === 'origem')     { va = a.origem;            vb = b.origem;            }
      if (sortField === 'pendencias') { va = a.pendencias.length; vb = b.pendencias.length; }
      if (typeof va === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb as string, 'pt-BR') : (vb as string).localeCompare(va, 'pt-BR');
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return list;
  }, [todasPendencias, origemFiltro, pendenciaFiltro, busca, sortField, sortDir, ocultarResolvidos, isResolvido]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir(field === 'pendencias' ? 'desc' : 'asc'); }
  };

  const resumo = useMemo(() => {
    const map: Record<string, number> = {};
    todasPendencias.forEach(p => { p.pendencias.forEach(pen => { map[pen] = (map[pen] || 0) + 1; }); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [todasPendencias]);

  const temFiltro = regiaoFiltro || origemFiltro || pendenciaFiltro || busca;
  const filtrosDiag = { regiaoFiltro: regiaoFiltro || undefined, diasSemMovimento };

  const handleExportPDF = async () => {
    setExporting(true);
    try { await new Promise(r => setTimeout(r, 50)); exportDiagnosticoToPDF(equipamentos, solicitacoes, filtrosDiag); toast.success('PDF exportado!'); }
    catch { toast.error('Erro ao exportar PDF'); } finally { setExporting(false); }
  };
  const handleExportExcel = async () => {
    setExporting(true);
    try { await new Promise(r => setTimeout(r, 50)); exportDiagnosticoToExcel(equipamentos, solicitacoes, filtrosDiag); toast.success('Excel exportado!'); }
    catch { toast.error('Erro ao exportar Excel'); } finally { setExporting(false); }
  };

  // Busca o equipamento/solicitação correspondente ao item do diagnóstico
  const findEquipamento = (item: PendenciaMunicipio) =>
    equipamentos.find(e => e.municipio === item.municipio && e.tipo === item.tipo);
  const findSolicitacao = (item: PendenciaMunicipio) =>
    solicitacoes.find(s => s.municipio === item.municipio && s.tipo_equipamento === item.tipo && s.status !== 'Cancelada' && s.status !== 'Inaugurada');

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <PageHeader title="Diagnóstico de Pendências"
          description="Equipamentos e solicitações com pendências — clique na linha para ver detalhes e editar" />
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting}
            className="gap-2 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={exporting}
            className="gap-2 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Excel
          </Button>
        </div>
      </div>

      {/* Cards resumo */}
      {resumo.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          {resumo.slice(0, 8).map(([pendencia, count]) => {
            const cor = getPendenciaCor(pendencia);
            const ativo = pendenciaFiltro === pendencia;
            return (
              <button key={pendencia} onClick={() => setPendenciaFiltro(ativo ? '' : pendencia)}
                className={cn('rounded-xl border p-3 text-left transition-all',
                  ativo ? cn(cor.bg, cor.border, 'ring-2') : 'bg-card border-border hover:border-primary/30')}>
                <p className={cn('text-2xl font-bold', cor.text)}>{count}</p>
                <p className="text-xs text-muted-foreground leading-tight mt-0.5 line-clamp-2">{pendencia}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Configurações e filtros */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-6 space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
            Solicitações paradas há mais de <span className="font-bold text-foreground">{diasSemMovimento} dias</span>
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {THRESHOLD_OPTIONS.map(d => (
              <button key={d} onClick={() => setDiasSemMovimento(d)}
                className={cn('text-xs px-3 py-1.5 rounded-lg border font-medium transition-all',
                  diasSemMovimento === d ? 'bg-red-500 border-red-500 text-white shadow-sm' : 'border-border text-muted-foreground hover:border-red-300 hover:text-red-600')}>
                {d}d
              </button>
            ))}
            <div className="flex items-center gap-1.5">
              <input type="number" min={1} max={365} value={diasSemMovimento}
                onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1 && v <= 365) setDiasSemMovimento(v); }}
                className="w-16 text-sm border border-border rounded-lg px-2 py-1.5 bg-background text-center focus:outline-none focus:ring-2 focus:ring-red-400/30" />
              <span className="text-xs text-muted-foreground">dias</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar município, tipo, pendência..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
          </div>
          <select value={regiaoFiltro} onChange={e => setRegiaoFiltro(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="">Todas as regiões</option>
            {regioesList.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={origemFiltro} onChange={e => setOrigemFiltro(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="">Equipamentos e Solicitações</option>
            <option value="Equipamento">Apenas Equipamentos</option>
            <option value="Solicitação">Apenas Solicitações</option>
          </select>
          {temFiltro && (
            <Button variant="ghost" size="sm"
              onClick={() => { setRegiaoFiltro(''); setOrigemFiltro(''); setPendenciaFiltro(''); setBusca(''); }}
              className="gap-1.5 text-muted-foreground shrink-0">
              <X className="w-3.5 h-3.5" /> Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Barra de status */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{pendenciasFiltradas.length}</span>
          {pendenciasFiltradas.length !== todasPendencias.length && ` de ${todasPendencias.length}`}
          {' '}item{pendenciasFiltradas.length !== 1 ? 's' : ''} com pendências
          {totalResolvidos > 0 && (
            <span className="ml-2 text-emerald-600">
              · {totalResolvidos} totalmente resolvido{totalResolvidos !== 1 ? 's' : ''}
              {isLoadingResolvidos && <Loader2 className="w-3 h-3 inline ml-1 animate-spin" />}
            </span>
          )}
        </p>
        {totalResolvidos > 0 && (
          <div className="flex items-center gap-3">
            <button onClick={() => setOcultarResolvidos(v => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              {ocultarResolvidos ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {ocultarResolvidos ? 'Mostrar resolvidos' : 'Ocultar resolvidos'}
            </button>
            <button onClick={async () => { await limparTodos(); toast.success('Resolvidos apagados'); }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Limpar resolvidos
            </button>
          </div>
        )}
      </div>

      {/* Tabela */}
      {todasPendencias.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-card border border-border rounded-2xl p-16 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4 opacity-60" />
          <p className="text-lg font-semibold mb-1">Nenhuma pendência encontrada</p>
          <p className="text-sm text-muted-foreground">Todos os itens estão dentro dos critérios configurados.</p>
        </motion.div>
      ) : pendenciasFiltradas.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <Filter className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum resultado para os filtros aplicados.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="py-3 pl-3 pr-2 w-8" />
                  {([
                    { field: 'municipio'  as SortField, label: 'Município',  cls: ''                     },
                    { field: 'regiao'     as SortField, label: 'Região',     cls: 'hidden md:table-cell' },
                    { field: 'tipo'       as SortField, label: 'Tipo',       cls: 'hidden lg:table-cell' },
                    { field: 'origem'     as SortField, label: 'Origem',     cls: 'hidden sm:table-cell' },
                    { field: 'pendencias' as SortField, label: 'Pendências', cls: ''                     },
                  ]).map(col => (
                    <th key={col.field} onClick={() => handleSort(col.field)}
                      className={cn('py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer select-none hover:text-foreground transition-colors', col.cls)}>
                      <span className="flex items-center">{col.label}<SortIcon field={col.field} sortField={sortField} sortDir={sortDir} /></span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {pendenciasFiltradas.map((item, i) => (
                    <LinhaTabela
                      key={item.itemId}
                      item={item} delay={i * 0.015}
                      itemResolvido={itemTotalmenteResolvido(item)}
                      isResolvido={p => isResolvido(item.municipio, item.tipo, item.origem, p)}
                      onTogglePendencia={p => toggleResolvido(item.municipio, item.tipo, item.origem, p)}
                      equipamento={findEquipamento(item)}
                      solicitacao={findSolicitacao(item)}
                      onEditEquipamento={setEditEquipamento}
                      onEditSolicitacao={setEditSolicitacao}
                    />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {pendenciasFiltradas.length} item{pendenciasFiltradas.length !== 1 ? 's' : ''}
              {totalResolvidos > 0 && ` · ${totalResolvidos} resolvido${totalResolvidos !== 1 ? 's' : ''}`}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><div className="w-2 h-2 rounded-full bg-teal-500" /> Equipamento</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><div className="w-2 h-2 rounded-full bg-amber-500" /> Solicitação</div>
            </div>
          </div>
        </div>
      )}

      {totalResolvidos > 0 && (
        <p className="text-xs text-muted-foreground/50 text-center mt-3">
          Resolvidos persistidos no banco e visíveis para todos os usuários.
        </p>
      )}

      {/* Modais de edição */}
      {editEquipamento && (
        <ModalEquipamento
          equipamento={editEquipamento}
          onClose={() => setEditEquipamento(null)}
          onSave={data => { updateEquipamento(data); toast.success('Equipamento atualizado'); }}
        />
      )}
      {editSolicitacao && (
        <ModalSolicitacao
          solicitacao={editSolicitacao}
          onClose={() => setEditSolicitacao(null)}
          onSave={data => { updateSolicitacao(data); toast.success('Solicitação atualizada'); }}
        />
      )}
    </AppLayout>
  );
}