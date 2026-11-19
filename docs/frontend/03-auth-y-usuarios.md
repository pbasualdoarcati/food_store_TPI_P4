# 03 - `features/auth` y `features/usuarios`

> Acá se ven los dos conceptos que más puntos mueven en los criterios 7 y 9: **TanStack Form** (login/registro) y **mutaciones con invalidación** (activar/desactivar usuarios). Cada entrada responde cuatro preguntas: qué hace, **por qué lo planteamos así**, qué alternativa descartamos y cómo lo defiendo en el parcial.

```
features/auth/
  api/auth.ts            loginRequest, getMe, logoutRequest, registrar
  hooks/useAuth.ts       useLogin, useRegistro
  pages/                 LoginPage, RegisterPage, UnauthorizedPage
  types/index.ts         Rol, Usuario, UserPublic, UserCreate, Credenciales, LoginResponse, ETIQUETA_ROL
features/usuarios/
  api/usuarios.ts        getUsuarios, activarUsuario, desactivarUsuario
  hooks/useUsuarios.ts   USUARIOS_KEY, useUsuarios, useActivarUsuario, useDesactivarUsuario
  components/columnasUsuarios.tsx   crearColumnasUsuarios
  pages/AdminUsuariosPage.tsx
  types/index.ts         re-export de los tipos de auth
```

## 0. La idea general (para arrancar el oral)

- **Cada feature repite la misma organización** (`api/`, `hooks/`, `components/`, `pages/`, `types/`). Lo pide la consigna (pág. 17, "Arquitectura por features"). La ventaja técnica es que cada capa tiene **una sola responsabilidad**: `api/` sabe de HTTP, `hooks/` sabe de caché e invalidación, `pages/` compone la pantalla, `components/` dibuja con props tipadas.
- **Separación del estado** (pág. 17): lo que viene del servidor (la lista de usuarios) lo maneja TanStack Query; lo que es del cliente (el usuario de la sesión) lo maneja Zustand. Por eso `useLogin` delega en el `authStore` pero `useUsuarios` es un `useQuery`.
- **El JWT nunca toca JavaScript.** Viaja en una cookie HttpOnly; el front solo sabe "quién soy" (`GET /auth/me`). El criterio 4 resta puntos si el token va "en el cuerpo o en localStorage".

---

## 1. `auth/types/index.ts`

### `Rol` — `features/auth/types/index.ts`
**Qué hace:** es la unión de literales `'user' | 'admin'`.
**Por qué lo planteamos así:** decisión nuestra, con una razón técnica: el `tsconfig` activa `erasableSyntaxOnly`, que prohíbe `enum` porque un `enum` genera código JavaScript en runtime. Una unión de literales se borra al compilar (cero costo) y el compilador igual te avisa si escribís `'adm'`. Además `ProtectedRoute` recibe `roles?: Rol[]`, así que un rol mal escrito en `AppRouter` no compila.
**Alternativa descartada:** `enum Rol { USER, ADMIN }` o `string` suelto. El `enum` no compila con `erasableSyntaxOnly`; `string` deja pasar cualquier valor sin error.
**Si te preguntan en el parcial:** "Usé una unión de literales y no un enum porque mi tsconfig tiene `erasableSyntaxOnly`, y además no genera código de más y me da el mismo chequeo en compilación."

### `Usuario` / `UserPublic` — `features/auth/types/index.ts`
**Qué hace:** `Usuario` describe al usuario público: `id, username, full_name, email, role, disabled, created_at`. `UserPublic = Usuario` es un alias.
**Por qué lo planteamos así:** lo exige la consigna (pág. 17, tabla de Tipos): "interfaces con los mismos nombres de campo que los schemas del backend". Por eso se usa `full_name` y `created_at` (snake_case) y no `fullName`: **no hay capa de mapeo**, lo que llega es lo que se usa, y hay menos lugares donde equivocarse. No incluye `hashed_password` ni token: refleja `UserPublic` del backend, que nunca los expone. El alias existe para poder usar el nombre del backend (`UserPublic`) en la feature de usuarios y el nombre en español en el resto.
**Alternativa descartada:** camelCase con una función que convierta cada respuesta. Agrega código, un lugar más donde fallar, y no lo pide nadie.
**Si te preguntan en el parcial:** "Mantuve los nombres de campo idénticos a los del backend para no tener que mapear nada: la interfaz es un espejo del schema `UserPublic`, y por eso no tiene password ni token."

