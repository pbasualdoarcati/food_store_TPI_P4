import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { registrar } from '../api/auth';
import type { Credenciales, UserCreate } from '../types';

// El login vive en el authStore (estado del cliente); useMutation aporta isPending y error
export function useLogin() {
  const login = useAuthStore((s) => s.login);
  return useMutation({
    mutationFn: ({ username, password }: Credenciales) => login(username, password),
  });
}

// Registro público (rol user) y, si sale bien, login automático con las mismas credenciales
export function useRegistro() {
  const login = useAuthStore((s) => s.login);
  return useMutation({
    mutationFn: async (datos: UserCreate) => {
      await registrar(datos);
      return login(datos.username, datos.password);
    },
  });
}
