import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProducto,
  deleteProducto,
  getProductos,
  updateProducto,
  updateStock,
} from '../api/productos';
import type { FiltrosProductos, ProductoInput, ProductoStockUpdate } from '../types';

export const PRODUCTOS_KEY = ['productos'] as const;

// Cada combinación de filtros es una entrada de caché distinta: ['productos', filtros]
export function useProductos(filtros: FiltrosProductos) {
  return useQuery({
    queryKey: [...PRODUCTOS_KEY, filtros],
    queryFn: () => getProductos(filtros),
    // Mantiene la página anterior visible mientras llega la siguiente
    placeholderData: keepPreviousData,
  });
}

function useInvalidarProductos() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: PRODUCTOS_KEY });
}

export function useCrearProducto() {
  const invalidar = useInvalidarProductos();
  return useMutation({
    mutationFn: createProducto,
    onSuccess: invalidar,
  });
}

export function useEditarProducto() {
  const invalidar = useInvalidarProductos();
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: ProductoInput }) => updateProducto(id, datos),
    onSuccess: invalidar,
  });
}

export function useActualizarStock() {
  const invalidar = useInvalidarProductos();
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: ProductoStockUpdate }) =>
      updateStock(id, datos),
    onSuccess: invalidar,
  });
}

export function useEliminarProducto() {
  const invalidar = useInvalidarProductos();
  return useMutation({
    mutationFn: deleteProducto,
    onSuccess: invalidar,
  });
}
