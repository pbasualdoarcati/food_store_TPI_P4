# 02 - Autenticación y usuarios

Archivos: `app/core/security.py`, `app/core/deps.py`, `app/modules/auth/{router,service,schemas}.py`, `app/modules/usuarios/{models,schemas,repository,unit_of_work,service,router}.py`.

> Cada entrada sigue la plantilla **Qué hace / Por qué lo planteamos así / Alternativa descartada / Si te preguntan en el parcial**. Cuando dice "lo exige la consigna" es con página o criterio; cuando dice "decisión nuestra" va la razón técnica. Este es el criterio 4 de la rúbrica (10 puntos): *"Token en el cuerpo o en localStorage; escrituras sin rol; códigos incorrectos; sin gestión de usuarios"* son lo que resta.

## 1. Conceptos

### JWT (JSON Web Token)
Un token firmado con tres partes `header.payload.firma`. El payload acá es `{"sub": "<username>", "exp": <vencimiento>}`. **Está firmado, no cifrado**: cualquiera puede leerlo, pero nadie puede modificarlo sin la `SECRET_KEY`. El servidor no guarda sesiones (*stateless*): valida la firma y la expiración.

**Por qué JWT:** **lo exige la consigna** (pág. 6 y 10: `python-jose`, JWT en cookie). Razón técnica: no hace falta una tabla de sesiones ni consultar la base para saber si el token es auténtico; cualquier instancia del backend con la misma clave lo valida.
**Alternativa descartada:** sesiones en servidor (id opaco + tabla/redis): permiten invalidar al instante, pero requieren almacenamiento compartido. Acá priorizamos simplicidad *stateless* y compensamos la desactivación consultando al usuario en cada request (ver `get_current_active_user`).

### Hash con bcrypt
Las contraseñas **nunca** se guardan en texto plano: se guarda `hashed_password`. bcrypt es lento a propósito y usa *sal* aleatoria, así que dos usuarios con la misma clave tienen hashes distintos y la fuerza bruta es cara. Es de una vía: no se "desencripta", se **verifica** (`verify_password`).
- bcrypt solo considera los primeros **72 bytes** -> `UserCreate.password` tiene `max_length=72`.

**Por qué:** **lo exige la consigna** (pág. 4 y criterio 4: "hash bcrypt"). **Alternativa descartada:** SHA-256/MD5 (rápidos = malos para claves) o cifrado reversible (si se filtra la base, se filtran todas las claves).

### Cookie HttpOnly (por qué NO localStorage)
| | localStorage | Cookie HttpOnly |
|---|---|---|
| ¿JavaScript puede leerla? | Sí | **No** |
| Ante XSS (script inyectado) | El atacante roba el token con `localStorage.getItem` | No puede leerla |
| Envío al backend | Hay que armar el header a mano | Automático por el navegador |

Un ataque **XSS** inyecta JS en tu página; si el token está en localStorage, se lo lleva. Con `HttpOnly` el token es invisible para JS. La rúbrica lo penaliza: *"Token en el cuerpo o en localStorage"*. Por eso el login responde `{"message": "Login exitoso"}` y el token va **solo** en `Set-Cookie`.

Atributos usados (`auth/router.py`): `httponly=True`, `max_age=ACCESS_TOKEN_EXPIRE_MINUTES*60`, `samesite="lax"` (mitiga CSRF básico), `secure=False` (en producción con HTTPS debe ser `True`), `path="/"`.

> Contrapartida: las cookies abren la puerta a **CSRF**; `SameSite=Lax` lo mitiga parcialmente.

**Por qué:** **lo exige la consigna** (pág. 2, 10 y criterio 4). **Si te preguntan en el parcial:** "Puse el token en una cookie HttpOnly porque JavaScript no puede leerla; si hubiera un XSS, el atacante no podría robar la sesión como pasaría con localStorage. El costo es CSRF, que mitigo con SameSite=Lax."

## 2. Flujo de autenticación

```
POST /auth/token (form) -> AuthService.login -> JWT -> Set-Cookie: access_token (HttpOnly)
cada request -> el navegador manda la cookie
  get_current_user          -> lee cookie, valida firma+exp, carga Usuario     (401)
  get_current_active_user   -> rechaza disabled                                (400)
  require_role(["admin"])   -> verifica rol                                    (403)
```

**Por qué en tres escalones:** **lo exige la consigna** (pág. 10, pasos 3 y 4, y tabla de errores de pág. 11). Cada escalón agrega una sola verificación, y los códigos (401, 400, 403) salen en ese orden por la cadena de `Depends`.
**Si te preguntan en el parcial:** "Separé autenticación (¿quién sos?), cuenta activa (¿podés operar?) y autorización (¿tenés el rol?) para que cada una devuelva su propio código y para poder reutilizarlas por separado."

## 3. `app/core/security.py` (resumen)

`hash_password`, `verify_password`, `create_access_token`, `decode_access_token`: explicadas función por función, con su "por qué", en `01-core.md`.

## 4. `app/core/deps.py` - función por función

