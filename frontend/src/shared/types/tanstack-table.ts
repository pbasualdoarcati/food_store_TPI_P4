import type { RowData } from '@tanstack/react-table';

// Module augmentation: TanStack Table permite tipar lo que se guarda en columnDef.meta
declare module '@tanstack/react-table' {
  // TData y TValue deben coincidir con la declaración original para poder fusionarla
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string;
  }
}
