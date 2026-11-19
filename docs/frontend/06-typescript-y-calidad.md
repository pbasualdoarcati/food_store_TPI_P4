# 06 - TypeScript, calidad y cómo correr el proyecto

> Criterio 10 de la consigna (pág. 22): *"TypeScript strict sin any; nombres consistentes; README.md de la raíz con pasos que funcionan en una máquina limpia y la URL del repositorio"*. Acá se ve qué hay realmente en el código y **por qué** cada configuración está así. Cada entrada responde: qué hace, por qué lo planteamos así, qué alternativa descartamos y cómo lo defiendo en el parcial.

## 1. Configuración de TypeScript

### `tsconfig.json` con project references — `frontend/tsconfig.json`
**Qué hace:** no compila nada por sí mismo (`"files": []`) y apunta a dos configuraciones: `tsconfig.app.json` y `tsconfig.node.json`.
**Por qué lo planteamos así:** son **dos entornos distintos**. El código de `src/` corre en el navegador (existe `document`, no existe `process`); `vite.config.ts` corre en Node (al revés). Un solo tsconfig te dejaría usar APIs que no existen donde corren. Con *project references* cada entorno tiene su `lib` y sus `types` y `tsc -b` los verifica por separado.

| Archivo | Cubre | `lib` | `types` |
|---------|-------|-------|---------|
| `tsconfig.app.json` | `include: ["src"]` (el código del navegador) | `ES2023`, `DOM`, `DOM.Iterable` | `vite/client` |
| `tsconfig.node.json` | `include: ["vite.config.ts"]` (código que corre en Node) | `ES2023` | `node` |

**Alternativa descartada:** un único `tsconfig.json` con `lib: ["DOM"]` y `types: ["node"]` mezclados: habilita APIs de ambos mundos y el compilador no avisa si usás `process.env` en el navegador.
**Si te preguntan en el parcial:** "Separé la config del navegador de la de Node con project references porque son entornos distintos: así TypeScript no me deja usar APIs que no existen donde el código corre."

