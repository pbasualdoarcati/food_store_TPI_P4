import type { ReactNode } from 'react';

interface EstadoVacioProps {
  titulo: string;
  mensaje?: string;
  icono?: string;
  accion?: ReactNode; // p. ej. un Link para volver al catálogo
}

function EstadoVacio({ titulo, mensaje, icono = '📭', accion }: EstadoVacioProps) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="text-4xl" aria-hidden="true">
        {icono}
      </p>
      <p className="mt-2 font-medium text-slate-700">{titulo}</p>
      {mensaje && <p className="mt-1 text-sm text-slate-500">{mensaje}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}

export default EstadoVacio;
