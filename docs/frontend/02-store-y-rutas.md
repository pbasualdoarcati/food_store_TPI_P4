# 02 - Stores (Zustand), rutas y punto de entrada

> Archivos: `src/store/authStore.ts`, `src/store/cartStore.ts`, `src/routes/AppRouter.tsx`, `src/routes/ProtectedRoute.tsx`, `src/App.tsx`, `src/main.tsx`.
>
> Cómo leer este doc: cada pieza tiene cuatro bloques: **Qué hace**, **Por qué lo planteamos así** (separando lo que *exige la consigna* de lo que *decidimos nosotros*), **Alternativa descartada** y **Si te preguntan en el parcial** (respuesta corta en primera persona para decir en voz alta).

---

## 0. Zustand en 60 segundos (el concepto antes del código)

Zustand es una librería de estado global mínima. Un *store* se crea con `create` y se usa como un hook:

```ts
const usuario = useAuthStore((s) => s.usuario);   // suscripción con SELECTOR
```

- **Selector** `(s) => s.usuario`: el componente solo se re-renderiza cuando *ese* trozo cambia. Con `useAuthStore()` sin selector se re-renderizaría con **cualquier** cambio del store.
- `set(...)` actualiza el estado (merge superficial del objeto que le pasás).
- `get()` lee el estado actual dentro del store.
- `useAuthStore.getState()` lee/ejecuta acciones **fuera de React** (ej. el interceptor de Axios).
- No necesita `Provider` (a diferencia de Context o Redux): el store es un módulo singleton.

`create<AuthState>()(...)` con **doble paréntesis** es la forma de Zustand para TypeScript cuando se usan middlewares como `persist`: el primer `()` fija el tipo genérico, el segundo recibe la función.

**Por qué Zustand y no Context/Redux (la consigna lo pide, pág. 17 y 20):** la consigna fija "Zustand 5.x - Estado global del cliente (sesión y carrito)". Aparte de ser requisito, técnicamente es la opción correcta para *nuestro* caso porque necesitamos leer y escribir la sesión **desde fuera de React** (el interceptor de Axios). Context solo existe dentro del árbol de componentes, y Redux exigiría más boilerplate (actions, reducers, Provider) para dos stores chicos.

---

## 1. `store/authStore.ts`

### `useAuthStore` (el store completo) — `src/store/authStore.ts`

**Qué hace:** define el estado de sesión `{ usuario, cargando }` y las acciones `login`, `logout`, `checkSession` y `limpiarSesion`, envuelto en `persist` para guardar solo el `usuario` en `localStorage` (clave `foodstore-auth`).

```ts
interface AuthState {
  usuario: Usuario | null;
  cargando: boolean;               // true mientras checkSession confirma la sesión
  login: (username: string, password: string) => Promise<Usuario>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  limpiarSesion: () => void;
}
```

`Usuario` (en `features/auth/types`) es el `UserPublic` del backend: `id, username, full_name, email, role, disabled, created_at`. **No** tiene `hashed_password` ni token.

**Por qué lo planteamos así:**
- *Lo exige la consigna (pág. 20, tabla "Estado, datos y sesión"):* "authStore: Zustand + persist con partialize. `usuario` (nombre, email y rol), `cargando` y las acciones login, logout y checkSession. `partialize` guarda solo `usuario`; nunca el token". Y el criterio 4 resta puntos por "Token en el cuerpo o en localStorage".
- *Decisión nuestra:* agregar `limpiarSesion` como acción separada de `logout`. `logout` llama a la API; `limpiarSesion` solo borra el usuario local. El interceptor necesita lo segundo: si la sesión ya venció en el servidor, llamar a `POST /auth/logout` no tiene sentido y además podría dar otro 401 y volver a disparar el interceptor.
- El `usuario` vive en Zustand y no en TanStack Query aunque venga del servidor (`GET /auth/me`), porque es estado de sesión que lo **escribe el cliente** (`login`, `logout`, `limpiarSesion`) y lo tocan cosas fuera de React.

**Alternativa descartada:** guardar `{ token, usuario }` en el store con `persist` (o `localStorage.setItem('token', ...)`). Es lo más común en tutoriales, pero cualquier script inyectado (XSS) podría leerlo con `localStorage.getItem`. Con cookie HttpOnly el JS ni siquiera ve el token. También descartamos `useContext` + `useReducer`: no se puede leer desde el interceptor.

