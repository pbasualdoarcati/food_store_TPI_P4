import { useForm } from '@tanstack/react-form';
import AlertaError from '../../../shared/ui/AlertaError';
import FormActions from '../../../shared/ui/FormActions';
import FormField from '../../../shared/ui/FormField';
import Input from '../../../shared/ui/Input';
import Modal from '../../../shared/ui/Modal';
import { numeroNoNegativo } from '../../../shared/utils/validaciones';
import type { Producto, ProductoStockUpdate } from '../types';

interface StockModalProps {
  producto: Producto;
  error: string | null;
  onSubmit: (datos: ProductoStockUpdate) => Promise<void>;
  onClose: () => void;
}

// PATCH /productos/{id}/stock: solo stock y disponibilidad
function StockModal({ producto, error, onSubmit, onClose }: StockModalProps) {
  const valoresIniciales: ProductoStockUpdate = {
    stock: producto.stock,
    disponible: producto.disponible,
  };

  const form = useForm({
    defaultValues: valoresIniciales,
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });

  return (
    <Modal isOpen titulo={`Stock · ${producto.nombre}`} onClose={onClose} ancho="md">
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
        <form.Field name="stock" validators={{ onChange: numeroNoNegativo('El stock', true) }}>
          {(field) => (
            <FormField
              label="Unidades en stock"
              htmlFor={field.name}
              errores={field.state.meta.errors}
            >
              <Input
                id={field.name}
                type="number"
                min={0}
                step={1}
                autoFocus
                value={Number.isNaN(field.state.value) ? '' : field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.valueAsNumber)}
                aria-invalid={field.state.meta.errors.length > 0}
              />
            </FormField>
          )}
        </form.Field>

        <form.Field name="disponible">
          {(field) => (
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <input
                type="checkbox"
                checked={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.checked)}
                className="size-4 accent-orange-600"
              />
              Disponible para la venta
            </label>
          )}
        </form.Field>

        <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
          {([canSubmit, isSubmitting]) => (
            <FormActions
              onCancel={onClose}
              canSubmit={canSubmit}
              isSubmitting={isSubmitting}
              textoEnviar="Actualizar stock"
            />
          )}
        </form.Subscribe>
      </form>
    </Modal>
  );
}

export default StockModal;
