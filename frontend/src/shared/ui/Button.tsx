import type { ButtonHTMLAttributes } from 'react';
import {
  dangerButtonClass,
  ghostButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from './styles';

type Variante = 'primario' | 'secundario' | 'peligro' | 'fantasma';

const clasesPorVariante: Record<Variante, string> = {
  primario: primaryButtonClass,
  secundario: secondaryButtonClass,
  peligro: dangerButtonClass,
  fantasma: ghostButtonClass,
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  cargando?: boolean;
}

// type="button" por defecto: un submit tiene que pedirse explícitamente
function Button({
  variante = 'primario',
  cargando = false,
  type = 'button',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || cargando}
      className={`${clasesPorVariante[variante]} ${className}`}
      {...props}
    >
      {cargando && (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}

export default Button;
