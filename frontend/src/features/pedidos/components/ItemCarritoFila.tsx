import { formatoPrecio } from '../../../shared/utils/formato';
import type { ItemCarrito } from '../../../store/cartStore';
import ImagenProducto from '../../productos/components/ImagenProducto';

interface ItemCarritoFilaProps {
  item: ItemCarrito;
  onCambiarCantidad: (cantidad: number) => void;
  onQuitar: () => void;
}

const botonCantidad =
  'flex size-8 items-center justify-center rounded-md bg-slate-100 text-lg font-medium hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40';

function ItemCarritoFila({ item, onCambiarCantidad, onQuitar }: ItemCarritoFilaProps) {
  const alcanzoStock = item.stock !== undefined && item.cantidad >= item.stock;

  return (
    <li className="flex flex-wrap items-center gap-4 p-4">
      <ImagenProducto
        url={item.imagen_url}
        nombre={item.nombre}
        className="size-16 shrink-0 rounded-md"
      />

      <div className="min-w-40 flex-1">
        <p className="font-medium text-slate-800">{item.nombre}</p>
        <p className="text-sm text-slate-500">{formatoPrecio.format(item.precio_unitario)} c/u</p>
        {alcanzoStock && (
          <p className="text-xs text-amber-700">Máximo disponible: {item.stock}</p>
        )}
      </div>

      <div className="flex items-center gap-2" aria-label={`Cantidad de ${item.nombre}`}>
        <button
          type="button"
          onClick={() => onCambiarCantidad(item.cantidad - 1)}
          disabled={item.cantidad <= 1}
          aria-label="Restar uno"
          className={botonCantidad}
        >
          −
        </button>
        <span className="w-8 text-center font-medium">{item.cantidad}</span>
        <button
          type="button"
          onClick={() => onCambiarCantidad(item.cantidad + 1)}
          disabled={alcanzoStock}
          aria-label="Sumar uno"
          className={botonCantidad}
        >
          +
        </button>
      </div>

      <p className="w-28 text-right font-semibold whitespace-nowrap">
        {formatoPrecio.format(item.precio_unitario * item.cantidad)}
      </p>

      <button
        type="button"
        onClick={onQuitar}
        className="rounded px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        Quitar
      </button>
    </li>
  );
}

export default ItemCarritoFila;