**Si te preguntan en el parcial:** "El store guarda solo el usuario público; el JWT vive en una cookie HttpOnly que el navegador adjunta solo. Lo hice así porque la consigna lo pide y porque un token en localStorage queda expuesto a XSS."

---

### Estado inicial `usuario: null, cargando: true` — `src/store/authStore.ts`

**Qué hace:** arranca sin usuario y con `cargando = true`. Significa "todavía no sé si hay sesión".

**Por qué lo planteamos así:** *decisión nuestra, necesaria por la consigna:* la consigna pide que `ProtectedRoute` "muestre un indicador mientras `checkSession` confirma la sesión" (pág. 20). Para distinguir "no hay sesión" de "no sé todavía" necesitamos un tercer estado, y eso es `cargando`. Si arrancara en `false`, en el primer render `usuario` sería `null` (si no había nada persistido) y `ProtectedRoute` te mandaría a `/login` aunque tengas cookie válida: un redirect falso en cada recarga.

**Alternativa descartada:** `cargando: false` por defecto y activarlo recién dentro de `checkSession`. Un `useEffect` corre *después* del primer render, así que habría un render intermedio con `cargando = false` donde `ProtectedRoute` ya decidió con datos sin confirmar. Otra alternativa: `usuario: Usuario | null | undefined` (undefined = desconocido); funciona, pero un booleano explícito es más legible.

**Si te preguntan en el parcial:** "`cargando` arranca en true porque al abrir la app aún no sé si la cookie es válida; así la ruta protegida espera en vez de redirigir al login por error."

---

### `login(username, password): Promise<Usuario>` — `src/store/authStore.ts`

**Qué hace:** 1) `await loginRequest(...)`: `POST /auth/token`, el backend setea la cookie HttpOnly; 2) `await getMe()`: `GET /auth/me`; 3) `set({ usuario, cargando: false })`; 4) devuelve el usuario.

```ts
await loginRequest(username, password);
const usuario = await getMe();
set({ usuario, cargando: false });
return usuario;
```

**Por qué lo planteamos así:**
- *Lo impone el contrato del backend:* `/auth/token` responde `{message}` y deja el token en la cookie; **no devuelve el usuario**. Por eso hay que preguntar a `/auth/me`.
- *Decisión nuestra:* devolver el `Usuario` para que `LoginPage` decida adónde navegar según el rol (admin a `/admin/resumen`, otro a `/` o a la ruta de origen). Y poner `cargando: false` acá para que, si el usuario se loguea antes de que termine `checkSession`, no quede el estado "verificando".
- Si falla `loginRequest` o `getMe`, la promesa rechaza y el `set` no se ejecuta: no queda un usuario a medias. El error lo muestra el formulario con `handleApiError`.

**Alternativa descartada:** que el backend devuelva el usuario en el login (cambia el contrato), o decodificar el JWT en el front para sacar el rol (requiere tener el token en JS, justo lo que evitamos; además el front no puede verificar la firma).

**Si te preguntan en el parcial:** "Login es en dos pasos porque el backend deja el token en la cookie y no devuelve el usuario; entonces después del POST pido `/auth/me`. Devuelvo el usuario para navegar según rol."

---

### `logout(): Promise<void>` — `src/store/authStore.ts`

**Qué hace:** llama a `POST /auth/logout` (el backend borra la cookie). Pase lo que pase (`finally`): `set({ usuario: null })`, `queryClient.clear()` y `useCartStore.getState().vaciar()`.

```ts
try { await logoutRequest(); }
finally {
  set({ usuario: null });
  queryClient.clear();
  useCartStore.getState().vaciar();
}
```

**Por qué lo planteamos así:**
- *Lo exige la consigna (pág. 20, fila Logout):* "Llama a POST /auth/logout, limpia el authStore y redirige a /login". La redirección la hace `Navbar.cerrarSesion`.
- *Decisión nuestra, el `finally`:* si el POST falla (sin red, backend caído), igual tiene que quedar cerrada la sesión *localmente*. Sin `finally`, un error dejaría al usuario "logueado" en pantalla sin poder salir.
- *Decisión nuestra, `queryClient.clear()`:* la caché de TanStack Query tiene pedidos, usuarios, etc. del usuario anterior. Si el siguiente usuario del mismo navegador los viera (aunque sea un instante) sería una fuga de datos.
- *Decisión nuestra, `vaciar()` del carrito:* `cartStore` persiste en `localStorage`, que sobrevive al logout. Sin vaciarlo, el próximo usuario que inicie sesión en ese navegador heredaría el carrito del anterior (comentario del código).
- *Por qué `getState()`:* `logout` es una acción del store, no un componente; no puede llamar al hook `useCartStore()`. `getState()` es la API de Zustand para leer/ejecutar acciones fuera de React.

