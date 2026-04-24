import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Package, Plus, Pencil, Trash2, Search, ChevronDown,
  Boxes, TrendingDown, X, MapPin, Building2, AlertCircle,
  CheckCircle2, Clock, XCircle, Truck, Settings, ArrowRightLeft,
  Download, FileSpreadsheet, FileText as FilePdf,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useMaterialGrafico, MgPedidoInsert,
  MG_SITUACAO_CORES, MG_TIPO_CORES, MG_TIPOS, MG_SITUACOES,
  MG_FORMAS_ENTREGA, MG_UNIDADES,
} from '@/hooks/useMaterialGrafico';
import { MgPedido, MgItem, MgSituacao, MgFormaEntrega, MgTipoItem, MgUnidade } from '@/types';
import { municipiosCeara, regioesList, getRegiao } from '@/data/municipios';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  exportMgPedidosToPDF, exportMgPedidosToExcel,
  exportMgEstoqueToPDF, exportMgEstoqueToExcel,
} from '@/lib/exportUtils';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd/MM/yyyy', { locale: ptBR }); } catch { return d; }
};

const SITUACAO_ICONE: Record<MgSituacao, React.ReactNode> = {
  'Aguardando':   <Clock className="w-3.5 h-3.5" />,
  'Em separação': <Boxes className="w-3.5 h-3.5" />,
  'Atendido':     <CheckCircle2 className="w-3.5 h-3.5" />,
  'Cancelado':    <XCircle className="w-3.5 h-3.5" />,
};

const TIPO_PEDIDO_OPCOES = [
  'Material Carnaval','Material Informativo','Inauguração','Evento','Palestra','Outro',
];

function SituacaoBadge({ s }: { s: MgSituacao }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium', MG_SITUACAO_CORES[s])}>
      {SITUACAO_ICONE[s]}{s}
    </span>
  );
}

// ── Form state types ──────────────────────────────────────────────────────────

interface FormItemRow {
  item_id: string;
  unidade_medida: MgUnidade;
  qtd_solicitada: number;
  qtd_autorizada: number | null;
}

const FORM_PEDIDO_VAZIO = {
  tipo_destino:   'municipio' as 'municipio' | 'avulso',
  municipio:      '',
  destino_avulso: '',
  nup: '', oficio: '',
  data_pedido: '', data_entrega: '',
  situacao:      'Aguardando' as MgSituacao,
  forma_entrega: '' as MgFormaEntrega | '',
  tipo_pedido:   '',
  observacoes:   '',
  itens:         [] as FormItemRow[],
};

const FORM_ITEM_VAZIO = {
  tipo:           'Folder' as MgTipoItem,
  campanha:       '',
  descricao:      '',
  peso_cx_g:      '',
  unidades_por_cx: '',
};

interface FormEstoque {
  item_id: string;
  local: string;
  caixas: string;
  unidades_avulsas: string;
}

// ── Card de Estoque ───────────────────────────────────────────────────────────

function EstoqueCard({
  item, caixasPorLocal, unidadesPorLocal, totalCaixas, totalUnidades,
  totalDistribuidoCaixas, totalDistribuidoUnidades, canEdit, onEdit, onTransferir,
}: {
  item: MgItem;
  caixasPorLocal: (id: string, local: string) => number;
  unidadesPorLocal: (id: string, local: string) => number;
  totalCaixas: (id: string) => number;
  totalUnidades: (id: string) => number;
  totalDistribuidoCaixas: (id: string) => number;
  totalDistribuidoUnidades: (id: string) => number;
  canEdit: boolean;
  onEdit: (item: MgItem) => void;
  onTransferir: (item: MgItem) => void;
}) {
  const cxCastelao  = caixasPorLocal(item.id, 'Castelão');
  const cxSEM       = caixasPorLocal(item.id, 'SEM');
  const unSEM       = unidadesPorLocal(item.id, 'SEM');
  const totalCx     = cxCastelao + cxSEM;
  const distCx      = totalDistribuidoCaixas(item.id);
  const distUn      = totalDistribuidoUnidades(item.id);
  const cor         = MG_TIPO_CORES[item.tipo as MgTipoItem];
  const unPorCx     = item.unidades_por_cx;

  return (
    <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
      className="bg-card rounded-xl border border-border shadow-sm p-4 flex flex-col gap-3">

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', cor)}>{item.tipo}</span>
          <p className="font-semibold text-sm mt-1 leading-tight">{item.campanha}</p>
          {item.descricao && <p className="text-xs text-muted-foreground mt-0.5">{item.descricao}</p>}
        </div>
        {canEdit && (
          <div className="flex gap-1 shrink-0">
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
              onClick={() => onTransferir(item)} title="Mover caixas do Castelão para a SEM"
              disabled={cxCastelao === 0}>
              <ArrowRightLeft className="w-3 h-3" />Mover
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => onEdit(item)} title="Ajuste manual">
              <Pencil className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Castelão */}
      <div className="bg-slate-500/5 rounded-lg p-2.5">
        <p className="text-[10px] text-muted-foreground font-medium mb-1">CASTELÃO (almoxarifado)</p>
        <div className="flex items-baseline justify-between">
          <span className="text-xl font-bold tabular-nums">{cxCastelao} cx</span>
          {unPorCx && (
            <span className="text-xs text-muted-foreground">≈ {(cxCastelao * unPorCx).toLocaleString('pt-BR')} un</span>
          )}
        </div>
      </div>

      {/* SEM */}
      <div className="bg-primary/5 rounded-lg p-2.5">
        <p className="text-[10px] text-muted-foreground font-medium mb-1">SEM (em uso)</p>
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold tabular-nums text-primary">{cxSEM} cx</span>
            {unSEM > 0 && (
              <span className="text-xs text-muted-foreground">+ {unSEM.toLocaleString('pt-BR')} avulsas</span>
            )}
          </div>
          {unPorCx && (
            <span className="text-xs text-muted-foreground">≈ {(cxSEM * unPorCx + unSEM).toLocaleString('pt-BR')} un</span>
          )}
        </div>
      </div>

      {/* Total + distribuído */}
      <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2">
        <span>Total: <strong className="text-foreground">{totalCx} cx</strong>
          {unPorCx && <span> ≈ {(totalCx * unPorCx + unSEM).toLocaleString('pt-BR')} un</span>}
        </span>
        {(distCx > 0 || distUn > 0) && (
          <span className="flex items-center gap-1 text-rose-600">
            <TrendingDown className="w-3 h-3" />
            {distCx > 0 && `${distCx} cx`}
            {distCx > 0 && distUn > 0 && ' · '}
            {distUn > 0 && `${distUn.toLocaleString('pt-BR')} un`}
            {' distribuídos'}
          </span>
        )}
      </div>

      {item.peso_cx_g && (
        <p className="text-[10px] text-muted-foreground -mt-1">
          {item.peso_cx_g}g/cx{unPorCx && ` · ≈ ${unPorCx} un/cx`}
        </p>
      )}
    </motion.div>
  );
}

