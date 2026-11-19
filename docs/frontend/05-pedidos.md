# 05 - Pedidos: carrito, checkout, mis pedidos y panel admin

> Es la feature más rica: mezcla estado del cliente (carrito), un formulario, una mutación que toca stock, una máquina de estados reflejada en la UI y tres vistas con reglas distintas (cliente / admin / resumen). Cada entrada responde: qué hace, **por qué lo planteamos así**, qué alternativa descartamos y cómo lo defiendo en el parcial.

```
features/pedidos/
  api/pedidos.ts
  hooks/   usePedidos, useResumenPedidos, useCrearPedido, useCambiarEstadoPedido, useCancelarPedido, useInvalidarPedidos
  utils/estados.ts
  types/index.ts
  components/ CheckoutForm, ItemCarritoFila, TarjetaPedido, PedidoDetalle, TablaPedidos, TarjetaResumen
  pages/     CarritoPage, CheckoutPage, MisPedidosPage, AdminPedidosPage, AdminResumenPage
```

## 0. La idea general (para arrancar el oral)

- **Dos tipos de estado, dos herramientas** (pág. 17, "Separación del estado"): el **carrito** es estado del cliente (Zustand + `persist`, sin requests) y los **pedidos** son estado del servidor (TanStack Query). El único puente es el checkout: lee los ítems del carrito y manda un `POST /pedidos`.
- **El front muestra, el backend decide.** El precio, el stock, la máquina de estados y quién puede cancelar los valida el backend. Todo lo que el front hace con eso (deshabilitar botones, ocultar acciones) es **UX**, no seguridad.
- **Un solo endpoint `GET /pedidos`** sirve a "Mis pedidos" y al panel admin: lo que cambia es la sesión. Los dos pasan por el mismo hook `usePedidos`.

---

## 1. Tipos — `features/pedidos/types/index.ts`

### `EstadoPedido`, `FormaPago` — `types/index.ts`
**Qué hace:** uniones de literales: `'PENDIENTE' | 'EN_PREPARACION' | 'ENTREGADO' | 'CANCELADO'` y `'EFECTIVO' | 'TRANSFERENCIA'`.
**Por qué lo planteamos así:** son los valores que define la consigna (RN-02 y RN-06). Unión de literales y no `enum` por `erasableSyntaxOnly` (ver `06`). Con la unión, todos los `Record<EstadoPedido, ...>` son exhaustivos: agregar un estado rompe la compilación hasta que se cubra en cada mapa.
**Alternativa descartada:** `string`. Permitiría `'PENDINTE'` sin error.
**Si te preguntan en el parcial:** "Los estados son una unión de literales; así cada `Record<EstadoPedido, ...>` me obliga a cubrir todos los estados."

### `DetallePedido`, `Pedido`, `PedidosPaginados` — `types/index.ts`
**Qué hace:** `DetallePedido` = `producto_id, nombre_producto, precio_unitario, cantidad, subtotal`. `Pedido` = `id, usuario_id, estado, forma_pago, direccion_entrega, notas: string | null, total, created_at, updated_at, items: DetallePedido[]`. `PedidosPaginados` = `{ total, items }`.
**Por qué lo planteamos así:** espejo del backend (pág. 17). `DetallePedido` lleva `nombre_producto` y `precio_unitario` porque son una **copia inmutable** del producto al momento de comprar (RN-05, criterio 2): aunque después cambie el precio, el pedido no cambia. Por eso el detalle muestra esos campos y no consulta el producto. `Pedido` trae `usuario_id` pero no el nombre del usuario (ver "Usuario #id" más abajo).
**Alternativa descartada:** que el detalle mostrara el precio actual del producto: el historial mentiría.
**Si te preguntan en el parcial:** "Cada línea del pedido guarda nombre y precio copiados al comprar, así el pedido es un registro histórico que no cambia si después se edita el producto."

### `PedidoCreate`, `ItemPedidoCreate`, `DatosCheckout` — `types/index.ts`
**Qué hace:** `ItemPedidoCreate` = `{ producto_id, cantidad }`. `PedidoCreate` = `{ items, forma_pago, direccion_entrega, notas: string | null }`. `DatosCheckout = Omit<PedidoCreate, 'items'>`.
**Por qué lo planteamos así:** `ItemPedidoCreate` **no tiene precio** a propósito: el backend lo toma de la base. Nunca se confía en un precio que mande el cliente (cualquiera podría modificarlo desde las DevTools). `DatosCheckout` es lo que completa el usuario en el formulario; los ítems salen del carrito. Se define con `Omit` (un tipo **derivado**) y no copiado, así si `PedidoCreate` cambia, `DatosCheckout` se actualiza solo.
**Alternativa descartada:** mandar `precio_unitario` desde el front: vulnerable a manipulación.
**Si te preguntan en el parcial:** "El front manda solo `producto_id` y `cantidad`; el precio lo toma el backend de la base, porque nunca hay que confiar en un precio que viene del cliente."

