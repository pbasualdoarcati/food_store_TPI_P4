# 01 - Core: `app/core/` y `app/main.py`

`core/` es la **infraestructura compartida**: no sabe de pedidos ni de categorías (salvo `deps.py`, ver gotcha). Todos los módulos se apoyan en ella.

**Por qué existe un `core/` separado de `modules/`:** **lo exige la consigna** (pág. 2 y 8: "un paquete `core/` con la infraestructura compartida y un paquete por dominio en `modules/`"; criterio 1). Razón técnica: lo que usan todos los módulos (configuración, sesión, seguridad, UoW base) se escribe una vez; si viviera dentro de un módulo, los demás dependerían de ese módulo.

> Cada entrada sigue la plantilla: **Qué hace / Por qué lo planteamos así / Alternativa descartada / Si te preguntan en el parcial**. Ver "Cómo usar estos docs" en `00-arquitectura.md`.

---

## `app/main.py` - el punto de entrada

Crea la aplicación FastAPI, registra CORS y monta los routers. Se levanta con `uvicorn app.main:app --reload`.

### `API_PREFIX = "/api/v1"` — `main.py`
**Qué hace:** constante con el prefijo común; se pasa a cada `include_router(..., prefix=API_PREFIX)`.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 2 y 10: "Prefijo `/api/v1`"). Razón técnica: versionar en la URL permite sacar un `/api/v2` sin romper a los clientes existentes. Definirlo en una constante evita escribirlo cinco veces.
**Alternativa descartada:** escribir el prefijo dentro de cada `APIRouter(prefix="/api/v1/...")`. Si cambia la versión hay que tocar cinco archivos; así se toca una línea.
**Si te preguntan en el parcial:** "Puse el prefijo en una constante en `main.py` porque la consigna pide `/api/v1` y de este modo, si se versiona, lo cambio en un solo lugar."

### `lifespan(_: FastAPI) -> AsyncIterator[None]` — `main.py`
**Qué hace:** antes del `yield` llama a `create_all_tables()` (crea las tablas si no existen). No hay código de apagado.
**Por qué lo planteamos así:** **decisión nuestra** (la consigna pide que exista `create_all_tables`, pág. 8, pero no dice dónde llamarlo). `lifespan` es el mecanismo actual de FastAPI para código de arranque/apagado y reemplaza al viejo `@app.on_event("startup")`, que está deprecado. Es un `@asynccontextmanager`. El parámetro se llama `_` porque no lo usamos.
**Alternativa descartada:** `@app.on_event("startup")` (deprecado) o crear las tablas a mano antes de levantar (el criterio CE-05 pide que `uvicorn app.main:app` funcione sin pasos extra).
**Si te preguntan en el parcial:** "Creo las tablas en el `lifespan` para que la app arranque sola con `uvicorn`, y usé `lifespan` porque `on_event` está deprecado."
**Gotcha:** `create_all` solo crea tablas faltantes; **no modifica** tablas existentes. Si cambiás un modelo, tenés que borrar la base de desarrollo (o usar migraciones, que acá no hay).

### `app = FastAPI(title=..., description=..., version="1.0.0", lifespan=lifespan)` — `main.py`
**Qué hace:** crea la instancia de la aplicación; `title` y `description` aparecen en `/docs` y `/redoc`.
**Por qué lo planteamos así:** la consigna exige que `main.py` "crea la aplicación FastAPI" (pág. 9) y que la API esté documentada en `/docs` y `/redoc` (pág. 2). Poner `title`/`description` es **decisión nuestra** para que la documentación automática se entienda sin leer el código.
**Alternativa descartada:** dejar los metadatos por defecto ("FastAPI"): la documentación generada no identificaría el proyecto.
**Si te preguntan en el parcial:** "La documentación de `/docs` sale sola de FastAPI; solo completé título y descripción para que sea presentable."

