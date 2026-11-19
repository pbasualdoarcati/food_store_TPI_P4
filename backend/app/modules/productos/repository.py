from collections.abc import Sequence

from sqlalchemy.orm import selectinload
from sqlmodel import col, func, select

from app.core.base_repository import BaseRepository

from .models import Producto


class ProductoRepository(BaseRepository[Producto]):
    model = Producto

    def get_activo(self, id: int) -> Producto | None:
        producto = self.get_by_id(id)
        return producto if producto is not None and producto.activo else None

    def get_by_nombre(self, nombre: str) -> Producto | None:
        return self.session.exec(select(Producto).where(Producto.nombre == nombre)).first()

    def get_para_actualizar(self, id: int) -> Producto | None:
        """SELECT ... FOR UPDATE: bloquea la fila mientras se descuenta stock (en PostgreSQL)."""
        stmt = select(Producto).where(Producto.id == id).with_for_update()
        return self.session.exec(stmt).first()

    def search(
        self,
        skip: int = 0,
        limit: int = 20,
        search: str | None = None,
        categoria_id: int | None = None,
        disponible: bool | None = None,
    ) -> tuple[int, Sequence[Producto]]:
        """Listado paginado de productos ACTIVOS. Devuelve (total, página)."""
        filtros = [col(Producto.activo).is_(True)]
        if search:
            filtros.append(col(Producto.nombre).ilike(f"%{search.strip()}%"))
        if categoria_id is not None:
            filtros.append(Producto.categoria_id == categoria_id)
        if disponible is not None:
            filtros.append(Producto.disponible == disponible)

        total = self.session.exec(select(func.count()).select_from(Producto).where(*filtros)).one()
        stmt = (
            select(Producto)
            .where(*filtros)
            .options(selectinload(Producto.categoria))  # type: ignore[arg-type]
            .order_by(col(Producto.id))
            .offset(skip)
            .limit(limit)
        )
        return total, self.session.exec(stmt).all()
