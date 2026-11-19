# 01 - `shared/`: lo transversal

> `src/shared/` es la "caja de herramientas" del proyecto: cosas que usan varias features. Regla de oro: **ninguna pieza de `shared/` contiene reglas de negocio**; reciben datos por props y los muestran. (Hay un par de imports hacia tipos de features, ver `00-arquitectura.md` §2.4.)
>
> Cómo leer este doc: cada pieza tiene **Qué hace**, **Por qué lo planteamos así** (distinguiendo *lo exige la consigna* de *decisión nuestra*), **Alternativa descartada** y **Si te preguntan en el parcial** (respuesta corta en primera persona).
>
> Qué pide la consigna sobre `shared/` (pág. 18): `shared/api/` = `axiosInstance.ts`, `handleApiError.ts`, `queryClient.ts`; `shared/ui/` = Button, Card, Input, Modal, BadgeEstado; `shared/components/` = Paginacion, Skeleton, EstadoVacio, EstadoError; `shared/layout/` = Navbar, MainLayout. Todo lo demás de este doc (DataTable, ConfirmModal, Cargando, FormField, validaciones, useDebounce...) es **decisión nuestra** para no repetir código. La consigna aclara además que "los nombres de archivo son orientativos; lo que se evalúa son las piezas y su comportamiento".

```
shared/
  api/         axiosInstance.ts, handleApiError.ts, queryClient.ts
  ui/          Button, Card, Input, Modal, BadgeEstado, AlertaError, FormField, FormActions, styles.ts
  components/  DataTable, Paginacion, Skeleton, EstadoVacio, EstadoError, Cargando, ConfirmModal, PageHeader, RowActions
  layout/      MainLayout, Navbar
  hooks/       useDebounce
  utils/       formato.ts, validaciones.ts
  types/       tanstack-table.ts
```

---

## 1. `shared/api/`

### `api` (instancia de Axios) — `src/shared/api/axiosInstance.ts`

**Qué hace:** `axios.create({ baseURL: import.meta.env.VITE_API_URL, withCredentials: true })`. Es el **único** cliente HTTP: todas las funciones de `features/*/api/*.ts` (auth, categorias, productos, pedidos, usuarios) usan `api`, nunca `axios` directo.

```ts
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});
```

**Por qué lo planteamos así:**
- *Lo exige la consigna (pág. 17 y 20):* "Axios 1.x - Cliente HTTP con withCredentials e interceptor de 401" y "baseURL = VITE_API_URL, withCredentials: true".
- `withCredentials: true` le dice al navegador: "en requests **cross-origin** (5173 → 8000) adjuntá cookies y aceptá `Set-Cookie`". Sin esto el login responde bien pero el navegador **descarta** la cookie y `/auth/me` da 401. Es la mitad del mecanismo que permite que el JS nunca vea el token (ver `00-arquitectura.md` §7 y §8).
- *Decisión nuestra:* una sola instancia centralizada. `baseURL` y cookies se configuran en un lugar, y el manejo global de 401 también. `axios.create` no ensucia el `axios` global. Con `baseURL`, las funciones escriben `api.get('/productos')` y no la URL completa.
- `VITE_API_URL` viene de `.env` porque cambia entre desarrollo y producción (y las variables `VITE_` quedan en el bundle público: jamás secretos).

**Alternativa descartada:** llamar a `axios.get('http://localhost:8000/...')` en cada función (URL repetida, hay que acordarse de `withCredentials` y del manejo de errores en cada lugar), o usar `fetch` (habría que armar a mano `credentials: 'include'`, el parseo de errores y el interceptor).

**Si te preguntan en el parcial:** "Tengo una sola instancia de Axios con baseURL desde el `.env` y `withCredentials` para que el navegador mande la cookie HttpOnly. Todo pasa por ahí, así el manejo de sesión vencida está en un único lugar."

---

### `CUENTA_DESACTIVADA` — `src/shared/api/axiosInstance.ts`

**Qué hace:** constante `'Cuenta de usuario desactivada'`: el `detail` exacto que el backend manda en un 400 cuando la cuenta está desactivada.

**Por qué lo planteamos así:** *lo define la consigna* (pág. 20: "ante 400 con detail «Cuenta de usuario desactivada»"). La exportamos como constante para no repetir el string mágico y para que quede claro que hay un **acople por texto** con el backend: si allá cambia el mensaje, acá deja de detectarse.

**Alternativa descartada:** un código de error estructurado (`{"code": "ACCOUNT_DISABLED"}`) sería más robusto, pero la consigna fija el contrato con ese texto y el backend responde `detail` como string.

**Si te preguntan en el parcial:** "Es el mensaje exacto del backend; lo dejé como constante porque dependo de ese texto. Un código de error sería más robusto, pero el contrato de la consigna es por mensaje."

---

### Interceptor de respuesta — `src/shared/api/axiosInstance.ts`

**Qué hace:** ante un error de respuesta, si es **sesión vencida** (401 en una ruta que no sea `/auth/token` ni `/auth/me`) o **cuenta desactivada** (400 con ese `detail`), limpia el `authStore`, vacía la caché de Query y manda a `/login`. En todos los casos vuelve a rechazar la promesa.

```ts
const RUTAS_SIN_INTERCEPTAR = ['/auth/token', '/auth/me'];

api.interceptors.response.use(
  (response) => response,                       // (1) éxito: pasa tal cual
  (error: unknown) => {                         // (2) falla: acá se decide
    if (axios.isAxiosError<ApiErrorBody>(error) && error.response) {   // (3)
      const { status, data } = error.response;                          // (4)
      const url = error.config?.url ?? '';                              // (5)
      const sesionVencida =
        status === 401 && !RUTAS_SIN_INTERCEPTAR.some((ruta) => url.endsWith(ruta)); // (6)
      const cuentaDesactivada = status === 400 && data?.detail === CUENTA_DESACTIVADA; // (7)

      if (sesionVencida || cuentaDesactivada) {                          // (8)
        useAuthStore.getState().limpiarSesion();                         // (9)
        queryClient.clear();                                             // (10)
        if (window.location.pathname !== '/login') {                     // (11)
          window.location.assign('/login');
        }
      }
    }
    return Promise.reject(error);                                        // (12)
  },
);
```

