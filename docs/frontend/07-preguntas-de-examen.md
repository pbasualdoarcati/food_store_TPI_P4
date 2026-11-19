# 07 - Preguntas de examen oral (con respuestas modelo)

Tip: contestá en tres tiempos: **definición**, **por qué importa**, **dónde está en tu código**. Si no sabés algo, razoná en voz alta desde el problema que resuelve.

---

## A. Arquitectura y organización

**1. ¿Cómo está organizado el frontend y por qué?**
Por features (dominios): `auth`, `categorias`, `productos`, `usuarios`, `pedidos`, cada una con `pages/`, `components/`, `hooks/`, `api/` y `types/`. Lo transversal va en `shared/`, el estado global del cliente en `store/` y las rutas en `routes/`. Es cohesión: para tocar pedidos abro una sola carpeta, y espeja los módulos del backend.

**2. ¿Por qué por dominio y no por tipo (carpeta `components/` con todo)?**
Por tipo escala mal: un cambio en "pedidos" te obliga a tocar cinco carpetas y nada indica a qué dominio pertenece cada archivo. Por dominio, el código que cambia junto vive junto; borrar una feature es borrar una carpeta.

**3. ¿Qué va en `shared/` y qué NO?**
Va lo reutilizable sin lógica de negocio: `axiosInstance`, `handleApiError`, `queryClient`, UI base (`Button`, `Modal`...), componentes de estado (`Skeleton`, `EstadoVacio`, `EstadoError`, `Paginacion`, `DataTable`), `Navbar`/`MainLayout`, `useDebounce`, validadores y formato. No va lo que conoce un dominio (por ejemplo `ProductoCard`, que vive en `features/productos`). Reconozco que hay pocos acoplamientos pragmáticos (ej. `BadgeEstado` importa el tipo `EstadoPedido`).

**4. ¿Por qué `store/` y `routes/` están fuera de las features?**
Porque son transversales: la sesión la usan el Navbar, `ProtectedRoute`, el interceptor y varias páginas; el carrito, el catálogo (`ProductoCard`), el Navbar, la página del carrito y el checkout. Si vivieran en una feature, las demás importarían de adentro de ella.

**5. ¿Qué es una página y qué un componente en tu proyecto?**
La página (`pages/`) compone la pantalla de una ruta: obtiene datos con hooks, maneja el estado de UI (modales, página actual) y los pasa a componentes. Los componentes (`components/`) son piezas con props tipadas, mayormente presentacionales (`FiltrosCatalogo`, `ItemCarritoFila`). Es el patrón container-presentational: la página es el contenedor.

---

## B. Estado del servidor vs estado del cliente

**6. ¿Qué diferencia hay entre estado del servidor y del cliente?**
Del servidor: datos que viven en la base y el front solo copia (catálogo, pedidos, usuarios); son asincrónicos, compartidos y pueden quedar desactualizados. Del cliente: datos que solo existen en el navegador (el carrito, la sesión). Los primeros los maneja TanStack Query; los segundos, Zustand.

**7. ¿Por qué TanStack Query y no `useEffect + fetch + useState`?**
Porque con `useEffect` tendría que reimplementar a mano loading/error, caché, deduplicación, reintentos, invalidación y evitar condiciones de carrera (una respuesta vieja que llega después de la nueva). Query lo resuelve declarativamente: `useQuery({ queryKey, queryFn })`. Además la consigna prohíbe el `fetch` en `useEffect`; la única excepción es `checkSession`.

**8. ¿Por qué el carrito no usa TanStack Query?**
Porque el carrito no es del servidor: el backend no lo conoce hasta que se hace `POST /pedidos`. No hay endpoint que consultar ni nada que invalidar. Es estado local persistido → Zustand + `persist`.

**9. Si el usuario viene del servidor (`/auth/me`), ¿por qué está en Zustand y no en Query?**
Porque es estado global de sesión que muchos componentes necesitan, lo escribe el cliente (`login`, `logout`, `limpiarSesion`) y lo tiene que tocar el interceptor de Axios, que está fuera de React: con Zustand puedo hacer `useAuthStore.getState()` desde cualquier archivo. También lo pide la consigna.

