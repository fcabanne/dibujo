/**
 * Los íconos del sistema.
 *
 * Todos menos el último salen del archivo de Figma sin redibujar: el `d` es el
 * que exporta el archivo, tal cual. Todos comparten métrica —24×24, trazo
 * de 2, puntas y uniones redondas— y esa métrica es lo que los hace ver de
 * la misma familia, así que un ícono nuevo la respeta o no entra.
 *
 * El color no está acá. Va en `currentColor` para que lo resuelva quien lo
 * use: en el diseño el mismo ícono va claro sobre el violeta cuando la
 * pestaña está abierta, y violeta sobre el fondo claro cuando no.
 */

import type { SVGProps } from 'react'

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} satisfies SVGProps<SVGSVGElement>

export type IconProps = { className?: string }

/** Subir una foto. Figma: `Upload` (4:740). */
export function UploadIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 17V19C4 19.5304 4.21071 20.0391 4.58579 20.4142C4.96086 20.7893 5.46957 21 6 21H18C18.5304 21 19.0391 20.7893 19.4142 20.4142C19.7893 20.0391 20 19.5304 20 19V17M17 9L12 4L7 9M12 4V16" />
    </svg>
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
    <svg {...base} className={className}>
      <path d="M3 6H21M3 12H21M3 18H21M6 3V21M12 3V21M18 3V21" />
    </svg>
  )
}

/** El pincel: los ajustes de la foto. Figma: `Paint` (4:737). */
export function PaintIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8.2 13.2C9.2177 10.505 10.9441 8.13474 13.1971 6.33944C15.45 4.54414 18.1458 3.3904 21 3C20.6096 5.85418 19.4559 8.55002 17.6606 10.8029C15.8653 13.0559 13.495 14.7823 10.8 15.8M10.6 9C12.5432 9.89687 14.1031 11.4568 15 13.4M3 21V17C3 16.2089 3.2346 15.4355 3.67412 14.7777C4.11365 14.1199 4.73836 13.6072 5.46927 13.3045C6.20017 13.0017 7.00444 12.9225 7.78036 13.0769C8.55629 13.2312 9.26902 13.6122 9.82843 14.1716C10.3878 14.731 10.7688 15.4437 10.9231 16.2196C11.0775 16.9956 10.9983 17.7998 10.6955 18.5307C10.3928 19.2616 9.88008 19.8864 9.22228 20.3259C8.56448 20.7654 7.79113 21 7 21H3Z" />
    </svg>
  )
}

/** Bajar el archivo. Figma: `Download` (4:751). */
export function DownloadIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 17V19C4 19.5304 4.21071 20.0391 4.58579 20.4142C4.96086 20.7893 5.46957 21 6 21H18C18.5304 21 19.0391 20.7893 19.4142 20.4142C19.7893 20.0391 20 19.5304 20 19V17M17 11L12 16L7 11M12 16V4" />
    </svg>
  )
}

/** Volver. Figma: `Back` (4:757) — una flecha de retorno, no un chevrón. */
export function BackIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 6L5 10L9 14M5 10H16C17.0609 10 18.0783 10.4214 18.8284 11.1716C19.5786 11.9217 20 12.9391 20 14C20 15.0609 19.5786 16.0783 18.8284 16.8284C18.0783 17.5786 17.0609 18 16 18H15" />
    </svg>
  )
}

/** La foto. Figma: `Photo` (22:57). */
export function PhotoIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M15 8H15.01M3 16L8 11C8.928 10.107 10.072 10.107 11 11L16 16M14 14L15 13C15.928 12.107 17.072 12.107 18 13L21 16M3 6C3 5.20435 3.31607 4.44129 3.87868 3.87868C4.44129 3.31607 5.20435 3 6 3H18C18.7956 3 19.5587 3.31607 20.1213 3.87868C20.6839 4.44129 21 5.20435 21 6V18C21 18.7956 20.6839 19.5587 20.1213 20.1213C19.5587 20.6839 18.7956 21 18 21H6C5.20435 21 4.44129 20.6839 3.87868 20.1213C3.31607 19.5587 3 18.7956 3 18V6Z" />
    </svg>
  )
}

/** Uno menos. Figma: `Minus` (22:289). */
export function MinusIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 12H19" />
    </svg>
  )
}

/** Uno más. Figma: `Plus` (22:291). */
export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 5V19M5 12H19" />
    </svg>
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
    <svg {...base} className={className}>
      <path d="M18 6L6 18M6 6L18 18" />
    </svg>
  )
}