### `CambioEstado`, `ResumenPedidos`, `FiltrosPedidos`, `EstadoPedidoCreado` — `types/index.ts`
**Qué hace:** `CambioEstado = { estado }` (cuerpo de `PATCH /pedidos/{id}/estado`). `ResumenPedidos` = los seis indicadores (`pendientes, en_preparacion, entregados, cancelados, pedidos_hoy, ingresos_entregados`). `FiltrosPedidos = { skip, limit, estado? }`. `EstadoPedidoCreado = { pedidoCreado: number }`.
**Por qué lo planteamos así:** `EstadoPedidoCreado` tipa el `state` de navegación que deja el checkout al redirigir a "Mis pedidos"; tener un tipo permite escribir un type guard en el receptor. `FiltrosPedidos` es el objeto que va dentro de la queryKey, igual que `FiltrosProductos`.
**Alternativa descartada:** pasar el id por query string (`/mis-pedidos?creado=5`): quedaría en la URL y se vería de nuevo al compartir o recargar el link.
**Si te preguntan en el parcial:** "El checkout le pasa a Mis pedidos el id del pedido creado por el `state` del router, y como llega como `unknown` lo valido con un type guard."

---

## 2. `api/pedidos.ts`

### `getPedidos(filtros)` — `features/pedidos/api/pedidos.ts`
**Qué hace:** `GET /pedidos` con `params: filtros` (`skip, limit, estado`).
**Por qué lo planteamos así:** devuelve **propios** si sos `user` y **todos** si sos `admin`: lo decide el backend según la sesión (`PedidoService.listar`: `usuario_id = None if usuario.role == "admin" else usuario.id`). Es la forma segura: si el front filtrara por dueño, un cliente podría pedir los de otro. `MisPedidosPage` y `AdminPedidosPage` comparten el mismo hook.
**Alternativa descartada:** dos endpoints (`/mis-pedidos` y `/pedidos`) o filtrar en el front: más superficie para filtrar mal y no es el contrato de la consigna.
**Si te preguntan en el parcial:** "El mismo endpoint sirve a las dos pantallas; el filtro por dueño lo hace el backend a partir de la sesión, no el front."

### `getResumenPedidos()`, `crearPedido(datos)` — `features/pedidos/api/pedidos.ts`
**Qué hace:** `GET /pedidos/resumen` (admin) y `POST /pedidos` (cliente con sesión).
**Por qué lo planteamos así:** el resumen lo calcula el backend (criterio 6: "resumen correcto"); el front solo lo dibuja. La creación manda un único `POST` con todo el pedido para que el backend lo resuelva en **una transacción** (pedido + líneas + descuento de stock, con rollback si algo falla).
**Alternativa descartada:** calcular el resumen en el front contando pedidos: obligaría a bajar todos los pedidos y se desfasaría de la paginación.
**Si te preguntan en el parcial:** "Creo el pedido con un solo POST para que el backend lo haga atómico; el resumen también lo calcula el backend."

### `cambiarEstadoPedido(id, cambio)` y `cancelarPedido(id)` — `features/pedidos/api/pedidos.ts`
**Qué hace:** `PATCH /pedidos/{id}/estado` (admin: avanza o cancela según la máquina de estados) y `PATCH /pedidos/{id}/cancelar` (el dueño cancela mientras está PENDIENTE).
**Por qué lo planteamos así:** son **dos endpoints distintos con reglas distintas**: el admin puede cancelar desde `PENDIENTE` o `EN_PREPARACION` de cualquier pedido, el cliente solo los suyos y solo en `PENDIENTE` (RN-04). `PATCH` y no `PUT` porque se modifica un campo.
**Alternativa descartada:** un único endpoint de estado para ambos roles, con la regla del dueño metida en el mismo: mezclaría permisos distintos.
**Si te preguntan en el parcial:** "Hay un endpoint de cancelación para el dueño, con sus reglas, y otro de cambio de estado para el admin; los permisos son distintos."

---

## 3. Hooks y diseño de `queryKey`

### `PEDIDOS_KEY` y `usePedidos(filtros)` — `features/pedidos/hooks/usePedidos.ts`
**Qué hace:** `PEDIDOS_KEY = ['pedidos']`; `usePedidos` hace `useQuery` con `queryKey: [...PEDIDOS_KEY, 'lista', filtros]`, `queryFn: () => getPedidos(filtros)` y `placeholderData: keepPreviousData`.
**Por qué lo planteamos así:** el **árbol de claves** es una decisión deliberada:

```
['pedidos']                                  <- raíz (PEDIDOS_KEY)
  ['pedidos', 'lista', { skip, limit, estado? }]   <- cada página/filtro es una entrada
  ['pedidos', 'resumen']                            <- indicadores del admin
['productos', ...]                           <- el catálogo (otra raíz)
```

