# 04 - Catálogo, categorías y productos

> Acá viven: la **paginación del lado del servidor**, la **queryKey con filtros**, `keepPreviousData`, el **debounce**, los estados de **skeleton / vacío / error**, y el ABM de admin con **TanStack Table + TanStack Form**. Cada entrada responde: qué hace, **por qué lo planteamos así**, qué alternativa descartamos y cómo lo defiendo en el parcial.

```
features/categorias/   api, hooks (useCategorias...), components (CategoriaFormModal, columnasCategorias), pages/AdminCategoriasPage, types
features/productos/    api, hooks (useProductos...), components (ProductoCard, FiltrosCatalogo, ImagenProducto,
                       ProductoFormModal, StockModal, columnasProductos), pages (CatalogoPage, AdminProductosPage), types
```

## 0. Las dos estrategias de paginación (la pregunta clásica)

| Pantalla | Dónde se pagina | Por qué |
|----------|-----------------|---------|
| Catálogo público (`/`) | **Servidor**: `skip = página × limit`, `limit = 12` | La consigna (pág. 19) lo pide: "Lista paginada en el servidor". Con miles de productos no podés traer todos al navegador de un cliente. |
| Admin de categorías y productos | **Cliente**: se pide `limit=100` una vez y `DataTable` pagina en memoria | La consigna (pág. 20) lo pide: "TanStack Table con paginación del lado del cliente (el panel pide limit=100)". Es una tabla de gestión: búsqueda y orden instantáneos sin ir al servidor. |

Son dos estrategias distintas **a propósito**, no una inconsistencia. Limitación que conviene reconocer: si hubiera más de 100 productos, el panel no vería los restantes.

También conviene recordar los defaults de `shared/api/queryClient.ts`: `staleTime: 30_000` (30 s sin considerar el dato viejo) y `refetchOnWindowFocus: false`. Por eso **la invalidación explícita después de cada mutación es obligatoria**: sin ella el catálogo no se refrescaría hasta pasados 30 segundos.

---

## 1. Tipos (espejo del backend)

### `Categoria` y `CategoriaInput` — `features/categorias/types/index.ts`
**Qué hace:** `Categoria { id, nombre, descripcion: string | null, activo }` es lo que devuelve el backend (`CategoriaRead`). `CategoriaInput { nombre, descripcion: string | null }` es lo que se envía al crear o editar.
**Por qué lo planteamos así:** la consigna pide interfaces con los mismos nombres de campo que los schemas del backend (pág. 17). Se separan lectura y escritura porque `id` y `activo` **los maneja el backend**: el cliente no puede ni debe mandarlos. `descripcion: string | null` refleja que en la base puede ser `NULL` (no `undefined`, ni string vacío).
**Alternativa descartada:** un solo tipo `Categoria` para todo, con `id?` y `activo?` opcionales. Permite mandar un `id` que el backend ignora y vuelve ambiguo qué campos son obligatorios.
**Si te preguntan en el parcial:** "Separé el tipo de lectura del de escritura: `id` y `activo` los pone el backend, así que no están en `CategoriaInput`."

### `Producto`, `ProductoInput`, `ProductoStockUpdate` — `features/productos/types/index.ts`
**Qué hace:** `Producto` es `ProductoRead` (incluye `categoria: Categoria` embebida). `ProductoInput` es el cuerpo de POST y PUT (`nombre, descripcion, precio_base, imagen_url, stock, disponible, categoria_id`). `ProductoStockUpdate` es el cuerpo de `PATCH /productos/{id}/stock`: `{ stock, disponible }`.
**Por qué lo planteamos así:** mismo criterio de espejo del backend. La **categoría embebida** evita pedir las categorías aparte para mostrar su nombre en cada tarjeta (pero tiene una consecuencia para la invalidación, ver `useInvalidarCategorias`). `ProductoStockUpdate` existe como tipo propio porque el PATCH de stock es una operación distinta de editar todo el producto (criterio 5: "PATCH de stock").
**Alternativa descartada:** reutilizar `ProductoInput` para el stock: obligaría a mandar nombre, precio y categoría solo para cambiar unas unidades.
**Si te preguntan en el parcial:** "El producto trae su categoría embebida para mostrarla sin otra request, y el stock tiene su propio tipo porque se actualiza con un PATCH aparte."

### `ProductosPaginados` y `FiltrosProductos` — `features/productos/types/index.ts`
**Qué hace:** `ProductosPaginados` es `{ total, items }`. `FiltrosProductos` es `{ skip, limit, search?, categoria_id?, disponible? }`: los query params de `GET /productos`.
**Por qué lo planteamos así:** el backend devuelve `total` además de la página para que el front calcule cuántas páginas hay (`Math.ceil(total / porPagina)` dentro de `Paginacion`). Los campos opcionales significan "si es `undefined`, no se manda": Axios omite los params `undefined`. El mismo objeto `FiltrosProductos` se usa como **parte de la queryKey** (ver `useProductos`), así que describir los filtros con un tipo es lo que mantiene la key y la request sincronizadas. (`disponible` está definido pero hoy ningún componente lo usa.)
**Alternativa descartada:** devolver solo el array de items. No se sabría cuántas páginas hay, y no se podría deshabilitar "Siguiente" en la última.
**Si te preguntan en el parcial:** "El backend devuelve `{ total, items }` para que yo pueda calcular las páginas; los filtros opcionales no se mandan si valen `undefined`."

