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
import { useDataStore } from '@/store/dataStore';
import {
  municipiosCeara,
  tiposEquipamento,
  statusSolicitacao,
  TipoEquipamento,
  StatusSolicitacao,
} from '@/data/municipios';
import { Solicitacao } from '@/types';
import { Plus, Pencil, Trash2, Search, FileText, ArrowRight, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const statusStyles: Record<StatusSolicitacao, string> = {
  Recebida: 'badge-recebida',
  'Em análise': 'badge-analise',
  Aprovada: 'badge-aprovada',
  'Em implantação': 'badge-implantacao',
  Inaugurada: 'badge-inaugurada',
  Cancelada: 'badge-cancelada',
};

export default function Solicitacoes() {
  const { solicitacoes, addSolicitacao, updateSolicitacao, deleteSolicitacao, transformarEmEquipamento } =
    useDataStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTipo, setFilterTipo] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTransformDialogOpen, setIsTransformDialogOpen] = useState(false);
  const [editingSolicitacao, setEditingSolicitacao] = useState<Solicitacao | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [transformingId, setTransformingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    municipio: '',
    dataSolicitacao: '',
    tipoEquipamento: '' as TipoEquipamento | '',
    status: 'Recebida' as StatusSolicitacao,
    recebeuPatrulha: false,
    guardaMunicipalEstruturada: false,
    kitAthenaEntregue: false,
    capacitacaoRealizada: false,
    suiteImplantada: false,
    observacoes: '',
    anexos: [] as string[],
  });

  const filteredSolicitacoes = solicitacoes.filter((s) => {
    const matchesSearch =
      s.municipio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.observacoes.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
    const matchesTipo = filterTipo === 'all' || s.tipoEquipamento === filterTipo;
    return matchesSearch && matchesStatus && matchesTipo;
  });

  const openCreateDialog = () => {
    setEditingSolicitacao(null);
    setFormData({
      municipio: '',
      dataSolicitacao: format(new Date(), 'yyyy-MM-dd'),
      tipoEquipamento: '',
      status: 'Recebida',
      recebeuPatrulha: false,
      guardaMunicipalEstruturada: false,
      kitAthenaEntregue: false,
      capacitacaoRealizada: false,
      suiteImplantada: false,
      observacoes: '',
      anexos: [],
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (solicitacao: Solicitacao) => {
    setEditingSolicitacao(solicitacao);
    setFormData({
      municipio: solicitacao.municipio,
      dataSolicitacao: format(new Date(solicitacao.dataSolicitacao), 'yyyy-MM-dd'),
      tipoEquipamento: solicitacao.tipoEquipamento,
      status: solicitacao.status,
      recebeuPatrulha: solicitacao.recebeuPatrulha,
      guardaMunicipalEstruturada: solicitacao.guardaMunicipalEstruturada,
      kitAthenaEntregue: solicitacao.kitAthenaEntregue,
      capacitacaoRealizada: solicitacao.capacitacaoRealizada,
      suiteImplantada: solicitacao.suiteImplantada,
      observacoes: solicitacao.observacoes,
      anexos: solicitacao.anexos,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.municipio || !formData.tipoEquipamento) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const data = {
      ...formData,
      dataSolicitacao: new Date(formData.dataSolicitacao),
      tipoEquipamento: formData.tipoEquipamento as TipoEquipamento,
    };

    if (editingSolicitacao) {
      updateSolicitacao(editingSolicitacao.id, data);
      toast.success('Solicitação atualizada com sucesso');
    } else {
      addSolicitacao(data);
      toast.success('Solicitação cadastrada com sucesso');
    }
    setIsDialogOpen(false);
  };

  const handleDelete = () => {
    if (deletingId) {
      deleteSolicitacao(deletingId);
      toast.success('Solicitação excluída com sucesso');
      setIsDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  const handleTransform = () => {
    if (transformingId) {
      transformarEmEquipamento(transformingId);
      toast.success('Equipamento criado com sucesso a partir da solicitação');
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
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Solicitação
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="bg-card rounded-xl p-4 border border-border shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
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
                    <td className="text-sm">{solicitacao.tipoEquipamento}</td>
                    <td>
                      {format(new Date(solicitacao.dataSolicitacao), 'dd/MM/yyyy', { locale: ptBR })}
                    </td>
                    <td>
                      <span className={cn('badge-status', statusStyles[solicitacao.status])}>
                        {solicitacao.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        {solicitacao.recebeuPatrulha && (
                          <span className="w-2 h-2 rounded-full bg-success" title="Patrulha" />
                        )}
                        {solicitacao.guardaMunicipalEstruturada && (
                          <span className="w-2 h-2 rounded-full bg-info" title="Guarda" />
                        )}
                        {solicitacao.kitAthenaEntregue && (
                          <span className="w-2 h-2 rounded-full bg-warning" title="Kit Athena" />
                        )}
                        {solicitacao.capacitacaoRealizada && (
                          <span className="w-2 h-2 rounded-full bg-accent" title="Capacitação" />
                        )}
                        {solicitacao.suiteImplantada && (
                          <span className="w-2 h-2 rounded-full bg-primary" title="Suíte" />
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
                  value={formData.dataSolicitacao}
                  onChange={(e) => setFormData({ ...formData, dataSolicitacao: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Equipamento *</Label>
                <Select
                  value={formData.tipoEquipamento}
                  onValueChange={(value) =>
                    setFormData({ ...formData, tipoEquipamento: value as TipoEquipamento })
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
                    checked={formData.recebeuPatrulha}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, recebeuPatrulha: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="guarda" className="text-sm font-normal">
                    Guarda Municipal estruturada
                  </Label>
                  <Switch
                    id="guarda"
                    checked={formData.guardaMunicipalEstruturada}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, guardaMunicipalEstruturada: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="kit" className="text-sm font-normal">
                    Kit Athena entregue
                  </Label>
                  <Switch
                    id="kit"
                    checked={formData.kitAthenaEntregue}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, kitAthenaEntregue: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="capacitacao" className="text-sm font-normal">
                    Capacitação realizada
                  </Label>
                  <Switch
                    id="capacitacao"
                    checked={formData.capacitacaoRealizada}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, capacitacaoRealizada: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="suite" className="text-sm font-normal">
                    Suíte implantada
                  </Label>
                  <Switch
                    id="suite"
                    checked={formData.suiteImplantada}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, suiteImplantada: checked })
                    }
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
            <Button onClick={handleSubmit}>
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
