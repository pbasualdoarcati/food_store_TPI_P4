import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { queryClient } from './shared/api/queryClient';
import './index.css';

const contenedor = document.getElementById('root');
if (!contenedor) throw new Error('No se encontró el elemento #root');

createRoot(contenedor).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