---

## 2. `api/`

### `getProductos(filtros)` — `features/productos/api/productos.ts`
**Qué hace:** `api.get<ProductosPaginados>('/productos', { params: filtros })`. Axios convierte el objeto en query string (`?skip=0&limit=12&search=pizza`).
**Por qué lo planteamos así:** pasar `params: filtros` directo evita armar la URL a mano (y escapar caracteres a mano). **Axios omite los params que valen `undefined`**, por eso en la página se escribe `search: busquedaDemorada || undefined`: solo viajan los filtros activos. Devuelve datos tipados (pág. 17).
**Alternativa descartada:** concatenar strings (`'/productos?search=' + texto`). Frágil con caracteres especiales y hay que decidir a mano qué filtros omitir.
**Si te preguntan en el parcial:** "Paso los filtros como `params` y dejo que Axios arme el query string; los que valen `undefined` simplemente no se envían."

### `createProducto`, `updateProducto`, `updateStock`, `deleteProducto` — `features/productos/api/productos.ts`
**Qué hace:** `POST /productos`, `PUT /productos/{id}`, `PATCH /productos/{id}/stock`, `DELETE /productos/{id}`. El delete responde 204 sin cuerpo y devuelve `Promise<void>`.
**Por qué lo planteamos así:** verbos y códigos según la consigna (criterio 5: "verbos, códigos y schemas indicados; PATCH de stock; DELETE 204 lógico"). `PUT` reemplaza el recurso con todos sus campos (por eso el form de edición manda todo `ProductoInput`), y `PATCH` modifica solo una parte (stock y disponibilidad). El `DELETE` es **baja lógica**: el backend marca `activo = false`, no borra la fila (para no romper los pedidos viejos que lo referencian).
**Alternativa descartada:** `DELETE` con borrado físico (resta puntos según el criterio 5 y rompería el historial de pedidos).
**Si te preguntan en el parcial:** "Uso PUT para editar el producto completo y PATCH para el stock porque solo toca dos campos; el DELETE es lógico y responde 204 sin cuerpo."

### `getCategorias`, `createCategoria`, `updateCategoria`, `deleteCategoria` — `features/categorias/api/categorias.ts`
**Qué hace:** análogas: `GET /categorias`, `POST`, `PUT /categorias/{id}`, `DELETE` (204, baja lógica).
**Por qué lo planteamos así:** mismas razones que productos; `getCategorias` no tiene filtros porque son pocas y se usan completas en tres lugares (filtro del catálogo, `<select>` del form y tabla del admin).
**Alternativa descartada:** paginar categorías en el servidor: complejidad sin beneficio para un puñado de filas.
**Si te preguntan en el parcial:** "Las categorías son pocas, así que se traen todas de una vez; las comparten el filtro, el formulario de productos y la tabla de admin."

---

## 3. Hooks de productos

### `PRODUCTOS_KEY` — `features/productos/hooks/useProductos.ts`
**Qué hace:** `export const PRODUCTOS_KEY = ['productos'] as const;`, la raíz de todas las claves de productos.
**Por qué lo planteamos así:** la consigna pide `queryKey` descriptivas (pág. 17/20, ejemplo `['productos', filtros]`). Tener la raíz como constante exportada permite que otras features (pedidos) la usen para invalidar sin repetir el string (ver `useInvalidarPedidos`). La raíz sola, `['productos']`, sirve para invalidar **todas las variantes** de golpe por prefijo.
**Alternativa descartada:** el literal repetido en cada archivo; un typo deja de invalidar sin dar error.
**Si te preguntan en el parcial:** "`['productos']` es la raíz; cada combinación de filtros cuelga de ella, así puedo invalidar todas con una sola llamada."

