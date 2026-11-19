import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { handleApiError } from '../../../shared/api/handleApiError';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import EstadoError from '../../../shared/components/EstadoError';
import EstadoVacio from '../../../shared/components/EstadoVacio';
import PageHeader from '../../../shared/components/PageHeader';
import Paginacion from '../../../shared/components/Paginacion';
import { SkeletonFilas } from '../../../shared/components/Skeleton';
import Modal from '../../../shared/ui/Modal';
import { primaryButtonClass } from '../../../shared/ui/styles';
import PedidoDetalle from '../components/PedidoDetalle';
import TarjetaPedido from '../components/TarjetaPedido';
import { useCancelarPedido } from '../hooks/useCancelarPedido';
import { usePedidos } from '../hooks/usePedidos';
import type { EstadoPedidoCreado } from '../types';

const POR_PAGINA = 10;

function esEstadoPedidoCreado(estado: unknown): estado is EstadoPedidoCreado {
  return typeof estado === 'object' && estado !== null && 'pedidoCreado' in estado;
}

function MisPedidosPage() {
  const location = useLocation();
  const pedidoCreado: unknown = location.state;
  const [pagina, setPagina] = useState(0);
  // Se guardan ids (no objetos) para leer siempre la versión fresca de la caché
  const [idDetalle, setIdDetalle] = useState<number | null>(null);
  const [idACancelar, setIdACancelar] = useState<number | null>(null);

  const { data, isPending, isError, error, refetch, isPlaceholderData } = usePedidos({
    skip: pagina * POR_PAGINA,
    limit: POR_PAGINA,
  });
  const cancelar = useCancelarPedido();

  const pedidoDetalle = data?.items.find((p) => p.id === idDetalle) ?? null;

  const pedirCancelacion = (id: number) => {
    cancelar.reset();
    setIdACancelar(id);
  };

  const confirmarCancelacion = () => {
    if (idACancelar === null) return;
    cancelar.mutate(idACancelar, { onSuccess: () => setIdACancelar(null) });
  };

  return (
    <section className="space-y-4">
      <PageHeader titulo="Mis pedidos" descripcion="Seguí el estado de tus pedidos." />

      {esEstadoPedidoCreado(pedidoCreado) && (
        <p role="status" className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
          ¡Listo! Tu pedido #{pedidoCreado.pedidoCreado} fue registrado y está pendiente.
        </p>
      )}

      {isPending ? (
        <SkeletonFilas filas={4} />
      ) : isError ? (
        <EstadoError
          titulo="No se pudieron cargar tus pedidos"
          mensaje={handleApiError(error)}
          onRetry={() => void refetch()}
        />
      ) : data.items.length === 0 ? (
        <EstadoVacio
          icono="🧾"
          titulo="Todavía no hiciste pedidos"
          accion={
            <Link to="/" className={primaryButtonClass}>
              Ir al catálogo
            </Link>
          }
        />
      ) : (
        <>
          <ul className={`space-y-3 ${isPlaceholderData ? 'opacity-60' : ''}`}>
            {data.items.map((pedido) => (
              <TarjetaPedido
                key={pedido.id}
                pedido={pedido}
                onVerDetalle={() => setIdDetalle(pedido.id)}
                onCancelar={() => pedirCancelacion(pedido.id)}
              />
            ))}
          </ul>
          <Paginacion
            pagina={pagina}
            total={data.total}
            porPagina={POR_PAGINA}
            onCambiar={setPagina}
            deshabilitado={isPlaceholderData}
          />
        </>
      )}

      <Modal
        isOpen={pedidoDetalle !== null}
        titulo={`Pedido #${pedidoDetalle?.id ?? ''}`}
        onClose={() => setIdDetalle(null)}
        ancho="xl"
      >
        {pedidoDetalle && <PedidoDetalle pedido={pedidoDetalle} />}
      </Modal>

      <ConfirmModal
        isOpen={idACancelar !== null}
        titulo="Cancelar pedido"
        mensaje={`¿Cancelar el pedido #${idACancelar ?? ''}? Esta acción no se puede deshacer.`}
        textoConfirmar="Sí, cancelar"
        procesando={cancelar.isPending}
        error={cancelar.isError ? handleApiError(cancelar.error) : null}
        onConfirm={confirmarCancelacion}
        onClose={() => setIdACancelar(null)}
      />
    </section>
  );
}

export default MisPedidosPage;