// ── Card de Pedido ────────────────────────────────────────────────────────────

function PedidoCard({ pedido, itens: catalogoItens, canEdit, onEdit, onDelete }: {
  pedido: MgPedido;
  itens: MgItem[];
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const destino    = pedido.municipio ?? pedido.destino_avulso ?? '—';
  const isMunicipio = !!pedido.municipio;

  // Resumo de quantidades
  const totalCx = (pedido.itens ?? [])
    .filter(ip => ip.unidade_medida === 'caixas')
    .reduce((s, ip) => s + (ip.qtd_autorizada ?? ip.qtd_solicitada ?? 0), 0);
  const totalUn = (pedido.itens ?? [])
    .filter(ip => ip.unidade_medida === 'unidades')
    .reduce((s, ip) => s + (ip.qtd_autorizada ?? ip.qtd_solicitada ?? 0), 0);

  return (
    <motion.div initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }}
      className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 p-3.5">
        <div className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(e => !e)}>
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
            isMunicipio ? 'bg-primary/10' : 'bg-violet-500/10')}>
            {isMunicipio
              ? <MapPin className="w-3.5 h-3.5 text-primary" />
              : <Building2 className="w-3.5 h-3.5 text-violet-600" />}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{destino}</p>
            <p className="text-[11px] text-muted-foreground">
              {isMunicipio ? (getRegiao(pedido.municipio!) || '') : 'Destino avulso'}
              {pedido.data_pedido && ` · ${fmtDate(pedido.data_pedido)}`}
              {totalCx > 0 && ` · ${totalCx} cx`}
              {totalUn > 0 && ` · ${totalUn.toLocaleString('pt-BR')} un`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <SituacaoBadge s={pedido.situacao} />
          {canEdit && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={e => { e.stopPropagation(); onEdit(); }}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={e => { e.stopPropagation(); onDelete(); }}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
          <ChevronDown
            className={cn('w-4 h-4 text-muted-foreground transition-transform cursor-pointer', expanded && 'rotate-180')}
            onClick={() => setExpanded(e => !e)} />
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }}
            exit={{ height:0, opacity:0 }} transition={{ duration:0.2 }}
            className="overflow-hidden">
            <div className="px-4 pb-4 border-t border-border/50">
              {/* Meta */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 mb-3 text-xs">
                {pedido.nup && <div><p className="text-muted-foreground text-[10px]">NUP/SUITE</p><p className="font-medium">{pedido.nup}</p></div>}
                {pedido.oficio && <div><p className="text-muted-foreground text-[10px]">Ofício</p><p className="font-medium">{pedido.oficio}</p></div>}
                {pedido.data_pedido && <div><p className="text-muted-foreground text-[10px]">Data Pedido</p><p className="font-medium">{fmtDate(pedido.data_pedido)}</p></div>}
                {pedido.data_entrega && <div><p className="text-muted-foreground text-[10px]">Data Entrega</p><p className="font-medium">{fmtDate(pedido.data_entrega)}</p></div>}
                {pedido.tipo_pedido && <div><p className="text-muted-foreground text-[10px]">Tipo</p><p className="font-medium">{pedido.tipo_pedido}</p></div>}
                {pedido.forma_entrega && (
                  <div>
                    <p className="text-muted-foreground text-[10px]">Forma</p>
                    <p className="font-medium flex items-center gap-1"><Truck className="w-3 h-3" />{pedido.forma_entrega}</p>
                  </div>
                )}
              </div>

              {/* Materiais */}
              {(pedido.itens ?? []).length > 0 && (
                <div className="mt-1">
                  <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wide">Materiais</p>
                  <div className="space-y-1.5">
                    {(pedido.itens ?? []).map(ip => {
                      const item = catalogoItens.find(i => i.id === ip.item_id);
                      const qtdAuth = ip.qtd_autorizada;
                      const qtdSol  = ip.qtd_solicitada;
                      const reduzido = qtdAuth !== null && qtdAuth !== undefined && qtdAuth < qtdSol;
                      const unLabel = ip.unidade_medida === 'caixas' ? 'cx' : 'un';
                      return (
                        <div key={ip.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className={cn('px-2 py-0.5 rounded font-medium shrink-0',
                            item ? MG_TIPO_CORES[item.tipo as MgTipoItem] : 'bg-muted')}>
                            {item ? `${item.tipo} — ${item.campanha}` : 'Item'}
                          </span>
                          <span className="tabular-nums text-muted-foreground">
                            {reduzido ? (
                              <>
                                <span className="text-amber-600">{(qtdAuth ?? 0)} {unLabel}</span>
                                {' '}<span className="line-through opacity-50">{qtdSol} {unLabel}</span>
                              </>
                            ) : (
                              `${qtdAuth ?? qtdSol} ${unLabel}`
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {pedido.observacoes && (
                <p className="text-xs text-muted-foreground mt-2 italic">"{pedido.observacoes}"</p>
              )}
              {!pedido.estoque_abatido && pedido.situacao === 'Atendido' && (
                <p className="text-[10px] text-amber-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />Estoque não abatido — quantidade não especificada
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function MaterialGrafico() {
  const { role } = useAuthContext();
  const canEdit = (role as string) === 'admin' || (role as string) === 'editor';

  const {
    itens, estoque, pedidos, isLoading, refetch,
    caixasPorLocal, unidadesPorLocal, totalCaixas, totalUnidades,
    totalDistribuidoCaixas, totalDistribuidoUnidades,
    addPedido, updatePedido, deletePedido, updateEstoque, transferirParaSEM,
    isAdding, isUpdating,
  } = useMaterialGrafico();

  // Filtros
  const [searchTerm,     setSearchTerm]     = useState('');
  const [filterSituacao, setFilterSituacao] = useState<string>('all');
  const [filterRegiao,   setFilterRegiao]   = useState<string>('all');

  // Dialog pedido
  const [dialogOpen,     setDialogOpen]     = useState(false);
  const [editingPedido,  setEditingPedido]  = useState<MgPedido | null>(null);
  const [deletingPedido, setDeletingPedido] = useState<MgPedido | null>(null);
  const [form, setForm] = useState({ ...FORM_PEDIDO_VAZIO });

  // Dialog catálogo
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem,    setEditingItem]    = useState<MgItem | null>(null);
  const [deletingItem,   setDeletingItem]   = useState<MgItem | null>(null);
  const [itemForm, setItemForm]             = useState({ ...FORM_ITEM_VAZIO });
  const [savingItem, setSavingItem]         = useState(false);

  // Dialog transferência Castelão → SEM
  const [transferirDialogOpen, setTransferirDialogOpen] = useState(false);
  const [transferirForm, setTransferirForm] = useState({ item_id: '', caixas: '' });

  // Dialog estoque
  const [estoqueDialogOpen, setEstoqueDialogOpen] = useState(false);
  const [estoqueForm, setEstoqueForm] = useState<FormEstoque>({
    item_id: '', local: 'SEM', caixas: '0', unidades_avulsas: '0',
  });

  // Refresh via evento (após CRUD de catálogo)
  useEffect(() => {
    const handler = () => refetch();
    window.addEventListener('mg-refresh', handler);
    return () => window.removeEventListener('mg-refresh', handler);
  }, [refetch]);

  // ── Pedidos filtrados ──────────────────────────────────────────────────────
  const pedidosFiltrados = useMemo(() =>
    pedidos.filter(p => {
      const destino = (p.municipio ?? p.destino_avulso ?? '').toLowerCase();
      const ok1 = !searchTerm ||
        destino.includes(searchTerm.toLowerCase()) ||
        (p.nup ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.tipo_pedido ?? '').toLowerCase().includes(searchTerm.toLowerCase());
      const ok2 = filterSituacao === 'all' || p.situacao === filterSituacao;
      const ok3 = filterRegiao === 'all' || !p.municipio || getRegiao(p.municipio) === filterRegiao;
      return ok1 && ok2 && ok3;
    }),
  [pedidos, searchTerm, filterSituacao, filterRegiao]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalCxGlobal = itens.reduce((s, i) => s + totalCaixas(i.id), 0);
  const pendentes = pedidos.filter(p => p.situacao === 'Aguardando' || p.situacao === 'Em separação').length;
  const atendidos = pedidos.filter(p => p.situacao === 'Atendido').length;

  // ── Handlers pedido ────────────────────────────────────────────────────────
  const openCreatePedido = () => {
    setEditingPedido(null);
    setForm({ ...FORM_PEDIDO_VAZIO });
    setDialogOpen(true);
  };

  const openEditPedido = (p: MgPedido) => {
    setEditingPedido(p);
    setForm({
      tipo_destino:   p.municipio ? 'municipio' : 'avulso',
      municipio:      p.municipio ?? '',
      destino_avulso: p.destino_avulso ?? '',
      nup:            p.nup ?? '',
      oficio:         p.oficio ?? '',
      data_pedido:    p.data_pedido ?? '',
      data_entrega:   p.data_entrega ?? '',
      situacao:       p.situacao,
      forma_entrega:  p.forma_entrega ?? '',
      tipo_pedido:    p.tipo_pedido ?? '',
      observacoes:    p.observacoes ?? '',
      itens: (p.itens ?? []).map(ip => ({
        item_id:        ip.item_id,
        unidade_medida: ip.unidade_medida,
        qtd_solicitada: ip.qtd_solicitada,
        qtd_autorizada: ip.qtd_autorizada,
      })),
    });
    setDialogOpen(true);
  };

  const handleSubmitPedido = () => {
    const destino = form.tipo_destino === 'municipio' ? form.municipio : form.destino_avulso;
    if (!destino.trim()) return toast.error('Informe o destino do pedido');
    if (form.itens.some(i => !i.item_id)) return toast.error('Selecione o material em todos os itens');

    const payload: MgPedidoInsert = {
      municipio:      form.tipo_destino === 'municipio' ? form.municipio || null : null,
      destino_avulso: form.tipo_destino === 'avulso'    ? form.destino_avulso || null : null,
      nup:            form.nup || null,
      oficio:         form.oficio || null,
      data_pedido:    form.data_pedido || null,
      data_entrega:   form.data_entrega || null,
      situacao:       form.situacao,
      forma_entrega:  (form.forma_entrega as MgFormaEntrega) || null,
      tipo_pedido:    form.tipo_pedido || null,
      observacoes:    form.observacoes || null,
      itens:          form.itens,
    };

    if (editingPedido) updatePedido({ id: editingPedido.id, ...payload });
    else addPedido(payload);
    setDialogOpen(false);
  };

  const updateFormItem = (idx: number, patch: Partial<FormItemRow>) =>
    setForm(f => ({ ...f, itens: f.itens.map((it, i) => i === idx ? { ...it, ...patch } : it) }));

  // ── Handlers catálogo ──────────────────────────────────────────────────────
  const openCreateItem = () => { setEditingItem(null); setItemForm({ ...FORM_ITEM_VAZIO }); setItemDialogOpen(true); };
  const openEditItem = (item: MgItem) => {
    setEditingItem(item);
    setItemForm({
      tipo:            item.tipo,
      campanha:        item.campanha,
      descricao:       item.descricao ?? '',
      peso_cx_g:       item.peso_cx_g != null ? String(item.peso_cx_g) : '',
      unidades_por_cx: item.unidades_por_cx != null ? String(item.unidades_por_cx) : '',
    });
    setItemDialogOpen(true);
  };

  const handleSubmitItem = async () => {
    if (!itemForm.campanha.trim()) return toast.error('Nome da campanha é obrigatório');
    setSavingItem(true);
    try {
      const data: Record<string, unknown> = {
        tipo:            itemForm.tipo,
        campanha:        itemForm.campanha.trim(),
        descricao:       itemForm.descricao.trim() || null,
        peso_cx_g:       itemForm.peso_cx_g       ? parseFloat(itemForm.peso_cx_g)       : null,
        unidades_por_cx: itemForm.unidades_por_cx ? parseInt(itemForm.unidades_por_cx)   : null,
      };
      if (editingItem) {
        const { error } = await supabase.from('mg_itens').update(data).eq('id', editingItem.id);
        if (error) throw error;
        toast.success('Item atualizado!');
      } else {
        const { error } = await supabase.from('mg_itens').insert(data);
        if (error) throw error;
        // Criar linha de estoque zerada nos dois locais
        const { data: novoItem } = await supabase.from('mg_itens').select('id').order('created_at', { ascending: false }).limit(1).single();
        if (novoItem) {
          await supabase.from('mg_estoque').insert([
            { item_id: novoItem.id, local: 'SEM',      caixas: 0, unidades_avulsas: 0 },
            { item_id: novoItem.id, local: 'Castelão', caixas: 0, unidades_avulsas: 0 },
          ]);
        }
        toast.success('Item cadastrado!');
      }
      setItemDialogOpen(false);
      window.dispatchEvent(new Event('mg-refresh'));
    } catch (e: unknown) {
      toast.error(`Erro: ${e instanceof Error ? e.message : 'desconhecido'}`);
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deletingItem) return;
    const { error } = await supabase.from('mg_itens').update({ ativo: false }).eq('id', deletingItem.id);
    if (error) { toast.error(`Erro: ${error.message}`); return; }
    toast.success('Item desativado.');
    setDeletingItem(null);
    window.dispatchEvent(new Event('mg-refresh'));
  };

  // ── Handler estoque ────────────────────────────────────────────────────────
  const openTransferir = (item: MgItem) => {
    const dispCastelao = caixasPorLocal(item.id, 'Castelão');
    setTransferirForm({ item_id: item.id, caixas: String(dispCastelao) });
    setTransferirDialogOpen(true);
  };

  const handleSubmitTransferir = () => {
    const cx = parseInt(transferirForm.caixas) || 0;
    if (cx <= 0) return toast.error('Informe a quantidade de caixas');
    transferirParaSEM({ item_id: transferirForm.item_id, caixas: cx });
    setTransferirDialogOpen(false);
  };

  const openEditEstoque = (item: MgItem) => {
    setEstoqueForm({
      item_id:          item.id,
      local:            'SEM',
      caixas:           String(caixasPorLocal(item.id, 'SEM')),
      unidades_avulsas: String(unidadesPorLocal(item.id, 'SEM')),
    });
    setEstoqueDialogOpen(true);
  };

  const onEstoqueLocalChange = (local: string) => {
    const item_id = estoqueForm.item_id;
    setEstoqueForm(f => ({
      ...f, local,
      caixas:           String(caixasPorLocal(item_id, local)),
      // Castelão não tem unidades avulsas
      unidades_avulsas: local === 'Castelão' ? '0' : String(unidadesPorLocal(item_id, local)),
    }));
  };

  const handleSubmitEstoque = () => {
    if (!estoqueForm.item_id) return toast.error('Selecione o item');
    updateEstoque({
      item_id:          estoqueForm.item_id,
      local:            estoqueForm.local,
      caixas:           parseInt(estoqueForm.caixas)           || 0,
      unidades_avulsas: parseInt(estoqueForm.unidades_avulsas) || 0,
    });
    setEstoqueDialogOpen(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <PageHeader title="Material Gráfico" description="Controle de estoque e distribuição de material gráfico">
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />Exportar<ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportMgPedidosToPDF(pedidos, itens).catch(console.error)}>
                <FilePdf className="w-4 h-4 mr-2 text-rose-500" />PDF — Pedidos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportMgPedidosToExcel(pedidos, itens)}>
                <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />Excel — Pedidos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportMgEstoqueToPDF(itens, estoque).catch(console.error)}>
                <FilePdf className="w-4 h-4 mr-2 text-rose-500" />PDF — Estoque
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportMgEstoqueToExcel(itens, estoque)}>
                <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />Excel — Estoque
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canEdit && (
            <Button size="sm" onClick={openCreatePedido} className="gap-2">
              <Plus className="w-4 h-4" />Novo Pedido
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Caixas em Estoque', value: totalCxGlobal, icon: Boxes,         color: 'bg-primary/10',       iconColor: 'text-primary' },
          { label: 'Pedidos Pendentes', value: pendentes,      icon: Clock,         color: 'bg-amber-500/15',     iconColor: 'text-amber-600' },
          { label: 'Pedidos Atendidos', value: atendidos,      icon: CheckCircle2,  color: 'bg-emerald-500/15',   iconColor: 'text-emerald-600' },
          { label: 'Total de Pedidos',  value: pedidos.length, icon: Package,       color: 'bg-slate-500/10',     iconColor: 'text-slate-600' },
        ].map((c, i) => (
          <motion.div key={c.label} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.05 }}
            className="bg-card rounded-xl p-3 border border-border shadow-sm">
            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center mb-2', c.color)}>
              <c.icon className={cn('w-3.5 h-3.5', c.iconColor)} />
            </div>
            <p className="text-2xl font-bold tabular-nums">{c.value}</p>
            <p className="text-[11px] text-muted-foreground">{c.label}</p>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="pedidos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pedidos" className="gap-2">
            <Package className="w-4 h-4" />Pedidos ({pedidosFiltrados.length})
          </TabsTrigger>
          <TabsTrigger value="estoque" className="gap-2">
            <Boxes className="w-4 h-4" />Estoque ({itens.length})
          </TabsTrigger>
          {canEdit && (
            <TabsTrigger value="catalogo" className="gap-2">
              <Settings className="w-4 h-4" />Catálogo
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Aba Pedidos ── */}
        <TabsContent value="pedidos">
          <div className="bg-card rounded-xl p-3 border border-border shadow-sm mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Município, NUP, tipo..." value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Select value={filterSituacao} onValueChange={setFilterSituacao}>
                <SelectTrigger><SelectValue placeholder="Situação" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as situações</SelectItem>
                  {MG_SITUACOES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterRegiao} onValueChange={setFilterRegiao}>
                <SelectTrigger><SelectValue placeholder="Região" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as regiões</SelectItem>
                  {regioesList.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {pedidosFiltrados.length} registro(s)
                {(searchTerm || filterSituacao !== 'all' || filterRegiao !== 'all') && (
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1"
                    onClick={() => { setSearchTerm(''); setFilterSituacao('all'); setFilterRegiao('all'); }}>
                    <X className="w-3 h-3" />Limpar
                  </Button>
                )}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-muted/30 rounded-xl animate-pulse" />)}</div>
          ) : pedidosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Package className="w-12 h-12 opacity-20 mb-3" />
              <p className="font-medium">Nenhum pedido encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {pedidosFiltrados.map(p => (
                  <PedidoCard key={p.id} pedido={p} itens={itens} canEdit={canEdit}
                    onEdit={() => openEditPedido(p)}
                    onDelete={() => setDeletingPedido(p)} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        {/* ── Aba Estoque ── */}
        <TabsContent value="estoque">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => <div key={i} className="h-48 bg-muted/30 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {itens.map(item => (
                <EstoqueCard key={item.id} item={item}
                  caixasPorLocal={caixasPorLocal} unidadesPorLocal={unidadesPorLocal}
                  totalCaixas={totalCaixas} totalUnidades={totalUnidades}
                  totalDistribuidoCaixas={totalDistribuidoCaixas}
                  totalDistribuidoUnidades={totalDistribuidoUnidades}
                  canEdit={canEdit} onEdit={openEditEstoque} onTransferir={openTransferir} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Aba Catálogo ── */}
        {canEdit && (
          <TabsContent value="catalogo">
            <div className="flex justify-end mb-4">
              <Button size="sm" onClick={openCreateItem} className="gap-2">
                <Plus className="w-4 h-4" />Novo Item
              </Button>
            </div>
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Tipo</th>
                    <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Campanha</th>
                    <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium hidden sm:table-cell">Peso/cx</th>
                    <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium hidden sm:table-cell">Un/cx (aprox.)</th>
                    <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map(item => (
                    <tr key={item.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', MG_TIPO_CORES[item.tipo as MgTipoItem])}>
                          {item.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{item.campanha}</p>
                        {item.descricao && <p className="text-xs text-muted-foreground">{item.descricao}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">
                        {item.peso_cx_g ? `${item.peso_cx_g}g` : '—'}
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        {item.unidades_por_cx ? `≈ ${item.unidades_por_cx}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditItem(item)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeletingItem(item)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* ── Dialog Pedido ── */}
      <Dialog key={editingPedido?.id ?? 'new-pedido'} open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPedido ? 'Editar Pedido' : 'Novo Pedido'}</DialogTitle>
            <DialogDescription>O estoque é abatido automaticamente ao marcar como Atendido.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Tipo destino */}
            <div className="flex gap-2">
              {(['municipio','avulso'] as const).map(t => (
                <button key={t} type="button"
                  onClick={() => setForm(f => ({ ...f, tipo_destino: t, municipio: t==='avulso'?'':f.municipio, destino_avulso: t==='municipio'?'':f.destino_avulso }))}
                  className={cn('flex-1 py-2 text-sm rounded-lg border-2 transition-colors',
                    form.tipo_destino === t
                      ? t==='municipio' ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-violet-500 bg-violet-500/5 text-violet-700 font-medium'
                      : 'border-border text-muted-foreground')}>
                  {t === 'municipio' ? 'Município' : 'Destino Avulso'}
                </button>
              ))}
            </div>

            {form.tipo_destino === 'municipio' ? (
              <div className="space-y-2"><Label>Município *</Label>
                <Select value={form.municipio} onValueChange={(v: string) => setForm(f => ({ ...f, municipio: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{municipiosCeara.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select></div>
            ) : (
              <div className="space-y-2"><Label>Destino *</Label>
                <Input placeholder="Ex: Gabinete, CMB, Evento FA7..." value={form.destino_avulso}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, destino_avulso: e.target.value }))} /></div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>NUP/SUITE</Label>
                <Input placeholder="62000.000000/2026-00" value={form.nup}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, nup: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Ofício</Label>
                <Input placeholder="01/2026" value={form.oficio}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, oficio: e.target.value }))} /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Data do Pedido</Label>
                <Input type="date" value={form.data_pedido}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, data_pedido: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Data de Entrega</Label>
                <Input type="date" value={form.data_entrega}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, data_entrega: e.target.value }))} /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Situação *</Label>
                <Select value={form.situacao} onValueChange={(v: string) => setForm(f => ({ ...f, situacao: v as MgSituacao }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MG_SITUACOES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-2"><Label>Forma de Entrega</Label>
                <Select value={form.forma_entrega || 'none'} onValueChange={(v: string) => setForm(f => ({ ...f, forma_entrega: v==='none' ? '' : v as MgFormaEntrega }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {MG_FORMAS_ENTREGA.map(fe => <SelectItem key={fe} value={fe}>{fe}</SelectItem>)}
                  </SelectContent>
                </Select></div>
            </div>

            <div className="space-y-2"><Label>Tipo do Pedido</Label>
              <Select value={form.tipo_pedido || 'none'} onValueChange={(v: string) => setForm(f => ({ ...f, tipo_pedido: v==='none'?'':v }))}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {TIPO_PEDIDO_OPCOES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select></div>

            {/* Itens */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Materiais</Label>
                <Button type="button" variant="outline" size="sm"
                  onClick={() => setForm(f => ({ ...f, itens: [...f.itens, { item_id:'', unidade_medida:'unidades', qtd_solicitada:0, qtd_autorizada:null }] }))}
                  className="gap-1 h-7 text-xs"><Plus className="w-3 h-3" />Adicionar</Button>
              </div>
              {form.itens.length === 0 && (
                <p className="text-xs text-muted-foreground italic py-3 text-center border border-dashed rounded-lg">
                  Nenhum material — clique em Adicionar
                </p>
              )}
              <div className="space-y-2">
                {form.itens.map((fi, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_100px_80px_80px_28px] gap-2 items-center">
                    {/* Material */}
                    <Select value={fi.item_id || 'none'}
                      onValueChange={(v: string) => updateFormItem(idx, { item_id: v==='none'?'':v })}>
                      <SelectTrigger className="text-xs"><SelectValue placeholder="Material..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecione...</SelectItem>
                        {itens.map(i => <SelectItem key={i.id} value={i.id}>{i.tipo} — {i.campanha}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {/* Unidade */}
                    <Select value={fi.unidade_medida}
                      onValueChange={(v: string) => updateFormItem(idx, { unidade_medida: v as MgUnidade })}>
                      <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MG_UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {/* Qtd solicitada */}
                    <Input type="number" min={0} placeholder="Solicit." className="text-xs"
                      value={fi.qtd_solicitada || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFormItem(idx, { qtd_solicitada: parseInt(e.target.value)||0 })} />
                    {/* Qtd autorizada */}
                    <Input type="number" min={0} placeholder="Autor." className="text-xs"
                      value={fi.qtd_autorizada ?? ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFormItem(idx, { qtd_autorizada: e.target.value ? parseInt(e.target.value) : null })} />
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setForm(f => ({ ...f, itens: f.itens.filter((_,i) => i!==idx) }))}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                {form.itens.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Unidade: "caixas" para envios de caixas fechadas, "unidades" para contagem exata. "Autor." em branco = igual ao solicitado.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2"><Label>Observações</Label>
              <Textarea placeholder="Informações adicionais..." rows={2} value={form.observacoes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm(f => ({ ...f, observacoes: e.target.value }))} /></div>

            {form.situacao === 'Atendido' && !editingPedido && (
              <div className="flex items-start gap-2 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg text-sm text-emerald-700">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                Estoque será abatido automaticamente ao salvar.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmitPedido} disabled={isAdding || isUpdating}>
              {editingPedido ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Estoque ── */}
      <Dialog open={estoqueDialogOpen} onOpenChange={setEstoqueDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajustar Estoque</DialogTitle>
            <DialogDescription>
              Informe caixas e unidades avulsas separadamente. Caixas = caixas fechadas. Unidades avulsas = unidades fora de caixa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Item</Label>
              <Select value={estoqueForm.item_id || 'none'}
                onValueChange={(v: string) => {
                  const id = v === 'none' ? '' : v;
                  setEstoqueForm(f => ({
                    ...f, item_id: id,
                    caixas:           String(caixasPorLocal(id, f.local)),
                    unidades_avulsas: String(unidadesPorLocal(id, f.local)),
                  }));
                }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {itens.map(i => <SelectItem key={i.id} value={i.id}>{i.tipo} — {i.campanha}</SelectItem>)}
                </SelectContent>
              </Select></div>

            <div className="space-y-2"><Label>Local</Label>
              <Select value={estoqueForm.local} onValueChange={onEstoqueLocalChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEM">SEM</SelectItem>
                  <SelectItem value="Castelão">Castelão</SelectItem>
                </SelectContent>
              </Select></div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Caixas</Label>
                <Input type="number" min={0} value={estoqueForm.caixas}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEstoqueForm(f => ({ ...f, caixas: e.target.value }))} />
                <p className="text-[10px] text-muted-foreground">Caixas fechadas</p>
              </div>
              <div className="space-y-2">
                <Label>Unidades avulsas</Label>
                <Input type="number" min={0} value={estoqueForm.unidades_avulsas}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEstoqueForm(f => ({ ...f, unidades_avulsas: e.target.value }))} />
                <p className="text-[10px] text-muted-foreground">Fora de caixa</p>
              </div>
            </div>

            {/* Preview */}
            {estoqueForm.item_id && (() => {
              const item = itens.find(i => i.id === estoqueForm.item_id);
              const cx = parseInt(estoqueForm.caixas) || 0;
              const un = parseInt(estoqueForm.unidades_avulsas) || 0;
              return (
                <div className="bg-muted/40 rounded-lg px-3 py-2 text-xs text-muted-foreground">
                  {item?.unidades_por_cx
                    ? `Total estimado: ${cx} cx × ≈${item.unidades_por_cx} = ≈${cx * item.unidades_por_cx} un + ${un} avulsas`
                    : `${cx} caixas + ${un} unidades avulsas`}
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEstoqueDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmitEstoque}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Transferência Castelão → SEM ── */}
      <Dialog open={transferirDialogOpen} onOpenChange={setTransferirDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-primary" />
              Mover para SEM
            </DialogTitle>
            <DialogDescription>
              Move caixas do Castelão (almoxarifado) para a SEM. O estoque do Castelão será descontado automaticamente.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const item = itens.find(i => i.id === transferirForm.item_id);
            const dispCastelao = caixasPorLocal(transferirForm.item_id, 'Castelão');
            const cx = parseInt(transferirForm.caixas) || 0;
            return (
              <div className="space-y-4 py-2">
                {item && (
                  <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0',
                      MG_TIPO_CORES[item.tipo as MgTipoItem])}>
                      {item.tipo}
                    </span>
                    <div>
                      <p className="font-semibold text-sm">{item.campanha}</p>
                      <p className="text-xs text-muted-foreground">
                        Castelão: <strong>{dispCastelao} cx</strong> disponíveis
                        {item.unidades_por_cx && ` (≈ ${(dispCastelao * item.unidades_por_cx).toLocaleString('pt-BR')} un)`}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Quantas caixas mover para a SEM?</Label>
                  <Input
                    type="number" min={1} max={dispCastelao}
                    value={transferirForm.caixas}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setTransferirForm(f => ({ ...f, caixas: e.target.value }))}
                    autoFocus
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Máximo: {dispCastelao} cx disponíveis no Castelão
                  </p>
                </div>

                {cx > 0 && item && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-500/5 rounded-lg p-2.5">
                      <p className="text-muted-foreground mb-1">Castelão após</p>
                      <p className="font-bold">{Math.max(0, dispCastelao - cx)} cx</p>
                    </div>
                    <div className="bg-primary/5 rounded-lg p-2.5">
                      <p className="text-muted-foreground mb-1">SEM após</p>
                      <p className="font-bold text-primary">
                        {caixasPorLocal(item.id, 'SEM') + cx} cx
                        {item.unidades_por_cx && (
                          <span className="font-normal text-muted-foreground ml-1">
                            ≈ {((caixasPorLocal(item.id, 'SEM') + cx) * item.unidades_por_cx).toLocaleString('pt-BR')} un
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferirDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmitTransferir} className="gap-2">
              <ArrowRightLeft className="w-4 h-4" />Mover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Ajuste Manual de Estoque ── */}
      <Dialog open={estoqueDialogOpen} onOpenChange={setEstoqueDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajuste Manual de Estoque</DialogTitle>
            <DialogDescription>
              Use apenas para correções. Para mover do Castelão para a SEM, use o botão "Mover".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Item</Label>
              <Select value={estoqueForm.item_id || 'none'}
                onValueChange={(v: string) => {
                  const id = v === 'none' ? '' : v;
                  setEstoqueForm(f => ({
                    ...f, item_id: id,
                    caixas:           String(caixasPorLocal(id, f.local)),
                    unidades_avulsas: String(unidadesPorLocal(id, f.local)),
                  }));
                }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {itens.map(i => <SelectItem key={i.id} value={i.id}>{i.tipo} — {i.campanha}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2"><Label>Local</Label>
              <Select value={estoqueForm.local} onValueChange={onEstoqueLocalChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEM">SEM</SelectItem>
                  <SelectItem value="Castelão">Castelão</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Caixas</Label>
              <Input type="number" min={0} value={estoqueForm.caixas}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEstoqueForm(f => ({ ...f, caixas: e.target.value }))} />
            </div>

            {/* Unidades avulsas apenas na SEM */}
            {estoqueForm.local === 'SEM' && (
              <div className="space-y-2">
                <Label>Unidades avulsas <span className="text-muted-foreground font-normal">(sobras fora de caixa)</span></Label>
                <Input type="number" min={0} value={estoqueForm.unidades_avulsas}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEstoqueForm(f => ({ ...f, unidades_avulsas: e.target.value }))} />
              </div>
            )}

            {estoqueForm.item_id && (() => {
              const item = itens.find(i => i.id === estoqueForm.item_id);
              const cx = parseInt(estoqueForm.caixas) || 0;
              const un = parseInt(estoqueForm.unidades_avulsas) || 0;
              if (!item?.unidades_por_cx) return null;
              return (
                <div className="bg-muted/40 rounded-lg px-3 py-2 text-xs text-muted-foreground">
                  Estimativa: {cx} cx × {item.unidades_por_cx} = {(cx * item.unidades_por_cx).toLocaleString('pt-BR')} un
                  {un > 0 && ` + ${un} avulsas = ${(cx * item.unidades_por_cx + un).toLocaleString('pt-BR')} total`}
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEstoqueDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmitEstoque}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Catálogo ── */}
      <Dialog key={editingItem?.id ?? 'new-item'} open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Item' : 'Novo Item do Catálogo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Tipo *</Label>
                <Select value={itemForm.tipo} onValueChange={(v: string) => setItemForm(f => ({ ...f, tipo: v as MgTipoItem }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MG_TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-2"><Label>Campanha / Nome *</Label>
                <Input placeholder="Ex: Mulher Segura" value={itemForm.campanha}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemForm(f => ({ ...f, campanha: e.target.value }))} /></div>
            </div>

            <div className="space-y-2"><Label>Descrição</Label>
              <Input placeholder="Detalhes adicionais..." value={itemForm.descricao}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemForm(f => ({ ...f, descricao: e.target.value }))} /></div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Peso da caixa (g)</Label>
                <Input type="number" min={0} step="0.1" placeholder="Ex: 631" value={itemForm.peso_cx_g}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemForm(f => ({ ...f, peso_cx_g: e.target.value }))} />
                <p className="text-[10px] text-muted-foreground">Peso da caixa inteira em gramas</p>
              </div>
              <div className="space-y-2">
                <Label>Un/cx (aprox.)</Label>
                <Input type="number" min={1} placeholder="Ex: 100" value={itemForm.unidades_por_cx}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemForm(f => ({ ...f, unidades_por_cx: e.target.value }))} />
                <p className="text-[10px] text-muted-foreground">Deixe em branco se variável</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmitItem} disabled={savingItem}>
              {editingItem ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmar exclusão pedido ── */}
      <AlertDialog open={!!deletingPedido} onOpenChange={v => !v && setDeletingPedido(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Pedido de <strong>{deletingPedido?.municipio ?? deletingPedido?.destino_avulso}</strong> será removido.
              {deletingPedido?.estoque_abatido && ' O estoque NÃO será restaurado automaticamente.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={() => { if (deletingPedido) { deletePedido(deletingPedido.id); setDeletingPedido(null); } }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirmar desativar item ── */}
      <AlertDialog open={!!deletingItem} onOpenChange={v => !v && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar item?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deletingItem?.tipo} — {deletingItem?.campanha}</strong> será desativado. O histórico de pedidos é preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDeleteItem}>
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}