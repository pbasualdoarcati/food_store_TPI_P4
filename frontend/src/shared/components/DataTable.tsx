import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table';
import { useState } from 'react';
import { inputClass, secondaryButtonClass } from '../ui/styles';

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  placeholderBusqueda?: string;
  porPagina?: number;
  getRowId?: (fila: T) => string;
}

const flechas = { asc: '▲', desc: '▼' } as const;

// Tabla genérica: orden, búsqueda global y paginación del lado del cliente
// (el panel pide limit=100 y TanStack Table pagina en memoria)
function DataTable<T>({
  data,
  columns,
  placeholderBusqueda = 'Buscar…',
  porPagina = 10,
  getRowId,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: porPagina,
  });

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const filas = table.getRowModel().rows;
  const totalFiltradas = table.getFilteredRowModel().rows.length;
  const columnasVisibles = table.getVisibleLeafColumns().length;

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={globalFilter}
        onChange={(e) => table.setGlobalFilter(e.target.value)}
        placeholder={placeholderBusqueda}
        aria-label={placeholderBusqueda}
        className={`${inputClass} max-w-xs`}
      />

      <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-slate-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs tracking-wide text-slate-500 uppercase">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const orden = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={`px-4 py-3 ${header.column.columnDef.meta?.className ?? ''}`}
                      aria-sort={
                        orden ? (orden === 'asc' ? 'ascending' : 'descending') : undefined
                      }
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 uppercase hover:text-slate-800"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span className="w-3 text-orange-600">{orden ? flechas[orden] : ''}</span>
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={columnasVisibles} className="px-4 py-8 text-center text-slate-500">
                  {globalFilter
                    ? `Ningún resultado coincide con “${globalFilter}”.`
                    : 'No hay registros para mostrar.'}
                </td>
              </tr>
            ) : (
              filas.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`px-4 py-3 ${cell.column.columnDef.meta?.className ?? ''}`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <span>{totalFiltradas} resultado(s)</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className={secondaryButtonClass}
          >
            Anterior
          </button>
          <span>
            Página {pagination.pageIndex + 1} de {Math.max(table.getPageCount(), 1)}
          </span>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className={secondaryButtonClass}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}

export default DataTable;
