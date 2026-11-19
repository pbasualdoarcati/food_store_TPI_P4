import { Link, useNavigate } from 'react-router-dom';
import { handleApiError } from '../../../shared/api/handleApiError';
import EstadoVacio from '../../../shared/components/EstadoVacio';
import PageHeader from '../../../shared/components/PageHeader';
import Card from '../../../shared/ui/Card';
import { primaryButtonClass } from '../../../shared/ui/styles';
import { formatoPrecio } from '../../../shared/utils/formato';
import { useCartStore } from '../../../store/cartStore';
import CheckoutForm from '../components/CheckoutForm';
import { useCrearPedido } from '../hooks/useCrearPedido';
import type { DatosCheckout, EstadoPedidoCreado } from '../types';

function CheckoutPage() {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const total = useCartStore((s) => s.total());
  const vaciar = useCartStore((s) => s.vaciar);
  const crearPedido = useCrearPedido();

  const confirmar = async (datos: DatosCheckout) => {
    try {
      const pedido = await crearPedido.mutateAsync({
        ...datos,
        items: items.map(({ producto_id, cantidad }) => ({ producto_id, cantidad })),
      });
      const estado: EstadoPedidoCreado = { pedidoCreado: pedido.id };
      navigate('/mis-pedidos', { replace: true, state: estado });
      vaciar();
    } catch {
      // 400 stock insuficiente / no disponible, 404 producto dado de baja: se muestra arriba del form
    }
  };

  if (items.length === 0) {
    return (
      <section>
        <PageHeader titulo="Confirmar pedido" />
        <EstadoVacio
          icono="🛒"
          titulo="No hay productos para confirmar"
          mensaje="Tu carrito está vacío."
          accion={
            <Link to="/" className={primaryButtonClass}>
              Ir al catálogo
            </Link>
          }
        />
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        titulo="Confirmar pedido"
        descripcion="Indicá dónde lo entregamos y cómo vas a pagar."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="p-6">
          <CheckoutForm
            error={crearPedido.isError ? handleApiError(crearPedido.error) : null}
            onSubmit={confirmar}
          />
        </Card>

        <Card className="h-fit space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Tu pedido</h2>
            <Link to="/carrito" className="text-sm text-orange-600 hover:underline">
              Editar
            </Link>
          </div>
          <ul className="space-y-2 text-sm">
            {items.map((item) => (
              <li key={item.producto_id} className="flex justify-between gap-2 text-slate-600">
                <span className="truncate">
                  {item.cantidad} × {item.nombre}
                </span>
                <span className="whitespace-nowrap">
                  {formatoPrecio.format(item.precio_unitario * item.cantidad)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold">
            <span>Total estimado</span>
            <span>{formatoPrecio.format(total)}</span>
          </div>
          <p className="text-xs text-slate-400">
            El total final lo calcula el sistema con los precios vigentes al confirmar.
          </p>
        </Card>
      </div>
    </section>
  );
}

export default CheckoutPage;
