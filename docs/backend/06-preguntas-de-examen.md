# 06 - Preguntas de examen oral (con respuestas modelo)

Tip: contestá en tres tiempos: **definición**, **por qué importa**, **dónde está en tu código**.

---

### Arquitectura

**1. ¿Qué arquitectura usa el backend?**
En capas por módulo de dominio: Router -> Service -> Unit of Work -> Repository -> Model. Cada capa solo depende de la de abajo. Está en `app/modules/<dominio>/`, con infraestructura compartida en `app/core/`.

**2. ¿Qué responsabilidad tiene cada capa y qué NO debe hacer?**
Router: HTTP (valida body, `Depends`, traduce excepciones), sin reglas ni commit. Service: reglas de negocio, abre el `with uow`, devuelve schemas. UoW: sesión y commit/rollback. Repository: consultas, sin reglas. Model: tablas. Ejemplo: `PedidoService` decide si hay stock; `ProductoRepository` solo sabe buscar.

**3. ¿Por qué el flujo de dependencias es unidireccional?**
Para poder cambiar una capa sin romper las de arriba y que el dominio no dependa de la infraestructura. Si el Repository importara el Service, tendrías ciclos y no podrías testearlo aislado.

**4. ¿Qué es un Unit of Work y por qué lo usás?**
Es el objeto que representa una transacción de negocio: abre la sesión en `__enter__` y en `__exit__` hace commit si todo salió bien, rollback si hubo excepción, y siempre close (`app/core/unit_of_work.py`). Lo uso para que crear un pedido sea atómico.

**5. ¿Quién hace el commit? ¿Puede hacerlo el Service?**
Solo `UnitOfWork.__exit__`. Ningún Service, Router ni Repository llama a `session.commit()`. Los repositorios usan `flush()`, que envía el SQL pero no confirma. Si el Service commiteara, mezclarías responsabilidad y perderías el "todo o nada" de la transacción.

**6. ¿Por qué `__exit__` no devuelve `True`?**
Porque devolver `True` suprime la excepción. Quiero que, después del rollback, la excepción de dominio siga subiendo hasta el Router para traducirla a 400/404.

**7. ¿Qué es el patrón Repository y qué ganás?**
Encapsula el acceso a datos de una entidad. El Service pide "producto por id" sin escribir SQL. Ganás desacople de la base y consultas reutilizables y testeables.

**8. ¿Para qué sirve `BaseRepository[T]` y qué son los genéricos?**
Es una clase genérica con `get_by_id`, `get_all`, `add`, `delete` escritos una vez. `T` es el tipo del modelo; `class CategoriaRepository(BaseRepository[Categoria])` fija `T`. Evita duplicar código y el type checker sabe qué tipo devuelve cada método.

**9. ¿Cómo funciona la inyección de dependencias en FastAPI?**
Declarás `service: ServiceDep` (un `Annotated[PedidoService, Depends(get_pedido_service)]`) y FastAPI construye y pasa el objeto antes de ejecutar el endpoint. Permite encadenar dependencias (`CurrentUser` -> `get_current_active_user` -> `get_current_user`) y reemplazarlas en tests.

**10. ¿Por qué el Router no abre el Unit of Work?**
Porque abrirlo es parte de ejecutar el caso de uso, es decisión del Service. El Router solo obtiene el Service con `Depends(get_pedido_service)` y llama a un método.

**11. ¿Por qué el Service devuelve el schema dentro del `with`?**
Porque tras el commit los objetos de tabla quedan expirados y, al cerrar la sesión, desligados: leer sus atributos daría `DetachedInstanceError`. `PedidoRead.model_validate(pedido)` copia los datos a un objeto Pydantic plano mientras la sesión vive.

**12. ¿Diferencia entre excepción de dominio y `HTTPException`? ¿Por qué no lanzar `HTTPException` desde el Service?**
La de dominio (`StockInsuficiente`) expresa un hecho del negocio y no sabe de HTTP; `HTTPException` es de la capa web. Si el Service lanzara `HTTPException`, quedaría atado a FastAPI y no podrías reusarlo en un script o test. El Router las traduce en `_http()`. (La consigna acepta HTTPException en Service solo para auth/usuarios; acá igual usé excepciones de dominio.)

**13. ¿Por qué dos schemas distintos (`PedidoCreate` y `PedidoRead`) y no el modelo de tabla?**
Entrada y salida tienen formas distintas (el cliente no manda `id`, `total` ni `estado`). Y exponer el modelo de tabla filtraría campos internos (como `hashed_password`). Por eso `UserPublic` no incluye el hash.

