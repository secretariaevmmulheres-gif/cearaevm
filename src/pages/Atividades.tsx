import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAtividades } from '@/hooks/useAtividades';
import { municipiosCeara, regioesList, getRegiao } from '@/data/municipios';import { Atividade, TipoAtividade, RecursoAtividade, StatusAtividade } from '@/types';
import { exportAtividadesToPDF, exportAtividadesToExcel } from '@/lib/exportUtils';
import { CoberturaMapa } from '@/components/atividades/CoberturaMapa';
import { CalendarioAtividades } from '@/components/atividades/CalendarioAtividades';
import {
  Plus, Pencil, Trash2, Search, ChevronDown, MapPin,
  CalendarDays, Users, Hash, StickyNote, Truck, Download,
  FileSpreadsheet, FileText as FilePdf, AlertCircle, Building2,
  Map, List, Copy, Loader2, X, UserCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { HistoricoPanel } from '@/components/HistoricoPanel';

const TIPOS_ATIVIDADE: TipoAtividade[] = ['Qualificação', 'Unidade Móvel', 'Palestra', 'Evento', 'Tenda Lilás', 'Visita a DDM', 'Visita a Delegacia', 'Outro'];
const RECURSOS: RecursoAtividade[] = ['Unidade Móvel', 'Equipe', 'Unidade Móvel + Equipe'];
const STATUS_ATIVIDADE: StatusAtividade[] = ['Agendado', 'Realizado', 'Cancelado'];
const MUNICIPIOS_SEDE = ['CMB', 'SEM', 'Juazeiro do Norte', 'Sobral', 'Tauá', 'Crateús', 'Iguatu', 'Quixadá'];

const statusStyles: Record<StatusAtividade, string> = {
  Agendado:  'bg-blue-500/10 text-blue-600',
  Realizado: 'bg-emerald-500/10 text-emerald-600',
  Cancelado: 'bg-rose-500/10 text-rose-600',
};

const tipoColors: Record<TipoAtividade, { bg: string; text: string }> = {
  'Unidade Móvel': { bg: 'bg-teal-500/15', text: 'text-teal-700' },
  'Palestra': { bg: 'bg-blue-500/15', text: 'text-blue-700' },
  'Evento': { bg: 'bg-violet-500/15', text: 'text-violet-700' },
  'Tenda Lilás': { bg: 'bg-pink-500/15', text: 'text-pink-700' },
  'Visita a DDM': { bg: 'bg-green-700/15', text: 'text-green-800' },
  'Visita a Delegacia': { bg: 'bg-green-400/15', text: 'text-green-700' },
  'Outro': { bg: 'bg-slate-500/15', text: 'text-slate-700' },
  Qualificação: {
    bg: 'bg-black/10',
    text: 'text-black/800'
  }
};

const sedeStyle: Record<string, { border: string; icon: string; text: string }> = {
  'Fortaleza':         { border: 'border-l-teal-500',   icon: 'bg-teal-100',   text: 'text-teal-700'   },
  'Juazeiro do Norte': { border: 'border-l-violet-500', icon: 'bg-violet-100', text: 'text-violet-700' },
  'Sobral':            { border: 'border-l-blue-500',   icon: 'bg-blue-100',   text: 'text-blue-700'   },
  'Tauá':              { border: 'border-l-emerald-500',icon: 'bg-emerald-100',text: 'text-emerald-700'},
  'Crateús':           { border: 'border-l-orange-500', icon: 'bg-orange-100', text: 'text-orange-700' },
  'Iguatu':            { border: 'border-l-cyan-500',   icon: 'bg-cyan-100',   text: 'text-cyan-700'   },
  'Quixadá':           { border: 'border-l-amber-500',  icon: 'bg-amber-100',  text: 'text-amber-700'  },
};
const sedeDefault = { border: 'border-l-slate-400', icon: 'bg-slate-100', text: 'text-slate-700' };

function getCompletude(a: Atividade) {
  const campos = [
    { label: 'NUP',           ok: !!a.nup?.trim() },
    { label: 'Nome do evento',ok: !!a.nome_evento?.trim() },
    { label: 'Horário',       ok: !!a.horario?.trim() },
    { label: 'Endereço/Tel',  ok: !!a.endereco?.trim() },
    { label: 'Atendimentos',  ok: a.atendimentos != null },
  ];
  const ok = campos.filter(c => c.ok).length;
  return { pct: Math.round((ok / campos.length) * 100), faltando: campos.filter(c => !c.ok).map(c => c.label) };
}

function CompletudeBar({ atividade }: { atividade: Atividade }) {
  const { pct, faltando } = getCompletude(atividade);
  const color = pct === 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-[10px] font-medium shrink-0',
        pct === 100 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-rose-600'
      )}>{pct}%</span>
      {pct < 100 && (
        <div className="group relative">
          <AlertCircle className="w-3.5 h-3.5 text-muted-foreground/60 cursor-help" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 bg-popover border border-border rounded-lg shadow-lg p-2 text-xs w-36">
            <p className="font-medium mb-1">Faltando:</p>
            {faltando.map(f => <p key={f} className="text-muted-foreground">• {f}</p>)}
          </div>
        </div>
      )}
    </div>
  );
}

