import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  PieChart,
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
  CalendarDays,
  ClipboardList,
  History,
  GraduationCap,
  Package,
  BarChart2,
  SearchX,
  Search,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';
import { municipiosCeara } from '@/data/municipios';

const menuItems = [
  { path: '/dashboard',           label: 'Dashboard',    icon: LayoutDashboard, roles: null },
  { path: '/dashboard-regional',  label: 'Por Região',   icon: PieChart,        roles: null },
  { path: '/equipamentos',        label: 'Equipamentos', icon: Building2,       roles: ['admin', 'editor', 'viewer'] },
  { path: '/viaturas',            label: 'Viaturas',     icon: Truck,           roles: ['admin', 'editor', 'viewer'] },
  { path: '/solicitacoes',        label: 'Solicitações', icon: FileText,        roles: ['admin', 'editor', 'viewer'] },
  { path: '/atividades',          label: 'Atividades',     icon: CalendarDays,  roles: null },
  { path: '/qualificacoes',       label: 'Qualificações',     icon: GraduationCap, roles: ['admin', 'editor', 'viewer'] },
  { path: '/material-grafico',    label: 'Material Gráfico',  icon: Package,    roles: ['admin', 'editor', 'viewer'] },
  { path: '/ppa',                 label: 'PPA',               icon: BarChart2,  roles: ['admin', 'editor', 'viewer'] },
  { path: '/mapa',                label: 'Mapa',         icon: Map,             roles: null },
  { path: '/relatorio-cpdi',      label: 'Rel. EVM',     icon: ClipboardList,  roles: ['admin', 'editor', 'viewer'] },
  { path: '/diagnostico',         label: 'Diagnóstico',  icon: SearchX,        roles: ['admin', 'editor', 'viewer'] },
  { path: '/historico',           label: 'Histórico',    icon: History,        roles: ['admin', 'editor', 'viewer'] },
];

const adminMenuItems = [
  { path: '/usuarios', label: 'Usuários', icon: Users },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate  = useNavigate();
  const { signOut, hasRole, user, role } = useAuthContext();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // ── Busca global por município ─────────────────────────────────────────────
  const [buscaMunicipio, setBuscaMunicipio] = useState('');
  const [buscaAberta,    setBuscaAberta]    = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const buscaRef = useRef<HTMLDivElement>(null);

  const resultados = buscaMunicipio.length >= 2
    ? municipiosCeara
        .filter(m => m.toLowerCase().includes(buscaMunicipio.toLowerCase()))
        .slice(0, 8)
    : [];

  const irParaMunicipio = (nome: string) => {
    navigate(`/municipio/${encodeURIComponent(nome)}`);
    setBuscaMunicipio('');
    setBuscaAberta(false);
    setIsMobileOpen(false);
  };

  // Fecha ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (buscaRef.current && !buscaRef.current.contains(e.target as Node)) {
        setBuscaAberta(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
                <h2 className="font-display font-bold text-sm">EVM</h2>
                <p className="text-xs text-sidebar-foreground/60">Enfrentamento à Violência</p>
              </div>
            </div>
          </div>

          {/* Busca global por município */}
          <div className="px-4 pb-2 pt-1" ref={buscaRef}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Buscar município..."
                value={buscaMunicipio}
                onChange={e => { setBuscaMunicipio(e.target.value); setBuscaAberta(true); }}
                onFocus={() => setBuscaAberta(true)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-muted/40 focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/60"
              />
              {buscaMunicipio && (
                <button
                  onClick={() => { setBuscaMunicipio(''); setBuscaAberta(false); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            {buscaAberta && resultados.length > 0 && (
              <div className="absolute z-50 mt-1 w-48 bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
                {resultados.map(m => (
                  <button
                    key={m}
                    onClick={() => irParaMunicipio(m)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left hover:bg-accent transition-colors"
                  >
                    <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
            {menuItems.map((item) => {
              const isActive  = location.pathname === item.path;
              const bloqueado = item.roles !== null && !item.roles.includes(role ?? '');
              return bloqueado ? (
                <div
                  key={item.path}
                  title="Seu perfil não tem acesso a este módulo"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-sidebar-foreground/30 cursor-not-allowed select-none"
                >
                  <item.icon className="w-4 h-4 shrink-0 opacity-40" />
                  {item.label}
                  <span className="ml-auto text-[10px] bg-sidebar-foreground/10 text-sidebar-foreground/40 px-1.5 py-0.5 rounded">
                    sem acesso
                  </span>
                </div>
              ) : (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </NavLink>
              );
            })}

            {isAdmin && (
              <>
                <div className="pt-3 pb-1">
                  <span className="text-xs text-sidebar-foreground/50 px-3">Administração</span>
                </div>
                {adminMenuItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
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
                <p className="text-xs text-sidebar-foreground/60">
                  {role === 'atividades_editor' ? 'Editor de Atividades'
                    : role === 'admin' ? 'Administrador'
                    : role === 'editor' ? 'Editor'
                    : role === 'viewer' ? 'Visualizador'
                    : role}
                </p>
              </div>
            </NavLink>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Sair do Sistema
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}