1. Un interceptor de **respuesta** recibe dos callbacks: uno para 2xx y otro para el resto. El primero no hace nada.
2. El `error` llega como `unknown` (strict: no asumimos nada).
3. `axios.isAxiosError<ApiErrorBody>(error)` es un **type guard**: dentro del `if`, TypeScript sabe que es `AxiosError<ApiErrorBody>`. `error.response` existe solo si el servidor *respondió*; sin respuesta es un error de red y no hay nada que interpretar.
4. Se extrae status y cuerpo (`data`), tipado como `ApiErrorBody`.
5. `error.config?.url` es la URL **relativa** con la que se llamó (`'/auth/me'`), sin `baseURL`; por eso se compara con `endsWith`.
6-7. Las dos condiciones de la consigna.
8-10. Si corresponde, se limpia el store con `getState()` (acceso fuera de React) y toda la caché.
11. Navegación "dura" a `/login`, salvo que ya estés ahí.
12. **Siempre** se re-rechaza: quien llamó (`useMutation`, `useQuery`) igual se entera del error. El interceptor es un efecto lateral, no se "traga" errores.

**Por qué lo planteamos así:**
- *Lo exige la consigna (pág. 20):* "interceptor de respuesta: ante 401 fuera de /auth/token y /auth/me, o ante 400 con detail «Cuenta de usuario desactivada», limpia el authStore; la vuelta a /login la hace el propio interceptor o ProtectedRoute al quedar sin usuario".
- **Por qué se excluyen `/auth/token` y `/auth/me`:** en esas dos rutas un 401 es una respuesta **esperada**, no una sesión que se cayó.
  - En `/auth/token` significa "usuario o contraseña incorrectos". Si el interceptor lo tratara como sesión vencida, `window.location.assign('/login')` recargaría la página de login cada vez que escribís mal la contraseña y el mensaje de error se perdería.
  - En `/auth/me` significa "todavía no hay sesión". Lo dispara `checkSession` al abrir la app; si el interceptor reaccionara, un visitante anónimo que abre el catálogo sería redirigido a `/login`, y las rutas públicas dejarían de ser públicas. Además `checkSession` ya maneja ese error.
- **Por qué `window.location.assign` y no `navigate`:** el interceptor es un módulo común, **no un componente**: no puede usar el hook `useNavigate()` (solo funciona dentro del árbol de React Router). Como usamos `BrowserRouter` (lo pide la consigna) no existe un objeto `router` importable con `router.navigate()` (eso lo da `createBrowserRouter`). Además la recarga completa es una ventaja: resetea todo estado en memoria (componentes montados, mutaciones en vuelo) de una sesión que ya no existe. El costo es perder la SPA en ese instante, aceptable en un caso excepcional.
- **Por qué el `if (pathname !== '/login')`:** evita recargar en bucle si ya estás en `/login` (un request que falle con 401 desde esa pantalla provocaría otra recarga).
- **Por qué `queryClient.clear()` además de limpiar el store:** la caché tiene datos de la sesión anterior; si el usuario vuelve a loguearse con otra cuenta no tiene que ver los viejos.
- **Por qué `getState()`:** ver `02-store-y-rutas.md` (Zustand fuera de React).
- *Decisión nuestra:* el interceptor no vacía el carrito (solo `logout` lo hace). Es el mismo usuario que probablemente vuelva a entrar.

**Alternativa descartada:** manejar el 401 en cada `useQuery`/`useMutation` (`onError` repetido en decenas de lugares y alguno se olvida); o dejar que solo `ProtectedRoute` reaccione (anda para rutas protegidas, pero no limpia la caché ni detecta la cuenta desactivada en pleno uso); o excluir con `===` en vez de `endsWith` (frágil si la URL llega con prefijo o query).

**El import circular:** este archivo importa `useAuthStore` y `authStore` importa `auth.ts`, que importa `api` de acá. Funciona porque el store se usa **dentro** de la función del interceptor, no al evaluar el módulo. Detalle y cómo lo arreglaría en `02-store-y-rutas.md` (sección "getState() fuera de React y el import circular").

**Si te preguntan en el parcial:** "Excluyo `/auth/token` y `/auth/me` porque ahí el 401 es normal: credenciales malas o visitante sin sesión; si no, la pantalla de login se recargaría sola y las rutas públicas redirigirían. Uso `window.location.assign` porque el interceptor está fuera de React y no puede usar `useNavigate`, y la recarga además tira todo el estado de la sesión muerta."

---

### `handleApiError(error: unknown): string` — `src/shared/api/handleApiError.ts`

**Qué hace:** convierte **cualquier** error en un string legible. Orden de decisión: sin `response` (backend caído) → mensaje de conexión; `detail` string → ese texto; `detail` array (422 de FastAPI) → los `msg` unidos con `'. '`; otro status → tabla `MENSAJES_POR_CODIGO` (401/403/404/500) o `Error <status>`; `Error` común → `error.message`; otra cosa → `'Ocurrió un error inesperado.'`. También exporta `ApiErrorBody` (`{ detail?: string | ErrorValidacion[] }`).

| Caso | Resultado |
|------|-----------|
| `AxiosError` sin `response` | `'No se pudo conectar con el servidor. ¿Está levantado el backend?'` |
| `detail` string (errores de dominio 400/401/404/409) | ese texto tal cual |
| `detail` array (422) | los `msg` unidos |
| Otro status | `MENSAJES_POR_CODIGO[status]` o `Error <status>` |
| `Error` común | `error.message` |
| Cualquier otra cosa | `'Ocurrió un error inesperado.'` |

**Por qué lo planteamos así:**
- *Lo exige la consigna (pág. 18):* "handleApiError.ts: mensajes de error a partir de detail".
- *Decisión nuestra:* el backend ya manda mensajes de negocio en español en `detail` (por ejemplo "El nombre de usuario ya existe"); mostrarlos tal cual es más útil que un genérico "Error 409". FastAPI usa **dos formatos** de `detail` (string para errores de dominio, lista para validación 422), por eso el tipo es una unión y hay que distinguir.
- *Recibe `unknown`:* en TypeScript, el `error` de un `catch` o de TanStack Query no tiene tipo garantizado; con `unknown` el compilador nos obliga a chequear antes de usarlo (por eso `axios.isAxiosError` y `instanceof Error`).
- Un solo lugar para traducir errores: las pantallas llaman `handleApiError(error)` dentro de `<EstadoError mensaje=...>` o `<AlertaError mensaje=...>`.

**Alternativa descartada:** mostrar `error.message` de Axios ("Request failed with status code 409"): inútil para el usuario. Repetir el `if` de formatos en cada pantalla: duplicado y se desincroniza.

**Si te preguntan en el parcial:** "Es la única función que traduce errores de la API a texto. Distingue el `detail` string de los errores de dominio del array de FastAPI en los 422, y cubre el caso de backend caído. Recibe `unknown` para no asumir nada del error."

---

