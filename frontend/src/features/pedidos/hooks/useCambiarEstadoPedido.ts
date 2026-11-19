import { useMutation } from '@tanstack/react-query';
import { cambiarEstadoPedido } from '../api/pedidos';
import type { EstadoPedido } from '../types';
import { useInvalidarPedidos } from './useInvalidarPedidos';

export function useCambiarEstadoPedido() {
  const invalidar = useInvalidarPedidos();
  return useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: EstadoPedido }) =>
      cambiarEstadoPedido(id, { estado }),
    onSuccess: invalidar,
  });
}