**Alternativa descartada:** `window.location.reload()` para "limpiar todo": funciona pero es tosco, pierde el estado de la UI y esconde la mezcla de responsabilidades. Limpiar solo el store y dejar la caché de Query: fuga de datos entre usuarios. No vaciar el carrito: en un navegador compartido el carrito del usuario A aparecería a nombre del usuario B al hacer checkout.

*Matiz honesto:* cuando la sesión vence por 401, el interceptor llama a `limpiarSesion` + `queryClient.clear()` pero **no** vacía el carrito. Lo verifiqué en el código: solo `logout` lo vacía. Es razonable (es el mismo usuario que probablemente vuelva a loguearse), pero si te lo marcan como inconsistencia, reconocelo como una decisión no explícita.

**Si te preguntan en el parcial:** "Logout limpia en un `finally` para que se cierre la sesión local aunque falle la red; además borro la caché de Query y vacío el carrito para que el próximo usuario del navegador no vea datos del anterior."

---

### `checkSession(): Promise<void>` — `src/store/authStore.ts`

**Qué hace:** `set({ cargando: true })`; intenta `getMe()` y, si anda, guarda el usuario; si falla (401 sin cookie/vencida, 400 cuenta desactivada) deja `usuario: null`; en `finally` pone `cargando: false`.

```ts
set({ cargando: true });
try { const usuario = await getMe(); set({ usuario }); }
catch { set({ usuario: null }); }
finally { set({ cargando: false }); }
```

**Por qué lo planteamos así:**
- *Lo exige la consigna (pág. 20):* "checkSession (llama a /auth/me al montar la aplicación)".
- *Decisión nuestra, es la fuente de verdad:* el `usuario` hidratado desde `localStorage` puede estar desactualizado (la cookie venció, desactivaron la cuenta, alguien editó el storage). `checkSession` lo **sobrescribe** con lo que dice el servidor.
- *Por qué cualquier error = sin sesión:* para la UI da igual el motivo; no hay sesión válida.
- `/auth/me` está en `RUTAS_SIN_INTERCEPTAR`: el 401 acá es una respuesta *normal* (no hay sesión). Si el interceptor lo tratara como "sesión vencida", redirigiría a `/login` cada vez que un visitante anónimo abre el catálogo.
- El `finally` garantiza que `cargando` termine en `false` pase lo que pase; si no, quedaría el spinner infinito.

**Alternativa descartada:** confiar en el `usuario` persistido sin verificar (mostrarías botones de admin con una cookie vencida) o verificar en cada ruta protegida (N requests en vez de 1).

**Si te preguntan en el parcial:** "`checkSession` corre una vez al montar y confirma con `/auth/me` si la cookie sigue valiendo; es la fuente de verdad que pisa lo que quedó en localStorage. Cualquier error significa que no hay sesión."

---

### `limpiarSesion(): void` — `src/store/authStore.ts`

**Qué hace:** `set({ usuario: null })`, síncrona, sin llamar a la API.

**Por qué lo planteamos así:** *decisión nuestra:* la usa el interceptor cuando el servidor ya dijo que la sesión es inválida (401 o cuenta desactivada). Llamar a `/auth/logout` ahí sería inútil y podría generar otro 401 en cadena. Al quedar `usuario = null`, `ProtectedRoute` redirige solo (la consigna: "la vuelta a /login la hace el propio interceptor o ProtectedRoute al quedar sin usuario").

**Alternativa descartada:** que el interceptor llame a `logout()`: haría una request más que probablemente falle y el interceptor la interceptaría otra vez (riesgo de loop).

**Si te preguntan en el parcial:** "`limpiarSesion` es el logout local, sin request: el interceptor la usa cuando el servidor ya invalidó la sesión."

---

### `persist` + `partialize` (la parte que más preguntan)

```ts
persist(
  (set) => ({ ... }),
  {
    name: 'foodstore-auth',
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({ usuario: state.usuario }),
  },
)
```