### `UserCreate`, `Credenciales`, `LoginResponse` — `features/auth/types/index.ts`
**Qué hace:** `UserCreate` es el cuerpo de `POST /auth/register` (`username, full_name, email, password`). `Credenciales` es `{ username, password }`. `LoginResponse` es `{ message }`.
**Por qué lo planteamos así:** `LoginResponse` solo tiene `message` **a propósito**: el JWT va en la cookie HttpOnly, no en el cuerpo (criterio 4). Que el tipo no tenga campo `token` deja en el sistema de tipos la decisión de seguridad: no hay forma de guardar un token que no existe. Se separan `UserCreate` y `Credenciales` porque son cuerpos distintos de endpoints distintos.
**Alternativa descartada:** devolver el token en el cuerpo y guardarlo en `localStorage`. Cualquier script de la página (XSS) puede leerlo; con HttpOnly, no. La consigna lo penaliza explícitamente.
**Si te preguntan en el parcial:** "El tipo de la respuesta de login no tiene token porque el backend lo manda en una cookie HttpOnly; así el JavaScript del front no puede leerlo ni robarlo."

### `ETIQUETA_ROL: Record<Rol, string>` — `features/auth/types/index.ts`
**Qué hace:** traduce `user` a "Cliente" y `admin` a "Administrador" para mostrar en pantalla.
**Por qué lo planteamos así:** decisión nuestra. `Record<Rol, string>` obliga a cubrir **todos** los roles: si mañana agregamos un rol y nos olvidamos de la etiqueta, el compilador falla. Es la misma técnica que `ETIQUETA_ESTADO` en pedidos.
**Alternativa descartada:** un `if (rol === 'admin') ... else ...` en cada componente. Se repite y no avisa si aparece un tercer rol.
**Si te preguntan en el parcial:** "Usé `Record<Rol, string>` para que el mapa sea exhaustivo: si agrego un rol y no le pongo etiqueta, no compila."

---

## 2. `auth/api/auth.ts`

> Patrón común de todas las funciones de `api/`: son `async`, devuelven `Promise<Tipo>` con el genérico de Axios (`api.post<Usuario>`), desestructuran `{ data }` y devuelven solo `data`. **Por qué:** lo pide la consigna (pág. 17: "funciones que llaman a los endpoints con la instancia de Axios y devuelven datos tipados"). Quien las llama (un hook) recibe un `Usuario`, no una `AxiosResponse` con headers y status que no le interesan, y nunca hay un `any`. Todas usan la instancia única `api` (con `withCredentials`), no `axios` directo.

### `loginRequest(username, password): Promise<LoginResponse>` — `features/auth/api/auth.ts`
**Qué hace:** arma un `URLSearchParams` con `username` y `password`, hace `POST /auth/token` con `Content-Type: application/x-www-form-urlencoded` y devuelve el `LoginResponse`. Como efecto, el servidor setea la cookie.
**Por qué lo planteamos así:** el endpoint usa `OAuth2PasswordRequestForm` de FastAPI, que **exige** el formato de formulario (estándar OAuth2), no JSON. `URLSearchParams` genera `username=...&password=...`; Axios ya lo manda como form-urlencoded, pero dejamos el header explícito para que se lea de un vistazo. Es una restricción del backend, no una preferencia.
**Alternativa descartada:** mandar `{ username, password }` como JSON. FastAPI respondería 422 porque espera campos de formulario.
**Si te preguntan en el parcial:** "El login va como form-urlencoded porque el backend usa el formulario OAuth2 de FastAPI; si mandara JSON me daría 422."

### `getMe(): Promise<Usuario>` — `features/auth/api/auth.ts`
**Qué hace:** `GET /auth/me`; devuelve el usuario dueño de la cookie.
**Por qué lo planteamos así:** es la única forma que tiene el front de saber quién es sin leer el token (que no puede leer). Lo usan dos lugares del `authStore`: `login` (para obtener el usuario después de autenticar) y `checkSession` (al montar la app). Códigos que esperamos: 401 sin sesión, 400 cuenta desactivada (criterio 4).
**Alternativa descartada:** decodificar el JWT en el cliente para sacar el rol. Obligaría a tener el token accesible y confiaría en datos que el servidor no validó.
**Si te preguntan en el parcial:** "Como el token está en una cookie HttpOnly, el front se entera de quién es llamando a `/auth/me`; no decodifica nada."