### `get_current_user(access_token: Annotated[str | None, Cookie()] = None) -> UserPublic` — `deps.py`
```python
if not access_token: raise no_autenticado
payload = decode_access_token(access_token)
username = payload.get("sub") if payload else None
if not username: raise no_autenticado
with UsuarioUnitOfWork(session_factory) as uow:
    usuario = uow.usuarios.get_by_username(username)
    if usuario is None: raise no_autenticado
    return UserPublic.model_validate(usuario)
```
**Qué hace:** lee la cookie, valida firma y expiración, busca el usuario por el `sub` y lo devuelve como `UserPublic`. Si algo falla: 401.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 8 y 10 paso 3; la tabla de pág. 11 dice que el 401 lo produce `get_current_user`). Decisiones nuestras:
- `Cookie()` le dice a FastAPI "sacá este parámetro de la cookie `access_token`" (el nombre del parámetro = nombre de la cookie). Con valor por defecto `None` podemos devolver nuestro propio 401 en vez del 422 automático de FastAPI cuando falta.
- Todos los fallos (sin cookie, token inválido/vencido, usuario borrado) devuelven **el mismo** 401 `"No autenticado o sesión expirada"`: no le das pistas al atacante sobre qué falló.
- **Vuelve a consultar la base** en cada request (en vez de confiar en el token): así una desactivación o cambio de rol rige de inmediato.
- Abre su propio UoW (no comparte sesión con el endpoint).
- **Devuelve `UserPublic`, no el modelo**: al cerrar la sesión el objeto de tabla quedaría desligado (mismo motivo que en todo el proyecto). Además así `hashed_password` nunca circula por la aplicación.
- **Gotcha:** no mira `disabled` (eso es de la siguiente dependencia). Y como el `return` está dentro del `with`, el UoW hace un commit vacío al salir; es inofensivo porque solo se leyó.
**Alternativa descartada:** (a) leer el token del header `Authorization: Bearer` → obliga al frontend a guardarlo en JS (localStorage), vulnerable a XSS y penalizado en la rúbrica; (b) confiar en el payload sin consultar la base: un usuario dado de baja seguiría operando hasta que venza el token.
**Si te preguntan en el parcial:** "Leo el token de la cookie, verifico firma y vencimiento y cargo al usuario de la base en cada request. Devuelvo siempre el mismo 401 genérico para no dar pistas, y devuelvo un schema y no el modelo porque la sesión se cierra."

### `get_current_active_user(usuario: Annotated[UserPublic, Depends(get_current_user)]) -> UserPublic` — `deps.py`
**Qué hace:** si `usuario.disabled` -> `HTTPException(400, "Cuenta de usuario desactivada")`. Encadena con `Depends`: FastAPI primero resuelve `get_current_user`.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 8, 10 y 11: "400 'Cuenta de usuario desactivada'... get_current_active_user y el login"). Razón técnica: separarlo de `get_current_user` permite tener "usuario autenticado" y "usuario autenticado y activo" por separado. Efecto práctico: un usuario desactivado con un token todavía vigente recibe 400 en cada endpoint con sesión (la baja es inmediata, no espera a que venza el JWT).
**Alternativa descartada:** chequear `disabled` solo en el login. Un usuario desactivado seguiría operando hasta 30 minutos con su cookie. Tampoco se decidió usar 403 para esto porque la consigna fija 400.
**Si te preguntan en el parcial:** "El chequeo de cuenta desactivada está en una dependencia, no solo en el login, así que la baja del admin tiene efecto en la siguiente request y no cuando expire el token."

### `require_role(roles: list[str]) -> Callable[[UserPublic], UserPublic]` — `deps.py`
**Patrón fábrica/closure:** `require_role` recibe parámetros (`roles`) y **devuelve** una función `verificar_rol` que "recuerda" `roles` (closure).
```python
def require_role(roles):
    def verificar_rol(usuario: Annotated[UserPublic, Depends(get_current_active_user)]):
        if usuario.role not in roles:
            raise HTTPException(403, "No tenés permisos para realizar esta acción")
        return usuario
    return verificar_rol
```
**Qué hace:** devuelve una dependencia que deja pasar solo a usuarios activos con uno de los roles indicados; si no, 403.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 8, 10 paso 4: `require_role(["admin"])`; 403 en pág. 11). El closure es **decisión nuestra**: `Depends` necesita un *callable* cuyos parámetros FastAPI pueda resolver; el parámetro `roles` es nuestro, no de FastAPI, así que lo capturamos con una función que devuelve otra. Así `require_role(["admin"])` o `require_role(["admin", "user"])` generan dependencias distintas reutilizando el código. Recibe una **lista** para poder autorizar a varios roles.
**Alternativa descartada:** una función por rol (`solo_admin`, `solo_user`...): duplicación y no escala si aparece un tercer rol. O comparar el rol a mano en cada endpoint.
**Si te preguntan en el parcial:** "`require_role` es una fábrica: me devuelve una dependencia configurada con los roles permitidos. Lo hice así para no repetir una función por cada rol y para que proteger un endpoint sea una línea."

### Atajos `CurrentUser` y `AdminUser` — `deps.py`
```python
CurrentUser = Annotated[UserPublic, Depends(get_current_active_user)]
AdminUser   = Annotated[UserPublic, Depends(require_role(["admin"]))]
```
**Qué hace:** alias de tipo con la dependencia incluida. En un router: `def crear_categoria(data, _: AdminUser, service)` -> el `_` indica "me importa que sea admin, no uso el valor". Cuando sí se usa: `desactivar_usuario(id, admin: AdminUser, ...)`.
**Por qué lo planteamos así:** **decisión nuestra.** Evita repetir `Depends(...)` largo en cada endpoint y hace que la firma se lea como una frase ("el usuario es admin"). Son dos porque son los dos casos reales: cualquier usuario activo, o solo admin. Nota: `CurrentUser` usa `get_current_active_user` (no `get_current_user`) para que *ningún* endpoint con sesión deje pasar cuentas desactivadas.
**Alternativa descartada:** `Depends(get_current_user)` directo en cada endpoint: fácil que algún endpoint se olvide del chequeo de `disabled`.
**Si te preguntan en el parcial:** "Hice dos alias, `CurrentUser` y `AdminUser`, para que proteger un endpoint sea declarar un parámetro. Así es difícil olvidarse del control y queda explícito en la firma."