### `queryClient` — `src/shared/api/queryClient.ts`

**Qué hace:** instancia única de `QueryClient` con defaults para todas las queries: `staleTime: 30_000`, `refetchOnWindowFocus: false` y una función `retry`.

```ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (intentos, error) => {
        if (isAxiosError(error) && error.response && error.response.status < 500) return false;
        return intentos < MAX_REINTENTOS;   // 2
      },
    },
  },
});
```

| Opción | Qué hace | Por qué |
|--------|----------|---------|
| `staleTime: 30_000` | 30 s el dato se considera **fresco**: no se vuelve a pedir al montar otro componente que lo use | Navegar entre pantallas no dispara requests innecesarios |
| `refetchOnWindowFocus: false` | No refetchea al volver a la pestaña | Evita requests sorpresivos en una app de formularios y panel |
| `retry` (función) | **No reintenta** un 4xx; sí hasta 2 veces fallas de red o 5xx | Ver abajo |

**Por qué lo planteamos así:**
- *Lo exige la consigna (pág. 18):* "queryClient.ts: instancia única de TanStack Query" y "TanStack Query gestiona el estado del servidor".
- **Por qué no se reintenta un 4xx:** un 401, 403, 404, 409 o 422 es una respuesta *definitiva* del servidor ("no tenés permiso", "no existe", "ya existe", "dato inválido"). Repetir la misma request devuelve lo mismo. El default de Query reintenta 3 veces con espera creciente: el usuario esperaría varios segundos para ver un error que ya era claro. En cambio una falla de red o un 5xx puede ser transitoria, y ahí sí vale reintentar (máximo 2).
- La condición `error.response && status < 500`: sin `response` es error de red → se reintenta; `>= 500` → se reintenta; `< 500` → no.
- **Por qué es una instancia única exportada (no creada dentro de un componente):** `main.tsx` se la pasa a `QueryClientProvider`, y además `authStore` (logout) y el interceptor necesitan llamar `queryClient.clear()` **fuera de React**.
- *Decisión nuestra:* los valores (30 s, 2 reintentos). Las **mutaciones** quedan con el default de Query (sin reintentos): una mutación no debería repetirse sola (podrías crear dos pedidos).

**Alternativa descartada:** dejar `retry` por defecto (3 reintentos aun en 4xx), o `retry: false` global (perdemos resiliencia ante un microcorte). `refetchOnWindowFocus: true` (default) refetchearía todo cada vez que volvés a la pestaña, incluso con un modal de edición abierto.

**Si te preguntan en el parcial:** "Configuré que no se reintente un 4xx porque no se arregla reintentando, solo las fallas de red o 5xx hasta 2 veces. El `queryClient` es un singleton exportado porque el logout y el interceptor tienen que limpiar la caché desde fuera de React."

---

## 2. `shared/ui/` - piezas visuales base

Componentes "tontos": reciben props, devuelven JSX con clases Tailwind. *La consigna los pide* (pág. 18: "Piezas visuales base con Tailwind"); la decisión nuestra es que **ninguno tenga lógica de negocio**, así se reusan en cualquier feature.

### `styles.ts` (constantes de clases) — `src/shared/ui/styles.ts`

**Qué hace:** exporta strings de Tailwind: `inputClass`, `primaryButtonClass`, `secondaryButtonClass`, `dangerButtonClass`, `ghostButtonClass`, `labelClass`.

**Por qué lo planteamos así:** *decisión nuestra:* un único "lenguaje visual". Se usan también fuera de `ui/` (por ejemplo `primaryButtonClass` en un `<Link>` que debe *verse* como botón, o `secondaryButtonClass` en `Paginacion`/`DataTable`). Tailwind 4 detecta las clases escaneando los archivos, por eso tienen que estar escritas **completas** (no armadas por concatenación parcial como `` `bg-${color}-600` ``, que Tailwind no encuentra y no genera).

**Alternativa descartada:** copiar las mismas clases en cada botón (cambiar el color de marca implicaría tocar 30 lugares), o `@apply` en CSS (mezcla dos formas de estilar).

**Si te preguntan en el parcial:** "Las clases repetidas están en un archivo para tener un solo lenguaje visual; las dejo completas porque Tailwind genera CSS escaneando texto estático."

---

### `Button({ variante, cargando, type, className, disabled, ...props })` — `src/shared/ui/Button.tsx`

**Qué hace:** `<button>` con 4 variantes (`primario` por defecto, `secundario`, `peligro`, `fantasma`). Si `cargando`, muestra un spinner y se deshabilita (`disabled || cargando`). `type="button"` por defecto.

**Por qué lo planteamos así:**
- *La consigna lo pide (pág. 18).* *Decisión nuestra:*
- Extiende `ButtonHTMLAttributes<HTMLButtonElement>`: acepta `onClick`, `aria-*`, etc. sin redeclararlos.
- **`type="button"` por defecto:** en HTML un `<button>` dentro de un `<form>` es `submit` por defecto. Con este default, un "Cancelar" dentro de un formulario no envía el form por accidente; para enviar hay que pedirlo (`type="submit"`).
- `cargando` deshabilita para evitar el **doble clic** (dos pedidos creados).
- `Record<Variante, string>` obliga a cubrir todas las variantes.

**Alternativa descartada:** usar `<button>` crudo con clases en cada pantalla (se olvida el `type`, el estado de carga y el disabled). Una librería de componentes (MUI): agrega peso y estilo propio cuando con Tailwind alcanza.

**Si te preguntan en el parcial:** "Puse `type='button'` por defecto para que ningún botón dentro de un form envíe por accidente, y `cargando` deshabilita el botón para evitar doble envío."

---

### `Card({ className, children, ...props })` — `src/shared/ui/Card.tsx`

**Qué hace:** contenedor blanco con sombra (`rounded-lg bg-white p-4 shadow-sm ring-1`), mergea `className` extra y pasa el resto de los atributos del `div`.

**Por qué lo planteamos así:** *la consigna lo pide (pág. 18).* Aísla el aspecto de "tarjeta" en un solo lugar. Usa `HTMLAttributes<HTMLDivElement>` para aceptar cualquier atributo nativo. **Usado por:** Login, Register, Carrito, Checkout.

**Alternativa descartada:** repetir las clases en cada pantalla.

**Si te preguntan en el parcial:** "Es un contenedor de presentación que concentra el estilo de tarjeta; acepta className para ajustes puntuales."

---

### `Input({ className, ...props })` — `src/shared/ui/Input.tsx`

**Qué hace:** `<input>` con `inputClass` (borde, foco naranja, `aria-invalid:border-red-400`, `disabled`), pasando todos los atributos nativos.

