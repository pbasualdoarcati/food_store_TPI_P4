interface SkeletonProps {
  className?: string;
}

// Bloque gris animado que ocupa el lugar del contenido mientras carga
function Skeleton({ className = '' }: SkeletonProps) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-slate-200 ${className}`} />;
}

interface SkeletonGridProps {
  cantidad: number;
}

// Grilla de tarjetas fantasma con la misma forma que ProductoCard
export function SkeletonGrid({ cantidad }: SkeletonGridProps) {
  return (
    <div
      role="status"
      aria-label="Cargando"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i} className="space-y-3 rounded-lg bg-white p-4 shadow-sm">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

interface SkeletonFilasProps {
  filas: number;
}

export function SkeletonFilas({ filas }: SkeletonFilasProps) {
  return (
    <div role="status" aria-label="Cargando" className="space-y-2 rounded-lg bg-white p-4 shadow-sm">
      {Array.from({ length: filas }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export default Skeleton;
