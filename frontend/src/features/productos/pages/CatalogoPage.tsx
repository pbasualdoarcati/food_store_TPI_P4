import { useState } from 'react';
import { handleApiError } from '../../../shared/api/handleApiError';
import EstadoError from '../../../shared/components/EstadoError';
import EstadoVacio from '../../../shared/components/EstadoVacio';
import PageHeader from '../../../shared/components/PageHeader';
import Paginacion from '../../../shared/components/Paginacion';
import { SkeletonGrid } from '../../../shared/components/Skeleton';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { useCategorias } from '../../categorias/hooks/useCategorias';
import FiltrosCatalogo from '../components/FiltrosCatalogo';
import ProductoCard from '../components/ProductoCard';
import { useProductos } from '../hooks/useProductos';
import type { FiltrosProductos } from '../types';

const POR_PAGINA = 12;

function CatalogoPage() {
  const [pagina, setPagina] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaId, setCategoriaId] = useState<number | undefined>(undefined);
  const busquedaDemorada = useDebounce(busqueda.trim(), 300);

  // Paginación en el servidor: skip = página × limit
  const filtros: FiltrosProductos = {
    skip: pagina * POR_PAGINA,
    limit: POR_PAGINA,
    search: busquedaDemorada || undefined,
    categoria_id: categoriaId,
  };

  const { data, isPending, isError, error, refetch, isPlaceholderData } = useProductos(filtros);
  const categorias = useCategorias();

  const cambiarBusqueda = (valor: string) => {
    setBusqueda(valor);
    setPagina(0);
  };

  const cambiarCategoria = (id: number | undefined) => {
    setCategoriaId(id);
    setPagina(0);
  };

  const hayFiltros = Boolean(busquedaDemorada) || categoriaId !== undefined;

  return (
    <section className="space-y-6">
      <PageHeader titulo="Catálogo" descripcion="Elegí tus productos y armá tu pedido." />

      <FiltrosCatalogo
        busqueda={busqueda}
        categoriaId={categoriaId}
        categorias={categorias.data ?? []}
        onBusqueda={cambiarBusqueda}
        onCategoria={cambiarCategoria}
      />

      {isPending ? (
        <SkeletonGrid cantidad={8} />
      ) : isError ? (
        <EstadoError
          titulo="No se pudo cargar el catálogo"
          mensaje={handleApiError(error)}
          onRetry={() => void refetch()}
        />
      ) : data.items.length === 0 ? (
        <EstadoVacio
          icono="🔍"
          titulo={hayFiltros ? 'No hay productos que coincidan' : 'Todavía no hay productos'}
          mensaje={hayFiltros ? 'Probá con otra búsqueda o categoría.' : undefined}
        />
      ) : (
        <>
          <div
            className={`grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${
              isPlaceholderData ? 'opacity-60' : ''
            }`}
          >
            {data.items.map((producto) => (
              <ProductoCard key={producto.id} producto={producto} />
            ))}
          </div>
          <Paginacion
            pagina={pagina}
            total={data.total}
            porPagina={POR_PAGINA}
            onCambiar={setPagina}
            deshabilitado={isPlaceholderData}
          />
        </>
      )}
    </section>
  );
}

export default CatalogoPage;
