// CategoriaRead del backend
export interface Categoria {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

// CategoriaCreate / CategoriaUpdate: id y activo los maneja el backend
export interface CategoriaInput {
  nombre: string;
  descripcion: string | null;
}
