from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status

from app.core.database import session_factory
from app.core.deps import AdminUser

from .schemas import CategoriaCreate, CategoriaRead, CategoriaUpdate
from .service import CategoriaNoEncontrada, CategoriaService, NombreDuplicado
from .unit_of_work import CategoriaUnitOfWork

router = APIRouter(prefix="/categorias", tags=["categorias"])


def get_categoria_service() -> CategoriaService:
    return CategoriaService(CategoriaUnitOfWork(session_factory))


ServiceDep = Annotated[CategoriaService, Depends(get_categoria_service)]
CategoriaId = Annotated[int, Path(gt=0)]


def _http(error: Exception) -> HTTPException:
    """Traduce las excepciones de dominio a HTTPException."""
    if isinstance(error, CategoriaNoEncontrada):
        return HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error))
    return HTTPException(status.HTTP_409_CONFLICT, detail=str(error))


@router.get("", response_model=list[CategoriaRead])
def listar_categorias(service: ServiceDep):
    return service.listar()


@router.get("/{id}", response_model=CategoriaRead)
def detalle_categoria(id: CategoriaId, service: ServiceDep):
    try:
        return service.obtener(id)
    except CategoriaNoEncontrada as e:
        raise _http(e) from e


@router.post("", response_model=CategoriaRead, status_code=status.HTTP_201_CREATED)
def crear_categoria(data: CategoriaCreate, _: AdminUser, service: ServiceDep):
    try:
        return service.crear(data)
    except NombreDuplicado as e:
        raise _http(e) from e


@router.put("/{id}", response_model=CategoriaRead)
def actualizar_categoria(id: CategoriaId, data: CategoriaUpdate, _: AdminUser, service: ServiceDep):
    try:
        return service.actualizar(id, data)
    except (CategoriaNoEncontrada, NombreDuplicado) as e:
        raise _http(e) from e


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_categoria(id: CategoriaId, _: AdminUser, service: ServiceDep):
    try:
        service.eliminar(id)
    except CategoriaNoEncontrada as e:
        raise _http(e) from e
    return Response(status_code=status.HTTP_204_NO_CONTENT)
