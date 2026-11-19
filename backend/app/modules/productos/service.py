from app.modules.categorias.service import CategoriaNoEncontrada

from .models import Producto
from .schemas import (
    ProductoCreate,
    ProductoRead,
    ProductosPaginados,
    ProductoStockUpdate,
    ProductoUpdate,
)
from .unit_of_work import ProductoUnitOfWork

__all__ = ["CategoriaNoEncontrada", "ProductoNoEncontrado", "ProductoService"]


class ProductoNoEncontrado(Exception):
    def __init__(self, id: int) -> None:
        super().__init__(f"Producto {id} no encontrado")


class ProductoService:
    def __init__(self, uow: ProductoUnitOfWork) -> None:
        self.uow = uow

    def listar(
        self,
        skip: int,
        limit: int,
        search: str | None,
        categoria_id: int | None,
        disponible: bool | None,
    ) -> ProductosPaginados:
        with self.uow as uow:
            total, productos = uow.productos.search(skip, limit, search, categoria_id, disponible)
            return ProductosPaginados(
                total=total, items=[ProductoRead.model_validate(p) for p in productos]
            )

    def obtener(self, id: int) -> ProductoRead:
        with self.uow as uow:
            return ProductoRead.model_validate(self._buscar(uow, id))

    def crear(self, data: ProductoCreate) -> ProductoRead:
        with self.uow as uow:
            self._validar_categoria(uow, data.categoria_id)
            producto = uow.productos.add(Producto.model_validate(data))
            return ProductoRead.model_validate(producto)

    def actualizar(self, id: int, data: ProductoUpdate) -> ProductoRead:
        with self.uow as uow:
            producto = self._buscar(uow, id)
            cambios = data.model_dump(exclude_unset=True)
            if "categoria_id" in cambios:
                self._validar_categoria(uow, cambios["categoria_id"])
            producto.sqlmodel_update(cambios)
            uow.productos.add(producto)
            uow.session.refresh(producto)  # recarga la relación si cambió la categoría
            return ProductoRead.model_validate(producto)

    def actualizar_stock(self, id: int, data: ProductoStockUpdate) -> ProductoRead:
        with self.uow as uow:
            producto = self._buscar(uow, id)
            producto.sqlmodel_update(data.model_dump(exclude_unset=True))
            uow.productos.add(producto)
            return ProductoRead.model_validate(producto)

    def eliminar(self, id: int) -> None:
        # Baja lógica: activo = False. Los pedidos existentes conservan su copia de nombre y precio.
        with self.uow as uow:
            uow.productos.delete(self._buscar(uow, id))

    @staticmethod
    def _buscar(uow: ProductoUnitOfWork, id: int) -> Producto:
        # Un producto dado de baja se trata como inexistente
        producto = uow.productos.get_activo(id)
        if producto is None:
            raise ProductoNoEncontrado(id)
        return producto

    @staticmethod
    def _validar_categoria(uow: ProductoUnitOfWork, categoria_id: int) -> None:
        if uow.categorias.get_activa(categoria_id) is None:
            raise CategoriaNoEncontrada(categoria_id)