**Por qué lo planteamos así:** *la consigna lo pide (pág. 18).* Los formularios de TanStack Form le pasan `id`, `value`, `onChange`, `onBlur` y `aria-invalid`; el estilo de error se activa solo con `aria-invalid` (accesibilidad y estilo en un mismo atributo). **Usado por:** todos los formularios y `FiltrosCatalogo`.

**Alternativa descartada:** `<input>` crudo con clases repetidas.

**Si te preguntan en el parcial:** "Es un input estilado que acepta cualquier atributo nativo; el borde rojo de error se activa con `aria-invalid`, que además sirve para accesibilidad."

---

### `Modal({ isOpen, titulo, onClose, ancho, children })` — `src/shared/ui/Modal.tsx`

**Qué hace:** diálogo **controlado desde afuera** (`isOpen`). Si `!isOpen` devuelve `null`. Renderiza un fondo oscuro (click afuera cierra) y un panel con `role="dialog"`, `aria-modal="true"` y `aria-labelledby` (id de `useId()`). Cierra con la **tecla Escape** mediante un `useEffect`.

```tsx
useEffect(() => {
  if (!isOpen) return;
  const cerrarConEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
  window.addEventListener('keydown', cerrarConEscape);
  return () => window.removeEventListener('keydown', cerrarConEscape);
}, [isOpen, onClose]);
```

**Por qué lo planteamos así:**
- *La consigna lo pide (pág. 18).* *Decisión nuestra:*
- **Controlado:** quien lo usa decide cuándo abre y cierra (con su propio estado). El modal no sabe qué hace "cerrar" (puede resetear un formulario, limpiar un error de mutación...).
- **Listener de Escape en un `useEffect`:** el listener es un **efecto de sincronización con el navegador** (un sistema externo, `window`), no una carga de datos; por eso es legítimo y la consigna lo permite (solo prohíbe `fetch` en `useEffect`). Se registra **solo si `isOpen`** y se quita en la función de limpieza: sin limpieza, cada apertura sumaría un listener y quedarían listeners "fantasma" llamando a `onClose` de modales ya cerrados. Va en `window` (no en el div del modal) porque un `onKeyDown` en el div solo recibiría la tecla si el foco estuviera dentro.
- **`useId()`** genera un id único y estable para `aria-labelledby`: el lector de pantalla anuncia el título. No se hardcodea porque podrían coexistir dos modales.
- **`stopPropagation` en el panel:** el click adentro no sube al fondo (que cierra).
- Detalle honesto: `onClose` está en las dependencias; como las páginas pasan flechas nuevas en cada render, el listener se re-registra en cada render. Es inocuo, solo no es óptimo (se arreglaría con `useCallback` en el padre). Tampoco implementamos *focus trap* (el foco puede salir del modal con Tab); un `<dialog>` nativo con `showModal()` lo daría gratis.

**Alternativa descartada:** `window.confirm`/`alert` (no estilables, no accesibles); una librería de modales (dependencia extra); el elemento `<dialog>` nativo (válido, pero el control del cierre y la animación quedaban más opacos para el equipo).

**Si te preguntan en el parcial:** "El Modal es controlado. Agrego el listener de Escape en un `useEffect` solo cuando está abierto y lo saco en la limpieza para no acumular listeners. Es sincronizar con el navegador, no traer datos, así que respeta la consigna del `useEffect`."

*Usado por:* `ConfirmModal`, `CategoriaFormModal`, `ProductoFormModal`, `StockModal` y los modales de detalle de pedido.

---

### `BadgeEstado({ estado })` — `src/shared/ui/BadgeEstado.tsx`

**Qué hace:** pastilla de color con la etiqueta legible de un `EstadoPedido`: PENDIENTE (ámbar), EN_PREPARACION (azul), ENTREGADO (verde), CANCELADO (gris).

**Por qué lo planteamos así:** *lo exige la consigna (pág. 18):* "BadgeEstado colorea los cuatro estados del pedido". *Decisión nuestra:* un `Record<EstadoPedido, { clase, etiqueta }>` **exhaustivo**: si se agrega un estado nuevo al tipo, TypeScript marca error acá hasta que se cubra (no queda un estado sin color). Muestra "En preparación" en vez del valor crudo `EN_PREPARACION`. **Usado por:** `TarjetaPedido`, `PedidoDetalle`, `TablaPedidos`.

**Alternativa descartada:** un `switch` con `default` (un estado nuevo caería en el default sin avisar) o `if` anidados.

**Si te preguntan en el parcial:** "Uso un `Record` exhaustivo sobre el tipo de estado, así el compilador me obliga a darle color y etiqueta a cada estado de la máquina de estados."

---

### `AlertaError({ mensaje })` — `src/shared/ui/AlertaError.tsx`

**Qué hace:** si `mensaje` es `null` devuelve `null`; si hay, un `<p role="alert">` rojo.

**Por qué lo planteamos así:** *decisión nuestra:* es el error de una **mutación** dentro de un formulario o modal (el error de una *consulta* usa `EstadoError`). `role="alert"` hace que el lector de pantalla lo anuncie. Aceptar `string | null` permite pasar directamente `error ? handleApiError(error) : null` sin condicional en cada uso.

**Alternativa descartada:** `window.alert()` (bloquea, no estilable) o un componente de toast (más complejo, sin necesidad acá).

**Si te preguntan en el parcial:** "Muestra el error de una mutación en el mismo formulario; con `role=alert` es accesible y devuelve null si no hay error."

---

### `FormField({ label, htmlFor, errores, ayuda, children })` — `src/shared/ui/FormField.tsx`

**Qué hace:** envuelve un campo: `<label htmlFor>` + el input (`children`) + ayuda + errores. Normaliza `errores` con `[...new Set(errores.filter(Boolean).map(String))]`; la ayuda se oculta si hay errores.

**Por qué lo planteamos así:** *decisión nuestra (la consigna pide TanStack Form, pág. 17, pero no este componente):* sin él, cada campo repetiría label + mensajes de error. `errores` es `unknown[]` porque `field.state.meta.errors` de TanStack Form puede traer cualquier cosa que devuelva un validador; el `filter(Boolean).map(String)` descarta vacíos y convierte a texto; el `Set` evita mostrar el mismo mensaje dos veces (puede venir de `onChange` y de `onBlur`). `htmlFor` conecta label e input (accesibilidad: click en el label enfoca el input). **Usado por:** todos los formularios.

**Alternativa descartada:** tipar `errores: string[]` (el tipo real de TanStack Form no lo garantiza; hubiera obligado a un cast).

