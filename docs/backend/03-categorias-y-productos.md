# 03 - Categorías y productos

Archivos en `app/modules/categorias/` y `app/modules/productos/`: `models.py`, `schemas.py`, `repository.py`, `unit_of_work.py`, `service.py`, `router.py`.

> **Cómo leer este doc para el parcial:** cada entrada responde cuatro cosas: **qué hace**, **por qué lo planteamos así** (distinguiendo lo que *exige la consigna* de lo que fue *decisión nuestra*), **qué alternativa descartamos** y **qué decir en voz alta** si te lo preguntan. Si solo te acordás de una idea: *el Router traduce HTTP, el Service tiene las reglas, el Repository solo habla con la base, y el Unit of Work decide el commit.*

## 1. Reglas del dominio (y de dónde salen)

- Lecturas **públicas** (sin sesión) que devuelven solo registros **activos**. *Lo exige la consigna (pág. 3 "API de catálogo" y tablas de endpoints, págs. 12-13).*
- Escrituras solo **admin** (`AdminUser`). *Consigna, tabla de roles (pág. 6) y criterio 4.*
- Baja lógica: `DELETE` responde **204** y pone `activo = False`. *Consigna (págs. 4-5; criterio 5 resta por "borrado físico").*
- Un registro dado de baja se trata como **inexistente**: detalle, PUT, PATCH y DELETE -> **404**. *Decisión nuestra, coherente con "lecturas devuelven solo activos".*
- La baja de una categoría **no libera su nombre único** ni **oculta sus productos**. *Decisión nuestra sobre algo que la consigna no define; la justificación está en `get_by_nombre`.*

**Idea de fondo:** ¿por qué baja lógica y no borrado físico? Porque `DetallePedido.producto_id` es FK a `Producto`: si borrás la fila, o la base rechaza el borrado o dejás pedidos históricos huérfanos. Además perdés el historial. (Es exactamente lo que nos descontaron en el TP8: usamos `session.delete`.)

---

## 2. Categorías

### `Categoria(SQLModel, table=True)` — `categorias/models.py`
**Qué hace:** define la tabla `categoria`: `id`, `nombre` (único, indexado, max 100), `descripcion` (opcional), `activo` (default `True`) y la relación `productos` <-> `Producto.categoria`.
**Por qué lo planteamos así:** los campos y la baja lógica con `activo` los exige la consigna (págs. 4-5, tabla de entidades), igual que `nombre` único. El `index=True` es decisión nuestra: buscamos por nombre al crear/renombrar. El `import` de `Producto` está bajo `TYPE_CHECKING` para **evitar el import circular** (productos importa categorías y viceversa): solo se usa para tipado y SQLModel resuelve el string `"Producto"` en runtime.
**Alternativa descartada:** garantizar la unicidad solo en el Service (sin `unique=True`): dos requests simultáneos podrían crear el mismo nombre. Con la restricción en la base, la integridad no depende de que el código se acuerde de chequear. Tampoco usamos `CHECK` porque la consigna dice que largos y valores se validan en schemas y Service (pág. 4).
**Si te preguntan en el parcial:** "Puse `unique` en la columna para que la base garantice la unicidad aunque falle el código, y además chequeo en el Service para devolver un 409 prolijo en vez de un error de integridad. `activo` es la baja lógica que pide la consigna."

### `CategoriaCreate` — `categorias/schemas.py`
**Qué hace:** schema de entrada del POST: `nombre` de 2 a 100 caracteres y `descripcion` opcional.
**Por qué lo planteamos así:** *lo exige la consigna* (pág. 14: "nombre 2 a 100 caracteres"). Validamos en el schema porque el error se corta en el borde y FastAPI responde **422** solo. Usamos un schema separado del modelo de tabla porque *nunca se expone un modelo de tabla* (pág. 14): el cliente no debería poder mandar `id` ni `activo`.
**Alternativa descartada:** usar `Categoria` (`table=True`) como body: permite mass assignment (el cliente setea `id` o `activo`) y SQLModel **no valida** los campos de modelos de tabla al instanciarlos.
**Si te preguntan en el parcial:** "Separé el schema de entrada del modelo de tabla para validar en el borde con Pydantic y para que el cliente no pueda mandar campos que no le corresponden."

### `CategoriaUpdate` y `nombre_no_nulo(cls, v)` — `categorias/schemas.py`
**Qué hace:** schema del PUT. Todos los campos son opcionales, así se puede mandar solo la descripción. El `@field_validator("nombre")` rechaza un `nombre` explícitamente `null`.
**Por qué lo planteamos así:** la consigna define `PUT /categorias/{id}` "Actualiza" con `CategoriaUpdate` (págs. 12 y 14); elegimos **PUT parcial** (solo se tocan los campos enviados), igual que en productos ("Actualiza los campos enviados", pág. 13). El validator distingue **omitir** el campo (válido: no se toca) de **mandar `null`** (inválido: `nombre` es obligatorio en la tabla y un `null` daría un 500 en la base). Gotcha: los validators de Pydantic **no corren sobre valores por defecto**, por eso omitirlo no dispara el error.
**Alternativa descartada:** PUT "completo" (todos obligatorios): obliga al frontend a reenviar todo para cambiar una descripción. O no validar el `null` y dejar que reviente la base (`NOT NULL`) con un 500 en vez de un 422 claro.
**Si te preguntan en el parcial:** "Hice el PUT parcial: campos opcionales y solo actualizo los que llegan. El validator evita `nombre: null`, porque omitirlo es válido pero null no, ya que la columna es obligatoria."