La jerarquía permite **invalidar por prefijo**: `invalidateQueries({ queryKey: ['pedidos'] })` marca como desactualizadas **todas** las listas y el resumen con una sola llamada. Si el resumen tuviera una clave aparte (`['resumen']`), habría que acordarse de invalidarlo por separado. El comentario del código: "Raíz de todas las claves de pedidos (listados y resumen): invalidarla refresca todo". El segmento `'lista'` evita que una clave de lista choque con `'resumen'`, y `filtros` en la clave hace que cambiar de página o de estado sea otra entrada de caché y otro fetch, igual que el catálogo. `keepPreviousData` evita el parpadeo al paginar (ver `04`). La consigna pide `queryKey` descriptivas (pág. 17).
**Alternativa descartada:** una key plana por pantalla (`['mis-pedidos']`, `['admin-pedidos']`, `['resumen']`): habría que invalidar tres cosas a mano y cualquier olvido deja datos viejos.
**Si te preguntan en el parcial:** "Cuelgo las listas y el resumen de la raíz `['pedidos']` para invalidar todo con una sola llamada por prefijo; los filtros van dentro de la key para que cada página o estado sea su propia entrada de caché."

### `useResumenPedidos()` — `features/pedidos/hooks/useResumenPedidos.ts`
**Qué hace:** `useQuery` con `queryKey: [...PEDIDOS_KEY, 'resumen']` y `queryFn: getResumenPedidos`.
**Por qué lo planteamos así:** como su clave cuelga de `['pedidos']`, **cualquier mutación de pedidos lo mantiene al día sola**: si el admin avanza un pedido, el contador de "Pendientes" se actualiza. No tiene `placeholderData` porque no hay paginación.
**Alternativa descartada:** un botón de refresco manual como única forma de actualizar (se mantiene "Actualizar" como complemento, ver más abajo).
**Si te preguntan en el parcial:** "El resumen cuelga de la raíz de pedidos; cualquier mutación lo invalida y se actualiza sin que yo lo pida."

### `useInvalidarPedidos()` — `features/pedidos/hooks/useInvalidarPedidos.ts`
**Qué hace:** devuelve `() => Promise.all([invalidar(PEDIDOS_KEY), invalidar(PRODUCTOS_KEY)])`.
**Por qué lo planteamos así:** **¿por qué invalidar también `productos`?** Crear un pedido **descuenta stock**; cancelarlo (cliente o admin) lo **restituye**. El catálogo cacheado quedaría mostrando stock viejo. Como además `staleTime` es 30 s, sin invalidar el catálogo no se refrescaría enseguida. El comentario del código: "Crear o cancelar un pedido mueve stock: además de los pedidos (y el resumen) se invalidan los productos para que el catálogo muestre el stock real". Lo comparten las tres mutaciones por simplicidad: aunque avanzar a `EN_PREPARACION` no mueve stock, la invalidación extra es barata (solo refetchea queries *activas*; las demás se marcan viejas). Se importa `PRODUCTOS_KEY` de la feature de productos en vez de escribir el literal, así hay una única definición.
**Alternativa descartada:** `queryClient.invalidateQueries()` sin key (refetchea categorías y usuarios sin necesidad), o invalidar solo pedidos (catálogo con stock mentiroso).
**Si te preguntan en el parcial:** "Crear o cancelar un pedido mueve stock, así que además de los pedidos invalido los productos para que el catálogo muestre el stock real. No invalido todo, solo esas dos raíces."

### `useCrearPedido()`, `useCambiarEstadoPedido()`, `useCancelarPedido()` — `features/pedidos/hooks/`
**Qué hace:** tres `useMutation` con `onSuccess: invalidar` (el de `useInvalidarPedidos`). `useCambiarEstadoPedido` recibe `{ id, estado }` y llama `cambiarEstadoPedido(id, { estado })`; `useCancelarPedido` pasa `cancelarPedido` directo como `mutationFn`.
**Por qué lo planteamos así:** la consigna pide `useMutation` con `invalidateQueries` en `onSuccess` para "crear, editar, borrar y cambiar estado" (pág. 20). `cancelarPedido(id: number)` ya tiene forma de un solo argumento, por eso se pasa directo; el cambio de estado necesita dos datos (`id` y `estado`), así que recibe un objeto.

| Mutación | Invalida | Por qué |
|----------|----------|---------|
| `useCrearPedido` | pedidos (+resumen) y productos | Hay un pedido nuevo; stock descontado |
| `useCambiarEstadoPedido` | ídem | El estado cambió; si va a CANCELADO se restituye stock; cambian los contadores |
| `useCancelarPedido` | ídem | PENDIENTE -> CANCELADO; stock restituido |

**Alternativa descartada:** actualizar la caché a mano (`setQueryData`) después de cambiar el estado: habría que recalcular a mano el resumen y el stock del catálogo.
**Si te preguntan en el parcial:** "Las tres mutaciones comparten el mismo invalidador porque las tres pueden alterar pedidos, resumen y stock."

---

## 4. La máquina de estados en la UI — `utils/estados.ts`

```
PENDIENTE ──► EN_PREPARACION ──► ENTREGADO
    │               │
    └──► CANCELADO ◄┘            (ENTREGADO y CANCELADO son terminales)
```