### `"strict": true` — `frontend/tsconfig.app.json`
**Qué hace:** activa el paquete de chequeos estrictos: `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, `strictPropertyInitialization`, etc.
**Por qué lo planteamos así:** lo exige la consigna: "TypeScript strict sin `any`" (criterio 10). Con `strictNullChecks`, `null`/`undefined` son errores si no los manejás: por eso en el código vas a ver `usuario?.id`, `categoria?.nombre ?? ''` o `data?.items.find(...) ?? null`. `noImplicitAny` impide que un parámetro sin tipo se vuelva `any` en silencio. Es el principal motivo por el que el código usa `unknown` + type guards en lugar de casts.
**Alternativa descartada:** dejar `strict` apagado y "ir tipando de a poco": el `any` implícito se cuela y la consigna descuenta.
**Si te preguntan en el parcial:** "Activé `strict` porque lo pide la consigna y porque me obliga a manejar `null` y a no dejar tipos implícitos; todo lo que no conozco lo trato como `unknown` y lo verifico."

### `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` — `frontend/tsconfig.app.json`
**Qué hace:** error por variables o parámetros sin usar y por un `case` sin `break` que cae al siguiente.
**Por qué lo planteamos así:** decisión nuestra para mantener el código sin residuos (relacionado con "nombres consistentes" y calidad, criterio 10) y evitar bugs típicos de `switch`. Detecta imports que quedaron de un refactor.
**Alternativa descartada:** dejarlo a un linter (no hay ESLint en el proyecto; el compilador lo cubre).
**Si te preguntan en el parcial:** "Prendí los chequeos de no usados porque, al no tener ESLint, el compilador es la red de seguridad contra código muerto."

### `verbatimModuleSyntax` — `frontend/tsconfig.app.json`
**Qué hace:** los imports de **solo tipos** deben escribirse `import type`.
**Por qué lo planteamos así:** por eso ves `import type { Usuario } from ...` por todos lados. Hace explícito qué se borra al compilar y qué queda en el bundle, y evita imports en runtime innecesarios. También es lo que obliga a usar `export type { ... }` en el re-export de `usuarios/types`.
**Alternativa descartada:** imports normales y que el compilador "adivine": con bundlers que transpilan archivo por archivo (como Vite/esbuild) puede fallar al no saber si un import es un tipo.
**Si te preguntan en el parcial:** "`verbatimModuleSyntax` me fuerza a marcar con `import type` lo que es solo tipo, así queda claro qué entra al bundle."

### `erasableSyntaxOnly` — `frontend/tsconfig.app.json`
**Qué hace:** prohíbe sintaxis de TypeScript que genera código JS propio (`enum`, `namespace`, parameter properties).
**Por qué lo planteamos así:** es la razón por la que los roles y estados son **uniones de literales** (`type Rol = 'user' | 'admin'`) y no `enum`. Una unión se borra al compilar (cero costo en runtime), y sigue dando chequeo exhaustivo en los `Record<Rol, ...>`. Vite transpila cada archivo por separado, y la sintaxis "borrable" es la que ese modelo maneja sin sorpresas.
**Alternativa descartada:** `enum EstadoPedido { ... }`: agrega código JavaScript y no compila con esta opción.
**Si te preguntan en el parcial:** "Con `erasableSyntaxOnly` no puedo usar `enum`, así que uso uniones de literales, que además no generan código y siguen siendo exhaustivas con `Record`."

### `moduleResolution: "bundler"`, `allowImportingTsExtensions`, `noEmit` — `frontend/tsconfig.app.json`
**Qué hace:** modo "bundler": Vite resuelve y empaqueta; `tsc` **solo verifica tipos**, no emite JS.
**Por qué lo planteamos así:** el que genera el JavaScript es Vite, no `tsc`. Por eso `pnpm build` es `tsc -b && vite build`: primero se verifican los tipos (si falla, no se construye) y después se empaqueta. La consigna lo contempla: `pnpm build` "verifica los tipos" (pág. 21). `tsBuildInfoFile` guarda información incremental dentro de `node_modules/.tmp` para que el chequeo siguiente sea más rápido y no ensucie el repo.
**Alternativa descartada:** que `tsc` emita JS además de Vite: dos compiladores generando salida, duplicado y propenso a inconsistencias.
**Si te preguntan en el parcial:** "`tsc` solo chequea tipos (`noEmit`) y Vite genera el bundle; por eso el build corre primero `tsc -b` y, si hay un error de tipos, no se construye."

### `jsx: "react-jsx"`, `target`/`lib`, `skipLibCheck`, `types: ["vite/client"]`, `moduleDetection: "force"`, `allowArbitraryExtensions` — `frontend/tsconfig.app.json`
**Qué hace:** `react-jsx` usa la transformación JSX moderna; `target: es2023` deja sintaxis moderna sin transpilar; `skipLibCheck` no re-chequea los `.d.ts` de `node_modules`; `types: ["vite/client"]` aporta tipos de `import.meta.env` e imports de assets; `moduleDetection: "force"` trata todo archivo como módulo.
**Por qué lo planteamos así:** `react-jsx` evita `import React` en cada archivo. `es2023` porque el navegador objetivo es moderno (React 19, Vite). `skipLibCheck` acelera la compilación sin afectar nuestro código. `moduleDetection: "force"` evita que un archivo sin `import/export` se interprete como script global. `types` explícito evita que se cuelen tipos globales de paquetes que no usamos (por ejemplo los de Node en el código del navegador).
**Alternativa descartada:** `jsx: "react"` (obliga a importar React en cada archivo) o `target` antiguo (más código transpilado sin necesidad).
**Si te preguntan en el parcial:** "Elegí `react-jsx` para no importar React en cada archivo y `es2023` porque el navegador es moderno; `types` lo acoto para que no se mezclen tipos de Node en el código del navegador."

### `tsconfig.node.json` — `frontend/tsconfig.node.json`
**Qué hace:** misma disciplina estricta (`strict`, `noUnused*`, `erasableSyntaxOnly`) pero con `types: ["node"]`, `lib: ["ES2023"]`, `module: "nodenext"` e `include: ["vite.config.ts"]`.
**Por qué lo planteamos así:** el archivo de configuración de Vite se ejecuta en Node. Aplicarle `strict` también es coherente: la consigna pide "TypeScript strict" en todo el proyecto.
**Alternativa descartada:** dejar `vite.config.ts` fuera de cualquier tsconfig (sin chequeo de tipos) o dentro del de la app (con `DOM` y sin `node`).
**Si te preguntan en el parcial:** "El `vite.config.ts` tiene su propia config porque corre en Node, pero con el mismo nivel de rigor."

---

## 2. "Sin `any`": verificado

Se buscó en todo `src/` con ripgrep:

- `\bany\b`, `@ts-ignore`, `@ts-expect-error`, `eslint-disable` -> **0 coincidencias**.
- Casts (`x as Tipo`): **ninguno**. El único `as` que aparece es `as const` (que no es un cast, es una aserción de literal de solo lectura).

Un `any` "apaga" el chequeo y se propaga; un cast le **miente** al compilador. Las técnicas que los reemplazan:

### `unknown` + type guards (estrechamiento) — ej. `rutaDeOrigen` en `features/auth/pages/LoginPage.tsx`
**Qué hace:**
```ts
function rutaDeOrigen(estado: unknown): string | undefined {
  if (typeof estado === 'object' && estado !== null && 'desde' in estado) {
    return typeof estado.desde === 'string' ? estado.desde : undefined;
  }
  return undefined;
}
```
Después de `'desde' in estado`, TypeScript estrecha `estado` a un objeto con la propiedad `desde: unknown`, que se vuelve a verificar con `typeof`.
**Por qué lo planteamos así:** `location.state` de React Router es `unknown`: no sabemos qué hay. `unknown` te **obliga a verificar** antes de usar; `any` te deja usarlo sin verificar. Es la alternativa segura (y lo que pide el criterio 10). El mismo patrón está en `esEstadoPedidoCreado` de `MisPedidosPage`.
**Alternativa descartada:** `(location.state as { desde: string }).desde`: si el state viene vacío, falla en runtime sin aviso previo.
**Si te preguntan en el parcial:** "Donde no conozco el tipo uso `unknown` y lo verifico con `typeof`, `in` y `!== null`; es más seguro que `any` porque el compilador me obliga a comprobar."

### Predicados de tipo (`valor is T`) — `features/pedidos/utils/estados.ts`
**Qué hace:**
```ts
export function esEstadoPedido(valor: string): valor is EstadoPedido {
  return ESTADOS_PEDIDO.some((estado) => estado === valor);
}
```
La función devuelve `boolean`, pero la anotación le dice al compilador: "si devuelve `true`, ahí adentro `valor` es `EstadoPedido`". Se usa en `CheckoutForm` (`esFormaPago`) y en `AdminPedidosPage` (`esEstadoPedido`). Otro ejemplo: `esEstadoPedidoCreado(estado: unknown): estado is EstadoPedidoCreado`.
**Por qué lo planteamos así:** el valor de un `<select>` siempre es `string`; el predicado hace una **verificación real en runtime** y recién entonces estrecha el tipo. Se implementa con `some` y `===` porque `includes` sobre un `EstadoPedido[]` rechaza un argumento `string`.
**Alternativa descartada:** `as FormaPago`, que no verifica nada.
**Si te preguntan en el parcial:** "Un predicado de tipo es un cast verificado: compruebo en runtime que el string es un estado y recién ahí el compilador lo trata como `EstadoPedido`."

### Type guard de librería, genéricos y tipos utilitarios
**Qué hace / por qué:**
- `axios.isAxiosError<ApiErrorBody>(error)` (interceptor y `handleApiError`) estrecha un `unknown` a `AxiosError<ApiErrorBody>`; así `error.response.data.detail` queda tipado en vez de `any`.
- **Genéricos:** `DataTable<T>` y `useDebounce<T>` (ver `01-shared.md`); `api.get<Usuario>(...)` / `api.post<Pedido>(...)` tipan `data`; `useForm({ defaultValues })` infiere los campos de los valores iniciales; `useQuery`/`useMutation` infieren `data` y `error` de la función que les pasás. Un componente genérico sirve para cualquier entidad sin perder tipos.
- **Tipos utilitarios:** `Omit<ItemCarrito, 'cantidad'>` (`ProductoParaCarrito`), `Omit<PedidoCreate, 'items'>` (`DatosCheckout`) son tipos **derivados** (si el original cambia, se actualizan solos); `Record<EstadoPedido, ...>` crea mapas **exhaustivos** (olvidar un estado es error de compilación); `ButtonHTMLAttributes<HTMLButtonElement>` y `HTMLAttributes<HTMLDivElement>` heredan las props nativas en `Button`, `Card`, `Input`.
**Alternativa descartada:** duplicar interfaces a mano (se desincronizan) o `any` para "que compile".
**Si te preguntan en el parcial:** "Uso genéricos para que un mismo componente sirva a varias entidades y tipos utilitarios para derivar tipos en lugar de copiarlos."

### Uniones de literales, uniones discriminadas y `as const`
**Qué hace:** `type EstadoPedido = 'PENDIENTE' | ...`; `type EstadoFormulario = { abierto: false } | { abierto: true; categoria: Categoria | null }` (en `AdminCategoriasPage`); `[s.canSubmit, s.isSubmitting] as const` en `form.Subscribe`; `export const USUARIOS_KEY = ['usuarios'] as const`.
**Por qué lo planteamos así:** en la unión discriminada, el campo `abierto` hace que TypeScript sepa qué propiedades existen en cada rama (no podés leer `categoria` si no comprobaste que está abierto), y hace imposible un estado inválido que dos booleans sí permitirían. `as const` produce tuplas `readonly`: la de `form.Subscribe` es `readonly [boolean, boolean]` (no `boolean[]`), y la de `queryKey` es el tipo que espera TanStack Query.
**Alternativa descartada:** `const [abierto, setAbierto] = useState(false)` + `const [categoria, setCategoria] = useState<Categoria | null>(null)`: se pueden desincronizar.
**Si te preguntan en el parcial:** "La unión discriminada hace imposibles los estados inválidos, y `as const` me da tuplas de solo lectura con el tipo exacto."

---

## 3. Module augmentation de TanStack Table (`meta`)

### `ColumnMeta` ampliado — `frontend/src/shared/types/tanstack-table.ts`
**Qué hace:**
```ts
import type { RowData } from '@tanstack/react-table';

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string;
  }
}
```
Agrega `className?: string` al tipo `ColumnMeta`, de modo que `meta: { className: 'text-right' }` compila y se autocompleta en las columnas, y `header.column.columnDef.meta?.className` en `DataTable` queda tipado como `string | undefined` sin cast.
**Por qué lo planteamos así:** `ColumnDef` tiene un campo `meta` para datos personalizados, pero está tipado como `ColumnMeta<TData, TValue>`, una interfaz **vacía**; escribir `meta: { className: ... }` da error. Usamos `meta.className` para que **cada columna declare su propio estilo** (alineación a la derecha, ancho fijo, `whitespace-nowrap`) en vez de que `DataTable` tenga que adivinarlo. La solución es *declaration merging*: las interfaces de TypeScript se **fusionan** si se declaran varias veces con el mismo nombre; con `declare module '...'` reabrimos el módulo de la librería y agregamos el campo.
Dos detalles que suelen preguntar:
1. El archivo tiene un `import type` arriba. Eso lo convierte en un **módulo**; sin ningún import/export, `declare module` se interpretaría como una declaración ambient nueva (que *reemplaza* en vez de fusionar).
2. Los parámetros `<TData extends RowData, TValue>` deben ser **idénticos** a los de la declaración original de la librería; si no, TypeScript no puede fusionarlos. Aunque no se usen en el cuerpo, son obligatorios.
El archivo no se importa desde ningún lado: alcanza con que esté dentro de `include: ["src"]`.
**Alternativa descartada:** castear (`(col.columnDef.meta as { className?: string })?.className`) en `DataTable` y en cada columna (casts por todos lados, contra el criterio 10); o un `Record<string, string>` aparte indexado por id de columna (hay que mantener dos listas sincronizadas).
**Si te preguntan en el parcial:** "TanStack Table deja `meta` vacío; con module augmentation le agrego `className` al tipo, así cada columna define su estilo y todo queda tipado sin casts."

---

## 4. `vite-env.d.ts`

### Tipado de variables de entorno — `frontend/src/vite-env.d.ts`
**Qué hace:**
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv { readonly VITE_API_URL: string; }
interface ImportMeta { readonly env: ImportMetaEnv; }
```
**Por qué lo planteamos así:**
- `vite/client` aporta tipos de `import.meta.env`, de importar imágenes/CSS, etc.
- Declarar `VITE_API_URL` en `ImportMetaEnv` hace que `import.meta.env.VITE_API_URL` sea `string`. **Sin esto sería `any`**, y ahí sí se colaría un `any` en `axiosInstance.ts` (`baseURL: import.meta.env.VITE_API_URL`). Con `readonly` porque las variables de entorno no se asignan.
- Vite solo expone al código del cliente las variables con prefijo `VITE_`, y son **públicas**: terminan escritas en el bundle (por eso nunca van secretos ahí). La URL del backend no es un secreto.
- `frontend/.env` no se versiona (`frontend/.gitignore` ignora `.env`, `.env.local` y `.env.*.local`); `frontend/.env.example` documenta la variable (lo exige la consigna, pág. 19 y CE-03 del formato de entrega).
**Alternativa descartada:** hardcodear `http://localhost:8000/api/v1` en el código (rompería al desplegar y no sería configurable), o dejar `import.meta.env` sin tipar.
**Si te preguntan en el parcial:** "Declaré `VITE_API_URL` como `string` en `ImportMetaEnv`; sin eso `import.meta.env.VITE_API_URL` sería `any` y se me colaría un `any`. Y la URL va en el `.env`, no en el código."

