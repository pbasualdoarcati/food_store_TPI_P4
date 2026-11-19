from datetime import datetime, timezone

from app.modules.productos.service import ProductoNoEncontrado
from app.modules.usuarios.schemas import UserPublic

from .models import DetallePedido, Pedido
from .schemas import (
    CambioEstado,
    PedidoCreate,
    PedidoRead,
    PedidosPaginados,
    ResumenPedidos,
)
from .unit_of_work import PedidoUnitOfWork

__all__ = ["ProductoNoEncontrado"]

# RN-02: máquina de estados. Los estados terminales no tienen transiciones.
TRANSICIONES: dict[str, set[str]] = {
    "PENDIENTE": {"EN_PREPARACION", "CANCELADO"},
    "EN_PREPARACION": {"ENTREGADO", "CANCELADO"},
    "ENTREGADO": set(),
    "CANCELADO": set(),
}


# ---------- Excepciones de dominio ----------
class PedidoNoEncontrado(Exception):
    def __init__(self, id: int) -> None:
        super().__init__(f"Pedido {id} no encontrado")


class PedidoAjeno(Exception):
    def __init__(self) -> None:
        super().__init__("No tenés permiso para acceder a este pedido")


class ProductoRepetido(Exception):
    def __init__(self, producto_id: int) -> None:
        super().__init__(f"El producto {producto_id} está repetido en el pedido")


class ProductoNoDisponible(Exception):
    def __init__(self, nombre: str) -> None:
        super().__init__(f"El producto '{nombre}' no está disponible")


class StockInsuficiente(Exception):
    def __init__(self, nombre: str, stock: int, pedido: int) -> None:
        super().__init__(
            f"Stock insuficiente para '{nombre}': disponible {stock}, solicitado {pedido}"
        )


class TransicionInvalida(Exception):
    def __init__(self, actual: str, nuevo: str) -> None:
        super().__init__(f"Transición inválida: {actual} → {nuevo}")


class PedidoNoCancelable(Exception):
    def __init__(self, estado: str) -> None:
        super().__init__(f"Solo se puede cancelar un pedido PENDIENTE (estado actual: {estado})")


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