### `logoutRequest(): Promise<void>` — `features/auth/api/auth.ts`
**Qué hace:** `POST /auth/logout`; el backend borra la cookie.
**Por qué lo planteamos así:** como la cookie es HttpOnly el front **no puede borrarla**; tiene que pedirle al servidor que lo haga. Por eso logout es una request y no un simple `set({ usuario: null })`. Devuelve `void` porque no hay cuerpo útil.
**Alternativa descartada:** limpiar solo el store. La cookie seguiría viva y al recargar `checkSession` te volvería a loguear.
**Si te preguntan en el parcial:** "El logout llama al backend porque solo el servidor puede borrar una cookie HttpOnly."

### `registrar(datos: UserCreate): Promise<Usuario>` — `features/auth/api/auth.ts`
**Qué hace:** `POST /auth/register` con JSON; devuelve el `Usuario` creado (201).
**Por qué lo planteamos así:** acá sí es JSON porque el registro no pasa por el formulario OAuth2. El rol no se manda: `UserCreate` no tiene campo `role`, así que el registro público no puede pedir ser admin (el rol lo fija el backend). El 409 (usuario o email duplicado) lo maneja quien llama.
**Alternativa descartada:** incluir `role` en el cuerpo. Sería abrir una escalada de privilegios.
**Si te preguntan en el parcial:** "El registro no manda rol: `UserCreate` ni siquiera tiene ese campo, así que nadie puede darse de alta como administrador desde el front."

---

## 3. `auth/hooks/useAuth.ts`

### `useLogin()` — `features/auth/hooks/useAuth.ts`
**Qué hace:** devuelve un `useMutation` cuya `mutationFn` llama a `login(username, password)` del `authStore`.
**Por qué lo planteamos así:** el login **vive en el store** porque es estado del cliente (quién soy), pero `useMutation` le agrega gratis el estado de la operación: `isPending`, `isError`, `error`, `isIdle`, `reset`. Así la página no necesita `useState` para "cargando / error". El comentario del código lo dice: "El login vive en el authStore (estado del cliente); useMutation aporta isPending y error". No invalida nada porque iniciar sesión no deja datos del servidor desactualizados en la caché (y el logout hace `queryClient.clear()`).
**Alternativa descartada:** llamar a `store.login()` directo en el `onSubmit` con tres `useState` (`cargando`, `error`, `ok`). Más código, más estados que sincronizar a mano.
**Si te preguntan en el parcial:** "El login es una función del store porque la sesión es estado del cliente, pero lo envuelvo en `useMutation` para tener `isPending` y `error` sin escribir `useState`."

### `useRegistro()` — `features/auth/hooks/useAuth.ts`
**Qué hace:** `useMutation` cuya `mutationFn` primero hace `await registrar(datos)` y después `login(datos.username, datos.password)`.
**Por qué lo planteamos así:** decisión nuestra de UX: después de crear la cuenta, el usuario ya queda logueado y no tiene que volver a tipear sus datos. Si `registrar` falla (409), `login` nunca se ejecuta. **Caso borde real que conviene conocer:** si `registrar` anduvo pero `login` fallara (por ejemplo, se cae la red entre las dos llamadas), la cuenta ya existe y el usuario vería un error; si reintenta el registro le daría 409. Lo aceptamos porque el usuario puede ir a "Iniciar sesión" con la cuenta ya creada, y la alternativa (un endpoint del backend que registre y loguee en una sola operación) cambiaría el contrato de la API que fija la consigna.
**Alternativa descartada:** redirigir a `/login` después de registrar. Funciona, pero obliga a escribir las credenciales dos veces.
**Si te preguntan en el parcial:** "Después de registrar hago login automático con las mismas credenciales. El caso borde es que si el login fallara con la cuenta ya creada, reintentar el registro daría 409; el usuario resuelve entrando por Iniciar sesión."

---

## 4. `auth/pages/LoginPage.tsx` - TanStack Form paso a paso

### Conceptos de TanStack Form usados

| Concepto | Qué es | Dónde se ve |
|----------|--------|-------------|
| `useForm({ defaultValues, onSubmit })` | Crea la instancia; el tipo de los valores **se infiere** de `defaultValues` | `const form = useForm({...})` |
| `form.Field` | Componente con render prop por campo (`name` tipado con las claves de `defaultValues`) | `<form.Field name="username">` |
| `validators` | Funciones por evento (`onChange`, `onBlur`, `onSubmit`...) que devuelven `string` (error) o `undefined` (ok) | `validators={{ onChange: requerido('El usuario') }}` |
| `field.state.value` / `field.handleChange` / `field.handleBlur` | Valor actual, actualizarlo (dispara validación), marcar como tocado | props del `<Input>` |
| `field.state.meta.errors` | Errores del campo | `<FormField errores=...>` |
| `form.handleSubmit()` | Valida todo y, si es válido, llama a `onSubmit` | en el `<form onSubmit>` |
| `form.Subscribe` | Suscripción **selectiva** al estado del form | el botón de submit |