**Códigos:** 401 (sin sesión) -> 400 (cuenta desactivada) -> 403 (rol). El orden sale de la cadena de dependencias.

### `CUENTA_DESACTIVADA` — `deps.py`
**Qué hace:** constante con el mensaje `"Cuenta de usuario desactivada"`.
**Por qué lo planteamos así:** **lo exige la consigna** el texto exacto (pág. 11 y pág. 20: el interceptor del frontend reconoce ese `detail` para limpiar la sesión). Constante para no repetir el string. (El service de auth define el mismo texto en `CuentaDesactivada`.)
**Alternativa descartada:** literales sueltos: si cambia uno y no el otro, el frontend deja de reconocer el error.
**Si te preguntan en el parcial:** "El mensaje es exacto porque el frontend lo usa para cerrar la sesión local."

## 5. Módulo `auth`

**Por qué `auth` solo tiene router, service y schemas:** **lo exige la consigna** (pág. 2 y 9: "auth solo router, service y schemas, porque usa el modelo Usuario"). Razón técnica: el dueño del modelo `Usuario` es el módulo `usuarios`; duplicar modelo/repositorio en `auth` generaría dos fuentes de verdad de la misma tabla.
**Alternativa descartada:** un módulo `auth` con su propio modelo y repositorio de usuario: dos clases mapeando la misma tabla.

### `auth/schemas.py`
#### Reexporte de `UserCreate` y `UserPublic`, y `__all__`
**Qué hace:** `from app.modules.usuarios.schemas import UserCreate, UserPublic` y los lista en `__all__`.
**Por qué lo planteamos así:** **decisión nuestra.** Los schemas viven en `usuarios/schemas.py` (dueño del modelo); `auth` los reexporta para que sus archivos importen `from .schemas import ...` y vean un contrato completo del módulo. `__all__` declara explícitamente la interfaz pública (y silencia el aviso de "import no usado").
**Alternativa descartada:** copiar los schemas a `auth`: se desincronizan.
**Si te preguntan en el parcial:** "No dupliqué los schemas: viven en `usuarios` y `auth` los reexporta, porque el dueño de esos datos es el módulo usuarios."

#### `MensajeRespuesta(SQLModel)` con `message: str`
**Qué hace:** respuesta de login/logout: `{"message": "..."}`.
**Por qué lo planteamos así:** **lo exige la consigna** en el login (pág. 11: `{ "message": "Login exitoso" }`), y que el cuerpo **no incluya el token** (pág. 10). Usarlo como `response_model` garantiza que ni por error se filtre el token al body. Reutilizado en logout por consistencia (**decisión nuestra**).
**Alternativa descartada:** devolver `{"access_token": ..., "token_type": "bearer"}` (estilo tutorial de OAuth2): pone el token en el cuerpo, justo lo que la rúbrica penaliza.
**Si te preguntan en el parcial:** "El login responde un mensaje simple porque el token va solo en la cookie; el `response_model` asegura que no pueda salir en el cuerpo."

### `auth/service.py`

#### Excepciones de dominio: `UsuarioDuplicado(campo)`, `CredencialesInvalidas`, `CuentaDesactivada` — `auth/service.py`
**Qué hace:** excepciones propias del negocio de autenticación, con mensaje incluido (`"Ya existe un usuario con ese {campo}"`, `"Usuario o contraseña incorrectos"`, `"Cuenta de usuario desactivada"`).
**Por qué lo planteamos así:** **lo exige la consigna** que existan excepciones de dominio en `service.py` y que el Router las capture (pág. 11: `UsuarioDuplicado` -> 409). La consigna *admite* lanzar `HTTPException` desde el Service en auth/usuarios, pero **decidimos** no hacerlo: así el Service no importa FastAPI y se comporta igual que categorias/productos/pedidos.
**Alternativa descartada:** `raise HTTPException(409...)` en el Service: más corto, pero acopla la regla al framework web y rompe la separación de capas.
**Si te preguntan en el parcial:** "Aunque la consigna me dejaba tirar `HTTPException` en auth, usé excepciones de dominio para que el Service no conozca HTTP y quede consistente con el resto de los módulos."

#### `AuthService.__init__(self, uow: UsuarioUnitOfWork)`
**Qué hace:** recibe el UoW por constructor.
**Por qué lo planteamos así:** **decisión nuestra**: inyección de dependencias. El Service no sabe cómo se crea el UoW ni de dónde sale la sesión; se lo entrega `get_auth_service`. Facilita reemplazarlo en pruebas.
**Alternativa descartada:** crear `UsuarioUnitOfWork(session_factory)` dentro del Service: lo ata a la base real.
**Si te preguntan en el parcial:** "El Service recibe el Unit of Work por constructor para no depender de cómo se arma; eso lo resuelve el Router con `Depends`."

#### `AuthService.registrar(self, data: UserCreate) -> UserPublic`
**Qué hace:**
1. Abre `with self.uow`.
2. `get_by_username` -> si existe, `UsuarioDuplicado("username")`.
3. `get_by_email` -> si existe, `UsuarioDuplicado("email")`.
4. Crea `Usuario(..., hashed_password=hash_password(data.password), role="user")`.
5. `uow.usuarios.add` y devuelve `UserPublic.model_validate(usuario)` (sin hash).