### `useProductos(filtros)` — `features/productos/hooks/useProductos.ts`
**Qué hace:** `useQuery` con `queryKey: [...PRODUCTOS_KEY, filtros]`, `queryFn: () => getProductos(filtros)` y `placeholderData: keepPreviousData`.
**Por qué lo planteamos así:**
- **La queryKey es la "dirección" del dato en la caché.** Es un array que Query serializa a un hash estable (las claves de un objeto se ordenan, `{a:1,b:2}` y `{b:2,a:1}` son la misma). Si algo del array cambia, es *otra entrada de caché* y se dispara un fetch automático. Eso hace "reactivo" al catálogo: cambiás `pagina`, `busqueda` o `categoriaId`, cambia `filtros`, cambia la key y Query busca los datos nuevos. **No hay `useEffect` ni `fetch` manual** (la consigna lo prohíbe, pág. 17).
- **Regla:** todo lo que la `queryFn` usa para decidir qué pedir tiene que estar en la `queryKey`. Si no, dos pantallas distintas se pisarían la misma entrada.
- **Estructura jerárquica** `['productos', filtros]`: la raíz permite `invalidateQueries({ queryKey: ['productos'] })`, que hace match **por prefijo**.
- El Catálogo (`limit 12`) y el panel admin (`limit 100`) tienen keys distintas, entonces cachés separadas.
- **`keepPreviousData`** (v5: una función que se pasa a `placeholderData`, en v4 era `keepPreviousData: true`): al pasar de la página 1 a la 2 la key cambia; sin nada más, `data` sería `undefined` y volverías a ver el skeleton en cada click (parpadeo). Con `keepPreviousData`, mientras llega la página nueva se **sigue mostrando la anterior** y `isPlaceholderData` vale `true`. La página usa ese flag para atenuar la grilla y deshabilitar la paginación (evita clicks en una página que todavía no cargó).
**Alternativa descartada:** (a) `useState` + `useEffect` + `fetch` ante cada cambio de filtros (prohibido por consigna y propenso a respuestas fuera de orden); (b) una key sin filtros (`['productos']` a secas): todas las páginas compartirían entrada y se mostraría siempre la misma lista.
**Si te preguntan en el parcial:** "Los filtros van dentro de la queryKey, así cada combinación es una entrada de caché y Query refetchea sola al cambiar. Uso `keepPreviousData` para que al paginar se vea la página anterior en vez de un skeleton parpadeando."

### `useInvalidarProductos()` — `features/productos/hooks/useProductos.ts`
**Qué hace:** hook auxiliar (no exportado) que devuelve `() => queryClient.invalidateQueries({ queryKey: PRODUCTOS_KEY })`.
**Por qué lo planteamos así:** concentra la invalidación para no repetirla en cuatro hooks. Invalida por la **raíz**, así se refrescan todas las variantes (catálogo y panel admin). `invalidateQueries` refetchea ya las queries *activas* (en pantalla) y marca las inactivas como desactualizadas para que se pidan la próxima vez que se usen.
**Alternativa descartada:** `queryClient.invalidateQueries()` sin key: refetchearía todo (categorías, pedidos, usuarios) aunque no haya cambiado. O invalidar una key exacta con filtros: dejaría desactualizadas las otras variantes.
**Si te preguntan en el parcial:** "Invalido la raíz `['productos']` para refrescar todas las variantes de filtros sin tocar el resto de la caché."

### `useCrearProducto`, `useEditarProducto`, `useActualizarStock`, `useEliminarProducto` — `features/productos/hooks/useProductos.ts`
**Qué hace:** cuatro `useMutation` con `onSuccess: invalidar`. Los de editar y stock reciben `{ id, datos }`; el de eliminar recibe el `id`.
**Por qué lo planteamos así:** la consigna exige `useMutation` con `invalidateQueries` en `onSuccess` (pág. 20). `mutationFn` recibe **un solo argumento**, por eso editar y stock reciben un objeto `{ id, datos }` que se desarma adentro. `onSuccess` recibe la función que **devuelve la Promise** de la invalidación: Query la espera, entonces la mutación sigue "pendiente" hasta que la lista se refrescó.
**Alternativa descartada:** actualizar la lista en caché a mano. Si el backend normaliza algún dato (ej. un trim), la UI quedaría distinta de lo guardado.
**Si te preguntan en el parcial:** "Cada mutación invalida `['productos']` en `onSuccess`; como `mutationFn` recibe un solo argumento, para editar le paso un objeto `{ id, datos }`."

---

## 4. Hooks de categorías

### `CATEGORIAS_KEY` y `useCategorias()` — `features/categorias/hooks/useCategorias.ts`
**Qué hace:** `CATEGORIAS_KEY = ['categorias'] as const` y `useQuery({ queryKey: CATEGORIAS_KEY, queryFn: getCategorias })`.
**Por qué lo planteamos así:** no tiene filtros, entonces la key es fija. Se usa en tres lugares (filtro del catálogo, `<select>` del form de productos y tabla de categorías) y como comparten key **comparten caché**: es una sola request aunque tres componentes la pidan.
**Alternativa descartada:** pasar las categorías por props desde un padre común, o pedirlas en cada componente con su propio estado: más requests y más código.
**Si te preguntan en el parcial:** "Tres pantallas usan `useCategorias`; como comparten la misma key, Query hace una sola request y las tres leen la misma caché."

