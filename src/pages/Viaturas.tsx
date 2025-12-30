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
import { municipiosCeara, orgaosResponsaveis, OrgaoResponsavel } from '@/data/municipios';
import { Viatura } from '@/types';
import { Plus, Pencil, Trash2, Search, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Viaturas() {
  const { viaturas, equipamentos, addViatura, updateViatura, deleteViatura } = useDataStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrgao, setFilterOrgao] = useState<string>('all');
  const [filterVinculada, setFilterVinculada] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingViatura, setEditingViatura] = useState<Viatura | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    municipio: '',
    tipoPatrulha: 'Patrulha Maria da Penha' as const,
    vinculadaEquipamento: false,
    equipamentoId: '',
    orgaoResponsavel: '' as OrgaoResponsavel | '',
    quantidade: 1,
    dataImplantacao: '',
    responsavel: '',
    observacoes: '',
  });

  const equipamentosDoMunicipio = equipamentos.filter(
    (e) => e.municipio === formData.municipio
  );

  const filteredViaturas = viaturas.filter((v) => {
    const matchesSearch =
      v.municipio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.responsavel.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOrgao = filterOrgao === 'all' || v.orgaoResponsavel === filterOrgao;
    const matchesVinculada =
      filterVinculada === 'all' ||
      (filterVinculada === 'sim' && v.vinculadaEquipamento) ||
      (filterVinculada === 'nao' && !v.vinculadaEquipamento);
    return matchesSearch && matchesOrgao && matchesVinculada;
  });

  const openCreateDialog = () => {
    setEditingViatura(null);
    setFormData({
      municipio: '',
      tipoPatrulha: 'Patrulha Maria da Penha',
      vinculadaEquipamento: false,
      equipamentoId: '',
      orgaoResponsavel: '',
      quantidade: 1,
      dataImplantacao: '',
      responsavel: '',
      observacoes: '',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (viatura: Viatura) => {
    setEditingViatura(viatura);
    setFormData({
      municipio: viatura.municipio,
      tipoPatrulha: viatura.tipoPatrulha,
      vinculadaEquipamento: viatura.vinculadaEquipamento,
      equipamentoId: viatura.equipamentoId || '',
      orgaoResponsavel: viatura.orgaoResponsavel,
      quantidade: viatura.quantidade,
      dataImplantacao: viatura.dataImplantacao
        ? format(new Date(viatura.dataImplantacao), 'yyyy-MM-dd')
        : '',
      responsavel: viatura.responsavel,
      observacoes: viatura.observacoes,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.municipio || !formData.orgaoResponsavel) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const data = {
      municipio: formData.municipio,
      tipoPatrulha: formData.tipoPatrulha,
      vinculadaEquipamento: formData.vinculadaEquipamento,
      equipamentoId: formData.vinculadaEquipamento ? formData.equipamentoId : undefined,
      orgaoResponsavel: formData.orgaoResponsavel as OrgaoResponsavel,
      quantidade: formData.quantidade,
      dataImplantacao: formData.dataImplantacao ? new Date(formData.dataImplantacao) : new Date(),
      responsavel: formData.responsavel,
      observacoes: formData.observacoes,
    };

    if (editingViatura) {
      updateViatura(editingViatura.id, data);
      toast.success('Viatura atualizada com sucesso');
    } else {
      addViatura(data);
      toast.success('Viatura cadastrada com sucesso');
    }
    setIsDialogOpen(false);
  };

  const handleDelete = () => {
    if (deletingId) {
      deleteViatura(deletingId);
      toast.success('Viatura excluída com sucesso');
      setIsDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  const getEquipamentoNome = (id?: string) => {
    if (!id) return '-';
    const eq = equipamentos.find((e) => e.id === id);
    return eq ? `${eq.tipo} - ${eq.municipio}` : '-';
  };

  return (
    <AppLayout>
      <PageHeader title="Viaturas" description="Gerencie as viaturas da Patrulha Maria da Penha">
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Viatura
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
          <Select value={filterOrgao} onValueChange={setFilterOrgao}>
            <SelectTrigger>
              <SelectValue placeholder="Órgão Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os órgãos</SelectItem>
              {orgaosResponsaveis.map((orgao) => (
                <SelectItem key={orgao} value={orgao}>
                  {orgao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterVinculada} onValueChange={setFilterVinculada}>
            <SelectTrigger>
              <SelectValue placeholder="Vinculação" />
            </SelectTrigger>
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

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Município</th>
                <th>Órgão</th>
                <th>Qtd</th>
                <th>Implantação</th>
                <th>Vinculada</th>
                <th>Responsável</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredViaturas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground">
                    <Truck className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma viatura encontrada</p>
                  </td>
                </tr>
              ) : (
                filteredViaturas.map((viatura) => (
                  <tr key={viatura.id} className="animate-fade-in">
                    <td className="font-medium">{viatura.municipio}</td>
                    <td>
                      <span className="badge-status bg-primary/10 text-primary">
                        {viatura.orgaoResponsavel}
                      </span>
                    </td>
                    <td className="font-semibold">{viatura.quantidade}</td>
                    <td>
                      {format(new Date(viatura.dataImplantacao), 'dd/MM/yyyy', { locale: ptBR })}
                    </td>
                    <td className="text-xs">
                      {viatura.vinculadaEquipamento
                        ? getEquipamentoNome(viatura.equipamentoId)
                        : 'Não vinculada'}
                    </td>
                    <td>{viatura.responsavel || '-'}</td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(viatura)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeletingId(viatura.id);
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingViatura ? 'Editar Viatura' : 'Nova Viatura'}</DialogTitle>
            <DialogDescription>
              Cadastre ou atualize uma viatura da Patrulha Maria da Penha.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Município *</Label>
                <Select
                  value={formData.municipio}
                  onValueChange={(value) =>
                    setFormData({ ...formData, municipio: value, equipamentoId: '' })
                  }
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
                <Label>Órgão Responsável *</Label>
                <Select
                  value={formData.orgaoResponsavel}
                  onValueChange={(value) =>
                    setFormData({ ...formData, orgaoResponsavel: value as OrgaoResponsavel })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgaosResponsaveis.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantidade de Viaturas</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.quantidade}
                  onChange={(e) =>
                    setFormData({ ...formData, quantidade: parseInt(e.target.value) || 1 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Implantação</Label>
                <Input
                  type="date"
                  value={formData.dataImplantacao}
                  onChange={(e) => setFormData({ ...formData, dataImplantacao: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <Label htmlFor="vinculada">Vinculada a Equipamento?</Label>
              <Switch
                id="vinculada"
                checked={formData.vinculadaEquipamento}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, vinculadaEquipamento: checked, equipamentoId: '' })
                }
              />
            </div>

            {formData.vinculadaEquipamento && (
              <div className="space-y-2">
                <Label>Equipamento</Label>
                <Select
                  value={formData.equipamentoId}
                  onValueChange={(value) => setFormData({ ...formData, equipamentoId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o equipamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipamentosDoMunicipio.length === 0 ? (
                      <SelectItem value="" disabled>
                        Nenhum equipamento neste município
                      </SelectItem>
                    ) : (
                      equipamentosDoMunicipio.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.tipo}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Responsável</Label>
              <Input
                value={formData.responsavel}
                onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                placeholder="Nome do responsável"
              />
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
              {editingViatura ? 'Salvar Alterações' : 'Cadastrar'}
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
              Tem certeza que deseja excluir esta viatura? Esta ação não pode ser desfeita.
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
