from collections.abc import Sequence
from typing import Any, Generic, TypeVar

from sqlmodel import Session, SQLModel, select


# TypeVar + Generic (en vez de la sintaxis class X[T] de 3.12) para soportar Python 3.11
T = TypeVar("T", bound=SQLModel)


class BaseRepository(Generic[T]):
    """Acceso genérico a una tabla. Nunca confirma la transacción: eso lo decide el Unit of Work.

    `delete` es una BAJA LÓGICA: pone `campo_baja = valor_baja` (por ejemplo
    activo = False). Si el modelo no admite baja (pedidos), `campo_baja` es None.
    """

    model: type[T]
    campo_baja: str | None = "activo"
    valor_baja: Any = False

    def __init__(self, session: Session) -> None:
        self.session = session

    def get_by_id(self, id: int) -> T | None:
        return self.session.get(self.model, id)

    def get_all(self, skip: int = 0, limit: int = 100) -> Sequence[T]:
        stmt = select(self.model).offset(skip).limit(limit)
        return self.session.exec(stmt).all()

    def add(self, obj: T) -> T:
        # flush envía el INSERT/UPDATE dentro de la transacción: el id ya queda disponible
        self.session.add(obj)
        self.session.flush()
        return obj

    def delete(self, obj: T) -> T:
        if self.campo_baja is None:
            raise NotImplementedError(f"{self.model.__name__} no admite baja")
        setattr(obj, self.campo_baja, self.valor_baja)
        return self.add(obj)