### `TRANSICIONES: Record<EstadoPedido, EstadoPedido[]>` — `features/pedidos/utils/estados.ts`
**Qué hace:** para cada estado, lista los estados destino válidos: `PENDIENTE: ['EN_PREPARACION','CANCELADO']`, `EN_PREPARACION: ['ENTREGADO','CANCELADO']`, `ENTREGADO: []`, `CANCELADO: []`.
**Por qué lo planteamos así:** es un **espejo** de la tabla `TRANSICIONES` del backend (`PedidoService`, RN-02) y sirve **solo para decidir qué botones dibujar**: en `TablaPedidos`, `TRANSICIONES[pedido.estado].map(...)` genera un botón por cada destino posible. Un pedido `ENTREGADO` o `CANCELADO` tiene `[]` y no muestra botones. La consigna lo pide así: "botones para avanzar o cancelar según la máquina de estados" (pág. 20). El comentario del código: "Espejo de la máquina de estados del backend (RN-02), solo para decidir qué botones mostrar. La validación real la hace el Service de pedidos." Si alguien forzara una transición inválida llamando a la API, el backend responde 400 (`TransicionInvalida`). Se usa `Record<EstadoPedido, ...>` para que el mapa sea **exhaustivo**.
**Costo asumido:** la regla está duplicada (backend y front); si cambia en uno hay que acordarse del otro.
**Alternativa descartada:** `if/else` con estados escritos en el componente (se desparrama y no es exhaustivo), o pedirle al backend las transiciones válidas con un endpoint extra (más complejidad por un mapa de cuatro entradas).
**Si te preguntan en el parcial:** "`TRANSICIONES` replica la máquina de estados del backend solo para saber qué botones mostrar; la validación real es del servicio, que devuelve 400 si la transición no es válida."

### `ESTADOS_PEDIDO`, `FORMAS_PAGO` — `features/pedidos/utils/estados.ts`
**Qué hace:** arrays con los cuatro estados y las dos formas de pago.
**Por qué lo planteamos así:** una única lista para recorrer (`<select>` de filtro, `<select>` de forma de pago) y para los type guards. Evita escribir los valores en varios archivos.
**Alternativa descartada:** `Object.keys(ETIQUETA_ESTADO)`: devuelve `string[]` y pierde el tipo.
**Si te preguntan en el parcial:** "Tengo los valores en un solo array para alimentar los selects y los type guards."

### `ETIQUETA_ESTADO`, `ETIQUETA_FORMA_PAGO`, `ETIQUETA_ACCION` — `features/pedidos/utils/estados.ts`
**Qué hace:** textos de pantalla: "En preparación", "Efectivo", y el texto del botón que lleva a cada destino ("A preparación", "Entregar", "Cancelar").
**Por qué lo planteamos así:** los valores del backend (`EN_PREPARACION`) no son para mostrar al usuario. Los `Record` son exhaustivos. `ETIQUETA_ACCION` tiene una entrada `PENDIENTE: 'Volver a pendiente'` que **nunca se usa** (ninguna transición lleva a `PENDIENTE`): existe porque `Record<EstadoPedido, string>` obliga a cubrir los cuatro estados.
**Alternativa descartada:** mostrar el valor crudo del enum; o un `switch` en cada componente.
**Si te preguntan en el parcial:** "Separo el valor técnico del texto de pantalla con mapas exhaustivos; la entrada 'Volver a pendiente' no se usa pero el `Record` me obliga a declararla."

### `esEstadoPedido(valor)` y `esFormaPago(valor)` — `features/pedidos/utils/estados.ts`
**Qué hace:** type guards `valor is EstadoPedido` / `valor is FormaPago`, implementados con `ARRAY.some((x) => x === valor)`.
**Por qué lo planteamos así:** `e.target.value` de un `<select>` es `string`, pero el estado del form es `FormaPago`. Un **predicado de tipo** estrecha el tipo **sin `as`**: es el reemplazo seguro de un cast (criterio 10: "sin `any`"). Se usa `some` con `===` y no `includes` porque `includes` sobre un `EstadoPedido[]` rechaza un argumento `string` en TypeScript; `some` compila y deja el predicado.
**Alternativa descartada:** `e.target.value as FormaPago`: si el DOM trajera otro valor, TypeScript no se enteraría.
**Si te preguntan en el parcial:** "Uso predicados de tipo en vez de casts: verifico en runtime que el string es un estado válido y recién ahí TypeScript lo trata como `EstadoPedido`."

---

## 5. El carrito

### `CarritoPage()` — `features/pedidos/pages/CarritoPage.tsx`
**Qué hace:** lee del `cartStore` `items`, `total()`, `cantidadItems()`, `cambiarCantidad`, `quitar`, `vaciar`. Si está vacío muestra `EstadoVacio` con enlace al catálogo; si no, la lista de `ItemCarritoFila`, un `Card` de resumen con el total, "Continuar con el pedido" y "Vaciar carrito" con `ConfirmModal`.
**Por qué lo planteamos así:** la ruta es **pública** (pág. 19): se puede armar el carrito sin cuenta y el login se pide recién al confirmar (`/checkout` sí está protegido). El carrito es estado del cliente (Zustand + `persist`, pág. 20: "persiste al recargar"), así que esta pantalla **no hace ninguna request**. El subtotal por línea se calcula en la vista (`precio_unitario × cantidad`); el total viene de `total()` del store. "Vaciar carrito" pide confirmación porque es destructivo y no tiene deshacer (y usamos un `ConfirmModal` propio, no `window.confirm`: es accesible y consistente con el resto de la app). `procesando={false}` y `error={null}` porque vaciar es síncrono y no puede fallar.
**Alternativa descartada:** guardar el carrito en el servidor (obligaría a tener sesión para agregar) o en `useState` local (se pierde al recargar).
**Si te preguntan en el parcial:** "El carrito es estado del cliente con persist, por eso sobrevive a la recarga y no hace requests; es público para que el login se pida recién al confirmar el pedido."

