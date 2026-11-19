import axios from 'axios';
import { useAuthStore } from '../../store/authStore';
import { queryClient } from './queryClient';
import type { ApiErrorBody } from './handleApiError';

export const CUENTA_DESACTIVADA = 'Cuenta de usuario desactivada';

// En estas rutas un 401 es una respuesta esperada (credenciales incorrectas o sin sesión):
// la maneja quien llamó, no el interceptor
const RUTAS_SIN_INTERCEPTAR = ['/auth/token', '/auth/me'];

// Cliente HTTP único. withCredentials hace que el navegador adjunte la cookie HttpOnly:
// el frontend nunca lee ni guarda el token.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError<ApiErrorBody>(error) && error.response) {
      const { status, data } = error.response;
      const url = error.config?.url ?? '';
      const sesionVencida =
        status === 401 && !RUTAS_SIN_INTERCEPTAR.some((ruta) => url.endsWith(ruta));
      const cuentaDesactivada = status === 400 && data?.detail === CUENTA_DESACTIVADA;

      if (sesionVencida || cuentaDesactivada) {
        useAuthStore.getState().limpiarSesion();
        queryClient.clear();
        if (window.location.pathname !== '/login') {
          window.location.assign('/login');
        }
      }
    }
    return Promise.reject(error);
  },
);
