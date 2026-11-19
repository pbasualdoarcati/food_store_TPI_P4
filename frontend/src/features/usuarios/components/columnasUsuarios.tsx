import type { ColumnDef } from '@tanstack/react-table';
import Button from '../../../shared/ui/Button';
import { formatearFecha } from '../../../shared/utils/formato';
import { ETIQUETA_ROL } from '../../auth/types';
import type { Rol, UserPublic } from '../types';

export interface AccionesUsuario {
  idSesion: number | undefined; // el admin no puede desactivarse a sí mismo
  idProcesando: number | null;
  onActivar: (usuario: UserPublic) => void;
  onDesactivar: (usuario: UserPublic) => void;
}

export function crearColumnasUsuarios({
  idSesion,
  idProcesando,
  onActivar,
  onDesactivar,
}: AccionesUsuario): ColumnDef<UserPublic>[] {
  return [
    {
      accessorKey: 'username',
      header: 'Usuario',
      cell: ({ row, getValue }) => (
        <span className="font-medium">
          @{getValue<string>()}
          {row.original.id === idSesion && (
            <span className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">
              vos
            </span>
          )}
        </span>
      ),
    },
    { accessorKey: 'full_name', header: 'Nombre' },
    { accessorKey: 'email', header: 'Email' },
    {
      accessorKey: 'role',
      header: 'Rol',
      cell: ({ getValue }) => {
        const rol = getValue<Rol>();
        return (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              rol === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {ETIQUETA_ROL[rol]}
          </span>
        );
      },
    },
    {
      // Columna calculada para que la búsqueda y el orden usen el texto visible
      id: 'estado',
      accessorFn: (u) => (u.disabled ? 'Desactivado' : 'Activo'),
      header: 'Estado',
      cell: ({ row, getValue }) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            row.original.disabled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}
        >
          {getValue<string>()}
        </span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Alta',
      meta: { className: 'whitespace-nowrap text-slate-500' },
      cell: ({ getValue }) => formatearFecha(getValue<string>()),
    },
    {
      id: 'acciones',
      header: 'Acciones',
      enableSorting: false,
      meta: { className: 'text-right' },
      cell: ({ row }) => {
        const usuario = row.original;
        const procesando = idProcesando === usuario.id;
        if (usuario.disabled) {
          return (
            <Button variante="fantasma" cargando={procesando} onClick={() => onActivar(usuario)} className="text-green-700 hover:bg-green-50">
              Activar
            </Button>
          );
        }
        // Desactivar no se muestra en la fila del usuario de la sesión
        if (usuario.id === idSesion) return null;
        return (
          <Button variante="fantasma" cargando={procesando} onClick={() => onDesactivar(usuario)} className="text-red-600 hover:bg-red-50">
            Desactivar
          </Button>
        );
      },
    },
  ];
}
