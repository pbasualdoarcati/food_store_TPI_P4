import type { ColumnDef } from '@tanstack/react-table';
import RowActions from '../../../shared/components/RowActions';
import { formatoPrecio } from '../../../shared/utils/formato';
import type { Producto } from '../types';
import ImagenProducto from './ImagenProducto';

export interface AccionesProducto {
  onEditar: (producto: Producto) => void;
  onStock: (producto: Producto) => void;
  onEliminar: (producto: Producto) => void;
}

export function crearColumnasProductos({
  onEditar,
  onStock,
  onEliminar,
}: AccionesProducto): ColumnDef<Producto>[] {
  return [
    {
      accessorKey: 'nombre',
      header: 'Producto',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <ImagenProducto
            url={row.original.imagen_url}
            nombre={row.original.nombre}
            className="size-10 shrink-0 rounded-md text-base"
          />
          <div>
            <p className="font-medium">{row.original.nombre}</p>
            {row.original.descripcion && (
              <p className="line-clamp-1 text-xs text-slate-500">{row.original.descripcion}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      // Columna calculada: permite buscar y ordenar por el nombre de la categoría
      id: 'categoria',
      accessorFn: (p) => p.categoria.nombre,
      header: 'Categoría',
    },
    {
      accessorKey: 'precio_base',
      header: 'Precio',
      meta: { className: 'text-right whitespace-nowrap' },
      cell: ({ getValue }) => formatoPrecio.format(getValue<number>()),
    },
    {
      accessorKey: 'stock',
      header: 'Stock',
      meta: { className: 'text-right' },
      cell: ({ getValue }) => {
        const stock = getValue<number>();
        return <span className={stock === 0 ? 'font-medium text-red-600' : ''}>{stock}</span>;
      },
    },
    {
      accessorKey: 'disponible',
      header: 'Estado',
      cell: ({ getValue }) =>
        getValue<boolean>() ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            Disponible
          </span>
        ) : (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
            No disponible
          </span>
        ),
    },
    {
      id: 'acciones',
      header: 'Acciones',
      enableSorting: false,
      meta: { className: 'text-right' },
      cell: ({ row }) => (
        <RowActions
          onEdit={() => onEditar(row.original)}
          onDelete={() => onEliminar(row.original)}
        >
          <button
            type="button"
            onClick={() => onStock(row.original)}
            className="rounded px-2 py-1 text-sm font-medium text-amber-700 hover:bg-amber-50"
          >
            Stock
          </button>
        </RowActions>
      ),
    },
  ];
}
