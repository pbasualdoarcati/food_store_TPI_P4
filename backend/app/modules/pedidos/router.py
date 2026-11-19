from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from app.core.database import session_factory
from app.core.deps import AdminUser, CurrentUser

from .schemas import (
    CambioEstado,
    EstadoPedido,
    PedidoCreate,
    PedidoRead,
    PedidosPaginados,
    ResumenPedidos,
)
from .service import (
    PedidoAjeno,
    PedidoNoCancelable,
    PedidoNoEncontrado,
    PedidoService,
    ProductoNoDisponible,
    ProductoNoEncontrado,
    ProductoRepetido,
    StockInsuficiente,
    TransicionInvalida,
)
from .unit_of_work import PedidoUnitOfWork

router = APIRouter(prefix="/pedidos", tags=["pedidos"])


def get_pedido_service() -> PedidoService:
    return PedidoService(PedidoUnitOfWork(session_factory))


ServiceDep = Annotated[PedidoService, Depends(get_pedido_service)]
PedidoId = Annotated[int, Path(gt=0)]

# Excepción de dominio → código HTTP
NO_ENCONTRADO = (PedidoNoEncontrado, ProductoNoEncontrado)
REGLA_DE_NEGOCIO = (
    StockInsuficiente,
    ProductoNoDisponible,
    ProductoRepetido,
    TransicionInvalida,
    PedidoNoCancelable,
)
ERRORES_DOMINIO = (*NO_ENCONTRADO, PedidoAjeno, *REGLA_DE_NEGOCIO)


def _http(error: Exception) -> HTTPException:
    if isinstance(error, NO_ENCONTRADO):
        return HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, PedidoAjeno):
        return HTTPException(status.HTTP_403_FORBIDDEN, detail=str(error))
    return HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(error))


@router.post("", response_model=PedidoRead, status_code=status.HTTP_201_CREATED)
def crear_pedido(data: PedidoCreate, usuario: CurrentUser, service: ServiceDep):
    try:
        return service.crear(data, usuario)
    except ERRORES_DOMINIO as e:
        raise _http(e) from e


@router.get("", response_model=PedidosPaginados)
def listar_pedidos(
    usuario: CurrentUser,
    service: ServiceDep,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    estado: EstadoPedido | None = None,
):
    return service.listar(usuario, skip, limit, estado)


# Se declara ANTES de /{id} para que "resumen" no se interprete como id
@router.get("/resumen", response_model=ResumenPedidos)
def resumen_pedidos(_: AdminUser, service: ServiceDep):
    return service.resumen()


@router.get("/{id}", response_model=PedidoRead)
def detalle_pedido(id: PedidoId, usuario: CurrentUser, service: ServiceDep):
    try:
        return service.obtener(id, usuario)
    except ERRORES_DOMINIO as e:
        raise _http(e) from e


@router.patch("/{id}/estado", response_model=PedidoRead)
def cambiar_estado(id: PedidoId, data: CambioEstado, _: AdminUser, service: ServiceDep):
    try:
        return service.cambiar_estado(id, data)
    except ERRORES_DOMINIO as e:
        raise _http(e) from e


@router.patch("/{id}/cancelar", response_model=PedidoRead)
def cancelar_pedido(id: PedidoId, usuario: CurrentUser, service: ServiceDep):
    try:
        return service.cancelar(id, usuario)
    except ERRORES_DOMINIO as e:
        raise _http(e) from e
