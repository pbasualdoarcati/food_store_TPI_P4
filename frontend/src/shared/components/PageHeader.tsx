import type { ReactNode } from 'react';

interface PageHeaderProps {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
}

function PageHeader({ titulo, descripcion, acciones }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{titulo}</h1>
        {descripcion && <p className="text-sm text-slate-500">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  );
}

export default PageHeader;