### `useInvalidarCategorias()` (invalida también productos) — `features/categorias/hooks/useCategorias.ts`
**Qué hace:** devuelve `() => Promise.all([invalidar(CATEGORIAS_KEY), invalidar(['productos'])])`.
**Por qué lo planteamos así:** cada producto **trae su categoría embebida** (`producto.categoria.nombre`). Si renombrás una categoría, los productos cacheados mostrarían el nombre viejo, así que hay que invalidar también `['productos']`. `Promise.all` espera ambas invalidaciones antes de dar la mutación por terminada. (Acá se usa el literal `['productos']` en vez de importar `PRODUCTOS_KEY`: funciona igual, es solo menos DRY.)
**Alternativa descartada:** invalidar solo `['categorias']`: el catálogo seguiría mostrando el nombre viejo hasta pasados 30 s (`staleTime`) o hasta recargar.
**Si te preguntan en el parcial:** "Al tocar una categoría invalido también los productos porque cada producto lleva su categoría embebida; si no, el catálogo mostraría el nombre viejo."

### `useCrearCategoria`, `useEditarCategoria`, `useEliminarCategoria` — `features/categorias/hooks/useCategorias.ts`
**Qué hace:** tres `useMutation` con `onSuccess: invalidar`; editar recibe `{ id, datos }`.
**Por qué lo planteamos así:** mismas razones que los de productos. `useEliminarCategoria` también invalida productos: la categoría dada de baja sigue embebida en productos existentes (el diálogo avisa "Sus productos no se ocultan automáticamente").
**Alternativa descartada:** una sola mutación genérica con un `tipo`: pierde el tipado de cada argumento.
**Si te preguntan en el parcial:** "Cada operación tiene su hook tipado y todas comparten el mismo invalidador."

### `useDebounce<T>(valor, demora = 300)` — `shared/hooks/useDebounce.ts` (se usa en el catálogo)
**Qué hace:** devuelve el valor recién cuando dejó de cambiar durante `demora` ms. Guarda una copia en `useState` y programa un `setTimeout` en un `useEffect` que se limpia (`clearTimeout`) si el valor cambia antes.
**Por qué lo planteamos así:** sin debounce, cada tecla cambiaría `filtros`, la queryKey y dispararía un request: tipear "pizza" mandaría 5. Con 300 ms se manda uno por búsqueda "terminada". Es un `useEffect` legítimo: **no obtiene datos**, solo retrasa un valor local (el fetch lo sigue haciendo TanStack Query, como pide la consigna: la única llamada a la API en un `useEffect` es `checkSession`). Es genérico (`<T>`) para reutilizarlo con cualquier tipo.
**Alternativa descartada:** hacer la request en cada tecla (sobrecarga el servidor y puede devolver respuestas fuera de orden), o agregar `lodash.debounce` (una dependencia más para 10 líneas).
**Si te preguntan en el parcial:** "El input se actualiza en cada tecla, pero solo el valor demorado entra a la queryKey; así hago una request por búsqueda y no una por letra."

---

## 5. Catálogo público

### `CatalogoPage()` — `features/productos/pages/CatalogoPage.tsx`
**Qué hace:** mantiene tres estados locales (`pagina`, `busqueda`, `categoriaId`), arma `filtros` con `skip: pagina * POR_PAGINA`, `limit: 12`, `search: busquedaDemorada || undefined` y `categoria_id`, llama a `useProductos(filtros)` y muestra skeleton, error, vacío o la grilla con `Paginacion`.
**Por qué lo planteamos así:**
- **Paginación en el servidor: `skip = página × limit`.** La consigna lo pide (pág. 19). La página (base 0) es estado local; el backend no conoce "páginas", conoce `skip` (cuántos saltear) y `limit` (cuántos traer). Página 0 -> `skip 0`; página 2 -> `skip 24`. El backend responde `{ total, items }` y con `total` se calcula cuántas páginas hay. Se hace en el servidor porque con miles de productos descargar todo es lento y gasta memoria: el servidor entrega solo 12.
- **Resetear la página al cambiar un filtro** (`cambiarBusqueda` y `cambiarCategoria` llaman a `setPagina(0)`): si estás en la página 5 y filtrás por una categoría con 2 páginas, `skip = 60` devolvería vacío.
- **Debounce de 300 ms** sobre `busqueda.trim()` (ver `useDebounce`): el input responde a cada tecla pero solo el valor demorado entra en `filtros`.
- **`busquedaDemorada || undefined`**: un string vacío pasa a `undefined` para que Axios no mande `?search=`.
- **`hayFiltros`** (`Boolean(busquedaDemorada) || categoriaId !== undefined`) cambia el texto del estado vacío: "No hay productos que coincidan" vs "Todavía no hay productos". Son dos situaciones distintas para el usuario.
- **Los estados de la UI** (criterio 7: "skeleton mientras carga; estado vacío"):

| Estado | Condición | Qué se ve |
|--------|-----------|-----------|
| Cargando (primera vez) | `isPending` (todavía no hay `data`) | `SkeletonGrid` (8 tarjetas fantasma) |
| Error | `isError` | `EstadoError` con el `detail` del backend y "Reintentar" (`refetch`) |
| Vacío | `data.items.length === 0` | `EstadoVacio` |
| Con datos | resto | grilla + `Paginacion` |

  Con `keepPreviousData`, al cambiar de página `isPending` es `false` (hay datos placeholder), así que **el skeleton solo aparece en la primera carga**; después se usa la atenuación (`opacity-60`) y la paginación deshabilitada vía `isPlaceholderData`. El orden de las ramas permite que TypeScript sepa que en la última `data` está definido.
