# 05 - Seed, configuración y archivos `.http`

> Mismo formato que los otros docs: **Qué hace / Por qué lo planteamos así / Alternativa descartada / Si te preguntan en el parcial**. En la consigna, esta parte pesa en el criterio 1 ("Backend: estructura y configuración", 10 puntos, pág. 21): *"`.env.example`; `requirements.txt` con versiones fijadas (incluye `bcrypt==4.0.1`); CORS con credenciales; seed idempotente"*; y resta por "seed incompleto, dependencias sin fijar".

## 1. Seed idempotente (`app/db/seed.py`)

Se ejecuta con `python -m app.db.seed` (desde `backend/`, para que encuentre `app` y el `.env`).

### Qué es "idempotente" y por qué lo exigimos
Una operación es idempotente si **ejecutarla N veces deja el mismo resultado que ejecutarla una vez**. El seed no duplica datos: antes de insertar cada cosa pregunta si ya existe.
**Por qué:** *lo exige la consigna* ("`python -m app.db.seed` es idempotente", pág. 16; criterio 1). Razón práctica: el seed se corre al instalar, pero también cuando alguien lo vuelve a correr "por las dudas" (el profesor al corregir, un compañero, nosotros tras reiniciar). Si no fuera idempotente, la segunda corrida fallaría contra los `unique` (usuario `admin`, categorías) o duplicaría productos. Un seed idempotente se puede ejecutar sin miedo y no pisa datos cargados a mano.
**Si te preguntan en el parcial:** "Idempotente significa que correrlo varias veces da lo mismo que correrlo una. Lo logré preguntando por username o por nombre antes de cada inserción, así no duplica ni rompe contra las restricciones únicas."

### `USUARIOS`, `CATEGORIAS`, `PRODUCTOS` — `seed.py`
**Qué hacen:** listas de datos iniciales. `USUARIOS`: `admin` (`Admin1234!`, rol admin) y `cliente` (`Cliente1234!`, rol user). `CATEGORIAS`: Pizzas, Hamburguesas, Empanadas, Bebidas (4). `PRODUCTOS`: tuplas `(categoría, nombre, descripción, precio, stock)`, 10 productos.
**Por qué lo planteamos así:** la consigna pide admin `admin / Admin1234!`, **al menos 3 categorías y 8 productos con stock** (pág. 16); hicimos 4 y 10 para pasarnos del mínimo. Agregamos el usuario `cliente` (*decisión nuestra*) para poder probar permisos de cliente en los `.http` sin tener que registrarse cada vez. Los datos están separados de la lógica (listas arriba, función abajo): para cambiar el catálogo inicial se edita una lista, no el código.
**Alternativa descartada:** cargar los datos con un `data.sql`: dependería del motor (SQLite vs PostgreSQL), no pasaría por `hash_password` y no sería idempotente sin lógica adicional.
**Si te preguntan en el parcial:** "Los datos son listas aparte de la lógica. Cumplí los mínimos de la consigna (admin, 3 categorías, 8 productos con stock) y sumé un cliente de prueba para poder probar permisos."

### `_img(texto: str) -> str` — `seed.py`
**Qué hace:** arma una URL de `placehold.co` con el texto, reemplazando espacios por `+`.
**Por qué lo planteamos así:** `imagen_url` es un **string con URL**, no un archivo: la consigna no pide subida de archivos. Una URL de placeholder permite que el catálogo tenga imágenes sin guardar binarios ni depender de un servicio con cuenta.
**Alternativa descartada:** guardar imágenes locales o en la base: complica el seed y el despliegue sin que nadie lo pida.
**Si te preguntan en el parcial:** "La imagen es solo una URL; uso un placeholder para tener catálogo visual sin manejar archivos."