| Opción | Qué hace |
|--------|----------|
| `name` | Clave en `localStorage` (`foodstore-auth`). El valor guardado es `{"state":{"usuario":{...}},"version":0}` |
| `storage: createJSONStorage(() => localStorage)` | Serializa a JSON y usa `localStorage`. La función perezosa evita acceder a `localStorage` si no existe (SSR/tests) |
| `partialize` | **Elige qué parte del estado se guarda.** Solo `usuario` |

**Por qué `partialize` guarda únicamente `usuario`** (consigna pág. 20: "partialize guarda solo usuario; nunca el token"):

1. `cargando` **no debe persistirse**: si se guardara `false`, al recargar la app creería que ya terminó de verificar y `ProtectedRoute` decidiría con datos sin confirmar. Tiene que arrancar en `true` siempre.
2. Las **funciones** (`login`, `logout`...) no se serializan a JSON; quedarían fuera igual.
3. **Nunca el token**: no está en el store de ninguna manera; vive en la cookie HttpOnly.

**Alternativa descartada:** `persist` sin `partialize` (guarda todo el estado): persistiría `cargando` y rompería la lógica anterior. Y no persistir nada: el Navbar mostraría "Ingresar" un instante en cada recarga hasta que `checkSession` responda.

**¿Para qué persistir el usuario si `checkSession` igual lo verifica?** Para la UX en la recarga: el Navbar muestra el nombre y rol *de inmediato*, sin el parpadeo "Ingresar → Hola Pablo". Y **no es un riesgo de seguridad**: si alguien edita el `localStorage` y se pone `role: 'admin'`, solo ve botones de admin; cada request se valida con la cookie en el backend (`require_role` → 403) y `checkSession` **sobrescribe** `usuario` al cargar.

**Secuencia al recargar la página:**
1. Se crea el store: `usuario` se *hidrata* sincrónicamente desde `localStorage` (ese storage es síncrono), `cargando = true`.
2. `App` monta y llama `checkSession()`.
3. `ProtectedRoute` ve `cargando = true` y muestra "Verificando sesión…".
4. `getMe()` responde: éxito → `usuario` actualizado; error → `usuario = null` (y `persist` lo sobrescribe en `localStorage`, porque guarda en cada `set`).
5. `cargando = false` → `ProtectedRoute` decide con datos confirmados.

**Si te preguntan en el parcial:** "Con `partialize` persisto solo `usuario`: `cargando` tiene que arrancar siempre en true y el token no existe en JS. Persistir el usuario es solo para que el Navbar no parpadee; la verdad la dice `checkSession`."

---

### `getState()` fuera de React y el import circular

El interceptor (`shared/api/axiosInstance.ts`) hace `useAuthStore.getState().limpiarSesion()`. Un interceptor no es un componente: no puede usar hooks. `getState()` es la API de Zustand para eso. Y `authStore` importa `queryClient` directamente (sin hook) porque `queryClient` es un singleton exportado.

**El ciclo de imports (conocido):**

```
authStore.ts ──> features/auth/api/auth.ts ──> shared/api/axiosInstance.ts ──> authStore.ts
```

**Por qué funciona:** en ESM, cuando hay un ciclo, un módulo puede recibir el import de otro que *todavía no terminó de evaluarse*. Eso solo rompe si usás el valor **durante la evaluación del módulo** (a nivel superior). En `axiosInstance.ts`, `useAuthStore` se usa únicamente *dentro de la función del interceptor*, que corre cuando ya llegó una respuesta de red, mucho después de que se cargaron todos los módulos. Y `authStore.ts` usa `loginRequest`/`getMe` solo dentro de las acciones, también diferido. Nunca se toca una referencia "vacía".

**Cuándo se rompería:** si alguien escribe en `axiosInstance.ts` algo como `const usuario = useAuthStore.getState().usuario` a nivel de módulo, o si `authStore` llamara `getMe()` al crearse.

**Cómo lo arreglaría (inversión de dependencia):** que `axiosInstance` no conozca el store. Por ejemplo, exportar `registrarManejadorSesionVencida(fn)` en `axiosInstance.ts`; el interceptor llama a `fn` si está registrada, y quien la registra es `authStore.ts` (o `main.tsx`) pasándole `() => { limpiarSesion(); queryClient.clear(); }`. Así la flecha va en una sola dirección: `authStore → axiosInstance`. No lo hicimos porque agrega indirección para un ciclo que es inocuo mientras se respete la regla de "uso diferido", y la consigna espera que el interceptor limpie el `authStore`.

