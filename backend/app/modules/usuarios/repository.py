from collections.abc import Sequence

from sqlmodel import col, select

from app.core.base_repository import BaseRepository

from .models import Usuario


class UsuarioRepository(BaseRepository[Usuario]):
    model = Usuario
    # Baja lógica de usuarios: disabled = True
    campo_baja = "disabled"
    valor_baja = True

    def get_by_username(self, username: str) -> Usuario | None:
        return self.session.exec(select(Usuario).where(Usuario.username == username)).first()

    def get_by_email(self, email: str) -> Usuario | None:
        return self.session.exec(select(Usuario).where(Usuario.email == email)).first()

    def list_ordenados(self) -> Sequence[Usuario]:
        return self.session.exec(select(Usuario).order_by(col(Usuario.id))).all()