**Por qué lo planteamos así:** **lo exige la consigna** (pág. 4 y 11: "El registro público crea usuarios con rol user", 409 si username o email ya existen; criterio 4). Decisiones nuestras:
- **Chequeamos duplicados antes de insertar** para devolver un 409 limpio y específico (qué campo falló). Si solo confiáramos en el `unique` de la base, el error sería una excepción de integridad que explota recién en el commit (`__exit__`), fuera del control del Service.
- **Seguridad:** el rol está **fijado en `"user"`** en el servicio; `UserCreate` ni siquiera tiene campo `role`, así que nadie puede auto-registrarse como admin (escalada de privilegios / *mass assignment*). Los admins se crean con el seed.
- Se hashea **antes** de construir el `Usuario`: la contraseña en claro no llega al modelo.
- Se devuelve `UserPublic` construido **dentro del `with`**, sin `hashed_password`.
**Alternativa descartada:** (a) aceptar `role` en el body: cualquiera se haría admin; (b) solo constraint de BD sin chequeo previo: error 500 en vez de 409; (c) devolver el modelo `Usuario`: expondría el hash. Nota honesta: hay una ventana de carrera entre el chequeo y el insert (dos registros simultáneos con el mismo username); en ese caso lo frena el `unique` de la base, y por eso `add` (que hace `flush`) está envuelto en `try/except IntegrityError`, que traduce el error a `UsuarioDuplicado` → 409. Así el chequeo previo da un mensaje preciso en el caso normal, y la constraint de la base es la garantía real ante concurrencia.
**Si te preguntan en el parcial:** "Verifico duplicados antes de insertar para responder 409 con el campo que falló, y fijo el rol en `user` en el servidor para que nadie pueda registrarse como admin; además guardo solo el hash y devuelvo el schema sin esa columna."

#### `AuthService.login(self, username: str, password: str) -> str`
**Qué hace:**
1. Busca por username. Si no existe **o** la clave no verifica -> `CredencialesInvalidas` (401).
2. Si `usuario.disabled` -> `CuentaDesactivada` (400).
3. Devuelve `create_access_token(usuario.username)`.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 11: 401 credenciales incorrectas, 400 cuenta desactivada). Decisiones nuestras:
- Mismo error para "usuario inexistente" y "clave incorrecta": no revela si el usuario existe (evita *user enumeration*).
- **Gotcha de orden:** primero se valida la clave, después `disabled`. Un desactivado con clave errónea recibe 401, no 400: solo quien conoce la clave se entera de que su cuenta está desactivada.
- El Service **devuelve el token** (un `str`); poner la cookie es trabajo del Router porque es un detalle HTTP (el Service no conoce `Response`).
**Alternativa descartada:** mensajes distintos ("usuario no existe" / "clave incorrecta"): ayuda a un atacante a descubrir usuarios válidos. Tampoco poner la cookie en el Service: lo acoplaría a FastAPI.
**Si te preguntan en el parcial:** "Respondo el mismo error si falla el usuario o la clave, para no revelar qué usuarios existen. El Service solo devuelve el token y el Router lo guarda en la cookie, porque la cookie es un tema de HTTP."

### `auth/router.py` (prefijo `/auth`)

#### `COOKIE_NAME = "access_token"` — `auth/router.py`
**Qué hace:** nombre de la cookie, usado en `set_cookie` y `delete_cookie`.
**Por qué lo planteamos así:** **lo exige la consigna** el nombre exacto (pág. 3: "cookie HttpOnly `access_token`"); también debe coincidir con el nombre del parámetro en `get_current_user` (`access_token`). Constante para que login y logout no se desincronicen.
**Alternativa descartada:** strings sueltos: si logout escribe otro nombre, la cookie no se borra.
**Si te preguntan en el parcial:** "Es constante para que login y logout apunten siempre a la misma cookie."

#### `get_auth_service() -> AuthService` y `ServiceDep` — `auth/router.py`
**Qué hace:** fábrica `AuthService(UsuarioUnitOfWork(session_factory))`, y alias `Annotated[AuthService, Depends(get_auth_service)]`.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 3 y 7: el Router obtiene el Service con `Depends(get_<modulo>_service)` y nunca abre el UoW). Nuestro además el alias `ServiceDep`, para abreviar.
**Alternativa descartada:** instanciar el Service dentro de cada endpoint, o abrir el UoW en el Router (criterio 3 lo penaliza).
**Si te preguntan en el parcial:** "El Router no abre ningún Unit of Work: pide el Service con `Depends` y delega."

| Método y ruta | Función | Éxito | Errores propios |
|---|---|---|---|
| `POST /auth/register` | `registrar(data: UserCreate, service)` | **201** `UserPublic` | **409** `UsuarioDuplicado` |
| `POST /auth/token` | `login(form, response, service)` | **200** `{"message": "Login exitoso"}` + cookie | **401** `CredencialesInvalidas`, **400** `CuentaDesactivada` |
| `POST /auth/logout` | `logout(response)` | **200** `{"message": "Logout exitoso"}` | - |
| `GET /auth/me` | `me(usuario: CurrentUser)` | **200** `UserPublic` | 401 / 400 (comunes) |

#### `registrar(data: UserCreate, service: ServiceDep)` — `POST /auth/register`, `auth/router.py`
**Qué hace:** llama a `service.registrar(data)`; si hay `UsuarioDuplicado`, responde 409 con el mensaje. Responde **201** con `UserPublic`.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 11: público, 201 `UserPublic`, 409). 201 y no 200 porque se *creó* un recurso. Es público porque el cliente todavía no tiene sesión. La validación del body (email válido, password de 8 a 72) la hace FastAPI con `UserCreate`; si falla, 422 (pág. 11).
**Alternativa descartada:** devolver 200 (semánticamente impreciso) o 400 para el duplicado (el 409 *Conflict* describe exactamente "ya existe").
**Si te preguntan en el parcial:** "Devuelvo 201 porque se crea un recurso y 409 si el usuario o email ya existen, porque es un conflicto con el estado actual, no un dato mal formado."

