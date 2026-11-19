import type { EstadoPedido, FormaPago } from '../types';

export const ESTADOS_PEDIDO: EstadoPedido[] = [
  'PENDIENTE',
  'EN_PREPARACION',
  'ENTREGADO',
  'CANCELADO',
];

export const FORMAS_PAGO: FormaPago[] = ['EFECTIVO', 'TRANSFERENCIA'];

export const ETIQUETA_ESTADO: Record<EstadoPedido, string> = {
  PENDIENTE: 'Pendiente',
  EN_PREPARACION: 'En preparación',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

export const ETIQUETA_FORMA_PAGO: Record<FormaPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
};

// Espejo de la máquina de estados del backend (RN-02), solo para decidir qué botones mostrar.
// La validación real la hace el Service de pedidos.
export const TRANSICIONES: Record<EstadoPedido, EstadoPedido[]> = {
  PENDIENTE: ['EN_PREPARACION', 'CANCELADO'],
  EN_PREPARACION: ['ENTREGADO', 'CANCELADO'],
  ENTREGADO: [],
  CANCELADO: [],
};

// Texto del botón que lleva un pedido a cada estado destino
export const ETIQUETA_ACCION: Record<EstadoPedido, string> = {
  PENDIENTE: 'Volver a pendiente',
  EN_PREPARACION: 'A preparación',
  ENTREGADO: 'Entregar',
  CANCELADO: 'Cancelar',
};

export function esEstadoPedido(valor: string): valor is EstadoPedido {
  return ESTADOS_PEDIDO.some((estado) => estado === valor);
}

export function esFormaPago(valor: string): valor is FormaPago {
  return FORMAS_PAGO.some((forma) => forma === valor);
}
