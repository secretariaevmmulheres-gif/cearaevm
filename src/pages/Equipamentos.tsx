import { useState } from 'react';
import { Link } from 'react-router-dom';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useEquipamentos, validateNup, checkDuplicata } from '@/hooks/useEquipamentos';
import { municipiosCeara, tiposEquipamento, TipoEquipamento, regioesList, getRegiao } from '@/data/municipios';
import { Equipamento } from '@/types';
import {
  Plus, Pencil, Trash2, Search, Building2, CheckCircle, XCircle,
  Download, FileSpreadsheet, FileText as FilePdf, ChevronDown,
  MapPin, Phone, User, FileText, AlertCircle, ShieldCheck,
  Package, GraduationCap, Hash, AlertTriangle,
  Eye as EyeIcon, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import { useQualificacoes } from '@/hooks/useQualificacoes';
import { HistoricoPanel } from '@/components/HistoricoPanel';
import { exportEquipamentosToPDF, exportEquipamentosToExcel } from '@/lib/exportUtils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const tipoStyles: Record<TipoEquipamento, string> = {
  'Casa da Mulher Brasileira': 'equipment-brasileira',
  'Casa da Mulher Cearense': 'equipment-cearense',
  'Casa da Mulher Municipal': 'equipment-municipal',
  'Sala Lilás Municipal': 'equipment-lilas',
  'Sala Lilás Governo do Estado': 'equipment-lilas-estado',
  'Sala Lilás em Delegacia': 'equipment-lilas-delegacia',
  'DDM': 'equipment-ddm',
};

const tipoColors: Record<TipoEquipamento, { bg: string; text: string; border: string; icon: string }> = {
  'Casa da Mulher Brasileira': {
    bg: 'bg-teal-500/10',
    text: 'text-teal-600',
    border: 'border-teal-500/20',
    icon: 'bg-teal-500/15',
  },
  'Casa da Mulher Cearense': {
    bg: 'bg-violet-500/10',
    text: 'text-violet-600',
    border: 'border-violet-500/20',
    icon: 'bg-violet-500/15',
  },
  'Casa da Mulher Municipal': {
    bg: 'bg-orange-500/10',
    text: 'text-orange-600',
    border: 'border-orange-500/20',
    icon: 'bg-orange-500/15',
  },
  'Sala Lilás Municipal': {
    bg: 'bg-fuchsia-800/10',
    text: 'text-fuchsia-900',
    border: 'border-fuchsia-800/20',
    icon: 'bg-fuchsia-800/15',
  },
  'Sala Lilás Governo do Estado': {
    bg: 'bg-fuchsia-500/10',
    text: 'text-fuchsia-700',
    border: 'border-fuchsia-500/20',
    icon: 'bg-fuchsia-500/15',
  },
  'Sala Lilás em Delegacia': {
    bg: 'bg-fuchsia-300/10',
    text: 'text-fuchsia-600',
    border: 'border-fuchsia-300/20',
    icon: 'bg-fuchsia-300/15',
  },
  'DDM': {
    bg: 'bg-green-700/10',
    text: 'text-green-800',
    border: 'border-green-700/20',
    icon: 'bg-green-700/15',
  },

};

// ── Calcula completude do cadastro ──────────────────────────────────────────
function getCompletude(e: Equipamento): { pct: number; faltando: string[] } {
  const campos = [
    { label: 'Endereço', ok: !!e.endereco?.trim() },
    { label: 'Telefone', ok: !!e.telefone?.trim() },
    { label: 'Responsável', ok: !!e.responsavel?.trim() },
    { label: 'Observações', ok: !!e.observacoes?.trim() },
  ];
  const ok = campos.filter(c => c.ok).length;
  const faltando = campos.filter(c => !c.ok).map(c => c.label);
  // municipio e tipo são obrigatórios, os 4 acima são opcionais mas contam para completude
  const pct = Math.round((ok / campos.length) * 100);
  return { pct, faltando };
}