**Alternativa descartada:** traer todo el catálogo y paginar/filtrar en el cliente: la consigna pide servidor, y no escala. También se descartó guardar la página en la URL (`?page=`): no lo pide la consigna y agrega complejidad.
**Si te preguntan en el parcial:** "Paginé en el servidor con `skip = página × limit` porque la consigna lo pide y porque no tiene sentido traer todos los productos al navegador. Al cambiar un filtro vuelvo a la página 0 para no pedir una página que ya no existe."

### `FiltrosCatalogo({ busqueda, categoriaId, categorias, onBusqueda, onCategoria })` — `features/productos/components/FiltrosCatalogo.tsx`
**Qué hace:** dibuja un input de búsqueda y un `<select>` de categorías. El select usa `value={categoriaId ?? ''}` y convierte con `e.target.value ? Number(e.target.value) : undefined`.
**Por qué lo planteamos así:** es **presentacional puro** (container–presentational): no tiene estado propio, el padre manda los valores y recibe eventos. Eso lo hace trivial de testear y reutilizar, y deja toda la lógica de filtros (reseteo de página, debounce) en un solo lugar: la página. El `<option value="">` ("Todas las categorías") equivale a `undefined` (no filtrar). Los `aria-label` dan nombre accesible a los controles que no tienen `<label>` visible.
**Alternativa descartada:** que el componente maneje su propio estado y debounce: la página no se enteraría y no podría resetear la paginación.
**Si te preguntan en el parcial:** "Los filtros son un componente presentacional: reciben valores y avisan cambios; la página es la dueña del estado."

### `ProductoCard({ producto })` — `features/productos/components/ProductoCard.tsx`
**Qué hace:** muestra imagen, nombre, categoría, descripción, precio, stock y un botón "Agregar al carrito". Lee del `cartStore` la cantidad de ese producto: `useCartStore((s) => s.items.find(...)?.cantidad ?? 0)`.
**Por qué lo planteamos así:**
- La consigna permite que los componentes lean los stores de sesión y carrito (pág. 17). Es el único componente del catálogo que toca un store.
- El selector devuelve un **número** (primitivo), así la tarjeta solo se re-renderiza cuando cambia la cantidad *de ese producto*, no cuando cambia cualquier ítem del carrito. Si devolviera el array, se re-renderizarían todas las tarjetas.
- Reglas de UI: `sinStock = stock === 0`; `vendible = disponible && !sinStock`; `alcanzoElStock = enCarrito >= stock`. El botón se deshabilita si `!vendible || alcanzoElStock` y dice "Máximo en el carrito". Es **UX**: el backend vuelve a validar stock al crear el pedido.
- `agregarAlCarrito` arma el `ProductoParaCarrito` con `precio_unitario: producto.precio_base` y el `stock` conocido, que acota las cantidades del carrito.
**Alternativa descartada:** que la página pase `onAgregar` desde arriba: obligaría a subir el store hasta `CatalogoPage` sin ventaja. O permitir agregar sin límite y descubrir el error recién en el checkout.
**Si te preguntan en el parcial:** "La tarjeta lee del carrito solo la cantidad de su producto, así se re-renderiza únicamente cuando cambia eso; y deshabilito el botón al llegar al stock como ayuda al usuario, aunque el backend igual lo valida."

### `ImagenProducto({ url, nombre, className })` — `features/productos/components/ImagenProducto.tsx`
**Qué hace:** muestra `<img>`; si no hay `url` o la imagen falla (`onError -> setFallo(true)`), muestra un recuadro con un emoji en su lugar. Usa `loading="lazy"`.
**Por qué lo planteamos así:** la URL la carga el admin a mano (opcional), así que puede ser inexistente o estar rota: sin fallback el usuario vería un ícono de imagen rota. `loading="lazy"` hace que el navegador cargue la imagen solo cuando está cerca del viewport. Se reutiliza en `ProductoCard`, `columnasProductos` e `ItemCarritoFila` (un componente, un comportamiento).
**Alternativa descartada:** validar en el backend que la URL cargue (no se puede garantizar: la imagen puede caerse después).
**Si te preguntan en el parcial:** "La imagen es opcional y puede fallar, por eso tiene un fallback con `onError`, y la cargo en `lazy` para no bajar imágenes que no se ven."

---

## 6. Admin de categorías

