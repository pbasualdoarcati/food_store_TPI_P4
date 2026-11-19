from .models import Usuario
from .schemas import UserPublic
from .unit_of_work import UsuarioUnitOfWork


class UsuarioNoEncontrado(Exception):
    def __init__(self, id: int) -> None:
        super().__init__(f"Usuario {id} no encontrado")


class AutoDesactivacion(Exception):
    def __init__(self) -> None:
        super().__init__("Un administrador no puede desactivarse a sí mismo")


class UsuarioService:
    def __init__(self, uow: UsuarioUnitOfWork) -> None:
        self.uow = uow

    def listar(self) -> list[UserPublic]:
        with self.uow as uow:
            return [UserPublic.model_validate(u) for u in uow.usuarios.list_ordenados()]

    def activar(self, id: int) -> UserPublic:
        # Idempotente: si ya estaba activo responde igual
        with self.uow as uow:
            usuario = self._buscar(uow, id)
            usuario.disabled = False
            uow.usuarios.add(usuario)
            return UserPublic.model_validate(usuario)

    def desactivar(self, id: int, id_actual: int) -> UserPublic:
        if id == id_actual:
            raise AutoDesactivacion()
        with self.uow as uow:
            usuario = self._buscar(uow, id)
            uow.usuarios.delete(usuario)  # baja lógica: disabled = True (idempotente)
            return UserPublic.model_validate(usuario)

    @staticmethod
    def _buscar(uow: UsuarioUnitOfWork, id: int) -> Usuario:
        usuario = uow.usuarios.get_by_id(id)
        if usuario is None:
            raise UsuarioNoEncontrado(id)
        return usuario