### `vite.config.ts` — `frontend/vite.config.ts`
**Qué hace:** `defineConfig({ plugins: [react(), tailwindcss()] })`.
**Por qué lo planteamos así:** lo pide la consigna (pág. 19): "Plugins react y @tailwindcss/vite". Con Tailwind 4 el plugin de Vite reemplaza la configuración clásica de PostCSS; en `index.css` alcanza con `@import "tailwindcss"`. El plugin `react()` aporta el JSX transform y el refresco en caliente (HMR).
**Alternativa descartada:** Tailwind vía PostCSS y `tailwind.config.js` (el camino de Tailwind 3; la consigna pide Tailwind 4.x con `@tailwindcss/vite`).
**Si te preguntan en el parcial:** "El config solo tiene los dos plugins que pide la consigna: React y el plugin de Tailwind 4 para Vite."

---

## 5. Versiones fijadas — `frontend/package.json`

### Dependencias con versión exacta
**Qué hace:** todas las dependencias están sin `^` ni `~` (ej. `"react": "19.3.1"`, `"@tanstack/react-query": "5.104.5"`, `"zustand": "5.0.15"`, `"typescript": "6.0.3"`, `"vite": "8.3.5"`), y `"engines": { "node": ">=20.19" }`.
**Por qué lo planteamos así:** la consigna dice que "las versiones se fijan en `package.json`" (pág. 16). Con `^`, dos máquinas podrían bajar versiones menores distintas y el proyecto "anda en mi PC". Con versiones exactas la instalación es **reproducible**; `pnpm-lock.yaml` (en el repo) fija además las dependencias transitivas. Las versiones cumplen lo pedido: Node >= 20.19, React 19.x, TypeScript >= 5.9, Vite >= 7, Tailwind 4.x con `@tailwindcss/vite`, TanStack Query 5.x, TanStack Form 1.x, TanStack Table 8.x, `react-router-dom` 7.x, Zustand 5.x, Axios 1.x.
**Alternativa descartada:** rangos con `^` (instalaciones no reproducibles) o `latest` (un cambio de versión mayor rompería el build).
**Si te preguntan en el parcial:** "Fijé versiones exactas y hay lockfile, así cualquiera que instale obtiene exactamente las mismas dependencias que usé."

