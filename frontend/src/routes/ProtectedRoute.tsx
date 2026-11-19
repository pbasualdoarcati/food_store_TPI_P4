import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Rol } from '../features/auth/types';
import Cargando from '../shared/components/Cargando';
import { useAuthStore } from '../store/authStore';

interface ProtectedRouteProps {
  roles?: Rol[]; // sin roles: alcanza con tener sesión
}

// Guarda de UX: la protección real la hacen get_current_user y require_role en el backend
function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const usuario = useAuthStore((s) => s.usuario);
  const cargando = useAuthStore((s) => s.cargando);
  const location = useLocation();

  if (cargando) return <Cargando mensaje="Verificando sesión…" />;

  if (!usuario) {
    return <Navigate to="/login" replace state={{ desde: location.pathname }} />;
  }

  if (roles && !roles.includes(usuario.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
