import { useForm } from '@tanstack/react-form';
import AlertaError from '../../../shared/ui/AlertaError';
import Button from '../../../shared/ui/Button';
import FormField from '../../../shared/ui/FormField';
import { inputClass } from '../../../shared/ui/styles';
import { longitud, textoOpcional } from '../../../shared/utils/validaciones';
import type { DatosCheckout, FormaPago } from '../types';
import { ETIQUETA_FORMA_PAGO, FORMAS_PAGO, esFormaPago } from '../utils/estados';

interface CheckoutFormProps {
  error: string | null;
  onSubmit: (datos: DatosCheckout) => Promise<void>;
}

interface CheckoutValores {
  direccion_entrega: string;
  forma_pago: FormaPago;
  notas: string;
}

const valoresIniciales: CheckoutValores = {
  direccion_entrega: '',
  forma_pago: 'EFECTIVO',
  notas: '',
};

const MAX_NOTAS = 500;

function CheckoutForm({ error, onSubmit }: CheckoutFormProps) {
  const form = useForm({
    defaultValues: valoresIniciales,
    onSubmit: async ({ value }) => {
      await onSubmit({
        direccion_entrega: value.direccion_entrega.trim(),
        forma_pago: value.forma_pago,
        notas: textoOpcional(value.notas),
      });
    },
  });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <AlertaError mensaje={error} />

      {/* RN-06: dirección entre 5 y 200 caracteres */}
      <form.Field
        name="direccion_entrega"
        validators={{ onChange: longitud('La dirección de entrega', 5, 200) }}
      >
        {(field) => (
          <FormField
            label="Dirección de entrega"
            htmlFor={field.name}
            errores={field.state.meta.errors}
          >
            <input
              id={field.name}
              autoFocus
              autoComplete="street-address"
              placeholder="Calle, número, piso, ciudad"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={field.state.meta.errors.length > 0}
              className={inputClass}
            />
          </FormField>
        )}
      </form.Field>

      {/* RN-06: forma de pago EFECTIVO o TRANSFERENCIA */}
      <form.Field name="forma_pago">
        {(field) => (
          <FormField label="Forma de pago" htmlFor={field.name} errores={field.state.meta.errors}>
            <select
              id={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => {
                if (esFormaPago(e.target.value)) field.handleChange(e.target.value);
              }}
              className={inputClass}
            >
              {FORMAS_PAGO.map((forma) => (
                <option key={forma} value={forma}>
                  {ETIQUETA_FORMA_PAGO[forma]}
                </option>
              ))}
            </select>
          </FormField>
        )}
      </form.Field>

      <form.Field
        name="notas"
        validators={{
          onChange: ({ value }) =>
            value.length > MAX_NOTAS ? `Máximo ${MAX_NOTAS} caracteres` : undefined,
        }}
      >
        {(field) => (
          <FormField
            label="Notas (opcional)"
            htmlFor={field.name}
            errores={field.state.meta.errors}
            ayuda="Por ejemplo: timbre, horario o aclaraciones del pedido."
          >
            <textarea
              id={field.name}
              rows={3}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={field.state.meta.errors.length > 0}
              className={inputClass}
            />
          </FormField>
        )}
      </form.Field>

      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <Button type="submit" className="w-full" disabled={!canSubmit} cargando={isSubmitting}>
            {isSubmitting ? 'Confirmando…' : 'Confirmar pedido'}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

export default CheckoutForm;
