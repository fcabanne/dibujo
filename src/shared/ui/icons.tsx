/**
 * Los íconos del sistema.
 *
 * Los de Figma llevan la línea central redibujada a mano y el Dynamic Stroke
 * (el "wobble") encima: `Drawn` toma esa línea central y le aplica el mismo
 * temblor (ver `wobble.ts`). Todos comparten métrica —24×24, trazo de 1,8,
 * puntas redondas y uniones en inglete— y esa métrica es lo que los hace ver
 * de la misma familia, así que un ícono nuevo la respeta o no entra.
 *
 * En escritorio, al pasar el puntero por el control que lo contiene, el trazo
 * hierve (`boilOnHover`). Los que no vienen de Figma van como estaban, sin
 * temblor: dibujarles uno sería inventar.
 *
 * El color no está acá. Va en `currentColor` para que lo resuelva quien lo
 * use: en el diseño el mismo ícono va claro sobre el violeta cuando la
 * pestaña está abierta, y violeta sobre el fondo claro cuando no.
 */

import { useEffect, useMemo, useRef, type SVGProps } from 'react'
import { boilOnHover, prepare, type IconSpec } from './wobble'

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'miter',
  'aria-hidden': true,
  focusable: false,
} satisfies SVGProps<SVGSVGElement>

const BACK: IconSpec = [5, 5, 'M 4 9 L 0 5 M 0 5 L 5 0 M 0 5 L 11 5 C 12.06 5 13.08 5.42 13.83 6.17 C 14.58 6.92 15 7.94 15 9 C 15 10.06 14.58 11.08 13.83 11.83 C 13.08 12.58 12.06 13 11 13 L 10 13']
const PHOTO: IconSpec = [1.5, 3, 'M 1.5 3 C 1.5 2.2 1.81 1.44 2.37 0.87 C 2.94 0.31 3.7 0 4.5 0 L 16.5 0 C 17.29 0 18.05 0.31 18.62 0.87 C 19.18 1.44 19.5 2.2 19.5 3 L 19.5 15 C 19.5 15.79 19.18 16.55 18.62 17.12 C 18.05 17.68 17.29 17.99 16.5 18 L 4.5 18 C 3.7 17.99 2.94 17.68 2.37 17.12 C 1.81 16.55 1.5 15.79 1.5 15 L 1.5 3 Z M 13.5 5 L 13.51 5 L 14 5.5 M 0 13 L 6.5 8 C 7.42 7.1 8.57 7.1 9.5 8 L 13.51 13 M 12.5 11 L 13.5 10 C 14.42 9.1 15.57 9.1 16.5 10 L 21.5 13.5']
const GRID: IconSpec = [3, 3, 'M 0 3 L 18 3 M 0 9 L 17 9 L 18 8.5 M 0 15 L 18 15 M 3 0 L 1.5 18 L 2.5 18 M 9 0 L 9 18 M 15 0 L 15 18']
const PAINT: IconSpec = [3, 3, 'M 0 18 L 0 14 C 0 13.21 0.23 12.44 0.67 11.78 C 1.11 11.12 1.74 10.61 2.47 10.3 C 3.2 10 4 9.92 4.78 10.08 C 5.56 10.23 6.27 10.61 6.83 11.17 C 7.39 11.73 7.77 12.44 7.92 13.22 C 8.08 14 8 14.8 7.7 15.53 C 7.39 16.26 6.88 16.89 6.22 17.33 C 5.56 17.77 4.79 18 4 18 L 0 18 Z M 5.2 10.2 C 6.22 7.5 7.94 5.13 10.2 3.34 C 12.45 1.54 15.15 0.39 18 0 C 17.61 2.85 16.46 5.55 14.66 7.8 C 12.87 10.06 10.5 11.78 7.8 12.8 M 7.6 6 C 9.54 6.9 11.1 8.46 12 10.4']
const DOWNLOAD: IconSpec = [4, 4, 'M 0 13 L 0 15 C 0 15.53 0.21 16.04 0.59 16.41 C 0.96 16.79 1.47 17 2 17 L 14 17 C 14.53 17 15.04 16.79 15.41 16.41 C 15.79 16.04 16 15.53 16 15 L 16 13 M 3 7 L 8 12 M 8 12 L 13 7 M 8 12 L 8 0']
const UPLOAD: IconSpec = [4, 4, 'M 0 13 L 0 15 C 0 15.53 0.21 16.04 0.59 16.41 C 0.96 16.79 1.47 17 2 17 L 14 17 C 14.53 17 15.04 16.79 15.41 16.41 C 15.79 16.04 16 15.53 16 15 L 16 12 M 3 5 L 7 0 L 8 0 M 8 0 L 13 5 M 8 0 L 7.5 13.5']
const PLUS: IconSpec = [5, 5, 'M 7 0 L 7 14 M 0 7 L 14 7']
const MINUS: IconSpec = [5, 12, 'M 0 0 L 14 0']
const DROPDOWN: IconSpec = [6, 10, 'M 0 0 L 6 6 L 12 0 L 0 0 Z']
const PROPORTIONAL: IconSpec = [4, 4, 'M 0 7 L 0 15 C 0 15.26 0.1 15.51 0.29 15.7 C 0.48 15.89 0.73 16 1 16 L 9 16 M 0 2 L 0 1 C 0 0.73 0.1 0.48 0.29 0.29 C 0.48 0.1 0.73 0 1 0 L 2 0 M 7 0 L 9 0 M 14 0 L 15 0 C 15.26 0 15.51 0.1 15.7 0.29 C 15.89 0.48 16 0.73 16 1 L 16 2 M 16 7 L 16 9 M 16 14 L 16 15 C 16 15.26 15.89 15.51 15.7 15.7 C 15.51 15.89 15.26 16 15 16 L 14 16 M 0 8 L 7 8 C 7.26 8 7.51 8.1 7.7 8.29 C 7.89 8.48 8 8.73 8 9 L 8 16']
const SQUARED: IconSpec = [3, 3, 'M 0 2 C 0 1.46 0.21 0.96 0.58 0.58 C 0.96 0.21 1.46 0 2 0 L 16 0 C 16.53 0 17.03 0.21 17.41 0.58 C 17.78 0.96 18 1.46 18 2 L 18 16 C 18 16.53 17.78 17.03 17.41 17.41 C 17.03 17.78 16.53 18 16 18 L 2 18 C 1.46 18 0.96 17.78 0.58 17.41 C 0.21 17.03 0 16.53 0 16 L 0 2 Z M 0 11 L 18 11 M 11 0 L 11 18']
const FRAME: IconSpec = [6, 6, 'M 12 0 L 0 12 M 0 0 L 12 12']