**Si te preguntan en el parcial:** "Hay un ciclo authStore → api → axiosInstance → authStore. Anda porque el interceptor usa el store solo dentro de una función, en tiempo de ejecución, no al importar. Para eliminarlo invertiría la dependencia: el interceptor recibe un callback registrado por el store."

---

## 2. `store/cartStore.ts`

### Tipos `ItemCarrito` y `ProductoParaCarrito` — `src/store/cartStore.ts`

```ts
export interface ItemCarrito {
  producto_id: number; nombre: string; precio_unitario: number; cantidad: number;
  imagen_url?: string | null;
  stock?: number;       // stock conocido al agregar: acota las cantidades
}
export type ProductoParaCarrito = Omit<ItemCarrito, 'cantidad'>;
```

**Qué hace:** `ItemCarrito` es una línea del carrito; `ProductoParaCarrito` es "un ítem sin cantidad", lo que `ProductoCard` conoce al agregar.

**Por qué lo planteamos así:** *la consigna* (pág. 20) pide los campos `producto_id, nombre, precio_unitario, cantidad`. *Decisión nuestra:* sumar `imagen_url` (para mostrar la foto en el carrito) y `stock` (para acotar cantidades sin ir al servidor en cada click). `Omit` deriva el tipo del base: si cambia `ItemCarrito`, cambia solo, sin duplicar campos.

**Alternativa descartada:** dos interfaces independientes (se desincronizan), o guardar solo `producto_id` + `cantidad` y pedir el resto al backend en cada render (más requests; el carrito dependería de la red).

**Si te preguntan en el parcial:** "El carrito guarda una copia de nombre, precio y stock para mostrarse sin red; el precio real lo toma el backend al crear el pedido."

---

### `acotar(cantidad, stock?): number` (función interna) — `src/store/cartStore.ts`

**Qué hace:** devuelve `Math.max(1, Math.min(Math.floor(cantidad), maximo))` con `maximo = stock ?? Infinity`: entero, mínimo 1, máximo el stock si se conoce.

**Por qué lo planteamos así:** *decisión nuestra:* centralizar la regla en un único lugar que usan `agregar` y `cambiarCantidad`, para que ninguna ruta de código deje una cantidad inválida (0, decimal, mayor al stock). Es UX; **el backend vuelve a validar** el stock al crear el pedido (el stock guardado pudo quedar viejo), como aclara el comentario del código.

**Alternativa descartada:** validar en cada componente (se olvida en alguno), o no acotar y dejar que falle el `POST /pedidos` (el usuario se entera recién al confirmar).

**Si te preguntan en el parcial:** "`acotar` es la única regla de cantidad válida en el cliente; el servidor igual revalida porque el stock guardado puede estar desactualizado."

---

### `useCartStore` y sus acciones — `src/store/cartStore.ts`

| Acción | Qué hace |
|--------|----------|
| `agregar(producto, cantidad = 1)` | Si no está, lo agrega acotado; si ya está, **suma** la cantidad y **actualiza precio y stock** con los datos más recientes (`{ ...i, ...producto, cantidad: acotar(i.cantidad + cantidad, producto.stock) }`) |
| `quitar(productoId)` | Filtra el ítem |
| `cambiarCantidad(productoId, cantidad)` | `cantidad < 1` → quita el ítem; si no, `acotar(cantidad, i.stock)` |
| `vaciar()` | `items: []` |
| `total()` | `reduce` de `precio_unitario × cantidad` con `get()` |
| `cantidadItems()` | Suma de cantidades (badge del Navbar) |

**Por qué lo planteamos así:**
- *Lo exige la consigna (pág. 20):* "cartStore: Zustand + persist. Ítems, agregar, quitar, cambiarCantidad, vaciar y total".
- *Decisión nuestra, `agregar` pisa precio y stock:* si el catálogo cambió el precio desde la última vez, el carrito muestra el dato más fresco.
- *Decisión nuestra, `cantidad < 1` quita el ítem:* bajar a 0 se interpreta como "ya no lo quiero".
- *Inmutabilidad:* `set((state) => ({ items: [...] }))` siempre devuelve arrays **nuevos** (`map`, `filter`, spread); nunca `state.items.push(...)`. Zustand y React detectan cambios por referencia; mutar no dispararía re-render.
- *`total()` y `cantidadItems()` son funciones, no valores guardados:* son **estado derivado**. Si los guardaras tendrías que mantenerlos sincronizados con `items` (fuente de bugs). Se usan como `useCartStore((s) => s.total())`.
- *Por qué el carrito es Zustand y no TanStack Query:* el backend no conoce el carrito hasta el `POST /pedidos`. No hay endpoint que consultar ni nada que invalidar: es estado puro del cliente (consigna pág. 17, "Separación del estado").

