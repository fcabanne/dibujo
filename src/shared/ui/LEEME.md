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
| `Slider.tsx` | la píldora que se llena, con el valor escrito en el medio |
| `Stepper.tsx` | − número + , para lo que se elige de a uno |
| `Choice.tsx` | los botones chicos de elegir una opción entre pocas |
| `Swatch.tsx` | la muestra de color, y la que abre la rueda del sistema |
| `icons.tsx` | los nueve íconos del archivo, más la X |
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
| `--ds-accent-dark` | Accent Dark | `#1C00C9` |
| `--ds-accent-light` | Accent Light | `#DBD8F0` |
| `--ds-accent-secondary` | Accent Secondary | `#9F95D5` |
| `--ds-background` | Background | `#F6F4FF` |
| `--ds-white` | White | `#FFFFFF` |

Los componentes salen de estos nodos: `Button` 18:136, `Button` (ícono) 4:650,
checkbox 4:1270, `Slider` 22:276, `Stepper` 22:296, `Button` chico 22:595/22:596,
`Colo Swatch` 22:352/22:406. Los íconos: `Upload` 4:740, `File` 4:739, `Photo` 22:57,
`Grid` 4:738, `Paint` 4:737, `Download` 4:751, `Back` 4:757, `Minus` 22:289,
`Plus` 22:291.

## Lo que falta dibujar

Esta lista es la deuda entre el código y el archivo. Cuanto más corta, mejor.

1. **`#958BCB` no es variable**, es un estilo suelto. Entró como `--ds-muted` para
   poder cambiarlo en un lugar, pero no tiene nombre en Figma. *(`#9F95D5` ya lo
   tiene: es `Accent Secondary`.)*
2. **No llega al contraste mínimo** contra el fondo: da 2,82 y la norma pide 3 para
   un elemento de interfaz. Por eso no lleva texto — solo el borde de la casilla sin
   marcar, que es donde el diseño lo puso. `Accent Secondary` da 2,50 y por lo mismo
   solo se usa para el relleno del slider y para el ± apagado del stepper.
3. **El ícono X no existe.** Está dibujado con la métrica del set (24×24, trazo 2,
   puntas redondas) y marcado en `icons.tsx` como el único que no viene del archivo.
4. **No hay estados dibujados** — ni hover, ni foco, ni deshabilitado. Los que hay
   están resueltos con opacidad y con tokens que ya existen, sin colores nuevos, y
   están marcados como derivados en `components.css`. La excepción es el ± apagado
   del stepper, que sí está en 22:289.
5. **`--ds-text-meta` es derivado**: es lo que acompaña a un control —el nombre del
   archivo, el aviso, la unidad— y el archivo no lo dibuja. Los demás escalones ya
   están medidos sobre un nodo, y el nodo está anotado al lado en `tokens.css`.
6. **El botón de elegir mide 40 y con un dedo queda chico.** Sube a 44 bajo
   `(pointer: coarse)`, que es una decisión del código: el archivo dibuja una sola
   medida.