### `app.add_middleware(CORSMiddleware, ...)` — `main.py`
```python
allow_origins=[settings.FRONTEND_ORIGIN],
allow_credentials=True,
allow_methods=["*"],
allow_headers=["*"],
```
**Qué hace:** autoriza al navegador a aceptar respuestas del backend cuando la petición viene del origen del frontend, e incluye la cookie.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 2 y 9: "CORS con credenciales"; criterio 1). Frontend (`localhost:5173`) y backend (`localhost:8000`) son *orígenes distintos*; el navegador bloquea las respuestas salvo que el servidor lo autorice. `allow_credentials=True` es lo que permite que viaje la cookie `access_token`. **Decisión nuestra:** `allow_origins` toma `settings.FRONTEND_ORIGIN` (no un valor fijo) para poder cambiarlo por entorno; `allow_methods`/`allow_headers` en `["*"]` por simplicidad.
**Alternativa descartada:** `allow_origins=["*"]`. Con credenciales el navegador **lo rechaza**: tiene que ser un origen explícito. También es más inseguro porque cualquier sitio podría usar la sesión del usuario.
**Si te preguntan en el parcial:** "Como el token viaja en una cookie y el frontend está en otro origen, necesito CORS con credenciales y un origen explícito; con `*` el navegador no lo permite."

### `app.include_router(...)` x5 — `main.py`
**Qué hace:** monta `auth`, `usuarios`, `categorias`, `productos` y `pedidos`. Cada router declara su propio prefijo (`/auth`, `/admin/usuarios`, `/categorias`...).
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 9: `main.py` "incluye los routers con el prefijo `/api/v1`"). Razón técnica: cada módulo dueño de su prefijo, `main.py` solo ensambla; agregar un módulo nuevo es una línea.
**Alternativa descartada:** declarar todos los endpoints en `main.py`: archivo gigante y capas mezcladas (criterio 1).
**Si te preguntan en el parcial:** "`main.py` solo ensambla: cada módulo define sus rutas y yo los incluyo con el prefijo de versión."

### `root() -> dict[str, str]` (`GET /`, tag `health`) — `main.py`
**Qué hace:** devuelve `{"message": "Food Store API", "docs": "/docs", "redoc": "/redoc"}`. Está **fuera** de `/api/v1`.
**Por qué lo planteamos así:** **decisión nuestra** (no está en la consigna). Sirve de chequeo rápido de que el servidor vive y de guía hacia la documentación. Está fuera del prefijo porque no es parte del contrato versionado de la API.
**Alternativa descartada:** no tener ruta raíz: entrar a `/` daría un 404 confuso. Un endpoint `/health` más completo (chequeo de base) sería más profesional pero excede el alcance.
**Si te preguntan en el parcial:** "Es un endpoint de salud mínimo para verificar que el server levantó; no forma parte de la API versionada."

---

## `app/core/config.py` - configuración

### `class Settings(BaseSettings)` — `config.py`
**Qué hace:** clase de `pydantic-settings` que lee variables de entorno / archivo `.env` y las valida con tipos.
- `model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")`: lee `.env` del **directorio de trabajo actual** (por eso se corre desde `backend/`); `extra="ignore"` ignora variables que no declaró.
- Campos:

| Campo | Default | Nota |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./foodstore.db` | En prod: `postgresql://user:pass@host:5432/db` |
| `SECRET_KEY` | **sin default**, `Field(min_length=32)` | Obligatoria: si falta o es corta, la app **no arranca** |
| `ALGORITHM` | `HS256` | Algoritmo de firma del JWT |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Vence token **y** cookie |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Para CORS |

**Por qué lo planteamos así:** **lo exige la consigna** (pág. 2, 8 y 16: `Settings` con pydantic-settings leídas de `.env`, con exactamente esas cinco variables; criterio 1). Razón técnica: la configuración (secretos, URL de la base) **no se hardcodea** porque cambia por entorno y porque un secreto en el repositorio es una filtración. Pydantic además **valida tipos** al arrancar (por ejemplo, `ACCESS_TOKEN_EXPIRE_MINUTES` tiene que ser entero). **Decisión nuestra:** `extra="ignore"` para que variables ajenas en el `.env` no rompan el arranque, y defaults solo para lo no sensible.
**Alternativa descartada:** `os.getenv("SECRET_KEY")` suelto en cada archivo: sin validación, sin tipos, y los errores aparecen tarde (cuando se usa) en vez de al arrancar.
**Si te preguntan en el parcial:** "Centralicé la configuración en una clase `Settings` para que se valide al arrancar y no haya secretos en el código. Las variables vienen del `.env`, que no se versiona; el repositorio trae un `.env.example`."

