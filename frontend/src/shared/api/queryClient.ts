import { QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

const MAX_REINTENTOS = 2;

// Instancia única de TanStack Query: dueña del estado del servidor
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Un 4xx no se arregla reintentando: solo se reintentan fallas de red o 5xx
      retry: (intentos, error) => {
        if (isAxiosError(error) && error.response && error.response.status < 500) return false;
        return intentos < MAX_REINTENTOS;
      },
    },
  },
});
