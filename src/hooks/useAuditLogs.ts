import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type AuditAction = 'approve_user' | 'change_role' | 'remove_access';

interface AuditLog {
  id: string;
  action: string;
  target_user_id: string | null;
  target_user_email: string | null;
  performed_by: string | null;
  performed_by_email: string | null;
  details: Json | null;
  created_at: string;
}

interface CreateAuditLogParams {
  action: AuditAction;
  targetUserId: string;
  targetUserEmail: string;
  details?: Record<string, string | undefined>;
}

export function useAuditLogs() {
  const queryClient = useQueryClient();

  // Fetch audit logs
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as AuditLog[];
    },
  });

  // Create audit log mutation
  const createLogMutation = useMutation({
    mutationFn: async ({ action, targetUserId, targetUserEmail, details }: CreateAuditLogParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('audit_logs')
        .insert([{
          action,
          target_user_id: targetUserId,
          target_user_email: targetUserEmail,
          performed_by: user?.id,
          performed_by_email: user?.email,
          details: details || null,
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  return {
    logs,
    isLoading,
    createLog: createLogMutation.mutateAsync,
  };
}
