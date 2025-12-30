import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, AlertCircle } from 'lucide-react';

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simular delay de autenticação
    await new Promise((resolve) => setTimeout(resolve, 500));

    const success = login(username, password);
    if (!success) {
      setError('Credenciais inválidas. Verifique usuário e senha.');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      <div className="w-full max-w-md animate-scale-in">
        <div className="bg-card rounded-2xl shadow-lg p-8 border border-border">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-accent" />
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground text-center">
              Sistema de Gestão
            </h1>
            <p className="text-muted-foreground text-sm mt-1 text-center">
              Rede de Atendimento à Mulher - Ceará
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Digite seu usuário"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                required
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Autenticando...' : 'Entrar no Sistema'}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6">
            Acesso restrito a usuários autorizados
          </p>
        </div>

        <p className="text-primary-foreground/60 text-xs text-center mt-4">
          Secretaria de Políticas para Mulheres - Governo do Estado do Ceará
        </p>
      </div>
    </div>
  );
}
