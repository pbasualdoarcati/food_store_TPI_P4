from sqlalchemy.exc import IntegrityError

from app.core.security import create_access_token, hash_password, verify_password
from app.modules.usuarios.models import Usuario
from app.modules.usuarios.unit_of_work import UsuarioUnitOfWork

from .schemas import UserCreate, UserPublic


class UsuarioDuplicado(Exception):
    def __init__(self, campo: str) -> None:
        super().__init__(f"Ya existe un usuario con ese {campo}")


class CredencialesInvalidas(Exception):
    def __init__(self) -> None:
        super().__init__("Usuario o contraseña incorrectos")


class CuentaDesactivada(Exception):
    def __init__(self) -> None:
        super().__init__("Cuenta de usuario desactivada")


class AuthService:
    def __init__(self, uow: UsuarioUnitOfWork) -> None:
        self.uow = uow

    def registrar(self, data: UserCreate) -> UserPublic:
        # El registro público siempre crea rol "user"
        with self.uow as uow:
            if uow.usuarios.get_by_username(data.username):
                raise UsuarioDuplicado("username")
            if uow.usuarios.get_by_email(str(data.email)):
                raise UsuarioDuplicado("email")
            usuario = Usuario(
                username=data.username,
                full_name=data.full_name,
                email=str(data.email),
                hashed_password=hash_password(data.password),
                role="user",
            )
            try:
                uow.usuarios.add(usuario)
            except IntegrityError:
                # Carrera: otro registro con el mismo username/email entró entre el chequeo y el
                # INSERT. El UNIQUE de la base lo frena; lo traducimos a 409 (el UoW hace rollback)
                raise UsuarioDuplicado("username o email") from None
            return UserPublic.model_validate(usuario)

    def login(self, username: str, password: str) -> str:
        """Valida credenciales y devuelve el JWT (el Router lo guarda en la cookie)."""
        with self.uow as uow:
            usuario = uow.usuarios.get_by_username(username)
            if usuario is None or not verify_password(password, usuario.hashed_password):
                raise CredencialesInvalidas()
            if usuario.disabled:
                raise CuentaDesactivada()
            return create_access_token(usuario.username)
