# Documentación de estudio - Food Store (TPI Programación IV)

Guías para entender y defender el proyecto en el examen oral. Están escritas para **explicar el por qué**, no solo el cómo.

> **Estudiá esto PRIMERO antes del examen (14/11):** [decisiones.md](decisiones.md) - registro de 49 decisiones de diseño con el "¿por qué lo hiciste así?" y respuestas modelo para el oral.

## Backend (FastAPI + SQLModel)

| # | Archivo | De qué trata |
|---|---------|--------------|
| 00 | [backend/00-arquitectura.md](backend/00-arquitectura.md) | Capas, Unit of Work, Repository, genéricos, `Depends` |
| 01 | [backend/01-core.md](backend/01-core.md) | Infraestructura compartida (`app/core`) |
| 02 | [backend/02-auth-y-usuarios.md](backend/02-auth-y-usuarios.md) | JWT en cookie HttpOnly, roles, gestión de usuarios |
| 03 | [backend/03-categorias-y-productos.md](backend/03-categorias-y-productos.md) | Catálogo, paginación, baja lógica |
| 04 | [backend/04-pedidos.md](backend/04-pedidos.md) | Reglas de negocio, transacción, máquina de estados |
| 05 | [backend/05-seed-config-y-http.md](backend/05-seed-config-y-http.md) | Seed, configuración, códigos HTTP |
| 06 | [backend/06-preguntas-de-examen.md](backend/06-preguntas-de-examen.md) | Preguntas orales del backend |

## Frontend (React + TypeScript + Vite)

| # | Archivo | De qué trata |
|---|---------|--------------|
| 00 | [frontend/00-arquitectura.md](frontend/00-arquitectura.md) | Features por dominio, servidor vs cliente, diagramas de login y checkout, cookie HttpOnly, CORS |
| 01 | [frontend/01-shared.md](frontend/01-shared.md) | Axios + interceptor, `handleApiError`, `queryClient`, UI, `DataTable`, `useDebounce`, utils |
| 02 | [frontend/02-store-y-rutas.md](frontend/02-store-y-rutas.md) | `authStore`, `cartStore`, `persist`/`partialize`, `AppRouter`, `ProtectedRoute`, `App`, `main` |
| 03 | [frontend/03-auth-y-usuarios.md](frontend/03-auth-y-usuarios.md) | Login/registro con TanStack Form, mutaciones con invalidación, admin de usuarios |
| 04 | [frontend/04-catalogo-categorias-productos.md](frontend/04-catalogo-categorias-productos.md) | Catálogo paginado, `queryKey`, `keepPreviousData`, debounce, ABM admin con TanStack Table |
| 05 | [frontend/05-pedidos.md](frontend/05-pedidos.md) | Carrito, checkout, estrategia de invalidación, máquina de estados en la UI, panel admin |
| 06 | [frontend/06-typescript-y-calidad.md](frontend/06-typescript-y-calidad.md) | `strict`, sin `any`, type guards, module augmentation, cómo correrlo, debilidades reales |
| 07 | [frontend/07-preguntas-de-examen.md](frontend/07-preguntas-de-examen.md) | 75 preguntas orales con respuestas modelo |

## Orden de estudio sugerido

1. **Backend 00 y 04 (conceptos)**: el frontend espeja al backend; conviene tener claros el Unit of Work y la máquina de estados antes de ver cómo se consumen.
2. **Frontend 00**: la foto grande. No sigas hasta poder explicar con tus palabras servidor vs cliente, y por qué la cookie es HttpOnly.
3. **Frontend 02**: stores y rutas (`persist`, `partialize`, `checkSession`, `ProtectedRoute`). Es el criterio 9 de la consigna.
4. **Frontend 01**: `axiosInstance` (interceptor) y `queryClient`; después `DataTable` y `useDebounce`.
5. **Frontend 03 → 04 → 05**: de lo simple a lo complejo (formularios y una mutación; luego paginación/queryKey; por último pedidos).
6. **Backend 02, 03, 05**: completá los endpoints que consume el front (códigos 401/400/409, paginación, seed).
7. **Frontend 06**: TypeScript y calidad, y repasá los puntos débiles para poder reconocerlos con honestidad.
8. **Preguntas de examen** (frontend 07 y backend 06): contestalas en voz alta sin mirar, y después compará.

## Consejo de defensa

Para cada pieza, respondé tres cosas: **qué problema resuelve**, **por qué esta solución y no otra** y **dónde está en tu código**. Si el profe te marca un punto débil, reconocelo y proponé la mejora: eso suma más que defender lo indefendible.
