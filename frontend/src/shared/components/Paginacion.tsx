import { secondaryButtonClass } from '../ui/styles';

interface PaginacionProps {
  pagina: number; // base 0
  total: number; // total de registros que informa el backend
  porPagina: number;
  onCambiar: (pagina: number) => void;
  deshabilitado?: boolean;
}

// Paginación del lado del servidor: el padre traduce la página a skip = pagina × limit
function Paginacion({ pagina, total, porPagina, onCambiar, deshabilitado = false }: PaginacionProps) {
  const totalPaginas = Math.max(Math.ceil(total / porPagina), 1);
  const desde = total === 0 ? 0 : pagina * porPagina + 1;
  const hasta = Math.min((pagina + 1) * porPagina, total);

  return (
    <nav
      aria-label="Paginación"
      className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"
    >
      <span>
        Mostrando {desde}–{hasta} de {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onCambiar(pagina - 1)}
          disabled={deshabilitado || pagina === 0}
          className={secondaryButtonClass}
        >
          Anterior
        </button>
        <span>
          Página {pagina + 1} de {totalPaginas}
        </span>
        <button
          type="button"
          onClick={() => onCambiar(pagina + 1)}
          disabled={deshabilitado || pagina + 1 >= totalPaginas}
          className={secondaryButtonClass}
        >
          Siguiente
        </button>
      </div>
    </nav>
  );
}

export default Paginacion;
