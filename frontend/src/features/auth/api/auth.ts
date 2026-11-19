import { api } from '../../../shared/api/axiosInstance';
import type { LoginResponse, UserCreate, Usuario } from '../types';

// Login con formulario OAuth2 (application/x-www-form-urlencoded).
// La respuesta setea la cookie HttpOnly; el cuerpo no trae el token.
export async function loginRequest(username: string, password: string): Promise<LoginResponse> {
  const formulario = new URLSearchParams({ username, password });
  const { data } = await api.post<LoginResponse>('/auth/token', formulario, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return data;
}

export async function getMe(): Promise<Usuario> {
  const { data } = await api.get<Usuario>('/auth/me');
  return data;
}

export async function logoutRequest(): Promise<void> {
  await api.post('/auth/logout');
}

export async function registrar(datos: UserCreate): Promise<Usuario> {
  const { data } = await api.post<Usuario>('/auth/register', datos);
  return data;
}
