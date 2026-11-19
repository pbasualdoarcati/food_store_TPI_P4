import { useEffect, useState } from 'react';

// Devuelve el valor recién cuando dejó de cambiar durante `demora` ms.
// No obtiene datos: solo retrasa un valor local (el fetch lo hace TanStack Query).
export function useDebounce<T>(valor: T, demora = 300): T {
  const [demorado, setDemorado] = useState(valor);

  useEffect(() => {
    const id = window.setTimeout(() => setDemorado(valor), demora);
    return () => window.clearTimeout(id);
  }, [valor, demora]);

  return demorado;
}