**Si te preguntan en el parcial:** "FormField concentra label, ayuda y errores. Recibo los errores como `unknown[]` porque así los tipa TanStack Form, y los normalizo y deduplico antes de mostrarlos."

---

### `FormActions({ onCancel, canSubmit, isSubmitting, textoEnviar })` — `src/shared/ui/FormActions.tsx`

**Qué hace:** botonera "Cancelar / Guardar" de los modales: Cancelar es `secundario`; Guardar es `type="submit"`, deshabilitado si `!canSubmit` y con spinner si `isSubmitting`.

**Por qué lo planteamos así:** *decisión nuestra:* recibe `canSubmit` e `isSubmitting` **por props** (los entrega `form.Subscribe` de TanStack Form) en lugar de leer el formulario: así `shared/ui` no depende de la librería de formularios y se re-renderiza solo cuando cambian esos dos valores. **Usado por:** `CategoriaFormModal`, `ProductoFormModal`, `StockModal`.

**Alternativa descartada:** que el componente use el contexto del formulario directamente (lo acopla a TanStack Form).

**Si te preguntan en el parcial:** "Los estados `canSubmit` e `isSubmitting` los recibe por props desde `form.Subscribe`, así es presentacional y reutilizable en todos los modales."

---

## 3. `shared/components/`

### `DataTable<T>({ data, columns, placeholderBusqueda, porPagina, getRowId })` — `src/shared/components/DataTable.tsx`

**Qué hace:** tabla genérica con **orden por columna, búsqueda global y paginación del lado del cliente** sobre TanStack Table. Mantiene su propio estado (`sorting`, `globalFilter`, `pagination`) y renderiza buscador, encabezados con botón de orden, filas, estado "sin resultados" y controles Anterior/Siguiente.

```ts
interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  placeholderBusqueda?: string;
  porPagina?: number;            // default 10
  getRowId?: (fila: T) => string;
}
function DataTable<T>({ data, columns, ... }: DataTableProps<T>)
```

```ts
const table = useReactTable({
  data, columns,
  state: { sorting, globalFilter, pagination },
  onSortingChange: setSorting, onGlobalFilterChange: setGlobalFilter, onPaginationChange: setPagination,
  getRowId,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
});
```

**Por qué lo planteamos así:**
- *Lo exige la consigna (pág. 20):* "ABM admin: TanStack Table con paginación del lado del cliente (el panel pide limit=100)"; usuarios también con TanStack Table. Por eso **todas** las tablas admin usan este componente y paginan en memoria; el catálogo y "Mis pedidos" paginan en el servidor con `Paginacion`.
- **Por qué el componente es dueño de su `table` y de su estado:** el orden, el texto de búsqueda y la página son estado de **presentación**; a ninguna página le interesa. Si cada página lo manejara, repetiríamos 30 líneas idénticas por pantalla. Encapsularlo deja a las páginas con una sola línea: `<DataTable data={categorias} columns={columnas} />`. El estado se declara explícito (controlado con `state` + `on...Change`) porque queremos mostrar `pagination.pageIndex` y `globalFilter` en el pie y en el mensaje de "sin resultados"; TanStack Table también podría llevarlo internamente.
- **Tipado genérico sin `any`:** `T` es el tipo de fila, parámetro de tipo del **componente**. Con `<DataTable data={categorias} columns={columnas} />` TypeScript infiere `T = Categoria` desde `data` y exige `columns: ColumnDef<Categoria>[]`: si pasás columnas de `Producto` con datos de `Categoria`, no compila. Un solo componente sirve para categorías, productos, usuarios y pedidos, con tipado completo en cada uso. (En un `.tsx`, `function DataTable<T>(...)` es válido; con una *arrow function* habría que escribir `<T,>` para que el parser no confunda `<T>` con una etiqueta JSX; por eso usamos `function`.)
- **Los `get...RowModel` son "motores" opcionales:** sin `getSortedRowModel` no hay orden; sin `getFilteredRowModel` no hay búsqueda; sin `getPaginationRowModel` no hay páginas. Cada uno es una capa que transforma las filas, y se paga solo por lo que se activa.
- **`getRowId`:** da un id estable por fila (por ejemplo `String(c.id)`) en vez del índice; React identifica bien las filas al reordenar o filtrar.
- **Accesibilidad:** `aria-sort` en la columna ordenada, `aria-label` en el buscador, el orden es un `<button>` real.
- `meta?.className`: cada columna puede declarar `meta: { className: 'text-right' }` (tipado por *module augmentation*, ver `shared/types/tanstack-table.ts` abajo).
- Cuidado conocido de TanStack Table: `data` y `columns` conviene que sean referencias estables entre renders (no armarlas inline en cada render) para evitar recálculos innecesarios.

**Alternativa descartada:** una `<table>` a mano por pantalla con `.sort()`/`.filter()`/`.slice()` (reimplementa mal lo que la librería hace; la consigna además pide TanStack Table); un componente con `data: any[]` (pierde el chequeo de tipos); paginar en el servidor también el admin (la consigna fija `limit=100` y paginación del cliente; para un panel con pocos registros es más simple y permite ordenar/buscar sobre todo el conjunto sin nuevas requests).

**Si te preguntan en el parcial:** "DataTable es genérica: el tipo de fila es un parámetro `T`, así TypeScript valida que las columnas correspondan a los datos sin usar `any`. Es dueña de su estado de orden, búsqueda y página porque eso es presentación; la consigna pide paginar en el cliente en el panel porque se piden hasta 100 registros."

*Usado por:* `AdminCategoriasPage`, `AdminProductosPage`, `AdminUsuariosPage`, `TablaPedidos`.

---

### `Paginacion({ pagina, total, porPagina, onCambiar, deshabilitado })` — `src/shared/components/Paginacion.tsx`

**Qué hace:** controles de paginación **del servidor**. Calcula `totalPaginas = Math.max(Math.ceil(total / porPagina), 1)`, el rango "Mostrando desde–hasta de total" y deshabilita Anterior en la página 0 y Siguiente en la última (`pagina + 1 >= totalPaginas`). `pagina` es base 0.

**Por qué lo planteamos así:**
- *Lo exige la consigna (pág. 18 y 19):* `Paginacion` en `shared/components`, y el catálogo es "Lista paginada en el servidor (skip = página × limit)". El backend devuelve `{ total, items }` (`ProductosPaginados`, `PedidosPaginados`), que es justo lo que necesita (`total`).
- *Decisión nuestra:* el componente **no sabe nada de `skip`**; recibe `pagina` y avisa con `onCambiar`. El padre traduce `skip = pagina × limit`. Así el componente no está atado a la API. `Math.max(..., 1)` evita "Página 1 de 0" cuando no hay registros. `deshabilitado` se usa mientras llega la página siguiente (`isPlaceholderData` de Query) para impedir clicks repetidos.