### `rutaDeOrigen(estado: unknown): string | undefined` — `features/auth/pages/LoginPage.tsx`
**Qué hace:** recibe `location.state` y devuelve la ruta `desde` si existe y es un string; si no, `undefined`.
**Por qué lo planteamos así:** React Router tipa `location.state` como `unknown` (cualquiera pudo meter cualquier cosa). En vez de castear con `as` o usar `any`, lo **estrechamos con un type guard**: `typeof estado === 'object' && estado !== null && 'desde' in estado`, y recién ahí se lee `estado.desde` (que sigue siendo `unknown`, por eso hay otro `typeof === 'string'`). Responde al criterio 10 ("TypeScript strict sin `any`"). `ProtectedRoute` es quien deja `{ desde }` en el state al redirigir.
**Alternativa descartada:** `(location.state as { desde: string })?.desde`. Un cast le miente al compilador: si el state viene vacío o con otra forma, falla en runtime y TypeScript no avisó.
**Si te preguntan en el parcial:** "`location.state` es `unknown`, así que lo verifico con `typeof`, `!== null` e `in` antes de leerlo; es la alternativa segura a un cast o a un `any`."

### `destinoInicial(usuario: Usuario, desde?: string): string` — `features/auth/pages/LoginPage.tsx`
**Qué hace:** si venías de una ruta protegida (`desde`, y no es `/login`) te devuelve ahí; si no, el admin va a `/admin/resumen` y el cliente a `/`.
**Por qué lo planteamos así:** decisión nuestra de UX. Volver a donde ibas es lo que espera el usuario (ej. intentó entrar a `/checkout` sin sesión). El `desde !== '/login'` evita un bucle de redirección hacia la propia página de login. El admin aterriza en su panel porque es lo que viene a usar.
**Alternativa descartada:** mandar siempre a `/`. Un admin tendría que navegar a mano a su panel en cada login, y un cliente que venía del checkout perdería el hilo.
**Si te preguntan en el parcial:** "Después de loguear vuelvo a la ruta de origen que guardó `ProtectedRoute`; si no hay, el admin va al resumen y el cliente al catálogo."

### `LoginPage()` — `features/auth/pages/LoginPage.tsx`
**Qué hace:** renderiza el formulario de login con TanStack Form. Al enviar: `login.mutateAsync({ username: value.username.trim(), password })`, y si sale bien `navigate(destinoInicial(...), { replace: true })`. Si falla, el `catch` está vacío y el error se muestra desde `login.error` con `<AlertaError>`.
**Por qué lo planteamos así:**
- **TanStack Form** lo exige la consigna (criterio 7: "Login y registro con TanStack Form").
- **Form controlado** (`value={field.state.value}` + `onChange`): una sola fuente de verdad, el estado del form, no el DOM.
- **`noValidate`** apaga los globitos nativos del navegador para mostrar nuestros mensajes en español. **`preventDefault`** evita el envío HTML tradicional que recargaría la página (es una SPA). **`stopPropagation`** evita que el submit burbujee a un form padre (relevante si el form estuviera dentro de otro).
- **`mutateAsync` en vez de `mutate`**: devuelve una Promise, así el `await` espera el resultado y se navega **solo si salió bien**. El `catch` vacío es intencional: el error ya queda en `login.error` y se muestra desde ahí; mostrarlo también en el `catch` lo duplicaría.
- **`.trim()` en el username pero no en la contraseña**: los espacios de más en un usuario son un error de tipeo; en una contraseña pueden ser parte de ella.
- **Validadores `onChange`**: feedback inmediato mientras escribe, y el botón se deshabilita con `!canSubmit`. Con solo `onSubmit` el usuario vería los errores recién al apretar el botón. Igual, `form.handleSubmit()` valida los campos antes de llamar a `onSubmit`, así que no se envía un formulario inválido. (En el login el único validador es `requerido`: no validamos formato de credenciales, eso lo decide el backend con 401.)
- **`form.Subscribe` con `selector`**: solo se re-renderiza el botón cuando cambian `canSubmit` o `isSubmitting`, no todo el formulario en cada tecla. El `as const` hace que la tupla sea `readonly [boolean, boolean]` y no `boolean[]`.
- **`aria-invalid`** marca el input para lectores de pantalla (y el estilo pinta el borde rojo).
- **`if (usuario && login.isIdle) return <Navigate to="/" replace />`**: si ya estabas logueado al entrar a `/login` te manda al inicio. La condición `login.isIdle` es clave: durante o después del envío el login ya no está "idle", entonces esta redirección no pisa la navegación que hace `onSubmit` (que respeta `desde` y el rol).
- Errores esperados: 401 credenciales incorrectas, 400 cuenta desactivada (se muestran con `handleApiError`, que usa el `detail` del backend).
**Alternativa descartada:** `useState` por campo y validar a mano en un `onSubmit`. Más boilerplate, y la consigna pide TanStack Form.
**Si te preguntan en el parcial:** "Uso `mutateAsync` para esperar el login y navegar solo si salió bien; el error se muestra desde la mutación. La condición `isIdle` evita que la redirección de 'ya estás logueado' se pise con la navegación que hago después de enviar."

