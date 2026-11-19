import { useEffect } from 'react';
import AppRouter from './routes/AppRouter';
import { useAuthStore } from './store/authStore';

function App() {
  const checkSession = useAuthStore((s) => s.checkSession);

  // Única llamada a la API dentro de un useEffect: confirmar la sesión (GET /auth/me) al montar.
  // Todo lo demás se obtiene con TanStack Query.
  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  return <AppRouter />;
}

export default App;
