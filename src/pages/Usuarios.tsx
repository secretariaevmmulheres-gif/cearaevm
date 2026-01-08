import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Search, Users, Shield, Trash2, UserCheck, UserX, Clock, History } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AppRole } from '@/types';
import { useAuthContext } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { useAuditLogs } from '@/hooks/useAuditLogs';

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole | null;
  created_at: string;
}

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  editor: 'Editor',
  viewer: 'Visualizador',
};

const roleColors: Record<AppRole, string> = {
  admin: 'bg-destructive/10 text-destructive',
  editor: 'bg-primary/10 text-primary',
  viewer: 'bg-muted text-muted-foreground',
};

export default function Usuarios() {
  const { hasRole } = useAuthContext();
  const queryClient = useQueryClient();
  const { logs: auditLogs, createLog, isLoading: isLoadingLogs } = useAuditLogs();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deletingUserEmail, setDeletingUserEmail] = useState<string>('');

  // Redirect if not admin
  if (!hasRole('admin')) {
    return <Navigate to="/dashboard" replace />;
  }

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Get all roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Combine data
      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.id);
        return {
          id: profile.id,
          email: profile.email || '',
          full_name: profile.full_name,
          role: (userRole?.role as AppRole) || null,
          created_at: profile.created_at,
        };
      });

      return usersWithRoles;
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role, userEmail, isNewApproval }: { userId: string; role: AppRole; userEmail: string; isNewApproval: boolean }) => {
      // Check if user already has a role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id, role')
        .eq('user_id', userId)
        .maybeSingle();

      const previousRole = existingRole?.role as AppRole | undefined;

      if (existingRole) {
        // Update existing role
        const { error } = await supabase
          .from('user_roles')
          .update({ role })
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role });
        if (error) throw error;
      }

      // Create audit log
      await createLog({
        action: isNewApproval ? 'approve_user' : 'change_role',
        targetUserId: userId,
        targetUserEmail: userEmail,
        details: isNewApproval 
          ? { new_role: role }
          : { previous_role: previousRole, new_role: role },
      });
    },
    onSuccess: (_, { isNewApproval }) => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast.success(isNewApproval ? 'Usuário aprovado com sucesso' : 'Permissão atualizada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar permissão: ' + error.message);
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, userEmail }: { userId: string; userEmail: string }) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      if (error) throw error;

      // Create audit log
      await createLog({
        action: 'remove_access',
        targetUserId: userId,
        targetUserEmail: userEmail,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast.success('Acesso removido com sucesso');
      setIsDeleteDialogOpen(false);
      setDeletingUserId(null);
      setDeletingUserEmail('');
    },
    onError: (error) => {
      toast.error('Erro ao remover acesso: ' + error.message);
    },
  });

  // Separate pending users (no role) from approved users
  const pendingUsers = users.filter((u) => !u.role);
  const approvedUsers = users.filter((u) => u.role);

  const filteredPendingUsers = pendingUsers.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.full_name && u.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredApprovedUsers = approvedUsers.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.full_name && u.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <AppLayout>
      <PageHeader
        title="Gerenciar Usuários"
        description="Controle de acesso e permissões do sistema"
      />

      {/* Filters */}
      <div className="bg-card rounded-xl p-4 border border-border shadow-sm mb-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Tabs for Pending and Approved Users */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="w-4 h-4" />
            Pendentes ({pendingUsers.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-2">
            <UserCheck className="w-4 h-4" />
            Aprovados ({approvedUsers.length})
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <History className="w-4 h-4" />
            Auditoria
          </TabsTrigger>
        </TabsList>

        {/* Pending Users Tab */}
        <TabsContent value="pending">
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Email</th>
                    <th>Data de Cadastro</th>
                    <th>Aprovar com Permissão</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-muted-foreground">
                        Carregando...
                      </td>
                    </tr>
                  ) : filteredPendingUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-muted-foreground">
                        <UserCheck className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhum usuário pendente de aprovação</p>
                      </td>
                    </tr>
                  ) : (
                    filteredPendingUsers.map((user) => (
                      <tr key={user.id} className="animate-fade-in">
                        <td className="font-medium">{user.full_name || 'Sem nome'}</td>
                        <td>{user.email}</td>
                        <td className="text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Select
                              onValueChange={(value) =>
                                updateRoleMutation.mutate({ userId: user.id, role: value as AppRole, userEmail: user.email, isNewApproval: true })
                              }
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Aprovar como..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="viewer">
                                  <div className="flex flex-col items-start">
                                    <span>Visualizador</span>
                                    <span className="text-xs text-muted-foreground">Apenas visualiza dados</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="editor">
                                  <div className="flex flex-col items-start">
                                    <span>Editor</span>
                                    <span className="text-xs text-muted-foreground">Pode criar e editar</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="admin">
                                  <div className="flex flex-col items-start">
                                    <span>Administrador</span>
                                    <span className="text-xs text-muted-foreground">Acesso total</span>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Role descriptions */}
          <div className="mt-4 bg-muted/50 rounded-xl p-4 border border-border">
            <h3 className="font-semibold text-sm mb-3">Atribuições por Permissão:</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="bg-card rounded-lg p-3 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Visualizador</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Visualizar dashboard</li>
                  <li>• Visualizar equipamentos</li>
                  <li>• Visualizar viaturas</li>
                  <li>• Visualizar solicitações</li>
                  <li>• Acessar mapa</li>
                </ul>
              </div>
              <div className="bg-card rounded-lg p-3 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">Editor</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Tudo do Visualizador +</li>
                  <li>• Criar equipamentos</li>
                  <li>• Editar equipamentos</li>
                  <li>• Criar/editar viaturas</li>
                  <li>• Criar/editar solicitações</li>
                </ul>
              </div>
              <div className="bg-card rounded-lg p-3 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-destructive" />
                  <span className="font-medium text-sm">Administrador</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Tudo do Editor +</li>
                  <li>• Excluir registros</li>
                  <li>• Gerenciar usuários</li>
                  <li>• Aprovar novos usuários</li>
                  <li>• Alterar permissões</li>
                </ul>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Approved Users Tab */}
        <TabsContent value="approved">
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Email</th>
                    <th>Permissão Atual</th>
                    <th>Alterar Permissão</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground">
                        Carregando...
                      </td>
                    </tr>
                  ) : filteredApprovedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhum usuário aprovado encontrado</p>
                      </td>
                    </tr>
                  ) : (
                    filteredApprovedUsers.map((user) => (
                      <tr key={user.id} className="animate-fade-in">
                        <td className="font-medium">{user.full_name || 'Sem nome'}</td>
                        <td>{user.email}</td>
                        <td>
                          <span className={cn('badge-status', roleColors[user.role!])}>
                            <Shield className="w-3 h-3 mr-1" />
                            {roleLabels[user.role!]}
                          </span>
                        </td>
                        <td>
                          <Select
                            value={user.role || ''}
                            onValueChange={(value) =>
                              updateRoleMutation.mutate({ userId: user.id, role: value as AppRole, userEmail: user.email, isNewApproval: false })
                            }
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Alterar permissão" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="viewer">Visualizador</SelectItem>
                              <SelectItem value="editor">Editor</SelectItem>
                              <SelectItem value="admin">Administrador</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td>
                          <div className="flex items-center justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setDeletingUserId(user.id);
                                setDeletingUserEmail(user.email);
                                setIsDeleteDialogOpen(true);
                              }}
                              title="Remover acesso"
                            >
                              <UserX className="w-4 h-4" />
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

        {/* Audit Logs Tab */}
        <TabsContent value="logs">
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data/Hora</th>
                    <th>Ação</th>
                    <th>Usuário Afetado</th>
                    <th>Executado Por</th>
                    <th>Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingLogs ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground">
                        Carregando...
                      </td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground">
                        <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhum registro de auditoria</p>
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="animate-fade-in">
                        <td className="text-sm">
                          {new Date(log.created_at).toLocaleDateString('pt-BR')}{' '}
                          {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td>
                          <span className={cn('badge-status', {
                            'bg-success/10 text-success': log.action === 'approve_user',
                            'bg-primary/10 text-primary': log.action === 'change_role',
                            'bg-destructive/10 text-destructive': log.action === 'remove_access',
                          })}>
                            {log.action === 'approve_user' && 'Aprovação'}
                            {log.action === 'change_role' && 'Alteração de Role'}
                            {log.action === 'remove_access' && 'Remoção de Acesso'}
                          </span>
                        </td>
                        <td className="text-sm">{log.target_user_email || '-'}</td>
                        <td className="text-sm">{log.performed_by_email || '-'}</td>
                        <td className="text-xs text-muted-foreground">
                          {log.details && (
                            <>
                              {(log.details as Record<string, unknown>).previous_role && (
                                <span>
                                  {roleLabels[(log.details as Record<string, unknown>).previous_role as AppRole]} →{' '}
                                </span>
                              )}
                              {(log.details as Record<string, unknown>).new_role && (
                                <span className="font-medium text-foreground">
                                  {roleLabels[(log.details as Record<string, unknown>).new_role as AppRole]}
                                </span>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Acesso</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o acesso deste usuário ao sistema? Ele não poderá mais acessar nenhuma funcionalidade.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingUserId && removeRoleMutation.mutate({ userId: deletingUserId, userEmail: deletingUserEmail })}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remover Acesso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
