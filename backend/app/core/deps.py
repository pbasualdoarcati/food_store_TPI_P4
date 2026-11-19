from collections.abc import Callable
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status

from app.core.database import session_factory
from app.core.security import decode_access_token
from app.modules.usuarios.schemas import UserPublic
from app.modules.usuarios.unit_of_work import UsuarioUnitOfWork

CUENTA_DESACTIVADA = "Cuenta de usuario desactivada"


def get_current_user(
    access_token: Annotated[str | None, Cookie()] = None,
) -> UserPublic:
    """Lee el JWT de la cookie HttpOnly, valida firma y expiración y carga el usuario."""
    no_autenticado = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autenticado o sesión expirada",
    )
    if not access_token:
        raise no_autenticado
    payload = decode_access_token(access_token)
    username = payload.get("sub") if payload else None
    if not username:
        raise no_autenticado
    with UsuarioUnitOfWork(session_factory) as uow:
        usuario = uow.usuarios.get_by_username(username)
        if usuario is None:
            raise no_autenticado
        # Se devuelve el schema: el objeto de tabla queda desligado al cerrar la sesión
        return UserPublic.model_validate(usuario)


def get_current_active_user(
    usuario: Annotated[UserPublic, Depends(get_current_user)],
) -> UserPublic:
    if usuario.disabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=CUENTA_DESACTIVADA)
    return usuario


def require_role(roles: list[str]) -> Callable[[UserPublic], UserPublic]:
    """Dependencia que exige que el usuario activo tenga uno de los roles indicados."""

    def verificar_rol(
        usuario: Annotated[UserPublic, Depends(get_current_active_user)],
    ) -> UserPublic:
        if usuario.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tenés permisos para realizar esta acción",
            )
        return usuario

    return verificar_rol


# Atajos para los routers
CurrentUser = Annotated[UserPublic, Depends(get_current_active_user)]
AdminUser = Annotated[UserPublic, Depends(require_role(["admin"]))]
