import { useForm } from '@tanstack/react-form';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { handleApiError } from '../../../shared/api/handleApiError';
import AlertaError from '../../../shared/ui/AlertaError';
import Button from '../../../shared/ui/Button';
import Card from '../../../shared/ui/Card';
import FormField from '../../../shared/ui/FormField';
import Input from '../../../shared/ui/Input';
import { emailValido, longitud, passwordValida } from '../../../shared/utils/validaciones';
import { useAuthStore } from '../../../store/authStore';
import { useRegistro } from '../hooks/useAuth';
import type { UserCreate } from '../types';

interface RegistroForm extends UserCreate {
  confirmacion: string;
}

const valoresIniciales: RegistroForm = {
  username: '',
  full_name: '',
  email: '',
  password: '',
  confirmacion: '',
};

function RegisterPage() {
  const navigate = useNavigate();
  const usuario = useAuthStore((s) => s.usuario);
  const registro = useRegistro();

  const form = useForm({
    defaultValues: valoresIniciales,
    onSubmit: async ({ value }) => {
      try {
        await registro.mutateAsync({
          username: value.username.trim(),
          full_name: value.full_name.trim(),
          email: value.email.trim(),
          password: value.password,
        });
        navigate('/', { replace: true });
      } catch {
        // 409 usuario o email duplicado: se muestra desde registro.error
      }
    },
  });

  if (usuario && registro.isIdle) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-md">
      <Card className="p-6">
        <h1 className="mb-1 text-2xl font-bold">Crear cuenta</h1>
        <p className="mb-6 text-sm text-slate-500">Registrate para hacer tus pedidos.</p>

        <AlertaError mensaje={registro.isError ? handleApiError(registro.error) : null} />

        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <form.Field name="username" validators={{ onChange: longitud('El usuario', 3, 50) }}>
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

          <form.Field
            name="full_name"
            validators={{ onChange: longitud('El nombre completo', 2, 100) }}
          >
            {(field) => (
              <FormField
                label="Nombre completo"
                htmlFor={field.name}
                errores={field.state.meta.errors}
              >
                <Input
                  id={field.name}
                  autoComplete="name"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
              </FormField>
            )}
          </form.Field>

          <form.Field name="email" validators={{ onChange: emailValido }}>
            {(field) => (
              <FormField label="Email" htmlFor={field.name} errores={field.state.meta.errors}>
                <Input
                  id={field.name}
                  type="email"
                  autoComplete="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
              </FormField>
            )}
          </form.Field>

          <form.Field name="password" validators={{ onChange: passwordValida }}>
            {(field) => (
              <FormField
                label="Contraseña"
                htmlFor={field.name}
                errores={field.state.meta.errors}
                ayuda="Mínimo 8 caracteres."
              >
                <Input
                  id={field.name}
                  type="password"
                  autoComplete="new-password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
              </FormField>
            )}
          </form.Field>

          <form.Field
            name="confirmacion"
            validators={{
              // Se revalida también cuando cambia la contraseña
              onChangeListenTo: ['password'],
              onChange: ({ value, fieldApi }) => {
                if (!value) return 'Repetí la contraseña';
                return value === fieldApi.form.getFieldValue('password')
                  ? undefined
                  : 'Las contraseñas no coinciden';
              },
            }}
          >
            {(field) => (
              <FormField
                label="Repetir contraseña"
                htmlFor={field.name}
                errores={field.state.meta.errors}
              >
                <Input
                  id={field.name}
                  type="password"
                  autoComplete="new-password"
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
                Crear cuenta
              </Button>
            )}
          </form.Subscribe>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="font-medium text-orange-600 hover:underline">
            Iniciá sesión
          </Link>
        </p>
      </Card>
    </div>
  );
}

export default RegisterPage;
