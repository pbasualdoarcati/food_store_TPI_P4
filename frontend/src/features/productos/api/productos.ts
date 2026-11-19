import { api } from '../../../shared/api/axiosInstance';
import type {
  FiltrosProductos,
  Producto,
  ProductoInput,
  ProductoStockUpdate,
  ProductosPaginados,
} from '../types';

// Axios omite los params en undefined: solo viajan los filtros activos
export async function getProductos(filtros: FiltrosProductos): Promise<ProductosPaginados> {
  const { data } = await api.get<ProductosPaginados>('/productos', { params: filtros });
  return data;
}

export async function createProducto(datos: ProductoInput): Promise<Producto> {
  const { data } = await api.post<Producto>('/productos', datos);
  return data;
}

export async function updateProducto(id: number, datos: ProductoInput): Promise<Producto> {
  const { data } = await api.put<Producto>(`/productos/${id}`, datos);
  return data;
}

export async function updateStock(id: number, datos: ProductoStockUpdate): Promise<Producto> {
  const { data } = await api.patch<Producto>(`/productos/${id}/stock`, datos);
  return data;
}

// Baja lógica: responde 204 sin cuerpo
export async function deleteProducto(id: number): Promise<void> {
  await api.delete(`/productos/${id}`);
}
