import BadgeEstado from '../../../shared/ui/BadgeEstado';
import Button from '../../../shared/ui/Button';
import { formatearFecha, formatoPrecio } from '../../../shared/utils/formato';
import { useAuthStore } from '../../../store/authStore';
import type { Pedido } from '../types';

interface TarjetaPedidoProps {
  pedido: Pedido;
  onVerDetalle: () => void;
  onCancelar: () => void;
}

// Resumen de un pedido propio en "Mis pedidos"
function TarjetaPedido({ pedido, onVerDetalle, onCancelar }: TarjetaPedidoProps) {
  const usuarioId = useAuthStore((s) => s.usuario?.id);
  const unidades = pedido.items.reduce((suma, item) => suma + item.cantidad, 0);

  return (
    <li className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-slate-800">Pedido #{pedido.id}</h2>
          <BadgeEstado estado={pedido.estado} />
        </div>
        <p className="text-sm text-slate-500">
          {formatearFecha(pedido.created_at)} · {unidades} unidad(es) ·{' '}
          <span className="line-clamp-1 inline">{pedido.direccion_entrega}</span>
        </p>
      </div>

      <div className="flex items-center gap-3">
        <p className="text-lg font-bold whitespace-nowrap">{formatoPrecio.format(pedido.total)}</p>
        <Button variante="secundario" onClick={onVerDetalle}>
          Ver detalle
        </Button>
        {/* RN-04: el dueño solo cancela sus pedidos en PENDIENTE */}
        {pedido.estado === 'PENDIENTE' && pedido.usuario_id === usuarioId && (
          <Button variante="peligro" onClick={onCancelar}>
            Cancelar
          </Button>
        )}
      </div>
    </li>
  );
}

export default TarjetaPedido;
