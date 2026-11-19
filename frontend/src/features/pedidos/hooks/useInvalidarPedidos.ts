import { useQueryClient } from '@tanstack/react-query';
import { PRODUCTOS_KEY } from '../../productos/hooks/useProductos';
import { PEDIDOS_KEY } from './usePedidos';

// Crear o cancelar un pedido mueve stock: además de los pedidos (y el resumen)
// se invalidan los productos para que el catálogo muestre el stock real
export function useInvalidarPedidos() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: PEDIDOS_KEY }),
      queryClient.invalidateQueries({ queryKey: PRODUCTOS_KEY }),
    ]);
}
