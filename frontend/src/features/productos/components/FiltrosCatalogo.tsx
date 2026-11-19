import type { Categoria } from '../../categorias/types';
import Input from '../../../shared/ui/Input';
import { inputClass } from '../../../shared/ui/styles';

interface FiltrosCatalogoProps {
  busqueda: string;
  categoriaId: number | undefined;
  categorias: Categoria[];
  onBusqueda: (valor: string) => void;
  onCategoria: (id: number | undefined) => void;
}

function FiltrosCatalogo({
  busqueda,
  categoriaId,
  categorias,
  onBusqueda,
  onCategoria,
}: FiltrosCatalogoProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Input
        type="search"
        value={busqueda}
        onChange={(e) => onBusqueda(e.target.value)}
        placeholder="Buscar por nombre…"
        aria-label="Buscar productos por nombre"
        className="max-w-sm flex-1"
      />
      <select
        value={categoriaId ?? ''}
        onChange={(e) => onCategoria(e.target.value ? Number(e.target.value) : undefined)}
        aria-label="Filtrar por categoría"
        className={`${inputClass} max-w-56`}
      >
        <option value="">Todas las categorías</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}

export default FiltrosCatalogo;
