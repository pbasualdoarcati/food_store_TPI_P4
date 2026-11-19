import { useMemo, useState } from 'react';
import { handleApiError } from '../../../shared/api/handleApiError';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import DataTable from '../../../shared/components/DataTable';
import EstadoError from '../../../shared/components/EstadoError';
import EstadoVacio from '../../../shared/components/EstadoVacio';
import PageHeader from '../../../shared/components/PageHeader';
import { SkeletonFilas } from '../../../shared/components/Skeleton';
import Button from '../../../shared/ui/Button';
import { useCategorias } from '../../categorias/hooks/useCategorias';
import ProductoFormModal from '../components/ProductoFormModal';
import StockModal from '../components/StockModal';
import { crearColumnasProductos } from '../components/columnasProductos';
import {
  useActualizarStock,
  useCrearProducto,
  useEditarProducto,
  useEliminarProducto,
  useProductos,
} from '../hooks/useProductos';
import type { FiltrosProductos, Producto, ProductoInput, ProductoStockUpdate } from '../types';

// El panel pide hasta 100 y TanStack Table pagina del lado del cliente
const FILTROS_PANEL: FiltrosProductos = { skip: 0, limit: 100 };

type EstadoFormulario = { abierto: false } | { abierto: true; producto: Producto | null };

function AdminProductosPage() {
  const { data, isPending, isError, error, refetch } = useProductos(FILTROS_PANEL);
  const categorias = useCategorias();
  const crear = useCrearProducto();
  const editar = useEditarProducto();
  const actualizarStock = useActualizarStock();
  const eliminar = useEliminarProducto();

  const [formulario, setFormulario] = useState<EstadoFormulario>({ abierto: false });
  const [enStock, setEnStock] = useState<Producto | null>(null);
  const [aEliminar, setAEliminar] = useState<Producto | null>(null);

  const abrirFormulario = (producto: Producto | null) => {
    crear.reset();
    editar.reset();
    setFormulario({ abierto: true, producto });
  };
  const cerrarFormulario = () => setFormulario({ abierto: false });

  const abrirStock = (producto: Producto) => {
    actualizarStock.reset();
    setEnStock(producto);
  };

  const pedirEliminacion = (producto: Producto) => {
    eliminar.reset();
    setAEliminar(producto);
  };

  // Las acciones solo usan setters de estado y reset de mutaciones (referencias estables)
  const columnas = useMemo(
    () =>
      crearColumnasProductos({
        onEditar: abrirFormulario,
        onStock: abrirStock,
        onEliminar: pedirEliminacion,
      }),
    [],
  );

  const guardar = async (datos: ProductoInput) => {
    if (!formulario.abierto) return;
    try {
      if (formulario.producto) {
        await editar.mutateAsync({ id: formulario.producto.id, datos });
      } else {
        await crear.mutateAsync(datos);
      }
      cerrarFormulario();
    } catch {
      // 404 categoría inexistente / 409: el modal queda abierto mostrando el error
    }
  };

  const guardarStock = async (datos: ProductoStockUpdate) => {
    if (!enStock) return;
    try {
      await actualizarStock.mutateAsync({ id: enStock.id, datos });
      setEnStock(null);
    } catch {
      // El error se muestra dentro del modal
    }
  };

  const confirmarEliminacion = () => {
    if (!aEliminar) return;
    eliminar.mutate(aEliminar.id, { onSuccess: () => setAEliminar(null) });
  };

  const errorFormulario = formulario.abierto && formulario.producto ? editar.error : crear.error;

  return (
    <section>
      <PageHeader
        titulo="Productos"
        descripcion="Catálogo con precio, stock, disponibilidad y categoría."
        acciones={<Button onClick={() => abrirFormulario(null)}>+ Nuevo producto</Button>}
      />

      {isPending ? (
        <SkeletonFilas filas={6} />
      ) : isError ? (
        <EstadoError
          titulo="No se pudieron cargar los productos"
          mensaje={handleApiError(error)}
          onRetry={() => void refetch()}
        />
      ) : data.items.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay productos"
          mensaje="Creá el primero con “Nuevo producto”."
        />
      ) : (
        <DataTable
          data={data.items}
          columns={columnas}
          placeholderBusqueda="Buscar producto o categoría…"
          getRowId={(p) => String(p.id)}
        />
      )}

      {formulario.abierto && (
        <ProductoFormModal
          key={formulario.producto?.id ?? 'nuevo'}
          producto={formulario.producto}
          categorias={categorias.data ?? []}
          error={errorFormulario ? handleApiError(errorFormulario) : null}
          onSubmit={guardar}
          onClose={cerrarFormulario}
        />
      )}

      {enStock && (
        <StockModal
          key={enStock.id}
          producto={enStock}
          error={actualizarStock.isError ? handleApiError(actualizarStock.error) : null}
          onSubmit={guardarStock}
          onClose={() => setEnStock(null)}
        />
      )}

      <ConfirmModal
        isOpen={aEliminar !== null}
        titulo="Eliminar producto"
        mensaje={`¿Dar de baja el producto "${aEliminar?.nombre ?? ''}"? Dejará de verse en el catálogo.`}
        textoConfirmar="Eliminar"
        procesando={eliminar.isPending}
        error={eliminar.isError ? handleApiError(eliminar.error) : null}
        onConfirm={confirmarEliminacion}
        onClose={() => setAEliminar(null)}
      />
    </section>
  );
}

export default AdminProductosPage;