### `settings = Settings()  # type: ignore[call-arg]` — `config.py`
**Qué hace:** instancia única (singleton de módulo) que importan todos. El `type: ignore` es porque el type checker no sabe que `SECRET_KEY` se completa desde el entorno.
**Por qué lo planteamos así:** **decisión nuestra.** Un objeto único evita releer el `.env` en cada import y da un punto de acceso común (`from app.core.config import settings`).
**Alternativa descartada:** `get_settings()` con `lru_cache` y `Depends` (patrón de la documentación de FastAPI): útil para testear con configuración distinta, pero agrega indirección que no necesitamos porque la consigna excluye pruebas automatizadas (pág. 2, "Fuera de alcance").
**Si te preguntan en el parcial:** "Instancio `Settings` una vez a nivel de módulo; es simple y alcanza porque la configuración no cambia durante la ejecución."

#### Por qué `SECRET_KEY` no tiene valor por defecto
**Qué hace:** si falta la variable o tiene menos de 32 caracteres, la aplicación **falla al arrancar**.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 16: "mínimo 32 caracteres"). Razón técnica: un secreto por defecto en el código es una vulnerabilidad (cualquiera que lea el repo podría falsificar tokens y hacerse pasar por admin). Es la política de *fail fast*: mejor no arrancar que arrancar inseguro.
**Alternativa descartada:** un default tipo `"secret"` para "que funcione sin configurar". Cómodo, pero deja el sistema forjable.
**Si te preguntan en el parcial:** "No le puse default a la clave porque un secreto por defecto en el código permite falsificar tokens; prefiero que la app no arranque sin una clave real de 32 caracteres o más."
**Gotcha:** sin `.env` la app no arranca. Se copia de `backend/.env.example` (CE-03), que sí existe en el repositorio.

---

## `app/core/database.py` - motor y sesiones

### `_connect_args` — `database.py`
```python
{"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
```
**Qué hace:** desactiva la verificación de hilo solo cuando la base es SQLite.
**Por qué lo planteamos así:** **decisión nuestra**, consecuencia de que la consigna acepta SQLite en desarrollo (pág. 6). SQLite por defecto prohíbe usar una conexión desde un hilo distinto al que la creó; FastAPI atiende endpoints síncronos (`def`) en un pool de hilos, así que sin esto saltaría `ProgrammingError`. En PostgreSQL no hace falta y el parámetro ni existe.
**Alternativa descartada:** pasarlo siempre (rompería con `psycopg2`, que no conoce ese argumento), o usar solo PostgreSQL (menos cómodo para desarrollar local).
**Si te preguntan en el parcial:** "Lo pongo solo para SQLite porque FastAPI usa varios hilos y SQLite por defecto no lo permite; con PostgreSQL no es necesario."

### `engine = create_engine(settings.DATABASE_URL, connect_args=_connect_args)` — `database.py`
**Qué hace:** el motor, que administra el pool de conexiones. Uno solo para toda la app.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 8: `database.py` provee `engine`). Razón técnica: crear conexiones es caro; un único engine las reutiliza con un pool. El `DATABASE_URL` viene de la configuración para cambiar de SQLite a PostgreSQL sin tocar código.
**Alternativa descartada:** abrir una conexión por request a mano: más lento, y hay que cerrarla manualmente.
**Si te preguntan en el parcial:** "Hay un único engine porque administra el pool de conexiones; la URL viene del `.env`, así cambio de SQLite a PostgreSQL sin tocar código."

### `importar_modelos() -> None` — `database.py`
**Qué hace:** importa (con imports dentro de la función) los módulos `models` de categorias, pedidos, productos y usuarios.
**Por qué lo planteamos así:** **decisión nuestra.** SQLModel registra una tabla en `SQLModel.metadata` **al importar** la clase. Si nadie importó `Pedido`, `create_all` no la crea. Además deja resolubles las relaciones con strings (`"Producto"`, `"Pedido"`) que se refieren entre módulos. Los imports van **dentro de la función** para evitar imports circulares al cargar el módulo (los modelos podrían importar `database`).
**Alternativa descartada:** imports arriba de `database.py` (riesgo de ciclos) o confiar en que otro archivo ya los importó (frágil: depende del orden de imports).
**Si te preguntan en el parcial:** "Importo todos los modelos explícitamente antes de `create_all` porque SQLModel solo conoce las tablas de las clases ya importadas; lo hago dentro de la función para evitar imports circulares."
**Quién la llama:** `create_all_tables()`.

