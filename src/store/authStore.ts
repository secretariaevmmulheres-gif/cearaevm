import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  isAuthenticated: boolean;
  user: { username: string } | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

// Credenciais do administrador (em produção, usar backend com JWT)
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'spm@2024',
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      
      login: (username: string, password: string) => {
        if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
          set({ isAuthenticated: true, user: { username } });
          return true;
        }
        return false;
      },
      
      logout: () => {
        set({ isAuthenticated: false, user: null });
      },
    }),
    {
      name: 'spm-auth-store',
    }
  )
);
