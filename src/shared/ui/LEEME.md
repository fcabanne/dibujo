# El sistema de diseño

Los colores, las tipografías y los componentes que comparten las herramientas de
dibujo. Salen del archivo de Figma **"Mi web"** y no de la cabeza de nadie.

## Cómo se usa

Un solo import trae componentes, íconos **y estilos**:

```tsx
import { Button, Slider, Stepper, ChoiceGroup, UploadIcon } from '../shared/ui'

<Button variant="loud" icon={<UploadIcon />} onClick={subir}>Subir foto</Button>
<IconButton label="Grilla" selected={abierta} onClick={abrir}><GridIcon /></IconButton>
<Checkbox label="Subdividir" checked={parte} onChange={setParte} />
<Slider label="Opacidad" value={75} min={0} max={100} step={5} onChange={setOpacidad}
        format={(v) => `${v}%`} />
<Stepper label="Divisiones" value={8} min={2} max={8} onChange={setCuantas}
         decrementLabel="Menos divisiones" incrementLabel="Más divisiones" />
<ChoiceGroup label="Tipo" value={modo} onChange={setModo}
             options={[{ value: 'prop', label: 'Proporcional' }]} />
<Swatch color="#ff3b30" label="Rojo" selected={elegido} onSelect={elegir} />
```

Los CSS se importan desde `index.ts`, no desde la hoja de cada herramienta. Es a
propósito: así no existe la forma de usar un componente y olvidarse de sus estilos.

Lo único que hace falta además es la clase `ds` en el contenedor de la app, que pone
el fondo, el color de texto y la tipografía base.

**Los componentes no traen textos.** El nombre de un control, el de un botón de ícono
y hasta el del `+` del stepper llegan por props. El sistema no sabe en qué idioma
está la app; de eso se encarga `shared/copy`.

## Qué hay adentro

| archivo | qué es |
|---|---|
| `tokens.css` | los valores: color, tipografía, radios, medidas, movimiento |
| `components.css` | los estilos de todos los componentes |
| `Button.tsx` | `loud` · `quiet` · `transparent`, con ícono a izquierda o derecha |
| `IconButton.tsx` | el de 48×48 con un ícono, y su estado marcado |
| `Checkbox.tsx` | la casilla, con el cuadradito a la izquierda del texto |
| `Switch.tsx` | el interruptor de sí/no: un cuadrado que se corre adentro de un riel |
| `Slider.tsx` | la píldora que se llena, con el valor escrito en el medio |
| `Stepper.tsx` | − número + , para lo que se elige de a uno |
| `Choice.tsx` | los botones chicos de elegir una opción entre pocas |
| `Swatch.tsx` | la muestra de color, y la que abre la rueda del sistema |
| `Dropdown.tsx` | la fila cerrada de un campo que se elige en otra pantalla |
| `OptionPicker.tsx` | esa otra pantalla: la grilla de tarjetas grandes a la que lleva un Dropdown |
| `icons.tsx` | los íconos del archivo, más los que no vinieron |
| `fonts/` | Space Grotesk y las dos pesadas de Space Mono |

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

Las variables de color del archivo se llaman acá igual que allá, para que buscar una
en Figma y buscarla en el código sea la misma búsqueda:

| token | Figma | valor |
|---|---|---|
| `--ds-black` | Black | `#101010` |
| `--ds-accent-dark` | Accent Dark | `#3D3D3D` |
| `--ds-accent-light` | Accent Light | `#F3EEE4` |
| `--ds-accent-secondary` | Accent Secondary | `#BABABA` |
| `--ds-background` | Background | `#FBF8F2` |
| `--ds-white` | White | `#FFFFFF` |

Los componentes salen de estos nodos: `Button` 18:136, `Button` (ícono) 4:650,
checkbox 4:1270, `Slider` 22:276, `Stepper` 22:296, `Button` chico 22:595/22:596,
`Colo Swatch` 22:352/22:406, `Dropdown` 23:193/23:243, el picker de Tipo 26:279 y
el de Color 26:425. Los íconos: `Upload` 4:740, `File` 4:739, `Photo` 22:57,
`Grid` 4:738, `Paint` 4:737, `Download` 4:751, `Back` 4:757, `Minus` 22:289,
`Plus` 22:291.

## Lo que falta dibujar

Esta lista es la deuda entre el código y el archivo. Cuanto más corta, mejor.

1. **`#8F8F8F` no es variable**, es un estilo suelto. Entró como `--ds-muted` para
   poder cambiarlo en un lugar, pero no tiene nombre en Figma. *(`#BABABA` ya lo
   tiene: es `Accent Secondary`.)*
2. **`Accent Secondary` no llega al contraste mínimo** contra el fondo: da 1,84 y la
   norma pide 3 para un elemento de interfaz. Por eso solo se usa para el relleno
   del slider y para el ± apagado del stepper, nunca para texto — el borde de la
   casilla sin marcar usa `--ds-muted`, que sí llega (3,05).
3. **Los íconos X y Linterna no existen.** Están dibujados con la métrica del set
   (24×24, trazo 2, puntas redondas) y marcados en `icons.tsx` como los que no vienen
   del archivo. Linterna lo usa la mesa de luz para prender la luz de la cámara.
4. **No hay estados dibujados** — ni hover, ni foco, ni deshabilitado. Los que hay
   están resueltos con opacidad y con tokens que ya existen, sin colores nuevos, y
   están marcados como derivados en `components.css`. La excepción es el ± apagado
   del stepper, que sí está en 22:289.
5. **`--ds-text-meta` es derivado**: es lo que acompaña a un control —el nombre del
   archivo, el aviso, la unidad— y el archivo no lo dibuja. Los demás escalones ya
   están medidos sobre un nodo, y el nodo está anotado al lado en `tokens.css`.
5b. **El movimiento es derivado**, como los estados: el archivo no dibuja ninguno.
   Las duraciones (`--ds-dur-press/fast/-/slow`), las curvas y cuánto se hunde algo
   al apretarlo (`--ds-press`, `--ds-press-wide`) están en `tokens.css`, y todo se
   apaga con `prefers-reduced-motion`.
6. **El botón de elegir mide 40 y con un dedo queda chico.** Sube a 44 bajo
   `(pointer: coarse)`, que es una decisión del código: el archivo dibuja una sola
   medida.
7. **Tres íconos entraron a ojo**: la flecha del Dropdown (23:130) y los de
   Proporcional/Cuadrada del picker de Tipo (26:395/26:417) existen en el archivo,
   pero esta sesión no pudo bajar el trazo exacto —la red del entorno bloqueaba la
   descarga directa de assets de Figma, solo se podía ver por captura—. Se
   dibujaron sobre esa captura con la métrica del set. Reemplazar los `d` en
   `icons.tsx` cuando se pueda leer el archivo con una red sin esa traba.
8. **El picker de Ajustes no tiene frame en Figma todavía.** `ContrastIcon`,
   `EdgesIcon` y `FacetsIcon` son invención directa, con la métrica del set pero sin
   ningún nodo de referencia. Cuando se dibuje esa pantalla, se reemplazan los tres.
9. **`Switch` no tiene frame en Figma.** Salió de una necesidad puntual —el
   interruptor de etiquetas del diálogo de descarga— resuelto con tokens que ya
   existen (`--ds-accent-light/secondary/dark`), sin inventar un color nuevo.
   Cuando el archivo lo dibuje, se ajusta a eso.
