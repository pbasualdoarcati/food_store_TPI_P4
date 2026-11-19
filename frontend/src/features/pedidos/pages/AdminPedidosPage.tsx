import { useCallback, useState } from 'react';
import { handleApiError } from '../../../shared/api/handleApiError';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import EstadoError from '../../../shared/components/EstadoError';
import EstadoVacio from '../../../shared/components/EstadoVacio';
import PageHeader from '../../../shared/components/PageHeader';
import { SkeletonFilas } from '../../../shared/components/Skeleton';
import Modal from '../../../shared/ui/Modal';
import { inputClass } from '../../../shared/ui/styles';
import PedidoDetalle from '../components/PedidoDetalle';
import TablaPedidos from '../components/TablaPedidos';
import { useCambiarEstadoPedido } from '../hooks/useCambiarEstadoPedido';
import { usePedidos } from '../hooks/usePedidos';
import type { EstadoPedido, Pedido } from '../types';
import { ESTADOS_PEDIDO, ETIQUETA_ESTADO, esEstadoPedido } from '../utils/estados';

// El panel pide hasta 100 y la tabla pagina del lado del cliente
const LIMITE_PANEL = 100;

function AdminPedidosPage() {
  const [estado, setEstado] = useState<EstadoPedido | undefined>(undefined);
  const [idDetalle, setIdDetalle] = useState<number | null>(null);
  const [idACancelar, setIdACancelar] = useState<number | null>(null);

  // El filtro viaja como query param ?estado= al backend
  const { data, isPending, isError, error, refetch } = usePedidos({
    skip: 0,
    limit: LIMITE_PANEL,
    estado,
  });
  const cambiarEstado = useCambiarEstadoPedido();

  const pedidoDetalle = data?.items.find((p) => p.id === idDetalle) ?? null;
  const idProcesando = cambiarEstado.isPending ? (cambiarEstado.variables?.id ?? null) : null;

  const verDetalle = useCallback((pedido: Pedido) => setIdDetalle(pedido.id), []);

  const { mutate, reset } = cambiarEstado;
  const solicitarCambio = useCallback(
    (pedido: Pedido, destino: EstadoPedido) => {
      reset();
      // Cancelar restituye stock y es terminal: se confirma antes
      if (destino === 'CANCELADO') {
        setIdACancelar(pedido.id);
        return;
      }
      mutate({ id: pedido.id, estado: destino });
    },
    [mutate, reset],
  );

  const confirmarCancelacion = () => {
    if (idACancelar === null) return;
    mutate(
      { id: idACancelar, estado: 'CANCELADO' },
      { onSuccess: () => setIdACancelar(null) },
    );
  };

  return (
    <section className="space-y-4">
      <PageHeader
        titulo="Pedidos"
        descripcion="Avanzá o cancelá los pedidos según su estado."
        acciones={
          <select
            value={estado ?? ''}
            onChange={(e) => setEstado(esEstadoPedido(e.target.value) ? e.target.value : undefined)}
            aria-label="Filtrar por estado"
            className={`${inputClass} w-52`}
          >
            <option value="">Todos los estados</option>
            {ESTADOS_PEDIDO.map((e) => (
              <option key={e} value={e}>
                {ETIQUETA_ESTADO[e]}
              </option>
            ))}
          </select>
        }
      />

      {/* Error de un avance (el de cancelar se muestra en su modal) */}
      {cambiarEstado.isError && idACancelar === null && (
        <EstadoError
          titulo="No se pudo cambiar el estado"
          mensaje={handleApiError(cambiarEstado.error)}
        />
      )}

      {isPending ? (
        <SkeletonFilas filas={6} />
      ) : isError ? (
        <EstadoError
          titulo="No se pudieron cargar los pedidos"
          mensaje={handleApiError(error)}
          onRetry={() => void refetch()}
        />
      ) : data.items.length === 0 ? (
        <EstadoVacio
          icono="🧾"
          titulo={estado ? `No hay pedidos en estado ${ETIQUETA_ESTADO[estado]}` : 'Todavía no hay pedidos'}
        />
      ) : (
        <TablaPedidos
          pedidos={data.items}
          idProcesando={idProcesando}
          onVerDetalle={verDetalle}
          onCambiarEstado={solicitarCambio}
        />
      )}

      <Modal
        isOpen={pedidoDetalle !== null}
        titulo={`Pedido #${pedidoDetalle?.id ?? ''} · Usuario #${pedidoDetalle?.usuario_id ?? ''}`}
        onClose={() => setIdDetalle(null)}
        ancho="xl"
      >
        {pedidoDetalle && <PedidoDetalle pedido={pedidoDetalle} />}
      </Modal>

      <ConfirmModal
        isOpen={idACancelar !== null}
        titulo="Cancelar pedido"
        mensaje={`¿Cancelar el pedido #${idACancelar ?? ''}? Se restituirá el stock de sus productos.`}
        textoConfirmar="Sí, cancelar"
        procesando={cambiarEstado.isPending}
        error={cambiarEstado.isError ? handleApiError(cambiarEstado.error) : null}
        onConfirm={confirmarCancelacion}
        onClose={() => setIdACancelar(null)}
      />
    </section>
  );
}

export default AdminPedidosPage;