**10. ¿Qué hace `queryClient` y por qué lo exportás como instancia única?**
Es el objeto que guarda la caché. Lo configuro con `staleTime: 30_000`, `refetchOnWindowFocus: false` y un `retry` que no reintenta 4xx. Es una instancia única porque `main.tsx` se la pasa a `QueryClientProvider` y además `authStore` y el interceptor necesitan `queryClient.clear()` fuera de React.

**11. ¿Qué es `staleTime` y qué significa "stale"?**
`stale` es "desactualizado". Con `staleTime: 30_000`, durante 30 s el dato se considera fresco y Query no lo vuelve a pedir al montar otro componente que lo use. Pasado ese tiempo se considera stale y se refetchea en el próximo uso. Una invalidación lo marca stale al instante.

**12. ¿Por qué el `retry` no reintenta los 4xx?**
Porque un 400/401/404/409 es una respuesta válida del servidor que no cambia por reintentar; solo tiene sentido reintentar fallas de red o 5xx. Está en `shared/api/queryClient.ts` (máx. 2 reintentos). Las mutaciones no se reintentan por defecto: repetir un `POST /pedidos` podría duplicar el pedido.

---

## C. TanStack Query en detalle

**13. ¿Qué es una `queryKey` y cómo la diseñaste?**
Es la "dirección" del dato en la caché: un array. Uso jerarquías: `['productos', filtros]`, `['pedidos', 'lista', filtros]`, `['pedidos', 'resumen']`. Todo lo que influye en lo que pido tiene que estar en la key; si cambia, es otra entrada y Query dispara un nuevo fetch solo, sin `useEffect`.

**14. ¿Por qué `['pedidos', 'resumen']` y no `['resumen']`?**
Para invalidar por prefijo: `invalidateQueries({ queryKey: ['pedidos'] })` marca como desactualizadas todas las listas y el resumen con una sola llamada. Con una raíz aparte tendría que acordarme de invalidar el resumen por separado.

**15. ¿Qué es `invalidateQueries` y cuándo lo usás?**
Marca queries como stale y refetchea las que están activas (montadas). Lo uso en el `onSuccess` de cada mutación: después de crear/editar/borrar, la lista se refresca desde el servidor. Ejemplo: `useActivarUsuario` invalida `['usuarios']`.

**16. ¿Por qué crear un pedido invalida también `productos`?**
Porque crear un pedido descuenta stock y cancelarlo lo restituye; el catálogo cacheado quedó con stock viejo. Está centralizado en `useInvalidarPedidos` (`features/pedidos/hooks`), que invalida `PEDIDOS_KEY` y `PRODUCTOS_KEY`.

**17. ¿Por qué al editar una categoría invalidás `['productos']`?**
Porque `ProductoRead` trae la categoría embebida (`producto.categoria.nombre`). Si renombro la categoría, los productos cacheados mostrarían el nombre viejo. Está en `useInvalidarCategorias`.

**18. ¿Qué diferencia hay entre `useQuery` y `useMutation`?**
`useQuery` es para **leer** (GET): se ejecuta solo, cachea y es reactivo a la key. `useMutation` es para **escribir** (POST/PUT/PATCH/DELETE): se dispara a demanda con `mutate`/`mutateAsync`, no cachea; expone `isPending`, `isError`, `error`, `variables`, `reset`; y tiene callbacks como `onSuccess`.

**19. ¿`mutate` o `mutateAsync`?**
`mutate` no devuelve nada útil (callbacks) y no lanza; `mutateAsync` devuelve una Promise que rechaza si falla. Uso `mutateAsync` en formularios porque necesito `await` y un `try/catch` para navegar o cerrar el modal solo si salió bien (por ejemplo `CheckoutPage.confirmar`). Uso `mutate` con `{ onSuccess }` para acciones simples como confirmar eliminación.

