type Tono = 'amber' | 'blue' | 'green' | 'slate' | 'orange' | 'emerald';

const tonos: Record<Tono, string> = {
  amber: 'border-amber-400 text-amber-700',
  blue: 'border-blue-400 text-blue-700',
  green: 'border-green-500 text-green-700',
  slate: 'border-slate-400 text-slate-600',
  orange: 'border-orange-500 text-orange-700',
  emerald: 'border-emerald-500 text-emerald-700',
};

interface TarjetaResumenProps {
  titulo: string;
  valor: string;
  descripcion?: string;
  icono: string;
  tono: Tono;
}

function TarjetaResumen({ titulo, valor, descripcion, icono, tono }: TarjetaResumenProps) {
  return (
    <article className={`rounded-lg border-l-4 bg-white p-5 shadow-sm ${tonos[tono]}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-500">{titulo}</h2>
        <span aria-hidden="true" className="text-2xl">
          {icono}
        </span>
      </div>
      <p className="mt-2 text-3xl font-bold">{valor}</p>
      {descripcion && <p className="mt-1 text-xs text-slate-400">{descripcion}</p>}
    </article>
  );
}

export default TarjetaResumen;
