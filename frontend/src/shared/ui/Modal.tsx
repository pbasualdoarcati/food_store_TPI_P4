import { useEffect, useId } from 'react';
import type { ReactNode } from 'react';

type Ancho = 'md' | 'lg' | 'xl';

const anchos: Record<Ancho, string> = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

interface ModalProps {
  isOpen: boolean;
  titulo: string;
  onClose: () => void;
  ancho?: Ancho;
  children: ReactNode;
}

// Apertura y cierre los controla quien lo usa; Escape y click afuera cierran
function Modal({ isOpen, titulo, onClose, ancho = 'lg', children }: ModalProps) {
  const tituloId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const cerrarConEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', cerrarConEscape);
    return () => window.removeEventListener('keydown', cerrarConEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className={`max-h-[90vh] w-full ${anchos[ancho]} overflow-y-auto rounded-lg bg-white p-6 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={tituloId} className="text-xl font-bold text-slate-800">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded px-2 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default Modal;