### Scripts
| Script | Comando | Para qué |
|--------|---------|----------|
| `dev` | `vite` | Servidor de desarrollo con HMR (por defecto `http://localhost:5173`, que coincide con `FRONTEND_ORIGIN` del backend) |
| `build` | `tsc -b && vite build` | **Verifica tipos** y genera `dist/` |
| `typecheck` | `tsc -b` | Solo tipos |
| `preview` | `vite preview` | Sirve el build localmente |

**Por qué lo planteamos así:** `build` encadena tipos y bundle con `&&` para que un error de tipos **detenga** el build; la consigna lo menciona (pág. 21: "`pnpm build` (verifica los tipos)"). `tsc -b` (build mode) es necesario por las project references. `typecheck` existe para chequear sin construir.
**Si te preguntan en el parcial:** "El build corre primero `tsc -b`: si hay un error de tipos no se genera el bundle, así nunca entrego algo que no compila en strict."

---

## 6. Cómo correrlo (pasos)

Requisitos: Node >= 20.19, pnpm >= 9, y el backend levantado en `http://localhost:8000`.

```bash
cd frontend
cp .env.example .env        # y revisar que VITE_API_URL=http://localhost:8000/api/v1
pnpm install
pnpm build                  # verifica los tipos (tsc -b) y compila
pnpm dev                    # http://localhost:5173
```