**20. ¿Qué es `keepPreviousData` / `placeholderData` y por qué lo usás?**
Cuando cambia la key (otra página), por defecto `data` queda `undefined` mientras carga y se vería el skeleton en cada click. Con `placeholderData: keepPreviousData` se sigue mostrando la página anterior hasta que llega la nueva, y `isPlaceholderData` vale `true` para atenuar la grilla y deshabilitar la paginación. Está en `useProductos` y `usePedidos`.

**21. ¿Diferencia entre `isPending`, `isLoading` y `isFetching`?**
`isPending`: todavía no hay datos (primera carga). `isFetching`: hay una request en curso, aunque ya existan datos (refetch). `isLoading` = `isFetching && isPending`. En el resumen admin uso `isFetching` para el spinner del botón "Actualizar" porque ya hay datos y se están re-pidiendo.

**22. ¿Cómo implementaste el estado de carga/vacío/error?**
Con una cadena de ternarios en cada página: `isPending` → skeleton (`SkeletonGrid`/`SkeletonFilas`), `isError` → `EstadoError` con `handleApiError(error)` y "Reintentar" (`refetch`), lista vacía → `EstadoVacio`, y si no, los datos. Ese orden además permite que TypeScript sepa que `data` está definido en la última rama.

**23. ¿Por qué los ids y no el objeto en el estado del modal de detalle?**
Guardo `idDetalle` y derivo `data.items.find(...)`. Así el modal siempre muestra la versión más fresca de la caché; si guardara el objeto, quedaría una copia congelada que no se actualiza tras un refetch (`MisPedidosPage`, `AdminPedidosPage`).

---

## D. Zustand y persistencia

**24. ¿Qué es Zustand y qué ventajas tiene frente a Context o Redux?**
Un store global mínimo: `create` devuelve un hook con selectores. No necesita Provider, casi no tiene boilerplate, y permite leer/escribir fuera de React con `getState()`. Con Context, cualquier cambio re-renderiza a todos los consumidores; Zustand con selector re-renderiza solo si cambia el trozo elegido.

**25. ¿Qué hace `persist` y qué es `partialize`?**
`persist` guarda el estado en `localStorage` y lo rehidrata al recargar. `partialize` elige qué parte se guarda. En `authStore` guardo solo `usuario` (no `cargando` ni funciones, y por supuesto no el token); en `cartStore`, solo `items`.

**26. ¿Por qué `authStore` persiste solo `usuario` y `cargando` empieza en `true`?**
`cargando` no se debe persistir: al recargar todavía no sé si la sesión sigue vigente, así que debe arrancar en `true` hasta que `checkSession` responda. Mientras tanto `ProtectedRoute` muestra un spinner en vez de redirigir al login por error.

**27. Si persistís `usuario` en `localStorage`, ¿no es inseguro?**
No: `usuario` son datos públicos (nombre, rol). La autenticación real es la cookie HttpOnly. Si alguien edita el `localStorage` y se pone `role: 'admin'`, solo vería botones de admin: el backend valida cada request con `require_role` (403), y además `checkSession` sobrescribe `usuario` con lo que responde `/auth/me` al cargar. Se persiste solo por UX (que el Navbar no parpadee).

**28. ¿Qué hace `checkSession` y dónde se llama?**
Hace `GET /auth/me`: si responde, guarda el usuario; si falla (401 sin cookie o vencida, 400 cuenta desactivada), deja `usuario: null`; en `finally` pone `cargando: false`. Se llama una sola vez al montar la app, en el `useEffect` de `App.tsx`. Es la única llamada a la API en un `useEffect`.

**29. ¿Por qué ese `useEffect` está permitido si dijiste que no se hace fetch en effects?**
Porque no es "traer datos para una pantalla" (eso es Query), sino sincronizar el estado global de sesión al arrancar la app. La consigna lo exceptúa explícitamente. Además es una operación de una sola vez que no depende de props ni de filtros.

