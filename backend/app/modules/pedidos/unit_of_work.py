from app.core.unit_of_work import UnitOfWork
from app.modules.productos.repository import ProductoRepository

from .repository import PedidoRepository


class PedidoUnitOfWork(UnitOfWork):
    """Pedidos y productos sobre la MISMA sesión: el descuento y la restitución
    de stock se confirman (o se descartan) junto con el pedido."""

    pedidos: PedidoRepository
    productos: ProductoRepository

    def _init_repositories(self) -> None:
        self.pedidos = PedidoRepository(self.session)
        self.productos = ProductoRepository(self.session)
