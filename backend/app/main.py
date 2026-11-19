from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import create_all_tables
from app.modules.auth.router import router as auth_router
from app.modules.categorias.router import router as categorias_router
from app.modules.pedidos.router import router as pedidos_router
from app.modules.productos.router import router as productos_router
from app.modules.usuarios.router import router as usuarios_router

API_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # Crea las tablas al arrancar (si no existen)
    create_all_tables()
    yield


app = FastAPI(
    title="Food Store API",
    description=(
        "TPI Programación 4 — Sistema de pedidos de comida. "
        "FastAPI + SQLModel con Unit of Work, JWT en cookie HttpOnly y roles."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS con credenciales: el navegador envía la cookie access_token
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(usuarios_router, prefix=API_PREFIX)
app.include_router(categorias_router, prefix=API_PREFIX)
app.include_router(productos_router, prefix=API_PREFIX)
app.include_router(pedidos_router, prefix=API_PREFIX)


@app.get("/", tags=["health"])
def root() -> dict[str, str]:
    return {"message": "Food Store API", "docs": "/docs", "redoc": "/redoc"}