---

## 5. `auth/pages/RegisterPage.tsx`

### `RegistroForm` — `features/auth/pages/RegisterPage.tsx`
**Qué hace:** `interface RegistroForm extends UserCreate { confirmacion: string }`; es el tipo de los valores del formulario.
**Por qué lo planteamos así:** el formulario tiene un campo extra (`confirmacion`) que **no se envía** al backend. Extender `UserCreate` evita duplicar los cuatro campos reales; en `onSubmit` se arma explícitamente el `UserCreate` (sin `confirmacion`), con `.trim()` en los textos. Así el campo de UI no se cuela en la request.
**Alternativa descartada:** mandar todo `value` tal cual. Mandaría `confirmacion` al backend, que no lo espera.
**Si te preguntan en el parcial:** "El form tiene `confirmacion`, que es solo de UI; por eso extiendo `UserCreate` y en el submit armo el objeto sin ese campo."

### `RegisterPage()` — `features/auth/pages/RegisterPage.tsx`
**Qué hace:** formulario de registro con TanStack Form. Validadores por campo (todos reutilizados de `shared/utils/validaciones`): `username` `longitud('El usuario', 3, 50)`, `full_name` `longitud(..., 2, 100)`, `email` `emailValido`, `password` `passwordValida` (8 a 72) con `ayuda="Mínimo 8 caracteres."`. Al enviar: `registro.mutateAsync(...)` y `navigate('/', { replace: true })`.
**Por qué lo planteamos así:**
- Los **límites de longitud espejan los del schema del backend** (`UserCreate`: username 3-50, full_name 2-100, password 8-72; el 72 es el máximo que usa bcrypt). El criterio 7 pide "registro con validación": validar en el front es UX (feedback rápido); la validación que cuenta es la del servidor (422).
- **Validadores reutilizables** (`longitud`, `emailValido`, `passwordValida`): se usan también en categorías, productos y checkout; un cambio de regla se hace en un solo lugar.
- **`autoComplete`** correcto (`new-password` en las dos contraseñas, `username`, `name`, `email`) para que el gestor de contraseñas del navegador ofrezca guardar y no autocomplete mal.
- El 409 (usuario o email duplicado) se muestra desde `registro.error`; el `catch` vacío es intencional por lo mismo que en el login.
- `usuario && registro.isIdle` redirige a `/` si ya hay sesión al entrar, y `isIdle` evita pisar la navegación del submit.
**Alternativa descartada:** validar solo en `onSubmit`. Funciona, pero el usuario se entera tarde de que la contraseña es corta.
**Si te preguntan en el parcial:** "Valido en el front con las mismas reglas que el backend para dar feedback rápido, pero la validación que cuenta es la del servidor; el 409 de duplicado lo muestro desde el error de la mutación."

### Validación cruzada de `confirmacion` (`onChangeListenTo`) — `features/auth/pages/RegisterPage.tsx`
**Qué hace:** el campo `confirmacion` tiene `validators={{ onChangeListenTo: ['password'], onChange: ({ value, fieldApi }) => ... }}`. Devuelve 'Repetí la contraseña' si está vacío y 'Las contraseñas no coinciden' si difiere de `fieldApi.form.getFieldValue('password')`.
**Por qué lo planteamos así:** una validación que depende de **otro campo** tiene un problema: si escribís la confirmación y después corregís la contraseña, el error de `confirmacion` quedaría desactualizado (no se re-ejecuta porque `confirmacion` no cambió). `onChangeListenTo: ['password']` le dice al campo "volvé a validarte cuando cambie `password`". `fieldApi.form.getFieldValue` es la forma de leer el otro campo desde el validador.
**Alternativa descartada:** validar la coincidencia solo al enviar (`onSubmit`). El error aparecería tarde. Un validador a nivel formulario pondría el error en otro lugar en vez de debajo del campo que corresponde.
**Si te preguntan en el parcial:** "Usé `onChangeListenTo` para que la confirmación se revalide también cuando cambia la contraseña; sin eso, el mensaje de 'no coinciden' quedaría viejo."