**Alternativa descartada:** carrito en el servidor (la consigna no define esa entidad y obligaría a loguearse para armar el carrito). Guardar `total` como campo: se desincroniza. Mutar el array: no re-renderiza.

**Si te preguntan en el parcial:** "El carrito es estado del cliente porque el servidor no lo conoce hasta confirmar el pedido; por eso Zustand con persist. El total es derivado: lo calculo desde `items` para no tener dos fuentes de verdad."

---

### `persist` del carrito — `src/store/cartStore.ts`

```ts
{ name: 'foodstore-carrito', storage: createJSONStorage(() => localStorage), partialize: (state) => ({ items: state.items }) }
```

**Qué hace:** guarda solo `items` en `localStorage`; al hidratar, Zustand mezcla los `items` guardados con las acciones del código.

**Por qué lo planteamos así:** *lo exige la consigna* ("persiste al recargar", pág. 19, fila `/carrito`). *Decisión nuestra:* `localStorage` y no `sessionStorage` para que sobreviva al cerrar la pestaña. Acá guardar en `localStorage` **sí** es correcto: el carrito no es un secreto (a diferencia de un token).

**Alternativa descartada:** `sessionStorage` (se pierde al cerrar la pestaña) o no persistir (se pierde al recargar, contradice la consigna).

**Si te preguntan en el parcial:** "Persisto solo `items` en localStorage para que el carrito sobreviva a la recarga; no contiene datos sensibles."

*Dónde se usa:* `ProductoCard` (`agregar`), `Navbar` (`cantidadItems()`), `CarritoPage` (`items`, `total()`, `cambiarCantidad`, `quitar`, `vaciar`), `CheckoutPage` (`items`, `vaciar()` tras confirmar) y `ItemCarritoFila` (tipo `ItemCarrito`). El `logout` también lo vacía.

---

## 3. `routes/AppRouter.tsx`

### `AppRouter()` — `src/routes/AppRouter.tsx`

**Qué hace:** monta `BrowserRouter` y declara la tabla de rutas: un *layout route* (`MainLayout`) que envuelve rutas públicas, rutas de sesión (`ProtectedRoute`), rutas admin (`ProtectedRoute roles={['admin']}`) y un `*` que redirige al catálogo.

```tsx
<BrowserRouter>
  <Routes>
    <Route element={<MainLayout />}>
      {/* Públicas */}  /, /login, /register, /carrito, /unauthorized
      <Route element={<ProtectedRoute />}>                 {/* sesión, cualquier rol */}
        /checkout, /mis-pedidos
      </Route>
      <Route path="/admin" element={<ProtectedRoute roles={['admin']} />}>
        <Route index element={<Navigate to="/admin/resumen" replace />} />
        resumen, categorias, productos, pedidos, usuarios
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes>
</BrowserRouter>
```

| Ruta | Pantalla | Acceso |
|------|----------|--------|
| `/` | `CatalogoPage` | Público |
| `/login`, `/register` | Formularios | Público |
| `/carrito` | `CarritoPage` | Público |
| `/unauthorized` | `UnauthorizedPage` | Público |
| `/checkout` | `CheckoutPage` | Sesión |
| `/mis-pedidos` | `MisPedidosPage` | Sesión |
| `/admin` | redirige a `/admin/resumen` | Admin |
| `/admin/resumen` `categorias` `productos` `pedidos` `usuarios` | Panel | Admin |
| `*` | `Navigate to="/"` | Cualquier URL desconocida vuelve al catálogo |