export type IconProps = { className?: string }

/** Un ícono de Figma: la línea central, con el trazo temblado y el hover que lo hace hervir. */
function Drawn({ spec, seed, className }: { spec: IconSpec; seed: number; className?: string }) {
  const draw = useMemo(() => prepare(spec, seed), [spec, seed])
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => (ref.current ? boilOnHover(ref.current, draw) : undefined), [draw])
  return (
    <svg {...base} ref={ref} className={className}>
      <path d={draw(0)} />
    </svg>
  )
}

/** Subir una foto. Figma: `Upload` (4:740). */
export function UploadIcon({ className }: IconProps) {
  return (
    <Drawn spec={UPLOAD} seed={79} className={className} />
  )
}

/** La hoja. Figma: `File` (4:739). */
export function FileIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M14 3V7C14 7.26522 14.1054 7.51957 14.2929 7.70711C14.4804 7.89464 14.7348 8 15 8H19M19 8L14 3H7C6.46957 3 5.96086 3.21071 5.58579 3.58579C5.21071 3.96086 5 4.46957 5 5V19C5 19.5304 5.21071 20.0391 5.58579 20.4142C5.96086 20.7893 6.46957 21 7 21H17C17.5304 21 18.0391 20.7893 18.4142 20.4142C18.7893 20.0391 19 19.5304 19 19V8Z" />
    </svg>
  )
}

/** La grilla. Figma: `Grid` (4:738). */
export function GridIcon({ className }: IconProps) {
  return (
    <Drawn spec={GRID} seed={53} className={className} />
  )
}

/** El pincel: los ajustes de la foto. Figma: `Paint` (4:737). */
export function PaintIcon({ className }: IconProps) {
  return (
    <Drawn spec={PAINT} seed={66} className={className} />
  )
}

/** Bajar el archivo. Figma: `Download` (4:751). */
export function DownloadIcon({ className }: IconProps) {
  return (
    <Drawn spec={DOWNLOAD} seed={105} className={className} />
  )
}

/** Volver. Figma: `Back` (4:757) — una flecha de retorno, no un chevrón. */
export function BackIcon({ className }: IconProps) {
  return (
    <Drawn spec={BACK} seed={53} className={className} />
  )
}

/** La foto. Figma: `Photo` (22:57). */
export function PhotoIcon({ className }: IconProps) {
  return (
    <Drawn spec={PHOTO} seed={66} className={className} />
  )
}

