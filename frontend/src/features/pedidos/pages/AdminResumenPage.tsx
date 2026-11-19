import { handleApiError } from '../../../shared/api/handleApiError';
import EstadoError from '../../../shared/components/EstadoError';
import PageHeader from '../../../shared/components/PageHeader';
import Skeleton from '../../../shared/components/Skeleton';
import Button from '../../../shared/ui/Button';
import { formatoPrecio } from '../../../shared/utils/formato';
import TarjetaResumen from '../components/TarjetaResumen';
import { useResumenPedidos } from '../hooks/useResumenPedidos';

function AdminResumenPage() {
  const { data, isPending, isError, error, refetch, isFetching } = useResumenPedidos();

  return (
    <section>
      <PageHeader
        titulo="Resumen del negocio"
        descripcion="Indicadores de los pedidos."
        acciones={
          <Button variante="secundario" onClick={() => void refetch()} cargando={isFetching}>
            Actualizar
          </Button>
        }
      />

      {isPending ? (
        <div role="status" aria-label="Cargando" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : isError ? (
        <EstadoError
          titulo="No se pudo cargar el resumen"
          mensaje={handleApiError(error)}
          onRetry={() => void refetch()}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TarjetaResumen titulo="Pendientes" valor={String(data.pendientes)} icono="⏳" tono="amber" descripcion="Esperan ser preparados" />
          <TarjetaResumen titulo="En preparación" valor={String(data.en_preparacion)} icono="👨‍🍳" tono="blue" descripcion="Se están preparando" />
          <TarjetaResumen titulo="Entregados" valor={String(data.entregados)} icono="✅" tono="green" descripcion="Pedidos completados" />
          <TarjetaResumen titulo="Cancelados" valor={String(data.cancelados)} icono="✖️" tono="slate" descripcion="Con stock restituido" />
          <TarjetaResumen titulo="Pedidos de hoy" valor={String(data.pedidos_hoy)} icono="📅" tono="orange" descripcion="Creados en el día" />
          <TarjetaResumen
            titulo="Ingresos entregados"
            valor={formatoPrecio.format(data.ingresos_entregados)}
            icono="💰"
            tono="emerald"
            descripcion="Suma de los pedidos entregados"
          />
        </div>
      )}
    </section>
  );
}

export default AdminResumenPage;
