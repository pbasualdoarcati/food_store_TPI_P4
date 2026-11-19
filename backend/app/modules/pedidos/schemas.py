from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import AfterValidator
from sqlmodel import Field, SQLModel

EstadoPedido = Literal["PENDIENTE", "EN_PREPARACION", "ENTREGADO", "CANCELADO"]
FormaPago = Literal["EFECTIVO", "TRANSFERENCIA"]


def _como_utc(valor: datetime) -> datetime:
    # SQLite devuelve fechas sin zona: se guardaron en UTC, así que se marcan como UTC
    return valor.replace(tzinfo=timezone.utc) if valor.tzinfo is None else valor


FechaUTC = Annotated[datetime, AfterValidator(_como_utc)]


class ItemPedidoCreate(SQLModel):
    producto_id: int = Field(gt=0)
    cantidad: int = Field(ge=1)


class PedidoCreate(SQLModel):
    # RN-06: forma_pago y direccion_entrega se validan en el schema
    items: list[ItemPedidoCreate] = Field(min_length=1)
    forma_pago: FormaPago
    direccion_entrega: str = Field(min_length=5, max_length=200)
    notas: str | None = Field(default=None, max_length=500)


class CambioEstado(SQLModel):
    estado: EstadoPedido


class DetallePedidoRead(SQLModel):
    producto_id: int
    nombre_producto: str
    precio_unitario: float
    cantidad: int
    subtotal: float


class PedidoRead(SQLModel):
    id: int
    usuario_id: int
    estado: EstadoPedido
    forma_pago: FormaPago
    direccion_entrega: str
    notas: str | None
    total: float
    created_at: FechaUTC
    updated_at: FechaUTC
    items: list[DetallePedidoRead]


class PedidosPaginados(SQLModel):
    total: int
    items: list[PedidoRead]


class ResumenPedidos(SQLModel):
    pendientes: int
    en_preparacion: int
    entregados: int
    cancelados: int
    pedidos_hoy: int
    ingresos_entregados: float