### `seed() -> None` — `seed.py`
**Qué hace:**
1. `create_all_tables()` asegura que existan las tablas.
2. `with UnitOfWork(session_factory) as uow:` abre una sola transacción y arma a mano los repositorios con `uow.session`.
3. **Usuarios:** `if usuarios.get_by_username(...) is None:` crea con `hash_password` (nunca guarda la contraseña en claro).
4. **Categorías:** `get_by_nombre` o crea; guarda cada una en `por_nombre` para resolver el `categoria_id` de los productos.
5. **Productos:** `if productos.get_by_nombre(nombre) is None:` crea.
6. Imprime cuántos creó y las credenciales de prueba.
**Por qué lo planteamos así:**
- **`create_all_tables()` primero:** el seed funciona aunque nunca se haya arrancado la app; no depende del orden de ejecución.
- **Usa el `UnitOfWork` base de `app.core`** y no uno de módulo, porque el seed toca tres módulos a la vez (usuarios, categorías, productos). Reutilizamos la misma pieza que usan los Services, así que el seed también obedece la regla "nadie llama a `session.commit()`".
- **Una sola transacción:** todo se confirma **junto** al salir del `with` (un commit). Si algo falla, rollback y no queda un seed a medias (por ejemplo, categorías sin productos).
- **Idempotencia por búsqueda natural (`username` / `nombre`):** son las claves que el negocio considera únicas. Usuarios y categorías ya son únicos en la base; para productos usamos `get_by_nombre`.
- **`categorias.add(...)` hace `flush`**, así `por_nombre[cat].id` ya tiene valor para crear los productos en la misma transacción antes del commit.
- **`hash_password`** (bcrypt vía passlib): *lo exige la consigna* ("Las contraseñas se guardan con hash bcrypt", pág. 3).
- **Imprime las credenciales:** son datos de prueba conocidos (los pide la consigna y el README); no es un secreto real.
**Gotchas:** la idempotencia depende del nombre; si cambiás el nombre de un producto en el seed, creará uno nuevo. La contraseña del admin (`Admin1234!`) la pide la consigna.
**Alternativa descartada:** borrar todo y recrear (`drop_all` + insertar): "idempotente" en apariencia, pero destruye los datos cargados a mano. O `try/except IntegrityError` por inserción: funciona para unique pero ensucia la transacción en PostgreSQL (tras un error, la transacción queda abortada).
**Si te preguntan en el parcial:** "El seed abre un Unit of Work, y para cada usuario, categoría o producto pregunta si ya existe antes de insertar. Todo va en una transacción: o se carga completo o no se carga nada. La contraseña se hashea con bcrypt."

### `if __name__ == "__main__": seed()` — `seed.py`
**Qué hace:** permite ejecutarlo como `python -m app.db.seed`.
**Por qué lo planteamos así:** con `-m` Python resuelve el paquete `app` desde `backend/`, y a la vez importar el módulo (por ejemplo desde un test) no dispara el seed.
**Si te preguntan en el parcial:** "Con `__main__` el seed se ejecuta solo desde la línea de comandos, no al importarlo."

---

## 2. Variables de entorno (`.env`)

### `Settings` (`app/core/config.py`)
**Qué hace:** clase `BaseSettings` (pydantic-settings) que lee las variables del `.env`/entorno, las valida y las deja disponibles como `settings`. `SECRET_KEY` exige `min_length=32` y **no tiene valor por defecto**.
**Por qué lo planteamos así:** *lo exige la consigna* (tabla de variables, pág. 16). Los secretos y las URLs de base cambian según el entorno (desarrollo, producción) y **no deben vivir en el código ni versionarse**. Si falta `SECRET_KEY`, la app **no arranca** (falla rápido y claro) en vez de funcionar con una clave débil por defecto.

| Variable | Obligatoria | Ejemplo | Para qué |
|---|---|---|---|
| `DATABASE_URL` | No (default SQLite) | `postgresql://user:pass@localhost:5432/foodstore_db` o `sqlite:///./foodstore.db` | Conexión |
| `SECRET_KEY` | **Sí** (min 32 caracteres) | `cambiar-esta-clave-de-al-menos-32-caracteres` | Firma del JWT |
| `ALGORITHM` | No (`HS256`) | `HS256` | Algoritmo JWT |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No (`30`) | `30` | Vida del token y de la cookie |
| `FRONTEND_ORIGIN` | No (`http://localhost:5173`) | `http://localhost:5173` | Origen permitido en CORS |