### `create_all_tables() -> None` — `database.py`
**Qué hace:** `importar_modelos()` + `SQLModel.metadata.create_all(engine)`. La llaman `lifespan` (main) y `seed()`.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 8: `create_all_tables`). Que también la use el seed es decisión nuestra: así `python -m app.db.seed` funciona aunque nunca se haya levantado la API.
**Alternativa descartada:** migraciones con Alembic (más robusto, pero fuera de alcance; ver `00-arquitectura.md`, sección 8).
**Si te preguntan en el parcial:** "Es una sola función que crea las tablas; la usa el arranque de la API y el seed para no depender del orden en que se ejecuten."

### `session_factory() -> Session` — `database.py`
**Qué hace:** devuelve `Session(engine)` nueva. **Cada Unit of Work crea su propia sesión**: no hay sesión global. Se pasa *la función* (no la sesión) al UoW (`UnitOfWork(session_factory)`) para que cree la sesión recién en el `__enter__`.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 8: `session_factory`) y el UoW "abre la sesión en `__enter__`" (pág. 3). Razón técnica: una sesión por unidad de trabajo aísla transacciones entre requests concurrentes; una sesión global compartida mezclaría transacciones de usuarios distintos.
**Alternativa descartada:** (a) sesión global: cambios de un request visibles/commiteados por otro; (b) pasar la sesión ya creada al UoW: si el `with` nunca se ejecuta, queda una sesión abierta sin cerrar.
**Si te preguntan en el parcial:** "Le paso al Unit of Work la fábrica y no la sesión, así la sesión nace al entrar al `with` y se cierra al salir; cada request tiene su propia transacción."

---

## `app/core/security.py` - hash y JWT

### `pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")` — `security.py`
**Qué hace:** contexto de Passlib. `deprecated="auto"` marca como obsoletos los esquemas que no sean el primero (permitiría migrar hashes en el futuro).
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 6-7 y criterio 4: "Las contraseñas se guardan con hash bcrypt"; fijar `passlib[bcrypt]==1.7.4` y `bcrypt==4.0.1` porque "Passlib falla con bcrypt 5"). `CryptContext` es la API de Passlib que encapsula el algoritmo y nos permite cambiarlo sin tocar el resto.
**Alternativa descartada:** `hashlib.sha256`/`md5`: son rápidos, y rápido es **malo** para contraseñas porque habilita fuerza bruta masiva; además no traen sal automática. Usar la librería `bcrypt` directo también serviría, pero Passlib da verificación y migración de esquema ya resueltas.
**Si te preguntan en el parcial:** "Usé bcrypt a través de Passlib porque es un hash lento y con sal, hecho para contraseñas; SHA-256 es rápido y por eso es peor contra fuerza bruta. Fijé las versiones porque Passlib falla con bcrypt 5."

### `hash_password(password: str) -> str` — `security.py`
**Qué hace:** devuelve el hash bcrypt (con sal incluida). Llamada por `AuthService.registrar` y `seed()`. Cada llamada da un hash distinto para la misma clave (sal aleatoria), por eso **no se comparan hashes con `==`**.
**Por qué lo planteamos así:** **decisión nuestra** envolver `pwd_context.hash` en una función propia: el resto del código no sabe qué algoritmo se usa (`from app.core.security import hash_password`). Si cambia el algoritmo se toca un archivo.
**Alternativa descartada:** llamar a `pwd_context.hash` directo desde el Service: acopla el módulo de usuarios a Passlib.
**Si te preguntan en el parcial:** "Envolví el hash en una función para que el Service no dependa de Passlib. Nunca se guarda la contraseña en texto plano: se guarda solo el hash."

