from collections.abc import Sequence

from sqlmodel import col, func, select

from app.core.base_repository import BaseRepository

from .models import Categoria


class CategoriaRepository(BaseRepository[Categoria]):
    model = Categoria

    def get_by_nombre(self, nombre: str) -> Categoria | None:
        """Busca entre TODAS (activas o no): la baja lógica no libera el nombre."""
        stmt = select(Categoria).where(func.lower(Categoria.nombre) == nombre.strip().lower())
        return self.session.exec(stmt).first()

    def get_activa(self, id: int) -> Categoria | None:
        categoria = self.get_by_id(id)
        return categoria if categoria is not None and categoria.activo else None

    def list_activas(self) -> Sequence[Categoria]:
        stmt = select(Categoria).where(col(Categoria.activo).is_(True)).order_by(col(Categoria.nombre))
        return self.session.exec(stmt).all()
