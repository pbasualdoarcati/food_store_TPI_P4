"""Carga inicial idempotente: python -m app.db.seed

Crea el admin, un cliente de prueba, categorías y productos solo si no existen
(se buscan por username / nombre), así que se puede ejecutar varias veces.
"""

from app.core.database import create_all_tables, session_factory
from app.core.security import hash_password
from app.core.unit_of_work import UnitOfWork
from app.modules.categorias.models import Categoria
from app.modules.categorias.repository import CategoriaRepository
from app.modules.productos.models import Producto
from app.modules.productos.repository import ProductoRepository
from app.modules.usuarios.models import Usuario
from app.modules.usuarios.repository import UsuarioRepository

USUARIOS = [
    {
        "username": "admin",
        "full_name": "Administrador Food Store",
        "email": "admin@foodstore.com",
        "password": "Admin1234!",
        "role": "admin",
    },
    {
        "username": "cliente",
        "full_name": "Cliente de Prueba",
        "email": "cliente@foodstore.com",
        "password": "Cliente1234!",
        "role": "user",
    },
]

CATEGORIAS = [
    {"nombre": "Pizzas", "descripcion": "Pizzas a la piedra"},
    {"nombre": "Hamburguesas", "descripcion": "Hamburguesas caseras con papas"},
    {"nombre": "Empanadas", "descripcion": "Empanadas al horno"},
    {"nombre": "Bebidas", "descripcion": "Gaseosas, aguas y cervezas"},
]


def _img(texto: str) -> str:
    return f"https://placehold.co/600x400?text={texto.replace(' ', '+')}"


# (categoría, nombre, descripción, precio, stock)
PRODUCTOS = [
    ("Pizzas", "Pizza Muzzarella", "Salsa de tomate, muzzarella y aceitunas", 9500, 20),
    ("Pizzas", "Pizza Napolitana", "Muzzarella, tomate en rodajas y ajo", 10500, 15),
    ("Pizzas", "Pizza Fugazzeta", "Cebolla y abundante muzzarella", 11000, 10),
    ("Hamburguesas", "Hamburguesa Clásica", "Carne, lechuga, tomate y queso", 8500, 25),
    ("Hamburguesas", "Hamburguesa Doble Cheddar", "Doble carne, cheddar y panceta", 11500, 12),
    ("Empanadas", "Empanada de Carne", "Carne cortada a cuchillo", 1500, 60),
    ("Empanadas", "Empanada de Jamón y Queso", "Jamón cocido y muzzarella", 1400, 50),
    ("Empanadas", "Empanada de Humita", "Choclo cremoso", 1400, 40),
    ("Bebidas", "Gaseosa Cola 1.5 L", "Botella de 1.5 litros", 3200, 30),
    ("Bebidas", "Agua Mineral 500 ml", "Sin gas", 1200, 40),
]


def seed() -> None:
    create_all_tables()
    creados = {"usuarios": 0, "categorias": 0, "productos": 0}

    # El Unit of Work confirma todo junto al salir del with
    with UnitOfWork(session_factory) as uow:
        usuarios = UsuarioRepository(uow.session)
        categorias = CategoriaRepository(uow.session)
        productos = ProductoRepository(uow.session)

        for u in USUARIOS:
            if usuarios.get_by_username(u["username"]) is None:
                usuarios.add(
                    Usuario(
                        username=u["username"],
                        full_name=u["full_name"],
                        email=u["email"],
                        hashed_password=hash_password(u["password"]),
                        role=u["role"],
                    )
                )
                creados["usuarios"] += 1

        por_nombre: dict[str, Categoria] = {}
        for c in CATEGORIAS:
            categoria = categorias.get_by_nombre(c["nombre"])
            if categoria is None:
                categoria = categorias.add(Categoria(**c))
                creados["categorias"] += 1
            por_nombre[c["nombre"]] = categoria

        for cat, nombre, descripcion, precio, stock in PRODUCTOS:
            if productos.get_by_nombre(nombre) is None:
                productos.add(
                    Producto(
                        categoria_id=por_nombre[cat].id,
                        nombre=nombre,
                        descripcion=descripcion,
                        precio_base=precio,
                        imagen_url=_img(nombre),
                        stock=stock,
                    )
                )
                creados["productos"] += 1

    print(
        "Seed OK - creados: "
        f"{creados['usuarios']} usuarios, {creados['categorias']} categorias, "
        f"{creados['productos']} productos (lo existente no se duplica)."
    )
    print("Admin: admin / Admin1234!  |  Cliente: cliente / Cliente1234!")


if __name__ == "__main__":
    seed()
