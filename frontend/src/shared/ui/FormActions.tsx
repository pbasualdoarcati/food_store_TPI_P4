import Button from './Button';

interface FormActionsProps {
  onCancel: () => void;
  canSubmit: boolean;
  isSubmitting: boolean;
  textoEnviar?: string;
}

// Recibe canSubmit e isSubmitting desde form.Subscribe
function FormActions({
  onCancel,
  canSubmit,
  isSubmitting,
  textoEnviar = 'Guardar',
}: FormActionsProps) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button variante="secundario" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="submit" disabled={!canSubmit} cargando={isSubmitting}>
        {isSubmitting ? 'Guardando…' : textoEnviar}
      </Button>
    </div>
  );
}

export default FormActions;