### `verify_password(plain_password: str, hashed_password: str) -> bool` — `security.py`
**Qué hace:** compara una clave en texto plano con el hash. Llamada por `AuthService.login`.
**Por qué lo planteamos así:** bcrypt es de una vía: no se "desencripta" el hash, se vuelve a calcular con la misma sal (que está dentro del hash) y se compara. **Decisión nuestra:** función propia por la misma razón que `hash_password`.
**Alternativa descartada:** `hash_password(plain) == hashed`: **nunca da igual** porque la sal es aleatoria en cada hash.
**Si te preguntan en el parcial:** "Para validar el login no comparo hashes con `==`, porque la sal cambia; uso `verify`, que extrae la sal del hash guardado y recalcula."

### `create_access_token(subject: str, expires_minutes: int | None = None) -> str` — `security.py`
```python
payload = {"sub": subject, "exp": expira}
jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
```
**Qué hace:** arma el payload `{"sub": subject, "exp": expira}` y lo firma. `sub` = username. `exp` = ahora (UTC) + minutos (por defecto `ACCESS_TOKEN_EXPIRE_MINUTES`). Llamada por `AuthService.login`.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 6, 10 y 16: JWT firmado con `python-jose`, expiración a los 30 minutos). Decisión nuestra: guardar solo `sub` (el username) y no el rol ni datos sensibles en el token; el payload **no está cifrado**, cualquiera puede leerlo. Como el rol se consulta en la base en cada request, un cambio de rol o una desactivación rige de inmediato. `exp` en UTC evita problemas de zona horaria.
**Alternativa descartada:** meter el `role` en el token: ahorra una consulta, pero un admin degradado seguiría con permisos hasta que venza el token. Y un token sin expiración, que sería permanente si se roba.
**Si te preguntan en el parcial:** "El token lleva solo el usuario y el vencimiento, firmados con la clave. El rol lo busco en la base en cada request para que un cambio de permisos o una baja valgan al instante."
**Gotcha:** `expires_minutes or settings...` -> si pasás `0` se ignora y usa el default (porque `0` es falsy). Hoy nadie pasa ese parámetro; existe para poder emitir tokens de vida distinta si hiciera falta.

### `decode_access_token(token: str) -> dict[str, Any] | None` — `security.py`
**Qué hace:** `jwt.decode(...)` verifica **firma y expiración**; si hay `JWTError` (firma mala, vencido, malformado) devuelve `None`. Es una función "segura": nunca lanza. Llamada por `get_current_user`.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 8: `decode_access_token`; pág. 10 paso 3: "valida firma y expiración"). Decisión nuestra: devolver `None` en vez de propagar `JWTError`, para que la dependencia de sesión maneje un solo caso ("no válido") y no se filtren excepciones de la librería hacia arriba. Se pasa `algorithms=[settings.ALGORITHM]` explícito: evita el ataque de "algoritmo none".
**Alternativa descartada:** dejar que `JWTError` suba y capturarlo en `deps.py`: el módulo `deps` quedaría acoplado a `python-jose`.
**Si te preguntan en el parcial:** "El decode devuelve `None` ante cualquier problema, entonces la dependencia solo decide 'hay payload o no hay'. Fijo la lista de algoritmos aceptados para que nadie pueda mandar un token sin firma."

---

## `app/core/unit_of_work.py` - Unit of Work base

### `class UnitOfWork` — `unit_of_work.py`
Atributo `session: Session` (se asigna en `__enter__`).
**Qué hace:** context manager que abre la sesión al entrar, y al salir hace commit o rollback y cierra.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 3, 7 y 8; criterio 3). Razón técnica: ver `00-arquitectura.md`, 3.1. Es una clase **base** y no una por módulo porque la lógica de commit/rollback/close es idéntica; solo cambian los repositorios que expone cada módulo.
**Alternativa descartada:** copiar el `__exit__` en cada módulo: cuatro copias de la parte más delicada (si una se olvida el `rollback`, hay inconsistencia).
**Si te preguntan en el parcial:** "Hice una clase base con la transacción y cada módulo solo agrega sus repositorios; así la lógica crítica de commit y rollback existe en un solo lugar."