#### `login(form: Annotated[OAuth2PasswordRequestForm, Depends()], response: Response, service: ServiceDep)` — `POST /auth/token`, `auth/router.py`
**Qué hace:** pide el token al Service y, si salió bien, lo guarda en una cookie con `response.set_cookie(key=COOKIE_NAME, value=token, httponly=True, max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60, samesite="lax", secure=False, path="/")`. Responde `{"message": "Login exitoso"}`. Traduce `CredencialesInvalidas` -> 401 y `CuentaDesactivada` -> 400.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 3, 10 y 11: "login por formulario OAuth2 que entrega el JWT en la cookie HttpOnly access_token"; cuerpo sin token). Decisiones técnicas:
- `OAuth2PasswordRequestForm` recibe `application/x-www-form-urlencoded` con `username` y `password`. Requiere `python-multipart` (por eso está en `requirements.txt`). Beneficio: funciona el botón "Authorize" de Swagger y los `.http` mandan `username=admin&password=...`.
- `httponly=True`: JS no puede leerla (defensa ante XSS).
- `max_age` = vida del token en segundos: cookie y token vencen juntos (30 min por defecto).
- `samesite="lax"`: el navegador no la adjunta en peticiones cross-site "peligrosas" (mitiga CSRF).
- `secure=False`: **solo para desarrollo** en `http://localhost`. Con `secure=True` el navegador solo envía la cookie por HTTPS, así que en local sin HTTPS la cookie no viajaría. En producción con HTTPS debe ser `True`.
- `path="/"`: la cookie se envía a todas las rutas de la API.
- `response_model=MensajeRespuesta` asegura que el token no esté en el body.
**Alternativa descartada:** devolver el token en el JSON para que el frontend lo guarde en `localStorage`: vulnerable a XSS y penalizado por la rúbrica ("Token en el cuerpo o en localStorage").
**Si te preguntan en el parcial:** "El token viaja solo en una cookie HttpOnly con SameSite=Lax y la misma duración que el JWT. `secure` lo dejé en falso porque desarrollo en HTTP; en producción con HTTPS iría en verdadero."

#### `logout(response: Response)` — `POST /auth/logout`, `auth/router.py`
**Qué hace:** `response.delete_cookie(key=COOKIE_NAME, path="/", httponly=True, samesite="lax")` y responde `{"message": "Logout exitoso"}`.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 10 paso 5 y pág. 12: público, 200, "la respuesta borra la cookie"). Como el frontend **no puede tocar** una cookie HttpOnly, solo el servidor puede borrarla: por eso existe el endpoint. Es público porque borrar una cookie inexistente es inofensivo y evita un 401 al cerrar sesión con token vencido. Debe coincidir `path` con el de `set_cookie` para que el navegador la elimine.
**Alternativa descartada:** que el frontend "borre el token" (imposible con HttpOnly). **Limitación conocida:** no invalida el JWT en el servidor (es stateless); simplemente el navegador lo descarta. Un token robado seguiría válido hasta que venza (30 min). Se resolvería con una lista de tokens revocados, fuera de alcance.
**Si te preguntan en el parcial:** "El logout lo hace el servidor porque el JavaScript no puede borrar una cookie HttpOnly. Es stateless, así que no revoca el token ya emitido; la mitigación es el vencimiento corto."

#### `me(usuario: CurrentUser)` — `GET /auth/me`, `auth/router.py`
**Qué hace:** devuelve el `UserPublic` que ya resolvió la dependencia.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 12: acceso Sesión, 200 `UserPublic`). Sirve para que el frontend pregunte "¿quién soy?" al cargar la app (`checkSession`, pág. 19-20): como el frontend no puede leer la cookie, la única forma de saber si la sesión sigue viva es preguntarle al backend. No tiene lógica propia porque la dependencia ya hizo todo.
**Alternativa descartada:** decodificar el JWT en el frontend: imposible, la cookie es HttpOnly (y confiar en un token local es inseguro).
**Si te preguntan en el parcial:** "`/me` existe porque el frontend no puede ver la cookie; le pregunta al backend quién es el usuario actual y el backend responde con lo que ya validó la dependencia."

> `422` lo produce FastAPI si el body no cumple `UserCreate` (email inválido, password < 8, etc.).

## 6. Módulo `usuarios`

### `usuarios/models.py`

#### `ahora() -> datetime` — `usuarios/models.py`
**Qué hace:** `datetime.now(timezone.utc)`; `default_factory` de `created_at`.
**Por qué lo planteamos así:** **decisión nuestra.** Guardar en UTC evita ambigüedades de zona horaria; `default_factory` (en vez de `default=datetime.now()`) calcula la hora *en cada creación*, no una sola vez al importar el módulo.
**Alternativa descartada:** `default=datetime.now()`: se evalúa una vez al arrancar y todos los usuarios tendrían la misma fecha. `datetime.utcnow()` está deprecado y produce fechas "naive".
**Si te preguntan en el parcial:** "Uso `default_factory` para que la fecha se calcule al crear cada fila, y en UTC para no depender de la zona del servidor."

#### `class Usuario(SQLModel, table=True)` — `usuarios/models.py`
**Qué hace:** `id` (PK), `username` (único, indexado, 50), `full_name`, `email` (único, indexado, 255), `hashed_password`, `role` (default `"user"`), `disabled` (default `False`, baja lógica), `created_at` (`DateTime(timezone=True)`). Relación `pedidos` <-> `Pedido.usuario`.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 4 y UML: campos, `username` y `email` únicos, `disabled` default false, baja lógica; relación `Usuario.pedidos`/`Pedido.usuario`, pág. 10). Decisiones nuestras: `index=True` junto a `unique` porque se busca por `username` en *cada request* autenticado y por `email` al registrar; `hashed_password` (no `password`) para que el nombre deje claro que nunca es la clave en claro; `role` es `str` de hasta 10 caracteres y se restringe a `"user" | "admin"` en los **schemas** (`Rol`), porque la consigna dice explícitamente que las restricciones se validan en schemas y Service, sin CHECK en la base (pág. 4). Las referencias a `Pedido` usan `TYPE_CHECKING` y un string para evitar el import circular.
**Alternativa descartada:** (a) tabla `Rol` aparte con FK: sobrediseño para dos roles fijos; (b) `role` como Enum de base: la consigna no exige CHECK; (c) borrar usuarios: perderían sus pedidos (baja lógica con `disabled`).
**Si te preguntan en el parcial:** "El usuario no se borra, se marca `disabled`, porque sus pedidos lo referencian. El rol es un string validado en el schema, como indica la consigna, y puse índice en username porque lo consulto en cada request."

