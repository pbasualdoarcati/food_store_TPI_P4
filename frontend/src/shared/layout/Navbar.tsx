import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ETIQUETA_ROL } from '../../features/auth/types';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import Button from '../ui/Button';
import { primaryButtonClass, secondaryButtonClass } from '../ui/styles';

interface Enlace {
  to: string;
  label: string;
}

const enlacesAdmin: Enlace[] = [
  { to: '/admin/resumen', label: 'Resumen' },
  { to: '/admin/pedidos', label: 'Pedidos' },
  { to: '/admin/productos', label: 'Productos' },
  { to: '/admin/categorias', label: 'Categorías' },
  { to: '/admin/usuarios', label: 'Usuarios' },
];

const claseEnlace = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-orange-600 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`;

function Navbar() {
  const navigate = useNavigate();
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useAuthStore((s) => s.logout);
  const cantidadCarrito = useCartStore((s) => s.cantidadItems());
  const [cerrando, setCerrando] = useState(false);

  const cerrarSesion = async () => {
    setCerrando(true);
    try {
      await logout();
    } finally {
      setCerrando(false);
      navigate('/login', { replace: true });
    }
  };

  return (
    <header className="sticky top-0 z-20 bg-white shadow-sm">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-1">
          <Link to="/" className="mr-3 text-lg font-bold text-orange-600">
            🍔 Food Store
          </Link>
          <NavLink to="/" end className={claseEnlace}>
            Catálogo
          </NavLink>
          <NavLink to="/carrito" className={claseEnlace}>
            Carrito
            {cantidadCarrito > 0 && (
              <span
                aria-label={`${cantidadCarrito} productos en el carrito`}
                className="ml-1.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-semibold text-orange-700"
              >
                {cantidadCarrito}
              </span>
            )}
          </NavLink>
          {usuario && (
            <NavLink to="/mis-pedidos" className={claseEnlace}>
              Mis pedidos
            </NavLink>
          )}
        </div>

        <div className="flex items-center gap-3">
          {usuario ? (
            <>
              <div className="text-right text-sm leading-tight">
                <p className="font-medium text-slate-800">{usuario.full_name}</p>
                <p className="text-xs text-slate-500">
                  @{usuario.username} · {ETIQUETA_ROL[usuario.role]}
                </p>
              </div>
              <Button variante="secundario" onClick={() => void cerrarSesion()} cargando={cerrando}>
                Cerrar sesión
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" className={secondaryButtonClass}>
                Ingresar
              </Link>
              <Link to="/register" className={primaryButtonClass}>
                Registrarse
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* El panel solo se muestra al admin; la protección real está en el backend */}
      {usuario?.role === 'admin' && (
        <div className="border-t border-slate-100 bg-slate-50">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-4 py-2">
            <span className="mr-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Panel admin
            </span>
            {enlacesAdmin.map(({ to, label }) => (
              <NavLink key={to} to={to} className={claseEnlace}>
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar;
