import { useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import {
  municipiosCeara, tiposEquipamento, statusSolicitacao,
  TipoEquipamento, StatusSolicitacao, regioesList, getRegiao,
} from '@/data/municipios';
import { Solicitacao } from '@/types';
import {
  Plus, Pencil, Trash2, Search, FileText, ArrowRight, Building2,
  Download, FileSpreadsheet, FileText as FilePdf, ChevronDown,
  ShieldCheck, Users, Package, GraduationCap, Hash,
  CheckCircle2, Circle, CalendarDays, StickyNote,
  Eye as EyeIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { HistoricoPanel } from '@/components/HistoricoPanel';
import { exportSolicitacoesToPDF, exportSolicitacoesToExcel } from '@/lib/exportUtils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const tiposEquipamentoSolicitacao = tiposEquipamento.filter(
  (t) => t !== 'DDM' && t !== 'Sala Lilás em Delegacia'
);

const statusStyles: Record<StatusSolicitacao, string> = {
  Recebida: 'badge-recebida', 'Em análise': 'badge-analise', Aprovada: 'badge-aprovada',
  'Em implantação': 'badge-implantacao', Inaugurada: 'badge-inaugurada', Cancelada: 'badge-cancelada',
};

const statusCardColors: Record<StatusSolicitacao, { bg: string; text: string; icon: string; border: string }> = {
  Recebida:         { bg: 'bg-slate-500/10',   text: 'text-slate-600',   icon: 'bg-slate-500/15',   border: 'border-slate-500/20'   },
  'Em análise':     { bg: 'bg-amber-500/10',   text: 'text-amber-600',   icon: 'bg-amber-500/15',   border: 'border-amber-500/20'   },
  Aprovada:         { bg: 'bg-blue-500/10',    text: 'text-blue-600',    icon: 'bg-blue-500/15',    border: 'border-blue-500/20'    },
  'Em implantação': { bg: 'bg-violet-500/10',  text: 'text-violet-600',  icon: 'bg-violet-500/15',  border: 'border-violet-500/20'  },
  Inaugurada:       { bg: 'bg-emerald-500/10', text: 'text-emerald-600', icon: 'bg-emerald-500/15', border: 'border-emerald-500/20' },
  Cancelada:        { bg: 'bg-rose-500/10',    text: 'text-rose-600',    icon: 'bg-rose-500/15',    border: 'border-rose-500/20'    },
};

function getProgresso(s: Solicitacao): { pct: number; itens: { label: string; ok: boolean; icon: React.ReactNode }[] } {
  const itens = [
    { label: 'Patrulha M.P.',    ok: s.recebeu_patrulha,            icon: <ShieldCheck   className="w-3.5 h-3.5" /> },
    { label: 'Guarda Municipal', ok: s.guarda_municipal_estruturada, icon: <Users         className="w-3.5 h-3.5" /> },
    { label: 'Kit Athena',       ok: s.kit_athena_entregue,          icon: <Package       className="w-3.5 h-3.5" /> },
    { label: 'Qualificação',     ok: s.capacitacao_realizada,        icon: <GraduationCap className="w-3.5 h-3.5" /> },
    { label: 'NUP',              ok: !!(s.nup?.trim()),              icon: <Hash          className="w-3.5 h-3.5" /> },
  ];
  const ok = itens.filter(i => i.ok).length;
  return { pct: Math.round((ok / itens.length) * 100), itens };
}

function ProgressoBar({ solicitacao }: { solicitacao: Solicitacao }) {
  const { pct } = getProgresso(solicitacao);
  const color = pct === 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : pct >= 20 ? 'bg-amber-500' : 'bg-rose-400';
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-[10px] font-medium shrink-0', {
        'text-emerald-600': pct === 100, 'text-blue-600': pct >= 60 && pct < 100,
        'text-amber-600': pct >= 20 && pct < 60, 'text-rose-500': pct < 20,
      })}>{pct}%</span>
    </div>
  );
}

