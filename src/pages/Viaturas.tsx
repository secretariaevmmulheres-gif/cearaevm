import { useState } from 'react';
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
import { useViaturas } from '@/hooks/useViaturas';
import { useEquipamentos } from '@/hooks/useEquipamentos';
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import { municipiosCeara, orgaosResponsaveis, OrgaoResponsavel, regioesList, getRegiao } from '@/data/municipios';
import { Viatura, Equipamento, Solicitacao } from '@/types';
import {
  Plus, Pencil, Trash2, Search, Truck, Download, FileSpreadsheet,
  FileText as FilePdf, Building2, ChevronDown, MapPin, User,
  CalendarDays, Link2, Link2Off, StickyNote, AlertCircle,
  ShieldCheck, Hash,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { exportViaturasToPDF, exportViaturasToExcel, exportPatrulhasCasasToPDF, exportPatrulhasCasasToExcel } from '@/lib/exportUtils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ── Completude da viatura ────────────────────────────────────────────────────
function getCompletude(v: Viatura): { pct: number; faltando: string[] } {
  const campos = [
    { label: 'Data de Implantação', ok: !!v.data_implantacao },
    { label: 'Responsável',         ok: !!v.responsavel?.trim() },
    { label: 'Observações',         ok: !!v.observacoes?.trim() },
  ];
  const ok = campos.filter(c => c.ok).length;
  return { pct: Math.round((ok / campos.length) * 100), faltando: campos.filter(c => !c.ok).map(c => c.label) };
}

function CompletudeBar({ v }: { v: Viatura }) {
  const { pct, faltando } = getCompletude(v);
  const color = pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-[10px] font-medium shrink-0', {
        'text-emerald-600': pct === 100,
        'text-amber-600': pct >= 50 && pct < 100,
        'text-rose-600': pct < 50,
      })}>{pct}%</span>
      {pct < 100 && (
        <div className="group relative">
          <AlertCircle className="w-3.5 h-3.5 text-muted-foreground/60 cursor-help" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 bg-popover border border-border rounded-lg shadow-lg p-2 text-xs w-36">
            <p className="font-medium mb-1 text-foreground">Faltando:</p>
            {faltando.map(f => <p key={f} className="text-muted-foreground">• {f}</p>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Linha expansível — Viatura PMCE ─────────────────────────────────────────
function ViaturaRow({ viatura, equipamentos, onEdit, onDelete }: {
  viatura: Viatura;
  equipamentos: Equipamento[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const regiao = getRegiao(viatura.municipio);
  const equipamentoVinculado = equipamentos.find(e => e.id === viatura.equipamento_id);

  return (
    <>
      <tr
        className={cn('cursor-pointer transition-colors', expanded ? 'bg-muted/40' : 'hover:bg-muted/20')}
        onClick={() => setExpanded(!expanded)}
      >
        <td>
          <div className="flex items-center gap-2">
            <ChevronDown className={cn('w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200', expanded && 'rotate-180')} />
            <div>
              <p className="font-medium">{viatura.municipio}</p>
              {regiao && <p className="text-[11px] text-muted-foreground">{regiao}</p>}
            </div>
          </div>
        </td>
        <td onClick={e => e.stopPropagation()}>
          <span className="badge-status bg-primary/10 text-primary">{viatura.orgao_responsavel}</span>
        </td>
        <td><span className="font-semibold text-lg">{viatura.quantidade}</span></td>
        <td className="text-sm text-muted-foreground">
          {format(new Date(viatura.data_implantacao), 'dd/MM/yyyy', { locale: ptBR })}
        </td>
        <td>
          {viatura.vinculada_equipamento
            ? <span className="flex items-center gap-1 text-success text-xs"><Link2 className="w-3.5 h-3.5" /> Vinculada</span>
            : <span className="flex items-center gap-1 text-muted-foreground text-xs"><Link2Off className="w-3.5 h-3.5" /> Não vinculada</span>
          }
        </td>
        <td className="text-sm text-muted-foreground">{viatura.responsavel || '—'}</td>
        <td onClick={e => e.stopPropagation()}>
          <CompletudeBar v={viatura} />
        </td>
        <td onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit}><Pencil className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </td>
      </tr>

      <AnimatePresence>
        {expanded && (
          <tr className="bg-muted/20">
            <td colSpan={8} className="p-0">
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-6 py-4 border-t border-border/50 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <CalendarDays className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Data de Implantação</p>
                      <p className="text-sm">
                        {format(new Date(viatura.data_implantacao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Responsável</p>
                      <p className="text-sm">{viatura.responsavel || <span className="text-muted-foreground/60 italic">Não informado</span>}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Link2 className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Equipamento Vinculado</p>
                      <p className="text-sm">
                        {equipamentoVinculado
                          ? `${equipamentoVinculado.tipo}`
                          : <span className="text-muted-foreground/60 italic">Não vinculada</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <StickyNote className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Observações</p>
                      <p className="text-sm">{viatura.observacoes || <span className="text-muted-foreground/60 italic">Nenhuma</span>}</p>
                    </div>
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

// ── Tipo unificado Patrulha das Casas ────────────────────────────────────────
type PatrulhaCasa = {
  id: string; municipio: string; tipo: string; endereco: string;
  responsavel: string; telefone: string; origem: 'equipamento' | 'solicitacao'; status?: string;
};

// ── Linha expansível — Patrulha das Casas ───────────────────────────────────
function PatrulhaRow({ patrulha }: { patrulha: PatrulhaCasa }) {
  const [expanded, setExpanded] = useState(false);
  const regiao = getRegiao(patrulha.municipio);
  const temDetalhes = patrulha.endereco || patrulha.responsavel || patrulha.telefone;

  return (
    <>
      <tr
        className={cn(
          'transition-colors',
          temDetalhes ? 'cursor-pointer' : '',
          expanded ? 'bg-muted/40' : temDetalhes ? 'hover:bg-muted/20' : '',
        )}
        onClick={() => temDetalhes && setExpanded(!expanded)}
      >
        <td>
          <div className="flex items-center gap-2">
            {temDetalhes
              ? <ChevronDown className={cn('w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200', expanded && 'rotate-180')} />
              : <div className="w-4" />
            }
            <div>
              <p className="font-medium">{patrulha.municipio}</p>
              {regiao && <p className="text-[11px] text-muted-foreground">{regiao}</p>}
            </div>
          </div>
        </td>
        <td>
          <span className="badge-status bg-emerald-500/10 text-emerald-600">{patrulha.tipo}</span>
        </td>
        <td>
          {patrulha.origem === 'equipamento'
            ? <span className="badge-status bg-primary/10 text-primary">Equipamento</span>
            : <span className="badge-status bg-warning/10 text-warning">Solicitação ({patrulha.status})</span>
          }
        </td>
        <td className="text-sm text-muted-foreground">{patrulha.endereco || '—'}</td>
        <td className="text-sm">{patrulha.responsavel || '—'}</td>
        <td className="text-sm text-muted-foreground">{patrulha.telefone || '—'}</td>
      </tr>

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
                <div className="px-6 py-4 border-t border-border/50 grid grid-cols-3 gap-4">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Endereço</p>
                      <p className="text-sm">{patrulha.endereco || <span className="italic text-muted-foreground/60">Não informado</span>}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Responsável</p>
                      <p className="text-sm">{patrulha.responsavel || <span className="italic text-muted-foreground/60">Não informado</span>}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Hash className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Telefone</p>
                      <p className="text-sm">{patrulha.telefone || <span className="italic text-muted-foreground/60">Não informado</span>}</p>
                    </div>
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
export default function Viaturas() {
  const { viaturas, addViatura, updateViatura, deleteViatura, isAdding, isUpdating } = useViaturas();
  const { equipamentos } = useEquipamentos();
  const { solicitacoes } = useSolicitacoes();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrgao, setFilterOrgao] = useState<string>('all');
  const [filterVinculada, setFilterVinculada] = useState<string>('all');
  const [filterRegiao, setFilterRegiao] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingViatura, setEditingViatura] = useState<Viatura | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    municipio: '', tipo_patrulha: 'Patrulha Maria da Penha',
    vinculada_equipamento: false, equipamento_id: '',
    orgao_responsavel: '' as OrgaoResponsavel | '',
    quantidade: 1, data_implantacao: '', responsavel: '', observacoes: '',
  });

  const equipamentosDoMunicipio = equipamentos.filter(e => e.municipio === formData.municipio);

  const filteredViaturas = viaturas
    .filter((v) => {
      const matchesSearch = v.municipio.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.responsavel || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesOrgao = filterOrgao === 'all' || v.orgao_responsavel === filterOrgao;
      const matchesVinculada = filterVinculada === 'all' ||
        (filterVinculada === 'sim' && v.vinculada_equipamento) ||
        (filterVinculada === 'nao' && !v.vinculada_equipamento);
      const matchesRegiao = filterRegiao === 'all' || getRegiao(v.municipio) === filterRegiao;
      return matchesSearch && matchesOrgao && matchesVinculada && matchesRegiao;
    })
    .sort((a, b) => a.municipio.localeCompare(b.municipio));

  const patrulhasDeEquipamentos = equipamentos
    .filter(e => e.possui_patrulha)
    .filter(e => {
      const matchesSearch = e.municipio.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.responsavel || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRegiao = filterRegiao === 'all' || getRegiao(e.municipio) === filterRegiao;
      return matchesSearch && matchesRegiao;
    });

  const municipiosComPatrulhaEquip = new Set(equipamentos.filter(e => e.possui_patrulha).map(e => e.municipio));

  const patrulhasDeSolicitacoes = solicitacoes
    .filter(s => s.recebeu_patrulha && !municipiosComPatrulhaEquip.has(s.municipio))
    .filter(s => {
      const matchesSearch = s.municipio.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRegiao = filterRegiao === 'all' || getRegiao(s.municipio) === filterRegiao;
      return matchesSearch && matchesRegiao;
    });

  const patrulhasDasCasas: PatrulhaCasa[] = [
    ...patrulhasDeEquipamentos.map(e => ({
      id: e.id, municipio: e.municipio, tipo: e.tipo,
      endereco: e.endereco || '', responsavel: e.responsavel || '',
      telefone: e.telefone || '', origem: 'equipamento' as const,
    })),
    ...patrulhasDeSolicitacoes.map(s => ({
      id: s.id, municipio: s.municipio, tipo: s.tipo_equipamento,
      endereco: '', responsavel: '', telefone: '',
      origem: 'solicitacao' as const, status: s.status,
    })),
  ].sort((a, b) => a.municipio.localeCompare(b.municipio));

  // ── Cards de resumo ──
  const totalViaturas = viaturas.reduce((s, v) => s + v.quantidade, 0);
  const vinculadas = viaturas.filter(v => v.vinculada_equipamento).reduce((s, v) => s + v.quantidade, 0);
  const naoVinculadas = totalViaturas - vinculadas;
  const incompletas = filteredViaturas.filter(v => getCompletude(v).pct < 100).length;

  const orgaosCounts = orgaosResponsaveis.map(orgao => ({
    orgao,
    count: viaturas.filter(v => v.orgao_responsavel === orgao).reduce((s, v) => s + v.quantidade, 0),
  })).filter(o => o.count > 0);

  const openCreateDialog = () => {
    setEditingViatura(null);
    setFormData({ municipio: '', tipo_patrulha: 'Patrulha Maria da Penha', vinculada_equipamento: false, equipamento_id: '', orgao_responsavel: '', quantidade: 1, data_implantacao: '', responsavel: '', observacoes: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (v: Viatura) => {
    setEditingViatura(v);
    setFormData({
      municipio: v.municipio, tipo_patrulha: v.tipo_patrulha,
      vinculada_equipamento: v.vinculada_equipamento, equipamento_id: v.equipamento_id || '',
      orgao_responsavel: v.orgao_responsavel, quantidade: v.quantidade,
      data_implantacao: v.data_implantacao ? format(new Date(v.data_implantacao), 'yyyy-MM-dd') : '',
      responsavel: v.responsavel || '', observacoes: v.observacoes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.municipio || !formData.orgao_responsavel) return;
    const data = {
      municipio: formData.municipio, tipo_patrulha: formData.tipo_patrulha,
      vinculada_equipamento: formData.vinculada_equipamento,
      equipamento_id: formData.vinculada_equipamento ? formData.equipamento_id : null,
      orgao_responsavel: formData.orgao_responsavel as OrgaoResponsavel,
      quantidade: formData.quantidade,
      data_implantacao: formData.data_implantacao || format(new Date(), 'yyyy-MM-dd'),
      responsavel: formData.responsavel, observacoes: formData.observacoes,
    };
    if (editingViatura) { updateViatura({ id: editingViatura.id, ...data }); }
    else { addViatura(data); }
    setIsDialogOpen(false);
  };

  const handleDelete = () => {
    if (deletingId) { deleteViatura(deletingId); setIsDeleteDialogOpen(false); setDeletingId(null); }
  };

  return (
    <AppLayout>
      <PageHeader title="Viaturas" description="Gerencie as viaturas da Patrulha Maria da Penha">
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><Download className="w-4 h-4 mr-2" />Exportar</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportViaturasToPDF(filteredViaturas)}>
                <FilePdf className="w-4 h-4 mr-2" />Exportar PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportViaturasToExcel(filteredViaturas)}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />Exportar Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={openCreateDialog}><Plus className="w-4 h-4 mr-2" />Nova Viatura</Button>
        </div>
      </PageHeader>

      {/* ── Cards de resumo ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        {/* Total */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl p-3 border border-border shadow-sm col-span-1"
        >
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
            <Truck className="w-3.5 h-3.5 text-primary" />
          </div>
          <p className="text-2xl font-bold">{totalViaturas}</p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">Total de Viaturas</p>
        </motion.div>

        {/* Vinculadas */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className={cn('bg-card rounded-xl p-3 border shadow-sm cursor-pointer transition-all hover:shadow-md',
            filterVinculada === 'sim' ? 'ring-2 ring-primary' : 'border-border')}
          onClick={() => setFilterVinculada(filterVinculada === 'sim' ? 'all' : 'sim')}
        >
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center mb-2">
            <Link2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold">{vinculadas}</p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">Vinculadas</p>
        </motion.div>

        {/* Não vinculadas */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className={cn('bg-card rounded-xl p-3 border shadow-sm cursor-pointer transition-all hover:shadow-md',
            filterVinculada === 'nao' ? 'ring-2 ring-primary' : 'border-border')}
          onClick={() => setFilterVinculada(filterVinculada === 'nao' ? 'all' : 'nao')}
        >
          <div className="w-7 h-7 rounded-lg bg-slate-500/15 flex items-center justify-center mb-2">
            <Link2Off className="w-3.5 h-3.5 text-slate-600" />
          </div>
          <p className="text-2xl font-bold">{naoVinculadas}</p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">Não Vinculadas</p>
        </motion.div>

        {/* Patrulhas das Casas */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-card rounded-xl p-3 border border-border shadow-sm"
        >
          <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-violet-600" />
          </div>
          <p className="text-2xl font-bold">{patrulhasDasCasas.length}</p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">Patrulhas das Casas</p>
        </motion.div>

        {/* Cadastros incompletos */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-card rounded-xl p-3 border border-border shadow-sm"
        >
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center mb-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <p className="text-2xl font-bold">{incompletas}</p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">Cadastro Incompleto</p>
        </motion.div>

        {/* Municípios atendidos */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-card rounded-xl p-3 border border-border shadow-sm"
        >
          <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center mb-2">
            <MapPin className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold">{new Set(viaturas.map(v => v.municipio)).size}</p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">Municípios</p>
        </motion.div>
      </div>

      {/* ── Filtros ── */}
      <div className="bg-card rounded-xl p-4 border border-border shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterRegiao} onValueChange={setFilterRegiao}>
            <SelectTrigger><SelectValue placeholder="Região" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as regiões</SelectItem>
              {regioesList.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterOrgao} onValueChange={setFilterOrgao}>
            <SelectTrigger><SelectValue placeholder="Órgão Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os órgãos</SelectItem>
              {orgaosResponsaveis.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterVinculada} onValueChange={setFilterVinculada}>
            <SelectTrigger><SelectValue placeholder="Vinculação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="sim">Vinculada a Equipamento</SelectItem>
              <SelectItem value="nao">Não Vinculada</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center text-sm text-muted-foreground">
            {filteredViaturas.length} registro(s) encontrado(s)
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="pmce" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pmce" className="gap-2">
            <Truck className="w-4 h-4" />Viaturas PMCE ({filteredViaturas.length})
          </TabsTrigger>
          <TabsTrigger value="casas" className="gap-2">
            <Building2 className="w-4 h-4" />Patrulhas das Casas ({patrulhasDasCasas.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Aba Viaturas PMCE ── */}
        <TabsContent value="pmce">
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Município / Região</th>
                    <th>Órgão</th>
                    <th>Qtd</th>
                    <th>Implantação</th>
                    <th>Vinculação</th>
                    <th>Responsável</th>
                    <th>Cadastro</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredViaturas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-muted-foreground">
                        <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="font-medium">Nenhuma viatura encontrada</p>
                        <p className="text-xs mt-1 opacity-70">Tente ajustar os filtros ou cadastre uma nova viatura</p>
                      </td>
                    </tr>
                  ) : (
                    filteredViaturas.map(v => (
                      <ViaturaRow
                        key={v.id}
                        viatura={v}
                        equipamentos={equipamentos}
                        onEdit={() => openEditDialog(v)}
                        onDelete={() => { setDeletingId(v.id); setIsDeleteDialogOpen(true); }}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ── Aba Patrulhas das Casas ── */}
        <TabsContent value="casas">
          <div className="flex justify-end mb-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" />Exportar Patrulhas</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportPatrulhasCasasToPDF(equipamentos, solicitacoes)}>
                  <FilePdf className="w-4 h-4 mr-2" />Exportar PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportPatrulhasCasasToExcel(equipamentos, solicitacoes)}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />Exportar Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Município / Região</th>
                    <th>Tipo de Equipamento</th>
                    <th>Origem</th>
                    <th>Endereço</th>
                    <th>Responsável</th>
                    <th>Telefone</th>
                  </tr>
                </thead>
                <tbody>
                  {patrulhasDasCasas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground">
                        <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="font-medium">Nenhum equipamento com Patrulha Maria da Penha</p>
                        <p className="text-xs mt-1 opacity-70">Marque "Possui Patrulha" em Equipamentos ou Solicitações</p>
                      </td>
                    </tr>
                  ) : (
                    patrulhasDasCasas.map(p => <PatrulhaRow key={p.id} patrulha={p} />)
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            * Patrulhas de Equipamentos são gerenciadas em Equipamentos. Patrulhas de Solicitações são gerenciadas em Solicitações.
          </p>
        </TabsContent>
      </Tabs>

      {/* ── Dialog Criar/Editar ── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingViatura ? 'Editar Viatura' : 'Nova Viatura'}</DialogTitle>
            <DialogDescription>Cadastre ou atualize uma viatura da Patrulha Maria da Penha.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Município *</Label>
                <Select value={formData.municipio} onValueChange={v => setFormData({ ...formData, municipio: v, equipamento_id: '' })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{municipiosCeara.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Órgão Responsável *</Label>
                <Select value={formData.orgao_responsavel} onValueChange={v => setFormData({ ...formData, orgao_responsavel: v as OrgaoResponsavel })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{orgaosResponsaveis.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantidade de Viaturas</Label>
                <Input type="number" min={1} value={formData.quantidade}
                  onChange={e => setFormData({ ...formData, quantidade: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="space-y-2">
                <Label>Data de Implantação</Label>
                <Input type="date" value={formData.data_implantacao}
                  onChange={e => setFormData({ ...formData, data_implantacao: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <Label htmlFor="vinculada">Vinculada a Equipamento?</Label>
              <Switch id="vinculada" checked={formData.vinculada_equipamento}
                onCheckedChange={v => setFormData({ ...formData, vinculada_equipamento: v, equipamento_id: '' })} />
            </div>
            {formData.vinculada_equipamento && (
              <div className="space-y-2">
                <Label>Equipamento</Label>
                <Select value={formData.equipamento_id || undefined} onValueChange={v => setFormData({ ...formData, equipamento_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o equipamento" /></SelectTrigger>
                  <SelectContent>
                    {equipamentosDoMunicipio.length === 0
                      ? <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum equipamento neste município</div>
                      : equipamentosDoMunicipio.map(e => <SelectItem key={e.id} value={e.id}>{e.tipo}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Input value={formData.responsavel} onChange={e => setFormData({ ...formData, responsavel: e.target.value })} placeholder="Nome do responsável" />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={formData.observacoes} onChange={e => setFormData({ ...formData, observacoes: e.target.value })} placeholder="Informações adicionais..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isAdding || isUpdating}>
              {editingViatura ? 'Salvar Alterações' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Deletar ── */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta viatura? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}