**Alternativa descartada:** paginar en el cliente el catálogo (descargaría todo el catálogo, no escala); pasarle `skip` al componente (lo acopla a la forma de paginar del backend).

**Si te preguntan en el parcial:** "Paginacion trabaja con número de página y total; el padre calcula `skip = página × limit`. Así el componente es presentacional y no sabe cómo pagina el backend."

*Usado por:* `CatalogoPage`, `MisPedidosPage`.

---

### `Skeleton`, `SkeletonGrid({ cantidad })`, `SkeletonFilas({ filas })` — `src/shared/components/Skeleton.tsx`

**Qué hace:** `Skeleton` es un bloque gris con `animate-pulse` (`aria-hidden`). `SkeletonGrid` dibuja N tarjetas fantasma con la forma de `ProductoCard`; `SkeletonFilas` dibuja N filas para listados. Ambas tienen `role="status"` y `aria-label="Cargando"`.

**Por qué lo planteamos así:** *lo exige la consigna (pág. 18 y 19):* "Skeleton" en `shared/components` y "skeleton mientras carga" en el catálogo. *Decisión nuestra:* un skeleton con la **misma forma** que el contenido real reserva el espacio y evita el salto de layout (CLS); además se siente más rápido que un spinner. Se muestra mientras `isPending`. **Usado por:** Catálogo (`SkeletonGrid`), listados admin y Mis pedidos (`SkeletonFilas`), `AdminResumenPage` (`Skeleton` suelto).

**Alternativa descartada:** spinner genérico (no da idea de la forma del contenido, el layout salta al llegar los datos) o pantalla en blanco.

**Si te preguntan en el parcial:** "Uso skeletons con la forma del contenido para reservar el espacio y que no salte el layout; se muestran mientras la query está en `isPending`."

---

### `EstadoVacio({ titulo, mensaje, icono, accion })` — `src/shared/components/EstadoVacio.tsx`

**Qué hace:** pantalla de "no hay nada" con ícono decorativo (`aria-hidden`), título, mensaje opcional y un slot `accion: ReactNode` (por ejemplo un `<Link>` al catálogo).

**Por qué lo planteamos así:** *lo exige la consigna (pág. 18 y 19):* "EstadoVacio" y "estado vacío" en el catálogo. *Decisión nuestra:* el slot `accion` como `ReactNode` en vez de props `textoBoton`/`onClick` para que cada caso ponga lo que necesite (un Link, un botón) sin que el componente conozca el router. Un estado vacío es un resultado válido, no un error, por eso es un componente distinto a `EstadoError`. **Usado por:** casi todas las listas, carrito/checkout vacíos y `UnauthorizedPage`.

**Alternativa descartada:** no mostrar nada cuando la lista está vacía (el usuario no sabe si está cargando, rota o vacía).

**Si te preguntan en el parcial:** "Separé el estado vacío del error porque son situaciones distintas; el slot `accion` me deja ofrecer un próximo paso sin acoplar el componente al router."

---

### `EstadoError({ titulo, mensaje, onRetry })` — `src/shared/components/EstadoError.tsx`

**Qué hace:** caja roja con `role="alert"`; si recibe `onRetry` agrega el botón "Reintentar".

**Por qué lo planteamos así:** *lo exige la consigna (pág. 18).* *Decisión nuestra:* es el error de una **consulta** (no de una mutación). `onRetry` es opcional y en las páginas se pasa `() => void refetch()`, para que el usuario pueda reintentar una consulta que falló (recordá que Query no reintenta los 4xx). **Usado por:** todas las páginas con `useQuery`.

**Alternativa descartada:** dejar la pantalla vacía o con un `console.error` (el usuario no se entera); reintentar automáticamente siempre (ya lo limita `queryClient`).

**Si te preguntan en el parcial:** "Muestra el error de una consulta con un botón opcional de reintentar que llama a `refetch`."

---

### `Cargando({ mensaje })` — `src/shared/components/Cargando.tsx`

**Qué hace:** spinner con `role="status"` y un mensaje (por defecto "Cargando…").

**Por qué lo planteamos así:** *lo exige la consigna indirectamente* (pág. 20: `ProtectedRoute` "muestra un indicador mientras checkSession confirma la sesión"). *Decisión nuestra:* acá usamos spinner y no skeleton porque no hay un "contenido con forma" que anticipar: lo que se está decidiendo es si se muestra la pantalla o se redirige. **Único uso:** `ProtectedRoute`.

**Alternativa descartada:** devolver `null` mientras carga (pantalla en blanco sin feedback).

**Si te preguntan en el parcial:** "Es el indicador que muestra ProtectedRoute mientras se verifica la sesión; uso spinner y no skeleton porque no hay contenido que anticipar."

---

### `ConfirmModal({ isOpen, titulo, mensaje, textoConfirmar, peligroso, procesando, error, onConfirm, onClose })` — `src/shared/components/ConfirmModal.tsx`

**Qué hace:** diálogo de confirmación basado en `Modal` con mensaje, botón "Volver" y botón de confirmar (`peligro` o `primario` según `peligroso`, con `cargando={procesando}`). Muestra `error` adentro con `AlertaError`.

**Por qué lo planteamos así:** *decisión nuestra:* reemplaza a `window.confirm` con un diálogo accesible y con estilo. Lo clave es `error`: **si la mutación falla el modal queda abierto mostrando el motivo**, en vez de cerrarse y esconder el problema (por ejemplo "no se puede borrar una categoría con productos"). `procesando` deshabilita "Volver" y pone el botón en carga para evitar doble envío. Es un componente compartido porque eliminar categoría/producto, vaciar carrito y cancelar pedido (cliente y admin) necesitan lo mismo.

**Alternativa descartada:** `window.confirm()` (bloquea el hilo, no se puede estilar ni mostrar un error del servidor, y no es accesible de forma consistente).

**Si te preguntan en el parcial:** "Lo hice componente porque `window.confirm` no puede mostrar el error del servidor; así, si la mutación falla, el modal sigue abierto con el motivo."

---

### `PageHeader({ titulo, descripcion, acciones })` — `src/shared/components/PageHeader.tsx`

**Qué hace:** `<h1>` + descripción opcional + slot `acciones: ReactNode` a la derecha.