---

## 6. `auth/pages/UnauthorizedPage.tsx`

### `UnauthorizedPage()` — `features/auth/pages/UnauthorizedPage.tsx`
**Qué hace:** compone `EstadoVacio` con un ícono de candado, el mensaje "No tenés permiso para ver esta página" y un `<Link to="/">` con el estilo `primaryButtonClass`.
**Por qué lo planteamos así:** lo exige la consigna (pág. 20: `/unauthorized`, "Sin permiso", Público, "Mensaje y enlace al inicio"). Es el destino de `ProtectedRoute` cuando hay sesión pero el rol no alcanza (un `user` entrando a `/admin/...`). Se reutiliza `EstadoVacio` en vez de armar otra pantalla: es el mismo patrón visual que las listas vacías. Es **pública** a propósito: si exigiera un rol, redirigir a ella desde una ruta prohibida podría crear un bucle.
**Alternativa descartada:** redirigir al catálogo en silencio. El usuario no entendería por qué no pudo entrar.
**Si te preguntan en el parcial:** "Es una pantalla pública con un mensaje y un enlace al inicio; ProtectedRoute manda ahí cuando el rol no alcanza, y es pública para no generar un bucle de redirección."

---

## 7. `usuarios/`

### Tipos de `usuarios` — `features/usuarios/types/index.ts`
**Qué hace:** `export type { Rol, UserPublic, Usuario } from '../../auth/types';`
**Por qué lo planteamos así:** `GET /admin/usuarios` devuelve `list[UserPublic]`, el **mismo tipo** que la sesión. Duplicar la interfaz crearía dos definiciones que podrían divergir (DRY). Se re-exporta con `export type` por `verbatimModuleSyntax`. Así la feature sigue importando sus tipos desde su propia carpeta `types/`.
**Alternativa descartada:** copiar la interfaz en la feature. Si el backend agrega un campo hay que acordarse de tocar dos archivos.
**Si te preguntan en el parcial:** "El listado devuelve el mismo `UserPublic` que la sesión, así que reexporto el tipo en vez de duplicarlo."

### `getUsuarios()`, `activarUsuario(id)`, `desactivarUsuario(id)` — `features/usuarios/api/usuarios.ts`
**Qué hace:** `GET /admin/usuarios` (lista sin paginación), `POST /admin/usuarios/{id}/activar` y `POST /admin/usuarios/{id}/desactivar`. Las dos últimas devuelven el `UserPublic` actualizado.
**Por qué lo planteamos así:** los endpoints los fija la consigna (criterio 4: "listado, activación y desactivación de usuarios (404, 400)"). **Activar y desactivar son idempotentes** (el código lo aclara en un comentario): responden 200 aunque el estado no cambie, así que un doble click no genera error. El listado no pagina porque el panel usa una tabla con paginación del lado del cliente (pág. 20).
**Alternativa descartada:** un solo `PATCH /usuarios/{id}` con `{ disabled }`. No es el contrato que define la consigna.
**Si te preguntan en el parcial:** "Activar y desactivar son idempotentes: si ya estaba en ese estado devuelven 200 igual, así un doble click no rompe nada."

### `USUARIOS_KEY` — `features/usuarios/hooks/useUsuarios.ts`
**Qué hace:** `export const USUARIOS_KEY = ['usuarios'] as const;`
**Por qué lo planteamos así:** es la "dirección" de la lista en la caché de TanStack Query. Se exporta como constante para **no escribir el string en varios lados** (un typo en una invalidación hace que no refresque y no da error: el peor tipo de bug). `as const` la vuelve una tupla de solo lectura. La consigna pide `queryKey` descriptivas (pág. 17).
**Alternativa descartada:** escribir `['usuarios']` literal en el `useQuery` y en cada `invalidateQueries`.
**Si te preguntan en el parcial:** "La key es una constante compartida para que la query y las invalidaciones apunten exactamente a lo mismo."