**30. ¿Cómo acceden al store fuera de un componente?**
Con `useAuthStore.getState()`. Lo usa el interceptor de Axios: `useAuthStore.getState().limpiarSesion()`. Un interceptor no es un componente, no puede usar hooks.

**31. ¿Por qué `total()` y `cantidadItems()` son funciones y no valores guardados?**
Son estado derivado de `items`. Si los guardara, tendría que sincronizarlos en cada acción (fuente de bugs). Como funciones con `get()` siempre son consistentes. Se usan con un selector: `useCartStore((s) => s.total())`, que devuelve un número.

**32. ¿Por qué el store hace `[...state.items, nuevo]` y no `push`?**
Inmutabilidad: React y Zustand detectan cambios por referencia. Mutar el array existente no dispara el re-render; devolver uno nuevo (`map`, `filter`, spread) sí.

**33. ¿Qué pasa con el carrito al hacer logout?**
Se vacía. `logout` limpia `usuario`, descarta la caché de Query con `queryClient.clear()` y llama a `useCartStore.getState().vaciar()`. Como `cartStore` persiste en `localStorage`, sin ese paso el próximo usuario del mismo navegador heredaría el carrito. Se usa `getState()` porque `logout` no es un componente y no puede llamar hooks.

---

## E. Seguridad, cookies y Axios

**34. ¿Por qué cookie HttpOnly y no `localStorage` para el JWT?**
Porque `localStorage` es legible por cualquier JavaScript de la página: un XSS puede robar el token. Una cookie HttpOnly no es accesible desde JS (`document.cookie` no la muestra), el navegador la adjunta sola. Por eso mi `authStore` nunca ve el token. La consigna penaliza guardar el token en localStorage.

**35. ¿Qué hace `withCredentials: true` y qué necesita el backend?**
Le dice al navegador que, en requests cross-origin (5173 → 8000), envíe cookies y acepte `Set-Cookie`. El backend tiene que tener CORS con `allow_credentials=True` y un `allow_origins` explícito (`FRONTEND_ORIGIN`), no `*`. Sin eso la cookie se descarta y `/auth/me` da 401.

**36. ¿Qué es CORS y por qué `localhost:5173` y `:8000` son cross-origin pero la cookie `SameSite=Lax` viaja?**
Origen = esquema + host + puerto, así que son orígenes distintos (CORS aplica). "Site" para SameSite = esquema + dominio registrable; el puerto no cuenta, entonces es same-site y la cookie Lax se envía.

**37. ¿Cómo funciona el interceptor de Axios?**
Es un interceptor de respuesta. Si falla con 401 (en rutas distintas de `/auth/token` y `/auth/me`) o con 400 y `detail: 'Cuenta de usuario desactivada'`, limpia el `authStore`, vacía la caché y redirige a `/login` (si no estoy ya ahí). Siempre re-rechaza la promesa para que quien llamó se entere.

**38. ¿Por qué `/auth/token` y `/auth/me` están excluidos del interceptor?**
Porque ahí un 401 es una respuesta esperada: en `/auth/token` significa credenciales incorrectas (lo muestra el formulario) y en `/auth/me` significa que todavía no hay sesión (lo maneja `checkSession`). Si el interceptor reaccionara, la pantalla de login se recargaría ante cada contraseña incorrecta.

**39. ¿Por qué el login usa `URLSearchParams`?**
Porque `/auth/token` usa `OAuth2PasswordRequestForm` de FastAPI, que espera `application/x-www-form-urlencoded` (estándar OAuth2), no JSON.

**40. ¿Por qué después de `POST /auth/token` hacés un `GET /auth/me`?**
Porque el login responde solo `{ message }` y deja el token en la cookie; no devuelve el usuario. Para saber quién es y qué rol tiene, le pregunto a `/auth/me`. Eso lo hace `authStore.login`.

**41. ¿`ProtectedRoute` protege los datos?**
No, es una guarda de UX: evita mostrar una pantalla a quien no corresponde. La seguridad real está en el backend (`get_current_user`, `require_role`). Ocultar un botón no reemplaza a `require_role`; un usuario puede llamar a la API directamente, y recibiría 401/403.