### `AdminCategoriasPage()` — `features/categorias/pages/AdminCategoriasPage.tsx`
**Qué hace:** concentra la query, las tres mutaciones y el estado de la UI (formulario abierto, categoría a eliminar). Muestra `DataTable` de categorías con un botón "+ Nueva categoría", un modal de formulario y un `ConfirmModal` de baja.
**Por qué lo planteamos así:**
- **Unión discriminada `EstadoFormulario = { abierto: false } | { abierto: true; categoria: Categoria | null }`**: si `abierto` es `false` no existe `categoria`; si es `true`, existe (y `null` significa alta). TypeScript no te deja leer `formulario.categoria` sin comprobar `formulario.abierto` (por eso `guardar` empieza con `if (!formulario.abierto) return;`). Mucho más seguro que dos booleans sueltos que podrían quedar en combinaciones imposibles.
- **`abrirFormulario(categoria)` hace `crear.reset(); editar.reset();`** para limpiar errores de intentos anteriores antes de abrir; si no, al reabrir se vería el error viejo.
- **`guardar(datos)`**: según `formulario.categoria` hace `editar.mutateAsync({ id, datos })` o `crear.mutateAsync(datos)`; si sale bien `cerrarFormulario()`. **El `catch` vacío es intencional: el modal queda abierto mostrando el error** (409 nombre duplicado, 404). Si cerráramos igual, el usuario perdería lo que escribió y no sabría por qué falló; así corrige y reintenta.
- **Eliminar con `ConfirmModal`** y `eliminar.mutate(id, { onSuccess: () => setAEliminar(null) })`: cierra solo si salió bien; si falla, el error se muestra dentro del modal (`error={eliminar.isError ? ... : null}`). Es **baja lógica**. Usamos un diálogo propio en lugar de `window.confirm` porque es accesible, se ve igual en todos los navegadores, tiene estilo de la app, puede mostrar spinner y error del backend y se puede testear; `window.confirm` bloquea el hilo y no permite nada de eso.
- **`errorFormulario = formulario.abierto && formulario.categoria ? editar.error : crear.error`** elige el error de la mutación que corresponde (alta o edición).
- **`useMemo(() => crearColumnasCategorias({...}), [])`** con deps vacías: las acciones solo usan *setters* de estado y `reset` de mutaciones (referencias estables), como aclara el comentario. Sin `useMemo`, las columnas serían un array nuevo en cada render y la tabla las recalcularía.
- **`isLoading`** en vez de `isPending`, con `!data || data.length === 0` en el vacío: acá se guarda `!data` explícitamente porque `isLoading` por sí solo no le asegura a TypeScript que `data` esté definido en las ramas siguientes (con `isPending` el orden de las ramas lo asegura, como en las otras páginas).
- Los cuatro estados (`SkeletonFilas`, `EstadoError`, `EstadoVacio`, `DataTable`), igual que el resto del panel.
**Alternativa descartada:** `window.confirm` para borrar; un único booleano `modalAbierto` más otro `categoriaSeleccionada` (estados que pueden desincronizarse); cerrar el modal siempre tras el submit.
**Si te preguntan en el parcial:** "Si el backend responde 409 o 404 dejo el modal abierto con el error, porque el usuario necesita corregir el dato sin perder lo que escribió. Para borrar uso un `ConfirmModal` propio y no `window.confirm`, porque puede mostrar el error del backend y es accesible."

### `CategoriaFormModal({ categoria, error, onSubmit, onClose })` — `features/categorias/components/CategoriaFormModal.tsx`
**Qué hace:** formulario con TanStack Form para alta y edición. `defaultValues: { nombre: categoria?.nombre ?? '', descripcion: categoria?.descripcion ?? '' }`. En `onSubmit` normaliza: `nombre.trim()` y `descripcion: textoOpcional(...)` (vacío -> `null`), y llama a `onSubmit` del padre.
**Por qué lo planteamos así:**
- **Un solo formulario para crear y editar**: en alta los valores son vacíos, en edición vienen precargados. `categoria: Categoria | null` (`null` = alta) lo expresa en el tipo.
- **La página lo monta con `key` y solo cuando está abierto** (`{formulario.abierto && <CategoriaFormModal key={formulario.categoria?.id ?? 'nueva'} .../>}`). `useForm` lee `defaultValues` **solo al montarse**; con una `key` distinta (cada categoría tiene su id, el alta usa `'nueva'`) cada apertura crea un form nuevo con los valores correctos. Es la forma idiomática de "resetear" un estado con `key`.
- **El formulario no sabe de mutaciones**: recibe `onSubmit` y `error` por props. Así es presentacional y la página decide qué hacer con el resultado (cerrar o no).
- **Validación**: `nombre` con `longitud('El nombre', 2, 100)` (igual que el schema del backend); `descripcion` sin validador porque es opcional. Se valida en `onChange` para feedback inmediato.
- `textoOpcional` convierte `''` en `null`: el backend espera `null` para "sin descripción", no un string vacío.
**Alternativa descartada:** dos componentes (`CrearCategoriaModal` y `EditarCategoriaModal`): código duplicado. O resetear los valores con `form.reset()` en un `useEffect`: más frágil que una `key`.
**Si te preguntan en el parcial:** "El mismo formulario sirve para crear y editar; lo monto con una `key` y solo cuando está abierto porque `useForm` lee los valores iniciales una única vez, y así cada apertura arranca limpia."

