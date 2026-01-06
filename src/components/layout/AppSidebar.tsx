import { NavLink, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Truck,
  FileText,
  Map,
  LogOut,
  Shield,
  Menu,
  X,
  Users,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const menuItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/equipamentos', label: 'Equipamentos', icon: Building2 },
  { path: '/viaturas', label: 'Viaturas', icon: Truck },
  { path: '/solicitacoes', label: 'Solicitações', icon: FileText },
  { path: '/mapa', label: 'Mapa', icon: Map },
];

const adminMenuItems = [
  { path: '/usuarios', label: 'Usuários', icon: Users },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut, hasRole, user, role } = useAuthContext();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
  };

  const isAdmin = hasRole('admin');

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden bg-card shadow-md"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-64 bg-sidebar text-sidebar-foreground z-40 transition-transform duration-300",
          "lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sidebar-primary rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-sidebar-primary-foreground" />
              </div>
              <div>
                <h2 className="font-display font-bold text-sm">SPM Ceará</h2>
                <p className="text-xs text-sidebar-foreground/60">Gestão de Rede</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              );
            })}

            {isAdmin && (
              <>
                <div className="pt-4 pb-2">
                  <span className="text-xs text-sidebar-foreground/50 px-4">Administração</span>
                </div>
                {adminMenuItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </NavLink>
                  );
                })}
              </>
            )}
          </nav>

          {/* User info and logout */}
          <div className="p-4 border-t border-sidebar-border">
            <NavLink
              to="/perfil"
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-2 mb-2 rounded-lg text-sm transition-all duration-200",
                location.pathname === '/perfil'
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "hover:bg-sidebar-accent"
              )}
            >
              <User className="w-4 h-4" />
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate">{user?.email}</p>
                <p className="text-xs text-sidebar-foreground/60 capitalize">{role}</p>
              </div>
            </NavLink>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5" />
              Sair do Sistema
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
