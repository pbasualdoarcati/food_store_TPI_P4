# Decisiones de diseño - Food Store (TPI Programación IV)

Este es el documento que más te conviene dominar para el oral del 14/11. Las preguntas del tipo **"¿por qué lo hiciste así?"** se responden con decisiones, no con código memorizado.

## Cómo usar este documento

1. Leé **una** decisión (D-NN) completa.
2. Cerrá el archivo.
3. Explicala **en voz alta**, como si el profe te la preguntara: problema, qué hiciste, qué descartaste y qué debilidad tiene.
4. Abrí y comparás con la sección "Respuesta para el parcial". Si te faltó el trade-off, repetí.

Reglas de oro para el oral:
- Siempre nombrá una **alternativa descartada**. Muestra que elegiste, no que copiaste.
- Siempre reconocé una **debilidad real**. Suma más que defender lo indefendible.
- Cada decisión indica su **origen**: si viene de la consigna, citá la consigna; si es propia, justificala.

Contexto que atraviesa todo: el TPI evoluciona de mi **TP8**. En el TP8 el profe me descontó por usar **borrado físico** (`session.delete`) en vez de baja lógica, y por faltar ingredientes en productos. Por eso en el TPI la baja lógica es sistemática, y los ingredientes quedaron **fuera de alcance a propósito**: el UML del TPI tiene solo 5 entidades (Usuario, Categoria, Producto, Pedido, DetallePedido), sin Ingredientes.

## Índice

