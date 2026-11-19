from collections.abc import Sequence
from datetime import datetime

from sqlalchemy.orm import selectinload
from sqlmodel import col, func, select

from app.core.base_repository import BaseRepository

from .models import Pedido


class PedidoRepository(BaseRepository[Pedido]):
    model = Pedido
    campo_baja = None  # los pedidos no se borran: se cancelan

    def get_para_actualizar(self, id: int) -> Pedido | None:
        """SELECT ... FOR UPDATE: bloquea el pedido mientras cambia de estado (en PostgreSQL).

        Evita que dos cancelaciones simultáneas lean ambas "PENDIENTE" y restituyan el stock dos veces.
        """
        stmt = select(Pedido).where(Pedido.id == id).with_for_update()
        return self.session.exec(stmt).first()

    def list_by_usuario(
        self,
        usuario_id: int | None,
        skip: int = 0,
        limit: int = 20,
        estado: str | None = None,
    ) -> tuple[int, Sequence[Pedido]]:
        """Pedidos de un usuario (o de todos si usuario_id es None). Devuelve (total, página)."""
        filtros = []
        if usuario_id is not None:
            filtros.append(Pedido.usuario_id == usuario_id)
        if estado is not None:
            filtros.append(Pedido.estado == estado)

        total = self.session.exec(select(func.count()).select_from(Pedido).where(*filtros)).one()
        stmt = (
            select(Pedido)
            .where(*filtros)
            .options(selectinload(Pedido.items))  # type: ignore[arg-type]
            .order_by(col(Pedido.created_at).desc(), col(Pedido.id).desc())
            .offset(skip)
            .limit(limit)
        )
        return total, self.session.exec(stmt).all()

    def count_by_estado(self) -> dict[str, int]:
        """{estado: cantidad} con func.count agrupado por estado."""
        stmt = select(Pedido.estado, func.count(col(Pedido.id))).group_by(Pedido.estado)
        return {estado: cantidad for estado, cantidad in self.session.exec(stmt).all()}

    def sum_total_by_estado(self, estado: str) -> float:
        stmt = select(func.coalesce(func.sum(Pedido.total), 0)).where(Pedido.estado == estado)
        return float(self.session.exec(stmt).one())

    def count_desde(self, desde: datetime) -> int:
        stmt = select(func.count(col(Pedido.id))).where(Pedido.created_at >= desde)
        return self.session.exec(stmt).one()
