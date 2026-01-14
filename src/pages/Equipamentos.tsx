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
import { useEquipamentos } from '@/hooks/useEquipamentos';
import { municipiosCeara, tiposEquipamento, TipoEquipamento, regioesList, getRegiao } from '@/data/municipios';
import { Equipamento } from '@/types';
import { Plus, Pencil, Trash2, Search, Building2, CheckCircle, XCircle, Download, FileSpreadsheet, FileText as FilePdf } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  'Sala Lilás': 'equipment-lilas',
};

export default function Equipamentos() {
  const { equipamentos, addEquipamento, updateEquipamento, deleteEquipamento, isAdding, isUpdating } = useEquipamentos();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('all');
  const [filterPatrulha, setFilterPatrulha] = useState<string>('all');
  const [filterRegiao, setFilterRegiao] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingEquipamento, setEditingEquipamento] = useState<Equipamento | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    municipio: '',
    tipo: '' as TipoEquipamento | '',
    possui_patrulha: false,
    endereco: '',
    telefone: '',
    responsavel: '',
    observacoes: '',
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

  const openCreateDialog = () => {
    setEditingEquipamento(null);
    setFormData({
      municipio: '',
      tipo: '',
      possui_patrulha: false,
      endereco: '',
      telefone: '',
      responsavel: '',
      observacoes: '',
    });
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
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.municipio || !formData.tipo) {
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
              <DropdownMenuItem onClick={() => exportEquipamentosToPDF(filteredEquipamentos, filterRegiao)}>
                <FilePdf className="w-4 h-4 mr-2" />
                Exportar PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportEquipamentosToExcel(filteredEquipamentos)}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Exportar Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Equipamento
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
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo de Equipamento" />
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
          <Select value={filterPatrulha} onValueChange={setFilterPatrulha}>
            <SelectTrigger>
              <SelectValue placeholder="Patrulha M.P." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="sim">Com Patrulha</SelectItem>
              <SelectItem value="nao">Sem Patrulha</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center text-sm text-muted-foreground">
            {filteredEquipamentos.length} registro(s) encontrado(s)
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
                <th>Patrulha M.P.</th>
                <th>Responsável</th>
                <th>Telefone</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredEquipamentos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum equipamento encontrado</p>
                  </td>
                </tr>
              ) : (
                filteredEquipamentos.map((equipamento) => (
                  <tr key={equipamento.id} className="animate-fade-in">
                    <td className="font-medium">{equipamento.municipio}</td>
                    <td>
                      <span className={cn('equipment-badge', tipoStyles[equipamento.tipo])}>
                        {equipamento.tipo}
                      </span>
                    </td>
                    <td>
                      {equipamento.possui_patrulha ? (
                        <span className="flex items-center gap-1 text-success">
                          <CheckCircle className="w-4 h-4" /> Sim
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <XCircle className="w-4 h-4" /> Não
                        </span>
                      )}
                    </td>
                    <td>{equipamento.responsavel || '-'}</td>
                    <td>{equipamento.telefone || '-'}</td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(equipamento)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeletingId(equipamento.id);
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
            <DialogTitle>
              {editingEquipamento ? 'Editar Equipamento' : 'Novo Equipamento'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do equipamento de atendimento.
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
                <Label>Tipo *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value) => setFormData({ ...formData, tipo: value as TipoEquipamento })}
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
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <Label htmlFor="patrulha">Possui Patrulha Maria da Penha?</Label>
              <Switch
                id="patrulha"
                checked={formData.possui_patrulha}
                onCheckedChange={(checked) => setFormData({ ...formData, possui_patrulha: checked })}
              />
            </div>

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
              {editingEquipamento ? 'Salvar Alterações' : 'Cadastrar'}
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