### `usuarios/schemas.py`

#### `Rol = Literal["user", "admin"]`
**Qué hace:** tipo que solo admite esos dos valores.
**Por qué lo planteamos así:** **lo exige la consigna** (roles `user` y `admin`; restricciones en schemas, pág. 4). `Literal` hace que FastAPI/Pydantic rechace cualquier otro valor y que el `/docs` muestre las opciones.
**Alternativa descartada:** `str` libre (acepta cualquier cosa) o un `Enum` (válido, pero más ceremonia para dos valores).
**Si te preguntan en el parcial:** "Con `Literal` el schema garantiza que el rol sea uno de los dos permitidos."

#### `_como_utc(valor)` y `FechaUTC = Annotated[datetime, AfterValidator(_como_utc)]`
**Qué hace:** si la fecha no trae zona horaria, la marca como UTC; si ya la trae, la deja igual.
**Por qué lo planteamos así:** **decisión nuestra.** SQLite no guarda zona horaria: devuelve fechas "naive" aunque las hayamos guardado en UTC. Sin esto, el JSON saldría sin `Z` y el frontend (JavaScript) interpretaría la hora como *local*, mostrando horarios corridos. Con PostgreSQL ya viene con zona y no se toca.
**Alternativa descartada:** convertir en el frontend (cada pantalla repetiría el parche), o ignorarlo (horas incorrectas en SQLite).
**Si te preguntan en el parcial:** "SQLite pierde la zona horaria, así que en el schema marco las fechas como UTC; así el cliente las interpreta correctamente."

#### `UserCreate(SQLModel)`
**Qué hace:** entrada del registro: `username` 3..50, `full_name` 2..100, `email: EmailStr` (requiere `email-validator`, viene con `fastapi[standard]`), `password` 8..72.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 14: "password mínimo 8 caracteres"). Decisiones nuestras: `max_length=72` porque bcrypt solo considera los primeros 72 bytes (una clave más larga se truncaría en silencio); `EmailStr` para validar formato en el borde; **no tiene campo `role`**, para impedir auto-asignarse admin. Tampoco incluye `id` ni `disabled`.
**Alternativa descartada:** usar el modelo de tabla `Usuario` como entrada: permitiría mandar `role="admin"` o `disabled`. O sin tope de largo: contraseñas truncadas sin avisar.
**Si te preguntan en el parcial:** "El schema de entrada no tiene `role` ni `id`: así el cliente solo puede mandar lo que corresponde. El tope de 72 es porque bcrypt trunca a 72 bytes."

#### `UserPublic(SQLModel)`
**Qué hace:** `id, username, full_name, email, role, disabled, created_at`. **Nunca** incluye `hashed_password`.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 14: "nunca `hashed_password`", y "nunca se expone un modelo de tabla"). Permite `UserPublic.model_validate(usuario)` dentro del UoW (la consigna pide que los schemas de lectura se puedan construir así, pág. 14). Incluye `disabled` y `role` porque el frontend los necesita para ocultar botones (aunque la seguridad real es del backend).
**Alternativa descartada:** devolver `Usuario` y confiar en `response_model` para filtrar: un error de configuración filtraría el hash. Con un schema separado el hash no existe en la salida.
**Si te preguntan en el parcial:** "El `UserPublic` es lo único que sale del backend sobre un usuario; como no tiene el hash, no hay forma de filtrarlo por accidente."

### `usuarios/repository.py` - `UsuarioRepository(BaseRepository[Usuario])`

#### `campo_baja = "disabled"`, `valor_baja = True`
**Qué hace:** hace que `delete()` ponga `disabled = True`.
**Por qué lo planteamos así:** **lo exige la consigna** (baja lógica con `disabled`, pág. 4). Es lo que justifica que `BaseRepository` tenga `campo_baja`/`valor_baja` configurables: el usuario usa `disabled=True` mientras categoría/producto usan `activo=False` (sentido opuesto).
**Alternativa descartada:** sobreescribir `delete` completo. Una línea de configuración es menos código y menos riesgo.
**Si te preguntan en el parcial:** "Configuré el repositorio para que 'dar de baja' un usuario sea poner `disabled` en verdadero, reutilizando el `delete` genérico."

#### `get_by_username(username) -> Usuario | None`
**Qué hace:** `select(Usuario).where(Usuario.username == username)` y `.first()`.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 8: "get_by_username, get_by_email"). Lo usan el login, el registro (chequeo de duplicado) y `get_current_user`. Devuelve `None` si no existe para que el Service decida. Como el campo es `unique`, `.first()` basta.
**Alternativa descartada:** `get_by_id` con el username: no es la clave; filtrar en Python tras traer todos: ineficiente.
**Si te preguntan en el parcial:** "Es la consulta que más se usa: en el login, en el registro y en cada request autenticado, por eso el campo es único y tiene índice."

