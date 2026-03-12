import { useState, useMemo } from 'react';
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  GraduationCap, Plus, Pencil, Trash2, Search, Download,
  FileSpreadsheet, FileText as FilePdf, ChevronDown, Users,
  MapPin, CalendarDays, Building2, X, ChevronRight,
} from 'lucide-react';
import { useQualificacoes, Qualificacao, QualificacaoPayload } from '@/hooks/useQualificacoes';
import { municipiosCeara } from '@/data/municipios';
import { exportQualificacoesToPDF, exportQualificacoesToExcel } from '@/lib/exportUtils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Tipos internos do form ────────────────────────────────────────────────────

interface MunicipioRow {
  municipio: string;
  quantidade_pessoas: number;
}

interface FormState {
  nome: string;
  ministrante: string;
  data: string;
  total_pessoas: string;
  observacoes: string;
  municipios: MunicipioRow[];
}

const FORM_EMPTY: FormState = {
  nome: '', ministrante: '', data: '', total_pessoas: '',
  observacoes: '', municipios: [],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  try { return format(parseISO(d), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }); }
  catch { return d; }
}

function fmtDateShort(d: string) {
  try { return format(parseISO(d), 'dd/MM/yyyy'); }
  catch { return d; }
}

function totalMunicipios(q: Qualificacao) {
  return q.municipios.reduce((s, m) => s + m.quantidade_pessoas, 0);
}

// ── Componente de linha de município no form ──────────────────────────────────