function SolicitacaoRow({ solicitacao, onEdit, onDelete, onTransform, canEdit }: {
  solicitacao: Solicitacao; onEdit: () => void; onDelete: () => void;
  onTransform: () => void; canEdit: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const regiao = getRegiao(solicitacao.municipio);
  const { itens } = getProgresso(solicitacao);

  return (
    <>
      <tr className={cn('cursor-pointer transition-colors', expanded ? 'bg-muted/40' : 'hover:bg-muted/20')}
        onClick={() => setExpanded(!expanded)}>
        <td>
          <div className="flex items-center gap-2">
            <ChevronDown className={cn('w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200', expanded && 'rotate-180')} />
            <div>
              <p className="font-medium">{solicitacao.municipio}</p>
              {regiao && <p className="text-[11px] text-muted-foreground">{regiao}</p>}
            </div>
          </div>
        </td>
        <td className="text-sm">{solicitacao.tipo_equipamento}</td>
        <td className="text-sm text-muted-foreground">
          {format(new Date(solicitacao.data_solicitacao + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
        </td>
        <td onClick={e => e.stopPropagation()}>
          <span className={cn('badge-status', statusStyles[solicitacao.status])}>{solicitacao.status}</span>
        </td>
        <td onClick={e => e.stopPropagation()}><ProgressoBar solicitacao={solicitacao} /></td>
        <td onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            {canEdit && solicitacao.status === 'Inaugurada' && (
              <Button variant="outline" size="sm" className="text-success border-success/30 hover:bg-success/10 h-7 px-2" onClick={onTransform}>
                <Building2 className="w-3.5 h-3.5 mr-1" /><ArrowRight className="w-3 h-3" />
              </Button>
            )}
            {canEdit && (
              <>
                <Button variant="ghost" size="icon" onClick={onEdit}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="w-4 h-4" /></Button>
              </>
            )}
          </div>
        </td>
      </tr>
      <AnimatePresence>
        {expanded && (
          <tr className="bg-muted/20">
            <td colSpan={6} className="p-0">
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="px-6 py-4 border-t border-border/50 grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Acompanhamento</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {itens.map((item) => (
                        <div key={item.label} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-sm',
                          item.ok ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-700' : 'bg-muted/40 border-border/50 text-muted-foreground')}>
                          {item.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0 opacity-40" />}
                          <span className={cn('text-[11px] font-medium', !item.ok && 'line-through opacity-50')}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Detalhes</p>
                    {solicitacao.nup && (
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5"><Hash className="w-3 h-3 text-primary" /></div>
                        <div><p className="text-[10px] text-muted-foreground">NUP</p><p className="text-xs font-mono font-medium">{solicitacao.nup}</p></div>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5"><CalendarDays className="w-3 h-3 text-primary" /></div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Data da Solicitação</p>
                        <p className="text-xs font-medium">{format(new Date(solicitacao.data_solicitacao + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                      </div>
                    </div>
                    {solicitacao.observacoes && (
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5"><StickyNote className="w-3 h-3 text-primary" /></div>
                        <div><p className="text-[10px] text-muted-foreground">Observações</p><p className="text-xs">{solicitacao.observacoes}</p></div>
                      </div>
                    )}
                    {!solicitacao.nup && !solicitacao.observacoes && <p className="text-xs text-muted-foreground/60 italic">Sem detalhes adicionais</p>}
                  </div>
                  <div className="lg:col-span-3">
                    <HistoricoPanel registroId={solicitacao.id} tabela="solicitacoes" />
                  </div>
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}

export default function Solicitacoes() {
  const { role } = useAuthContext();
  const canEdit = role !== 'atividades_editor' && role !== 'viewer';
  const { solicitacoes, addSolicitacao, updateSolicitacao, deleteSolicitacao, transformarEmEquipamento, isAdding, isUpdating } = useSolicitacoes();

  const [searchTerm,   setSearchTerm]   = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTipo,   setFilterTipo]   = useState<string>('all');
  const [filterRegiao, setFilterRegiao] = useState<string>('all');
  const [filterAno,    setFilterAno]    = useState<string>(String(new Date().getFullYear()));

  const [isDialogOpen,          setIsDialogOpen]          = useState(false);
  const [isDeleteDialogOpen,    setIsDeleteDialogOpen]    = useState(false);
  const [isTransformDialogOpen, setIsTransformDialogOpen] = useState(false);
  const [editingSolicitacao,    setEditingSolicitacao]    = useState<Solicitacao | null>(null);
  const [deletingId,            setDeletingId]            = useState<string | null>(null);
  const [transformingId,        setTransformingId]        = useState<string | null>(null);

  const [formData, setFormData] = useState({
    municipio: '', data_solicitacao: '', tipo_equipamento: '' as TipoEquipamento | '',
    status: 'Recebida' as StatusSolicitacao,
    recebeu_patrulha: false, guarda_municipal_estruturada: false,
    kit_athena_entregue: false, kit_athena_previo: false, capacitacao_realizada: false,
    nup: '', observacoes: '', anexos: [] as string[],
  });

  const filteredSolicitacoes = solicitacoes
    .filter((s) => {
      const matchesSearch  = s.municipio.toLowerCase().includes(searchTerm.toLowerCase()) || (s.observacoes || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus  = filterStatus === 'all' || s.status === filterStatus;
      const matchesTipo    = filterTipo   === 'all' || s.tipo_equipamento === filterTipo;
      const matchesRegiao  = filterRegiao === 'all' || getRegiao(s.municipio) === filterRegiao;
      const matchesAno     = filterAno    === 'all' || new Date(s.data_solicitacao + 'T00:00:00').getFullYear() === parseInt(filterAno);
      return matchesSearch && matchesStatus && matchesTipo && matchesRegiao && matchesAno;
    })
    .sort((a, b) => new Date(b.data_solicitacao + 'T00:00:00').getTime() - new Date(a.data_solicitacao + 'T00:00:00').getTime());

  const cardStatuses: StatusSolicitacao[] = ['Recebida', 'Em análise', 'Aprovada', 'Em implantação', 'Inaugurada', 'Cancelada'];

  const openCreateDialog = () => {
    setEditingSolicitacao(null);
    setFormData({ municipio: '', data_solicitacao: format(new Date(), 'yyyy-MM-dd'), tipo_equipamento: '', status: 'Recebida',
      recebeu_patrulha: false, guarda_municipal_estruturada: false, kit_athena_entregue: false, kit_athena_previo: false,
      capacitacao_realizada: false, nup: '', observacoes: '', anexos: [] });
    setIsDialogOpen(true);
  };

  const openEditDialog = (s: Solicitacao) => {
    setEditingSolicitacao(s);
    setFormData({ municipio: s.municipio, data_solicitacao: format(new Date(s.data_solicitacao + 'T00:00:00'), 'yyyy-MM-dd'),
      tipo_equipamento: s.tipo_equipamento, status: s.status, recebeu_patrulha: s.recebeu_patrulha,
      guarda_municipal_estruturada: s.guarda_municipal_estruturada, kit_athena_entregue: s.kit_athena_entregue,
      kit_athena_previo: s.kit_athena_previo ?? false, capacitacao_realizada: s.capacitacao_realizada,
      nup: s.nup || '', observacoes: s.observacoes || '', anexos: s.anexos || [] });
    setIsDialogOpen(true);
  };

  // Payload reutilizado em ambos os handlers de submit
  const buildPayload = () => ({
    municipio: formData.municipio, data_solicitacao: formData.data_solicitacao,
    tipo_equipamento: formData.tipo_equipamento as TipoEquipamento, status: formData.status,
    recebeu_patrulha: formData.recebeu_patrulha, guarda_municipal_estruturada: formData.guarda_municipal_estruturada,
    kit_athena_entregue: formData.kit_athena_entregue, kit_athena_previo: formData.kit_athena_previo,
    capacitacao_realizada: formData.capacitacao_realizada, nup: formData.nup,
    observacoes: formData.observacoes, anexos: formData.anexos,
  });

  const handleSubmit = () => {
    if (!formData.municipio || !formData.tipo_equipamento) { toast.error('Preencha os campos obrigatórios'); return; }
    if (editingSolicitacao) { updateSolicitacao({ id: editingSolicitacao.id, ...buildPayload() }); }
    else { addSolicitacao(buildPayload()); }
    setIsDialogOpen(false);
  };

  // Salva edição e já abre o confirm de transformação em sequência
  const handleSubmitAndTransform = () => {
    if (!formData.municipio || !formData.tipo_equipamento) { toast.error('Preencha os campos obrigatórios'); return; }
    if (!editingSolicitacao) return;
    updateSolicitacao({ id: editingSolicitacao.id, ...buildPayload() });
    setIsDialogOpen(false);
    setTransformingId(editingSolicitacao.id);
    setIsTransformDialogOpen(true);
  };

  const handleDelete = () => {
    if (deletingId) { deleteSolicitacao(deletingId); setIsDeleteDialogOpen(false); setDeletingId(null); }
  };

  const handleTransform = () => {
    if (transformingId) { transformarEmEquipamento(transformingId); setIsTransformDialogOpen(false); setTransformingId(null); }
  };

  return (
    <AppLayout>
      {role === 'atividades_editor' && (
        <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 text-sm">
          <EyeIcon className="w-4 h-4 shrink-0" />
          <span>Você tem acesso de <strong>somente leitura</strong> nesta página. Para editar, acesse <strong>Atividades</strong>.</span>
        </div>
      )}

      <PageHeader title="Solicitações" description="Acompanhe os pedidos de implantação de equipamentos">
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><Download className="w-4 h-4 mr-2" />Exportar</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportSolicitacoesToPDF(filteredSolicitacoes, filterRegiao)}>
                <FilePdf className="w-4 h-4 mr-2" />Exportar PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportSolicitacoesToExcel(filteredSolicitacoes)}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />Exportar Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canEdit && (
            <Button onClick={openCreateDialog}><Plus className="w-4 h-4 mr-2" />Nova Solicitação</Button>
          )}
        </div>
      </PageHeader>

      {/* Cards resumo */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {cardStatuses.map((status, i) => {
          const count = solicitacoes.filter(s => s.status === status).length;
          const colors = statusCardColors[status];
          const isActive = filterStatus === status;
          return (
            <motion.div key={status} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={cn('bg-card rounded-xl p-3 border shadow-sm cursor-pointer transition-all hover:shadow-md', isActive ? 'ring-2 ring-primary' : 'border-border')}
              onClick={() => setFilterStatus(isActive ? 'all' : status)}>
              <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center mb-2', colors.icon)}>
                <FileText className={cn('w-3.5 h-3.5', colors.text)} />
              </div>
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{status}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="bg-card rounded-xl p-4 border border-border shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterRegiao} onValueChange={setFilterRegiao}>
            <SelectTrigger><SelectValue placeholder="Região" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as regiões</SelectItem>
              {regioesList.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {statusSolicitacao.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {tiposEquipamentoSolicitacao.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterAno} onValueChange={setFilterAno}>
            <SelectTrigger><SelectValue placeholder="Ano">{filterAno === 'all' ? 'Todos os anos' : filterAno}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os anos</SelectItem>
              {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center text-sm text-muted-foreground">{filteredSolicitacoes.length} registro(s) encontrado(s)</div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Município / Região</th><th>Tipo</th><th>Data</th>
                <th>Status</th><th>Progresso</th><th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredSolicitacoes.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="font-medium">Nenhuma solicitação encontrada</p>
                  <p className="text-xs mt-1 opacity-70">Tente ajustar os filtros ou cadastre uma nova solicitação</p>
                </td></tr>
              ) : (
                filteredSolicitacoes.map((s) => (
                  <SolicitacaoRow key={s.id} solicitacao={s} canEdit={canEdit}
                    onEdit={() => openEditDialog(s)}
                    onDelete={() => { setDeletingId(s.id); setIsDeleteDialogOpen(true); }}
                    onTransform={() => { setTransformingId(s.id); setIsTransformDialogOpen(true); }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog Criar/Editar */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSolicitacao ? 'Editar Solicitação' : 'Nova Solicitação'}</DialogTitle>
            <DialogDescription>Registre ou atualize uma solicitação de implantação de equipamento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Município *</Label>
                <Select value={formData.municipio} onValueChange={(v) => setFormData({ ...formData, municipio: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{municipiosCeara.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data da Solicitação</Label>
                <Input type="date" value={formData.data_solicitacao} onChange={(e) => setFormData({ ...formData, data_solicitacao: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Equipamento *</Label>
                <Select value={formData.tipo_equipamento} onValueChange={(v) => setFormData({ ...formData, tipo_equipamento: v as TipoEquipamento })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{tiposEquipamentoSolicitacao.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as StatusSolicitacao })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{statusSolicitacao.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Alerta contextual quando status é Inaugurada no modo edição */}
            {editingSolicitacao && formData.status === 'Inaugurada' && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-sm">
                <Building2 className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Esta solicitação está <strong>Inaugurada</strong>. Use o botão abaixo para salvar e criar o equipamento diretamente.</p>
              </div>
            )}

            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <Label className="text-sm font-semibold">Acompanhamento</Label>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { id: 'patrulha', label: 'Recebeu Patrulha Maria da Penha', key: 'recebeu_patrulha'             },
                  { id: 'guarda',   label: 'Guarda Municipal estruturada',    key: 'guarda_municipal_estruturada' },
                  { id: 'kit',      label: 'Kit Athena entregue',             key: 'kit_athena_entregue'          },
                  { id: 'qualif',   label: 'Qualificação realizada',          key: 'capacitacao_realizada'        },
                ].map(item => (
                  <div key={item.id} className="flex items-center justify-between">
                    <Label htmlFor={item.id} className="text-sm font-normal">{item.label}</Label>
                    <Switch id={item.id} checked={formData[item.key as keyof typeof formData] as boolean}
                      onCheckedChange={(v) => setFormData({ ...formData, [item.key]: v })} />
                  </div>
                ))}
                {formData.kit_athena_entregue && (
                  <div className="flex items-center justify-between pl-4 border-l-2 border-amber-400">
                    <Label htmlFor="kit_previo" className="text-sm font-normal text-amber-700">
                      Entregue via <span className="font-semibold">PréVio</span>
                    </Label>
                    <Switch id="kit_previo" checked={formData.kit_athena_previo}
                      onCheckedChange={(v) => setFormData({ ...formData, kit_athena_previo: v })} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Número do Processo (NUP)</Label>
                  <Input value={formData.nup} onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    let formatted = '';
                    for (let i = 0; i < value.length && i < 17; i++) {
                      if (i === 5) formatted += '.'; if (i === 11) formatted += '/'; if (i === 15) formatted += '-';
                      formatted += value[i];
                    }
                    setFormData({ ...formData, nup: formatted });
                  }} placeholder="62000.001753/2025-56" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Informações adicionais..." rows={3} />
            </div>
          </div>

          {/* Footer — botão transformar aparece só ao editar com status Inaugurada */}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {editingSolicitacao && formData.status === 'Inaugurada' && (
              <Button type="button" variant="outline" onClick={handleSubmitAndTransform} disabled={isAdding || isUpdating}
                className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950 sm:mr-auto">
                <Building2 className="w-4 h-4" />
                Salvar e Criar Equipamento
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isAdding || isUpdating}>
              {editingSolicitacao ? 'Salvar Alterações' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Deletar */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta solicitação? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Transformar */}
      <AlertDialog open={isTransformDialogOpen} onOpenChange={setIsTransformDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transformar em Equipamento</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação criará um novo equipamento herdando Kit Athena, Patrulha, Qualificação e NUP da solicitação. A solicitação permanecerá como registro histórico. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleTransform} className="bg-success hover:bg-success/90">Criar Equipamento</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}