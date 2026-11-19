# Food Store — Trabajo Práctico Integrador (Programación 4)

Aplicación web de pedidos de comida: backend **FastAPI + SQLModel** (arquitectura en capas con Unit of Work) y frontend **React + TypeScript** (TanStack Query/Form/Table, Zustand, Axios). Autenticación con JWT en cookie HttpOnly y autorización por roles (`user` / `admin`).

- **Alumno:** Pablo Gabriel Ramon Basualdo Arcati — COMI-3
- **Repositorio:** https://github.com/pbasualdoarcati/food_store_TPI_P4
- **Video de demostración:** ver [sección Video de demostración](#video-de-demostración)

## Video de demostración

**Link:** [Video](https://drive.google.com/file/d/1mpD_shwCAXnycw8Y9-AbyAM1rMbbMdnz/view?usp=sharing) (10 a 15 minutos)

Contenido:

1. Presentación con la cámara encendida.
2. Registro de un usuario nuevo.
3. Compra como cliente: catálogo, carrito y confirmación del pedido.
4. Gestión como admin: categorías, productos y pedidos.
5. Cancelación de un pedido y restitución del stock.

## Requisitos

| Herramienta           | Versión                                                 |
| --------------------- | ------------------------------------------------------- |
| Python                | 3.11 a 3.13 (SQLModel no funciona con 3.14)             |
| Node.js               | 20.19 o superior                                        |
| pnpm                  | 9 o superior                                            |
| PostgreSQL (opcional) | 15 o superior — en desarrollo se usa SQLite por defecto |

## Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate   |   Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # Windows (cmd): copy .env.example .env
python -m app.db.seed           # idempotente: se puede correr varias veces
uvicorn app.main:app --reload
```

- API: http://localhost:8000/api/v1
- Documentación: http://localhost:8000/docs y http://localhost:8000/redoc
- Requests de prueba (extensión REST Client de VS Code): `backend/http/*.http`

### Variables de entorno (`backend/.env`)

| Variable                      | Descripción                          | Ejemplo                                                                           |
| ----------------------------- | ------------------------------------ | --------------------------------------------------------------------------------- |
| `DATABASE_URL`                | Conexión a la base                   | `sqlite:///./foodstore.db` o `postgresql://user:pass@localhost:5432/foodstore_db` |
| `SECRET_KEY`                  | Firma del JWT (mínimo 32 caracteres) | `cambiar-esta-clave-de-al-menos-32-caracteres`                                    |
| `ALGORITHM`                   | Algoritmo del JWT                    | `HS256`                                                                           |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Expiración del token y de la cookie  | `30`                                                                              |
| `FRONTEND_ORIGIN`             | Origen permitido en CORS             | `http://localhost:5173`                                                           |

## Frontend

```bash
cd frontend
cp .env.example .env            # Windows (cmd): copy .env.example .env
pnpm install
pnpm build                      # verifica los tipos y compila
pnpm dev
```

- App: http://localhost:5173

### Variables de entorno (`frontend/.env`)

| Variable       | Descripción        | Ejemplo                        |
| -------------- | ------------------ | ------------------------------ |
| `VITE_API_URL` | URL base de la API | `http://localhost:8000/api/v1` |

## Usuarios del seed

| Rol   | Usuario   | Contraseña     |
| ----- | --------- | -------------- |
| admin | `admin`   | `Admin1234!`   |
| user  | `cliente` | `Cliente1234!` |

El seed también carga 4 categorías y 10 productos con stock.

## Estructura

```
backend/    API REST (app/core, app/modules/{auth,usuarios,categorias,productos,pedidos}, app/db/seed.py)
frontend/   SPA React organizada por features (shared/, features/, store/, routes/)
docs/       Documentación de estudio del código
```