function MunicipioRowInput({
  row, index, onChange, onRemove, municipiosUsados,
}: {
  row: MunicipioRow;
  index: number;
  onChange: (i: number, field: keyof MunicipioRow, value: string | number) => void;
  onRemove: (i: number) => void;
  municipiosUsados: Set<string>;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const sugestoes = useMemo(() => {
    const q = search.toLowerCase();
    return municipiosCeara
      .filter(m => m.toLowerCase().includes(q) && (m === row.municipio || !municipiosUsados.has(m)))
      .slice(0, 8);
  }, [search, row.municipio, municipiosUsados]);

  return (
    <div className="flex items-center gap-2">
      {/* Município */}
      <div className="flex-1 relative">
        <Input
          placeholder="Digite para buscar..."
          value={row.municipio || search}
          onChange={e => {
            setSearch(e.target.value);
            if (row.municipio) onChange(index, 'municipio', '');
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="h-9 text-sm"
        />
        {open && sugestoes.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {sugestoes.map(m => (
              <button
                key={m}
                type="button"
                onMouseDown={() => {
                  onChange(index, 'municipio', m);
                  setSearch('');
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Quantidade */}
      <Input
        type="number"
        min={0}
        placeholder="Qtd."
        value={row.quantidade_pessoas || ''}
        onChange={e => onChange(index, 'quantidade_pessoas', parseInt(e.target.value) || 0)}
        className="w-24 h-9 text-sm"
      />
      {/* Remover */}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Dialog de form ────────────────────────────────────────────────────────────

function QualificacaoDialog({
  open, onClose, onSave, isSaving, initial,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (payload: QualificacaoPayload) => void;
  isSaving: boolean;
  initial?: Qualificacao | null;
}) {
  const [form, setForm] = useState<FormState>(() =>
    initial
      ? {
          nome: initial.nome,
          ministrante: initial.ministrante,
          data: initial.data,
          total_pessoas: String(initial.total_pessoas),
          observacoes: initial.observacoes ?? '',
          municipios: initial.municipios.map(m => ({
            municipio: m.municipio,
            quantidade_pessoas: m.quantidade_pessoas,
          })),
        }
      : FORM_EMPTY
  );

  // Reset quando o dialog abre com novo `initial`
  useState(() => {
    if (open) {
      setForm(
        initial
          ? {
              nome: initial.nome,
              ministrante: initial.ministrante,
              data: initial.data,
              total_pessoas: String(initial.total_pessoas),
              observacoes: initial.observacoes ?? '',
              municipios: initial.municipios.map(m => ({
                municipio: m.municipio,
                quantidade_pessoas: m.quantidade_pessoas,
              })),
            }
          : FORM_EMPTY
      );
    }
  });

  const municipiosUsados = useMemo(
    () => new Set(form.municipios.map(m => m.municipio).filter(Boolean)),
    [form.municipios]
  );

  const handleMunicipioChange = (i: number, field: keyof MunicipioRow, value: string | number) => {
    setForm(f => {
      const rows = [...f.municipios];
      rows[i] = { ...rows[i], [field]: value };
      return { ...f, municipios: rows };
    });
  };

  const handleSubmit = () => {
    if (!form.nome.trim())        return toast.error('Nome do curso é obrigatório');
    if (!form.ministrante.trim()) return toast.error('Ministrante é obrigatório');
    if (!form.data)               return toast.error('Data é obrigatória');
    const total = parseInt(form.total_pessoas) || 0;
    if (total <= 0)               return toast.error('Informe a quantidade de pessoas');

    const municipiosValidos = form.municipios.filter(m => m.municipio.trim());
    onSave({
      nome:          form.nome.trim(),
      ministrante:   form.ministrante.trim(),
      data:          form.data,
      total_pessoas: total,
      observacoes:   form.observacoes.trim() || null,
      municipios:    municipiosValidos,
    });
  };

  const totalMun = form.municipios.reduce((s, m) => s + (m.quantidade_pessoas || 0), 0);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            {initial ? 'Editar Qualificação' : 'Nova Qualificação'}
          </DialogTitle>
          <DialogDescription>
            Preencha as informações do curso de qualificação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label>Nome do Curso <span className="text-rose-500">*</span></Label>
            <Input
              placeholder='Ex: "Qualificação para rede de atendimento"'
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
            />
          </div>

          {/* Ministrante + Data em linha */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Ministrante / Órgão <span className="text-rose-500">*</span></Label>
              <Input
                placeholder="AESP, EGP, Palestra..."
                value={form.ministrante}
                onChange={e => setForm(f => ({ ...f, ministrante: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data <span className="text-rose-500">*</span></Label>
              <Input
                type="date"
                value={form.data}
                onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
              />
            </div>
          </div>

          {/* Total de pessoas */}
          <div className="space-y-1.5">
            <Label>Total de Pessoas Qualificadas <span className="text-rose-500">*</span></Label>
            <Input
              type="number"
              min={0}
              placeholder="0"
              value={form.total_pessoas}
              onChange={e => setForm(f => ({ ...f, total_pessoas: e.target.value }))}
              className="max-w-48"
            />
          </div>

          {/* Municípios contemplados */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Municípios Contemplados</Label>
              {totalMun > 0 && (
                <span className="text-xs text-muted-foreground">
                  {totalMun} pessoas em {form.municipios.filter(m => m.municipio).length} municípios
                </span>
              )}
            </div>

            {/* Header da tabela */}
            {form.municipios.length > 0 && (
              <div className="flex items-center gap-2 px-1">
                <span className="flex-1 text-xs font-medium text-muted-foreground">Município</span>
                <span className="w-24 text-xs font-medium text-muted-foreground">Qtd. Pessoas</span>
                <span className="w-8" />
              </div>
            )}

            <div className="space-y-2">
              {form.municipios.map((row, i) => (
                <MunicipioRowInput
                  key={i}
                  row={row}
                  index={i}
                  onChange={handleMunicipioChange}
                  onRemove={idx => setForm(f => ({
                    ...f,
                    municipios: f.municipios.filter((_, j) => j !== idx),
                  }))}
                  municipiosUsados={municipiosUsados}
                />
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setForm(f => ({
                ...f,
                municipios: [...f.municipios, { municipio: '', quantidade_pessoas: 0 }],
              }))}
              className="w-full border-dashed"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Município
            </Button>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              placeholder="Informações adicionais sobre o curso..."
              value={form.observacoes}
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'Salvando...' : initial ? 'Salvar Alterações' : 'Cadastrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Card de qualificação ──────────────────────────────────────────────────────

function QualificacaoCard({
  q, onEdit, onDelete,
}: {
  q: Qualificacao;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const totalPessoasMunicipios = totalMunicipios(q);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* Header clicável */}
      <div
        className="p-5 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start gap-4">
          {/* Ícone */}
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <GraduationCap className="w-5 h-5 text-primary" />
          </div>

          {/* Conteúdo principal */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base leading-snug">{q.nome}</h3>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Building2 className="w-3.5 h-3.5" />
                {q.ministrante}
              </span>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="w-3.5 h-3.5" />
                {fmtDateShort(q.data)}
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Users className="w-3.5 h-3.5 text-primary" />
                {q.total_pessoas.toLocaleString('pt-BR')} pessoas
              </span>
              {q.municipios.length > 0 && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5" />
                  {q.municipios.length} municípios
                </span>
              )}
            </div>
          </div>

          {/* Ações + expand */}
          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={onEdit}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-border mx-1" />
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <ChevronRight className={cn('w-4 h-4 transition-transform', expanded && 'rotate-90')} />
            </button>
          </div>
        </div>
      </div>

      {/* Expandido: municípios + observações */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-5 pb-5 pt-4 space-y-4">
              {/* Tabela de municípios */}
              {q.municipios.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Municípios Contemplados
                  </p>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border">
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Município</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Pessoas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {q.municipios
                          .sort((a, b) => b.quantidade_pessoas - a.quantidade_pessoas)
                          .map((m, i) => (
                            <tr key={m.id} className={cn('border-b border-border/50 last:border-0', i % 2 === 0 ? 'bg-card' : 'bg-muted/20')}>
                              <td className="px-4 py-2.5 flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                                {m.municipio}
                              </td>
                              <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                                {m.quantidade_pessoas.toLocaleString('pt-BR')}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/40 border-t border-border">
                          <td className="px-4 py-2.5 font-semibold text-sm">Total (municípios)</td>
                          <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                            {totalPessoasMunicipios.toLocaleString('pt-BR')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Nenhum município registrado.</p>
              )}

              {/* Observações */}
              {q.observacoes && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Observações</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{q.observacoes}</p>
                </div>
              )}

              {/* Data completa */}
              <p className="text-xs text-muted-foreground">{fmtDate(q.data)}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Qualificacoes() {
  const { qualificacoes, isLoading, addQualificacao, isAdding, editQualificacao, isUpdating, removeQualificacao } = useQualificacoes();

  const [search, setSearch]         = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]       = useState<Qualificacao | null>(null);
  const [deleting, setDeleting]     = useState<Qualificacao | null>(null);

  // Filtro de busca
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return qualificacoes;
    return qualificacoes.filter(qc =>
      qc.nome.toLowerCase().includes(q) ||
      qc.ministrante.toLowerCase().includes(q) ||
      qc.municipios.some(m => m.municipio.toLowerCase().includes(q))
    );
  }, [qualificacoes, search]);

  // Totais
  const totalPessoas   = qualificacoes.reduce((s, q) => s + q.total_pessoas, 0);
  const totalMunicipiosUnicos = useMemo(() => {
    const s = new Set<string>();
    qualificacoes.forEach(q => q.municipios.forEach(m => s.add(m.municipio)));
    return s.size;
  }, [qualificacoes]);

  const handleSave = (payload: QualificacaoPayload) => {
    if (editing) {
      editQualificacao(
        { id: editing.id, ...payload },
        { onSuccess: () => { setDialogOpen(false); setEditing(null); } }
      );
    } else {
      addQualificacao(payload, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const handleEdit = (q: Qualificacao) => {
    setEditing(q);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  return (
    <AppLayout>
      <PageHeader
        title="Qualificações"
        description="Registros de cursos e qualificações realizados"
      />

      {/* ── Cards de resumo ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total de Cursos',    value: qualificacoes.length,     color: 'text-primary'      },
          { label: 'Pessoas Qualificadas', value: totalPessoas.toLocaleString('pt-BR'), color: 'text-emerald-600' },
          { label: 'Municípios Alcançados', value: totalMunicipiosUnicos, color: 'text-blue-600'     },
          { label: 'Em 2025/2026',       value: qualificacoes.filter(q => q.data >= '2025-01-01').length, color: 'text-violet-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-2xl px-5 py-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn('text-2xl font-bold mt-1', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Barra de ações ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, ministrante ou município..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Export */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Exportar
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportQualificacoesToPDF(filtered)}>
              <FilePdf className="w-4 h-4 mr-2 text-rose-500" />
              PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportQualificacoesToExcel(filtered)}>
              <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />
              Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button onClick={handleNew} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Qualificação
        </Button>
      </div>

      {/* ── Lista ── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-muted/30 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <GraduationCap className="w-12 h-12 opacity-20 mb-3" />
          <p className="font-medium">{search ? 'Nenhum resultado encontrado' : 'Nenhuma qualificação cadastrada'}</p>
          {!search && (
            <p className="text-sm mt-1">Clique em "Nova Qualificação" para começar</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
            {search && ` para "${search}"`}
          </p>
          <AnimatePresence>
            {filtered.map(q => (
              <QualificacaoCard
                key={q.id}
                q={q}
                onEdit={() => handleEdit(q)}
                onDelete={() => setDeleting(q)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Dialog de form ── */}
      <QualificacaoDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSave={handleSave}
        isSaving={isAdding || isUpdating}
        initial={editing}
      />

      {/* ── Confirmação de exclusão ── */}
      <AlertDialog open={!!deleting} onOpenChange={v => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir qualificação?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>"{deleting?.nome}"</strong> e todos os seus municípios serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-500 hover:bg-rose-600"
              onClick={() => {
                if (deleting) removeQualificacao(deleting.id, { onSuccess: () => setDeleting(null) });
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}