### `ItemCarritoFila({ item, onCambiarCantidad, onQuitar })` — `features/pedidos/components/ItemCarritoFila.tsx`
**Qué hace:** fila con imagen, nombre, precio, botones − y +, subtotal y "Quitar". `−` se deshabilita con `cantidad <= 1`; `+` se deshabilita si `alcanzoStock = item.stock !== undefined && item.cantidad >= item.stock`, y aparece "Máximo disponible: N".
**Por qué lo planteamos así:** es **presentacional**: no importa el store, solo recibe callbacks (`onCambiarCantidad(item.cantidad + 1)`); la página los conecta al store. `−` se deshabilita en 1 porque para borrar está "Quitar" (evita quitar un ítem sin querer al bajar de 1). `stock` es opcional (`stock?: number`) porque se guarda "el stock conocido al agregar" para acotar cantidades; si no se conoce, no se limita en el front. Es solo ayuda de UX: el backend vuelve a validar el stock al crear el pedido.
**Alternativa descartada:** que la fila lea y modifique el store directamente (la haría difícil de reutilizar y de probar).
**Si te preguntan en el parcial:** "La fila es presentacional: recibe los callbacks por props. Limito la cantidad al stock conocido como ayuda al usuario, pero quien decide es el backend."

---

## 6. El checkout

### `CheckoutForm({ error, onSubmit })` — `features/pedidos/components/CheckoutForm.tsx`
**Qué hace:** formulario TanStack Form con tres campos: `direccion_entrega` (`longitud(..., 5, 200)`), `forma_pago` (`<select>` con `FORMAS_PAGO`, valor inicial `'EFECTIVO'`) y `notas` (opcional, máx. 500 con `MAX_NOTAS`). `onSubmit` normaliza (`direccion_entrega.trim()`, `notas: textoOpcional(...)`) y llama a `onSubmit(datos: DatosCheckout)` del padre. El botón dice "Confirmar pedido" / "Confirmando…" según `isSubmitting`.
**Por qué lo planteamos así:**
- **TanStack Form** lo exige la consigna (criterio 7: "checkout con TanStack Form"; pág. 19: `direccion_entrega`, `forma_pago` y `notas`).
- Las reglas de dirección (5 a 200) y forma de pago (EFECTIVO o TRANSFERENCIA) son **RN-06** y están anotadas en el código; se validan en `onChange` para feedback inmediato. El backend las vuelve a validar.
- `onChange={(e) => { if (esFormaPago(e.target.value)) field.handleChange(e.target.value); }}`: `e.target.value` es `string`, pero el campo es `FormaPago`. El **type guard** estrecha el tipo **sin `as`**.
- El formulario **no sabe de mutaciones ni del carrito**: recibe `onSubmit` por props. Por eso `CheckoutPage` decide qué hacer (crear, navegar, vaciar).
- `valoresIniciales` es constante de módulo (no cambia entre renders).
**Alternativa descartada:** meter la mutación y el carrito dentro del formulario: mezcla presentación con lógica de negocio.
**Si te preguntan en el parcial:** "El formulario valida las reglas RN-06 y delega el envío al padre; para el select de forma de pago uso un type guard en lugar de un cast."

