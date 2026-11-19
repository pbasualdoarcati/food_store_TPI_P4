import type { ColumnDef } from '@tanstack/react-table';
import RowActions from '../../../shared/components/RowActions';
import type { Categoria } from '../types';

export interface AccionesCategoria {
  onEditar: (categoria: Categoria) => void;
  onEliminar: (categoria: Categoria) => void;
}

// Fábrica de columnas: recibe las acciones de la página con su tipo exacto
export function crearColumnasCategorias({
  onEditar,
  onEliminar,
}: AccionesCategoria): ColumnDef<Categoria>[] {
  return [
    {
      accessorKey: 'id',
      header: 'N.º',
      meta: { className: 'w-16 text-slate-500' },
    },
    {
      accessorKey: 'nombre',
      header: 'Nombre',
      cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
    },
    {
      accessorKey: 'descripcion',
      header: 'Descripción',
      cell: ({ getValue }) =>
        getValue<string | null>() ?? <span className="text-slate-400">—</span>,
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
        />
      ),
    },
  ];
}