**Por qué lo planteamos así:** *decisión nuestra:* cabecera uniforme en todas las pantallas, con un único `<h1>` por página (buena práctica de accesibilidad y SEO). El slot `acciones` permite poner botones como "Nueva categoría" sin que el componente los conozca.

**Alternativa descartada:** armar el título a mano en cada página (inconsistencias de tamaño y márgenes).

**Si te preguntan en el parcial:** "Es un componente de presentación para que todas las pantallas tengan la misma cabecera, con un slot para acciones."

---

### `RowActions({ onEdit, onDelete, children })` — `src/shared/components/RowActions.tsx`

**Qué hace:** botones "Editar" y "Eliminar" de una fila, con `children` en el medio para acciones extra (en productos, "Stock").

**Por qué lo planteamos así:** *decisión nuestra:* categorías y productos comparten el mismo par de acciones y su estilo. Recibe callbacks (`onEdit`, `onDelete`) y no sabe qué se edita ni qué se elimina: la fila decide. Nota: los botones llevan `type="button"` explícito. **Usado por:** `columnasCategorias`, `columnasProductos`.

**Alternativa descartada:** repetir los dos botones en cada definición de columnas.

**Si te preguntan en el parcial:** "Es un componente de presentación con callbacks; el `children` me permite agregar acciones propias de cada entidad sin duplicar Editar/Eliminar."

---

## 4. `shared/layout/`

### `MainLayout()` — `src/shared/layout/MainLayout.tsx`

**Qué hace:** `<div min-h-screen><Navbar /><main max-w-6xl><Outlet /></main></div>`.

**Por qué lo planteamos así:** *lo exige la consigna (pág. 18):* "MainLayout reúne la Navbar y el contenido de la ruta". Se declara como **layout route** de React Router (`<Route element={<MainLayout />}>` sin `path`): todas las rutas hijas se dibujan en su `<Outlet />`. El Navbar aparece en todas las pantallas sin repetirlo, y el ancho máximo del contenido se define en un único lugar.

**Alternativa descartada:** incluir `<Navbar />` dentro de cada página (repetido y se desmonta/monta en cada navegación).

**Si te preguntan en el parcial:** "MainLayout es una ruta de layout: aloja el Navbar una sola vez y las páginas se renderizan en su Outlet."

---

### `Navbar()` — `src/shared/layout/Navbar.tsx`

**Qué hace:** barra superior que lee `usuario`, `logout` (de `authStore`) y `cantidadItems()` (de `cartStore`). Siempre muestra Catálogo y Carrito (con badge si hay ítems); "Mis pedidos" solo con sesión. Sin sesión: "Ingresar" y "Registrarse". Con sesión: nombre completo, `@username · Cliente|Administrador` (`ETIQUETA_ROL`) y "Cerrar sesión". Si `usuario?.role === 'admin'`, una segunda barra "Panel admin" con `enlacesAdmin`.

**Por qué lo planteamos así:**
- *Lo exige la consigna (pág. 18):* "Navbar con nombre y rol, «Cerrar sesión» y acceso al panel solo para admin". Y el logout: "Llama a POST /auth/logout, limpia el authStore y redirige a /login".
- **`cerrarSesion`:** `await logout()` y, en `finally`, `navigate('/login', { replace: true })`. El `try/finally` garantiza que se navegue aunque el POST falle (el store ya limpió la sesión en su propio `finally`). Acá **sí** usamos `useNavigate` porque el Navbar es un componente. `replace` evita que "Atrás" vuelva a una pantalla de sesión cerrada.
- **El panel admin solo se muestra al admin:** es UX; el comentario del código lo aclara: *"la protección real está en el backend"*. Ocultar un link no impide que alguien tipee la URL (para eso están `ProtectedRoute` y `require_role`).
- **`useCartStore((s) => s.cantidadItems())`:** el selector llama a la función derivada y devuelve un `number`; solo re-renderiza cuando ese número cambia (no con cada cambio del carrito).
- **`NavLink` con `className` como función `({ isActive })`** resalta la ruta actual; en Catálogo se usa `end` para que `/` no quede "activo" en todas las rutas.
- `cargando` (local `cerrando`) en el botón: evita doble clic mientras se cierra la sesión.

**Alternativa descartada:** decidir en el Navbar con `localStorage.getItem('token')` (no existe token en JS); mostrar siempre todos los links y confiar en el redirect (peor UX: el cliente vería un panel que no puede usar).

**Si te preguntan en el parcial:** "El Navbar lee la sesión y el carrito de los stores con selectores. Muestro el panel solo al admin por UX, pero la seguridad real es `require_role` en el backend. El logout navega en un `finally` para salir al login aunque falle la request."

---

## 5. `shared/hooks/useDebounce.ts`

### `useDebounce<T>(valor: T, demora = 300): T` — `src/shared/hooks/useDebounce.ts`

**Qué hace:** devuelve `valor` recién cuando dejó de cambiar durante `demora` ms. Cada vez que `valor` cambia se programa un `setTimeout`; si cambia de nuevo antes de que venza, la **función de limpieza** del efecto lo cancela (`clearTimeout`). Solo el último timer sobrevive.

```ts
export function useDebounce<T>(valor: T, demora = 300): T {
  const [demorado, setDemorado] = useState(valor);
  useEffect(() => {
    const id = window.setTimeout(() => setDemorado(valor), demora);
    return () => window.clearTimeout(id);
  }, [valor, demora]);
  return demorado;
}
```

**Por qué lo planteamos así:**
- *Problema:* en un buscador cada tecla cambia el estado; si ese estado es parte del `queryKey`, cada tecla dispara un request ("h", "ha", "ham", "hamb"...). Hace falta esperar a que el usuario deje de tipear.
- *Decisión nuestra* (la consigna pide búsqueda en el catálogo, pág. 19, pero no define cómo): el hook devuelve el valor "demorado" y es ese el que va al `queryKey`. El input sigue respondiendo al instante (usa el valor sin demora) y la **consulta** usa el valor con demora.
- **Es un `useEffect` permitido:** **no hace fetch**, solo retrasa un valor local con un timer (sincronizar con `setTimeout`, un sistema externo); la consulta la sigue haciendo TanStack Query. La consigna prohíbe traer datos con `useEffect`, no esto.
- **La función de limpieza** es lo esencial: sin ella, cada tecla dejaría un timer vivo y se actualizaría con valores viejos.
- Es genérico (`<T>`): sirve para strings, números, etc. `useState(valor)` como inicial evita un primer render con valor vacío.
- 300 ms es un compromiso: menos se siente pegado a cada tecla; más se siente lento.