### `useUsuarios()` — `features/usuarios/hooks/useUsuarios.ts`
**Qué hace:** `useQuery({ queryKey: USUARIOS_KEY, queryFn: getUsuarios })`.
**Por qué lo planteamos así:** la lista de usuarios es **estado del servidor**, así que va en TanStack Query (pág. 17: "TanStack Query gestiona... usuarios"). Query nos da caché, estados de carga/error y reintento sin escribir un `useEffect`. La key es fija (sin filtros) porque no hay filtros ni paginación en el servidor.
**Alternativa descartada:** `useEffect` + `fetch` + `useState`. La consigna lo prohíbe (criterio 9 resta por "fetch + useEffect").
**Si te preguntan en el parcial:** "La lista es estado del servidor, así que uso `useQuery`; nunca hago fetch dentro de un `useEffect`."

### `useActivarUsuario()` / `useDesactivarUsuario()` — `features/usuarios/hooks/useUsuarios.ts`
**Qué hace:** `useMutation` con `mutationFn: activarUsuario` (o `desactivarUsuario`) y `onSuccess: () => queryClient.invalidateQueries({ queryKey: USUARIOS_KEY })`.
**Por qué lo planteamos así:** es el patrón **leer, mutar, invalidar** que pide la consigna (pág. 20: "useMutation e invalidación"). Pasos: (1) `useQuery` trae la lista y la cachea bajo `['usuarios']`; (2) la mutación envía el cambio; (3) en `onSuccess`, `invalidateQueries` marca esa entrada como desactualizada y, como la lista está en pantalla (query *activa*), Query la vuelve a pedir. La **fuente de verdad sigue siendo el servidor**: la tabla muestra lo que el backend confirmó. Detalle fino: el `onSuccess` **devuelve** la Promise de `invalidateQueries`, entonces Query la **espera** y la mutación sigue "pendiente" hasta que la lista se refrescó; el spinner del botón no desaparece antes de que cambie la tabla. Se invalida solo `['usuarios']` porque activar o desactivar una cuenta no cambia nada de lo que muestran productos o pedidos.
**Alternativa descartada:** (a) actualizar la caché a mano con `setQueryData`: la UI podría quedar distinta de lo que realmente hizo el servidor; (b) `queryClient.invalidateQueries()` sin key: refetchea **todas** las queries activas sin necesidad.
**Si te preguntan en el parcial:** "Después de activar o desactivar invalido la key `['usuarios']` y Query vuelve a pedir la lista; no toco la caché a mano para que la fuente de verdad siga siendo el servidor, y devuelvo la Promise para que el spinner dure hasta que la tabla se actualice."

### `AccionesUsuario` y `crearColumnasUsuarios(acciones): ColumnDef<UserPublic>[]` — `features/usuarios/components/columnasUsuarios.tsx`
**Qué hace:** `AccionesUsuario` es la interfaz `{ idSesion, idProcesando, onActivar, onDesactivar }`. `crearColumnasUsuarios` recibe eso y devuelve el array de columnas de TanStack Table.
**Por qué lo planteamos así:** es una **fábrica de columnas**: una función que recibe los callbacks y el estado de la página y devuelve las columnas. Así el archivo de columnas queda **tipado** (los callbacks reciben un `UserPublic`) y desacoplado de la página: no importa el store ni los hooks, solo recibe lo que necesita. Las columnas de TanStack Table (criterio 8) se definen con `ColumnDef<UserPublic>[]`, y `accessorKey: 'username'` conecta con una propiedad real del tipo (un typo es error de compilación). Detalles de cada columna:
- **Usuario:** `cell` personalizada con `@username` y un badge "vos" si `row.original.id === idSesion`.
- **Rol:** badge violeta para admin, gris para cliente, con `ETIQUETA_ROL[rol]`.
- **Estado (columna calculada):** `id: 'estado'` + `accessorFn: (u) => u.disabled ? 'Desactivado' : 'Activo'`. El valor accesible es **el texto que ve el usuario**; así la búsqueda global y el orden funcionan con "Activo"/"Desactivado". Si usara el booleano, buscar "activo" no encontraría nada. Una columna con `accessorFn` necesita `id` explícito porque no hay clave de la que derivarlo.
- **Alta:** `formatearFecha(...)`; `meta.className` usa el *module augmentation* de `shared/types/tanstack-table.ts` (ver `06`).
- **Acciones:** `id: 'acciones'` y `enableSorting: false` (no tiene sentido ordenar por botones).
- `getValue<string>()`: el genérico fija el tipo del valor de la celda; `row.original` es la fila completa y tipada.
- **Botón Desactivar oculto en la propia fila:** si el usuario está activo y `usuario.id === idSesion` la celda devuelve `null`. Si `usuario.disabled` aparece **Activar** (verde); si no, **Desactivar** (rojo). `cargando={procesando}` (`idProcesando === usuario.id`) pone spinner solo en el botón de esa fila.