**A. Arquitectura backend**
- [D-01 Arquitectura en capas con dependencias unidireccionales](#d-01--arquitectura-en-capas-con-dependencias-unidireccionales)
- [D-02 Un módulo por dominio](#d-02--un-módulo-por-dominio)
- [D-03 Unit of Work: commit/rollback en `__exit__`](#d-03--unit-of-work-commitrollback-en-__exit__)
- [D-04 El Service abre el `with`, el Router no](#d-04--el-service-abre-el-with-el-router-no)
- [D-05 `BaseRepository` genérico con `TypeVar`](#d-05--baserepository-genérico-con-typevar)
- [D-06 Repositorios sin reglas de negocio y con `flush`](#d-06--repositorios-sin-reglas-de-negocio-y-con-flush)
- [D-07 Services devuelven schemas dentro del bloque](#d-07--services-devuelven-schemas-dentro-del-bloque)
- [D-08 Versiones fijadas (bcrypt 4.0.1)](#d-08--versiones-fijadas-bcrypt-401)

**B. Modelo de datos**
- [D-09 Baja lógica en todo el sistema](#d-09--baja-lógica-en-todo-el-sistema)
- [D-10 Los pedidos no se borran: el repositorio lo impide](#d-10--los-pedidos-no-se-borran-el-repositorio-lo-impide)
- [D-11 Snapshot de nombre y precio en `DetallePedido`](#d-11--snapshot-de-nombre-y-precio-en-detallepedido)
- [D-12 Sin ingredientes (cinco entidades)](#d-12--sin-ingredientes-cinco-entidades)
- [D-13 Fechas en UTC y serialización con `Z`](#d-13--fechas-en-utc-y-serialización-con-z)
- [D-14 Validaciones en schemas, sin CHECK en la base](#d-14--validaciones-en-schemas-sin-check-en-la-base)

**C. Transacciones y reglas de negocio**
- [D-15 Crear pedido: todo en una transacción](#d-15--crear-pedido-todo-en-una-transacción)
- [D-16 Verificar y descontar stock en la misma iteración](#d-16--verificar-y-descontar-stock-en-la-misma-iteración)
- [D-17 `with_for_update` (solo PostgreSQL)](#d-17--with_for_update-solo-postgresql)
- [D-18 Máquina de estados como diccionario](#d-18--máquina-de-estados-como-diccionario)
- [D-19 Cancelar restituye stock en la misma transacción](#d-19--cancelar-restituye-stock-en-la-misma-transacción)
- [D-20 `/cancelar` es solo del dueño, incluso para el admin](#d-20--cancelar-es-solo-del-dueño-incluso-para-el-admin)
- [D-21 Excepciones de dominio traducidas a HTTP en el Router](#d-21--excepciones-de-dominio-traducidas-a-http-en-el-router)

**D. Seguridad y auth**
- [D-22 JWT en cookie HttpOnly, no en localStorage](#d-22--jwt-en-cookie-httponly-no-en-localstorage)
- [D-23 Cookie `samesite=lax` y `secure=False` (solo en desarrollo)](#d-23--cookie-samesitelax-y-securefalse-solo-en-desarrollo)
- [D-24 `get_current_user` devuelve `UserPublic`](#d-24--get_current_user-devuelve-userpublic)
- [D-25 `require_role` como fábrica (closure)](#d-25--require_role-como-fábrica-closure)
- [D-26 Cuenta desactivada: 400, no 403](#d-26--cuenta-desactivada-400-no-403)
- [D-27 Activar y desactivar idempotentes](#d-27--activar-y-desactivar-idempotentes)
- [D-28 El admin no puede desactivarse a sí mismo](#d-28--el-admin-no-puede-desactivarse-a-sí-mismo)

**E. API**
- [D-29 `/pedidos/resumen` antes de `/{id}`](#d-29--pedidosresumen-antes-de-id)
- [D-30 PUT parcial con `exclude_unset`](#d-30--put-parcial-con-exclude_unset)
- [D-31 Paginación `{total, items}` con `limit <= 100`](#d-31--paginación-total-items-con-limit--100)
- [D-32 Nombre de categoría único sin distinguir mayúsculas; las inactivas conservan el nombre](#d-32--nombre-de-categoría-único-sin-distinguir-mayúsculas-las-inactivas-conservan-el-nombre)
- [D-33 Seed idempotente con cliente de demo](#d-33--seed-idempotente-con-cliente-de-demo)

**F. Frontend: arquitectura**
- [D-34 Organización por features](#d-34--organización-por-features)
- [D-35 `DataTable` genérico](#d-35--datatable-genérico)
- [D-36 TypeScript `strict`, sin `any`](#d-36--typescript-strict-sin-any)

**G. Estado y datos**
- [D-37 TanStack Query para el servidor, Zustand para el cliente](#d-37--tanstack-query-para-el-servidor-zustand-para-el-cliente)
- [D-38 `partialize`: solo `usuario` en `authStore`](#d-38--partialize-solo-usuario-en-authstore)
- [D-39 Interceptor de Axios: qué limpia y qué no](#d-39--interceptor-de-axios-qué-limpia-y-qué-no)
- [D-40 Jerarquía de `queryKey` e invalidación](#d-40--jerarquía-de-querykey-e-invalidación)
- [D-41 Logout limpia caché y carrito](#d-41--logout-limpia-caché-y-carrito)
- [D-42 `ProtectedRoute` es UX; la seguridad real está en el backend](#d-42--protectedroute-es-ux-la-seguridad-real-está-en-el-backend)

**H. UX**
- [D-43 Formularios con TanStack Form espejando los límites del backend](#d-43--formularios-con-tanstack-form-espejando-los-límites-del-backend)
- [D-44 Modales de confirmación en acciones destructivas](#d-44--modales-de-confirmación-en-acciones-destructivas)
- [D-45 Registro con login automático](#d-45--registro-con-login-automático)
- [D-46 Búsqueda con debounce y `keepPreviousData`](#d-46--búsqueda-con-debounce-y-keeppreviousdata)

**I. Calidad y tooling**
- [D-47 Carrito en el cliente, precio re-validado en el servidor](#d-47--carrito-en-el-cliente-precio-re-validado-en-el-servidor)
- [D-48 Sin tests automatizados (consigna)](#d-48--sin-tests-automatizados-consigna)

**J. Diferencias con el TP8**
- [D-49 Qué cambió respecto del TP8 y por qué](#d-49--qué-cambió-respecto-del-tp8-y-por-qué)

---

# A. Arquitectura backend

#### D-01 · Arquitectura en capas con dependencias unidireccionales
- **Contexto / problema:** si el Router habla directo con la base, las reglas de negocio quedan mezcladas con HTTP y es imposible reutilizarlas o razonar sobre transacciones.
- **Decisión:** cadena Router → Service → Unit of Work → Repository → Model, más Schemas aparte. Cada capa importa solo hacia abajo: el Router importa el Service, el Service importa el UoW, el UoW importa los repositorios. Ejemplo: `app/modules/pedidos/{router,service,unit_of_work,repository,models,schemas}.py`.
- **Origen:** Consigna (pág. 7, "Arquitectura en capas"; criterio 1).
- **Alternativas descartadas:** todo en el router (como en mis primeros TPs): rápido pero no testeable ni transaccional. Un "service+repo" en una sola clase: mezcla reglas con consultas.
- **Consecuencias / trade-offs:** más archivos y más "ceremonia" para un CRUD chico (categorías tiene 6 archivos para pocas líneas). A cambio, cada archivo tiene una sola razón para cambiar. Hay un punto donde la regla se roza: `core/deps.py` importa de `usuarios` (para cargar el usuario), es la única dependencia "hacia un módulo" desde el core.
- **Respuesta para el parcial:** "Separé en capas para que cada una tenga una sola responsabilidad: el Router solo traduce HTTP, el Service tiene las reglas, el UoW maneja la transacción y el Repository solo consulta. Las dependencias van siempre hacia abajo, nunca al revés. El costo es más archivos, pero el comportamiento transaccional queda en un solo lugar."

#### D-02 · Un módulo por dominio
- **Contexto / problema:** organizar por tipo técnico (`routers/`, `services/`) dispersa un mismo concepto en cinco carpetas.
- **Decisión:** `app/modules/{auth,usuarios,categorias,productos,pedidos}`, cada uno con su cadena de archivos. `auth` solo tiene router, service y schemas porque reutiliza el modelo `Usuario`. Lo compartido vive en `app/core/`.
- **Origen:** Consigna (pág. 2 y 9).
- **Alternativas descartadas:** carpetas por capa (`routers/`, `services/`...): obliga a saltar entre carpetas para tocar un dominio.
- **Consecuencias / trade-offs:** hay dependencias cruzadas entre módulos (pedidos usa productos; productos usa categorías). Las resuelvo reexportando excepciones (`__all__` en `productos/service.py`) y compartiendo repositorios en el UoW.
- **Respuesta para el parcial:** "Agrupé por dominio porque cuando cambia una regla de pedidos, todo lo que toco está en una carpeta. Lo transversal, como seguridad, UoW base y repositorio base, lo dejé en `core`."

#### D-03 · Unit of Work: commit/rollback en `__exit__`
- **Contexto / problema:** si cada método hace su `commit()`, una operación de varios pasos puede quedar a medias (stock descontado pero pedido sin crear).
- **Decisión:** `UnitOfWork` en `app/core/unit_of_work.py` abre la sesión en `__enter__`; en `__exit__` hace `rollback()` si hubo excepción o `commit()` si no, y siempre `close()` en un `finally`. No devuelve `True`, así la excepción original llega al Router.
- **Origen:** Consigna (pág. 3 y 7, "Regla del Unit of Work"; criterio 3).
- **Alternativas descartadas:** commit manual en el Service (la consigna lo prohíbe y es fácil olvidarlo); sesión inyectada por `Depends` y commit en el router (acopla HTTP con la transacción).
- **Consecuencias / trade-offs:** el commit ocurre *después* de que el Service hizo `return`. Por eso el schema de salida se arma dentro del `with` (ver D-07). Si el commit falla, la excepción sube cuando el Service ya "terminó".
- **Respuesta para el parcial:** "El `with` es el límite de la transacción: si sale sin error, commit; si sale con excepción, rollback. Así 'el pedido se crea completo o no se crea' lo garantiza la estructura, no mi memoria de poner un commit."

#### D-04 · El Service abre el `with`, el Router no
- **Contexto / problema:** ¿quién decide el alcance de la transacción? Si es el Router, la regla de negocio queda dividida entre dos capas.
- **Decisión:** el Service hace `with self.uow as uow:`. El Router obtiene el Service con `Depends(get_pedido_service)` (en `pedidos/router.py`), que arma `PedidoService(PedidoUnitOfWork(session_factory))`. Nadie fuera del UoW llama a `commit()`.
- **Origen:** Consigna (pág. 3 y 7).
- **Alternativas descartadas:** UoW abierto por una dependencia de FastAPI: el Service dejaría de controlar cuándo empieza y termina la operación.
- **Consecuencias / trade-offs:** `auth` y `usuarios` también usan este estilo en mi código (la consigna permitía conservar el estilo del proyecto de seguridad). El UoW se instancia por request, no se comparte entre requests (la sesión se crea en `__enter__`).
- **Respuesta para el parcial:** "El Service sabe qué operaciones forman una unidad de trabajo, entonces es el que abre el `with`. El Router solo le pasa los datos y traduce el resultado a HTTP."

#### D-05 · `BaseRepository` genérico con `TypeVar`
- **Contexto / problema:** `get_by_id`, `get_all`, `add` y `delete` se repetirían idénticos en cuatro repositorios.
- **Decisión:** `BaseRepository(Generic[T])` en `app/core/base_repository.py`, con `T = TypeVar("T", bound=SQLModel)`. Cada repositorio hereda y define `model = Pedido`, etc. Uso `TypeVar` + `Generic` en vez de la sintaxis `class X[T]` de Python 3.12 para ser compatible con **Python 3.11** (la consigna pide 3.11 a 3.13).
- **Origen:** Consigna (pág. 3 y 8: `BaseRepository[T]`); la compatibilidad 3.11 es decisión propia derivada del rango pedido.
- **Alternativas descartadas:** sintaxis nueva `class Base[T]` (rompe en 3.11); un repositorio por tabla copiando métodos (duplicación).
- **Consecuencias / trade-offs:** la sintaxis vieja es más verbosa. El tipado de `select(...)` con SQLModel obliga a algunos `# type: ignore[arg-type]` en relaciones (`selectinload(Pedido.items)`), una limitación conocida de los stubs.
- **Respuesta para el parcial:** "Hice el repositorio base genérico para no repetir el CRUD común. Usé `TypeVar` y `Generic` porque la consigna admite Python 3.11, donde no existe la sintaxis de genéricos de 3.12."

#### D-06 · Repositorios sin reglas de negocio y con `flush`
- **Contexto / problema:** ¿dónde van las consultas y dónde las reglas? Si el repositorio decide cosas de negocio, no se entiende qué regla se aplica.
- **Decisión:** el repositorio solo consulta (`get_by_nombre`, `list_by_usuario`, `count_by_estado`, `search`). `add()` hace `session.add` + `session.flush()`: el `INSERT/UPDATE` viaja a la base dentro de la transacción y el `id` queda disponible, pero **no** se confirma.
- **Origen:** Consigna (pág. 7: "Sin reglas de negocio"; criterio 3 "repositorios con reglas de negocio resta").
- **Alternativas descartadas:** `commit()` en `add` (rompe la atomicidad); no hacer `flush` (el `id` del pedido no existiría hasta el commit).
- **Consecuencias / trade-offs:** hay una pequeña línea gris: `get_activa` en categorías filtra por `activo`. Lo considero consulta, no regla, porque la regla ("tratar al inactivo como inexistente") la aplica el Service lanzando `CategoriaNoEncontrada`.
- **Respuesta para el parcial:** "El repositorio sabe *cómo* buscar, el Service sabe *qué hacer* con el resultado. Uso `flush` para que el `id` esté disponible dentro de la transacción sin confirmarla."

#### D-07 · Services devuelven schemas dentro del bloque
- **Contexto / problema:** después del `commit`, SQLAlchemy expira los objetos y la sesión se cierra; devolver un modelo de tabla da `DetachedInstanceError` o datos viejos.
- **Decisión:** dentro del `with`, convierto con `PedidoRead.model_validate(pedido)` y retorno el schema. Nunca se expone un modelo `table=True` en la API. Mismo criterio en `get_current_user`, que devuelve `UserPublic`.
- **Origen:** Consigna (pág. 3 y 15).
- **Alternativas descartadas:** `expire_on_commit=False` (esconde el problema y puede devolver datos desactualizados); devolver el modelo y serializarlo en el router.
- **Consecuencias / trade-offs:** hay que acordarse de cargar relaciones antes de salir (`selectinload` en listados). En `productos.actualizar` hago `session.refresh` porque cambió la categoría.
- **Respuesta para el parcial:** "Convierto a schema adentro del `with` porque al salir se hace commit y el objeto queda expirado. Además así nunca filtro campos internos como `hashed_password`."

#### D-08 · Versiones fijadas (bcrypt 4.0.1)
- **Contexto / problema:** `passlib 1.7.4` falla con `bcrypt >= 5` y una instalación "al día" puede romper el login sin que haya cambiado mi código.
- **Decisión:** `backend/requirements.txt` con todas las versiones exactas (`==`), incluyendo `passlib[bcrypt]==1.7.4` y `bcrypt==4.0.1`. Frontend: `package.json` también con versiones exactas y `pnpm-lock.yaml`.
- **Origen:** Consigna (pág. 2 y 7; criterio 1).
- **Alternativas descartadas:** rangos (`>=`) o sin fijar: reproducibilidad nula; migrar a `argon2`/`bcrypt` directo: se aparta de lo pedido.
- **Consecuencias / trade-offs:** no recibo parches de seguridad automáticamente; hay que actualizar a mano. Es el costo de que "corra siguiendo el README", condición de aprobación de la consigna.
- **Respuesta para el parcial:** "Fijé versiones porque passlib 1.7.4 es incompatible con bcrypt 5. Prefiero que el proyecto sea reproducible y actualizar a propósito, antes que se rompa solo."

---

# B. Modelo de datos

#### D-09 · Baja lógica en todo el sistema
- **Contexto / problema:** en el TP8 usé `session.delete` y me descontaron: un borrado físico rompe el historial (pedidos que apuntan a un producto inexistente) y no se puede deshacer.
- **Decisión:** `Categoria.activo`, `Producto.activo` y `Usuario.disabled` (baja lógica). `BaseRepository.delete()` no borra: hace `setattr(obj, campo_baja, valor_baja)`. Por defecto `campo_baja="activo"`, `valor_baja=False`; `UsuarioRepository` lo redefine a `disabled=True`. Un registro dado de baja se trata como inexistente (404 en detalle, PUT, PATCH y DELETE).
- **Origen:** Consigna (pág. 4, 10; criterios 2 y 5 "borrado físico resta") + corrección del profe en TP8.
- **Alternativas descartadas:** `DELETE` físico (rompe integridad con `DetallePedido`); mover a una tabla de archivo (sobreingeniería).
- **Consecuencias / trade-offs:** las consultas deben filtrar `activo` (si me olvido, aparece un fantasma). La baja de una categoría **no** oculta sus productos: hay que darlos de baja aparte (la consigna lo establece). Los registros inactivos siguen ocupando espacio.
- **Respuesta para el parcial:** "Cambié el borrado físico por baja lógica porque en el TP8 me lo marcaron. Un producto dado de baja sigue existiendo para los pedidos viejos, que conservan su copia. El `delete` del repositorio base solo cambia un flag."

#### D-10 · Los pedidos no se borran: el repositorio lo impide
- **Contexto / problema:** un pedido es un registro contable. Ni siquiera baja lógica: se **cancela**.
- **Decisión:** `PedidoRepository` declara `campo_baja = None` (`pedidos/repository.py`); en `BaseRepository.delete`, si `campo_baja is None`, lanza `NotImplementedError`. Además no existe ningún endpoint de edición ni de borrado de pedidos (RN-05).
- **Origen:** Consigna (RN-05; criterio 2 "pedidos borrables" resta).
- **Alternativas descartadas:** simplemente no exponer el endpoint (alcanza para la API, pero no protege contra un uso interno futuro); campo `activo` en pedido (confunde con el estado `CANCELADO`).
- **Consecuencias / trade-offs:** la garantía es defensiva: si alguien llama `delete` por error, explota en vez de borrar. `NotImplementedError` no es una excepción "de dominio"; si se llegara a exponer daría 500, pero no hay ruta que lo haga.
- **Respuesta para el parcial:** "Hice que sea imposible borrar un pedido desde la capa de datos: el repositorio de pedidos lanza `NotImplementedError`. Además no existe endpoint de borrado. Un pedido solo cambia de estado."

#### D-11 · Snapshot de nombre y precio en `DetallePedido`
- **Contexto / problema:** si el admin cambia el precio de un producto, los pedidos viejos no deben cambiar su total. Si solo guardara `producto_id`, el historial mentiría.
- **Decisión:** `DetallePedido` guarda `nombre_producto`, `precio_unitario` y `subtotal` copiados al crear el pedido (`pedidos/service.py`, dentro del `crear`). `producto_id` se mantiene como FK para trazabilidad.
- **Origen:** Consigna (pág. 3, 5; RN-01 y RN-05; criterio 2).
- **Alternativas descartadas:** guardar solo la FK y hacer join al leer (precio histórico perdido); versionar productos (complejo y fuera de alcance).
- **Consecuencias / trade-offs:** hay duplicación de datos *intencional* (desnormalización). El `subtotal` también se guarda (podría calcularse), pero así queda fijo y el total no depende de recalcular con floats.
- **Respuesta para el parcial:** "Copio nombre y precio en la línea porque el precio de un producto cambia pero el de un pedido ya hecho no. Es duplicar datos a propósito para preservar el historial."

#### D-12 · Sin ingredientes (cinco entidades)
- **Contexto / problema:** en el TP8 me observaron que faltaban ingredientes en productos. En el TPI la situación es distinta.
- **Decisión:** implemento exactamente las 5 entidades del UML del TPI: Usuario, Categoria, Producto, Pedido, DetallePedido. No hay entidad `Ingrediente`.
- **Origen:** Consigna (pág. 4: "Cinco tablas"; UML del anexo). Corrección del TP8 interpretada según el alcance del TPI.
- **Alternativas descartadas:** agregar Ingredientes "por las dudas": sale del UML y la consigna lo ubica fuera de alcance; agregaría una relación N:M no pedida.
- **Consecuencias / trade-offs:** si el profe pregunta por ingredientes, la respuesta es que el modelo del TPI lo define sin ellos. El riesgo es que el catálogo sea menos rico (no hay alérgenos ni composición).
- **Respuesta para el parcial:** "En el TP8 faltaban ingredientes, pero el UML del TPI tiene cinco entidades y ninguna es Ingrediente. Seguí el modelo entregado; si hiciera falta, se agrega como una N:M entre Producto e Ingrediente sin tocar pedidos."

#### D-13 · Fechas en UTC y serialización con `Z`
- **Contexto / problema:** SQLite devuelve datetimes sin zona; PostgreSQL con `timezone=True` los devuelve con zona. Sin criterio, el frontend interpretaría mal la hora.
- **Decisión:** guardo siempre `datetime.now(timezone.utc)` (`ahora()` en `pedidos/models.py`), con `DateTime(timezone=True)`. En `PedidoRead` uso `FechaUTC` (`Annotated` con `AfterValidator(_como_utc)`) que marca como UTC una fecha naive. Pydantic serializa UTC como `...Z` y el frontend la formatea con `Intl.DateTimeFormat('es-AR')` en la zona del navegador (`shared/utils/formato.ts`).
- **Origen:** Decisión propia.
- **Alternativas descartadas:** guardar hora local (ambigua con horario de verano y servidores en otra zona); enviar timestamps sin zona.
- **Consecuencias / trade-offs:** el resumen "pedidos hoy" calcula el inicio del día con la hora local del servidor y lo convierte a UTC (`resumen()` en el service); si servidor y cliente están en zonas distintas, "hoy" es el del servidor.
- **Respuesta para el parcial:** "Guardo todo en UTC y lo mando con `Z`; el navegador lo convierte a la hora local. Evita ambigüedades de zona horaria. La excepción es 'pedidos de hoy', que usa el día local del servidor."

#### D-14 · Validaciones en schemas, sin CHECK en la base
- **Contexto / problema:** dónde validar que precio ≥ 0, que dirección tenga 5 a 200 caracteres, etc.
- **Decisión:** `Field(ge=0, min_length=2, max_length=...)` en los schemas (`productos/schemas.py`, `pedidos/schemas.py`); `Literal` para `forma_pago` y `EstadoPedido`. Los modelos de tabla tienen `ge` también, pero no se crean CHECK constraints en la base. Las únicas restricciones en BD son claves, FK y `unique`.
- **Origen:** Consigna (pág. 4: "no se exigen CHECK en la base"; RN-06).
- **Alternativas descartadas:** CHECK en PostgreSQL (más robusto pero la consigna no lo pide y complica el soporte de SQLite).
- **Consecuencias / trade-offs:** quien escriba directo en la base puede violar reglas; solo la API las garantiza. Para el alcance del TPI es aceptable.
- **Respuesta para el parcial:** "Valido en el borde, en los schemas, y devuelvo 422 con el detalle. No puse CHECK en la base porque la consigna no los exige; la debilidad es que un acceso directo a la base se saltea las reglas."

---

# C. Transacciones y reglas de negocio

#### D-15 · Crear pedido: todo en una transacción
- **Contexto / problema:** crear un pedido toca tres cosas: el pedido, sus líneas y el stock de cada producto. Si algo falla en el medio, no puede quedar nada.
- **Decisión:** `PedidoService.crear` corre dentro de un solo `with self.uow`. `PedidoUnitOfWork` expone `pedidos` y `productos` sobre la **misma sesión** (`pedidos/unit_of_work.py`). Si cualquier validación lanza una excepción, `__exit__` hace rollback y no se persiste nada, tampoco el descuento de stock.
- **Origen:** Consigna (RN-01; pág. 15 "Flujo de crear pedido"; criterio 6).
- **Alternativas descartadas:** sesiones separadas para pedido y productos (dos commits, posible inconsistencia); compensaciones manuales ("deshacer" a mano).
- **Consecuencias / trade-offs:** el pedido se inserta (con `total=0`) *antes* de validar los productos, como indica el flujo de la consigna; si algo falla, el rollback lo deshace. Un pedido grande mantiene bloqueos más tiempo.
- **Respuesta para el parcial:** "Pedido, líneas y stock comparten una sola sesión y un solo commit. Si el tercer producto no tiene stock, el rollback deshace también el descuento de los dos primeros."

#### D-16 · Verificar y descontar stock en la misma iteración
- **Contexto / problema:** si primero verifico todos los stocks y después descuento en otro loop, hay una ventana donde el stock cambia entre la verificación y el descuento.
- **Decisión:** por cada ítem, en la misma iteración: obtener producto → validar activo/disponible → validar `stock >= cantidad` → `producto.stock -= cantidad` → crear `DetallePedido` copiando nombre y precio → acumular subtotal. Después `pedido.total = round(total, 2)`.
- **Origen:** Consigna (RN-01 "en la misma iteración").
- **Alternativas descartadas:** dos pasadas (verificar todo y luego descontar); `UPDATE ... WHERE stock >= n` atómico por fila (válido, pero la consigna describe el flujo con objetos y excepciones).
- **Consecuencias / trade-offs:** el chequeo y la resta quedan pegados, pero sin bloqueo de fila siguen siendo una condición de carrera entre requests (por eso D-17). Los montos son `float` (lo pide la consigna) y redondeo a 2 decimales.
- **Respuesta para el parcial:** "Verifico y descuento en la misma pasada porque separarlos abre una ventana de inconsistencia. Como además bloqueo la fila del producto, dos pedidos simultáneos no pueden vender el mismo stock."

#### D-17 · `with_for_update` (solo PostgreSQL)
- **Contexto / problema:** dos clientes compran la última unidad a la vez: ambos leen `stock=1`, ambos descuentan y queda `-1`.
- **Decisión:** `ProductoRepository.get_para_actualizar` ejecuta `select(Producto).where(...).with_for_update()` (`SELECT ... FOR UPDATE`). Se usa tanto al crear el pedido como al restituir stock al cancelar. Además, `PedidoRepository.get_para_actualizar` bloquea **la fila del pedido** en `cambiar_estado` y `cancelar`: así dos cancelaciones simultáneas no restituyen el stock dos veces (la segunda espera, lee `CANCELADO` y recibe 400).
- **Origen:** Decisión propia (la consigna pide consistencia de stock, no dice cómo).
- **Alternativas descartadas:** nivel de aislamiento `SERIALIZABLE` (más pesado y requiere reintentos); lock optimista con columna de versión (más código); no hacer nada.
- **Consecuencias / trade-offs:** **SQLite ignora `FOR UPDATE`**, así que en desarrollo con SQLite no hay protección; solo funciona de verdad en PostgreSQL (el motor que pide la consigna). Si dos transacciones piden varios productos en distinto orden puede haber deadlock; no lo traté (ordenar los ids sería la mejora).
- **Respuesta para el parcial:** "Uso `SELECT FOR UPDATE` para que una segunda transacción espere a que la primera confirme y vea el stock ya descontado. Es una garantía de PostgreSQL; en SQLite no tiene efecto, y lo sé."

#### D-18 · Máquina de estados como diccionario
- **Contexto / problema:** las transiciones de un pedido son pocas y fijas; un `if/elif` por cada caso crece y es fácil de equivocar.
- **Decisión:** en `pedidos/service.py`, `TRANSICIONES: dict[str, set[str]]` con `PENDIENTE → {EN_PREPARACION, CANCELADO}`, `EN_PREPARACION → {ENTREGADO, CANCELADO}` y estados terminales con `set()`. `_transicionar` valida `nuevo in TRANSICIONES[pedido.estado]` **antes** de modificar el pedido y lanza `TransicionInvalida` (400).
- **Origen:** Consigna (pág. 5: "El mapa de transiciones vive en el Service como un diccionario"; RN-02; criterio 6).
- **Alternativas descartadas:** `if/elif` anidados; el patrón State con una clase por estado (sobreingeniería para 4 estados); `Enum` con método (sirve, pero la consigna pide el dict).
- **Consecuencias / trade-offs:** agregar un estado es agregar una línea. El frontend tiene una copia en `features/pedidos/utils/estados.ts` solo para decidir qué botones mostrar: queda **duplicada** y podría desincronizarse; la validación real es siempre la del backend.
- **Respuesta para el parcial:** "Modelé la máquina como un diccionario estado → conjunto de estados permitidos. La validación es una sola línea y siempre ocurre antes de tocar el pedido. En el frontend hay un espejo, pero solo para mostrar botones; manda el backend."

#### D-19 · Cancelar restituye stock en la misma transacción
- **Contexto / problema:** al cancelar, el stock de cada línea debe volver. Si cambiara el estado y fallara la restitución (o al revés), quedaría inconsistente.
- **Decisión:** `_transicionar` (usado por el cambio de estado del admin y por la cancelación del cliente) cuando `nuevo == "CANCELADO"` recorre `pedido.items`, bloquea cada producto con `get_para_actualizar`, suma la cantidad y recién después cambia `pedido.estado` y `updated_at`. Todo bajo el mismo `with`.
- **Origen:** Consigna (RN-03; criterio 6 "stock inconsistente" resta).
- **Alternativas descartadas:** restituir en un servicio aparte (otra transacción); código duplicado en admin y cliente.
- **Consecuencias / trade-offs:** un solo camino de cancelación para ambos actores evita bugs duplicados. Si un producto ya no existiera (`None`), se saltea silenciosamente; con baja lógica el producto siempre existe, así que no debería pasar.
- **Respuesta para el parcial:** "Hay un único método que cambia estados. Si el destino es CANCELADO, devuelve el stock línea por línea y cambia el estado en la misma transacción. No hay forma de cancelar sin restituir."

#### D-20 · `/cancelar` es solo del dueño, incluso para el admin
- **Contexto / problema:** el admin puede cancelar cualquier pedido, pero ¿por qué existen dos endpoints (`PATCH /estado` y `PATCH /cancelar`)?
- **Decisión:** `PATCH /pedidos/{id}/cancelar` (`cancelar` en el service) exige `pedido.usuario_id == usuario.id` y estado `PENDIENTE`; si no, `PedidoAjeno` (403) o `PedidoNoCancelable` (400). Eso aplica también al admin sobre pedidos ajenos. El admin cancela pedidos de otros con `PATCH /pedidos/{id}/estado` con `{"estado":"CANCELADO"}`.
- **Origen:** Consigna (pág. 14: `/cancelar` acceso "Dueño"; RN-04).
- **Alternativas descartadas:** dejar que `/cancelar` valide por rol y no por dueño (mezcla dos casos de uso con reglas distintas).
- **Consecuencias / trade-offs:** dos caminos para lo mismo puede confundir, pero tienen reglas distintas: el del cliente solo desde PENDIENTE; el del admin desde cualquier estado no terminal. Ambos terminan en `_transicionar`.
- **Respuesta para el parcial:** "`/cancelar` es el caso de uso del cliente: solo dueño y solo PENDIENTE. El admin usa `/estado`. Un admin que prueba `/cancelar` sobre un pedido ajeno recibe 403, y eso es lo que pide la consigna."

#### D-21 · Excepciones de dominio traducidas a HTTP en el Router
- **Contexto / problema:** el Service no debería conocer HTTP (códigos, `HTTPException`): hoy es FastAPI, mañana podría ser una CLI.
- **Decisión:** el Service lanza excepciones propias (`StockInsuficiente`, `PedidoAjeno`, `TransicionInvalida`...), definidas en su `service.py`. El Router las captura con `try/except ERRORES_DOMINIO` y las convierte con `_http(error)`: no encontrados → 404, `PedidoAjeno` → 403, reglas de negocio → 400. El `detail` es `str(error)`.
- **Origen:** Consigna (pág. 11: tabla de excepciones de dominio y códigos).
- **Alternativas descartadas:** `HTTPException` directo en el Service (acopla negocio con HTTP; la consigna solo lo admite en auth y usuarios); `exception_handler` global (válido, pero hace menos explícito el mapeo por endpoint).
- **Consecuencias / trade-offs:** `auth` y `usuarios` también definen excepciones de dominio, pero el mapeo está igual en el router. Hay un `try/except` repetido por endpoint; podría centralizarse con un handler.
- **Respuesta para el parcial:** "El Service habla en términos de negocio ('stock insuficiente') y el Router decide el código HTTP. Así el negocio no depende del framework web."

---

# D. Seguridad y auth

#### D-22 · JWT en cookie HttpOnly, no en localStorage
- **Contexto / problema:** dónde guardar el token. En `localStorage` cualquier script inyectado (XSS) puede leerlo y robarlo.
- **Decisión:** el login (`POST /auth/token`, `auth/router.py`) hace `response.set_cookie("access_token", ..., httponly=True, max_age=ACCESS_TOKEN_EXPIRE_MINUTES*60, path="/")`. El cuerpo solo dice `{"message": "Login exitoso"}`. El frontend usa Axios con `withCredentials: true` y **nunca** lee ni guarda el token.
- **Origen:** Consigna (pág. 1, 2, 10; criterio 4 "token en el cuerpo o en localStorage" resta).
- **Alternativas descartadas:** token en el cuerpo y `localStorage` (vulnerable a XSS); token en memoria (se pierde al recargar).
- **Consecuencias / trade-offs:** al ser cookie, queda expuesta a **CSRF**; lo mitigo parcialmente con `SameSite=Lax` (D-23) y CORS restringido. Requiere CORS con credenciales (un origen explícito, no `*`).
- **Respuesta para el parcial:** "HttpOnly hace que JavaScript no pueda leer la cookie, así un XSS no puede robar el token. El precio es tener que pensar en CSRF, que mitigo con SameSite y CORS con origen explícito."

#### D-23 · Cookie `samesite=lax` y `secure=False` (solo en desarrollo)
- **Contexto / problema:** `Secure` exige HTTPS; en `localhost` con HTTP el navegador no enviaría la cookie.
- **Decisión:** `samesite="lax"` y `secure=False`, con el comentario en el código "en producción con HTTPS: True". Además, CORS en `main.py` usa `allow_origins=[settings.FRONTEND_ORIGIN]` y `allow_credentials=True`.
- **Origen:** Decisión propia (la consigna fija HttpOnly y CORS con credenciales; el resto lo elegí yo).
- **Alternativas descartadas:** `samesite="none"` (obliga a `Secure` y abre CSRF); `strict` (rompe la navegación entrante desde enlaces externos al sitio).
- **Consecuencias / trade-offs:** **en producción hay que poner `secure=True`**: es una deuda conocida. `secure` debería ser configurable por variable de entorno; hoy está fijo en el código. `lax` permite la cookie en navegación GET de nivel superior pero no en POST cruzados.
- **Respuesta para el parcial:** "`secure=False` es solo porque desarrollo en HTTP. En producción va en True junto con HTTPS. `lax` bloquea el envío de la cookie en POST desde otros sitios, que es el vector típico de CSRF."

#### D-24 · `get_current_user` devuelve `UserPublic`
- **Contexto / problema:** la dependencia abre un UoW para cargar el usuario; si devolviera el modelo `Usuario`, quedaría desligado (sesión cerrada) y expondría `hashed_password`.
- **Decisión:** `get_current_user` (en `app/core/deps.py`) lee la cookie, decodifica el JWT, carga el usuario con `UsuarioUnitOfWork` y retorna `UserPublic.model_validate(usuario)`. Las demás dependencias trabajan con ese schema (`usuario.role`, `usuario.disabled`, `usuario.id`).
- **Origen:** Consigna (pág. 8 y 14, `get_current_user`; criterio 4) + decisión propia sobre el tipo devuelto.
- **Alternativas descartadas:** devolver el modelo de tabla (`DetachedInstanceError`, filtra el hash); devolver solo el username (obliga a recargar en cada dependencia).
- **Consecuencias / trade-offs:** hay una consulta a la base por request autenticado (con una sesión propia, distinta de la del Service). Es simple y correcta, aunque no es la más eficiente. Un usuario eliminado devuelve 401 porque el token ya no corresponde a nadie.
- **Respuesta para el parcial:** "Devuelvo un `UserPublic` porque es un objeto plano, sin sesión atada y sin el hash de la contraseña. Los Services reciben ese schema y no dependen de la base para saber quién llama."

#### D-25 · `require_role` como fábrica (closure)
- **Contexto / problema:** necesito una dependencia que verifique roles distintos según el endpoint, pero `Depends` llama a una función sin argumentos propios.
- **Decisión:** `require_role(roles: list[str])` devuelve una función interna `verificar_rol` que usa `roles` por closure y depende de `get_current_active_user` (`core/deps.py`). Después creo alias: `AdminUser = Annotated[UserPublic, Depends(require_role(["admin"]))]` y `CurrentUser`. Responde 403 si el rol no está permitido.
- **Origen:** Consigna (pág. 8 y 10: `require_role(["admin"])`; criterio 4).
- **Alternativas descartadas:** una dependencia `require_admin` fija (no escala si aparece otro rol); `if usuario.role != "admin"` en cada endpoint (repetido y olvidable).
- **Consecuencias / trade-offs:** la cadena de dependencias garantiza el orden: 401 (sin sesión) → 400 (desactivada) → 403 (rol). Los alias `Annotated` dejan los endpoints legibles.
- **Respuesta para el parcial:** "Es una función que devuelve la dependencia ya configurada con los roles. Usa una closure: la función interna recuerda `roles`. Así declaro `AdminUser` una vez y lo uso en todos los endpoints de admin."

#### D-26 · Cuenta desactivada: 400, no 403
- **Contexto / problema:** un usuario con `disabled=True` no debería operar, pero el código de error debe distinguirse de "sin permiso".
- **Decisión:** `get_current_active_user` lanza 400 con el detalle `"Cuenta de usuario desactivada"` (constante `CUENTA_DESACTIVADA`), y el login hace lo mismo. Las credenciales incorrectas siguen siendo 401, y se chequean *antes*: no se revela que una cuenta existe y está desactivada sin la contraseña correcta.
- **Origen:** Consigna (pág. 3, 10, 11; criterio 4: "400 en cuenta desactivada").
- **Alternativas descartadas:** 403 (semánticamente más cercano, pero la consigna fija 400).
- **Consecuencias / trade-offs:** el frontend reconoce este caso por el *texto* exacto del `detail` (`CUENTA_DESACTIVADA` en `axiosInstance.ts`): es frágil, porque si cambio el mensaje en el backend deja de limpiar la sesión.
- **Respuesta para el parcial:** "La consigna fija 400 para cuenta desactivada. Primero valido credenciales y después el estado, para no filtrar información. El punto débil es que el frontend compara el mensaje de texto."

#### D-27 · Activar y desactivar idempotentes
- **Contexto / problema:** el admin puede hacer doble click o reintentar; ¿qué pasa si el usuario ya estaba activo?
- **Decisión:** `activar` pone `disabled=False` y `desactivar` hace baja lógica vía `uow.usuarios.delete(usuario)` (`disabled=True`). Ambas devuelven 200 con el `UserPublic` aunque el estado no cambie (`usuarios/service.py`).
- **Origen:** Consigna (pág. 10: "operaciones idempotentes: responden 200 aunque el estado no cambie").
- **Alternativas descartadas:** responder 409 si ya está en ese estado (obliga al cliente a manejar un error por una operación inofensiva).
- **Consecuencias / trade-offs:** reintentar es seguro; a cambio no se informa que "no pasó nada". Son `POST` sin cuerpo: representan acciones, no recursos.
- **Respuesta para el parcial:** "Idempotente significa que aplicar la operación dos veces deja el mismo resultado que una. Activar un usuario ya activo responde 200 igual, así reintentar es seguro."

#### D-28 · El admin no puede desactivarse a sí mismo
- **Contexto / problema:** si el único admin se desactiva, nadie puede reactivarlo (queda bloqueado el sistema).
- **Decisión:** `desactivar(id, id_actual)` compara el id y lanza `AutoDesactivacion` (400) **antes** de abrir el UoW (`usuarios/service.py`); el router le pasa `admin.id`. En el frontend, el botón Desactivar no se muestra en la fila del usuario logueado.
- **Origen:** Consigna (pág. 6 y 12; pantalla de usuarios, pág. 20).
- **Alternativas descartadas:** permitirlo y confiar en que "otro admin" lo repare.
- **Consecuencias / trade-offs:** no impide que el admin A desactive al admin B, ni que quede un solo admin desactivado por otra vía. Es una regla mínima, no un sistema de gobernanza.
- **Respuesta para el parcial:** "Lo bloqueo en el backend porque ocultar el botón no alcanza: alguien puede llamar la API directo. El botón oculto es solo UX."

---

# E. API

#### D-29 · `/pedidos/resumen` antes de `/{id}`
- **Contexto / problema:** FastAPI evalúa las rutas en orden de declaración. Si `/{id}` va primero, `GET /pedidos/resumen` intenta convertir `"resumen"` a entero y devuelve 422.
- **Decisión:** en `pedidos/router.py`, `@router.get("/resumen")` se declara **antes** de `@router.get("/{id}")`, con un comentario explícito. Además `id` usa `Path(gt=0)`.
- **Origen:** Consigna (pág. 13: "Se declara antes de /{id}").
- **Alternativas descartadas:** cambiar la ruta a `/resumen/pedidos` o `/admin/resumen` (se aparta del contrato pedido); tipar `id` con regex.
- **Consecuencias / trade-offs:** el orden es una dependencia implícita: si alguien reordena el archivo, se rompe sin error de arranque. Por eso el comentario.
- **Respuesta para el parcial:** "Las rutas se matchean por orden. Si `/{id}` estuviera antes, 'resumen' se interpretaría como un id. Por eso las rutas fijas van siempre antes que las parametrizadas."

#### D-30 · PUT parcial con `exclude_unset`
- **Contexto / problema:** el admin edita solo el precio y no quiere reenviar todo; pero distinguir "no enviado" de "enviado como null" es sutil.
- **Decisión:** `ProductoUpdate` y `CategoriaUpdate` tienen todos los campos opcionales. El Service hace `data.model_dump(exclude_unset=True)` y `sqlmodel_update(cambios)`: solo se modifican los campos que **vinieron en el body**. Un `field_validator` rechaza `null` explícito en campos obligatorios (nombre, precio, stock...).
- **Origen:** Consigna (pág. 10: "PUT actualiza los campos enviados y conserva los demás").
- **Alternativas descartadas:** `PATCH` para todo (la consigna usa PUT parcial); `exclude_none=True` (impediría poner un valor opcional en null a propósito, como `descripcion`).
- **Consecuencias / trade-offs:** el PUT no es "reemplazo total" en sentido REST estricto. `exclude_unset` es lo que permite diferenciar `omitido` de `null`.
- **Respuesta para el parcial:** "Con `exclude_unset` solo tocamos lo que el cliente mandó. Eso me deja distinguir entre 'no te dije nada' y 'quiero que sea null'. Para campos obligatorios, un validador rechaza el null."

#### D-31 · Paginación `{total, items}` con `limit <= 100`
- **Contexto / problema:** un listado sin límite no escala; y la UI necesita saber cuántas páginas hay.
- **Decisión:** `skip` (default 0, `ge=0`) y `limit` (default 20, `ge=1, le=100`) como `Query` en `productos/router.py` y `pedidos/router.py`. La respuesta es `{ "total": N, "items": [...] }`; el total se calcula con `select(func.count())` aplicando los mismos filtros. Orden estable (`order_by` por id o fecha) para que la paginación no repita ni saltee filas.
- **Origen:** Consigna (pág. 10 "Convenciones", pág. 15).
- **Alternativas descartadas:** paginación por cursor (mejor para grandes volúmenes, pero la consigna pide `skip/limit`); devolver una lista plana (sin `total` no se pueden dibujar páginas).
- **Consecuencias / trade-offs:** `OFFSET` se vuelve lento con muchas filas. El panel admin pide `limit=100` y pagina en memoria con TanStack Table (D-35): si hubiera más de 100 productos activos, los demás no aparecerían. Es una limitación asumida por la consigna.
- **Respuesta para el parcial:** "El servidor pagina con skip y limit y devuelve el total aparte, para que el frontend sepa cuántas páginas dibujar. Tope de 100 para que nadie pida un millón de filas."

#### D-32 · Nombre de categoría único sin distinguir mayúsculas; las inactivas conservan el nombre
- **Contexto / problema:** "Pizzas" y "pizzas" serían dos categorías para el usuario pero distintas para un `unique` simple. Y si una categoría dada de baja liberara su nombre, ¿qué pasa si se vuelve a crear?
- **Decisión:** `CategoriaRepository.get_by_nombre` compara `func.lower(nombre) == nombre.strip().lower()` y busca entre **todas** (activas e inactivas). La columna además es `unique=True` en el modelo. `actualizar` verifica que el nombre no pertenezca a *otra* categoría (`otra.id != categoria.id`). Duplicado → 409.
- **Origen:** Consigna (pág. 5 y 10: "La baja lógica de una categoría no libera su nombre único") + decisión propia para la comparación insensible a mayúsculas.
- **Alternativas descartadas:** `unique` sensible a mayúsculas (permite "Pizzas" y "pizzas"); permitir reusar el nombre de una inactiva (choca con el `unique` de la base).
- **Consecuencias / trade-offs:** un admin puede toparse con un 409 por una categoría que ya no ve (inactiva). El `unique` de la base sigue siendo sensible a mayúsculas: la verificación case-insensitive está solo en el Service; una carrera entre dos requests podría colarse (la base solo frenaría el caso exacto).
- **Respuesta para el parcial:** "Normalizo a minúsculas al comparar y busco también entre las inactivas, porque la baja lógica no libera el nombre. Es coherente con el `unique` de la base, aunque el chequeo insensible a mayúsculas vive en el Service."

#### D-33 · Seed idempotente con cliente de demo
- **Contexto / problema:** quien corra el proyecto necesita datos para probar, y ejecutar el seed dos veces no debe duplicar ni fallar.
- **Decisión:** `python -m app.db.seed` (`app/db/seed.py`) busca cada usuario por `username`, cada categoría por nombre y cada producto por nombre, y solo crea lo que falta. Crea `admin / Admin1234!`, un `cliente / Cliente1234!` (para probar el flujo de compra sin registrarse), 4 categorías y 10 productos con stock. Usa el `UnitOfWork` base, así que confirma todo junto al salir del `with`. Imprime cuántos creó.
- **Origen:** Consigna (pág. 16: admin, ≥3 categorías, ≥8 productos, idempotente; criterio 1) + el cliente de demo es decisión propia.
- **Alternativas descartadas:** `drop_all` + recrear (destruye datos); fixtures SQL fijas (no pasan por el hash de contraseña).
- **Consecuencias / trade-offs:** las contraseñas de demo están en el código: sirven para desarrollo y **no deben usarse en producción**. Si el admin cambia el precio de un producto del seed, re-ejecutar el seed no lo pisa (es el comportamiento buscado).
- **Respuesta para el parcial:** "El seed pregunta antes de crear: busca por clave natural y solo inserta lo que falta, entonces se puede correr n veces. Agregué un cliente de prueba para poder demostrar el flujo de compra sin registrarme."

---

# F. Frontend: arquitectura

#### D-34 · Organización por features
- **Contexto / problema:** agrupar por tipo (`components/`, `hooks/`, `pages/` globales) hace que un cambio en pedidos toque cuatro carpetas lejanas.
- **Decisión:** `src/features/{auth,categorias,productos,usuarios,pedidos}/` con `pages/`, `components/`, `hooks/`, `api/`, `types/`. Lo transversal en `src/shared/` (api, ui, components, layout, hooks, utils), el estado global en `src/store/` y las rutas en `src/routes/`. Las features espejan los módulos del backend.
- **Origen:** Consigna (pág. 17: "La organización del frontend por features se exige").
- **Alternativas descartadas:** estructura por tipo técnico; atomic design puro (demasiado granular para este tamaño).
- **Consecuencias / trade-offs:** aparecen dependencias entre features (el carrito de pedidos usa `ProductoCard` de productos; `useInvalidarPedidos` importa `PRODUCTOS_KEY`). Las acepto en una sola dirección y las exporto explícitamente.
- **Respuesta para el parcial:** "Cada feature es autocontenida: páginas, componentes, hooks, API y tipos juntos. Si tengo que cambiar pedidos, toco una sola carpeta. Lo que usan todas va a `shared`."

#### D-35 · `DataTable` genérico
- **Contexto / problema:** categorías, productos, pedidos y usuarios del panel necesitan tabla con orden, búsqueda y paginación. Repetir esa lógica cuatro veces es duplicación.
- **Decisión:** `shared/components/DataTable.tsx` es genérico: `DataTable<T>` recibe `data: T[]` y `columns: ColumnDef<T>[]`, y encapsula orden, filtro global y paginación del lado del cliente con TanStack Table. Cada feature define sus columnas (`columnasProductos.tsx`, etc.).
- **Origen:** Consigna (pág. 20: TanStack Table con paginación del lado del cliente; el panel pide `limit=100`) + el componente genérico es decisión propia.
- **Alternativas descartadas:** una tabla por feature (duplicación); paginación en el servidor en el panel (la consigna indica del lado del cliente).
- **Consecuencias / trade-offs:** como el panel pide `limit=100`, hay un techo de 100 filas visibles (ver D-31). A cambio, ordenar y buscar es instantáneo.
- **Respuesta para el parcial:** "Hice la tabla genérica con un parámetro de tipo `T`: cada pantalla le pasa sus columnas y sus datos, y la tabla se ocupa de ordenar, filtrar y paginar. Se reutiliza en las cuatro pantallas del admin."

#### D-36 · TypeScript `strict`, sin `any`
- **Contexto / problema:** sin tipos fuertes, un cambio de nombre de campo del backend rompe la UI en tiempo de ejecución.
- **Decisión:** `tsconfig.app.json` con `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` y `erasableSyntaxOnly`. No se usa `any`: para errores uso `unknown` + `axios.isAxiosError<ApiErrorBody>(...)`, y para valores de selects hay *type guards* (`esEstadoPedido`, `esFormaPago`) en lugar de casts. Los tipos de `types/` usan los mismos nombres de campo que los schemas del backend (`precio_base`, `nombre_producto`...).
- **Origen:** Consigna (pág. 4, criterio 10: "TypeScript con strict: true y sin any").
- **Alternativas descartadas:** `as` por todos lados (silencia al compilador sin verificar nada); generar los tipos desde OpenAPI (mejor a futuro, no requerido).
- **Consecuencias / trade-offs:** los tipos están escritos a mano, así que pueden desincronizarse del backend sin aviso. `pnpm build` ejecuta `tsc -b` y falla si hay errores de tipos.
- **Respuesta para el parcial:** "Activé `strict` y evité `any`: donde no conozco el tipo uso `unknown` y lo estrecho con type guards. Los tipos del frontend replican los schemas del backend, con la salvedad de que los mantengo a mano."

---

# G. Estado y datos

#### D-37 · TanStack Query para el servidor, Zustand para el cliente
- **Contexto / problema:** mezclar datos del servidor (productos, pedidos) con estado de UI/sesión en un mismo store lleva a duplicar caché y a escribir a mano loading/error/refetch.
- **Decisión:** TanStack Query maneja todo lo que vive en el servidor (catálogo, pedidos, usuarios, resumen) con caché e invalidación; Zustand maneja lo que vive en el cliente (sesión en `authStore`, carrito en `cartStore`). Ningún componente hace `fetch` en un `useEffect`; la única llamada en `useEffect` es `checkSession` al montar `App.tsx`.
- **Origen:** Consigna (pág. 17 "Separación del estado"; criterio 9).
- **Alternativas descartadas:** Redux para todo (mucho boilerplate y reimplementa la caché); `useEffect` + `useState` (sin caché, con condiciones de carrera); guardar la lista de productos en Zustand (dos fuentes de verdad).
- **Consecuencias / trade-offs:** hay dos herramientas para entender. `login` vive en el store (cliente) pero lo envuelvo en `useMutation` para tener `isPending` y `error` (`useAuth.ts`): un híbrido razonable pero que hay que saber explicar.
- **Respuesta para el parcial:** "Separé por origen del dato: si lo dueño es el servidor, va a TanStack Query, que cachea y se invalida; si lo dueño es el navegador, como el carrito o el usuario de sesión, va a Zustand. Así no duplico datos ni escribo a mano el estado de carga."

#### D-38 · `partialize`: solo `usuario` en `authStore`
- **Contexto / problema:** `persist` guarda *todo* el estado por defecto. Si guardara `cargando` o funciones, rehidrataría un estado inconsistente.
- **Decisión:** en `store/authStore.ts`, `persist` con `partialize: (state) => ({ usuario: state.usuario })` y `name: 'foodstore-auth'` en `localStorage`. El token jamás pasa por acá: vive en la cookie HttpOnly. En cada carga, `checkSession()` llama a `GET /auth/me` y corrige el estado si la cookie venció. `cargando` arranca en `true` para que `ProtectedRoute` no redirija antes de saber si hay sesión.
- **Origen:** Consigna (pág. 20: "partialize guarda solo usuario; nunca el token").
- **Alternativas descartadas:** persistir todo el store; no persistir y esperar siempre a `/me` (parpadeo de la UI al recargar).
- **Consecuencias / trade-offs:** el `usuario` en `localStorage` es información de UI (no un secreto), pero podría estar desactualizado (rol cambiado, cuenta desactivada) hasta que `checkSession` conteste. Por eso el backend siempre revalida.
- **Respuesta para el parcial:** "Persisto solo el objeto usuario, para que la interfaz no parpadee al recargar. El token no está ahí: está en una cookie HttpOnly que JavaScript no puede leer. Y en cada carga confirmo la sesión contra `/auth/me`."

#### D-39 · Interceptor de Axios: qué limpia y qué no
- **Contexto / problema:** si la sesión vence, cada pantalla fallaría con 401 y habría que manejar eso en cada componente.
- **Decisión:** `shared/api/axiosInstance.ts` crea un único cliente (`baseURL = VITE_API_URL`, `withCredentials: true`) con interceptor de respuesta. Limpia la sesión (`limpiarSesion`, `queryClient.clear()` y redirige a `/login`) en **dos** casos: 401 en cualquier URL **excepto** `/auth/token` y `/auth/me`, o 400 con detail `"Cuenta de usuario desactivada"`. Otros errores se rechazan tal cual para que los maneje quien llamó (`handleApiError`).
- **Origen:** Consigna (pág. 20, "Cliente HTTP"; criterio 9).
- **Alternativas descartadas:** interceptar todos los 401 (un login con contraseña incorrecta sacaría al usuario de la pantalla antes de mostrarle el error; `/auth/me` en el arranque daría un bucle); `refresh token` (fuera de alcance).
- **Consecuencias / trade-offs:** la redirección usa `window.location.assign` (recarga completa) y evita redirigir si ya estoy en `/login`. Detectar el 400 por texto exacto es frágil (D-26).
- **Respuesta para el parcial:** "El interceptor centraliza el caso 'sesión vencida'. Excluyo `/auth/token` y `/auth/me` porque ahí un 401 es una respuesta esperada, no una sesión que se cayó: si no, el login fallido o el chequeo inicial entrarían en un bucle."

#### D-40 · Jerarquía de `queryKey` e invalidación
- **Contexto / problema:** tras crear o cancelar un pedido cambian los pedidos, el resumen y el stock del catálogo. ¿Cómo refrescar todo sin tocar cada consulta?
- **Decisión:** las claves son jerárquicas: `['pedidos', 'lista', filtros]`, `['pedidos', 'resumen']`, `['productos', filtros]`, `['categorias']`, `['usuarios']`, con raíces exportadas (`PEDIDOS_KEY`, `PRODUCTOS_KEY`). Invalidar la raíz invalida todas las claves que cuelgan de ella. `useInvalidarPedidos` invalida `PEDIDOS_KEY` **y** `PRODUCTOS_KEY` (el stock cambió); `useInvalidarCategorias` invalida categorías **y** productos (los productos embeben su categoría). Cada combinación de filtros es una entrada de caché distinta.
- **Origen:** Consigna (pág. 20: `queryKey` descriptivas e `invalidateQueries` en `onSuccess`; criterio 9).
- **Alternativas descartadas:** `refetch()` manual en cada pantalla; actualizar la caché a mano con `setQueryData` (más rápido pero propenso a errores); invalidar todo (`queryClient.invalidateQueries()` sin filtro, ineficiente).
- **Consecuencias / trade-offs:** la invalidación hace un request extra por consulta activa. Acoplo un hook de pedidos con las claves de productos; lo acepto porque el acoplamiento es real (el stock). `staleTime` de 30 s en `queryClient.ts` reduce requests repetidos.
- **Respuesta para el parcial:** "Armé las claves con jerarquía para invalidar por raíz. Un pedido toca stock, así que al crear o cancelar invalido pedidos y productos. Así el catálogo nunca muestra stock viejo después de comprar."

#### D-41 · Logout limpia caché y carrito
- **Contexto / problema:** si el usuario A cierra sesión y entra B en el mismo navegador, podría ver los pedidos cacheados de A o heredar su carrito persistido.
- **Decisión:** `logout` en `authStore.ts` llama a `POST /auth/logout` y, en un `finally`, hace `set({usuario: null})`, `queryClient.clear()` y `useCartStore.getState().vaciar()`. El `finally` asegura la limpieza local aunque falle la red.
- **Origen:** La consigna exige que el logout limpie el authStore (pág. 20); limpiar la caché y el carrito es decisión propia.
- **Alternativas descartadas:** dejar el carrito (podría filtrar el contenido entre cuentas); limpiar solo el usuario.
- **Consecuencias / trade-offs:** el usuario pierde su carrito al cerrar sesión (aunque lo hubiera armado como anónimo), trade-off asumido por seguridad y simplicidad. Si falla el POST, igual quedo deslogueado en el cliente aunque la cookie siga viva hasta que expire.
- **Respuesta para el parcial:** "El carrito y la caché de TanStack son del navegador, no del usuario. Si no los limpio, el siguiente usuario hereda datos del anterior. Lo hago en un `finally` para que ocurra aunque el logout del servidor falle."

#### D-42 · `ProtectedRoute` es UX; la seguridad real está en el backend
- **Contexto / problema:** esconder una pantalla o un botón no impide que alguien llame a la API a mano.
- **Decisión:** `routes/ProtectedRoute.tsx` recibe `roles?` y: si `cargando`, muestra un indicador; sin usuario, redirige a `/login` guardando la ruta de origen; con usuario sin el rol, a `/unauthorized`; si todo está bien renderiza `<Outlet/>`. Se usa como ruta padre en `AppRouter.tsx` (una para sesión, otra con `roles={['admin']}` para `/admin/*`). Toda la autorización real sigue en `get_current_user` y `require_role`.
- **Origen:** Consigna (pág. 20: "La protección real está en el backend"; criterio 9).
- **Alternativas descartadas:** chequear el rol dentro de cada página (repetido); confiar solo en el frontend (inseguro).
- **Consecuencias / trade-offs:** el rol viene de `localStorage` hasta que `checkSession` lo confirme; alguien podría editarlo y *ver* una pantalla de admin, pero cualquier llamada devolvería 403.
- **Respuesta para el parcial:** "La guarda del frontend mejora la experiencia: evita mostrar pantallas que no puede usar. La seguridad real es `require_role` en el backend. Si modifico el `localStorage` para verme admin, veo la pantalla pero la API me responde 403."

---

# H. UX

#### D-43 · Formularios con TanStack Form espejando los límites del backend
- **Contexto / problema:** la validación solo en el servidor obliga a un viaje de ida y vuelta para mostrar "dirección muy corta"; solo en el cliente es insegura.
- **Decisión:** formularios con TanStack Form (`useForm`, `form.Field`) y validadores reutilizables en `shared/utils/validaciones.ts` (`longitud`, `emailValido`, `passwordValida`, `urlOpcional`, `numeroNoNegativo`) con los **mismos límites** que los schemas del backend (dirección 5-200, password 8+, notas 500, URL 500). El backend vuelve a validar (422) y `handleApiError` muestra el `detail`.
- **Origen:** Consigna (pág. 4, 19; criterios 7 y 8) + los validadores compartidos son decisión propia.
- **Alternativas descartadas:** validar con `zod` (dependencia extra no pedida); solo atributos HTML (`required`) sin mensajes propios.
- **Consecuencias / trade-offs:** los límites están duplicados (frontend y backend) y pueden divergir. Para el TPI es aceptable; a futuro se generarían desde un schema común.
- **Respuesta para el parcial:** "Valido en el cliente para dar feedback inmediato y copio los mismos límites del backend. El cliente es comodidad; la validación que vale es la del servidor, que igualmente repite todo."

#### D-44 · Modales de confirmación en acciones destructivas
- **Contexto / problema:** dar de baja un producto o cancelar un pedido son acciones difíciles de revertir; un click accidental causa daño.
- **Decisión:** `shared/components/ConfirmModal.tsx`, un diálogo propio que reemplaza a `window.confirm`. Recibe `procesando` y `error`, y si la mutación falla **queda abierto mostrando el error**. Se usa en bajas de categorías y productos, cancelación de pedidos y cambios de estado del admin.
- **Origen:** Decisión propia.
- **Alternativas descartadas:** `window.confirm` (no se estiliza, bloquea el hilo, no muestra errores del servidor); deshacer ("undo") con un toast (más complejo).
- **Consecuencias / trade-offs:** un click más por acción. Un error del servidor (p. ej. 400 por transición inválida) se ve en contexto, sin cerrar el modal.
- **Respuesta para el parcial:** "Una baja o una cancelación es difícil de deshacer, así que pido confirmación. Hice un modal propio porque `window.confirm` no se estiliza ni puede mostrar el error si el servidor rechaza la operación."

#### D-45 · Registro con login automático
- **Contexto / problema:** pedirle al usuario que se registre y luego vuelva a tipear sus datos para entrar es una fricción innecesaria.
- **Decisión:** `useRegistro` (`features/auth/hooks/useAuth.ts`) hace `registrar(datos)` y, si sale bien, `login(username, password)` con las mismas credenciales. El backend no se modifica: `POST /auth/register` sigue devolviendo solo el usuario.
- **Origen:** Decisión propia.
- **Alternativas descartadas:** que el registro del backend emita la cookie (cambia el contrato de la consigna); redirigir a `/login` (más pasos).
- **Consecuencias / trade-offs:** son dos requests; si el segundo fallara, el usuario queda creado pero sin sesión (tendría que ingresar manualmente). El rol siempre es `user` porque el registro público no puede elegirlo.
- **Respuesta para el parcial:** "Después de registrar llamo al login con las mismas credenciales para mejorar la experiencia, sin tocar el contrato del backend. El inconveniente es que son dos llamadas y la segunda podría fallar."

#### D-46 · Búsqueda con debounce y `keepPreviousData`
- **Contexto / problema:** buscar en cada tecla dispara un request por letra, y cambiar de página hace que la lista parpadee con el skeleton.
- **Decisión:** `useDebounce(busqueda.trim(), 300)` (`shared/hooks/useDebounce.ts`) retrasa el valor que alimenta la `queryKey`; `placeholderData: keepPreviousData` mantiene la página anterior visible mientras llega la siguiente. Al cambiar búsqueda o categoría, `setPagina(0)`. Skeleton en la carga inicial y `EstadoVacio` si no hay resultados.
- **Origen:** Consigna (pág. 4 y 19: búsqueda, filtro, skeleton y estado vacío) + debounce es decisión propia.
- **Alternativas descartadas:** buscar solo al apretar Enter; `useEffect` para hacer fetch (prohibido por la consigna).
- **Consecuencias / trade-offs:** 300 ms de latencia percibida antes de buscar. El hook solo demora un valor local; el fetch lo hace TanStack Query.
- **Respuesta para el parcial:** "El debounce evita un request por tecla y `keepPreviousData` evita que la lista desaparezca entre páginas. El fetch sigue siendo de TanStack Query, no de un `useEffect`."

---

# I. Calidad y tooling

#### D-47 · Carrito en el cliente, precio re-validado en el servidor
- **Contexto / problema:** el carrito se persiste en el navegador (Zustand `persist`). Un usuario puede editar el `localStorage` y poner precio 1 peso.
- **Decisión:** `cartStore` guarda `producto_id`, `nombre`, `precio_unitario`, `cantidad`, `stock` e imagen (`partialize` solo `items`), y acota cantidades al stock conocido. Pero el `POST /pedidos` envía **solo `producto_id` y `cantidad`** (`CheckoutPage.tsx`): el backend ignora cualquier precio del cliente y lee el `precio_base` de la base. Además valida stock, disponibilidad y estado activo.
- **Origen:** Consigna (RN-01; pág. 19 "carrito persistido") + decisión propia de no enviar precios.
- **Alternativas descartadas:** enviar precios en el body (manipulables); carrito en el servidor (fuera de alcance: "carrito persistido en el navegador").
- **Consecuencias / trade-offs:** el precio mostrado en el carrito puede quedar desactualizado respecto del real; el total del pedido siempre es el del servidor. Al agregar de nuevo un producto, se actualizan precio y stock del carrito con los datos más recientes.
- **Respuesta para el parcial:** "Nunca confío en lo que viene del cliente para el dinero. El front manda solo ids y cantidades; el precio, el stock y la disponibilidad los resuelve el backend dentro de la transacción."

#### D-48 · Sin tests automatizados (consigna)
- **Contexto / problema:** ¿por qué el proyecto no trae tests?
- **Decisión:** no incluí pruebas automatizadas. La consigna las lista en "Fuera de alcance". La verificación fue manual y por tipos (`pnpm build` corre `tsc -b`).
- **Origen:** Consigna (pág. 2, "Fuera de alcance: pruebas automatizadas").
- **Alternativas descartadas:** tests con `pytest` y `TestClient` / Vitest: serían la mejora natural.
- **Consecuencias / trade-offs:** es una debilidad real: las reglas críticas (stock, transiciones) no tienen red de seguridad ante regresiones. Si me preguntan qué testearía primero: `crear` con stock insuficiente (rollback completo) y las transiciones inválidas.
- **Respuesta para el parcial:** "La consigna dejaba los tests fuera de alcance. Soy consciente del riesgo; lo primero que testearía es que un pedido con un producto sin stock no descuente nada de los otros, y que los estados terminales rechacen transiciones."

---

# J. Diferencias con el TP8

#### D-49 · Qué cambió respecto del TP8 y por qué
- **Contexto / problema:** el TPI evoluciona de mi TP8, donde el profe me descontó puntos. Quiero poder mostrar qué aprendí.
- **Decisión:**
  - **Borrado físico → baja lógica** (`session.delete` desaparece; D-09, D-10). `BaseRepository.delete` solo cambia un flag.
  - **Commit disperso → Unit of Work:** ya no hay `commit()` en servicios ni routers (D-03, D-04).
  - **Ingredientes:** el TP8 los exigía; el TPI define 5 entidades sin ellos (D-12).
  - **Reglas de negocio con transacción:** stock y estados en una sola unidad (D-15, D-16, D-18, D-19).
  - **Seguridad:** JWT en cookie HttpOnly y roles por dependencia (D-22 a D-25).
- **Origen:** Corrección del profe en TP8 + Consigna del TPI.
- **Alternativas descartadas:** reutilizar el TP8 tal cual (repetiría los errores señalados); reescribir desde cero sin mirar lo anterior (se pierde lo que ya funcionaba).
- **Consecuencias / trade-offs:** la arquitectura es más pesada que la del TP8, pero cada decisión está atada a un criterio de la consigna.
- **Respuesta para el parcial:** "Del TP8 me llevé dos correcciones: dejé de borrar físicamente y usé baja lógica, y centralicé los commits en un Unit of Work. En el TPI los ingredientes no están porque el modelo entregado tiene cinco entidades."

---

## Chequeo final (antes del oral)

Podés cerrar este archivo cuando puedas contestar sin mirar:
- ¿Qué pasa, paso a paso, si el segundo producto de un pedido no tiene stock? (D-03, D-15, D-16)
- ¿Por qué `/cancelar` no sirve para que el admin cancele un pedido ajeno? (D-20)
- ¿Por qué la cookie es HttpOnly y qué riesgo introduce? (D-22, D-23)
- ¿Por qué `get_current_user` devuelve un schema y no el modelo? (D-07, D-24)
- ¿Qué invalido cuando creo un pedido y por qué? (D-40)
- ¿Qué debilidades reales tiene tu proyecto? (SQLite ignora `FOR UPDATE`; `secure=False`; límites duplicados; sin tests; panel limitado a 100; detección del 400 por texto).
