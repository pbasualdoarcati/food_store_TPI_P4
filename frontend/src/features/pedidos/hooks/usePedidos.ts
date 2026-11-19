import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getPedidos } from '../api/pedidos';
import type { FiltrosPedidos } from '../types';

// Raíz de todas las claves de pedidos (listados y resumen): invalidarla refresca todo
export const PEDIDOS_KEY = ['pedidos'] as const;

export function usePedidos(filtros: FiltrosPedidos) {
  return useQuery({
    queryKey: [...PEDIDOS_KEY, 'lista', filtros],
    queryFn: () => getPedidos(filtros),
    placeholderData: keepPreviousData,
  });
}