**42. Explicá la lógica de `ProtectedRoute` y el orden de las condiciones.**
1) Si `cargando`, spinner (todavía no sé si hay sesión); 2) si no hay `usuario`, `Navigate` a `/login` con `state={{ desde: location.pathname }}`; 3) si hay `roles` y el rol del usuario no está incluido, `Navigate` a `/unauthorized`; 4) si todo pasa, `<Outlet />`. El orden evita redirigir al login a alguien con sesión válida durante la verificación.

**43. ¿Cómo vuelve el usuario a la página que quería después de loguearse?**
`ProtectedRoute` guarda `desde` en el `state` de la navegación; `LoginPage` lo lee con un type guard (`rutaDeOrigen`) y navega ahí con `destinoInicial`. Si no hay `desde`, el admin va a `/admin/resumen` y el cliente a `/`.

---

## F. Formularios y tablas

**44. ¿Cómo funciona TanStack Form en tu proyecto?**
`useForm({ defaultValues, onSubmit })` crea el form (tipos inferidos de los valores iniciales). Cada campo es un `form.Field` con render prop: `field.state.value`, `field.handleChange`, `field.handleBlur`, `field.state.meta.errors`. Los `validators` (`onChange`) devuelven un mensaje o `undefined`. El `<form>` hace `preventDefault` y llama a `form.handleSubmit()`, que valida todo y recién entonces ejecuta `onSubmit`. El botón se suscribe con `form.Subscribe` a `canSubmit`/`isSubmitting`.

**45. ¿Qué es un formulario controlado?**
Uno donde el valor del input lo dicta el estado de React (`value={field.state.value}` + `onChange`), no el DOM. Hay una única fuente de verdad, lo que permite validar, resetear y transformar valores.

**46. ¿Por qué `noValidate` y `preventDefault` en el `<form>`?**
`noValidate` desactiva la validación nativa del navegador para usar mis mensajes en español; `preventDefault` evita el envío HTML tradicional que recargaría la página (es una SPA).

**47. ¿Cómo validaste que las contraseñas coinciden?**
En el campo `confirmacion`, un validador `onChange` compara con `fieldApi.form.getFieldValue('password')`, y `onChangeListenTo: ['password']` hace que se revalide cuando cambia la contraseña (sin eso quedaría un error desactualizado).

**48. ¿Por qué el form de productos usa `NaN` para "vacío"?**
`<input type="number">` entrega `valueAsNumber`, que es `NaN` si está vacío. Uso `NaN` como "sin valor" en el alta y el validador `numeroNoNegativo` lo trata como obligatorio. Así diferencio "vacío" de "0". En el input muestro `''` cuando es `NaN`.

**49. ¿Por qué montás los modales con `key`?**
`useForm` solo lee `defaultValues` al montarse. Con `key={formulario.producto?.id ?? 'nuevo'}` y montando el modal solo cuando está abierto, cada apertura crea un formulario nuevo con los valores del producto correcto (o vacío para el alta).

**50. ¿Cómo está tipado `DataTable` genérico?**
`function DataTable<T>(props: DataTableProps<T>)` con `data: T[]` y `columns: ColumnDef<T>[]`. TypeScript infiere `T` de `data` y exige que las columnas sean del mismo tipo. Un solo componente sirve a categorías, productos, usuarios y pedidos con tipado completo y sin `any`.

**51. ¿Qué hace `useReactTable` y qué son los `get...RowModel`?**
Crea la instancia de la tabla. Cada `get...RowModel` activa una capacidad: `getSortedRowModel` el orden, `getFilteredRowModel` la búsqueda global, `getPaginationRowModel` la paginación. Sin ellos, esa función no existe. Todo ocurre en el cliente, sobre los 100 registros que trae el panel.

