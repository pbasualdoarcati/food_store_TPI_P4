import type { EstadoPedido } from '../../features/pedidos/types';

const estilos: Record<EstadoPedido, { clase: string; etiqueta: string }> = {
  PENDIENTE: { clase: 'bg-amber-100 text-amber-800 ring-amber-200', etiqueta: 'Pendiente' },
  EN_PREPARACION: { clase: 'bg-blue-100 text-blue-800 ring-blue-200', etiqueta: 'En preparación' },
  ENTREGADO: { clase: 'bg-green-100 text-green-800 ring-green-200', etiqueta: 'Entregado' },
  CANCELADO: { clase: 'bg-slate-200 text-slate-600 ring-slate-300', etiqueta: 'Cancelado' },
};

interface BadgeEstadoProps {
  estado: EstadoPedido;
}

// Colorea los cuatro estados de la máquina de estados del pedido
function BadgeEstado({ estado }: BadgeEstadoProps) {
  const { clase, etiqueta } = estilos[estado];
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ${clase}`}
    >
      {etiqueta}
    </span>
  );
}

export default BadgeEstado;
