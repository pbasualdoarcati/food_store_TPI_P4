import axios from 'axios';

// 422 de FastAPI: lista de errores de validación
interface ErrorValidacion {
  msg: string;
  loc?: (string | number)[];
}

export interface ApiErrorBody {
  detail?: string | ErrorValidacion[];
}

const MENSAJES_POR_CODIGO: Record<number, string> = {
  401: 'Tu sesión no es válida. Iniciá sesión nuevamente.',
  403: 'No tenés permiso para realizar esta acción.',
  404: 'El recurso no existe o fue dado de baja.',
  500: 'Error interno del servidor. Intentá más tarde.',
};

// Convierte cualquier error de Axios en un mensaje legible a partir del detail del backend
export function handleApiError(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    if (!error.response) {
      return 'No se pudo conectar con el servidor. ¿Está levantado el backend?';
    }
    const { status, data } = error.response;
    const detail = data?.detail;
    if (typeof detail === 'string' && detail.length > 0) return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail.map((d) => d.msg).join('. ');
    }
    return MENSAJES_POR_CODIGO[status] ?? `Error ${status}`;
  }
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado.';
}
