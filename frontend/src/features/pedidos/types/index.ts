export type EstadoPedido = 'PENDIENTE' | 'EN_PREPARACION' | 'ENTREGADO' | 'CANCELADO';

export type FormaPago = 'EFECTIVO' | 'TRANSFERENCIA';

// DetallePedidoRead: copia inmutable del nombre y precio del producto (RN-05)
export interface DetallePedido {
  producto_id: number;
  nombre_producto: string;
  precio_unitario: number;
  cantidad: number;
  subtotal: number;
}

// PedidoRead
export interface Pedido {
  id: number;
  usuario_id: number;
  estado: EstadoPedido;
  forma_pago: FormaPago;
  direccion_entrega: string;
  notas: string | null;
  total: number;
  created_at: string;
  updated_at: string;
  items: DetallePedido[];
}

export interface PedidosPaginados {
  total: number;
  items: Pedido[];
}

export interface ItemPedidoCreate {
  producto_id: number;
  cantidad: number;
}

export interface PedidoCreate {
  items: ItemPedidoCreate[];
  forma_pago: FormaPago;
  direccion_entrega: string;
  notas: string | null;
}

// CambioEstado: cuerpo de PATCH /pedidos/{id}/estado
export interface CambioEstado {
  estado: EstadoPedido;
}

export interface ResumenPedidos {
  pendientes: number;
  en_preparacion: number;
  entregados: number;
  cancelados: number;
  pedidos_hoy: number;
  ingresos_entregados: number;
}

export interface FiltrosPedidos {
  skip: number;
  limit: number;
  estado?: EstadoPedido;
}

// state de navegación que deja el checkout al redirigir a "Mis pedidos"
export interface EstadoPedidoCreado {
  pedidoCreado: number;
}

// Datos que completa el cliente en el checkout (los ítems salen del carrito)
export type DatosCheckout = Omit<PedidoCreate, 'items'>;