function AtividadeRow({ atividade, onEdit, onDelete, onDuplicate }: {
  atividade: Atividade; onEdit: () => void; onDelete: () => void; onDuplicate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const regiao = getRegiao(atividade.municipio);
  const colors = tipoColors[atividade.tipo] ?? tipoColors['Outro'];
  return (
    <>
      <tr className={cn('cursor-pointer transition-colors', expanded ? 'bg-muted/40' : 'hover:bg-muted/20')}
          onClick={() => setExpanded(!expanded)}>
        <td>
          <div className="flex items-center gap-2">
            <ChevronDown className={cn('w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200', expanded && 'rotate-180')} />
            <div>
              <p className="font-medium text-sm">{atividade.municipio}</p>
              {regiao && <p className="text-[11px] text-muted-foreground">{regiao}</p>}
            </div>
          </div>
        </td>
        <td onClick={e => e.stopPropagation()}>
          <span className={cn('inline-flex text-xs font-medium px-2 py-0.5 rounded-full', colors.bg, colors.text)}>
            {atividade.tipo === 'Outro' && (atividade as any).tipo_personalizado
              ? `Outro: ${(atividade as any).tipo_personalizado}`
              : atividade.tipo}
          </span>
        </td>
        <td className="text-sm">
          {atividade.recurso}
          {atividade.quantidade_equipe && (
            <span className="ml-1 text-[10px] text-muted-foreground">({atividade.quantidade_equipe} pess.)</span>
          )}
        </td>
        <td className="text-sm text-muted-foreground">
          {format(new Date(atividade.data + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
          {atividade.dias && <span className="ml-1 text-[10px]">({atividade.dias}d)</span>}
        </td>
        <td onClick={e => e.stopPropagation()}>
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', statusStyles[atividade.status])}>
            {atividade.status}
          </span>
        </td>
        <td className="text-sm font-medium text-right">
          {atividade.atendimentos != null ? atividade.atendimentos.toLocaleString('pt-BR') : '—'}
        </td>
        <td onClick={e => e.stopPropagation()}><CompletudeBar atividade={atividade} /></td>
        <td onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit} title="Editar"><Pencil className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" onClick={onDuplicate} title="Duplicar" className="text-blue-500 hover:text-blue-600"><Copy className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={onDelete} title="Excluir">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </td>
      </tr>
      <AnimatePresence>
        {expanded && (
          <tr className="bg-muted/20">
            <td colSpan={8} className="p-0">
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="px-6 py-4 border-t border-border/50 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {[
                    { icon: <Hash className="w-3.5 h-3.5 text-primary" />,        label: 'NUP',            value: atividade.nup },
                    { icon: <CalendarDays className="w-3.5 h-3.5 text-primary" />, label: 'Horário',        value: atividade.horario },
                    { icon: <MapPin className="w-3.5 h-3.5 text-primary" />,       label: 'Endereço / Tel', value: atividade.endereco },
                    { icon: <Users className="w-3.5 h-3.5 text-primary" />,        label: 'Nome do Evento', value: atividade.nome_evento },
                    { icon: <StickyNote className="w-3.5 h-3.5 text-primary" />,   label: 'Observações',    value: atividade.observacoes },
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">{icon}</div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">{label}</p>
                        <p className="text-sm">{value || <span className="text-muted-foreground/60 italic">Não informado</span>}</p>
                      </div>
                    </div>
                  ))}
                  {/* Histórico de alterações */}
                  <HistoricoPanel
                    registroId={atividade.id}
                    tabela="atividades"
                    className="mt-2"
                  />
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}

function SedeBlock({ sede, atividades, onEdit, onDelete, onDuplicate }: {
  sede: string; atividades: Atividade[];
  onEdit: (a: Atividade) => void; onDelete: (id: string) => void; onDuplicate: (a: Atividade) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const s = sedeStyle[sede] ?? sedeDefault;
  const totalAtend = atividades.reduce((sum, a) => sum + (a.atendimentos ?? 0), 0);
  const realizadas = atividades.filter(a => a.status === 'Realizado').length;

  return (
    <div className={cn('bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-4 border-l-4', s.border)}>
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-3">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', s.icon)}>
            <Building2 className={cn('w-4 h-4', s.text)} />
          </div>
          <div className="text-left">
            <p className={cn('font-semibold text-sm', s.text)}>{sede}</p>
            <p className="text-xs text-muted-foreground">
              {atividades.length} atividade{atividades.length !== 1 ? 's' : ''}
              {totalAtend > 0 && ` · ${totalAtend.toLocaleString('pt-BR')} atendimento${totalAtend !== 1 ? 's' : ''}`}
              {realizadas > 0 && ` · ${realizadas} realizada${realizadas !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform duration-200', collapsed && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="overflow-x-auto border-t border-border/50">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Município / Região</th>
                    <th>Tipo</th>
                    <th>Recurso</th>
                    <th>Data</th>
                    <th>Status</th>
                    <th className="text-right">Atend.</th>
                    <th>Cadastro</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {atividades.map(a => (
                    <AtividadeRow key={a.id} atividade={a}
                      onEdit={() => onEdit(a)}
                      onDelete={() => onDelete(a.id)}
                      onDuplicate={() => onDuplicate(a)} />
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const FORM_INICIAL = {
  municipio: '', municipio_sede: '',
  tipo: '' as TipoAtividade | '', recurso: '' as RecursoAtividade | '',
  quantidade_equipe: '' as number | '', status: 'Agendado' as StatusAtividade,
  nup: '', nome_evento: '', data: '', dias: '' as number | '',
  horario: '', atendimentos: '' as number | '', endereco: '', observacoes: '',
  tipo_personalizado: '',
  municipios_participantes: [] as string[],
};

export default function Atividades() {
  const { atividades, addAtividade, updateAtividade, deleteAtividade, isAdding, isUpdating, isLoadingMore, hasMore, loadMore, total, visibleCount } = useAtividades();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab]       = useState<'registros' | 'calendario' | 'cobertura'>('registros');
  const [searchTerm, setSearchTerm]     = useState('');
  const [filterTipo, setFilterTipo]     = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSede, setFilterSede]     = useState('all');
  const [filterRegiao, setFilterRegiao] = useState('all');
  const [filterMes, setFilterMes]       = useState('all');
  const [filterAno, setFilterAno]       = useState(String(new Date().getFullYear())); // pré-selecionado no ano atual
  const [filterMunicipio, setFilterMunicipio] = useState('all');

  // Pré-seleciona município se vier da URL (?municipio=Fortaleza)
  useEffect(() => {
    const m = searchParams.get('municipio');
    if (m) {
      setFilterMunicipio(m);
      setFilterAno('all'); // mostra todas as atividades daquele município
    }
  }, [searchParams]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [formData, setFormData]         = useState({ ...FORM_INICIAL });
  const f = (k: keyof typeof formData, v: unknown) => setFormData(p => ({ ...p, [k]: v }));

  const filtered = atividades.filter(a => {
    const q = searchTerm.toLowerCase();
    return (
      (a.municipio.toLowerCase().includes(q) ||
       (a.nome_evento || '').toLowerCase().includes(q) ||
       (a.nup || '').toLowerCase().includes(q)) &&
      (filterMunicipio === 'all' || a.municipio === filterMunicipio) &&
      (filterTipo   === 'all' || a.tipo === filterTipo) &&
      (filterStatus === 'all' || a.status === filterStatus) &&
      (filterSede   === 'all' || a.municipio_sede === filterSede) &&
      (filterRegiao === 'all' || getRegiao(a.municipio) === filterRegiao) &&
      (filterAno === 'all' || new Date(a.data + 'T00:00:00').getFullYear() === parseInt(filterAno)) &&
      (filterMes === 'all' || new Date(a.data + 'T00:00:00').getMonth() + 1 === parseInt(filterMes))
    );
  }).sort((a, b) => new Date(b.data + 'T00:00:00').getTime() - new Date(a.data + 'T00:00:00').getTime());

  // Para renderização progressiva: mostra apenas as primeiras visibleCount atividades filtradas
  const filteredVisible = filtered.slice(0, visibleCount);

  const sedesOrdenadas = [
    ...MUNICIPIOS_SEDE.filter(s => filteredVisible.some(a => a.municipio_sede === s)),
    ...Array.from(new Set(filteredVisible.filter(a => !MUNICIPIOS_SEDE.includes(a.municipio_sede)).map(a => a.municipio_sede))),
  ];

  const totalAtendimentos = atividades.reduce((s, a) => s + (a.atendimentos ?? 0), 0);
  const cards = [
    ...TIPOS_ATIVIDADE.map(tipo => ({ label: tipo, count: atividades.filter(a => a.tipo === tipo).length, color: tipoColors[tipo], active: filterTipo === tipo, onClick: () => setFilterTipo(filterTipo === tipo ? 'all' : tipo) })),
    { label: 'Realizadas',   count: atividades.filter(a => a.status === 'Realizado').length, color: { bg: 'bg-emerald-500/15', text: 'text-emerald-700' }, active: filterStatus === 'Realizado', onClick: () => setFilterStatus(filterStatus === 'Realizado' ? 'all' : 'Realizado') },
    { label: 'Agendadas',    count: atividades.filter(a => a.status === 'Agendado').length,  color: { bg: 'bg-blue-500/15',    text: 'text-blue-700'    }, active: filterStatus === 'Agendado',  onClick: () => setFilterStatus(filterStatus === 'Agendado'  ? 'all' : 'Agendado')  },
    { label: 'Atendimentos', count: totalAtendimentos, color: { bg: 'bg-violet-500/15', text: 'text-violet-700' }, active: false, onClick: undefined },
    { label: 'Incompletos',  count: atividades.filter(a => getCompletude(a).pct < 100).length, color: { bg: 'bg-amber-500/15', text: 'text-amber-700' }, active: false, onClick: undefined },
  ];

  const openCreate = () => { setEditingId(null); setFormData({ ...FORM_INICIAL }); setIsDialogOpen(true); };
  const openEdit = (a: Atividade) => {
    setEditingId(a.id);
    setFormData({
      municipio: a.municipio, municipio_sede: a.municipio_sede, tipo: a.tipo, recurso: a.recurso,
      quantidade_equipe: a.quantidade_equipe ?? '', status: a.status, nup: a.nup ?? '',
      nome_evento: a.nome_evento ?? '', data: a.data, dias: a.dias ?? '', horario: a.horario ?? '',
      atendimentos: a.atendimentos ?? '', endereco: a.endereco ?? '', observacoes: a.observacoes ?? '',
      tipo_personalizado: (a as any).tipo_personalizado ?? '',
      municipios_participantes: a.municipios_participantes ?? [],
    });
    setIsDialogOpen(true);
  };

  // Duplicar
  const openDuplicate = (a: Atividade) => {
    setEditingId(null);
    setFormData({
      municipio: a.municipio, municipio_sede: a.municipio_sede, tipo: a.tipo, recurso: a.recurso,
      quantidade_equipe: a.quantidade_equipe ?? '', status: 'Agendado',
      nup: '', nome_evento: a.nome_evento ?? '',
      data: new Date().toISOString().split('T')[0],
      dias: a.dias ?? '', horario: a.horario ?? '',
      atendimentos: '', endereco: a.endereco ?? '', observacoes: a.observacoes ?? '',
      tipo_personalizado: '',
      municipios_participantes: a.municipios_participantes ?? [],
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.municipio || !formData.municipio_sede || !formData.tipo || !formData.recurso || !formData.data) return;
    const payload = {
      municipio: formData.municipio, municipio_sede: formData.municipio_sede,
      tipo: formData.tipo as TipoAtividade, recurso: formData.recurso as RecursoAtividade,
      quantidade_equipe: formData.quantidade_equipe === '' ? null : Number(formData.quantidade_equipe),
      status: formData.status, nup: formData.nup || null, nome_evento: formData.nome_evento || null,
      data: formData.data, dias: formData.dias === '' ? null : Number(formData.dias),
      horario: formData.horario || null,
      atendimentos: formData.atendimentos === '' ? null : Number(formData.atendimentos),
      endereco: formData.endereco || null,
      observacoes: formData.tipo === 'Outro' && formData.tipo_personalizado
        ? `[${formData.tipo_personalizado}] ${formData.observacoes || ''}`.trim()
        : formData.observacoes || null,
      municipios_participantes: formData.municipios_participantes ?? [],
    };
    if (editingId) { updateAtividade({ id: editingId, ...payload }); } else { addAtividade(payload); }
    setIsDialogOpen(false);
  };

  const handleDelete = () => {
    if (deletingId) { deleteAtividade(deletingId); setIsDeleteOpen(false); setDeletingId(null); }
  };

  return (
    <AppLayout>
      <PageHeader title="Atividades" description="Unidades móveis, palestras, eventos e Tenda Lilás">
        <div className="flex gap-2">
          {activeTab === 'registros' && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline"><Download className="w-4 h-4 mr-2" />Exportar</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { exportAtividadesToPDF(filtered, filterSede !== 'all' ? `Sede: ${filterSede}` : undefined).catch(console.error); }}>
                    <FilePdf className="w-4 h-4 mr-2" />Exportar PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportAtividadesToExcel(filtered)}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />Exportar Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nova Atividade</Button>
            </>
          )}
        </div>
      </PageHeader>

      {/* ── Abas ── */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-xl mb-6 w-fit">
        <button
          onClick={() => setActiveTab('registros')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
            activeTab === 'registros'
              ? 'bg-card shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <List className="w-4 h-4" />
          Registros
        </button>
        <button
          onClick={() => setActiveTab('calendario')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
            activeTab === 'calendario'
              ? 'bg-card shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <CalendarDays className="w-4 h-4" />
          Calendário
        </button>
        <button
          onClick={() => setActiveTab('cobertura')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
            activeTab === 'cobertura'
              ? 'bg-card shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Map className="w-4 h-4" />
          Consulta de Cobertura
        </button>
      </div>

      {activeTab === 'registros' && <>
      {/* Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3 mb-6">
        {cards.map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }} onClick={card.onClick}
            className={cn('bg-card rounded-xl p-3 border shadow-sm transition-all hover:shadow-md',
              card.onClick ? 'cursor-pointer' : '', card.active ? 'ring-2 ring-primary' : 'border-border')}>
            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center mb-2', card.color.bg)}>
              <Truck className={cn('w-3.5 h-3.5', card.color.text)} />
            </div>
            <p className="text-2xl font-bold">{card.count.toLocaleString('pt-BR')}</p>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{card.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-card rounded-xl p-4 border border-border shadow-sm mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          {/* Filtro de município — destacado quando ativo via URL */}
          <Select value={filterMunicipio} onValueChange={setFilterMunicipio}>
            <SelectTrigger className={cn(filterMunicipio !== 'all' && 'border-primary ring-1 ring-primary/30')}>
              <SelectValue placeholder="Município" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os municípios</SelectItem>
              {municipiosCeara.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterRegiao} onValueChange={setFilterRegiao}>
            <SelectTrigger><SelectValue placeholder="Região" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as regiões</SelectItem>
              {regioesList.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSede} onValueChange={setFilterSede}>
            <SelectTrigger><SelectValue placeholder="Sede (CMB/CMC)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as sedes</SelectItem>
              {MUNICIPIOS_SEDE.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {TIPOS_ATIVIDADE.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUS_ATIVIDADE.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterMes} onValueChange={setFilterMes}>
            <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              <SelectItem value="1">Janeiro</SelectItem>
              <SelectItem value="2">Fevereiro</SelectItem>
              <SelectItem value="3">Março</SelectItem>
              <SelectItem value="4">Abril</SelectItem>
              <SelectItem value="5">Maio</SelectItem>
              <SelectItem value="6">Junho</SelectItem>
              <SelectItem value="7">Julho</SelectItem>
              <SelectItem value="8">Agosto</SelectItem>
              <SelectItem value="9">Setembro</SelectItem>
              <SelectItem value="10">Outubro</SelectItem>
              <SelectItem value="11">Novembro</SelectItem>
              <SelectItem value="12">Dezembro</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterAno} onValueChange={setFilterAno}>
            <SelectTrigger>
              <SelectValue placeholder="Ano">
                {filterAno === 'all' ? 'Todos os anos' : filterAno}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os anos</SelectItem>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2027">2027</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center text-sm text-muted-foreground">
            {filtered.length} registro(s)
            {total !== null && atividades.length < total && (
              <span className="ml-1 text-xs">de {total} carregados</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabela agrupada por sede */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border shadow-sm p-12 text-center text-muted-foreground">
          <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="font-medium">Nenhuma atividade encontrada</p>
          <p className="text-xs mt-1 opacity-70">Tente ajustar os filtros ou cadastre uma nova atividade</p>
        </div>
      ) : sedesOrdenadas.map((sede, i) => {
        const grupo = filteredVisible.filter(a => a.municipio_sede === sede);
        if (!grupo.length) return null;
        return (
          <motion.div key={sede} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <SedeBlock sede={sede} atividades={grupo} onEdit={openEdit}
              onDelete={id => { setDeletingId(id); setIsDeleteOpen(true); }}
              onDuplicate={openDuplicate} />
          </motion.div>
        );
      })}

      {/* Botão "Carregar mais" */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={loadMore} disabled={isLoadingMore} className="gap-2">
            {isLoadingMore
              ? <><Loader2 className="w-4 h-4 animate-spin" />Carregando...</>
              : <>Carregar mais atividades {total !== null ? `(${atividades.length} de ${total})` : ''}</>
            }
          </Button>
        </div>
      )}

      {/* Dialog Criar/Editar */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Atividade' : 'Nova Atividade'}</DialogTitle>
            <DialogDescription>Registre uma atividade de unidade móvel, palestra, evento ou Tenda Lilás.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Localização</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Município Atendido *</Label>
                  <Select value={formData.municipio} onValueChange={v => f('municipio', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{municipiosCeara.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sede (CMB/CMC de Origem) *</Label>
                  <Select value={formData.municipio_sede} onValueChange={v => f('municipio_sede', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{MUNICIPIOS_SEDE.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Tipo e Recurso</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Atividade *</Label>
                  <Select value={formData.tipo} onValueChange={v => f('tipo', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{TIPOS_ATIVIDADE.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {formData.tipo === 'Outro' && (
                  <div className="space-y-2">
                    <Label>Descreva o tipo de atividade</Label>
                    <Input
                      placeholder="Ex: Visita a DDM, Capacitação interna..."
                      value={formData.tipo_personalizado}
                      onChange={e => f('tipo_personalizado', e.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Recurso Utilizado *</Label>
                  <Select value={formData.recurso} onValueChange={v => f('recurso', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{RECURSOS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label>Quantidade de Equipe</Label>
                  <Input type="number" min={1} value={formData.quantidade_equipe}
                    onChange={e => f('quantidade_equipe', e.target.value === '' ? '' : parseInt(e.target.value))} placeholder="Ex: 5" />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={v => f('status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS_ATIVIDADE.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Data e Tempo</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input type="date" value={formData.data} onChange={e => f('data', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Duração (dias)</Label>
                  <Input type="number" min={1} value={formData.dias}
                    onChange={e => f('dias', e.target.value === '' ? '' : parseInt(e.target.value))} placeholder="Ex: 3" />
                </div>
                <div className="space-y-2">
                  <Label>Horário</Label>
                  <Input value={formData.horario} onChange={e => f('horario', e.target.value)} placeholder="Ex: 08h às 17h" />
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Identificação</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>NUP (Nº do Processo)</Label>
                  <Input value={formData.nup}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '');
                      let fmt = '';
                      for (let i = 0; i < v.length && i < 17; i++) {
                        if (i === 5) fmt += '.'; if (i === 11) fmt += '/'; if (i === 15) fmt += '-';
                        fmt += v[i];
                      }
                      f('nup', fmt);
                    }} placeholder="62000.001753/2025-56" />
                </div>
                <div className="space-y-2">
                  <Label>Nome do Evento</Label>
                  <Input value={formData.nome_evento} onChange={e => f('nome_evento', e.target.value)} placeholder="Ex: Semana da Mulher" />
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Resultado e Localização</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nº de Atendimentos</Label>
                  <Input type="number" min={0} value={formData.atendimentos}
                    onChange={e => f('atendimentos', e.target.value === '' ? '' : parseInt(e.target.value))} placeholder="Ex: 120" />
                </div>
                <div className="space-y-2">
                  <Label>Endereço / Telefone</Label>
                  <Input value={formData.endereco} onChange={e => f('endereco', e.target.value)} placeholder="Endereço ou contato" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={formData.observacoes} onChange={e => f('observacoes', e.target.value)} placeholder="Informações adicionais..." rows={3} />
            </div>

            {/* Municípios participantes — só para Qualificação */}
            {formData.tipo === 'Qualificação' && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-primary" />
                  Municípios Participantes
                  <span className="text-muted-foreground font-normal text-xs">(para gerar o texto do PPA)</span>
                </Label>
                {/* Lista dos selecionados */}
                {formData.municipios_participantes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-muted/30 rounded-lg border border-border">
                    {formData.municipios_participantes.map(m => (
                      <span key={m} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        {m}
                        <button
                          type="button"
                          onClick={() => f('municipios_participantes', formData.municipios_participantes.filter(x => x !== m))}
                          className="hover:text-destructive transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {/* Seletor de município */}
                <Select
                  value=""
                  onValueChange={v => {
                    if (v && !formData.municipios_participantes.includes(v)) {
                      f('municipios_participantes', [...formData.municipios_participantes, v]);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Adicionar município..." />
                  </SelectTrigger>
                  <SelectContent>
                    {municipiosCeara
                      .filter(m => !formData.municipios_participantes.includes(m))
                      .map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formData.municipios_participantes.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    {formData.municipios_participantes.length} município(s) — o texto narrativo do PPA será gerado automaticamente.
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}
              disabled={isAdding || isUpdating || !formData.municipio || !formData.municipio_sede || !formData.tipo || !formData.recurso || !formData.data}>
              {editingId ? 'Salvar Alterações' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      </>
      }

      {/* ── Aba Consulta de Cobertura ── */}
      {activeTab === 'cobertura' && <CoberturaMapa />}

      {/* ── Aba Calendário ── */}
      {activeTab === 'calendario' && (
        <CalendarioAtividades atividades={atividades} />
      )}

      {/* Dialog Deletar */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta atividade? Esta ação não pode ser desfeita.</AlertDialogDescription>
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