Para que funcione la sesión: el backend debe tener `FRONTEND_ORIGIN=http://localhost:5173` (CORS con credenciales) y haber corrido el seed (`python -m app.db.seed`) para que exista el admin (`admin` / `Admin1234!`). Si abrís el front desde otro origen (otro puerto o `127.0.0.1`), el navegador bloqueará las cookies por CORS. **Por qué:** con `withCredentials` el navegador solo envía cookies a un origen que el backend declaró explícitamente (no vale `*`); por eso el origen exacto tiene que coincidir.

---

## 7. Observaciones de calidad (verificadas)

Cosas que están bien y conviene mencionar:
- **Nombres consistentes** (criterio 10): carpetas por feature con los mismos subdirectorios; hooks `useXxx`; fábricas `crearColumnasXxx`; constantes `XXX_KEY`; archivos de página `XxxPage.tsx`; nombres de campo iguales a los del backend.
- Todas las listas manejan carga/error/vacío; los modales muestran errores del backend sin cerrarse.
- **Sin `fetch` en `useEffect`** (criterio 9): las 3 apariciones de `useEffect` son `App` (confirmar sesión con `checkSession`, la única permitida por la consigna), `useDebounce` (un timer) y `Modal` (tecla Escape).
- **Al cerrar sesión se limpia todo lo del usuario:** `authStore.logout` hace `queryClient.clear()` y vacía el `cartStore`, así el próximo usuario del mismo navegador no hereda ni la caché ni el carrito.

