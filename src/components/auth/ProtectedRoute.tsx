import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { Loader2, LogOut, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, role, signOut, user } = useAuthContext();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if user has a role (was approved by admin)
  if (!role) {
    const handleSignOut = async () => {
      await signOut();
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card rounded-xl border border-border shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-warning" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">
            Aguardando Aprovação
          </h1>
          <p className="text-muted-foreground mb-2">
            Sua conta foi criada, mas ainda não foi aprovada por um administrador.
          </p>
          {user?.email && (
            <p className="text-sm text-muted-foreground mb-6">
              Logado como: <span className="font-medium text-foreground">{user.email}</span>
            </p>
          )}
          <p className="text-sm text-muted-foreground mb-6">
            Entre em contato com o administrador do sistema para obter acesso.
          </p>
          <Button onClick={handleSignOut} variant="outline" className="gap-2">
            <LogOut className="w-4 h-4" />
            Sair da Conta
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
