import { useState } from 'react';
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
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import {
  municipiosCeara,
  tiposEquipamento,
  statusSolicitacao,
  TipoEquipamento,
  StatusSolicitacao,
  regioesList,
  getRegiao,
} from '@/data/municipios';
import { Solicitacao } from '@/types';
import { Plus, Pencil, Trash2, Search, FileText, ArrowRight, Building2, Download, FileSpreadsheet, FileText as FilePdf } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { exportSolicitacoesToPDF, exportSolicitacoesToExcel } from '@/lib/exportUtils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const statusStyles: Record<StatusSolicitacao, string> = {
  Recebida: 'badge-recebida',
  'Em análise': 'badge-analise',
  Aprovada: 'badge-aprovada',
  'Em implantação': 'badge-implantacao',
  Inaugurada: 'badge-inaugurada',
  Cancelada: 'badge-cancelada',
};

export default function Solicitacoes() {
  const { solicitacoes, addSolicitacao, updateSolicitacao, deleteSolicitacao, transformarEmEquipamento, isAdding, isUpdating } =
    useSolicitacoes();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTipo, setFilterTipo] = useState<string>('all');
  const [filterRegiao, setFilterRegiao] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTransformDialogOpen, setIsTransformDialogOpen] = useState(false);
  const [editingSolicitacao, setEditingSolicitacao] = useState<Solicitacao | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [transformingId, setTransformingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    municipio: '',
    data_solicitacao: '',
    tipo_equipamento: '' as TipoEquipamento | '',
    status: 'Recebida' as StatusSolicitacao,
    recebeu_patrulha: false,
    guarda_municipal_estruturada: false,
    kit_athena_entregue: false,
    capacitacao_realizada: false,
    suite_implantada: '',
    observacoes: '',
    anexos: [] as string[],
  });

  // Aplicar filtros e depois ordenar por município
  const filteredSolicitacoes = solicitacoes
    .filter((s) => {
      const matchesSearch =
        s.municipio.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.observacoes || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
      const matchesTipo = filterTipo === 'all' || s.tipo_equipamento === filterTipo;
      const matchesRegiao = filterRegiao === 'all' || getRegiao(s.municipio) === filterRegiao;
      return matchesSearch && matchesStatus && matchesTipo && matchesRegiao;
    })
    .sort((a, b) => a.municipio.localeCompare(b.municipio)); // <-- ORDENAÇÃO ADICIONADA

  const openCreateDialog = () => {
    setEditingSolicitacao(null);
    setFormData({
      municipio: '',
      data_solicitacao: format(new Date(), 'yyyy-MM-dd'),
      tipo_equipamento: '',
      status: 'Recebida',
      recebeu_patrulha: false,
      guarda_municipal_estruturada: false,
      kit_athena_entregue: false,
      capacitacao_realizada: false,
      suite_implantada: '',
      observacoes: '',
      anexos: [],
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (solicitacao: Solicitacao) => {
    setEditingSolicitacao(solicitacao);
    setFormData({
      municipio: solicitacao.municipio,
      data_solicitacao: format(new Date(solicitacao.data_solicitacao), 'yyyy-MM-dd'),
      tipo_equipamento: solicitacao.tipo_equipamento,
      status: solicitacao.status,
      recebeu_patrulha: solicitacao.recebeu_patrulha,
      guarda_municipal_estruturada: solicitacao.guarda_municipal_estruturada,
      kit_athena_entregue: solicitacao.kit_athena_entregue,
      capacitacao_realizada: solicitacao.capacitacao_realizada,
      suite_implantada: solicitacao.suite_implantada || '',
      observacoes: solicitacao.observacoes || '',
      anexos: solicitacao.anexos || [],
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.municipio || !formData.tipo_equipamento) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const data = {
      municipio: formData.municipio,
      data_solicitacao: formData.data_solicitacao,
      tipo_equipamento: formData.tipo_equipamento as TipoEquipamento,
      status: formData.status,
      recebeu_patrulha: formData.recebeu_patrulha,
      guarda_municipal_estruturada: formData.guarda_municipal_estruturada,
      kit_athena_entregue: formData.kit_athena_entregue,
      capacitacao_realizada: formData.capacitacao_realizada,
      suite_implantada: formData.suite_implantada,
      observacoes: formData.observacoes,
      anexos: formData.anexos,
    };

    if (editingSolicitacao) {
      updateSolicitacao({ id: editingSolicitacao.id, ...data });
    } else {
      addSolicitacao(data);
    }
    setIsDialogOpen(false);
  };

  const handleDelete = () => {
    if (deletingId) {
      deleteSolicitacao(deletingId);
      setIsDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  const handleTransform = () => {
    if (transformingId) {
      transformarEmEquipamento(transformingId);
      setIsTransformDialogOpen(false);
      setTransformingId(null);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Solicitações"
        description="Acompanhe os pedidos de implantação de equipamentos"
      >
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportSolicitacoesToPDF(filteredSolicitacoes, filterRegiao)}>
                <FilePdf className="w-4 h-4 mr-2" />
                Exportar PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportSolicitacoesToExcel(filteredSolicitacoes)}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Exportar Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Solicitação
          </Button>
        </div>
      </PageHeader>

      {/* Filters */}
      <div className="bg-card rounded-xl p-4 border border-border shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterRegiao} onValueChange={setFilterRegiao}>
            <SelectTrigger>
              <SelectValue placeholder="Região" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as regiões</SelectItem>
              {regioesList.map((regiao) => (
                <SelectItem key={regiao} value={regiao}>
                  {regiao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {statusSolicitacao.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {tiposEquipamento.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>
                  {tipo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center text-sm text-muted-foreground">
            {filteredSolicitacoes.length} registro(s) encontrado(s)
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Município</th>
                <th>Tipo</th>
                <th>Data</th>
                <th>Status</th>
                <th>Acompanhamento</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredSolicitacoes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma solicitação encontrada</p>
                  </td>
                </tr>
              ) : (
                filteredSolicitacoes.map((solicitacao) => (
                  <tr key={solicitacao.id} className="animate-fade-in">
                    <td className="font-medium">{solicitacao.municipio}</td>
                    <td className="text-sm">{solicitacao.tipo_equipamento}</td>
                    <td>
                      {format(new Date(solicitacao.data_solicitacao), 'dd/MM/yyyy', { locale: ptBR })}
                    </td>
                    <td>
                      <span className={cn('badge-status', statusStyles[solicitacao.status])}>
                        {solicitacao.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        {solicitacao.recebeu_patrulha && (
                          <span className="w-2 h-2 rounded-full bg-success" title="Patrulha" />
                        )}
                        {solicitacao.guarda_municipal_estruturada && (
                          <span className="w-2 h-2 rounded-full bg-info" title="Guarda" />
                        )}
                        {solicitacao.kit_athena_entregue && (
                          <span className="w-2 h-2 rounded-full bg-warning" title="Kit Athena" />
                        )}
                        {solicitacao.capacitacao_realizada && (
                          <span className="w-2 h-2 rounded-full bg-accent" title="Capacitação" />
                        )}
                        {(solicitacao.suite_implantada || '').length > 0 && (
                          <span className="w-2 h-2 rounded-full bg-primary" title={`NUP: ${solicitacao.suite_implantada}`} />
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        {solicitacao.status === 'Inaugurada' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-success border-success/30 hover:bg-success/10"
                            onClick={() => {
                              setTransformingId(solicitacao.id);
                              setIsTransformDialogOpen(true);
                            }}
                          >
                            <Building2 className="w-4 h-4 mr-1" />
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(solicitacao)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeletingId(solicitacao.id);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSolicitacao ? 'Editar Solicitação' : 'Nova Solicitação'}
            </DialogTitle>
            <DialogDescription>
              Registre ou atualize uma solicitação de implantação de equipamento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Município *</Label>
                <Select
                  value={formData.municipio}
                  onValueChange={(value) => setFormData({ ...formData, municipio: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {municipiosCeara.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data da Solicitação</Label>
                <Input
                  type="date"
                  value={formData.data_solicitacao}
                  onChange={(e) => setFormData({ ...formData, data_solicitacao: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Equipamento *</Label>
                <Select
                  value={formData.tipo_equipamento}
                  onValueChange={(value) =>
                    setFormData({ ...formData, tipo_equipamento: value as TipoEquipamento })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposEquipamento.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value as StatusSolicitacao })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusSolicitacao.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <Label className="text-sm font-semibold">Acompanhamento</Label>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="patrulha" className="text-sm font-normal">
                    Recebeu Patrulha Maria da Penha
                  </Label>
                  <Switch
                    id="patrulha"
                    checked={formData.recebeu_patrulha}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, recebeu_patrulha: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="guarda" className="text-sm font-normal">
                    Guarda Municipal estruturada
                  </Label>
                  <Switch
                    id="guarda"
                    checked={formData.guarda_municipal_estruturada}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, guarda_municipal_estruturada: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="kit" className="text-sm font-normal">
                    Kit Athena entregue
                  </Label>
                  <Switch
                    id="kit"
                    checked={formData.kit_athena_entregue}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, kit_athena_entregue: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="capacitacao" className="text-sm font-normal">
                    Capacitação realizada
                  </Label>
                  <Switch
                    id="capacitacao"
                    checked={formData.capacitacao_realizada}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, capacitacao_realizada: checked })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="suite">Número do Processo (NUP)</Label>
                  <Input
                    id="suite"
                    value={formData.suite_implantada}
                    onChange={(e) => {
                      // Format NUP: 62000.001753/2025-56
                      const value = e.target.value.replace(/\D/g, '');
                      let formatted = '';
                      for (let i = 0; i < value.length && i < 17; i++) {
                        if (i === 5) formatted += '.';
                        if (i === 11) formatted += '/';
                        if (i === 15) formatted += '-';
                        formatted += value[i];
                      }
                      setFormData({ ...formData, suite_implantada: formatted });
                    }}
                    placeholder="62000.001753/2025-56"
                  />
                </div>
              </div>
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
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isAdding || isUpdating}>
              {editingSolicitacao ? 'Salvar Alterações' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta solicitação? Esta ação não pode ser desfeita.
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

      {/* Transform Confirmation */}
      <AlertDialog open={isTransformDialogOpen} onOpenChange={setIsTransformDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transformar em Equipamento</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação criará um novo equipamento com base nos dados desta solicitação. A
              solicitação permanecerá como registro histórico. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleTransform} className="bg-success hover:bg-success/90">
              Criar Equipamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}