- **`DATABASE_URL`** con default SQLite: la consigna acepta SQLite para desarrollo local (pág. 6) y así el proyecto corre sin instalar PostgreSQL. En `database.py` el `check_same_thread=False` solo se aplica a SQLite (FastAPI usa varios hilos).
- **`SECRET_KEY` de al menos 32 caracteres:** una clave corta es fácil de adivinar por fuerza bruta y permitiría falsificar tokens.
- **`FRONTEND_ORIGIN`:** se usa en el CORS de `main.py`. Como la sesión viaja en una **cookie**, el CORS debe ser `allow_credentials=True` y con **origen explícito**: el navegador rechaza `*` cuando hay credenciales (criterio 1: "CORS con credenciales").
**Alternativa descartada:** constantes en el código o un `config.py` con la clave escrita: terminan en el repositorio. O `os.getenv` suelto por todos lados: sin validación de tipos ni de longitud.
**Si te preguntan en el parcial:** "La configuración sale del `.env` y se valida con pydantic-settings; la `SECRET_KEY` no tiene valor por defecto para que la app no arranque con una clave insegura. El CORS permite credenciales y un origen explícito porque el JWT viaja en cookie."

**Por qué `.env` y no el código:** los secretos no se versionan; cada entorno tiene los suyos. El `.env` va en `.gitignore`; lo que se entrega es un `.env.example` con valores de ejemplo.

> **Atención:** `backend/.env.example` es obligatorio (criterio 1 de la consigna; en nuestra checklist, CE-03). Si no copiás `.env.example` a `.env`, la app no arranca en una máquina limpia porque `SECRET_KEY` no tiene valor por defecto.

---

## 3. `requirements.txt`

```
fastapi[standard]==0.115.12
sqlmodel==0.0.24
pydantic==2.11.4
pydantic-settings==2.9.1
psycopg2-binary==2.9.10
python-jose[cryptography]==3.5.0
passlib[bcrypt]==1.7.4
bcrypt==4.0.1
python-multipart==0.0.20
```

### Por qué versiones fijadas (`==`)
**Qué hace:** cada dependencia tiene una versión exacta.
**Por qué lo planteamos así:** *lo exige la consigna* ("Las versiones se fijan en requirements.txt", pág. 6; criterio 1 resta "dependencias sin fijar"). Build **reproducible**: un `pip install` hoy y en seis meses instala lo mismo; el profesor que corrige no se encuentra con una versión nueva que rompe algo.
**Alternativa descartada:** `>=` o sin versión: es lo que hace que "en mi máquina funciona" deje de funcionar sin tocar una línea de código.
**Si te preguntan en el parcial:** "Fijé todas las versiones con `==` para que la instalación sea reproducible y el proyecto corra igual en la máquina del corrector."

### Qué es cada paquete y por qué está
- **`fastapi[standard]`:** framework; el extra `standard` instala `uvicorn` (servidor ASGI) y `email-validator` (necesario para `EmailStr` en el registro). La consigna lo pide así (pág. 6).
- **`sqlmodel`:** ORM + schemas Pydantic en una sola librería (la consigna pide "0.0.22 o superior"; usamos 0.0.24).
- **`pydantic` / `pydantic-settings`:** validación de schemas y lectura tipada del `.env`.
- **`psycopg2-binary`:** driver de PostgreSQL (la base que pide la consigna). Se usa la variante `-binary` porque no requiere compilar contra las librerías de PostgreSQL en la máquina.
- **`python-jose[cryptography]`:** firma y valida el JWT (la consigna fija 3.5.0).
- **`python-multipart`:** **obligatorio** para leer el formulario OAuth2 del login (`OAuth2PasswordRequestForm`); sin él FastAPI falla al declarar el endpoint.
- **`passlib[bcrypt]==1.7.4` + `bcrypt==4.0.1`:** hash de contraseñas (ver abajo).

