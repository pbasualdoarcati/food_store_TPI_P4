interface CargandoProps {
  mensaje?: string;
}

function Cargando({ mensaje = 'Cargando…' }: CargandoProps) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 p-10 text-slate-500">
      <span className="size-5 animate-spin rounded-full border-2 border-slate-300 border-t-orange-600" />
      {mensaje}
    </div>
  );
}

export default Cargando;