### `AccionesCategoria` y `crearColumnasCategorias(acciones)` — `features/categorias/components/columnasCategorias.tsx`
**Qué hace:** fábrica `crearColumnasCategorias({ onEditar, onEliminar }): ColumnDef<Categoria>[]` con columnas `id` ("N.º", ancho fijo por `meta.className`), `nombre` (negrita), `descripcion` (`getValue<string | null>() ?? '—'`) y `acciones` (`RowActions`, `enableSorting: false`).
**Por qué lo planteamos así:** las columnas son **funciones tipadas que reciben las acciones** (callbacks) de la página, en lugar de escribirse dentro de ella: el archivo de columnas no depende de hooks ni de stores y los callbacks llegan con su tipo exacto (`(categoria: Categoria) => void`). `RowActions` es el componente compartido de Editar/Eliminar (mismo aspecto en todos los ABM). `getValue<string | null>() ?? '—'` muestra un guion cuando la descripción es `null`.
**Alternativa descartada:** definir `const columnas: ColumnDef<Categoria>[] = [...]` como constante de módulo: no podría recibir los callbacks de la página.
**Si te preguntan en el parcial:** "Las columnas se arman con una función que recibe las acciones; así el archivo queda tipado y desacoplado de la página."

---

## 7. Admin de productos

### `AdminProductosPage()` — `features/productos/pages/AdminProductosPage.tsx`
**Qué hace:** igual que la de categorías pero con **tres modales**: formulario de alta/edición (`formulario`), stock (`enStock`) y confirmación de baja (`aEliminar`). Pide los productos con `useProductos(FILTROS_PANEL)` y las categorías con `useCategorias()` para alimentar el `<select>` del formulario.
**Por qué lo planteamos así:**
- **`const FILTROS_PANEL: FiltrosProductos = { skip: 0, limit: 100 }` fuera del componente**: la consigna pide que el panel traiga hasta 100 y la tabla pagine del lado del cliente (pág. 20). Al ser una constante de módulo, la referencia es estable (Query compara la key por valor, pero igual evita recrear el objeto en cada render).
- **Reutiliza el mismo `useProductos`** que el catálogo: lo único que cambia es la key (`limit 100` vs `limit 12`), entonces son cachés separadas con el mismo código.
- **Tres estados separados** (`formulario`, `enStock`, `aEliminar`) porque son tres modales independientes con ciclos de vida distintos.
- **`guardarStock`**: `actualizarStock.mutateAsync({ id, datos })`; si sale bien `setEnStock(null)`; si falla, **el modal queda abierto** y el error aparece adentro (`error={actualizarStock.isError ? ... : null}`), como en el resto de modales: ante un 404 (producto dado de baja mientras tanto) el admin ve el motivo.
- Mismo `useMemo(..., [])` con acciones estables, mismo `ConfirmModal` de baja y los cuatro estados (skeleton, error, vacío, tabla).
- Limitación consciente: más de 100 productos no se verían en el panel.
**Alternativa descartada:** paginar en el servidor también el panel (la consigna pide explícitamente cliente para el panel), o un único modal con modos.
**Si te preguntan en el parcial:** "El panel pide `limit=100` una sola vez y la tabla pagina, ordena y busca en memoria, como pide la consigna. Reutilizo el mismo hook del catálogo, solo cambia la key."

### `AccionesProducto` y `crearColumnasProductos(acciones)` — `features/productos/components/columnasProductos.tsx`
**Qué hace:** fábrica `crearColumnasProductos({ onEditar, onStock, onEliminar }): ColumnDef<Producto>[]`.

| Columna | Definición | Para qué |
|---------|-----------|----------|
| Producto | `accessorKey: 'nombre'` + `cell` con `ImagenProducto` y descripción | Celda compuesta |
| Categoría | `id: 'categoria'`, `accessorFn: (p) => p.categoria.nombre` | **Columna calculada** |
| Precio | `accessorKey: 'precio_base'` + `formatoPrecio.format` | Alineado a la derecha vía `meta.className` |
| Stock | `accessorKey: 'stock'` | En rojo si es 0 |
| Estado | `accessorKey: 'disponible'` | Badge Disponible / No disponible |
| Acciones | `id: 'acciones'`, `enableSorting: false` | `RowActions` con un botón extra "Stock" como `children` |

**Por qué lo planteamos así:** misma lógica de fábrica que las categorías. La columna **Categoría es calculada** porque `categoria` es un objeto anidado: con `accessorKey: 'categoria'` la tabla ordenaría y buscaría sobre `[object Object]`; el `accessorFn` extrae el string `p.categoria.nombre` y así la búsqueda global encuentra por nombre de categoría (por eso el placeholder dice "Buscar producto o categoría…"). Diferencia que suelen preguntar: `accessorKey` apunta a una propiedad directa; `accessorFn` calcula el valor (y **requiere `id`** porque no hay clave de la que derivarlo); una columna sin dato (`acciones`) solo lleva `id`. El stock en rojo con 0 y el badge de disponible ayudan a leer el estado a simple vista. El botón "Stock" va como `children` de `RowActions` para no duplicar Editar/Eliminar.
**Alternativa descartada:** mostrar `categoria_id` (un número no le dice nada al admin) o aplanar los datos antes de pasarlos a la tabla.
**Si te preguntan en el parcial:** "La categoría viene como objeto anidado, así que usé un `accessorFn` con `id` propio para que la tabla pueda buscar y ordenar por el nombre."

