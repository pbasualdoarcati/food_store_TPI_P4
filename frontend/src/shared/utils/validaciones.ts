// Validadores para form.Field de TanStack Form: devuelven el mensaje o undefined

type Validador<T> = ({ value }: { value: T }) => string | undefined;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requerido(campo: string): Validador<string> {
  return ({ value }) => (value.trim() ? undefined : `${campo} es obligatorio`);
}

export function longitud(campo: string, min: number, max: number): Validador<string> {
  return ({ value }) => {
    const texto = value.trim();
    if (!texto) return `${campo} es obligatorio`;
    if (texto.length < min) return `Mínimo ${min} caracteres`;
    if (texto.length > max) return `Máximo ${max} caracteres`;
    return undefined;
  };
}

export const emailValido: Validador<string> = ({ value }) => {
  if (!value.trim()) return 'El email es obligatorio';
  return EMAIL_REGEX.test(value.trim()) ? undefined : 'El email no tiene un formato válido';
};

export const passwordValida: Validador<string> = ({ value }) => {
  if (!value) return 'La contraseña es obligatoria';
  if (value.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  return value.length <= 72 ? undefined : 'La contraseña admite como máximo 72 caracteres';
};

// Campo opcional: vacío es válido
export const urlOpcional: Validador<string> = ({ value }) => {
  const url = value.trim();
  if (!url) return undefined;
  if (url.length > 500) return 'La URL admite como máximo 500 caracteres';
  return URL.canParse(url) ? undefined : 'No es una URL válida';
};

export function numeroNoNegativo(campo: string, entero = false): Validador<number> {
  return ({ value }) => {
    if (Number.isNaN(value)) return `${campo} es obligatorio`;
    if (value < 0) return `${campo} no puede ser negativo`;
    if (entero && !Number.isInteger(value)) return `${campo} debe ser un número entero`;
    return undefined;
  };
}

// Texto opcional del formulario → null para el backend
export function textoOpcional(valor: string): string | null {
  const limpio = valor.trim();
  return limpio ? limpio : null;
}
