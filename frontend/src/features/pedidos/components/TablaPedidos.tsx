import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import DataTable from '../../../shared/components/DataTable';
import BadgeEstado from '../../../shared/ui/BadgeEstado';
import Button from '../../../shared/ui/Button';
import { formatearFecha, formatoPrecio } from '../../../shared/utils/formato';
import type { EstadoPedido, Pedido } from '../types';
import { ETIQUETA_ACCION, ETIQUETA_ESTADO, ETIQUETA_FORMA_PAGO, TRANSICIONES } from '../utils/estados';

interface TablaPedidosProps {
  pedidos: Pedido[];
  idProcesando: number | null;
  onVerDetalle: (pedido: Pedido) => void;
  onCambiarEstado: (pedido: Pedido, estado: EstadoPedido) => void;
}

// Tabla del panel: los botones de cada fila salen de la máquina de estados
function TablaPedidos({ pedidos, idProcesando, onVerDetalle, onCambiarEstado }: TablaPedidosProps) {
  const columnas = useMemo<ColumnDef<Pedido>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'N.º',
        meta: { className: 'w-16 text-slate-500' },
        cell: ({ getValue }) => `#${getValue<number>()}`,
      },
      {
        accessorKey: 'created_at',
        header: 'Fecha',
        meta: { className: 'whitespace-nowrap' },
        cell: ({ getValue }) => formatearFecha(getValue<string>()),
      },
      {
        accessorKey: 'usuario_id',
        header: 'Cliente',
        cell: ({ getValue }) => `Usuario #${getValue<number>()}`,
      },
      {
        accessorKey: 'direccion_entrega',
        header: 'Dirección',
        cell: ({ getValue }) => (
          <span className="line-clamp-1 max-w-56">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'forma_pago',
        header: 'Pago',
        cell: ({ row }) => ETIQUETA_FORMA_PAGO[row.original.forma_pago],
      },
      {
        accessorKey: 'total',
        header: 'Total',
        meta: { className: 'text-right whitespace-nowrap' },
        cell: ({ getValue }) => formatoPrecio.format(getValue<number>()),
      },
      {
        // Texto visible para que la búsqueda global encuentre "En preparación"
        id: 'estado',
        accessorFn: (p) => ETIQUETA_ESTADO[p.estado],
        header: 'Estado',
        cell: ({ row }) => <BadgeEstado estado={row.original.estado} />,
      },
      {
        id: 'acciones',
        header: 'Acciones',
        enableSorting: false,
        meta: { className: 'text-right' },
        cell: ({ row }) => {
          const pedido = row.original;
          const procesando = idProcesando === pedido.id;
          return (
            <div className="flex justify-end gap-1 whitespace-nowrap">
              <Button variante="fantasma" onClick={() => onVerDetalle(pedido)}>
                Ver
              </Button>
              {TRANSICIONES[pedido.estado].map((destino) => (
                <Button
                  key={destino}
                  variante="fantasma"
                  disabled={procesando}
                  onClick={() => onCambiarEstado(pedido, destino)}
                  className={
                    destino === 'CANCELADO'
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-blue-600 hover:bg-blue-50'
                  }
                >
                  {ETIQUETA_ACCION[destino]}
                </Button>
              ))}
            </div>
          );
        },
      },
    ],
    [idProcesando, onVerDetalle, onCambiarEstado],
  );

  return (
    <DataTable
      data={pedidos}
      columns={columnas}
      placeholderBusqueda="Buscar por dirección, estado…"
      getRowId={(p) => String(p.id)}
    />
  );
}

export default TablaPedidos;
