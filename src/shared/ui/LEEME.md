# El sistema de diseño

Los colores, las tipografías y los componentes que comparten las herramientas de
dibujo. Salen del archivo de Figma **"Mi web"** y no de la cabeza de nadie.

## Cómo se usa

Un solo import trae componentes, íconos **y estilos**:

```tsx
import { Button, IconButton, Checkbox, UploadIcon } from '../shared/ui'

<Button variant="loud" icon={<UploadIcon />} onClick={subir}>Subir foto</Button>
<IconButton label="Grilla" selected={abierta} onClick={abrir}><GridIcon /></IconButton>
<Checkbox label="Etiquetas" checked={etiquetas} onChange={setEtiquetas} />
```

Los CSS se importan desde `index.ts`, no desde la hoja de cada herramienta. Es a
propósito: así no existe la forma de usar un componente y olvidarse de sus estilos.

Lo único que hace falta además es la clase `ds` en el contenedor de la app, que pone
el fondo, el color de texto y la tipografía base.

## Qué hay adentro

| archivo | qué es |
|---|---|
| `tokens.css` | los valores: color, tipografía, radios, medidas, movimiento |
| `components.css` | los estilos de los tres componentes |
| `Button.tsx` | `loud` · `quiet` · `transparent`, con ícono a izquierda o derecha |
| `IconButton.tsx` | el de 48×48 con un ícono, y su estado marcado |
| `Checkbox.tsx` | la casilla |
| `icons.tsx` | los seis íconos del archivo, más la X |
| `fonts/` | Space Grotesk y Space Mono empaquetadas |

## Cómo cambiar algo

**Un color, un tamaño de letra, un radio** → `tokens.css`. Cambia en las tres
herramientas de una vez.

**Cómo se ve un componente** → `components.css`, en el bloque que lleva arriba el
número del nodo de Figma.

**Sumar un componente** → un `.tsx` con su bloque en `components.css`, y exportarlo
desde `index.ts`. La regla es una sola: **si no está en Figma, no se inventa acá.**
Lo que no está dibujado se resuelve con tokens en la herramienta que lo necesita y
queda anotado en la lista de abajo.

## De dónde sale cada valor

Las cuatro variables de color del archivo se llaman acá igual que allá, para que
buscar una en Figma y buscarla en el código sea la misma búsqueda:

| token | Figma | valor |
|---|---|---|
| `--ds-black` | Black | `#101010` |
| `--ds-accent-dark` | Accent Dark | `#1C00C9` |
| `--ds-accent-light` | Accent Light | `#DBD8F0` |
| `--ds-background` | Background | `#F6F4FF` |

Los componentes salen de estos nodos: `Button` 18:136, `Button` (ícono) 4:650,
checkbox 4:1270, y los íconos `Upload` 4:740, `File` 4:739, `Grid` 4:738,
`Paint` 4:737, `Download` 4:751, `Back` 4:757.

## Lo que falta dibujar

Esta lista es la deuda entre el código y el archivo. Cuanto más corta, mejor.

1. **`#958BCB` y `#9F95D5` no son variables**, son estilos sueltos. Entraron como
   `--ds-muted` y `--ds-icon-idle` para poder cambiarlos en un lugar, pero no tienen
   nombre en Figma.
2. **Esos dos no llegan al contraste mínimo** contra el fondo: dan 2,82 y 2,50, y la
   norma pide 3 para un elemento de interfaz. Por eso ninguno lleva texto — solo el
   borde de la casilla sin marcar y el ícono en reposo, que es donde el diseño los
   puso.
3. **El ícono X no existe.** Está dibujado con la métrica del set (24×24, trazo 2,
   puntas redondas) y marcado en `icons.tsx` como el único que no viene del archivo.
4. **No hay slider, ni grupo de botones, ni chips de color.** Hoy viven en
   `referencia/styles.css` armados con tokens del sistema; el grupo de botones repite
   el patrón de la barra de pestañas, que es el único agrupador que el archivo define.
5. **No hay estados dibujados** — ni hover, ni foco, ni deshabilitado. Los que hay
   están resueltos con opacidad y con el acento que ya existe, sin colores nuevos, y
   están marcados como derivados en `components.css`.
6. **Los escalones tipográficos chicos** (`--ds-text-control` y `--ds-text-meta`) son
   derivados: el panel de Referencia todavía no está dibujado.