**Alternativa descartada:** filtrar con cada `onChange` (un request por tecla, y respuestas desordenadas); hacer el debounce con una librería como lodash (una dependencia entera para 10 líneas); *throttle* (limita la frecuencia, pero seguiría pidiendo resultados intermedios que no interesan).

**Si te preguntan en el parcial:** "Es un debounce: devuelve el valor después de que el usuario deja de tipear 300 ms, para no disparar un request por tecla. El useEffect solo maneja un timer, no trae datos, y la limpieza cancela el timer anterior."

*Usado por:* `CatalogoPage` (`useDebounce(busqueda.trim(), 300)`).

---

## 6. `shared/utils/`

### `formatoPrecio` y `formatearFecha(iso: string): string` — `src/shared/utils/formato.ts`

**Qué hace:**
- `formatoPrecio = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`; se usa como `formatoPrecio.format(1500)`.
- `formatearFecha(iso)`: parsea el ISO que manda el backend y lo formatea `dateStyle/timeStyle: 'short'` en `es-AR`. Si la fecha es inválida (`Number.isNaN(fecha.getTime())`) devuelve el string original.

**Por qué lo planteamos así:** *decisión nuestra:* `Intl` es la API estándar del navegador para formatos localizados (separador de miles, símbolo `$`), sin dependencias. Los formateadores se crean **una vez a nivel de módulo** porque instanciar `Intl.*` es relativamente caro y no tiene sentido repetirlo en cada render. El backend envía las fechas en ISO; el front las presenta en formato local. Devolver el original ante una fecha inválida evita mostrar "Invalid Date" o romper la pantalla.

**Alternativa descartada:** `` `$${precio.toFixed(2)}` `` (no localiza, no separa miles); `moment`/`date-fns` (dependencias para algo que el navegador ya trae).

**Si te preguntan en el parcial:** "Uso `Intl` del navegador, instanciado una sola vez fuera del componente porque es costoso, y si la fecha no parsea devuelvo el texto original para no romper la UI."

*Usado por:* `ProductoCard`, `columnasProductos`, `CarritoPage`, `CheckoutPage`, `PedidoDetalle`, `TablaPedidos`, `TarjetaPedido`, `columnasUsuarios`, `AdminResumenPage`, `ItemCarritoFila`.

---

### `validaciones.ts` — `src/shared/utils/validaciones.ts`

**Qué hace:** validadores **reutilizables** para `form.Field` de TanStack Form. Un validador es una función `({ value }) => string | undefined`: devuelve el mensaje de error o `undefined` si está bien. Tipo: `type Validador<T> = ({ value }: { value: T }) => string | undefined`.

| Export | Firma | Qué valida | Por qué así |
|--------|-------|-----------|-------------|
| `requerido(campo)` | `(string) => Validador<string>` | No vacío (con `trim`): `"<campo> es obligatorio"` | `trim` para que "   " no cuente como lleno |
| `longitud(campo, min, max)` | `=> Validador<string>` | Obligatorio y entre `min` y `max` | Espeja los límites del backend |
| `emailValido` | `Validador<string>` | Obligatorio + regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | Regex simple a propósito: validar emails perfectos es imposible; el backend vuelve a validar |
| `passwordValida` | `Validador<string>` | Obligatoria, mínimo 8, máximo 72 | 72 es el límite de bytes de bcrypt |
| `urlOpcional` | `Validador<string>` | Vacío es válido; si hay valor, ≤ 500 y `URL.canParse(url)` | Usa la API nativa en vez de otra regex |
| `numeroNoNegativo(campo, entero = false)` | `=> Validador<number>` | `NaN` = vacío → obligatorio; `< 0` error; si `entero`, `Number.isInteger` | Precio/stock no pueden ser negativos; stock debe ser entero |
| `textoOpcional(valor)` | `(string) => string \| null` | **No es validador**: normaliza texto opcional (`''` → `null`) para el backend | El backend espera `null` en campos opcionales, no `''` |

**Por qué lo planteamos así:**
- *La consigna pide TanStack Form con validación (pág. 17 y 19: "registro con validación")*; la forma de reutilizar los validadores es **decisión nuestra**: funciones puras sueltas en vez de lógica dentro de cada formulario, así se testean y se reusan en login, registro, categorías, productos, stock y checkout.
- **Fábricas (closures):** las que reciben parámetros (`requerido`, `longitud`, `numeroNoNegativo`) son funciones que *devuelven* funciones: `requerido('El usuario')` produce el validador específico con su mensaje. Las fijas (`emailValido`, `passwordValida`, `urlOpcional`) son directamente el validador.
- Los límites (3–50, 2–100, 5–200, 8–72...) **espejan** las restricciones de los schemas Pydantic del backend. Validar en el cliente es solo **UX** (feedback inmediato); el backend siempre vuelve a validar (los 422 los muestra `handleApiError`).

**Alternativa descartada:** un esquema Zod/Yup (dependencia extra que la consigna no pide), o validar solo al enviar (el usuario se entera tarde).

**Si te preguntan en el parcial:** "Los validadores son funciones puras `({value}) => mensaje | undefined`, reutilizables en todos los formularios. Los que llevan parámetros son fábricas. Validar en el front es UX; la validación real está en el backend."

*Usado por:* `LoginPage`, `RegisterPage`, `CategoriaFormModal`, `ProductoFormModal`, `StockModal`, `CheckoutForm`.

---

## 7. `shared/types/tanstack-table.ts`

### Module augmentation de `ColumnMeta` — `src/shared/types/tanstack-table.ts`

```ts
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> { className?: string; }
}
```

**Qué hace:** le agrega el campo opcional `className` a `ColumnMeta` para que `meta: { className: '...' }` en las columnas y `header.column.columnDef.meta?.className` en `DataTable` estén **tipados**.

**Por qué lo planteamos así:** *decisión nuestra:* sin esto, `meta` es un tipo genérico sin campos y habría que usar `any` o un cast. La *declaration merging* de TypeScript permite **extender** la interfaz de la librería sin tocar su código. `TData` y `TValue` deben coincidir con la declaración original para poder fusionarla (aunque no se usen). Es lo que permite que las columnas alineen a la derecha ("Precio", acciones) sin que `DataTable` conozca cada tabla.

**Alternativa descartada:** `meta: { className } as any` (rompe el "TypeScript strict sin any") o pasar una prop `alineaciones` aparte a `DataTable` (duplica información que pertenece a la columna). Explicado a fondo en `06-typescript-y-calidad.md`.

**Si te preguntan en el parcial:** "Con module augmentation extiendo el tipo `ColumnMeta` de TanStack Table para poder poner `className` por columna con tipado, sin usar `any`."