#### `__init__(self, session_factory: Callable[[], Session]) -> None`
**Qué hace:** guarda la *fábrica*. No abre la sesión todavía.
**Por qué lo planteamos así:** **decisión nuestra** (inyección de dependencias): el UoW no importa `database.py`, recibe la fábrica de afuera. Eso lo desacopla del engine concreto y permitiría pasarle una sesión de prueba. Además la sesión se abre recién en `__enter__`, no al construir el objeto.
**Alternativa descartada:** que el UoW llame directamente a `Session(engine)`: queda atado a la base real.
**Si te preguntan en el parcial:** "El UoW recibe la fábrica de sesiones por constructor para no depender del engine; así es más fácil de reemplazar y la sesión solo existe dentro del `with`."

#### `_init_repositories(self) -> None`
**Qué hace:** gancho (hook) vacío. Cada UoW hijo lo sobreescribe para crear sus repositorios con `self.session`. Patrón *Template Method*.
**Por qué lo planteamos así:** **decisión nuestra.** La base necesita crear los repositorios *después* de tener la sesión pero no sabe cuáles son. Un método vacío que el hijo redefine resuelve eso sin que `__enter__` cambie. Todos los repositorios del UoW **comparten la misma sesión**, que es lo que hace que sea una sola transacción (lo pide la consigna: "expone los repositorios que la comparten", pág. 7).
**Alternativa descartada:** que cada hijo reescriba `__enter__`: se duplicaría la apertura de sesión. Otra: crear los repositorios en el `__init__` del hijo, pero ahí todavía no existe la sesión.
**Si te preguntan en el parcial:** "Es un método gancho: la base abre la sesión y llama a `_init_repositories`, que cada módulo redefine para crear sus repositorios sobre esa misma sesión. Compartir sesión es lo que hace que todo sea una única transacción."

#### `__enter__(self) -> Self`
**Qué hace:** crea la sesión, llama `_init_repositories()` y devuelve `self` (por eso `with self.uow as uow` da el UoW).
**Por qué lo planteamos así:** **lo exige la consigna** ("abre la sesión en `__enter__`", pág. 3). El retorno `Self` (de `typing`, disponible desde Python 3.11) hace que `uow` tenga el tipo del UoW concreto (`PedidoUnitOfWork`) y el editor autocomplete `uow.productos`.
**Alternativa descartada:** abrir la sesión en `__init__`: si el objeto se crea y nunca se entra al `with`, la sesión queda abierta sin cierre.
**Si te preguntan en el parcial:** "Abro la sesión en `__enter__` y devuelvo `self` para poder usar `with ... as uow` y acceder a los repositorios con el tipo correcto."

#### `__exit__(self, exc_type, exc_val, exc_tb) -> None`
**Qué hace:** sin excepción: `commit()`. Con excepción: `rollback()`. Siempre `close()` (en el `finally`).
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 3 y 7: "commit, rollback y close en `__exit__`"; criterio 3). Decisiones técnicas nuestras:
- **No devuelve `True`**: si devolviera `True` se "tragaría" la excepción y el Router nunca se enteraría. Al devolver `None`, la excepción original **se propaga** hasta el Router, que la traduce a HTTP.
- **`try/finally`**: asegura cerrar la sesión incluso si el `commit` falla (por ejemplo violación de unicidad), evitando fugas de conexiones.
**Alternativa descartada:** capturar y silenciar la excepción dentro del UoW (se perdería el código de error); o no cerrar la sesión (el pool de conexiones se agota).
**Si te preguntan en el parcial:** "En `__exit__` hago commit si todo salió bien y rollback si hubo excepción, y siempre cierro la sesión. No devuelvo `True` para que la excepción suba hasta el Router y se convierta en el código HTTP correcto."
**Gotcha:** el mismo objeto UoW se podría reutilizar con dos `with`, pero cada instancia se crea por request (en `get_xxx_service`), así que no hay estado compartido entre requests.

UoW concretos (hijos): `UsuarioUnitOfWork` (`usuarios`), `CategoriaUnitOfWork` (`categorias`), `ProductoUnitOfWork` (`productos` + `categorias`), `PedidoUnitOfWork` (`pedidos` + `productos`). `ProductoUnitOfWork` incluye `categorias` para validar que la categoría exista al crear un producto; `PedidoUnitOfWork` incluye `productos` para descontar stock en la misma transacción. El seed usa el `UnitOfWork` base directamente.