#### `get_by_email(email) -> Usuario | None`
**Qué hace:** igual, por email.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 8). Se usa para detectar email duplicado en el registro (409).
**Alternativa descartada:** depender solo del `unique` de la base: el error llegaría como excepción de integridad en el commit.
**Si te preguntan en el parcial:** "La uso para avisar antes de insertar que el email ya está registrado."

#### `list_ordenados() -> Sequence[Usuario]`
**Qué hace:** `select(Usuario).order_by(col(Usuario.id))`.
**Por qué lo planteamos así:** **decisión nuestra.** Sin `order_by`, el orden de una consulta SQL no está garantizado; la tabla del panel admin se reordenaría sola entre llamadas. Ordenar por `id` es estable. `col(...)` es el helper de SQLModel que le dice al type checker que es una columna. Devuelve **todos** (activos y desactivados) porque el admin necesita ver ambos para activar/desactivar; no pagina porque la consigna no pide paginar este listado (pág. 12).
**Alternativa descartada:** `get_all` genérico (limit 100 sin orden); paginar (la consigna no lo exige y el panel pide los datos completos).
**Si te preguntan en el parcial:** "Ordeno por id porque sin `ORDER BY` el orden no está garantizado y la tabla del admin cambiaría de lugar. Traigo también los desactivados porque el admin tiene que poder reactivarlos."

### `usuarios/unit_of_work.py` - `UsuarioUnitOfWork`
**Qué hace:** sobreescribe `_init_repositories` y expone `self.usuarios = UsuarioRepository(self.session)`. Lo usan `AuthService`, `UsuarioService`, `get_current_user`.
**Por qué lo planteamos así:** **lo exige la consigna** (cada módulo con `unit_of_work.py`, pág. 2 y 8). Un UoW por módulo expone solo los repositorios que ese caso de uso necesita; `usuarios` solo necesita uno. `auth` lo reutiliza en vez de tener el suyo.
**Alternativa descartada:** un UoW global con todos los repositorios: cada caso de uso quedaría acoplado a tablas que no usa.
**Si te preguntan en el parcial:** "Cada módulo tiene su Unit of Work con los repositorios que necesita; el de usuarios solo tiene uno y lo comparten auth, usuarios y las dependencias de sesión."

### `usuarios/service.py`

#### Excepciones: `UsuarioNoEncontrado(id)`, `AutoDesactivacion`
**Qué hace:** excepciones de dominio con mensaje (`"Usuario {id} no encontrado"`, `"Un administrador no puede desactivarse a sí mismo"`).
**Por qué lo planteamos así:** **lo exige la consigna** (404 por `UsuarioNoEncontrado`, pág. 11; y la restricción del admin, pág. 5 y 12). Misma razón que en auth: el Service no conoce HTTP.
**Alternativa descartada:** `HTTPException` en el Service.
**Si te preguntan en el parcial:** "Cada regla de negocio tiene su excepción con nombre propio; el Router decide el código."

#### `UsuarioService.__init__(uow)`
**Qué hace / por qué:** recibe el UoW por constructor, igual que `AuthService` (inyección de dependencias; ver arriba).

#### `listar() -> list[UserPublic]`
**Qué hace:** abre el `with`, y devuelve todos los usuarios ordenados convertidos a `UserPublic`.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 12: `GET /admin/usuarios`, admin, `list[UserPublic]`). La conversión se hace *dentro* del `with` por el motivo de siempre (objetos desligados al cerrar la sesión).
**Alternativa descartada:** devolver los modelos y convertirlos en el Router: el Router tocaría objetos de una sesión ya cerrada.
**Si te preguntan en el parcial:** "Convierto cada usuario a schema dentro del bloque, porque al salir la sesión se cierra."

#### `activar(id) -> UserPublic`
**Qué hace:** busca (`_buscar`), pone `disabled = False`, `add` y devuelve `UserPublic`.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 12 y 10: alta lógica, **idempotente**: "responden 200 aunque el estado no cambie"). Es idempotente por construcción: asignar `False` sobre `False` no cambia nada y no hay `if`.
**Alternativa descartada:** lanzar error 400/409 "ya estaba activo": contradice la consigna y complica al cliente (el botón del frontend podría fallar por un doble clic).
**Si te preguntan en el parcial:** "Activar es idempotente: aplico el valor y listo, sin chequear el estado anterior, porque la consigna pide 200 aunque no cambie nada."

#### `desactivar(id, id_actual) -> UserPublic`
**Qué hace:** **primero** compara `id == id_actual` (antes de abrir el UoW) -> `AutoDesactivacion`. Luego `uow.usuarios.delete(usuario)` (baja lógica) y devuelve `UserPublic`. También idempotente.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 5 y 12: "No puede desactivarse a sí mismo", 400; 404 si no existe; idempotente). Decisiones nuestras: la regla se chequea **antes** de abrir el UoW porque no necesita la base (es un fallo rápido y evita abrir y cerrar una transacción para nada); el Service recibe `id_actual` como parámetro para **no conocer al usuario de la sesión por su cuenta**: es el Router el que sabe quién es el admin logueado. Usa `delete()` del repositorio, que es la baja lógica genérica.
**Alternativa descartada:** permitir la autodesactivación: el último admin podría dejarse afuera del sistema sin forma de recuperarlo (y la consigna lo prohíbe). Otra: que el Service lea el usuario actual de la cookie: lo acoplaría a HTTP.
**Si te preguntan en el parcial:** "Impido que un admin se desactive a sí mismo para no dejar el sistema sin administradores. El chequeo está en el Service, y el Router le pasa el id del admin logueado, así el Service no depende de la sesión HTTP."