/** Uno menos. Figma: `Minus` (22:289). */
export function MinusIcon({ className }: IconProps) {
  return (
    <Drawn spec={MINUS} seed={66} className={className} />
  )
}

/** Uno más. Figma: `Plus` (22:291). */
export function PlusIcon({ className }: IconProps) {
  return (
    <Drawn spec={PLUS} seed={53} className={className} />
  )
}

/**
 * Quitar la foto.
 *
 * **El único que no viene de Figma.** Hace falta para el botón de borrar y
 * el archivo todavía no lo tiene. Está dibujado con la métrica exacta del
 * resto —24×24, trazo 2, puntas redondas, y las mismas coordenadas que usan
 * los demás para el cuerpo del ícono— para que no desentone. Cuando lo
 * dibujes en Figma, se reemplaza este `d` y listo.
 */
export function CloseIcon({ className }: IconProps) {
  return (
    <Drawn spec={FRAME} seed={66} className={className} />
  )
}

/**
 * Grilla proporcional. Figma: `Proportional` (26:395/26:417) — mismo caso que
 * la flecha del Dropdown: no se pudo bajar el trazo exacto, se dibujó a ojo
 * sobre la captura (dos marcas de esquina, como un ícono de "mantener
 * proporción").
 */
export function ProportionalIcon({ className }: IconProps) {
  return (
    <Drawn spec={PROPORTIONAL} seed={157} className={className} />
  )
}

/** Grilla cuadrada. Figma: `Proportional` (26:395/26:417, variante). */
export function SquareIcon({ className }: IconProps) {
  return (
    <Drawn spec={SQUARED} seed={92} className={className} />
  )
}

/**
 * Blanco y negro. **No viene de Figma** — no hay un frame dibujado para el
 * picker de Ajustes todavía. Un círculo partido al medio, la marca habitual
 * de contraste/blanco y negro.
 */
export function ContrastIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3V21" />
    </svg>
  )
}

/** Bordes. **No viene de Figma**, mismo caso que `ContrastIcon`: un trazo en
 * zigzag, como un contorno. */
export function EdgesIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 16L8 8L12 13L16 6L21 11" />
    </svg>
  )
}

/** Facetado. **No viene de Figma**, mismo caso: un hexágono, como una faceta. */
export function FacetsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3L20 8V16L12 21L4 16V8Z" />
    </svg>
  )
}

/**
 * La flecha del Dropdown. Figma: `Dropdown` (23:130) — existe en el archivo,
 * pero esta sesión no pudo bajar el trazo exacto (la red del entorno bloquea
 * la descarga directa de assets de Figma; solo se pudo ver por captura). Se
 * dibujó a ojo sobre esa captura, con la métrica del set. Reemplazar el `d`
 * cuando se pueda leer el archivo.
 */
export function ChevronDownIcon({ className }: IconProps) {
  return (
    <Drawn spec={DROPDOWN} seed={105} className={className} />
  )
}

/**
 * La linterna: la luz de la cámara, para iluminar la hoja en la mesa de luz.
 *
 * **Tampoco viene de Figma.** Cabeza ancha arriba, mango abajo y el botón en el
 * medio, con la métrica del set y el radio de 1 que usan los extremos de `File`.
 * Cuando se dibuje en el archivo, se reemplaza el `d`.
 */
export function FlashlightIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M7 3H17V6L15 10V20C15 20.5523 14.5523 21 14 21H10C9.44772 21 9 20.5523 9 20V10L7 6V3ZM7 6H17M12 13V15" />
    </svg>
  )
}

/**
 * El parlante: el sonido de Enmarcado, prendido. Y tachado, callado.
 *
 * **Tampoco vienen de Figma.** La bocina en la mitad izquierda —el mismo trapecio
 * que dibuja cualquier set—, y a la derecha las dos ondas o la cruz, con la métrica
 * del set. Cuando se dibujen en el archivo, se reemplazan los `d`.
 */
export function SpeakerIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M11 5L6 9H3V15H6L11 19V5ZM15.5 8.5C16.4 9.4 17 10.6 17 12C17 13.4 16.4 14.6 15.5 15.5M18.5 5.5C20.2 7.2 21 9.5 21 12C21 14.5 20.2 16.8 18.5 18.5" />
    </svg>
  )
}

export function SpeakerOffIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M11 5L6 9H3V15H6L11 19V5ZM16 9L22 15M22 9L16 15" />
    </svg>
  )
}