### `CheckoutPage()` — `features/pedidos/pages/CheckoutPage.tsx`
**Qué hace:**
1. Arma el cuerpo: los datos del formulario + `items` proyectados a **solo** `{ producto_id, cantidad }`.
2. `crearPedido.mutateAsync(...)`; si el backend responde error, salta al `catch` y **no se navega ni se vacía el carrito**. El mensaje aparece sobre el form (`handleApiError`).
3. Si va bien: `navigate('/mis-pedidos', { replace: true, state: { pedidoCreado: pedido.id } })` y **después** `vaciar()`.
4. Si el carrito está vacío, muestra `EstadoVacio` ("No hay productos para confirmar").
**Por qué lo planteamos así:**
- **El precio no viaja**: el backend lo toma de la base y lo copia al detalle (RN-05). La columna derecha dice "Total **estimado**" con la nota "El total final lo calcula el sistema con los precios vigentes al confirmar" (el precio del carrito pudo cambiar desde que se agregó).
- **`mutateAsync` + `try/catch`**: nos permite encadenar "si salió bien, navegar y vaciar". Si falló (400 stock insuficiente o producto no disponible, 404 producto dado de baja) el usuario conserva el carrito y puede corregir y reintentar.
- **`replace: true`**: reemplaza `/checkout` en el historial, para que el botón "atrás" no vuelva a un checkout con el carrito ya vacío.
- **El `state` con el id del pedido** lo recibe `MisPedidosPage` para mostrar el banner de éxito.
- **El orden `navigate` y luego `vaciar()`**: es decisión nuestra; vaciar primero haría que el checkout pudiera pintar el estado "No hay productos para confirmar" justo antes de salir. En la práctica React agrupa ambas actualizaciones, pero así el flujo es correcto sin depender de eso.
- **No hay nada que deshacer en el front** porque el backend crea pedido, líneas y descuento de stock en una sola transacción con rollback.
- `onSuccess` del hook ya invalidó `pedidos` y `productos`.
- `/checkout` está protegido (`ProtectedRoute` sin roles, pág. 19 "Sesión"): sin sesión te manda a `/login` y, tras loguear, vuelve acá gracias a `state.desde`.
**Alternativa descartada:** vaciar el carrito antes de recibir la respuesta (si el backend rechaza, el usuario perdería su carrito) o mandar el precio calculado en el front.
**Si te preguntan en el parcial:** "Mando solo producto y cantidad; el backend calcula el precio y hace todo en una transacción. Si falla, no navego ni vacío el carrito para que el usuario pueda corregir. Si sale bien, navego con `replace` y recién ahí vacío."

---

## 7. Mis pedidos (cliente, `/mis-pedidos`)

### `esEstadoPedidoCreado(estado: unknown): estado is EstadoPedidoCreado` — `features/pedidos/pages/MisPedidosPage.tsx`
**Qué hace:** type guard que verifica `typeof estado === 'object' && estado !== null && 'pedidoCreado' in estado`.
**Por qué lo planteamos así:** `location.state` es `unknown`; se estrecha con un guard en vez de un cast (criterio 10). Es el mismo patrón que `rutaDeOrigen` en el login.
**Alternativa descartada:** `location.state as EstadoPedidoCreado | null`.
**Si te preguntan en el parcial:** "El `state` del router llega como `unknown`; lo valido con un guard antes de leer `pedidoCreado`."

### `MisPedidosPage()` — `features/pedidos/pages/MisPedidosPage.tsx`
**Qué hace:** `usePedidos({ skip: pagina * 10, limit: 10 })` con `Paginacion`, lista de `TarjetaPedido`, banner de pedido creado, modal de detalle y `ConfirmModal` para cancelar.
**Por qué lo planteamos así:**
- **Paginación del servidor** (`skip = página × POR_PAGINA`), igual que el catálogo. No se pasa `estado`: el cliente ve todos *sus* pedidos (el backend ya filtra por dueño).
- **Guarda ids, no objetos**: `idDetalle` y `idACancelar`, y deriva `pedidoDetalle = data?.items.find((p) => p.id === idDetalle)`. Comentario del código: "se guardan ids (no objetos) para leer siempre la versión fresca de la caché". Si el pedido se actualiza por un refetch, el modal muestra el dato nuevo en vez de una copia vieja.
- **Cancelar con confirmación**: `cancelar.reset()` al abrir; `cancelar.mutate(id, { onSuccess: () => setIdACancelar(null) })`. El modal se cierra solo si salió bien; si falla (403 ajeno, 400 no cancelable) muestra el error adentro y queda abierto. Usamos `ConfirmModal` y no `window.confirm` por accesibilidad y porque puede mostrar el error y el spinner. Cancelar es destructivo e irreversible ("Esta acción no se puede deshacer").
- **Banner**: si `esEstadoPedidoCreado(location.state)` muestra "¡Listo! Tu pedido #N fue registrado y está pendiente." con `role="status"` para lectores de pantalla.
- Los cuatro estados: `SkeletonFilas`, `EstadoError`, `EstadoVacio` ("Todavía no hiciste pedidos" + enlace al catálogo), lista; con `keepPreviousData` el skeleton aparece solo la primera vez y después se atenúa la lista (`isPlaceholderData`).
**Alternativa descartada:** guardar el objeto `Pedido` seleccionado en el estado (queda desactualizado tras un refetch).
**Si te preguntan en el parcial:** "Guardo el id del pedido seleccionado y lo busco en los datos de la caché, así el modal siempre muestra la versión actualizada."

