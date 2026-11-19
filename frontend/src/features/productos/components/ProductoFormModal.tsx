import { useForm } from '@tanstack/react-form';
import AlertaError from '../../../shared/ui/AlertaError';
import FormActions from '../../../shared/ui/FormActions';
import FormField from '../../../shared/ui/FormField';
import Input from '../../../shared/ui/Input';
import Modal from '../../../shared/ui/Modal';
import { inputClass } from '../../../shared/ui/styles';
import {
  longitud,
  numeroNoNegativo,
  textoOpcional,
  urlOpcional,
} from '../../../shared/utils/validaciones';
import type { Categoria } from '../../categorias/types';
import type { Producto, ProductoInput } from '../types';

interface ProductoFormModalProps {
  producto: Producto | null; // null = alta
  categorias: Categoria[];
  error: string | null;
  onSubmit: (datos: ProductoInput) => Promise<void>;
  onClose: () => void;
}

// Valores del formulario: textos sin null y números con NaN = "vacío"
interface ProductoForm {
  nombre: string;
  descripcion: string;
  precio_base: number;
  imagen_url: string;
  stock: number;
  disponible: boolean;
  categoria_id: number;
}

function valoresDe(producto: Producto | null): ProductoForm {
  return {
    nombre: producto?.nombre ?? '',
    descripcion: producto?.descripcion ?? '',
    precio_base: producto?.precio_base ?? Number.NaN,
    imagen_url: producto?.imagen_url ?? '',
    stock: producto?.stock ?? 0,
    disponible: producto?.disponible ?? true,
    categoria_id: producto?.categoria_id ?? 0,
  };
}

function ProductoFormModal({
  producto,
  categorias,
  error,
  onSubmit,
  onClose,
}: ProductoFormModalProps) {
  const form = useForm({
    defaultValues: valoresDe(producto),
    onSubmit: async ({ value }) => {
      await onSubmit({
        nombre: value.nombre.trim(),
        descripcion: textoOpcional(value.descripcion),
        precio_base: value.precio_base,
        imagen_url: textoOpcional(value.imagen_url),
        stock: value.stock,
        disponible: value.disponible,
        categoria_id: value.categoria_id,
      });
    },
  });

  return (
    <Modal
      isOpen
      titulo={producto ? 'Editar producto' : 'Nuevo producto'}
      onClose={onClose}
      ancho="xl"
    >
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
        <form.Field name="nombre" validators={{ onChange: longitud('El nombre', 2, 150) }}>
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
                rows={2}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className={inputClass}
              />
            </FormField>
          )}
        </form.Field>

        <form.Field
          name="categoria_id"
          validators={{
            onChange: ({ value }) => (value > 0 ? undefined : 'Elegí una categoría'),
          }}
        >
          {(field) => (
            <FormField label="Categoría" htmlFor={field.name} errores={field.state.meta.errors}>
              <select
                id={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(Number(e.target.value))}
                aria-invalid={field.state.meta.errors.length > 0}
                className={inputClass}
              >
                <option value={0}>Seleccioná una categoría…</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </FormField>
          )}
        </form.Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="precio_base" validators={{ onChange: numeroNoNegativo('El precio') }}>
            {(field) => (
              <FormField
                label="Precio base ($)"
                htmlFor={field.name}
                errores={field.state.meta.errors}
              >
                <Input
                  id={field.name}
                  type="number"
                  min={0}
                  step="0.01"
                  // NaN = campo vacío
                  value={Number.isNaN(field.state.value) ? '' : field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.valueAsNumber)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
              </FormField>
            )}
          </form.Field>

          <form.Field name="stock" validators={{ onChange: numeroNoNegativo('El stock', true) }}>
            {(field) => (
              <FormField label="Stock" htmlFor={field.name} errores={field.state.meta.errors}>
                <Input
                  id={field.name}
                  type="number"
                  min={0}
                  step={1}
                  value={Number.isNaN(field.state.value) ? '' : field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.valueAsNumber)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
              </FormField>
            )}
          </form.Field>
        </div>

        <form.Field name="imagen_url" validators={{ onChange: urlOpcional }}>
          {(field) => (
            <FormField
              label="URL de la imagen (opcional)"
              htmlFor={field.name}
              errores={field.state.meta.errors}
            >
              <Input
                id={field.name}
                type="url"
                placeholder="https://…"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
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
            <FormActions onCancel={onClose} canSubmit={canSubmit} isSubmitting={isSubmitting} />
          )}
        </form.Subscribe>
      </form>
    </Modal>
  );
}

export default ProductoFormModal;
