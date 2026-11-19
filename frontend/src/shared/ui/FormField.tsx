import type { ReactNode } from 'react';
import { labelClass } from './styles';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  errores: unknown[]; // field.state.meta.errors de TanStack Form
  ayuda?: string;
  children: ReactNode;
}

function FormField({ label, htmlFor, errores, ayuda, children }: FormFieldProps) {
  const mensajes = [...new Set(errores.filter(Boolean).map(String))];

  return (
    <div>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
      {ayuda && mensajes.length === 0 && <p className="mt-1 text-xs text-slate-400">{ayuda}</p>}
      {mensajes.map((mensaje) => (
        <p key={mensaje} className="mt-1 text-xs text-red-600">
          {mensaje}
        </p>
      ))}
    </div>
  );
}

export default FormField;
