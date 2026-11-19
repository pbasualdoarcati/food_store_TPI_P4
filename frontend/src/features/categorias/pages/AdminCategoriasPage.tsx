import { useMemo, useState } from 'react';
import { handleApiError } from '../../../shared/api/handleApiError';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import DataTable from '../../../shared/components/DataTable';
import EstadoError from '../../../shared/components/EstadoError';
import EstadoVacio from '../../../shared/components/EstadoVacio';
import PageHeader from '../../../shared/components/PageHeader';
import { SkeletonFilas } from '../../../shared/components/Skeleton';
import Button from '../../../shared/ui/Button';
import CategoriaFormModal from '../components/CategoriaFormModal';
import { crearColumnasCategorias } from '../components/columnasCategorias';
import {
  useCategorias,
  useCrearCategoria,
  useEditarCategoria,
  useEliminarCategoria,
} from '../hooks/useCategorias';
import type { Categoria, CategoriaInput } from '../types';

// Modal abierto: alta (categoria null) o edición
type EstadoFormulario = { abierto: false } | { abierto: true; categoria: Categoria | null };

function AdminCategoriasPage() {
  const { data, isLoading, isError, error, refetch } = useCategorias();
  const crear = useCrearCategoria();
  const editar = useEditarCategoria();
  const eliminar = useEliminarCategoria();

  const [formulario, setFormulario] = useState<EstadoFormulario>({ abierto: false });
  const [aEliminar, setAEliminar] = useState<Categoria | null>(null);

  const abrirFormulario = (categoria: Categoria | null) => {
    crear.reset();
    editar.reset();
    setFormulario({ abierto: true, categoria });
  };
  const cerrarFormulario = () => setFormulario({ abierto: false });

  const pedirEliminacion = (categoria: Categoria) => {
    eliminar.reset();
    setAEliminar(categoria);
  };

  const columnas = useMemo(
    () => crearColumnasCategorias({ onEditar: abrirFormulario, onEliminar: pedirEliminacion }),
    // Las acciones solo usan setters de estado y reset de mutaciones (referencias estables)
    [],
  );

  const guardar = async (datos: CategoriaInput) => {
    if (!formulario.abierto) return;
    try {
      if (formulario.categoria) {
        await editar.mutateAsync({ id: formulario.categoria.id, datos });
      } else {
        await crear.mutateAsync(datos);
      }
      cerrarFormulario();
    } catch {
      // 409 nombre duplicado / 404: el modal queda abierto mostrando el error
    }
  };

  const confirmarEliminacion = () => {
    if (!aEliminar) return;
    eliminar.mutate(aEliminar.id, { onSuccess: () => setAEliminar(null) });
  };

  const errorFormulario =
    formulario.abierto && formulario.categoria ? editar.error : crear.error;

  return (
    <section>
      <PageHeader
        titulo="Categorías"
        descripcion="Alta, edición y baja lógica de las categorías del catálogo."
        acciones={<Button onClick={() => abrirFormulario(null)}>+ Nueva categoría</Button>}
      />

      {isLoading ? (
        <SkeletonFilas filas={5} />
      ) : isError ? (
        <EstadoError
          titulo="No se pudieron cargar las categorías"
          mensaje={handleApiError(error)}
          onRetry={() => void refetch()}
        />
      ) : !data || data.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay categorías"
          mensaje="Creá la primera con “Nueva categoría”."
        />
      ) : (
        <DataTable
          data={data}
          columns={columnas}
          placeholderBusqueda="Buscar categoría…"
          getRowId={(c) => String(c.id)}
        />
      )}

      {formulario.abierto && (
        <CategoriaFormModal
          key={formulario.categoria?.id ?? 'nueva'}
          categoria={formulario.categoria}
          error={errorFormulario ? handleApiError(errorFormulario) : null}
          onSubmit={guardar}
          onClose={cerrarFormulario}
        />
      )}

      <ConfirmModal
        isOpen={aEliminar !== null}
        titulo="Eliminar categoría"
        mensaje={`¿Dar de baja la categoría "${aEliminar?.nombre ?? ''}"? Sus productos no se ocultan automáticamente.`}
        textoConfirmar="Eliminar"
        procesando={eliminar.isPending}
        error={eliminar.isError ? handleApiError(eliminar.error) : null}
        onConfirm={confirmarEliminacion}
        onClose={() => setAEliminar(null)}
      />
    </section>
  );
}

export default AdminCategoriasPage;
