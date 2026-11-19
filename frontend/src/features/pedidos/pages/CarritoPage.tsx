import { useState } from 'react';
import { Link } from 'react-router-dom';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import EstadoVacio from '../../../shared/components/EstadoVacio';
import PageHeader from '../../../shared/components/PageHeader';
import Button from '../../../shared/ui/Button';
import Card from '../../../shared/ui/Card';
import { primaryButtonClass } from '../../../shared/ui/styles';
import { formatoPrecio } from '../../../shared/utils/formato';
import { useCartStore } from '../../../store/cartStore';
import ItemCarritoFila from '../components/ItemCarritoFila';

// El carrito es estado del cliente (Zustand + persist): sobrevive a la recarga
function CarritoPage() {
  const items = useCartStore((s) => s.items);
  const total = useCartStore((s) => s.total());
  const cantidadItems = useCartStore((s) => s.cantidadItems());
  const cambiarCantidad = useCartStore((s) => s.cambiarCantidad);
  const quitar = useCartStore((s) => s.quitar);
  const vaciar = useCartStore((s) => s.vaciar);
  const [confirmarVaciar, setConfirmarVaciar] = useState(false);

  if (items.length === 0) {
    return (
      <section>
        <PageHeader titulo="Carrito" />
        <EstadoVacio
          icono="🛒"
          titulo="Tu carrito está vacío"
          mensaje="Agregá productos desde el catálogo."
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
        titulo="Carrito"
        descripcion={`${cantidadItems} unidad(es) en ${items.length} producto(s).`}
        acciones={
          <Button variante="secundario" onClick={() => setConfirmarVaciar(true)}>
            Vaciar carrito
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <ul className="divide-y divide-slate-100 rounded-lg bg-white shadow-sm ring-1 ring-slate-100">
          {items.map((item) => (
            <ItemCarritoFila
              key={item.producto_id}
              item={item}
              onCambiarCantidad={(cantidad) => cambiarCantidad(item.producto_id, cantidad)}
              onQuitar={() => quitar(item.producto_id)}
            />
          ))}
        </ul>

        <Card className="h-fit space-y-4 p-5">
          <h2 className="text-lg font-semibold">Resumen</h2>
          <dl className="space-y-2 text-sm">
            {items.map((item) => (
              <div key={item.producto_id} className="flex justify-between gap-2 text-slate-600">
                <dt className="truncate">
                  {item.cantidad} × {item.nombre}
                </dt>
                <dd className="whitespace-nowrap">
                  {formatoPrecio.format(item.precio_unitario * item.cantidad)}
                </dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd>{formatoPrecio.format(total)}</dd>
            </div>
          </dl>
          <Link to="/checkout" className={`${primaryButtonClass} w-full`}>
            Continuar con el pedido
          </Link>
          <Link to="/" className="block text-center text-sm text-orange-600 hover:underline">
            Seguir comprando
          </Link>
        </Card>
      </div>

      <ConfirmModal
        isOpen={confirmarVaciar}
        titulo="Vaciar carrito"
        mensaje="¿Quitar todos los productos del carrito?"
        textoConfirmar="Vaciar"
        procesando={false}
        error={null}
        onConfirm={() => {
          vaciar();
          setConfirmarVaciar(false);
        }}
        onClose={() => setConfirmarVaciar(false)}
      />
    </section>
  );
}

export default CarritoPage;
