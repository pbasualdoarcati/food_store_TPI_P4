import { useMemo } from 'react';
import { handleApiError } from '../../../shared/api/handleApiError';
import DataTable from '../../../shared/components/DataTable';
import EstadoError from '../../../shared/components/EstadoError';
import EstadoVacio from '../../../shared/components/EstadoVacio';
import PageHeader from '../../../shared/components/PageHeader';
import { SkeletonFilas } from '../../../shared/components/Skeleton';
import { useAuthStore } from '../../../store/authStore';
import { crearColumnasUsuarios } from '../components/columnasUsuarios';
import { useActivarUsuario, useDesactivarUsuario, useUsuarios } from '../hooks/useUsuarios';
import type { UserPublic } from '../types';

function AdminUsuariosPage() {
  const idSesion = useAuthStore((s) => s.usuario?.id);
  const { data, isPending, isError, error, refetch } = useUsuarios();
  const activar = useActivarUsuario();
  const desactivar = useDesactivarUsuario();

  // Fila con una mutación en curso (para mostrar el spinner en su botón)
  const idProcesando = activar.isPending
    ? (activar.variables ?? null)
    : desactivar.isPending
      ? (desactivar.variables ?? null)
      : null;

  const columnas = useMemo(
    () =>
      crearColumnasUsuarios({
        idSesion,
        idProcesando,
        onActivar: (u: UserPublic) => {
          desactivar.reset();
          activar.mutate(u.id);
        },
        onDesactivar: (u: UserPublic) => {
          activar.reset();
          desactivar.mutate(u.id);
        },
      }),
    // mutate y reset son estables; las columnas cambian con la sesión o la fila en proceso
    [idSesion, idProcesando],
  );

  const errorMutacion = activar.error ?? desactivar.error;

  return (
    <section className="space-y-4">
      <PageHeader
        titulo="Usuarios"
        descripcion="Activá o desactivá cuentas. Un usuario desactivado no puede iniciar sesión."
      />

      {errorMutacion && (
        <EstadoError
          titulo="No se pudo actualizar el usuario"
          mensaje={handleApiError(errorMutacion)}
        />
      )}

      {isPending ? (
        <SkeletonFilas filas={5} />
      ) : isError ? (
        <EstadoError
          titulo="No se pudieron cargar los usuarios"
          mensaje={handleApiError(error)}
          onRetry={() => void refetch()}
        />
      ) : data.length === 0 ? (
        <EstadoVacio titulo="No hay usuarios registrados" />
      ) : (
        <DataTable
          data={data}
          columns={columnas}
          placeholderBusqueda="Buscar por usuario, nombre o email…"
          getRowId={(u) => String(u.id)}
        />
      )}
    </section>
  );
}

export default AdminUsuariosPage;