### `ProductoFormModal({ producto, categorias, error, onSubmit, onClose })` — `features/productos/components/ProductoFormModal.tsx`
**Qué hace:** formulario de alta/edición de producto con TanStack Form: nombre, descripción, categoría (select), precio, stock, URL de imagen y checkbox "disponible". `valoresDe(producto)` arma los valores iniciales. Al enviar convierte a `ProductoInput`.
**Por qué lo planteamos así:**
- **El tipo del form (`ProductoForm`) NO es el del backend (`ProductoInput`)**: en el form los textos opcionales son `string` (no `null`) porque un `<input>` controlado necesita string; los números son `number` con `NaN` como "vacío". En `onSubmit` se convierte: `descripcion: textoOpcional(...)`, `imagen_url: textoOpcional(...)`, `nombre.trim()`. Dos tipos distintos porque son dos "formas" distintas del mismo dato (la de la UI y la de la API).
- **Números y `NaN`**: `precio_base` arranca en `Number.NaN` en el alta. `<input type="number">` entrega `valueAsNumber`, que es `NaN` si está vacío. Se renderiza con `value={Number.isNaN(field.state.value) ? '' : field.state.value}` y `numeroNoNegativo` trata `NaN` como "obligatorio". Así se distingue "vacío" de "0" (un precio 0 es un valor distinto de no haber escrito nada).
- **Select numérico**: `onChange={(e) => field.handleChange(Number(e.target.value))}`; `<option value={0}>Seleccioná una categoría…</option>` y validador `value > 0 ? undefined : 'Elegí una categoría'`. Un `0` funciona como "sin elegir" porque ninguna categoría real tiene id 0.
- **Checkbox**: se usa `checked` y `e.target.checked` (no `value`).
- **Validadores** (todos `onChange`): `longitud('El nombre', 2, 150)`, `numeroNoNegativo('El precio')`, `numeroNoNegativo('El stock', true)` (entero), `urlOpcional` (usa `URL.canParse`, máx. 500). Espejan los límites del backend; son UX, el servidor igual valida.
- Mismo mecanismo que categorías: `key` para resetear, `error` desde la mutación, `FormActions` compartido. Si el backend responde 404 (categoría inexistente) o 409, el modal queda abierto.
**Alternativa descartada:** usar `ProductoInput` directamente como tipo del form: `null` en un `<input value>` genera warnings de React y no se podría representar "campo vacío" en los números.
**Si te preguntan en el parcial:** "El formulario tiene su propio tipo porque los inputs necesitan strings y `NaN` para vacío; al enviar lo convierto a `ProductoInput` con `textoOpcional` y `trim`."

### `StockModal({ producto, error, onSubmit, onClose })` — `features/productos/components/StockModal.tsx`
**Qué hace:** form mínimo para `PATCH /productos/{id}/stock`: solo `stock` (entero >= 0) y `disponible`. `defaultValues` sale del producto recibido y `onSubmit` envía `value` tal cual (ya es un `ProductoStockUpdate`).
**Por qué lo planteamos así:** la consigna pide "cambio de stock y disponibilidad" (pág. 20, criterio 8) como algo distinto de editar todo el producto: es la operación más frecuente del negocio (reponer mercadería) y no tiene sentido abrir un form de siete campos para eso. Además usa el endpoint `PATCH` específico (criterio 5), que no puede pisar por error precio o categoría.
**Alternativa descartada:** editar el stock desde el formulario general con `PUT`: más campos expuestos, más riesgo de modificar algo por accidente.
**Si te preguntan en el parcial:** "El stock tiene su modal y su endpoint `PATCH` porque es lo que más se modifica y así solo se tocan stock y disponibilidad."

---

## 8. Qué se invalida y qué se refresca

Cualquier mutación de productos invalida `['productos']`: se refresca el listado del admin (query activa) y el catálogo queda marcado como desactualizado para cuando se vuelva a montar (entrada inactiva: refetch en el próximo uso). Sin recargar la página y sin tocar estado a mano.

| Mutación | Invalida | Por qué |
|----------|----------|---------|
| Crear/editar/stock/eliminar producto | `['productos']` | Cambia la lista (o el stock) |
| Crear/editar/eliminar categoría | `['categorias']` y `['productos']` | Los productos llevan la categoría embebida |
| Crear/cancelar pedido (ver `05`) | `['pedidos']` y `['productos']` | Mueve stock |
