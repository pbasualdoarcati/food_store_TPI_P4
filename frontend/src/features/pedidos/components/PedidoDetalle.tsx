import BadgeEstado from '../../../shared/ui/BadgeEstado';
import { formatearFecha, formatoPrecio } from '../../../shared/utils/formato';
import type { Pedido } from '../types';
import { ETIQUETA_FORMA_PAGO } from '../utils/estados';

interface PedidoDetalleProps {
  pedido: Pedido;
}

// Líneas del pedido con la copia inmutable de nombre y precio (RN-05)
function PedidoDetalle({ pedido }: PedidoDetalleProps) {
  return (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        <dt className="text-slate-500">Estado</dt>
        <dd>
          <BadgeEstado estado={pedido.estado} />
        </dd>
        <dt className="text-slate-500">Fecha</dt>
        <dd>{formatearFecha(pedido.created_at)}</dd>
        <dt className="text-slate-500">Última actualización</dt>
        <dd>{formatearFecha(pedido.updated_at)}</dd>
        <dt className="text-slate-500">Forma de pago</dt>
        <dd>{ETIQUETA_FORMA_PAGO[pedido.forma_pago]}</dd>
        <dt className="text-slate-500">Dirección de entrega</dt>
        <dd className="break-words">{pedido.direccion_entrega}</dd>
        {pedido.notas && (
          <>
            <dt className="text-slate-500">Notas</dt>
            <dd className="break-words">{pedido.notas}</dd>
          </>
        )}
      </dl>

      <div className="overflow-x-auto rounded-md ring-1 ring-slate-200">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2 text-right">Precio</th>
              <th className="px-3 py-2 text-right">Cant.</th>
              <th className="px-3 py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {pedido.items.map((item) => (
              <tr key={item.producto_id} className="border-t border-slate-100">
                <td className="px-3 py-2">{item.nombre_producto}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {formatoPrecio.format(item.precio_unitario)}
                </td>
                <td className="px-3 py-2 text-right">{item.cantidad}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {formatoPrecio.format(item.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-semibold">
              <td className="px-3 py-2" colSpan={3}>
                Total
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                {formatoPrecio.format(pedido.total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default PedidoDetalle;