---

### Autenticación y seguridad

**14. ¿Cómo funciona el login?**
`POST /auth/token` recibe un formulario OAuth2. `AuthService.login` busca al usuario, verifica el hash bcrypt, comprueba que no esté `disabled` y crea un JWT con `sub=username` y `exp`. El Router lo guarda en la cookie `access_token` (HttpOnly) y responde `{"message": "Login exitoso"}`: el token no va en el body.

**15. ¿Por qué cookie HttpOnly y no localStorage?**
Por XSS. Si un atacante inyecta JavaScript, puede leer `localStorage` y robar el token; una cookie HttpOnly no es accesible desde JS. Además el navegador la envía solo. La rúbrica penaliza token en body o localStorage. Contrapartida: riesgo de CSRF, mitigado con `SameSite=Lax`.

**16. ¿Qué lleva el JWT y se puede falsificar?**
Lleva `sub` (username) y `exp`. Está firmado con `SECRET_KEY` (HS256): se puede leer pero no modificar sin la clave. Se valida firma y expiración en `decode_access_token`.

**17. ¿Cómo se guardan las contraseñas?**
Con hash bcrypt (Passlib) en `hashed_password`. bcrypt es lento a propósito y usa sal, así que dos claves iguales dan hashes distintos. Se verifica con `verify_password`, nunca se compara con `==`.

**18. ¿Por qué `bcrypt==4.0.1` y `passlib==1.7.4` fijados?**
Passlib 1.7.4 no se mantiene y falla con bcrypt 5. Si no fijás bcrypt, pip instala la última y el hash rompe. Por eso se pinean las dos.

**19. Explicá `get_current_user`, `get_current_active_user` y `require_role`.**
`get_current_user` lee la cookie, decodifica el JWT y carga el usuario (401 si falla). `get_current_active_user` depende de la anterior y rechaza `disabled` con 400. `require_role(roles)` es una fábrica que devuelve una dependencia que compara `usuario.role` con la lista (403). Se encadenan con `Depends`.

**20. ¿Por qué `require_role` devuelve una función (closure)?**
Porque `Depends` necesita un callable y quiero parametrizar el rol: `require_role(["admin"])` devuelve `verificar_rol` que "recuerda" la lista de roles. Una función común no podría recibir parámetros y a la vez ser dependencia.

**21. ¿Diferencia entre 401, 403 y 400 en tu API?**
401: no hay sesión válida (cookie ausente/token inválido o vencido). 400 "Cuenta de usuario desactivada": hay sesión pero la cuenta está `disabled`. 403: sesión válida pero el rol no alcanza. 422: el body no pasa el schema.

**22. ¿Cómo evitás que alguien se registre como admin?**
`UserCreate` no tiene campo `role` y `AuthService.registrar` fija `role="user"`. Solo el seed crea admin.

**23. ¿Por qué el login devuelve el mismo 401 si el usuario no existe o la clave está mal?**
Para no revelar qué usuarios existen (evitar *user enumeration*).

**24. ¿Qué pasa si desactivan a un usuario con sesión abierta?**
En su próxima request, `get_current_active_user` ve `disabled=True` y responde 400. La baja es inmediata aunque el JWT siga vigente.

**25. ¿El logout invalida el token?**
No del lado servidor (es stateless). `delete_cookie` hace que el navegador la descarte. Un token robado seguiría válido hasta vencer (30 min). Es una limitación conocida del JWT stateless.

---

### Catálogo y datos

**26. ¿Qué es la baja lógica y por qué no borrás físicamente?**
En vez de `DELETE` hago `activo=False` (o `disabled=True`). Razones: integridad referencial (`DetallePedido` apunta al producto), historial de ventas, y reversibilidad. Borrar físicamente un producto vendido rompería la FK o el historial; por eso el borrado físico estaba penalizado en el TP8 y la rúbrica actual lo resta. Está en `BaseRepository.delete`, que hace `setattr(obj, campo_baja, valor_baja)`.

**27. ¿Cómo se trata una categoría o producto dado de baja?**
Como inexistente: `get_activa` / `get_activo` devuelven `None` y el Service lanza `...NoEncontrada` -> 404 en detalle, PUT, PATCH y DELETE.