**52. ¿Paginación del cliente vs del servidor? ¿Cuándo cada una?**
Servidor (catálogo, mis pedidos): `skip = página × limit`, el backend entrega solo una página y devuelve `total`; escala con muchos datos. Cliente (paneles admin): pido `limit=100` una vez y `DataTable` pagina/ordena/busca en memoria; simple y rápido, con el límite de 100 registros. Es lo que pide la consigna.

**53. ¿Qué es una columna calculada y para qué sirve?**
Una columna con `accessorFn` e `id`. Ej.: en productos `accessorFn: (p) => p.categoria.nombre`, en usuarios `u.disabled ? 'Desactivado' : 'Activo'`. Permite que la búsqueda global y el orden trabajen con el texto visible (si usara el booleano, buscar "activo" no encontraría nada).

**54. ¿Qué es el module augmentation del `meta` de las columnas?**
`ColumnMeta` de TanStack Table es una interfaz vacía. En `shared/types/tanstack-table.ts` reabro el módulo con `declare module '@tanstack/react-table'` y agrego `className?: string` (declaration merging). Así `meta: { className: '...' }` y `columnDef.meta?.className` están tipados sin casts.

**55. ¿Para qué sirve `useDebounce` y por qué no hace el fetch?**
Retrasa un valor local hasta que deja de cambiar durante 300 ms (timer cancelado por la función de limpieza del efecto). Así la `queryKey` cambia una vez por búsqueda terminada y no por tecla. No hace fetch: solo retrasa el valor; el fetch lo hace Query reaccionando a la key.

---

## G. Pedidos y reglas de negocio en la UI

**56. ¿Cómo refleja la UI la máquina de estados?**
`utils/estados.ts` define `TRANSICIONES: Record<EstadoPedido, EstadoPedido[]>` (PENDIENTE → EN_PREPARACION/CANCELADO, EN_PREPARACION → ENTREGADO/CANCELADO, terminales vacíos). `TablaPedidos` recorre `TRANSICIONES[pedido.estado]` y dibuja un botón por destino. Es solo para decidir botones: el backend valida de verdad y responde 400 ante una transición inválida.

**57. ¿Cómo cancela un cliente un pedido? ¿Qué lo restringe?**
El botón "Cancelar" de `TarjetaPedido` solo aparece si `estado === 'PENDIENTE'` y `pedido.usuario_id` es el de la sesión. Llama a `PATCH /pedidos/{id}/cancelar` con `useCancelarPedido` tras un `ConfirmModal`. El backend lo vuelve a exigir (`PedidoAjeno`, `PedidoNoCancelable`) y restituye el stock en la misma transacción.

**58. ¿Por qué el checkout no envía precios?**
Nunca se confía en datos de precio del cliente. Mando `{ producto_id, cantidad }` y el backend usa el precio vigente de la base y lo copia al detalle (RN-05). Por eso el total del checkout dice "estimado".

**59. ¿Qué pasa si el stock no alcanza al confirmar?**
El backend responde 400; `mutateAsync` rechaza, el `catch` impide navegar y vaciar el carrito, y `handleApiError(crearPedido.error)` muestra el motivo sobre el formulario. El cliente puede ajustar el carrito y reintentar. Como el backend es transaccional, no queda nada a medias.

**60. ¿Por qué se navega y se vacía el carrito *después* del éxito?**
Si vaciara antes y el backend fallara, el usuario perdería su carrito. Por eso `navigate(...)` y `vaciar()` están dentro del `try` luego del `await`. Se pasa `pedidoCreado` por `state` para mostrar el banner "Tu pedido #N fue registrado".

**61. ¿Cómo se evita que el admin se desactive a sí mismo en la UI?**
En `columnasUsuarios`, la acción de la fila devuelve `null` si `usuario.id === idSesion` (con `idSesion` de `authStore`). Es UX; el backend lo rechaza igualmente con 400 ("Un administrador no puede desactivarse a sí mismo").

**62. ¿Qué pasa con un usuario desactivado que tiene una sesión abierta?**
Su próxima request recibe 400 con "Cuenta de usuario desactivada". El interceptor lo detecta, limpia el `authStore` y la caché y lo redirige a `/login`.

