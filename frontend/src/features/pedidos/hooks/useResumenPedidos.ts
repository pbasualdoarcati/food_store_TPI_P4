import { useQuery } from '@tanstack/react-query';
import { getResumenPedidos } from '../api/pedidos';
import { PEDIDOS_KEY } from './usePedidos';

export function useResumenPedidos() {
  return useQuery({
    queryKey: [...PEDIDOS_KEY, 'resumen'],
    queryFn: getResumenPedidos,
  });
}
