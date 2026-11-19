import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCategoria, deleteCategoria, getCategorias, updateCategoria } from '../api/categorias';
import type { CategoriaInput } from '../types';

export const CATEGORIAS_KEY = ['categorias'] as const;

export function useCategorias() {
  return useQuery({
    queryKey: CATEGORIAS_KEY,
    queryFn: getCategorias,
  });
}

// Los productos embeben su categoría: un cambio de categoría también los invalida
function useInvalidarCategorias() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: CATEGORIAS_KEY }),
      queryClient.invalidateQueries({ queryKey: ['productos'] }),
    ]);
}

export function useCrearCategoria() {
  const invalidar = useInvalidarCategorias();
  return useMutation({
    mutationFn: createCategoria,
    onSuccess: invalidar,
  });
}

export function useEditarCategoria() {
  const invalidar = useInvalidarCategorias();
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: CategoriaInput }) => updateCategoria(id, datos),
    onSuccess: invalidar,
  });
}

export function useEliminarCategoria() {
  const invalidar = useInvalidarCategorias();
  return useMutation({
    mutationFn: deleteCategoria,
    onSuccess: invalidar,
  });
}
