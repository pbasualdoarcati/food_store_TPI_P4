import { useForm } from '@tanstack/react-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { handleApiError } from '../../../shared/api/handleApiError';
import AlertaError from '../../../shared/ui/AlertaError';
import Button from '../../../shared/ui/Button';
import Card from '../../../shared/ui/Card';
import FormField from '../../../shared/ui/FormField';
import Input from '../../../shared/ui/Input';
import { requerido } from '../../../shared/utils/validaciones';
import { useAuthStore } from '../../../store/authStore';
import { useLogin } from '../hooks/useAuth';
import type { Credenciales, Usuario } from '../types';

// ProtectedRoute deja { desde } en el state al redirigir al login
function rutaDeOrigen(estado: unknown): string | undefined {
  if (typeof estado === 'object' && estado !== null && 'desde' in estado) {
    return typeof estado.desde === 'string' ? estado.desde : undefined;
  }
  return undefined;
}

function destinoInicial(usuario: Usuario, desde?: string): string {
  if (desde && desde !== '/login') return desde;
  return usuario.role === 'admin' ? '/admin/resumen' : '/';
}

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const desde = rutaDeOrigen(location.state);
  const usuario = useAuthStore((s) => s.usuario);
  const login = useLogin();

  const valoresIniciales: Credenciales = { username: '', password: '' };
  const form = useForm({
    defaultValues: valoresIniciales,
    onSubmit: async ({ value }) => {
      try {
        const logueado = await login.mutateAsync({
          username: value.username.trim(),
          password: value.password,
        });
        navigate(destinoInicial(logueado, desde), { replace: true });
      } catch {
        // 401 credenciales incorrectas / 400 cuenta desactivada: se muestra desde login.error
      }
    },
  });

  // Ya logueado al entrar (no tras enviar el form: ahí navega onSubmit)
  if (usuario && login.isIdle) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-md">
      <Card className="p-6">
        <h1 className="mb-1 text-2xl font-bold">Iniciar sesión</h1>
        <p className="mb-6 text-sm text-slate-500">Ingresá para confirmar pedidos y ver su estado.</p>

        <AlertaError mensaje={login.isError ? handleApiError(login.error) : null} />

        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <form.Field name="username" validators={{ onChange: requerido('El usuario') }}>
            {(field) => (
              <FormField label="Usuario" htmlFor={field.name} errores={field.state.meta.errors}>
                <Input
                  id={field.name}
                  autoFocus
                  autoComplete="username"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
              </FormField>
            )}
          </form.Field>

          <form.Field name="password" validators={{ onChange: requerido('La contraseña') }}>
            {(field) => (
              <FormField label="Contraseña" htmlFor={field.name} errores={field.state.meta.errors}>
                <Input
                  id={field.name}
                  type="password"
                  autoComplete="current-password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
              </FormField>
            )}
          </form.Field>

          <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
            {([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                className="w-full"
                disabled={!canSubmit}
                cargando={isSubmitting}
              >
                Ingresar
              </Button>
            )}
          </form.Subscribe>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          ¿No tenés cuenta?{' '}
          <Link to="/register" className="font-medium text-orange-600 hover:underline">
            Registrate
          </Link>
        </p>
      </Card>
    </div>
  );
}

export default LoginPage;
