import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getMe, loginRequest, logoutRequest } from '../features/auth/api/auth';
import type { Usuario } from '../features/auth/types';
import { queryClient } from '../shared/api/queryClient';
import { useCartStore } from './cartStore';

interface AuthState {
  usuario: Usuario | null;
  // true mientras checkSession confirma la sesión con el backend
  cargando: boolean;
  login: (username: string, password: string) => Promise<Usuario>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  limpiarSesion: () => void;
}

// Estado del cliente: solo el usuario de la sesión. El JWT vive en la cookie HttpOnly
// y nunca pasa por acá (partialize persiste únicamente `usuario`).
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      usuario: null,
      cargando: true,

      login: async (username, password) => {
        await loginRequest(username, password);
        const usuario = await getMe();
        set({ usuario, cargando: false });
        return usuario;
      },

      logout: async () => {
        try {
          await logoutRequest();
        } finally {
          set({ usuario: null });
          queryClient.clear();
          // El carrito persiste en el navegador: se vacía para que el próximo usuario no lo herede
          useCartStore.getState().vaciar();
        }
      },

      checkSession: async () => {
        set({ cargando: true });
        try {
          const usuario = await getMe();
          set({ usuario });
        } catch {
          // 401 (sin cookie o vencida) o 400 (cuenta desactivada): no hay sesión
          set({ usuario: null });
        } finally {
          set({ cargando: false });
        }
      },

      limpiarSesion: () => set({ usuario: null }),
    }),
    {
      name: 'foodstore-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ usuario: state.usuario }),
    },
  ),
);