### `TarjetaPedido({ pedido, onVerDetalle, onCancelar })` — `features/pedidos/components/TarjetaPedido.tsx`
**Qué hace:** resumen de un pedido: número, `BadgeEstado`, fecha, unidades (`reduce` sobre `items`), dirección, total y botones "Ver detalle" y "Cancelar". El botón Cancelar solo aparece si `pedido.estado === 'PENDIENTE' && pedido.usuario_id === usuarioId`.
**Por qué lo planteamos así:** el botón cancelar sale en dos condiciones: **PENDIENTE** (lo exige la consigna, pág. 20: "botón cancelar solo en PENDIENTE" y RN-04) **y dueño** (`usuario_id === usuario.id`, el id de la sesión leído de `authStore`). Mostrar un botón que va a fallar sería mala UX. **Es UX, no seguridad:** el backend lo vuelve a exigir en `PedidoService.cancelar` (lanza `PedidoAjeno` si no sos el dueño y `PedidoNoCancelable` si no está PENDIENTE). Las unidades se calculan con `reduce` porque `Pedido` no trae ese total, y es un cálculo trivial para la vista.
**Alternativa descartada:** mostrar siempre el botón y que el backend responda el error (el usuario vería fallar una acción que podíamos evitar).
**Si te preguntan en el parcial:** "Muestro Cancelar solo si el pedido es mío y está PENDIENTE para no ofrecer una acción que va a fallar, pero el backend lo vuelve a validar porque ocultar un botón no es seguridad."

### `PedidoDetalle({ pedido })` — `features/pedidos/components/PedidoDetalle.tsx`
**Qué hace:** dentro del modal muestra estado, fechas (`formatearFecha`), forma de pago, dirección, notas (si hay) y la tabla de líneas con `nombre_producto`, `precio_unitario`, `cantidad`, `subtotal` y el total.
**Por qué lo planteamos así:** esos son los valores **copiados al momento de la compra** (RN-05). Lo comparten el cliente y el admin: un solo componente para "ver un pedido". Es presentacional: solo recibe el `pedido`. La `key` de cada fila es `producto_id`.
**Alternativa descartada:** dos detalles distintos para cliente y admin (duplicación).
**Si te preguntan en el parcial:** "Muestro los datos que el pedido guardó al comprar, no los actuales del producto, y el mismo componente sirve para el cliente y para el admin."

---

## 8. Panel admin de pedidos (`/admin/pedidos`)

### `AdminPedidosPage()` — `features/pedidos/pages/AdminPedidosPage.tsx`
**Qué hace:** `usePedidos({ skip: 0, limit: LIMITE_PANEL, estado })` con `LIMITE_PANEL = 100`, un `<select>` para filtrar por estado, `TablaPedidos`, un modal de detalle y un `ConfirmModal` de cancelación.
**Por qué lo planteamos así:**
- **Filtro por estado en el servidor**: el `<select>` actualiza `estado`, que está en la queryKey vía `filtros` y viaja como `?estado=`. El `onChange` usa `esEstadoPedido` para convertir el `string` en `EstadoPedido | undefined` sin casts.
- **Como el panel pide hasta 100, `DataTable` agrega búsqueda, orden y paginación en el cliente** (consigna, pág. 20).
- **`solicitarCambio(pedido, destino)`**: hace `reset()` (limpia errores previos) y luego:
  - si `destino === 'CANCELADO'` -> **no muta de inmediato**: abre `ConfirmModal` ("Se restituirá el stock de sus productos"), porque cancelar es **terminal** (no se puede deshacer) y **toca stock**;
  - si no -> `mutate({ id, estado: destino })` directo.
  
  **Por qué "A preparación" y "Entregar" son inmediatos y "Cancelar" pide confirmar:** los avances son el flujo normal y frecuente, y tienen un único resultado esperado; cancelar es irreversible y tiene un efecto colateral importante (restituir stock). Pedir confirmación en todo haría tedioso el trabajo del admin; pedirla solo donde el error cuesta caro es el equilibrio.
- **`useCallback`** en `verDetalle` y `solicitarCambio`: las columnas de `TablaPedidos` dependen de ellos en un `useMemo`; sin `useCallback` serían funciones nuevas en cada render y la tabla recrearía columnas siempre. `mutate` y `reset` se desestructuran de la mutación porque son estables (la mutación completa es un objeto nuevo cada render).
- **`idProcesando = cambiarEstado.isPending ? cambiarEstado.variables?.id : null`**: deshabilita los botones solo de esa fila mientras se procesa.
- **Dónde se muestra el error**: un avance fallido aparece como `EstadoError` sobre la tabla; el de cancelar, dentro de su modal (`cambiarEstado.isError && idACancelar === null`). Así el error aparece donde el usuario está mirando.
- **El detalle por id** (`idDetalle`), como en Mis pedidos, para leer la versión fresca.
- El título del modal de detalle es "Pedido #id · Usuario #usuario_id".
**Alternativa descartada:** confirmar todas las transiciones (tedioso), no confirmar ninguna (un click de más cancela un pedido y repone stock), o paginar el panel en el servidor (la consigna pide cliente).
**Si te preguntan en el parcial:** "Avanzar es inmediato porque es el flujo normal; cancelar pide confirmación porque es terminal y restituye stock. El filtro por estado va al servidor como query param y la tabla pagina en el cliente porque el panel pide hasta 100."