**28. ¿Por qué la baja de una categoría no libera su nombre?**
`get_by_nombre` busca entre todas (activas o no). Así no se puede crear otra "Pizzas" mientras exista la dada de baja; la consigna lo pide.

**29. ¿Cómo hacés la paginación?**
`skip` y `limit` (default 0 y 20, máximo 100, validados con `Query(ge=0)` y `Query(ge=1, le=100)`). El repositorio hace `offset(skip).limit(limit)` y cuenta el `total` con `func.count` y los mismos filtros. Devuelve `{total, items}`.

**30. ¿Cómo funciona la búsqueda?**
`ilike(f"%{search}%")` sobre `nombre`: contiene, sin distinguir mayúsculas. Se combina con filtros por `categoria_id` y `disponible`; el de `disponible` usa `is not None` porque `False` es un valor válido.

**31. ¿Qué hace `exclude_unset=True` y por qué es clave en PUT parcial?**
`model_dump(exclude_unset=True)` devuelve solo los campos que el cliente envió. Con `sqlmodel_update` se pisan solo esos y los demás se conservan. Sin eso, los omitidos llegarían como `None` y borrarían datos.

**32. ¿Qué es el problema N+1 y cómo lo evitás?**
Una consulta para la lista más una por cada fila para cargar su relación. Uso `selectinload(Producto.categoria)` y `selectinload(Pedido.items)`, que traen las relaciones en una sola consulta adicional.

**33. ¿Por qué `DELETE` devuelve 204 con `Response(status_code=204)`?**
204 significa "sin contenido"; no puede haber body. Devuelvo un `Response` vacío en vez de dejar que FastAPI serialice `null`.

---

### Pedidos

**34. Contame el flujo de crear un pedido.**
Router valida `PedidoCreate` (422) y resuelve el usuario. El Service abre el UoW, rechaza productos repetidos, crea el `Pedido` PENDIENTE con total 0 y, por cada ítem, bloquea el producto (`FOR UPDATE`), valida activo/disponible/stock, descuenta stock, crea la línea con copia de nombre y precio y acumula el total. Asigna el total, arma `PedidoRead` dentro del bloque y al salir el UoW hace commit. Si hay excepción: rollback.

**35. ¿Qué garantiza que "el pedido se cree completo o no se cree"?**
La atomicidad de una transacción: `PedidoRepository` y `ProductoRepository` comparten la misma sesión, y `__exit__` hace rollback ante cualquier excepción. Se demuestra en `pedidos.http` #10-#11: falla el 2° ítem y el stock del 1° no cambió.

**36. ¿Qué pasa con el stock descontado si falla un ítem posterior?**
El `UPDATE` de stock nunca se confirmó (solo se hizo flush dentro de la transacción), así que el rollback lo descarta y el stock queda como estaba.

**37. ¿Por qué copiás `nombre_producto` y `precio_unitario` en `DetallePedido`?**
Para la inmutabilidad histórica (RN-05): si el precio o el nombre del producto cambian, los pedidos viejos no deben cambiar. Es un *snapshot* al momento de la compra; sin él, el historial contable se corrompe.

**38. ¿Para qué sirve `get_para_actualizar` / `with_for_update`?**
Es `SELECT ... FOR UPDATE`: bloquea la fila del producto hasta el fin de la transacción para que dos pedidos simultáneos no vendan la misma última unidad (evita *lost update*). Solo tiene efecto en PostgreSQL, no en SQLite.

**39. Explicá la máquina de estados.**
Un diccionario `TRANSICIONES: dict[str, set[str]]` en `PedidoService`: PENDIENTE -> {EN_PREPARACION, CANCELADO}; EN_PREPARACION -> {ENTREGADO, CANCELADO}; ENTREGADO y CANCELADO -> set vacío (terminales). `_transicionar` valida `nuevo in TRANSICIONES[actual]` **antes** de modificar; si no, `TransicionInvalida` -> 400.

**40. ¿Por qué un diccionario y no `if/elif`?**
Es declarativo: los datos están separados de la lógica, se lee de un vistazo, agregar un estado es agregar una entrada y la consulta es O(1).

**41. ¿Cómo se restituye el stock al cancelar?**
En `_transicionar`, si `nuevo == "CANCELADO"`, recorre `pedido.items` y suma `item.cantidad` al stock de cada producto, todo en el mismo `with` que cambia el estado: o se aplican ambos o ninguno (RN-03).