### `CategoriaRead` — `categorias/schemas.py`
**Qué hace:** schema de salida: `id`, `nombre`, `descripcion`, `activo`.
**Por qué lo planteamos así:** *lo exige la consigna* (pág. 14: "+ id, activo en Read"). Se arma con `model_validate(objeto)` **dentro del `with`** del Service (pág. 14), porque tras el commit el objeto de tabla queda expirado y desligado de la sesión.
**Alternativa descartada:** devolver el modelo de tabla: se filtran campos internos y se arriesga un `DetachedInstanceError` al serializar fuera de la sesión.
**Si te preguntan en el parcial:** "El schema de lectura es un DTO plano: lo armo dentro del `with` mientras la sesión está viva y el Router recibe un objeto que no depende de la base."

### `CategoriaRepository(BaseRepository[Categoria])` — `categorias/repository.py`
**Qué hace:** hereda el CRUD genérico (`get_by_id`, `get_all`, `add`, `delete`) y agrega consultas propias. `model = Categoria` le dice al genérico sobre qué tabla trabajar.
**Por qué lo planteamos así:** la consigna pide `BaseRepository[T]` (pág. 3, criterio 3). Heredar evita repetir el CRUD en cada módulo. El `delete` heredado ya es **baja lógica** (`activo = False`) porque `campo_baja = "activo"` por defecto. El repositorio **no contiene reglas de negocio** (el criterio 3 resta por "repositorios con reglas de negocio") ni hace commit: eso es del Unit of Work.
**Alternativa descartada:** un repositorio escrito desde cero por módulo, con `select(...)` repetido: duplicación y riesgo de que alguno haga `commit`.
**Si te preguntan en el parcial:** "El repositorio solo accede a datos; no commitea ni decide reglas. Heredo el CRUD genérico y agrego solo las consultas específicas."