---

## `app/core/base_repository.py` - repositorio genérico

### `class BaseRepository(Generic[T])` con `T = TypeVar("T", bound=SQLModel)` — `base_repository.py`
Atributos de clase:
- `model: type[T]`: lo fija cada hijo.
- `campo_baja: str | None = "activo"` y `valor_baja: Any = False`: definen qué significa "dar de baja".

**Qué hace:** CRUD genérico reutilizable, nunca confirma la transacción.
**Por qué lo planteamos así:** **lo exige la consigna** (`BaseRepository[T]` con `get_by_id`, `get_all`, `add` y `delete`; pág. 3 y 8). `bound=SQLModel` restringe `T` a modelos SQLModel, para que el type checker proteja de pasar cualquier cosa. `campo_baja`/`valor_baja` son **decisión nuestra** para soportar bajas distintas con una sola implementación (ver 3.6 en `00-arquitectura.md`). `TypeVar` + `Generic` en vez de PEP 695 por compatibilidad con Python 3.11.
**Alternativa descartada:** un `BaseRepository` sin genéricos devolviendo `Any`: se pierde el autocompletado y los errores de tipo. O repositorios completamente separados sin base: código repetido.
**Si te preguntan en el parcial:** "La base es genérica sobre el modelo para escribir el CRUD una vez con tipado correcto, y es configurable en cómo se da de baja porque usuario usa `disabled` y categoría usa `activo`."

#### `__init__(self, session: Session)`
**Qué hace:** guarda la sesión compartida con el UoW.
**Por qué lo planteamos así:** **decisión nuestra.** El repositorio *recibe* la sesión en vez de crearla: así todos los repositorios del mismo UoW trabajan sobre la **misma** sesión, y el repositorio no decide cuándo se confirma (lo decide el UoW).
**Alternativa descartada:** que cada repositorio abra su propia sesión: cada uno commitearía por su cuenta y se pierde la atomicidad.
**Si te preguntan en el parcial:** "El repositorio no abre sesión: usa la que le da el Unit of Work, para que todo ocurra en la misma transacción."

#### `get_by_id(self, id: int) -> T | None`
**Qué hace:** `session.get(model, id)`. Busca por PK **sin** filtrar por activo (los hijos agregan `get_activo`, `get_activa`).
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 8). Devuelve `None` en vez de lanzar para que el **Service** decida qué significa "no existe" (excepción de dominio `...NoEncontrado`); el repositorio no tiene reglas de negocio. Usar `session.get` aprovecha la caché de identidad de la sesión (evita un SELECT repetido). No filtra por activo porque, por ejemplo, el admin necesita poder encontrar un usuario desactivado para reactivarlo.
**Alternativa descartada:** que lance `NoResultFound`: mezcla una decisión de negocio en el repositorio. Filtrar `activo` acá: rompería la reactivación de usuarios.
**Si te preguntan en el parcial:** "`get_by_id` devuelve `None` si no existe y el Service decide qué hacer; el repositorio solo consulta, las decisiones son del Service."

#### `get_all(self, skip: int = 0, limit: int = 100) -> Sequence[T]`
**Qué hace:** `select(model).offset(skip).limit(limit)`. Genérico; en el código actual los módulos usan consultas propias (no se invoca desde ningún service; verificado por búsqueda en `app/`).
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 8 lista `get_all` en `BaseRepository`). Tiene `skip`/`limit` porque devolver toda la tabla sin límite es peligroso al crecer los datos (mismo criterio de paginación que usa la API, pág. 10).
**Alternativa descartada:** `select(model)` sin límite: carga la tabla completa en memoria.
**Si te preguntan en el parcial:** "Está porque la consigna lo pide en el repositorio base; los listados reales usan consultas propias de cada módulo con filtros, y siempre paginadas."