#### `_buscar(uow, id)` (staticmethod)
**Qué hace:** `get_by_id` o `UsuarioNoEncontrado`.
**Por qué lo planteamos así:** **decisión nuestra.** Evita repetir el "buscar o lanzar 404" en `activar` y `desactivar`. Es `staticmethod` porque no usa `self`. **Sí encuentra usuarios desactivados** (tiene que poder reactivarlos), a diferencia de categorías/productos, donde un registro dado de baja se trata como inexistente (la regla "un registro dado de baja se trata como inexistente", pág. 10, es del catálogo; con usuarios no puede aplicarse porque su operación es justamente reactivar).
**Alternativa descartada:** `get_activo`: haría imposible reactivar a un usuario.
**Si te preguntan en el parcial:** "`_buscar` evita repetir el chequeo de existencia, y a diferencia de productos no filtra por activo, porque si no, no podría reactivar a nadie."

> Nota: `auth` y `usuarios` también usan `with uow` en el Service (la consigna solo lo exige en categorias/productos/pedidos, pero queda consistente y se cumple igual).

### `usuarios/router.py` (prefijo `/admin/usuarios`, tag `usuarios (admin)`)

#### `get_usuario_service()`, `ServiceDep`, `UsuarioId = Annotated[int, Path(gt=0)]`
**Qué hace:** fábrica del Service, alias de dependencia y un tipo de path que exige `id > 0`.
**Por qué lo planteamos así:** la fábrica la **exige la consigna** (pág. 7). `Path(gt=0)` es **decisión nuestra**: ids autoincrementales empiezan en 1, así que un `id` 0 o negativo se rechaza con 422 sin ir a la base. Un alias evita repetir la anotación.
**Alternativa descartada:** validar a mano dentro del endpoint.
**Si te preguntan en el parcial:** "Validar el id en el borde con `Path(gt=0)` descarta basura antes de tocar la base."

| Método y ruta | Acceso | Éxito | Errores |
|---|---|---|---|
| `GET /admin/usuarios` | admin | 200 `list[UserPublic]` | 401/400/403 |
| `POST /admin/usuarios/{id}/activar` | admin | 200 `UserPublic` | 404 |
| `POST /admin/usuarios/{id}/desactivar` | admin | 200 `UserPublic` | 404; 400 si es él mismo |

#### `listar_usuarios(_: AdminUser, service: ServiceDep)` — `GET /admin/usuarios`
**Qué hace:** devuelve `service.listar()`.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 12 y criterio 4: gestión de usuarios solo admin). El parámetro `_: AdminUser` ejecuta la verificación de rol aunque no usemos el valor.
**Alternativa descartada:** chequear el rol dentro de la función.
**Si te preguntan en el parcial:** "El control de acceso está en la firma del endpoint con `AdminUser`; si el rol no es admin, FastAPI responde 403 sin entrar a la función."

#### `activar_usuario(id: UsuarioId, _: AdminUser, service: ServiceDep)` — `POST /admin/usuarios/{id}/activar`
**Qué hace:** llama a `service.activar(id)`; `UsuarioNoEncontrado` -> 404.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 12: POST, 200 `UserPublic`, 404). Es `POST` y no `PATCH`/`PUT` porque modela una **acción** ("activar") sobre un recurso, tal como indica la consigna.
**Alternativa descartada:** `PATCH /usuarios/{id}` con `{"disabled": false}`: más genérico, pero permitiría tocar otros campos y no es lo que pide la consigna.
**Si te preguntan en el parcial:** "Lo modelé como una acción con POST porque la consigna define activar y desactivar como operaciones, no como edición de campos."

#### `desactivar_usuario(id: UsuarioId, admin: AdminUser, service: ServiceDep)` — `POST /admin/usuarios/{id}/desactivar`
**Qué hace:** llama a `service.desactivar(id, admin.id)`; `UsuarioNoEncontrado` -> 404; `AutoDesactivacion` -> 400.
**Por qué lo planteamos así:** **lo exige la consigna** (pág. 12: 404; 400 si el admin intenta desactivarse a sí mismo). Acá sí usamos el valor del admin (`admin.id`) porque el Service necesita comparar contra el usuario de la sesión. 400 (y no 403) porque la acción es válida para su rol pero inválida por regla de negocio.
**Alternativa descartada:** resolverlo solo en el frontend ocultando el botón (pág. 20 lo pide además, pero la consigna aclara que "la protección real está en el backend").
**Si te preguntan en el parcial:** "Paso `admin.id` al Service para que compare; el frontend esconde el botón, pero la regla vive en el backend, que es la que realmente protege."

## 7. Pregunta típica: "¿cómo se protege un endpoint?"
Agregás el parámetro `_: AdminUser` (rol admin) o `usuario: CurrentUser` (cualquier usuario activo). No hay `if` manual en el endpoint: la protección vive en la dependencia. En el frontend ocultar un botón NO reemplaza esto: la seguridad real es del backend (pág. 20 de la consigna).

**Si te preguntan en el parcial:** "Protejo los endpoints con dependencias de FastAPI, no con `if` adentro: `CurrentUser` exige sesión y cuenta activa, y `AdminUser` además exige rol admin. Así no hay forma de que un endpoint nuevo se olvide del control sin que se note en la firma."

## 8. Limitaciones conocidas (conviene mencionarlas vos primero)
- **Logout stateless:** no revoca el JWT ya emitido; vive hasta que vence (30 min).
- **`secure=False`** en la cookie: correcto en desarrollo (HTTP), debe ser `True` en producción con HTTPS.
- **CSRF:** mitigado solo con `SameSite=Lax`; no hay token anti-CSRF.
- **Carrera en el registro:** dos registros simultáneos con el mismo username podrían pasar el chequeo previo; lo frena el `unique` de la base, pero responde con error genérico y no con 409.
- **Sin límite de intentos de login** (no hay protección de fuerza bruta/rate limiting): fuera de alcance de la consigna.
