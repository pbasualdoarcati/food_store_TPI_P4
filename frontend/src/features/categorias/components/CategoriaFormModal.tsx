import { useForm } from '@tanstack/react-form';
import AlertaError from '../../../shared/ui/AlertaError';
import FormActions from '../../../shared/ui/FormActions';
import FormField from '../../../shared/ui/FormField';
import Input from '../../../shared/ui/Input';
import Modal from '../../../shared/ui/Modal';
import { inputClass } from '../../../shared/ui/styles';
import { longitud, textoOpcional } from '../../../shared/utils/validaciones';
import type { Categoria, CategoriaInput } from '../types';

interface CategoriaFormModalProps {
  categoria: Categoria | null; // null = alta
  error: string | null;
  onSubmit: (datos: CategoriaInput) => Promise<void>;
  onClose: () => void;
}

// La página lo monta solo cuando está abierto (con key): cada apertura arranca un form nuevo
function CategoriaFormModal({ categoria, error, onSubmit, onClose }: CategoriaFormModalProps) {
  const form = useForm({
    defaultValues: {
      nombre: categoria?.nombre ?? '',
      descripcion: categoria?.descripcion ?? '',
    },
    onSubmit: async ({ value }) => {
      await onSubmit({
        nombre: value.nombre.trim(),
        descripcion: textoOpcional(value.descripcion),
      });
    },
  });

  return (
    <Modal isOpen titulo={categoria ? 'Editar categoría' : 'Nueva categoría'} onClose={onClose}>
      <AlertaError mensaje={error} />
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <form.Field name="nombre" validators={{ onChange: longitud('El nombre', 2, 100) }}>
          {(field) => (
            <FormField label="Nombre" htmlFor={field.name} errores={field.state.meta.errors}>
              <Input
                id={field.name}
                autoFocus
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={field.state.meta.errors.length > 0}
              />
            </FormField>
          )}
        </form.Field>

        <form.Field name="descripcion">
          {(field) => (
            <FormField
              label="Descripción (opcional)"
              htmlFor={field.name}
              errores={field.state.meta.errors}
            >
              <textarea
                id={field.name}
                rows={3}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className={inputClass}
              />
            </FormField>
          )}
        </form.Field>

        <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
          {([canSubmit, isSubmitting]) => (
            <FormActions onCancel={onClose} canSubmit={canSubmit} isSubmitting={isSubmitting} />
          )}
        </form.Subscribe>
      </form>
    </Modal>
  );
}

export default CategoriaFormModal;
