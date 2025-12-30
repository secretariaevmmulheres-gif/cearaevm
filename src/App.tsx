import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Equipamentos from "./pages/Equipamentos";
import Viaturas from "./pages/Viaturas";
import Solicitacoes from "./pages/Solicitacoes";
import Mapa from "./pages/Mapa";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/"
        element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/equipamentos"
        element={
          <ProtectedRoute>
            <Equipamentos />
          </ProtectedRoute>
        }
      />
      <Route
        path="/viaturas"
        element={
          <ProtectedRoute>
            <Viaturas />
          </ProtectedRoute>
        }
      />
      <Route
        path="/solicitacoes"
        element={
          <ProtectedRoute>
            <Solicitacoes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mapa"
        element={
          <ProtectedRoute>
            <Mapa />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
