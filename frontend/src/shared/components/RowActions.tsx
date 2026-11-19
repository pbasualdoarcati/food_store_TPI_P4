import type { ReactNode } from 'react';

interface RowActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  children?: ReactNode; // acciones extra de la fila (p. ej. "Stock")
}

function RowActions({ onEdit, onDelete, children }: RowActionsProps) {
  return (
    <div className="flex justify-end gap-1 whitespace-nowrap">
      <button
        type="button"
        onClick={onEdit}
        className="rounded px-2 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50"
      >
        Editar
      </button>
      {children}
      <button
        type="button"
        onClick={onDelete}
        className="rounded px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        Eliminar
      </button>
    </div>
  );
}

export default RowActions;