**Por qué lo planteamos así:**
- *Lo exige la consigna (pág. 17 y 19-20):* `react-router-dom` 7.x con **`BrowserRouter`**, y la tabla de rutas con su nivel de acceso (público / sesión / admin).
- *Decisión nuestra, rutas anidadas con layouts:* `MainLayout` se declara una sola vez y todas las pantallas se dibujan en su `<Outlet />`, así el Navbar no se repite. `ProtectedRoute` es otra ruta de layout "invisible": su `<Outlet />` devuelve la ruta hija solo si pasa la guarda. Agrupar por nivel de acceso significa que proteger una ruta nueva es *ubicarla* en el bloque correcto, no acordarse de envolverla.
- *Hijas relativas:* dentro de `path="/admin"` los hijos son `path="resumen"` → `/admin/resumen`. Si cambia el prefijo, se cambia en un solo lugar.
- *`index` + `Navigate replace`:* `/admin` a secas redirige a `/admin/resumen`; `replace` reemplaza la entrada del historial para que "Atrás" no vuelva a una redirección.
- *El carrito es público:* se puede armar sin cuenta; recién se pide sesión al confirmar (`/checkout`). La consigna lo define así (`/carrito` es "Público").
- *`*` → `/`:* una URL inexistente vuelve al catálogo en vez de una pantalla en blanco.
- *Imports estáticos, sin `lazy`:* decisión nuestra, por simplicidad; con este tamaño de app el code splitting no aporta.

**Alternativa descartada:** envolver cada página con `<ProtectedRoute>` a mano (repetido y fácil de olvidar); `createBrowserRouter` con loaders (la consigna pide `BrowserRouter`, y los loaders mezclarían la carga de datos con el router en vez de usar TanStack Query).

**Si te preguntan en el parcial:** "Usé rutas anidadas: un layout con Navbar y dos guardas, una por sesión y otra por rol admin. Así la política de acceso queda visible en un solo archivo y una ruta nueva hereda la protección al ubicarla."

---

## 4. `routes/ProtectedRoute.tsx`

### `ProtectedRoute({ roles?: Rol[] })` — `src/routes/ProtectedRoute.tsx`

**Qué hace:** lee `usuario` y `cargando` del `authStore` (dos selectores) y decide, **en este orden**: si `cargando` → spinner "Verificando sesión…"; si no hay `usuario` → `<Navigate to="/login" replace state={{ desde: location.pathname }} />`; si hay `roles` y el rol del usuario no está incluido → `/unauthorized`; si pasa todo → `<Outlet />`.

```tsx
if (cargando) return <Cargando mensaje="Verificando sesión…" />;
if (!usuario) return <Navigate to="/login" replace state={{ desde: location.pathname }} />;
if (roles && !roles.includes(usuario.role)) return <Navigate to="/unauthorized" replace />;
return <Outlet />;
```

**Por qué lo planteamos así:**
- *Lo exige la consigna (pág. 20, fila "Rutas protegidas"):* "redirige a /login sin sesión y a /unauthorized si el rol no está permitido; muestra un indicador mientras checkSession confirma la sesión. La protección real está en el backend: ocultar un botón no reemplaza a require_role".
- *El orden importa (decisión nuestra):* `cargando` va **primero**. Si evaluáramos `!usuario` antes, cada recarga de `/mis-pedidos` sin dato persistido te mandaría al login por un instante aunque tengas sesión válida. Con `cargando` primero, la decisión se toma con datos confirmados.
- *`state={{ desde }}` + `replace`:* guardamos de dónde venías para que `LoginPage` te devuelva ahí tras loguear (mejor UX que caer siempre en `/`). `replace` evita que "Atrás" te lleve a la ruta protegida y te rebote al login en loop.
- *`roles` opcional:* un solo componente sirve para "alcanza con sesión" y para "solo admin". `Rol[]` en vez de `string[]`: TypeScript rechaza `roles={['adnin']}`.
- *Es una guarda de UX, no de seguridad.* El comentario del código lo dice. El código del front lo controla el usuario (puede editar `localStorage` o el bundle). La autorización real está en el backend (`get_current_user` + `require_role` → 401/403).

**Alternativa descartada:** verificar dentro de cada página (repetido). Devolver `null` mientras carga (pantalla en blanco; la consigna pide un indicador). Redirigir sin recordar `desde` (el usuario pierde el contexto). Confiar solo en el front para proteger: inseguro.

**Si te preguntan en el parcial:** "Primero miro `cargando` para no redirigir al login por error mientras se verifica la sesión; después sesión, después rol. Es solo UX: la seguridad real la hace `require_role` en el backend, porque el front lo puede manipular cualquiera."

---

## 5. `App.tsx`

### `App()` — `src/App.tsx`

**Qué hace:** toma `checkSession` del store con un selector y lo ejecuta en un `useEffect` al montar; renderiza `<AppRouter />`.

