import type { Categoria } from '../../categorias/types';

// ProductoRead del backend (incluye su categoría)
export interface Producto {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio_base: number;
  imagen_url: string | null;
  stock: number;
  disponible: boolean;
  categoria_id: number;
  activo: boolean;
  categoria: Categoria;
}

// ProductoCreate / ProductoUpdate
export interface ProductoInput {
  nombre: string;
  descripcion: string | null;
  precio_base: number;
  imagen_url: string | null;
  stock: number;
  disponible: boolean;
  categoria_id: number;
}

// ProductoStockUpdate: cuerpo de PATCH /productos/{id}/stock
export interface ProductoStockUpdate {
  stock: number;
  disponible: boolean;
}

export interface ProductosPaginados {
  total: number;
  items: Producto[];
}

// Query params de GET /productos; los opcionales en undefined no se envían
export interface FiltrosProductos {
  skip: number;
  limit: number;
  search?: string;
  categoria_id?: number;
  disponible?: boolean;
}
