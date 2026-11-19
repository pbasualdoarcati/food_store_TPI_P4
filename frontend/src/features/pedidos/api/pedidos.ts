import { api } from '../../../shared/api/axiosInstance';
import type {
  CambioEstado,
  FiltrosPedidos,
  Pedido,
  PedidoCreate,
  PedidosPaginados,
  ResumenPedidos,
} from '../types';

// Propios (user) o todos (admin): el backend decide según la sesión
export async function getPedidos(filtros: FiltrosPedidos): Promise<PedidosPaginados> {
  const { data } = await api.get<PedidosPaginados>('/pedidos', { params: filtros });
  return data;
}

export async function getResumenPedidos(): Promise<ResumenPedidos> {
  const { data } = await api.get<ResumenPedidos>('/pedidos/resumen');
  return data;
}

export async function crearPedido(datos: PedidoCreate): Promise<Pedido> {
  const { data } = await api.post<Pedido>('/pedidos', datos);
  return data;
}

// Admin: avanza o cancela según la máquina de estados
export async function cambiarEstadoPedido(id: number, cambio: CambioEstado): Promise<Pedido> {
  const { data } = await api.patch<Pedido>(`/pedidos/${id}/estado`, cambio);
  return data;
}

// Dueño: cancela su pedido mientras está PENDIENTE
export async function cancelarPedido(id: number): Promise<Pedido> {
  const { data } = await api.patch<Pedido>(`/pedidos/${id}/cancelar`);
  return data;
}
