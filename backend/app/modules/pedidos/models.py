from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.modules.productos.models import Producto
    from app.modules.usuarios.models import Usuario


def ahora() -> datetime:
    return datetime.now(timezone.utc)


class Pedido(SQLModel, table=True):
    """Un pedido no se borra: se cancela (no tiene campo de baja)."""

    id: int | None = Field(default=None, primary_key=True)
    usuario_id: int = Field(foreign_key="usuario.id", index=True)
    estado: str = Field(default="PENDIENTE", max_length=20, index=True)
    forma_pago: str = Field(max_length=20)  # EFECTIVO | TRANSFERENCIA
    direccion_entrega: str = Field(max_length=200)
    notas: str | None = Field(default=None)
    total: float = Field(default=0)  # Σ subtotales; fijo desde la creación
    created_at: datetime = Field(default_factory=ahora, sa_type=DateTime(timezone=True))
    updated_at: datetime = Field(default_factory=ahora, sa_type=DateTime(timezone=True))

    usuario: Optional["Usuario"] = Relationship(back_populates="pedidos")
    items: list["DetallePedido"] = Relationship(
        back_populates="pedido",
        sa_relationship_kwargs={"order_by": "DetallePedido.id"},
    )


class DetallePedido(SQLModel, table=True):
    """Línea inmutable: copia nombre y precio del producto al crear el pedido."""

    id: int | None = Field(default=None, primary_key=True)
    pedido_id: int = Field(foreign_key="pedido.id", index=True)
    producto_id: int = Field(foreign_key="producto.id", index=True)
    cantidad: int = Field(ge=1)
    nombre_producto: str = Field(max_length=150)
    precio_unitario: float
    subtotal: float  # precio_unitario × cantidad

    pedido: Optional[Pedido] = Relationship(back_populates="items")
    producto: Optional["Producto"] = Relationship(back_populates="detalles")