**42. ¿Quién puede cancelar y cuándo?**
El cliente dueño solo desde PENDIENTE (`PATCH /pedidos/{id}/cancelar`: 403 si es ajeno, 400 si no está PENDIENTE). El admin, con `PATCH /pedidos/{id}/estado`, desde cualquier estado no terminal.

**43. ¿Cómo se implementa RN-04 (permisos)?**
En `listar`: admin -> `usuario_id=None` (ve todos), cliente -> su id. En `obtener`: `role != admin and pedido.usuario_id != usuario.id` -> `PedidoAjeno` (403). En `cancelar`: dueño + estado PENDIENTE.

**44. ¿Cómo garantizás que los pedidos no se borran ni se editan (RN-05)?**
No existen endpoints de borrado ni edición (un `DELETE /pedidos/{id}` da 405), `PedidoRepository.campo_baja = None` hace que `delete` lance `NotImplementedError`, y `total` solo se asigna en `crear`.

**45. ¿Dónde se valida forma de pago y dirección (RN-06)?**
En el schema `PedidoCreate`: `forma_pago: Literal["EFECTIVO","TRANSFERENCIA"]` y `direccion_entrega` con `min_length=5, max_length=200`. Lo valida FastAPI antes de llegar al Service (422).

**46. ¿Cómo calculás el resumen del panel?**
`count_by_estado` hace `GROUP BY estado` con `func.count`; `sum_total_by_estado("ENTREGADO")` usa `func.sum` con `coalesce`; `count_desde` cuenta los de hoy. Agregar en la base es más eficiente que traer los pedidos y contarlos en Python.

**47. ¿Por qué `/pedidos/resumen` se declara antes de `/pedidos/{id}`?**
Porque FastAPI resuelve rutas en orden: si `/{id}` fuera primero, "resumen" se intentaría convertir a `int` y fallaría con 422.

**48. ¿Qué códigos devuelve `POST /pedidos` y de dónde sale cada uno?**
201 éxito; 404 `ProductoNoEncontrado`; 400 `StockInsuficiente`, `ProductoNoDisponible`, `ProductoRepetido`; 422 schema inválido (sin ítems, cantidad 0, forma de pago o dirección inválidas); 401/400 sesión; todos traducidos en `_http` del router.

**49. ¿Por qué un admin que llama a `/cancelar` sobre un pedido ajeno recibe 403?**
Porque `cancelar` valida que el pedido sea del usuario de la sesión (endpoint "Dueño"). El admin tiene su propio camino: `PATCH /estado`.

---

### Configuración, datos y otros

**50. ¿Qué hace el seed y por qué es idempotente?**
Carga admin, cliente, categorías y productos, pero antes de cada inserción busca por `username`/`nombre` y solo crea lo que falta. Todo en un UoW: un solo commit. Se puede correr varias veces sin duplicar.

**51. ¿Qué hace `lifespan` y qué limitación tiene `create_all`?**
Al arrancar llama `create_all_tables()` para crear tablas faltantes. `create_all` no modifica tablas existentes: si cambiás un modelo necesitás recrear la base o usar migraciones (Alembic), que acá no hay.

**52. ¿Por qué CORS con credenciales y no `allow_origins=["*"]`?**
Con `allow_credentials=True` el navegador exige un origen explícito. Por eso `allow_origins=[settings.FRONTEND_ORIGIN]`. Sin credenciales habilitadas, la cookie no viajaría.

**53. ¿Por qué `SECRET_KEY` no tiene valor por defecto?**
Un secreto por defecto en el código sería público y permitiría falsificar tokens. Con `Field(min_length=32)` sin default, la app no arranca si falta o es débil.

**54. ¿Por qué `importar_modelos()` en `database.py`?**
SQLModel registra una tabla en `metadata` al importar su clase. Si nadie importó `Pedido`, `create_all` no la crea, y las relaciones por string no resolverían.

**55. ¿Qué pasa si dos requests usan la misma sesión?**
No pasa: cada request crea su propio Service y UoW (`get_xxx_service`) y cada `__enter__` abre una sesión nueva con `session_factory`. No hay sesión global.

**56. Limitaciones honestas de tu backend (si te las preguntan).**
`secure=False` en la cookie (en producción HTTPS debe ser `True`); logout no revoca el JWT; sin migraciones; `core/deps.py` importa de `modules/usuarios`; `FOR UPDATE` solo aplica en PostgreSQL y el `.env` hay que crearlo a mano copiando `.env.example`.