---

## H. TypeScript y calidad

**63. ¿Cómo garantizás "sin `any`"?**
`strict: true`, `unknown` + type guards en vez de `any`, genéricos (`DataTable<T>`, `api.get<T>`), tipos utilitarios (`Omit`, `Record`) y predicados de tipo (`esEstadoPedido`). Verifiqué con búsqueda: 0 `any`, 0 `@ts-ignore` y 0 casts (`as` solo se usa como `as const`).

**64. ¿Qué es un type guard?**
Una función cuyo retorno es un predicado (`valor is EstadoPedido`) que le indica al compilador que, si devuelve `true`, el valor tiene ese tipo. Reemplaza un cast inseguro. Ej.: `esFormaPago(e.target.value)` antes de `field.handleChange`.

**65. ¿Por qué `Record<EstadoPedido, ...>` y no un objeto cualquiera?**
Porque es exhaustivo: si agrego un estado al tipo, el compilador marca error en cada `Record` (`TRANSICIONES`, `ETIQUETA_ESTADO`, `BadgeEstado`) hasta que lo cubra. No se me olvida ninguno.

**66. ¿Por qué uniones de literales y no `enum`?**
`erasableSyntaxOnly` prohíbe `enum` (genera código JS en runtime). Las uniones de literales se borran al compilar, no cuestan nada y se llevan perfecto con los strings que manda el backend (`'PENDIENTE'`).

**67. ¿Qué hace `verbatimModuleSyntax`?**
Obliga a escribir `import type` para lo que es solo tipo. Deja explícito qué se borra al compilar y evita imports accidentales en runtime.

**68. ¿Para qué sirve `vite-env.d.ts`?**
Tipa `import.meta.env`. Declara `VITE_API_URL: string`; sin eso sería `any`. Solo se exponen al cliente las variables con prefijo `VITE_`, y son públicas (van en el bundle): no se ponen secretos.

**69. ¿Para qué fijar versiones exactas?**
Reproducibilidad: sin `^` ni `~` todos instalan lo mismo; el `pnpm-lock.yaml` fija además las transitivas. La consigna exige versiones fijadas en `package.json`.

**70. ¿Qué hace `pnpm build`?**
Ejecuta `tsc -b && vite build`: primero verifica los tipos (con `noEmit`, TypeScript no genera JS), y si pasa, Vite empaqueta. Por eso "pnpm build verifica los tipos".

---

## I. Preguntas trampa / de criterio

**71. ¿Qué mejorarías de tu frontend?**
Romper el import circular `authStore` ↔ `axiosInstance` (callback registrado en lugar de importar el store), asociar el carrito a cada usuario (hoy se vacía en el logout), agregar ESLint y tests (hoy no hay), y paginar del servidor los paneles si crecen más allá de 100 registros.

**72. ¿Por qué no usás `localStorage` directo sino `persist`?**
`persist` resuelve serialización, rehidratación, versionado y `partialize` sobre un store reactivo; con `localStorage` a mano tendría que escribirlo y leerlo en cada acción y mantener los componentes sincronizados.

**73. ¿Qué pasa si el backend está caído?**
Axios no recibe `response`; `handleApiError` devuelve "No se pudo conectar con el servidor. ¿Está levantado el backend?". Query reintenta hasta 2 veces (es falla de red) y después muestra `EstadoError` con "Reintentar". `checkSession` deja `usuario: null`.

**74. ¿Por qué Query no refetchea al volver a la pestaña?**
Lo desactivé (`refetchOnWindowFocus: false`) para evitar requests sorpresivos en una app de panel/formularios; el usuario refresca con "Reintentar" o "Actualizar", o se refresca solo al invalidar.

**75. Si dos admins editan el mismo producto, ¿qué pasa?**
La caché del segundo puede estar desactualizada hasta que expire el `staleTime` (30 s) o se invalide. No hay actualizaciones en vivo (no hay websockets); el backend es la fuente de verdad y valida cada escritura.