### `get_by_nombre(self, nombre: str) -> Categoria | None` — `categorias/repository.py`
**Qué hace:** busca una categoría comparando `lower(nombre)` con `nombre.strip().lower()`, entre **todas** (activas o no), y devuelve la primera o `None`.
**Por qué lo planteamos así:** *decisión nuestra* (la consigna pide nombre único, no define mayúsculas ni baja). Buscamos entre todas porque **la baja lógica no libera el nombre**: la fila sigue en la tabla con `unique=True`; si permitiéramos crear otra igual, la base daría un error de integridad (500). Así devolvemos un 409 limpio (el `.http` #17 lo prueba). Comparamos en minúsculas para que "pizzas" y "Pizzas" cuenten como duplicadas. (Detalle honesto: comparamos con `strip()` pero guardamos el nombre tal como llegó.)
**Alternativa descartada:** filtrar por `activo = True`: permitiría "crear" un duplicado de una categoría dada de baja y chocaría con el `unique`. O comparar con `==` (case sensitive): deja pasar "PIZZAS".
**Si te preguntan en el parcial:** "Busco entre todas, incluso las dadas de baja, porque la fila sigue existiendo y la restricción única de la base sigue aplicando; por eso la baja lógica no libera el nombre."

### `get_activa(self, id: int) -> Categoria | None` — `categorias/repository.py`
**Qué hace:** llama a `get_by_id` y devuelve la categoría solo si existe **y** está activa; si no, `None`.
**Por qué lo planteamos así:** implementa "una categoría dada de baja se trata como inexistente" (404). Es una **consulta** ("dame la activa") y por eso va en el repositorio; el Service decide qué hacer con el `None` (lanzar `CategoriaNoEncontrada`). Lo reutiliza productos para validar la categoría.
**Alternativa descartada:** repetir el `if activo` en cada método del Service o en el Router: lógica duplicada que alguien olvida copiar.
**Si te preguntan en el parcial:** "Centralicé el 'existe y está activa' en un método, así detalle, PUT, DELETE y la validación de productos tratan una baja como inexistente de forma consistente."

### `list_activas(self) -> Sequence[Categoria]` — `categorias/repository.py`
**Qué hace:** `select` de categorías con `activo IS TRUE`, ordenadas por nombre.
**Por qué lo planteamos así:** *la consigna exige* solo activas (pág. 12). El `order_by(nombre)` es decisión nuestra: sin `ORDER BY` el orden SQL no está garantizado, y para un listado/dropdown conviene alfabético y estable.
**Alternativa descartada:** `get_all` y filtrar en Python: se traen filas que después se descartan; el filtro corresponde a la base.
**Si te preguntan en el parcial:** "Filtro en la consulta, no en memoria, y ordeno por nombre porque sin `ORDER BY` el orden no está garantizado."

### `CategoriaUnitOfWork._init_repositories(self)` — `categorias/unit_of_work.py`
**Qué hace:** hereda de `UnitOfWork` y crea `self.categorias = CategoriaRepository(self.session)` con la sesión que el UoW abrió en `__enter__`.
**Por qué lo planteamos así:** *lo exige la consigna* (UoW base + uno por módulo, pág. 3, criterio 3). Cada módulo declara solo los repositorios que necesita y **todos comparten la misma sesión**, o sea la misma transacción.
**Alternativa descartada:** que el Service cree el repositorio y maneje la sesión: mezcla capas y es donde aparecen los `session.commit()` en el Service, que el criterio 3 penaliza.
**Si te preguntan en el parcial:** "El Unit of Work abre la sesión, arma los repositorios con esa sesión y al salir del `with` decide commit o rollback. El Service nunca toca la sesión."

### `CategoriaNoEncontrada(id)` y `NombreDuplicado(nombre)` — `categorias/service.py`
**Qué hacen:** excepciones de dominio con el mensaje armado en `__init__`. La primera se mapea a 404 y la segunda a 409.
**Por qué lo planteamos así:** *lo exige la consigna* (pág. 11: "El Service los produce lanzando excepciones de dominio definidas en su service.py; el Router las captura con try/except"). El Service no importa FastAPI: la lógica no sabe nada de HTTP.
**Alternativa descartada:** `raise HTTPException(404)` en el Service: acopla el negocio al protocolo. (La consigna lo permite solo en auth/usuarios.)
**Si te preguntan en el parcial:** "El Service lanza excepciones de negocio y el Router las traduce a códigos HTTP. Así el Service no depende de FastAPI."

### `CategoriaService.listar(self) -> list[CategoriaRead]` — `categorias/service.py`
**Qué hace:** abre `with self.uow as uow`, pide `list_activas()` y convierte cada una a `CategoriaRead`.
**Por qué lo planteamos así:** patrón de la consigna (pág. 3): el Service abre el `with`, aplica reglas y **devuelve el schema dentro del bloque**.
**Alternativa descartada:** devolver modelos y convertir en el Router: usar atributos fuera de la sesión puede dar `DetachedInstanceError`.
**Si te preguntan en el parcial:** "Convierto a schema dentro del `with`, con la sesión abierta; el Router recibe datos planos."

### `CategoriaService.obtener(self, id: int) -> CategoriaRead` — `categorias/service.py`
**Qué hace:** busca con `_buscar` (404 si no existe o está inactiva) y devuelve `CategoriaRead`.
**Por qué lo planteamos así:** consigna: `GET /categorias/{id}` -> 200 o 404 (pág. 12). Usa `_buscar` para no repetir la regla "activa".
**Alternativa descartada:** devolver `None` y que el Router decida: el Router terminaría con lógica de negocio.
**Si te preguntan en el parcial:** "Reutilizo `_buscar` para que 'inexistente' y 'dada de baja' den el mismo 404."

### `CategoriaService.crear(self, data: CategoriaCreate) -> CategoriaRead` — `categorias/service.py`
**Qué hace:** verifica con `get_by_nombre` que el nombre no exista (aunque esté de baja); si existe lanza `NombreDuplicado`. Si no, convierte `data` a `Categoria` con `model_validate`, lo guarda con `add` (hace `flush`, entonces ya tiene `id`) y devuelve `CategoriaRead`.
**Por qué lo planteamos así:** consigna: POST -> 201, 409 si el nombre se repite (pág. 12). Chequeamos *antes* de insertar para devolver un 409 controlado; si dejáramos que la base lo rechace, el `IntegrityError` saltaría recién en el `commit` del `__exit__` (fuera de nuestro `try/except` del Router) y terminaría en 500. Es **regla de negocio**, por eso vive en el Service y no en el repositorio. (Limitación honesta: entre el chequeo y el commit, dos requests simultáneos podrían colarse; ahí protege el `unique` de la base.)
**Alternativa descartada:** capturar `IntegrityError`: aparece en el commit y es difícil de mapear; además el mensaje varía según la base (SQLite/PostgreSQL).
**Si te preguntan en el parcial:** "Primero chequeo el duplicado y lanzo `NombreDuplicado` para devolver 409; la restricción única de la base queda como red de seguridad ante una carrera."

### `CategoriaService.actualizar(self, id: int, data: CategoriaUpdate) -> CategoriaRead` — `categorias/service.py`
**Qué hace:** busca la categoría (404 si no está activa); arma `cambios = data.model_dump(exclude_unset=True)`; si viene `nombre`, verifica que no lo tenga **otra** categoría (`otra.id != categoria.id`); aplica `sqlmodel_update(cambios)`, `add` y devuelve `CategoriaRead`.
**Por qué lo planteamos así:** consigna: PUT -> 200/404/409 (pág. 12). `exclude_unset=True` es el corazón del PUT parcial: sin él los omitidos llegarían como `None` y pisarían los datos. El chequeo `otra.id != categoria.id` permite "renombrar" a su propio nombre (o cambiar mayúsculas) sin un 409 falso.
**Alternativa descartada:** `model_dump()` sin `exclude_unset` (borrás campos no enviados); o no excluir el propio id (un PUT con el mismo nombre daría 409 contra sí misma).
**Si te preguntan en el parcial:** "Uso `exclude_unset` para actualizar solo lo que mandó el cliente, y al validar el nombre excluyo la propia categoría para que no choque consigo misma."

### `CategoriaService.eliminar(self, id: int) -> None` — `categorias/service.py`
**Qué hace:** busca la categoría activa (404 si no) y llama a `uow.categorias.delete(categoria)`, que hace `activo = False` y `flush`. No devuelve nada.
**Por qué lo planteamos así:** consigna: baja lógica, 204 sin cuerpo, 404 (pág. 12). Baja lógica por las FK de `Producto` y el historial. Decidimos que **no oculta sus productos** ni libera el nombre: regla simple y predecible (la consigna no pide cascada). Un segundo DELETE da 404 porque `_buscar` ya no la ve (`.http` #16).
**Alternativa descartada:** `session.delete(obj)` (físico): rompe FKs de productos, pierde historial y es lo que nos descontó el profe en el TP8. O dar de baja en cascada a los productos: más sorpresivo y no lo pide la consigna.
**Si te preguntan en el parcial:** "El DELETE solo cambia `activo` a `False`. Eso conserva integridad referencial e historial; por eso un segundo DELETE responde 404."

### `CategoriaService._buscar(repo, id)` (staticmethod) — `categorias/service.py`
**Qué hace:** pide `get_activa(id)` y lanza `CategoriaNoEncontrada` si es `None`.
**Por qué lo planteamos así:** *decisión nuestra* para no repetir en `obtener`, `actualizar` y `eliminar` la regla "inactiva = inexistente". Es `staticmethod` porque no usa `self`.
**Alternativa descartada:** copiar el `if` en cada método: tres lugares a mantener y un olvido produce un bug de consistencia.
**Si te preguntan en el parcial:** "Es un helper privado que concentra 'activa o 404' en un único lugar."

### `router.py` de categorías (prefijo `/categorias`) — piezas auxiliares
- `get_categoria_service()` arma `CategoriaService(CategoriaUnitOfWork(session_factory))`. **Por qué:** *lo exige la consigna* ("el Router obtiene el Service con Depends y no abre el Unit of Work", pág. 3). Pasamos `session_factory` (una función que crea sesiones) y no una sesión abierta, porque el UoW abre la sesión recién al entrar al `with`. **Alternativa descartada:** inyectar `Session` con `Depends` en el Router: el Router terminaría manejando transacciones.
- `ServiceDep` y `CategoriaId = Annotated[int, Path(gt=0)]`: alias reutilizables; `gt=0` rechaza ids inválidos con 422 sin llegar a la base.
- `_http(error)`: `CategoriaNoEncontrada` -> 404, cualquier otra -> 409. **Por qué:** concentra el mapeo excepción -> código en un lugar (consigna, tabla de excepciones, pág. 11).

### Endpoints de categorías — `categorias/router.py`
**Qué hacen:** `listar_categorias`, `detalle_categoria`, `crear_categoria` (201), `actualizar_categoria` y `eliminar_categoria` (204). Cada uno llama al Service, captura las excepciones de dominio y las convierte con `_http`.

| Método y ruta | Acceso | Éxito | Errores propios |
|---|---|---|---|
| `GET /categorias` | público | 200 `list[CategoriaRead]` | - |
| `GET /categorias/{id}` | público | 200 | 404 |
| `POST /categorias` | admin | **201** | 409 |
| `PUT /categorias/{id}` | admin | 200 | 404, 409 |
| `DELETE /categorias/{id}` | admin | **204** sin cuerpo | 404 |

**Por qué lo planteamos así:** verbos, códigos y accesos *los exige la consigna* (tabla pág. 12). Las lecturas no piden usuario (públicas); las escrituras reciben `_: AdminUser`, una dependencia que da 401 sin sesión y 403 si no es admin; se nombra `_` porque no usamos el valor, solo queremos que corra la verificación. El Router **no tiene lógica de negocio, no abre el UoW ni commitea**. `eliminar_categoria` termina con `return Response(status_code=204)`: un 204 **no puede tener cuerpo**; si devolviéramos `None`, FastAPI serializaría `null`.
**Alternativa descartada:** chequear el rol dentro del Service con `if usuario.role != "admin"`: duplica permisos en cada método; con `AdminUser` el permiso se declara en la firma y se ve en `/docs`.
**Si te preguntan en el parcial:** "El Router solo declara ruta, permiso y código; delega todo al Service y traduce excepciones. El 204 lo devuelvo con `Response` explícito porque no debe llevar cuerpo."

---

## 3. Productos

### `Producto(SQLModel, table=True)` — `productos/models.py`
**Qué hace:** tabla `producto`: `id`, `categoria_id` (FK `categoria.id`, indexado), `nombre` (indexado, 150), `descripcion`, `precio_base` (`ge=0`), `imagen_url`, `stock` (default 0, `ge=0`), `disponible` (default `True`), `activo` (default `True`). Relaciones: `categoria` <-> `Categoria.productos` y `detalles` <-> `DetallePedido.producto`.
**Por qué lo planteamos así:** campos y defaults *los exige la consigna* (págs. 4-5). Hay **dos banderas distintas a propósito**: `activo` = baja lógica (el admin lo "borró": es inexistente) y `disponible` = hoy no se vende pero sigue en el catálogo (en pedidos da 400 y no 404). `imagen_url` es un **string con URL**, no un archivo: la consigna no pide subir binarios. Los índices en `categoria_id` y `nombre` aceleran el filtro por categoría y la búsqueda (decisión nuestra). Los montos son `float` porque la consigna lo fija (pág. 4).
> `Field(ge=0)` en un modelo `table=True` **no** valida al instanciar (SQLModel no valida en tablas); la validación real está en los schemas. La consigna lo dice: sin CHECK en BD, se valida en schemas y Service.
**Alternativa descartada:** un solo campo para "no se vende": perderías distinguir "producto retirado" de "agotado temporalmente". `Decimal` sería más exacto para dinero, pero la consigna fija float.
**Si te preguntan en el parcial:** "`activo` es la baja lógica y `disponible` es una pausa de venta; son conceptos distintos. La consigna fija montos como float y la imagen como URL."

### `ProductoCreate` — `productos/schemas.py`
**Qué hace:** entrada del POST: `nombre` 2..150, `descripcion`, `precio_base >= 0`, `imagen_url` (max 500), `stock >= 0` (default 0), `disponible` (default `True`), `categoria_id > 0`.
**Por qué lo planteamos así:** `precio_base >= 0` y `stock >= 0` *los exige la consigna* (pág. 14). El resto (largos, `gt=0`) es decisión nuestra para cortar datos absurdos en el borde con un 422. `categoria_id` va en el cuerpo ("Crea con categoria_id", pág. 13).
**Alternativa descartada:** `categoria_id` opcional: un producto sin categoría rompe la relación 1:N obligatoria y el `ProductoRead` anidado.
**Si te preguntan en el parcial:** "Validé precio y stock no negativos en el schema, como pide la consigna; la categoría la valida el Service porque requiere consultar la base."

### `ProductoUpdate` y `no_nulo` — `productos/schemas.py`
**Qué hace:** PUT parcial: todos los campos opcionales. El validator `no_nulo` rechaza `null` en `nombre, precio_base, stock, disponible, categoria_id`. `descripcion` e `imagen_url` **sí** pueden ser `null` (para borrarlas).
**Por qué lo planteamos así:** consigna: PUT "Actualiza los campos enviados" (pág. 13). Misma lógica que en categorías: **omitido** (no se toca) vs **`null` explícito** (pondría null en una columna obligatoria). Permitimos `null` solo donde la columna es nullable.
**Alternativa descartada:** rechazar `null` en todo: no podrías quitar una descripción o una imagen.
**Si te preguntan en el parcial:** "Prohíbo `null` solo en los campos obligatorios de la tabla; en descripción e imagen lo permito porque son opcionales y así se pueden borrar."

### `ProductoStockUpdate` y `no_nulo` — `productos/schemas.py`
**Qué hace:** body del PATCH de stock: `stock >= 0` y `disponible`, ambos opcionales y no nulos.
**Por qué lo planteamos así:** *lo exige la consigna* (pág. 14: "ProductoStockUpdate: stock, disponible; stock >= 0"). Un schema aparte limita lo que ese endpoint puede tocar: no se cambia precio ni nombre por esta vía.
**Alternativa descartada:** reutilizar `ProductoUpdate`: el contrato del endpoint quedaría difuso.
**Si te preguntan en el parcial:** "Un schema mínimo para el PATCH deja claro qué se puede modificar: solo stock y disponibilidad."

### `ProductoRead` y `ProductosPaginados` — `productos/schemas.py`
**Qué hacen:** `ProductoRead` incluye todos los campos más `activo` y `categoria: CategoriaRead` **anidada**. `ProductosPaginados` es `{total, items}`.
**Por qué lo planteamos así:** *lo exige la consigna* (págs. 14-15). El `total` permite al frontend calcular cuántas páginas hay. La categoría anidada es la razón por la que el repositorio precarga la relación con `selectinload`.
**Alternativa descartada:** devolver una lista simple (el frontend no sabría cuántas páginas hay) o solo `categoria_id` (una request extra por producto).
**Si te preguntan en el parcial:** "Devuelvo `total` e `items` para que el frontend pagine, y la categoría anidada para evitar pedidos extra desde el cliente."

### `ProductoRepository(BaseRepository[Producto])` — `productos/repository.py`
**Qué hace:** hereda el CRUD genérico (con baja lógica por `activo`) y suma consultas específicas.
**Por qué lo planteamos así:** igual que categorías (criterio 3): repositorio sin reglas de negocio ni commits.
**Alternativa descartada:** poner la búsqueda en el Service con `session.exec(...)`: el Service pasaría a conocer SQL.
**Si te preguntan en el parcial:** "Las consultas SQL viven en el repositorio; el Service solo orquesta."

### `get_activo(self, id: int) -> Producto | None` — `productos/repository.py`
**Qué hace:** `get_by_id` y devuelve el producto solo si está activo.
**Por qué lo planteamos así:** implementa "producto dado de baja = inexistente" -> **404** en detalle, PUT, PATCH y DELETE. Para el consumidor de la API una baja y una inexistencia son lo mismo. Mismo criterio que `get_activa`.
**Alternativa descartada:** devolver el inactivo y que el Router lo oculte: lógica repartida y fácil de olvidar.
**Si te preguntan en el parcial:** "Devuelvo 404 para los dados de baja porque para el consumidor de la API no existen; así no se editan productos 'borrados'."

### `get_by_nombre(self, nombre: str) -> Producto | None` — `productos/repository.py`
**Qué hace:** busca por nombre exacto (`==`) y devuelve el primero.
**Por qué lo planteamos así:** *decisión nuestra*: lo usa el **seed** para ser idempotente. La consigna no define nombre único de producto, por eso el Service no chequea duplicados.
**Alternativa descartada:** `unique` en el nombre del producto: la consigna no lo pide y limitaría casos válidos.
**Si te preguntan en el parcial:** "Existe para que el seed pueda preguntar 'este producto ya está?' antes de insertarlo."

### `get_para_actualizar(self, id: int) -> Producto | None` — `productos/repository.py`
**Qué hace:** `select ... where id == ... .with_for_update()` y devuelve el primero. En PostgreSQL emite `SELECT ... FOR UPDATE`: bloquea esa fila hasta que termine la transacción. En SQLite se ignora (no soporta `FOR UPDATE`).
**Por qué lo planteamos así:** *decisión nuestra* (el flujo de la consigna, pág. 15, menciona `get_by_id`; esto lo mejora). Sin bloqueo hay *lost update*: dos pedidos simultáneos leen `stock = 1`, ambos pasan la verificación y descuentan, vendiendo stock que no existe. Con `FOR UPDATE` el segundo espera al commit del primero y recién ahí lee el stock actualizado. Lo usa **pedidos** al crear y al cancelar. **No filtra por `activo`**: al cancelar hay que restituir stock aunque el producto se haya dado de baja; el chequeo de `activo` lo hace el Service de pedidos al crear.
**Alternativa descartada:** `get_by_id` sin bloqueo (stock inconsistente bajo concurrencia; el criterio 6 resta por eso). Otra válida: `UPDATE ... SET stock = stock - n WHERE stock >= n`, atómico, pero perderíamos los mensajes de error separados (no disponible / stock insuficiente).
**Si te preguntan en el parcial:** "Uso `with_for_update` para bloquear la fila mientras descuento stock y evitar que dos pedidos vendan la última unidad. Solo tiene efecto en PostgreSQL; en SQLite se ignora."

### `search(self, skip=0, limit=20, search=None, categoria_id=None, disponible=None) -> tuple[int, Sequence[Producto]]` — `productos/repository.py`
**Qué hace:** arma una lista de `filtros` (siempre `activo IS TRUE`, más `ilike` por nombre, `categoria_id` y `disponible` si vienen), cuenta el total con esos filtros, y trae la página con `selectinload(categoria)`, `order_by(id)`, `offset(skip)` y `limit(limit)`. Devuelve `(total, página)`.
```python
filtros = [col(Producto.activo).is_(True)]
if search:      filtros.append(col(Producto.nombre).ilike(f"%{search.strip()}%"))
if categoria_id is not None: filtros.append(Producto.categoria_id == categoria_id)
if disponible is not None:   filtros.append(Producto.disponible == disponible)
total = session.exec(select(func.count()).select_from(Producto).where(*filtros)).one()
stmt = select(Producto).where(*filtros).options(selectinload(Producto.categoria))
       .order_by(col(Producto.id)).offset(skip).limit(limit)
```
**Por qué lo planteamos así:** la consigna pide listado paginado con `search` (sobre nombre, sin distinguir mayúsculas), `categoria_id` y `disponible` (pág. 12, criterio 5). Cada decisión:
- **Filtros dinámicos:** un solo método sirve para cualquier combinación.
- **`ilike`:** `LIKE` insensible a mayúsculas, exactamente lo que dice la consigna. `%texto%` = "contiene". En PostgreSQL es nativo; en SQLite SQLAlchemy lo emula con `lower()`. Solo sobre `nombre`.
- **`disponible is not None` (y no `if disponible:`):** `False` es un filtro válido; con `if` se perdería.
- **`total` con los mismos filtros** y `func.count`: el frontend necesita el total (no solo el tamaño de la página) para calcular páginas; contar en la base es más barato que traer todo.
- **`selectinload(Producto.categoria)`:** `ProductoRead` incluye la categoría; sin precarga, el lazy loading dispara 1 consulta extra por producto (problema **N+1**). `selectinload` resuelve todas con una sola segunda consulta `IN (...)`.
- **`order_by(id)`:** sin orden determinístico, la paginación puede repetir o saltar filas entre páginas.
- **`skip/limit`:** `skip` = filas a saltear, `limit` = máximo a traer. Página `p` (0-based) de tamaño `n`: `skip = p * n`.
**Alternativa descartada:** traer todo y filtrar/paginar en Python (no escala; la consigna resta por "sin paginación"), o lazy loading de la categoría (N+1).
**Si te preguntan en el parcial:** "Armo los filtros dinámicamente, uso `ilike` para buscar sin importar mayúsculas, cuento el total con los mismos filtros para que el frontend pagine, y precargo la categoría con `selectinload` para evitar el N+1."

### `ProductoUnitOfWork._init_repositories(self)` — `productos/unit_of_work.py`
**Qué hace:** crea `self.productos` y `self.categorias` sobre la **misma sesión**.
**Por qué lo planteamos así:** para validar la categoría **en la misma transacción** que escribe el producto, sin abrir otra sesión.
**Alternativa descartada:** que el Service de productos instancie otro UoW de categorías: dos sesiones, dos transacciones.
**Si te preguntan en el parcial:** "Un solo Unit of Work con los dos repositorios para que validar la categoría y guardar el producto ocurran en la misma transacción."

### `ProductoNoEncontrado(id)` y el reexport de `CategoriaNoEncontrada` — `productos/service.py`
**Qué hacen:** `ProductoNoEncontrado` es la excepción de dominio (404). `__all__` reexporta `CategoriaNoEncontrada` (definida en el service de categorías) para que el Router de productos importe todo desde su propio `service`.
**Por qué lo planteamos así:** consigna: excepciones de dominio por módulo (pág. 11). Reutilizamos `CategoriaNoEncontrada` para no duplicar el mismo concepto; ambas dan 404 (pág. 13: "404 si la categoría no existe o está dada de baja").
**Alternativa descartada:** una excepción propia `CategoriaInvalida`: dos clases para la misma idea.
**Si te preguntan en el parcial:** "Reutilizo la excepción de categorías porque es el mismo error, y la reexporto para que el Router de productos importe todo de su propio service."

### `ProductoService.listar(self, skip, limit, search, categoria_id, disponible) -> ProductosPaginados` — `productos/service.py`
**Qué hace:** abre el `with`, llama a `uow.productos.search(...)` y arma `ProductosPaginados` convirtiendo cada producto con `ProductoRead.model_validate`, todo dentro del bloque.
**Por qué lo planteamos así:** patrón de la consigna (schema dentro del `with`). Importa porque `ProductoRead` accede a `categoria`; con la sesión cerrada fallaría.
**Alternativa descartada:** devolver `(total, productos)` y convertir en el Router: se filtra la sesión a otra capa.
**Si te preguntan en el parcial:** "Convierto cada producto, con su categoría, a schema mientras la sesión sigue abierta."

### `ProductoService.obtener(self, id: int) -> ProductoRead` — `productos/service.py`
**Qué hace:** `_buscar` (404 si no existe o está inactivo) y devuelve `ProductoRead`.
**Por qué lo planteamos así:** consigna: `GET /productos/{id}` "Detalle con su categoría", 404 (pág. 13). 404 también para inactivos.
**Alternativa descartada:** mostrar inactivos a los admin: no lo pide la consigna y complica la regla.
**Si te preguntan en el parcial:** "Para el detalle, un producto dado de baja es un 404, igual que uno inexistente."

### `ProductoService.crear(self, data: ProductoCreate) -> ProductoRead` — `productos/service.py`
**Qué hace:** valida con `_validar_categoria` (404 si la categoría no existe o está de baja), convierte `data` a `Producto` con `model_validate`, lo guarda con `add` y devuelve `ProductoRead`.
**Por qué lo planteamos así:** consigna: POST -> 201, "404 si la categoría no existe o está dada de baja" (pág. 13). Va en el Service porque requiere consultar la base. Se hace antes de insertar para no depender de la FK (que no detecta "dada de baja" y, en SQLite, ni siempre se hace cumplir).
**Alternativa descartada:** confiar en la FK de la base: error de integridad poco amigable y no cubre categorías inactivas.
**Si te preguntan en el parcial:** "Valido que la categoría exista y esté activa antes de insertar; la FK sola no detecta categorías dadas de baja."

### `ProductoService.actualizar(self, id: int, data: ProductoUpdate) -> ProductoRead` — `productos/service.py`
**Qué hace:** busca el producto activo; arma `cambios = data.model_dump(exclude_unset=True)`; si viene `categoria_id`, valida esa categoría; aplica `sqlmodel_update(cambios)`, `add` y `session.refresh(producto)`; devuelve `ProductoRead`.
**Por qué lo planteamos así:** consigna: PUT "Actualiza los campos enviados"; 404 producto / 404 nueva categoría (pág. 13). **`exclude_unset=True`:** devuelve solo lo que el cliente envió; con `{"stock": 5}`, `cambios == {"stock": 5}`. Sin él, los omitidos vendrían como `None` y borrarías datos. **`refresh`:** si cambió `categoria_id`, la relación `producto.categoria` quedaría con el objeto viejo; `refresh` la recarga para que `ProductoRead` muestre la categoría nueva.
**Alternativa descartada:** PUT completo (obliga a reenviar todo). Sin `refresh`, la respuesta mostraría la categoría anterior aunque la base ya cambió.
**Si te preguntan en el parcial:** "Con `exclude_unset` actualizo solo lo enviado; si cambia la categoría, la valido y hago `refresh` para que la respuesta no muestre la vieja."

### `ProductoService.actualizar_stock(self, id: int, data: ProductoStockUpdate) -> ProductoRead` — `productos/service.py`
**Qué hace:** busca el producto activo, aplica solo los campos enviados de `ProductoStockUpdate` y devuelve `ProductoRead`.
**Por qué lo planteamos así:** consigna: `PATCH /productos/{id}/stock`, 404 (pág. 13, criterio 5). **¿Por qué PATCH si ya existe PUT?** Cambiar stock/disponibilidad es una operación frecuente y acotada; un endpoint específico limita lo que se puede tocar y deja clara la intención. No necesita `refresh` porque no cambia la categoría.
**Alternativa descartada:** usar el PUT para esto (contrato difuso).
**Si te preguntan en el parcial:** "El PATCH de stock es una operación acotada: solo toca stock y disponibilidad, por eso tiene su propio endpoint y schema."

### `ProductoService.eliminar(self, id: int) -> None` — `productos/service.py`
**Qué hace:** busca el producto activo y llama a `delete`, que hace `activo = False`.
**Por qué lo planteamos así:** consigna: baja lógica, 204 (pág. 13). Los pedidos existentes conservan su copia de `nombre_producto` y `precio_unitario`, y la FK `producto_id` sigue válida porque la fila no se borra.
**Alternativa descartada:** `session.delete` (físico): rompe la FK de `DetallePedido` y pierde historial (lo del TP8).
**Si te preguntan en el parcial:** "La baja lógica protege los pedidos históricos: la fila del producto sigue existiendo y cada línea ya tiene su copia de nombre y precio."

### `ProductoService._buscar(uow, id)` y `_validar_categoria(uow, categoria_id)` (staticmethods) — `productos/service.py`
**Qué hacen:** `_buscar` usa `get_activo` y lanza `ProductoNoEncontrado`; `_validar_categoria` usa `get_activa` y lanza `CategoriaNoEncontrada`.
**Por qué lo planteamos así:** evitan repetir las dos reglas en cada método. `_validar_categoria` se apoya en `uow.categorias`, por eso el UoW expone los dos repositorios.
**Alternativa descartada:** inline en cada método (duplicación).
**Si te preguntan en el parcial:** "Son helpers privados para no repetir 'producto activo o 404' y 'categoría activa o 404'."

### `router.py` de productos (prefijo `/productos`) — piezas auxiliares
`get_producto_service()`, `ServiceDep` y `ProductoId = Annotated[int, Path(gt=0)]` (mismo criterio que categorías). `_http(error)` **siempre** responde 404, porque `ProductoNoEncontrado` y `CategoriaNoEncontrada` mapean ambas a 404 (consigna, págs. 11 y 13).

### Endpoints de productos — `productos/router.py`
**Qué hacen:** `listar_productos`, `detalle_producto`, `crear_producto` (201), `actualizar_producto`, `actualizar_stock` (PATCH) y `eliminar_producto` (204).

| Método y ruta | Acceso | Éxito | Errores propios |
|---|---|---|---|
| `GET /productos?skip&limit&search&categoria_id&disponible` | público | 200 `ProductosPaginados` | 422 |
| `GET /productos/{id}` | público | 200 `ProductoRead` | 404 |
| `POST /productos` | admin | **201** | 404 (categoría inexistente/de baja) |
| `PUT /productos/{id}` | admin | 200 | 404 (producto) / 404 (nueva categoría) |
| `PATCH /productos/{id}/stock` | admin | 200 | 404 |
| `DELETE /productos/{id}` | admin | **204** | 404 |

**Por qué lo planteamos así:** verbos y códigos *los exige la consigna* (págs. 12-13). Validación de query en `listar_productos` (decisión nuestra salvo los nombres de parámetros):
- `skip: Query(ge=0) = 0`: un skip negativo no tiene sentido.
- `limit: Query(ge=1, le=100) = 20`: **tope de 100** para que nadie pida la tabla entera de golpe (protege memoria y tiempo de respuesta); 20 es un tamaño de página razonable por defecto. Fuera de rango -> 422 (`.http` #5).
- `search: Query(max_length=100)`: acota el patrón del `ilike`.
- `categoria_id: Query(gt=0)` y `disponible: bool | None`.
Las escrituras usan `_: AdminUser`; las lecturas no piden sesión.
**Alternativa descartada:** sin tope de `limit`: un `limit=1000000` obligaría a leer y serializar todo. O validar en el Service: es validación de entrada y su lugar natural es el borde HTTP.
**Si te preguntan en el parcial:** "Puse `le=100` en `limit` para que no puedan pedir toda la tabla de una vez, y `ge=0` en `skip`. Lo valida FastAPI y responde 422 sin llegar al Service."

---

## 4. Actualización parcial con `exclude_unset` (resumen)
`model_dump(exclude_unset=True)` devuelve **solo los campos que el cliente envió**. Luego `sqlmodel_update(cambios)` pisa solo esos campos. Sin `exclude_unset`, los omitidos vendrían como `None` y borrarías datos. Diferencia clave: **omitido** (se ignora) vs **`null` explícito** (cuenta como enviado: por eso los validators `no_nulo`).
**Si te preguntan en el parcial:** "`exclude_unset` me permite distinguir lo que el cliente mandó de lo que no mandó; sin eso un PUT parcial borraría datos."

## 5. Gotchas y preguntas probables

- **Producto con categoría dada de baja:** la baja de una categoría no oculta sus productos (decisión nuestra, simple y predecible). Para retirarlos del catálogo hay que dar de baja también los productos.
- **Productos dados de baja y pedidos viejos:** `DetallePedido` conserva `nombre_producto` y `precio_unitario`, y la FK sigue válida porque la fila del producto existe.
- **Solo se filtra `ilike` por nombre**, no por descripción (la consigna: "search sobre nombre").
- `total` de la paginación cuenta **todos** los que cumplen el filtro, no solo la página.
- **404 por inactivo:** responder 404 es decisión nuestra: para la API una baja equivale a inexistente.
- **El Service de productos no impide nombres repetidos:** la consigna no lo pide; el seed usa `get_by_nombre` solo para ser idempotente.
