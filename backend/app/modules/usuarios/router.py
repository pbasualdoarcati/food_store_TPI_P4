from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status

from app.core.database import session_factory
from app.core.deps import AdminUser

from .schemas import UserPublic
from .service import AutoDesactivacion, UsuarioNoEncontrado, UsuarioService
from .unit_of_work import UsuarioUnitOfWork

router = APIRouter(prefix="/admin/usuarios", tags=["usuarios (admin)"])


def get_usuario_service() -> UsuarioService:
    return UsuarioService(UsuarioUnitOfWork(session_factory))


ServiceDep = Annotated[UsuarioService, Depends(get_usuario_service)]
UsuarioId = Annotated[int, Path(gt=0)]


@router.get("", response_model=list[UserPublic])
def listar_usuarios(_: AdminUser, service: ServiceDep):
    return service.listar()


@router.post("/{id}/activar", response_model=UserPublic)
def activar_usuario(id: UsuarioId, _: AdminUser, service: ServiceDep):
    try:
        return service.activar(id)
    except UsuarioNoEncontrado as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(e)) from e


@router.post("/{id}/desactivar", response_model=UserPublic)
def desactivar_usuario(id: UsuarioId, admin: AdminUser, service: ServiceDep):
    try:
        return service.desactivar(id, admin.id)
    except UsuarioNoEncontrado as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except AutoDesactivacion as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
