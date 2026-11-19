from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status

from app.core.database import session_factory
from app.core.deps import AdminUser

from .schemas import (
    ProductoCreate,
    ProductoRead,
    ProductosPaginados,
    ProductoStockUpdate,
    ProductoUpdate,
)
from .service import CategoriaNoEncontrada, ProductoNoEncontrado, ProductoService
from .unit_of_work import ProductoUnitOfWork

router = APIRouter(prefix="/productos", tags=["productos"])


def get_producto_service() -> ProductoService:
    return ProductoService(ProductoUnitOfWork(session_factory))


ServiceDep = Annotated[ProductoService, Depends(get_producto_service)]
ProductoId = Annotated[int, Path(gt=0)]


def _http(error: Exception) -> HTTPException:
    """ProductoNoEncontrado y CategoriaNoEncontrada responden 404."""
    return HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error))


@router.get("", response_model=ProductosPaginados)
def listar_productos(
    service: ServiceDep,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    search: Annotated[str | None, Query(max_length=100)] = None,
    categoria_id: Annotated[int | None, Query(gt=0)] = None,
    disponible: bool | None = None,
):
    return service.listar(skip, limit, search, categoria_id, disponible)


@router.get("/{id}", response_model=ProductoRead)
def detalle_producto(id: ProductoId, service: ServiceDep):
    try:
        return service.obtener(id)
    except ProductoNoEncontrado as e:
        raise _http(e) from e


@router.post("", response_model=ProductoRead, status_code=status.HTTP_201_CREATED)
def crear_producto(data: ProductoCreate, _: AdminUser, service: ServiceDep):
    try:
        return service.crear(data)
    except CategoriaNoEncontrada as e:
        raise _http(e) from e


@router.put("/{id}", response_model=ProductoRead)
def actualizar_producto(id: ProductoId, data: ProductoUpdate, _: AdminUser, service: ServiceDep):
    try:
        return service.actualizar(id, data)
    except (ProductoNoEncontrado, CategoriaNoEncontrada) as e:
        raise _http(e) from e


@router.patch("/{id}/stock", response_model=ProductoRead)
def actualizar_stock(
    id: ProductoId, data: ProductoStockUpdate, _: AdminUser, service: ServiceDep
):
    try:
        return service.actualizar_stock(id, data)
    except ProductoNoEncontrado as e:
        raise _http(e) from e


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_producto(id: ProductoId, _: AdminUser, service: ServiceDep):
    try:
        service.eliminar(id)
    except ProductoNoEncontrado as e:
        raise _http(e) from e
    return Response(status_code=status.HTTP_204_NO_CONTENT)
