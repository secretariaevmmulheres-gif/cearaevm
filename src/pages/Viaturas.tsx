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
import { useViaturas } from '@/hooks/useViaturas';
import { useEquipamentos } from '@/hooks/useEquipamentos';
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import { municipiosCeara, orgaosResponsaveis, OrgaoResponsavel, regioesList, getRegiao } from '@/data/municipios';
import { Viatura, Equipamento, Solicitacao } from '@/types';
import { Plus, Pencil, Trash2, Search, Truck, Download, FileSpreadsheet, FileText as FilePdf, Building2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { exportViaturasToPDF, exportViaturasToExcel, exportPatrulhasCasasToPDF, exportPatrulhasCasasToExcel } from '@/lib/exportUtils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

  // Form state
  const [formData, setFormData] = useState({
    municipio: '',
    tipo_patrulha: 'Patrulha Maria da Penha',
    vinculada_equipamento: false,
    equipamento_id: '',
    orgao_responsavel: '' as OrgaoResponsavel | '',
    quantidade: 1,
    data_implantacao: '',
    responsavel: '',
    observacoes: '',
  });

  const equipamentosDoMunicipio = equipamentos.filter(
    (e) => e.municipio === formData.municipio
  );

  // Filtro e ordenação das viaturas PMCE
  const filteredViaturas = viaturas
    .filter((v) => {
      const matchesSearch =
        v.municipio.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.responsavel || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesOrgao = filterOrgao === 'all' || v.orgao_responsavel === filterOrgao;
      const matchesVinculada =
        filterVinculada === 'all' ||
        (filterVinculada === 'sim' && v.vinculada_equipamento) ||
        (filterVinculada === 'nao' && !v.vinculada_equipamento);
      const matchesRegiao = filterRegiao === 'all' || getRegiao(v.municipio) === filterRegiao;
      return matchesSearch && matchesOrgao && matchesVinculada && matchesRegiao;
    })
    .sort((a, b) => a.municipio.localeCompare(b.municipio));

  // --- Patrulhas das Casas ---
  // Equipamentos com possui_patrulha = true (já filtrados pela busca e região)
  const patrulhasDeEquipamentos = equipamentos
    .filter((e) => e.possui_patrulha)
    .filter((e) => {
      const matchesSearch =
        e.municipio.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.responsavel || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRegiao = filterRegiao === 'all' || getRegiao(e.municipio) === filterRegiao;
      return matchesSearch && matchesRegiao;
    });

  // Conjunto de municípios que já possuem equipamento com patrulha (em todo o sistema, independente de filtro)
  const municipiosComPatrulhaEquip = new Set(
    equipamentos.filter(e => e.possui_patrulha).map(e => e.municipio)
  );

  // Solicitações que receberam patrulha e cujo município NÃO possui equipamento com patrulha
  const patrulhasDeSolicitacoes = solicitacoes
    .filter((s) => s.recebeu_patrulha && !municipiosComPatrulhaEquip.has(s.municipio))
    .filter((s) => {
      const matchesSearch = s.municipio.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRegiao = filterRegiao === 'all' || getRegiao(s.municipio) === filterRegiao;
      return matchesSearch && matchesRegiao;
    });

  // Combinar para exibição unificada e ordenar
  type PatrulhaCasa = {
    id: string;
    municipio: string;
    tipo: string;
    endereco: string;
    responsavel: string;
    telefone: string;
    origem: 'equipamento' | 'solicitacao';
    status?: string;
  };

  const patrulhasDasCasas: PatrulhaCasa[] = [
    ...patrulhasDeEquipamentos.map((e) => ({
      id: e.id,
      municipio: e.municipio,
      tipo: e.tipo,
      endereco: e.endereco || '',
      responsavel: e.responsavel || '',
      telefone: e.telefone || '',
      origem: 'equipamento' as const,
    })),
    ...patrulhasDeSolicitacoes.map((s) => ({
      id: s.id,
      municipio: s.municipio,
      tipo: s.tipo_equipamento,
      endereco: '',
      responsavel: '',
      telefone: '',
      origem: 'solicitacao' as const,
      status: s.status,
    })),
  ].sort((a, b) => a.municipio.localeCompare(b.municipio));

  // --- Funções CRUD ---
  const openCreateDialog = () => {
    setEditingViatura(null);
    setFormData({
      municipio: '',
      tipo_patrulha: 'Patrulha Maria da Penha',
      vinculada_equipamento: false,
      equipamento_id: '',
      orgao_responsavel: '',
      quantidade: 1,
      data_implantacao: '',
      responsavel: '',
      observacoes: '',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (viatura: Viatura) => {
    setEditingViatura(viatura);
    setFormData({
      municipio: viatura.municipio,
      tipo_patrulha: viatura.tipo_patrulha,
      vinculada_equipamento: viatura.vinculada_equipamento,
      equipamento_id: viatura.equipamento_id || '',
      orgao_responsavel: viatura.orgao_responsavel,
      quantidade: viatura.quantidade,
      data_implantacao: viatura.data_implantacao
        ? format(new Date(viatura.data_implantacao), 'yyyy-MM-dd')
        : '',
      responsavel: viatura.responsavel || '',
      observacoes: viatura.observacoes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.municipio || !formData.orgao_responsavel) {
      return;
    }

    const data = {
      municipio: formData.municipio,
      tipo_patrulha: formData.tipo_patrulha,
      vinculada_equipamento: formData.vinculada_equipamento,
      equipamento_id: formData.vinculada_equipamento ? formData.equipamento_id : null,
      orgao_responsavel: formData.orgao_responsavel as OrgaoResponsavel,
      quantidade: formData.quantidade,
      data_implantacao: formData.data_implantacao || format(new Date(), 'yyyy-MM-dd'),
      responsavel: formData.responsavel,
      observacoes: formData.observacoes,
    };

    if (editingViatura) {
      updateViatura({ id: editingViatura.id, ...data });
    } else {
      addViatura(data);
    }
    setIsDialogOpen(false);
  };

  const handleDelete = () => {
    if (deletingId) {
      deleteViatura(deletingId);
      setIsDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  const getEquipamentoNome = (id?: string | null) => {
    if (!id) return '-';
    const eq = equipamentos.find((e) => e.id === id);
    return eq ? `${eq.tipo} - ${eq.municipio}` : '-';
  };

  return (
    <AppLayout>
      <PageHeader title="Viaturas" description="Gerencie as viaturas da Patrulha Maria da Penha">
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportViaturasToPDF(filteredViaturas)}>
                <FilePdf className="w-4 h-4 mr-2" />
                Exportar PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportViaturasToExcel(filteredViaturas)}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Exportar Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Viatura
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

      {/* Tabs for different views */}
      <Tabs defaultValue="pmce" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pmce" className="gap-2">
            <Truck className="w-4 h-4" />
            Viaturas PMCE ({filteredViaturas.length})
          </TabsTrigger>
          <TabsTrigger value="casas" className="gap-2">
            <Building2 className="w-4 h-4" />
            Patrulhas das Casas ({patrulhasDasCasas.length})
          </TabsTrigger>
        </TabsList>

        {/* Viaturas PMCE Table */}
        <TabsContent value="pmce">
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
                            {viatura.orgao_responsavel}
                          </span>
                        </td>
                        <td className="font-semibold">{viatura.quantidade}</td>
                        <td>
                          {format(new Date(viatura.data_implantacao), 'dd/MM/yyyy', { locale: ptBR })}
                        </td>
                        <td className="text-xs">
                          {viatura.vinculada_equipamento
                            ? getEquipamentoNome(viatura.equipamento_id)
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
        </TabsContent>

        {/* Patrulhas das Casas Table */}
        <TabsContent value="casas">
          <div className="flex justify-end mb-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar Patrulhas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportPatrulhasCasasToPDF(equipamentos, solicitacoes)}>
                  <FilePdf className="w-4 h-4 mr-2" />
                  Exportar PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportPatrulhasCasasToExcel(equipamentos, solicitacoes)}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Exportar Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Município</th>
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
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhum equipamento com Patrulha Maria da Penha</p>
                      </td>
                    </tr>
                  ) : (
                    patrulhasDasCasas.map((patrulha) => (
                      <tr key={patrulha.id} className="animate-fade-in">
                        <td className="font-medium">{patrulha.municipio}</td>
                        <td>
                          <span className="badge-status bg-emerald-500/10 text-emerald-600">
                            {patrulha.tipo}
                          </span>
                        </td>
                        <td>
                          {patrulha.origem === 'equipamento' ? (
                            <span className="badge-status bg-primary/10 text-primary">
                              Equipamento
                            </span>
                          ) : (
                            <span className="badge-status bg-warning/10 text-warning">
                              Solicitação ({patrulha.status})
                            </span>
                          )}
                        </td>
                        <td className="text-sm">{patrulha.endereco || '-'}</td>
                        <td>{patrulha.responsavel || '-'}</td>
                        <td>{patrulha.telefone || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            * Patrulhas de Equipamentos são gerenciadas na página de Equipamentos. Patrulhas de Solicitações são gerenciadas na página de Solicitações.
          </p>
        </TabsContent>
      </Tabs>

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
                    setFormData({ ...formData, municipio: value, equipamento_id: '' })
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
                  value={formData.orgao_responsavel}
                  onValueChange={(value) =>
                    setFormData({ ...formData, orgao_responsavel: value as OrgaoResponsavel })
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
                  value={formData.data_implantacao}
                  onChange={(e) => setFormData({ ...formData, data_implantacao: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <Label htmlFor="vinculada">Vinculada a Equipamento?</Label>
              <Switch
                id="vinculada"
                checked={formData.vinculada_equipamento}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, vinculada_equipamento: checked, equipamento_id: '' })
                }
              />
            </div>

            {formData.vinculada_equipamento && (
              <div className="space-y-2">
                <Label>Equipamento</Label>
                <Select
                  value={formData.equipamento_id || undefined}
                  onValueChange={(value) => setFormData({ ...formData, equipamento_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o equipamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipamentosDoMunicipio.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Nenhum equipamento neste município
                      </div>
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
            <Button onClick={handleSubmit} disabled={isAdding || isUpdating}>
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