Puntos débiles reales que podrías tener que reconocer ante el profe (y cómo responder):
1. **Import circular** `authStore` <-> `axiosInstance` (vía `features/auth/api/auth.ts`). Funciona porque el uso es diferido (dentro de funciones, no al cargar el módulo), pero es una señal de acoplamiento. Alternativa: que el interceptor reciba un callback `onSesionInvalida` registrado desde `App`, o separar el store de la API.
2. **No hay ESLint ni tests** (no hay script `lint` ni runner en `package.json`). Por eso los `useMemo(..., [])` de las páginas admin tienen la lista de dependencias "a mano" justificada en comentarios; con la regla `react-hooks/exhaustive-deps` habría warnings. La consigna no los exige.
3. El **interceptor redirige con `window.location.assign`** (recarga completa) en lugar de navegar con el router; es válido según la consigna (pág. 20: "la vuelta a /login la hace el propio interceptor o ProtectedRoute") pero pierde el estado en memoria.
4. `useRegistro` encadena `registrar` + `login`: si el segundo fallara tras crear la cuenta, el usuario vería un error aunque la cuenta existe (reintentar daría 409).
5. Los paneles admin asumen **<= 100 registros** (`limit=100`, tal como pide la consigna): más allá, no se ven.
6. Acoplamiento por **string** entre el interceptor y el backend (`'Cuenta de usuario desactivada'`): si el backend cambia el texto, deja de detectarse.
7. `FiltrosProductos.disponible` está definido pero ningún componente lo usa; y `ETIQUETA_ACCION.PENDIENTE` ('Volver a pendiente') nunca se muestra (existe solo para que el `Record` sea exhaustivo).
8. La **máquina de estados está duplicada** (backend y `TRANSICIONES` del front): es un espejo para dibujar botones; si cambia la regla, hay que tocar los dos.