#### `add(self, obj: T) -> T`
**Qué hace:** `session.add(obj)` + `session.flush()`. El `flush` envía INSERT/UPDATE a la BD *dentro de la transacción* (el `id` queda asignado) pero **no confirma**. Sirve tanto para insertar como para actualizar objetos ya cargados.
**Por qué lo planteamos así:** **lo exige la consigna** (`add`, pág. 8), y la regla de que el repositorio no hace commit. El `flush` es **decisión nuestra**: queremos el `id` y detectar violaciones de unicidad ya dentro del `with`, pero sin confirmar.
**Alternativa descartada:** `commit()` acá (viola la regla del UoW y rompe la atomicidad), o solo `session.add` sin `flush` (el `id` sería `None` hasta el commit y los errores de BD aparecerían recién en `__exit__`).
**Si te preguntan en el parcial:** "`add` hace `flush` y no `commit`: obtengo el id generado dentro de la transacción, pero la confirmación sigue siendo del Unit of Work."

#### `delete(self, obj: T) -> T`
**Qué hace:** **baja lógica.** Si `campo_baja is None` lanza `NotImplementedError` (caso Pedido). Si no, `setattr(obj, campo_baja, valor_baja)` y `add(obj)`. Llamada por `CategoriaService.eliminar`, `ProductoService.eliminar` y `UsuarioService.desactivar`.
**Por qué lo planteamos así:** **lo exige la consigna** (baja lógica; pág. 3-5 y 10; criterios 2 y 5). Que lance `NotImplementedError` en pedidos es **decisión nuestra**: garantiza *por diseño* que "los pedidos no se borran" (RN-05, pág. 6); si alguien intenta borrar, falla ruidosamente en lugar de hacerlo en silencio.
**Alternativa descartada:** `session.delete(obj)` (borrado físico): rompe las FK de `DetallePedido` y pierde historial; y por eso resta puntos en la rúbrica.
**Si te preguntan en el parcial:** "El `delete` del repositorio base no borra: marca el registro como dado de baja. Para pedidos lanza error a propósito, porque la regla es que los pedidos nunca se borran, se cancelan."

---

## `app/core/deps.py` - dependencias de sesión y rol

(El detalle completo con ejemplos está en `02-auth-y-usuarios.md`; acá el resumen de firma y rol.)

- `CUENTA_DESACTIVADA = "Cuenta de usuario desactivada"`: mensaje reutilizado (la consigna fija este texto exacto, pág. 11, y el interceptor del frontend lo reconoce).
- `get_current_user(access_token: Annotated[str | None, Cookie()] = None) -> UserPublic`: lee la cookie, decodifica el JWT y carga el usuario. 401 si falta/inválido/usuario inexistente.
- `get_current_active_user(usuario) -> UserPublic`: rechaza `disabled` con 400.
- `require_role(roles: list[str])`: fábrica (closure) de dependencias; 403 si el rol no está.
- `CurrentUser` y `AdminUser`: atajos `Annotated[...]` para los routers.

**Por qué lo planteamos así:** **lo exige la consigna** (pág. 8 y 10: tres dependencias con esos nombres, y la tabla de errores 401/400/403 de pág. 11). La descomposición en tres escalones (¿hay sesión? ¿está activo? ¿tiene el rol?) hace que cada una haga una sola cosa y que los códigos salgan en orden.
**Alternativa descartada:** un `if` de rol dentro de cada endpoint: repetido, y alguien podría olvidarlo (la rúbrica penaliza *"escrituras sin rol"*).
**Si te preguntan en el parcial:** "La seguridad está en dependencias reutilizables encadenadas: sesión, cuenta activa y rol. Un endpoint se protege con solo declarar el parámetro, y no depende de que me acuerde de escribir un `if`."

**Gotcha de arquitectura:** `deps.py` está en `core/` pero importa de `modules/usuarios`. Es la única violación "hacia arriba" y está justificada: la autenticación necesita cargar un `Usuario` (y la consigna ubica `deps.py` en `core/`).

---

## Resumen: quién usa a quién

| Pieza | La usan |
|---|---|
| `settings` | `database`, `security`, `main`, `auth/router` |
| `engine`/`session_factory` | los `get_xxx_service` de cada router, `deps`, `seed` |
| `UnitOfWork` base | los 4 UoW de módulo y `seed` |
| `BaseRepository` | los 4 repositorios |
| `hash_password`/`verify_password` | `AuthService`, `seed` |
| `create_access_token` | `AuthService.login` |
| `decode_access_token` | `get_current_user` |