class PedidoService:
    def __init__(self, uow: PedidoUnitOfWork) -> None:
        self.uow = uow

    # ---------- RN-01: crear ----------
    def crear(self, data: PedidoCreate, usuario: UserPublic) -> PedidoRead:
        with self.uow as uow:
            ids = [item.producto_id for item in data.items]
            for producto_id in ids:
                if ids.count(producto_id) > 1:
                    raise ProductoRepetido(producto_id)

            pedido = uow.pedidos.add(
                Pedido(
                    usuario_id=usuario.id,
                    estado="PENDIENTE",
                    forma_pago=data.forma_pago,
                    direccion_entrega=data.direccion_entrega,
                    notas=data.notas,
                    total=0,
                )
            )

            total = 0.0
            for item in data.items:
                # FOR UPDATE: evita que dos pedidos simultáneos vendan el mismo stock
                producto = uow.productos.get_para_actualizar(item.producto_id)
                if producto is None or not producto.activo:
                    raise ProductoNoEncontrado(item.producto_id)
                if not producto.disponible:
                    raise ProductoNoDisponible(producto.nombre)
                if producto.stock < item.cantidad:
                    raise StockInsuficiente(producto.nombre, producto.stock, item.cantidad)

                producto.stock -= item.cantidad
                subtotal = round(producto.precio_base * item.cantidad, 2)
                # Copia de nombre y precio: el pedido no cambia si el producto cambia (RN-05)
                pedido.items.append(
                    DetallePedido(
                        producto_id=producto.id,
                        cantidad=item.cantidad,
                        nombre_producto=producto.nombre,
                        precio_unitario=producto.precio_base,
                        subtotal=subtotal,
                    )
                )
                total += subtotal

            pedido.total = round(total, 2)
            uow.pedidos.add(pedido)
            # Se convierte dentro del with: después del commit el objeto queda expirado
            return PedidoRead.model_validate(pedido)

    # ---------- Consultas (RN-04) ----------
    def listar(
        self, usuario: UserPublic, skip: int, limit: int, estado: str | None
    ) -> PedidosPaginados:
        # El admin ve todos; el cliente solo los propios
        usuario_id = None if usuario.role == "admin" else usuario.id
        with self.uow as uow:
            total, pedidos = uow.pedidos.list_by_usuario(usuario_id, skip, limit, estado)
            return PedidosPaginados(
                total=total, items=[PedidoRead.model_validate(p) for p in pedidos]
            )

    def obtener(self, id: int, usuario: UserPublic) -> PedidoRead:
        with self.uow as uow:
            pedido = self._buscar(uow, id)
            if usuario.role != "admin" and pedido.usuario_id != usuario.id:
                raise PedidoAjeno()
            return PedidoRead.model_validate(pedido)

    # ---------- RN-02 / RN-03: cambio de estado (admin) ----------
    def cambiar_estado(self, id: int, data: CambioEstado) -> PedidoRead:
        with self.uow as uow:
            pedido = self._buscar(uow, id, bloquear=True)
            self._transicionar(uow, pedido, data.estado)
            return PedidoRead.model_validate(pedido)

    # ---------- RN-03 / RN-04: cancelación por el dueño ----------
    def cancelar(self, id: int, usuario: UserPublic) -> PedidoRead:
        with self.uow as uow:
            pedido = self._buscar(uow, id, bloquear=True)
            if pedido.usuario_id != usuario.id:
                raise PedidoAjeno()
            if pedido.estado != "PENDIENTE":
                raise PedidoNoCancelable(pedido.estado)
            self._transicionar(uow, pedido, "CANCELADO")
            return PedidoRead.model_validate(pedido)

    # ---------- Resumen del panel ----------
    def resumen(self) -> ResumenPedidos:
        # "Hoy" según la hora local del servidor, comparado en UTC (así se guardan las fechas)
        inicio_hoy = datetime.now().astimezone().replace(hour=0, minute=0, second=0, microsecond=0)
        with self.uow as uow:
            conteo = uow.pedidos.count_by_estado()
            return ResumenPedidos(
                pendientes=conteo.get("PENDIENTE", 0),
                en_preparacion=conteo.get("EN_PREPARACION", 0),
                entregados=conteo.get("ENTREGADO", 0),
                cancelados=conteo.get("CANCELADO", 0),
                pedidos_hoy=uow.pedidos.count_desde(inicio_hoy.astimezone(timezone.utc)),
                ingresos_entregados=round(uow.pedidos.sum_total_by_estado("ENTREGADO"), 2),
            )

    # ---------- Auxiliares ----------
    @staticmethod
    def _buscar(uow: PedidoUnitOfWork, id: int, bloquear: bool = False) -> Pedido:
        # bloquear=True para cambios de estado: serializa transiciones concurrentes del mismo pedido
        pedido = uow.pedidos.get_para_actualizar(id) if bloquear else uow.pedidos.get_by_id(id)
        if pedido is None:
            raise PedidoNoEncontrado(id)
        return pedido

    @staticmethod
    def _transicionar(uow: PedidoUnitOfWork, pedido: Pedido, nuevo: str) -> None:
        """Valida la transición ANTES de modificar el pedido; al cancelar restituye stock."""
        if nuevo not in TRANSICIONES[pedido.estado]:
            raise TransicionInvalida(pedido.estado, nuevo)
        if nuevo == "CANCELADO":
            # RN-03: misma transacción que el cambio de estado
            for item in pedido.items:
                producto = uow.productos.get_para_actualizar(item.producto_id)
                if producto is not None:
                    producto.stock += item.cantidad
                    uow.productos.add(producto)
        pedido.estado = nuevo
        pedido.updated_at = _ahora()
        uow.pedidos.add(pedido)