function CompletudeBar({ equipamento }: { equipamento: Equipamento }) {
  const { pct, faltando } = getCompletude(equipamento);
  const color = pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  const label = pct === 100 ? 'Completo' : pct >= 50 ? 'Parcial' : 'Incompleto';

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-[10px] font-medium shrink-0', {
        'text-emerald-600': pct === 100,
        'text-amber-600': pct >= 50 && pct < 100,
        'text-rose-600': pct < 50,
      })}>
        {pct}%
      </span>
      {pct < 100 && (
        <div className="group relative">
          <AlertCircle className="w-3.5 h-3.5 text-muted-foreground/60 cursor-help" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 bg-popover border border-border rounded-lg shadow-lg p-2 text-xs w-36">
            <p className="font-medium mb-1 text-foreground">Faltando:</p>
            {faltando.map(f => (
              <p key={f} className="text-muted-foreground">• {f}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Linha expansível ─────────────────────────────────────────────────────────
function EquipamentoRow({
  equipamento,
  onEdit,
  onDelete,
  canEdit,
}: {
  equipamento: Equipamento;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const regiao = getRegiao(equipamento.municipio);
  const { pct } = getCompletude(equipamento);

  return (
    <>
      <tr
        className={cn('cursor-pointer transition-colors', expanded ? 'bg-muted/40' : 'hover:bg-muted/20')}
        onClick={() => setExpanded(!expanded)}
      >
        <td>
          <div className="flex items-center gap-2">
            <ChevronDown
              className={cn('w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200', expanded && 'rotate-180')}
            />
            <div>
              <Link
                to={`/municipio/${encodeURIComponent(equipamento.municipio)}`}
                className="font-medium hover:text-primary hover:underline underline-offset-2 transition-colors"
                onClick={e => e.stopPropagation()}
              >
                {equipamento.municipio}
              </Link>
              {regiao && <p className="text-[11px] text-muted-foreground">{regiao}</p>}
            </div>
          </div>
        </td>
        <td onClick={e => e.stopPropagation()}>
          <span className={cn('equipment-badge', tipoStyles[equipamento.tipo])}>
            {equipamento.tipo}
          </span>
        </td>
        <td>
          {equipamento.possui_patrulha ? (
            <span className="flex items-center gap-1 text-success text-sm">
              <CheckCircle className="w-4 h-4" /> Sim
            </span>
          ) : (
            <span className="flex items-center gap-1 text-muted-foreground text-sm">
              <XCircle className="w-4 h-4" /> Não
            </span>
          )}
        </td>
        <td className="text-sm text-muted-foreground">{equipamento.responsavel || '—'}</td>
        <td className="text-sm text-muted-foreground">{equipamento.telefone || '—'}</td>
        <td onClick={e => e.stopPropagation()}>
          <CompletudeBar equipamento={equipamento} />
        </td>
        <td onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            {canEdit && (
              <>
                <Button variant="ghost" size="icon" onClick={onEdit}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </td>
      </tr>

      {/* Linha expandida */}
      <AnimatePresence>
        {expanded && (
          <tr className="bg-muted/20">
            <td colSpan={7} className="p-0">
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-t border-border/50">
                  {/* Endereço */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Endereço</p>
                      <p className="text-sm">{equipamento.endereco || <span className="text-muted-foreground/60 italic">Não informado</span>}</p>
                    </div>
                  </div>

                  {/* Telefone */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Phone className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Telefone</p>
                      <p className="text-sm">{equipamento.telefone || <span className="text-muted-foreground/60 italic">Não informado</span>}</p>
                    </div>
                  </div>

                  {/* Responsável */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Responsável</p>
                      <p className="text-sm">{equipamento.responsavel || <span className="text-muted-foreground/60 italic">Não informado</span>}</p>
                    </div>
                  </div>

                  {/* Observações */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Observações</p>
                      <p className="text-sm">{equipamento.observacoes || <span className="text-muted-foreground/60 italic">Nenhuma</span>}</p>
                    </div>
                  </div>

                  {/* Checklist implantação */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-violet-500" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Implantação</p>
                      <div className="flex items-center gap-1.5 text-sm">
                        {equipamento.kit_athena_entregue
                          ? <CheckCircle className="w-4 h-4 text-success shrink-0" />
                          : <XCircle className="w-4 h-4 text-muted-foreground/40 shrink-0" />}
                        <Package className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className={equipamento.kit_athena_entregue ? '' : 'text-muted-foreground'}>Kit Athena</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        {equipamento.capacitacao_realizada
                          ? <CheckCircle className="w-4 h-4 text-success shrink-0" />
                          : <XCircle className="w-4 h-4 text-muted-foreground/40 shrink-0" />}
                        <GraduationCap className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className={equipamento.capacitacao_realizada ? '' : 'text-muted-foreground'}>Capacitação</span>
                      </div>
                      {equipamento.nup && (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Hash className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="font-mono text-xs">{equipamento.nup}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Histórico de alterações */}
                  <div className="col-span-2">
                    <HistoricoPanel
                      registroId={equipamento.id}
                      tabela="equipamentos"
                    />
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

// ── Página principal ─────────────────────────────────────────────────────────
export default function Equipamentos() {
  const { role } = useAuthContext();
  const canEdit = role !== 'atividades_editor' && role !== 'viewer';
  const { equipamentos, addEquipamento, updateEquipamento, deleteEquipamento, isAdding, isUpdating, isLoadingMore, hasMore, loadMore, total, visibleCount } = useEquipamentos();
  const { solicitacoes } = useSolicitacoes();
  const { qualificacoes } = useQualificacoes();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('all');
  const [filterPatrulha, setFilterPatrulha] = useState<string>('all');
  const [filterRegiao, setFilterRegiao] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingEquipamento, setEditingEquipamento] = useState<Equipamento | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    municipio: '',
    tipo: '' as TipoEquipamento | '',
    possui_patrulha: false,
    endereco: '',
    telefone: '',
    responsavel: '',
    observacoes: '',
    kit_athena_entregue: false,
    kit_athena_previo: false,
    capacitacao_realizada: false,
    qualificacao_id: '' as string,
    nup: '',
  });

  const filteredEquipamentos = equipamentos.filter((e) => {
    const matchesSearch =
      e.municipio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.responsavel || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.endereco || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTipo = filterTipo === 'all' || e.tipo === filterTipo;
    const matchesPatrulha =
      filterPatrulha === 'all' ||
      (filterPatrulha === 'sim' && e.possui_patrulha) ||
      (filterPatrulha === 'nao' && !e.possui_patrulha);
    const matchesRegiao = filterRegiao === 'all' || getRegiao(e.municipio) === filterRegiao;
    return matchesSearch && matchesTipo && matchesPatrulha && matchesRegiao;
  });

  const sortedEquipamentos = [...filteredEquipamentos].sort((a, b) =>
    a.municipio.localeCompare(b.municipio, 'pt-BR')
  );

  // ── Cards de resumo ──
  const totalPorTipo = tiposEquipamento.map(tipo => ({
    tipo,
    count: equipamentos.filter(e => e.tipo === tipo).length,
    colors: tipoColors[tipo as TipoEquipamento],
  }));
  const comPatrulha = equipamentos.filter(e => e.possui_patrulha).length;
  const incompletos = equipamentos.filter(e => getCompletude(e).pct < 100).length;

  const openCreateDialog = () => {
    setEditingEquipamento(null);
    setFormData({ municipio: '', tipo: '', possui_patrulha: false, endereco: '', telefone: '', responsavel: '', observacoes: '', kit_athena_entregue: false, kit_athena_previo: false, capacitacao_realizada: false, qualificacao_id: '', nup: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (equipamento: Equipamento) => {
    setEditingEquipamento(equipamento);
    setFormData({
      municipio: equipamento.municipio,
      tipo: equipamento.tipo,
      possui_patrulha: equipamento.possui_patrulha,
      endereco: equipamento.endereco || '',
      telefone: equipamento.telefone || '',
      responsavel: equipamento.responsavel || '',
      observacoes: equipamento.observacoes || '',
      kit_athena_entregue: equipamento.kit_athena_entregue ?? false,
      kit_athena_previo:     equipamento.kit_athena_previo    ?? false,
      capacitacao_realizada: equipamento.capacitacao_realizada ?? false,
      qualificacao_id: equipamento.qualificacao_id || '',
      nup: equipamento.nup || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.municipio || !formData.tipo) return;

    // ── Validar NUP no frontend antes de enviar ──
    const nupCheck = validateNup(formData.nup);
    if (!nupCheck.valid) {
      toast.error(nupCheck.message ?? 'NUP invalido');
      return;
    }

    const data = {
      municipio: formData.municipio,
      tipo: formData.tipo as TipoEquipamento,
      possui_patrulha: formData.possui_patrulha,
      endereco: formData.endereco,
      telefone: formData.telefone,
      responsavel: formData.responsavel,
      observacoes: formData.observacoes,
      kit_athena_entregue: formData.kit_athena_entregue,
      kit_athena_previo:    formData.kit_athena_previo,
      capacitacao_realizada: formData.capacitacao_realizada,
      nup: formData.nup || null,
    };
    if (editingEquipamento) {
      updateEquipamento({ id: editingEquipamento.id, ...data });
    } else {
      addEquipamento(data);
    }
    setIsDialogOpen(false);
  };

  const handleDelete = () => {
    if (deletingId) {
      deleteEquipamento(deletingId);
      setIsDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  return (
    <AppLayout>

      {/* Banner somente leitura para atividades_editor */}
      {role === 'atividades_editor' && (
        <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 text-sm">
          <EyeIcon className="w-4 h-4 shrink-0" />
          <span>Você tem acesso de <strong>somente leitura</strong> nesta página. Para editar, acesse <strong>Atividades</strong>.</span>
        </div>
      )}
      <PageHeader title="Equipamentos" description="Gerencie os equipamentos de atendimento à mulher">
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { exportEquipamentosToPDF(sortedEquipamentos, filterRegiao).catch(console.error); }}>
                <FilePdf className="w-4 h-4 mr-2" />
                Exportar PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportEquipamentosToExcel(sortedEquipamentos, qualificacoes)}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Exportar Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canEdit && (
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Equipamento
            </Button>
          )}
        </div>
      </PageHeader>

      {/* ── Cards de resumo ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
        {totalPorTipo.map((item, i) => (
          <motion.div
            key={item.tipo}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              'bg-card rounded-xl p-3 border shadow-sm cursor-pointer transition-all hover:shadow-md',
              filterTipo === item.tipo ? 'ring-2 ring-primary' : 'border-border',
            )}
            onClick={() => setFilterTipo(filterTipo === item.tipo ? 'all' : item.tipo)}
          >
            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center mb-2', item.colors.icon)}>
              <Building2 className={cn('w-3.5 h-3.5', item.colors.text)} />
            </div>
            <p className="text-2xl font-bold">{item.count}</p>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{item.tipo}</p>
          </motion.div>
        ))}

        {/* Card patrulha */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            'bg-card rounded-xl p-3 border shadow-sm cursor-pointer transition-all hover:shadow-md',
            filterPatrulha === 'sim' ? 'ring-2 ring-primary' : 'border-border',
          )}
          onClick={() => setFilterPatrulha(filterPatrulha === 'sim' ? 'all' : 'sim')}
        >
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold">{comPatrulha}</p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">Com Patrulha M.P.</p>
        </motion.div>

        {/* Card incompletos */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card rounded-xl p-3 border border-border shadow-sm"
        >
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center mb-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <p className="text-2xl font-bold">{incompletos}</p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">Cadastro Incompleto</p>
        </motion.div>
      </div>

      {/* ── Filtros ── */}
      <div className="bg-card rounded-xl p-4 border border-border shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterRegiao} onValueChange={setFilterRegiao}>
            <SelectTrigger><SelectValue placeholder="Região" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as regiões</SelectItem>
              {regioesList.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger><SelectValue placeholder="Tipo de Equipamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {tiposEquipamento.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterPatrulha} onValueChange={setFilterPatrulha}>
            <SelectTrigger><SelectValue placeholder="Patrulha M.P." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="sim">Com Patrulha</SelectItem>
              <SelectItem value="nao">Sem Patrulha</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center text-sm text-muted-foreground">
            {filteredEquipamentos.length} registro(s) encontrado(s)
            {total !== null && equipamentos.length < total && (
              <span className="ml-1 text-xs">de {total} carregados</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabela ── */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Município / Região</th>
                <th>Tipo</th>
                <th>Patrulha M.P.</th>
                <th>Responsável</th>
                <th>Telefone</th>
                <th>Cadastro</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedEquipamentos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="font-medium">Nenhum equipamento encontrado</p>
                    <p className="text-xs mt-1 opacity-70">Tente ajustar os filtros ou cadastre um novo equipamento</p>
                  </td>
                </tr>
              ) : (
                sortedEquipamentos.slice(0, visibleCount).map((equipamento) => (
                  <EquipamentoRow
                    key={equipamento.id}
                    equipamento={equipamento}
                    canEdit={canEdit}
                    onEdit={() => openEditDialog(equipamento)}
                    onDelete={() => {
                      setDeletingId(equipamento.id);
                      setIsDeleteDialogOpen(true);
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Botão "Carregar mais" */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={loadMore} disabled={isLoadingMore} className="gap-2">
            {isLoadingMore
              ? <><Loader2 className="w-4 h-4 animate-spin" />Carregando...</>
              : <>Carregar mais {total !== null ? `(${equipamentos.length} de ${total})` : ''}</>
            }
          </Button>
        </div>
      )}

      {/* ── Dialog Criar/Editar ── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEquipamento ? 'Editar Equipamento' : 'Novo Equipamento'}</DialogTitle>
            <DialogDescription>Preencha os dados do equipamento de atendimento.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Município *</Label>
                <Select value={formData.municipio} onValueChange={(v) => setFormData({ ...formData, municipio: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {municipiosCeara.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v as TipoEquipamento })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {tiposEquipamento.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Alerta duplicata: usa checkDuplicata — bloqueia CMB/CMC/CMM, avisa para demais */}
            {(() => {
              if (!formData.municipio || !formData.tipo) return null;
              const dup = checkDuplicata(
                equipamentos, formData.municipio, formData.tipo,
                editingEquipamento?.id
              );
              if (!dup) return null;
              return (
                <div className={cn(
                  'flex items-start gap-2 p-3 rounded-lg border text-sm',
                  dup.bloquear
                    ? 'bg-red-500/10 border-red-500/20 text-red-700'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-700'
                )}>
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{dup.message}</span>
                </div>
              );
            })()}

            {/* ── Alerta conflito: município tem solicitação ativa E equipamento já cadastrado ── */}
            {(() => {
              if (!formData.municipio || !formData.tipo || editingEquipamento) return null;
              const solAtiva = solicitacoes.find(
                s => s.municipio === formData.municipio &&
                     s.tipo_equipamento === formData.tipo &&
                     s.status !== 'Cancelada' && s.status !== 'Inaugurada'
              );
              if (!solAtiva) return null;
              return (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span><strong>{formData.municipio}</strong> tem uma solicitação ativa com status <strong>{solAtiva.status}</strong> para este tipo. Verifique se o equipamento já foi inaugurado antes de cadastrar.</span>
                </div>
              );
            })()}

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <Label htmlFor="patrulha">Possui Patrulha Maria da Penha?</Label>
              <Switch
                id="patrulha"
                checked={formData.possui_patrulha}
                onCheckedChange={(v) => setFormData({ ...formData, possui_patrulha: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="kit_athena">Kit Athena entregue</Label>
              <Switch
                id="kit_athena"
                checked={formData.kit_athena_entregue}
                onCheckedChange={(v) => setFormData({ ...formData, kit_athena_entregue: v })}
              />
            </div>
            {formData.kit_athena_entregue && (
              <div className="flex items-center justify-between pl-4 border-l-2 border-amber-400">
                <Label htmlFor="kit_athena_previo" className="text-sm text-amber-700">
                  Entregue via <span className="font-semibold">PréVio</span>
                </Label>
                <Switch
                  id="kit_athena_previo"
                  checked={formData.kit_athena_previo}
                  onCheckedChange={(v) => setFormData({ ...formData, kit_athena_previo: v })}
                />
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label htmlFor="capacitacao">Capacitação realizada</Label>
              <Switch
                id="capacitacao"
                checked={formData.capacitacao_realizada}
                onCheckedChange={(v) => setFormData({ ...formData, capacitacao_realizada: v, qualificacao_id: v ? formData.qualificacao_id : '' })}
              />
            </div>

            {formData.capacitacao_realizada && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Vincular a uma qualificação (opcional)</Label>
                <Select
                  value={formData.qualificacao_id || 'none'}
                  onValueChange={v => setFormData({ ...formData, qualificacao_id: v === 'none' ? '' : v })}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecionar qualificação..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não vincular</SelectItem>
                    {qualificacoes
                      .filter(q => !formData.municipio || q.municipios.some(m => m.municipio === formData.municipio))
                      .map(q => (
                        <SelectItem key={q.id} value={q.id}>
                          {q.nome} ({new Date(q.data + 'T00:00:00').toLocaleDateString('pt-BR')})
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                placeholder="Rua, número, bairro..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="(85) 99999-0000"
                />
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Input
                  value={formData.responsavel}
                  onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                  placeholder="Nome do responsável"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>NUP (Número do Processo)</Label>
              <Input
                value={formData.nup}
                onChange={(e) => {
                  // Máscara automática: 62000.001753/2025-56
                  const v = e.target.value.replace(/\D/g, '');
                  let fmt = '';
                  for (let i = 0; i < v.length && i < 17; i++) {
                    if (i === 5)  fmt += '.';
                    if (i === 11) fmt += '/';
                    if (i === 15) fmt += '-';
                    fmt += v[i];
                  }
                  setFormData({ ...formData, nup: fmt });
                }}
                placeholder="62000.001753/2025-56"
                className={cn(
                  formData.nup && !validateNup(formData.nup).valid
                    ? 'border-red-400 focus-visible:ring-red-400/30'
                    : formData.nup && validateNup(formData.nup).valid
                    ? 'border-emerald-400 focus-visible:ring-emerald-400/30'
                    : ''
                )}
              />
              {formData.nup && !validateNup(formData.nup).valid && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Formato inválido — esperado: 62000.001753/2025-56
                </p>
              )}
              {formData.nup && validateNup(formData.nup).valid && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> NUP válido
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Informações adicionais..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={
                isAdding || isUpdating ||
                (formData.nup ? !validateNup(formData.nup).valid : false) ||
                (!!formData.municipio && !!formData.tipo &&
                  !!checkDuplicata(equipamentos, formData.municipio, formData.tipo, editingEquipamento?.id)?.bloquear)
              }
            >
              {editingEquipamento ? 'Salvar Alteracoes' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Deletar ── */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este equipamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}