```tsx
function App() {
  const checkSession = useAuthStore((s) => s.checkSession);
  useEffect(() => { void checkSession(); }, [checkSession]);
  return <AppRouter />;
}
```

**Por qué lo planteamos así:**
- *Lo exige la consigna (pág. 17):* "Ningún componente obtiene datos del servidor con fetch dentro de useEffect; **la única llamada en useEffect es checkSession al montar la aplicación**". Y la tabla de archivos (pág. 19): "App.tsx - Llama a checkSession al montar y renderiza AppRouter".
- *Por qué esta sí es un caso válido de `useEffect`:* confirmar la sesión es un **efecto de sincronización al montar** ("al arrancar, sincronizá el store con lo que dice el servidor"). No es "datos para mostrar en una pantalla" (eso es TanStack Query), es inicializar estado global del cliente.
- *`void checkSession()`:* devuelve una Promise; `void` indica "la ignoro a propósito" (evita el aviso de promesa flotante). Un `useEffect` no puede recibir una función `async` directamente (tiene que devolver `undefined` o una función de limpieza).
- *Dependencia `[checkSession]`:* la referencia de la acción es estable en Zustand, así que corre una sola vez.
- *StrictMode:* en desarrollo monta dos veces para detectar efectos impuros, por lo que `checkSession` corre dos veces. Es inofensivo: `GET /auth/me` es idempotente.
- Verificado con `rg useEffect src`: los únicos `useEffect` de `src` fuera de este son `shared/hooks/useDebounce.ts` (un timer) y `shared/ui/Modal.tsx` (listener de Escape). Ninguno trae datos.

**Alternativa descartada:** consultar `/auth/me` con `useQuery`. Sería "más moderno", pero el resultado tiene que terminar en el `authStore` (lo leen `ProtectedRoute`, `Navbar` y el interceptor fuera de React), y la consigna manda explícitamente `checkSession` en `useEffect`. Otra: hacerlo al crearse el store (side effect al importar, difícil de testear y metido en el ciclo de imports). Otra: `fetch` en `useEffect` en cada página: sin caché, sin dedupe, con condiciones de carrera.

**Si te preguntan en el parcial:** "Es la única llamada a la API en un `useEffect`, y es a propósito: inicializa la sesión global al montar. Todo lo demás lo trae TanStack Query, que me da caché, reintentos y evita race conditions."

---

## 6. `main.tsx`

### Punto de entrada — `src/main.tsx`

**Qué hace:** busca `#root`, falla con un error claro si no existe, y renderiza `<StrictMode><QueryClientProvider client={queryClient}><App /></QueryClientProvider></StrictMode>`. Importa `./index.css` (Tailwind).

```tsx
const contenedor = document.getElementById('root');
if (!contenedor) throw new Error('No se encontró el elemento #root');
createRoot(contenedor).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
```

**Por qué lo planteamos así:**
- *Lo exige la consigna (pág. 19):* "main.tsx - QueryClientProvider".
- *El `if (!contenedor) throw`:* `getElementById` devuelve `HTMLElement | null`. Ese `if` es un **narrowing**: TypeScript (strict) sabe después que no es `null`. Evita el `!` o un `as`, que le mienten al compilador; si el HTML está mal falla ruidoso y temprano.
- *`QueryClientProvider` recibe el `queryClient` importado (singleton), no uno creado acá:* porque `authStore` y el interceptor necesitan el **mismo** objeto para llamar `queryClient.clear()` fuera de React.
- *Es el único Provider:* Zustand no usa Provider, y `BrowserRouter` se monta dentro de `AppRouter`.
- *`StrictMode`:* ayuda a detectar efectos impuros en desarrollo (no afecta producción).
- `index.html` tiene `<div id="root">` y `<script type="module" src="/src/main.tsx">`; Vite lo sirve y transforma el TSX. `vite.config.ts` registra los plugins `react()` y `tailwindcss()`.

**Alternativa descartada:** crear el `QueryClient` dentro de `App` con `useState` (válido cuando solo se usa dentro de React; acá no sirve porque el store y el interceptor lo necesitan afuera). Usar `document.getElementById('root')!` (silencia el chequeo).

**Si te preguntan en el parcial:** "El `QueryClient` es un singleton exportado que `main` le pasa al Provider; lo hice así porque el logout y el interceptor tienen que limpiar la misma caché desde fuera de React."
