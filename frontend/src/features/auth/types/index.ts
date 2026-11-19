// Refleja los schemas del módulo auth/usuarios del backend
export type Rol = 'user' | 'admin';

// UserPublic: nunca incluye hashed_password ni el token
export interface Usuario {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: Rol;
  disabled: boolean;
  created_at: string;
}

export type UserPublic = Usuario;

// UserCreate: cuerpo de POST /auth/register
export interface UserCreate {
  username: string;
  full_name: string;
  email: string;
  password: string;
}

export interface Credenciales {
  username: string;
  password: string;
}

// Respuesta de POST /auth/token: el JWT viaja en la cookie HttpOnly, no en el cuerpo
export interface LoginResponse {
  message: string;
}

export const ETIQUETA_ROL: Record<Rol, string> = {
  user: 'Cliente',
  admin: 'Administrador',
};
