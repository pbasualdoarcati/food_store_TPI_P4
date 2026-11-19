from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.config import settings
from app.core.database import session_factory
from app.core.deps import CurrentUser
from app.modules.usuarios.unit_of_work import UsuarioUnitOfWork

from .schemas import MensajeRespuesta, UserCreate, UserPublic
from .service import AuthService, CredencialesInvalidas, CuentaDesactivada, UsuarioDuplicado

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_NAME = "access_token"


def get_auth_service() -> AuthService:
    return AuthService(UsuarioUnitOfWork(session_factory))


ServiceDep = Annotated[AuthService, Depends(get_auth_service)]


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def registrar(data: UserCreate, service: ServiceDep):
    try:
        return service.registrar(data)
    except UsuarioDuplicado as e:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(e)) from e


@router.post("/token", response_model=MensajeRespuesta)
def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    response: Response,
    service: ServiceDep,
):
    try:
        token = service.login(form.username, form.password)
    except CredencialesInvalidas as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=str(e)) from e
    except CuentaDesactivada as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    # El token viaja SOLO en la cookie HttpOnly: el frontend nunca lo lee
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=False,  # en producción con HTTPS: True
        path="/",
    )
    return MensajeRespuesta(message="Login exitoso")


@router.post("/logout", response_model=MensajeRespuesta)
def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME, path="/", httponly=True, samesite="lax")
    return MensajeRespuesta(message="Logout exitoso")


@router.get("/me", response_model=UserPublic)
def me(usuario: CurrentUser):
    return usuario