**Por qué ocultamos Desactivar en la fila propia:** lo exige la consigna (pág. 20): "El botón Desactivar no se muestra en la fila del usuario de la sesión". La razón de producto es que un admin no se bloquee a sí mismo. **Ojo, esto es UX y no seguridad:** el backend lo vuelve a validar (`UsuarioService.desactivar` lanza `AutoDesactivacion` si `id == id_actual` y el router responde 400). Alguien podría llamar al endpoint con Postman: la protección real está en el servidor; ocultar el botón solo evita que el admin se equivoque (pág. 20: "ocultar un botón no reemplaza a require_role").
**Alternativa descartada:** columnas escritas dentro de `AdminUsuariosPage` (mezcla presentación y página, archivo enorme), o un botón deshabilitado en vez de oculto (la consigna pide que no se muestre).
**Si te preguntan en el parcial:** "Las columnas son una fábrica que recibe las acciones, así quedan tipadas y separadas de la página. Oculto Desactivar en mi propia fila porque lo pide la consigna, pero eso es solo UX: el backend también lo rechaza con 400, porque esconder un botón no es seguridad."

### `AdminUsuariosPage()` — `features/usuarios/pages/AdminUsuariosPage.tsx`
**Qué hace:** obtiene `idSesion` del `authStore`, la lista con `useUsuarios()` y las dos mutaciones. Calcula `idProcesando`, arma las columnas con `useMemo` y muestra una de cuatro pantallas: skeleton, error con "Reintentar", vacío o `DataTable`.
**Por qué lo planteamos así:**
- **`idProcesando`**: `activar.variables` / `desactivar.variables` es el argumento de la última `mutate` (acá el `id`) mientras la mutación está pendiente. Sirve para saber **qué fila** se está procesando y poner spinner solo ahí, sin un `useState` extra.
- **`useMemo` con `[idSesion, idProcesando]`**: sin él las columnas serían un array nuevo en cada render y la tabla las recalcularía. Se recrean solo cuando cambia la sesión o la fila en proceso. `mutate` y `reset` son estables, por eso no están en las dependencias (lo aclara el comentario del código).
- **`onActivar` hace `desactivar.reset()` antes de `activar.mutate(...)`** (y al revés): limpia el error de la *otra* mutación para no mostrar un error viejo.
- **`errorMutacion = activar.error ?? desactivar.error`** muestra un `EstadoError` arriba si falla (404 usuario inexistente, 400 auto-desactivación).
- **Los cuatro estados** (el criterio 7 resta por "sin estados de carga o vacío"), en cadena de ternarios: `isPending` -> `SkeletonFilas`; `isError` -> `EstadoError` con `refetch`; `data.length === 0` -> `EstadoVacio`; si no, `DataTable`. Se usa `isPending` (aún no hay `data`) y el **orden de las ramas** hace que TypeScript sepa que en la última `data` está definido, sin `data?.`.
- **`DataTable` con búsqueda y paginación en el cliente**: lo pide la consigna para las tablas del admin (pág. 20). `getRowId={(u) => String(u.id)}` da una identidad estable a cada fila.
- La ruta además está bajo `ProtectedRoute roles={['admin']}` (UX), y el backend exige rol admin en `/admin/usuarios` (seguridad real).
**Alternativa descartada:** mantener `idProcesando` con `useState` (hay que sincronizarlo con `isPending` a mano y se puede desincronizar), o un único booleano `cargando` global (deshabilitaría todos los botones).
**Si te preguntan en el parcial:** "Saco la fila en proceso de `mutation.variables`, memoizo las columnas con las dos dependencias que cambian y manejo los cuatro estados: cargando, error, vacío y datos."

---

## 8. Qué pasa cuando desactivás a un usuario (efecto cruzado)

La cuenta desactivada seguirá teniendo su cookie, pero en su próxima request el backend responde `400 "Cuenta de usuario desactivada"`. El **interceptor** de Axios lo detecta (`cuentaDesactivada`: `status === 400 && data.detail === CUENTA_DESACTIVADA`), limpia el `authStore`, vacía la caché de Query y lo manda a `/login`. Esto es lo que pide la consigna (pág. 20, fila "Cliente HTTP"). Y si intenta loguearse de nuevo, `/auth/token` devuelve 400 y se muestra el mensaje. Punto débil conocido: el interceptor compara contra el **texto** del `detail`, así que si el backend lo cambia deja de detectarse.
