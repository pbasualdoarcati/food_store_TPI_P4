from app.core.unit_of_work import UnitOfWork
from app.modules.categorias.repository import CategoriaRepository

from .repository import ProductoRepository


class ProductoUnitOfWork(UnitOfWork):
    """Productos y categorías sobre la misma sesión (para validar la categoría)."""

    productos: ProductoRepository
    categorias: CategoriaRepository

    def _init_repositories(self) -> None:
        self.productos = ProductoRepository(self.session)
        self.categorias = CategoriaRepository(self.session)