### ¿Por qué `bcrypt==4.0.1` fijado?
**Qué hace:** fija la versión del backend de hashing que usa Passlib.
**Por qué lo planteamos así:** *lo exige la consigna* ("fijar ambas: Passlib falla con bcrypt 5", pág. 7; criterio 1 pide explícitamente `bcrypt==4.0.1`). Passlib 1.7.4 está **sin mantenimiento** y lee un atributo interno de bcrypt (`__about__`) que las versiones nuevas quitaron (y bcrypt 5 además cambió cómo trata las contraseñas largas); el resultado es que `hash_password`/`verify_password` muestran errores o directamente revientan (esto último es lo que dice la consigna: "Passlib falla con bcrypt 5"). Como `passlib[bcrypt]` instala "la última bcrypt" si no la fijás, hay que fijar **las dos**: passlib 1.7.4 y bcrypt 4.0.1. Esto importa también para el **seed**, que hashea las contraseñas del admin y el cliente: sin el pin, el seed fallaría en una máquina limpia.
**Alternativa descartada:** usar `bcrypt` directo (sin Passlib) o `argon2`: técnicamente válido, pero la consigna pide Passlib + bcrypt. Dejar `bcrypt` sin fijar: funciona hasta que pip trae la 5.
**Si te preguntan en el parcial:** "Fijé bcrypt en 4.0.1 porque Passlib 1.7.4 ya no se mantiene y es incompatible con bcrypt 5; si no se fija, pip instala la última y el hash de contraseñas falla."

### Otras decisiones
- **Python 3.11 a 3.13** (SQLModel no funciona en 3.14, pág. 6). `BaseRepository` usa `TypeVar` + `Generic` en vez de la sintaxis `class X[T]` de 3.12 justamente para seguir siendo compatible con 3.11.
- `sqlmodel==0.0.24` cumple el "0.0.22 o superior".

### Ejecución (de la consigna, pág. 16)
```
pip install -r requirements.txt
copiar .env.example a .env
python -m app.db.seed
uvicorn app.main:app --reload
```
Luego `http://localhost:8000/docs` (Swagger) y `/redoc`.
**Por qué ese orden:** primero dependencias, después la configuración (sin `.env` no hay `SECRET_KEY`), después el seed (crea tablas y datos) y recién ahí se levanta el servidor. `--reload` reinicia al guardar cambios (solo para desarrollo).

---

## 4. Archivos `.http` (`backend/http/`)

Son colecciones de pruebas manuales para la extensión **REST Client** de VS Code: `auth.http`, `usuarios.http`, `categorias.http`, `productos.http`, `pedidos.http`.

### Para qué existen
**Qué hacen:** documentan y prueban cada endpoint con casos felices y de error (los códigos 401, 403, 404, 409, 422, 400...), en orden.
**Por qué lo planteamos así:** *decisión nuestra*. Nos sirven para: (1) **verificar contra la consigna** que cada endpoint devuelve el código indicado (criterios 4, 5 y 6 evalúan "códigos correctos"); (2) **demostrar en la defensa** reglas como el rollback o la restitución de stock sin escribir código; (3) dejar "tests ejecutables" versionados con el repo. Elegimos archivos `.http` y no Postman porque son texto plano, se versionan en git y se leen sin instalar nada más que una extensión.
**Alternativa descartada:** tests automáticos con pytest: serían más robustos, pero la consigna no los pide y demandan más tiempo; la cobertura manual ordenada alcanzó para validar todos los códigos.
**Si te preguntan en el parcial:** "Armé colecciones `.http` que recorren cada endpoint con casos de éxito y de error en orden. Me sirven para demostrar las reglas de negocio en vivo, como el rollback o la restitución de stock."

