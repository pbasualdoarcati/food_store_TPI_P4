from .models import Categoria
from .repository import CategoriaRepository
from .schemas import CategoriaCreate, CategoriaRead, CategoriaUpdate
from .unit_of_work import CategoriaUnitOfWork


class CategoriaNoEncontrada(Exception):
    def __init__(self, id: int) -> None:
        super().__init__(f"Categoría {id} no encontrada")


class NombreDuplicado(Exception):
    def __init__(self, nombre: str) -> None:
        super().__init__(f"Ya existe una categoría con el nombre '{nombre}'")


class CategoriaService:
    def __init__(self, uow: CategoriaUnitOfWork) -> None:
        self.uow = uow

    def listar(self) -> list[CategoriaRead]:
        with self.uow as uow:
            return [CategoriaRead.model_validate(c) for c in uow.categorias.list_activas()]

    def obtener(self, id: int) -> CategoriaRead:
        with self.uow as uow:
            return CategoriaRead.model_validate(self._buscar(uow.categorias, id))

    def crear(self, data: CategoriaCreate) -> CategoriaRead:
        with self.uow as uow:
            if uow.categorias.get_by_nombre(data.nombre):
                raise NombreDuplicado(data.nombre)
            categoria = uow.categorias.add(Categoria.model_validate(data))
            return CategoriaRead.model_validate(categoria)

    def actualizar(self, id: int, data: CategoriaUpdate) -> CategoriaRead:
        with self.uow as uow:
            categoria = self._buscar(uow.categorias, id)
            cambios = data.model_dump(exclude_unset=True)
            if "nombre" in cambios:
                otra = uow.categorias.get_by_nombre(cambios["nombre"])
                if otra is not None and otra.id != categoria.id:
                    raise NombreDuplicado(cambios["nombre"])
            categoria.sqlmodel_update(cambios)
            uow.categorias.add(categoria)
            return CategoriaRead.model_validate(categoria)

    def eliminar(self, id: int) -> None:
        # Baja lógica: activo = False. No libera el nombre ni oculta sus productos.
        with self.uow as uow:
            categoria = self._buscar(uow.categorias, id)
            uow.categorias.delete(categoria)

    @staticmethod
    def _buscar(repo: CategoriaRepository, id: int) -> Categoria:
        # Una categoría dada de baja se trata como inexistente
        categoria = repo.get_activa(id)
        if categoria is None:
            raise CategoriaNoEncontrada(id)
        return categoria
