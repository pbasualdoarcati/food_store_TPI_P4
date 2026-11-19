import { formatoPrecio } from '../../../shared/utils/formato';
import Button from '../../../shared/ui/Button';
import { useCartStore } from '../../../store/cartStore';
import type { Producto } from '../types';
import ImagenProducto from './ImagenProducto';

interface ProductoCardProps {
  producto: Producto;
}

function ProductoCard({ producto }: ProductoCardProps) {
  const agregar = useCartStore((s) => s.agregar);
  const enCarrito = useCartStore(
    (s) => s.items.find((i) => i.producto_id === producto.id)?.cantidad ?? 0,
  );

  const sinStock = producto.stock === 0;
  const vendible = producto.disponible && !sinStock;
  const alcanzoElStock = enCarrito >= producto.stock;

  const agregarAlCarrito = () =>
    agregar({
      producto_id: producto.id,
      nombre: producto.nombre,
      precio_unitario: producto.precio_base,
      imagen_url: producto.imagen_url,
      stock: producto.stock,
    });

  return (
    <article className="flex flex-col overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-100 transition hover:shadow-md">
      <ImagenProducto
        url={producto.imagen_url}
        nombre={producto.nombre}
        className="aspect-video w-full"
      />

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-semibold text-slate-800">{producto.nombre}</h2>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {producto.categoria.nombre}
          </span>
        </div>

        {producto.descripcion && (
          <p className="line-clamp-2 text-sm text-slate-500">{producto.descripcion}</p>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <p className="text-lg font-bold text-slate-800">
            {formatoPrecio.format(producto.precio_base)}
          </p>
          <p className={`text-xs ${vendible ? 'text-slate-500' : 'font-medium text-red-600'}`}>
            {!producto.disponible ? 'No disponible' : sinStock ? 'Sin stock' : `Stock: ${producto.stock}`}
          </p>
        </div>

        <Button onClick={agregarAlCarrito} disabled={!vendible || alcanzoElStock}>
          {alcanzoElStock && vendible ? 'Máximo en el carrito' : 'Agregar al carrito'}
        </Button>
        {enCarrito > 0 && (
          <p className="text-center text-xs text-orange-700">En el carrito: {enCarrito}</p>
        )}
      </div>
    </article>
  );
}

export default ProductoCard;