### Cómo usarlos
1. Levantá el servidor y corré el seed (`python -m app.db.seed`).
2. Abrí el `.http` en VS Code; aparece "Send Request" sobre cada bloque separado por `###`.
3. **Ejecutalos en orden**: dependen de la sesión (cookie) y de datos de pasos anteriores.

### Mecánicas que usan (y por qué)
- **`@baseUrl = http://localhost:8000/api/v1`:** variable de archivo, usada como `{{baseUrl}}`. Cambiar el host o prefijo es tocar una línea.
- **Cookie automática:** REST Client guarda el `Set-Cookie: access_token=...` del login y lo reenvía solo, igual que un navegador. Por eso "login como cliente" cambia la sesión para los pasos siguientes; el logout borra la cookie. Esto prueba que el JWT viaja en **cookie HttpOnly** y no en el cuerpo ni en un header manual.
- **`# @name prodA`:** nombra una request; luego `{{prodA.response.body.id}}` reutiliza el `id` de la respuesta. Así los scripts **no dependen de ids fijos** y se pueden volver a correr completos.
- **`{{$randomInt 1000 9999}}`:** números aleatorios para evitar 409 por usernames o nombres repetidos al volver a correr.
- **Login con `Content-Type: application/x-www-form-urlencoded`** y body `username=admin&password=Admin1234!`: es el formulario OAuth2 que pide la consigna (por eso existe `python-multipart`).

### Qué cubre cada archivo
- **`auth.http`:** registro (201, 409 por username y por email, 422 por password corta y email inválido), login (401 credenciales incorrectas), `/me` con y sin sesión, logout. Verifica que el token **no** viene en el cuerpo (solo en `Set-Cookie`).
- **`usuarios.http`:** acceso solo admin (403 cliente, 401 sin sesión), listar, desactivar y activar (idempotentes), login bloqueado de cuenta desactivada (400), el admin no puede desactivarse a sí mismo (400), 404 de usuario inexistente.
- **`categorias.http` (17 pasos):** lecturas públicas, permisos (401 / 403), ABM como admin, 409 de nombre duplicado, PUT parcial, baja lógica (204) y comprobaciones de que la baja es "inexistente" (404 en GET, PUT, DELETE) y **no libera el nombre** (409 al recrearla, #17).
- **`productos.http` (23 pasos):** paginación con `skip/limit`, búsqueda sin distinguir mayúsculas, filtros por categoría y disponibilidad, `limit > 100` (422, #5), permisos, creación (404 por categoría inexistente, 422 por precio o stock negativos), PUT parcial (#15), PATCH de stock, baja lógica y su efecto (#21 a #23).
- **`pedidos.http` (50 pasos, el más útil para la defensa):** ver abajo.

### Qué cubre `pedidos.http` (útil para la defensa)
Preparación (3 productos con stock conocido) -> RN-01 (crear, repetido, rollback, no disponible, inexistente 404, validaciones 422) -> RN-04 (propios, resumen 403 para cliente, pedido ajeno 403) -> RN-03 (cancelar restituye stock) -> RN-02 (transiciones válidas / inválidas / terminales) -> resumen -> RN-05 (`DELETE` -> 405).
**Por qué lo ordenamos por regla:** si el profesor pregunta "¿dónde probás RN-03?", señalamos el bloque (#30 y #31 para el dueño; #45 y #46 para el admin).

Pasos que demuestran el **rollback**: #10 (falla el 2° ítem) y #11 (el stock del 1° sigue intacto: "A = 8, no 7"). Pasos de **restitución**: #30-#31 (cancelar propio, stock vuelve a 10 y 3) y #45-#46 (admin cancela en preparación).
**Si te preguntan en el parcial:** "Para demostrar la atomicidad uso los pasos 10 y 11 de `pedidos.http`: un pedido con dos ítems donde el segundo no tiene stock; después compruebo que el stock del primero no cambió."