### `TablaPedidos({ pedidos, idProcesando, onVerDetalle, onCambiarEstado })` — `features/pedidos/components/TablaPedidos.tsx`
**Qué hace:** arma las columnas con `useMemo<ColumnDef<Pedido>[]>` y renderiza `DataTable`. En la columna de acciones recorre `TRANSICIONES[pedido.estado]`: un botón por destino, azul para avanzar, rojo para `CANCELADO`, con el texto de `ETIQUETA_ACCION[destino]`. "Ver" abre el detalle.
**Por qué lo planteamos así:**
- **Los botones salen de la máquina de estados** (`TRANSICIONES`), no de `if`s sueltos: una sola fuente para qué se puede hacer desde cada estado.
- **Columnas como `useMemo` dentro del componente** (en vez de fábrica externa como en usuarios): acá las columnas dependen de props (`idProcesando`, callbacks), y las dos formas son equivalentes; lo importante es que el array no cambie en cada render.
- **Columna "Estado" calculada** (`id: 'estado'`, `accessorFn: (p) => ETIQUETA_ESTADO[p.estado]`): así la búsqueda global encuentra "En preparación" (con el valor crudo `EN_PREPARACION` no encontraría la frase). El `cell` sigue mostrando el `BadgeEstado`.
- **"Cliente" muestra `Usuario #id`**: el `Pedido` del backend solo trae `usuario_id`, no el nombre. Resolver el nombre exigiría pedir `/admin/usuarios` y cruzar los datos (una request más y más acoplamiento) o cambiar el contrato del backend, y la consigna no lo pide. Es una limitación consciente: el admin identifica al cliente por su id.
- `disabled={procesando}` en los botones de acción de la fila en curso evita doble click.
**Alternativa descartada:** mostrar el nombre cruzando usuarios en el front, o botones fijos (Avanzar/Cancelar) que dependan de comparaciones de estado repartidas.
**Si te preguntan en el parcial:** "Los botones de cada fila los genero recorriendo `TRANSICIONES[estado]`, así la UI siempre sigue la máquina de estados. Muestro `Usuario #id` porque el pedido solo trae el id y no quise cruzar con otra request."

---

## 9. Resumen admin (`/admin/resumen`)

### `AdminResumenPage()` — `features/pedidos/pages/AdminResumenPage.tsx`
**Qué hace:** `useResumenPedidos()`; muestra seis `TarjetaResumen` (Pendientes, En preparación, Entregados, Cancelados, Pedidos de hoy, Ingresos entregados con `formatoPrecio`), skeleton (6 `Skeleton` en grilla) o error con reintentar. Botón "Actualizar".
**Por qué lo planteamos así:** la consigna pide "tarjetas con los indicadores de `ResumenPedidos`" (pág. 20, criterio 8). El resumen se mantiene al día solo (su key cuelga de `['pedidos']`), pero igual hay un botón **Actualizar** que llama `refetch()` y usa **`isFetching`** (no `isPending`) como spinner: `isPending` solo es `true` mientras no hay datos; acá ya hay datos y lo que cambia es que se está *re*-pidiendo. Esta pantalla no usa `DataTable`.
**Alternativa descartada:** `refetchInterval` (polling cada X segundos): consume requests sin necesidad para un panel que se actualiza por invalidación.
**Si te preguntan en el parcial:** "El resumen se refresca solo cuando hay mutaciones de pedidos; el botón Actualizar usa `isFetching` porque ya hay datos y lo que cambia es que se está re-pidiendo."

### `TarjetaResumen({ titulo, valor, descripcion?, icono, tono })` — `features/pedidos/components/TarjetaResumen.tsx`
**Qué hace:** tarjeta con título, valor grande, descripción opcional e ícono. `tono` es una unión de literales (`'amber' | 'blue' | ...`) mapeada a clases con `Record<Tono, string>`.
**Por qué lo planteamos así:** `valor` es `string` porque el padre ya formatea (número entero o precio). Mapear el tono a clases completas en un `Record` (y no armar `` `border-${tono}-400` ``) es necesario con Tailwind: las clases deben aparecer **completas** en el código para que Tailwind las detecte al generar el CSS. La unión de literales impide pasar un tono inexistente.
**Alternativa descartada:** interpolar el nombre de la clase (Tailwind no la generaría).
**Si te preguntan en el parcial:** "El tono es una unión de literales mapeada a clases completas, porque Tailwind solo genera las clases que ve escritas completas."

---

## 10. Flujo completo de datos (para el oral)

1. Catálogo: `useProductos` (servidor) -> `ProductoCard` -> `cartStore.agregar` (cliente, persistido).
2. Carrito: solo `cartStore`. Cero requests.
3. Checkout: `CheckoutForm` valida -> `useCrearPedido` -> `POST /pedidos` (transacción en el backend) -> `invalidar` (`pedidos` + `productos`) -> navegar -> `vaciar()`.
4. Mis pedidos: `usePedidos` (refetch porque está invalidado) -> el nuevo pedido aparece.
5. Admin: avanza el pedido con `useCambiarEstadoPedido` -> invalida -> la tabla, el resumen y el catálogo se refrescan.
6. Cliente: puede cancelar mientras sea PENDIENTE -> `useCancelarPedido` -> stock restituido -> catálogo refleja el stock.
7. Al cerrar sesión, `authStore.logout` hace `queryClient.clear()` y `useCartStore.getState().vaciar()`, así el próximo usuario del mismo navegador no hereda ni la caché ni el carrito.
