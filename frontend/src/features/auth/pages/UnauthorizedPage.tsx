import { Link } from 'react-router-dom';
import EstadoVacio from '../../../shared/components/EstadoVacio';
import { primaryButtonClass } from '../../../shared/ui/styles';

function UnauthorizedPage() {
  return (
    <div className="mx-auto max-w-lg">
      <EstadoVacio
        icono="🔒"
        titulo="No tenés permiso para ver esta página"
        mensaje="Esta sección está reservada para otro rol. Si creés que es un error, consultá con el administrador."
        accion={
          <Link to="/" className={primaryButtonClass}>
            Volver al inicio
          </Link>
        }
      />
    </div>
  );
}

export default UnauthorizedPage;
