import Button from '../ui/Button';
import AlertaError from '../ui/AlertaError';
import Modal from '../ui/Modal';

interface ConfirmModalProps {
  isOpen: boolean;
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  peligroso?: boolean;
  procesando: boolean;
  error: string | null; // si la mutación falla el modal queda abierto mostrando el error
  onConfirm: () => void;
  onClose: () => void;
}

// Reemplaza a window.confirm con un diálogo propio y accesible
function ConfirmModal({
  isOpen,
  titulo,
  mensaje,
  textoConfirmar = 'Confirmar',
  peligroso = true,
  procesando,
  error,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} titulo={titulo} onClose={onClose} ancho="md">
      <AlertaError mensaje={error} />
      <p className="text-sm text-slate-600">{mensaje}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variante="secundario" onClick={onClose} disabled={procesando}>
          Volver
        </Button>
        <Button
          variante={peligroso ? 'peligro' : 'primario'}
          onClick={onConfirm}
          cargando={procesando}
        >
          {textoConfirmar}
        </Button>
      </div>
    </Modal>
  );
}

export default ConfirmModal;
