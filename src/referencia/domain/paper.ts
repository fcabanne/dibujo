import type { Paper, SheetId } from '../types'

/**
 * Las hojas en las que se imprime. No tienen nada que ver con el tamaño del dibujo:
 * el dibujo final puede ser un A2 y aun así la referencia se imprime en el A4 que
 * entra en la impresora de casa. Lo que sale de acá no está a escala real, y no
 * importa — las medidas que hacen falta están escritas encima.
 */
export const PRINT_SHEETS: { id: SheetId; label: string; w: number; h: number }[] = [
  { id: 'a4', label: 'A4', w: 21, h: 29.7 },
  { id: 'a3', label: 'A3', w: 29.7, h: 42 },
  { id: 'oficio', label: 'Oficio', w: 21.6, h: 33 },
]

/** La hoja de impresión, ya acostada si la foto es apaisada. */
export function printSheet(id: SheetId, aspect: number): { w: number; h: number; label: string } {
  const sheet = PRINT_SHEETS.find((s) => s.id === id) ?? PRINT_SHEETS[0]
  return aspect > 1
    ? { w: sheet.h, h: sheet.w, label: sheet.label }
    : { w: sheet.w, h: sheet.h, label: sheet.label }
}

export interface PaperPreset {
  id: Paper['id']
  label: string
  /** En cm, lado corto primero. */
  w: number
  h: number
}

export const PAPER_PRESETS: PaperPreset[] = [
  { id: 'a5', label: 'A5', w: 14.8, h: 21 },
  { id: 'a4', label: 'A4', w: 21, h: 29.7 },
  { id: 'a3', label: 'A3', w: 29.7, h: 42 },
  { id: 'a2', label: 'A2', w: 42, h: 59.4 },
]

/**
 * Margen de seguridad del export en hoja, en cm.
 *
 * Es fijo y no un control: toda impresora se come unos milímetros del borde, así que
 * un export sin margen es un export con la grilla mordida. Un centímetro alcanza en
 * cualquier impresora hogareña y no vale la pena hacerlo elegir.
 */
export const SAFE_MARGIN = 1

/**
 * Las medidas de la hoja, ya orientadas.
 *
 * Los presets se acuestan solos si la foto es apaisada. No hace falta preguntarlo:
 * una foto horizontal sobre un A4 parado desperdicia media hoja, y nadie elige eso a
 * propósito. Lo que se escribe a mano en "a medida", en cambio, se respeta tal cual
 * — ahí el orden de los números es una decisión, no un descuido.
 */
export function paperSize(paper: Paper, aspect: number): { w: number; h: number } {
  if (paper.id === 'custom') return { w: paper.w, h: paper.h }
  return aspect > 1 ? { w: paper.h, h: paper.w } : { w: paper.w, h: paper.h }
}

/**
 * Cuánto va a medir el dibujo sobre la hoja, en cm.
 *
 * La foto casi nunca tiene la proporción de un A4, así que el dibujo entra centrado
 * y sobra papel en un sentido. Decirlo es parte del trabajo: es la diferencia entre
 * "dividí en ocho" y "cada casilla te va a quedar de 2,4 cm", que es el número que
 * se usa con la regla.
 */
export function drawingArea(paper: Paper, aspect: number): { w: number; h: number } | null {
  if (paper.id === 'none') return null
  const sheet = paperSize(paper, aspect)
  const availW = Math.max(1, sheet.w - SAFE_MARGIN * 2)
  const availH = Math.max(1, sheet.h - SAFE_MARGIN * 2)
  const scale = Math.min(availW / aspect, availH)
  return { w: scale * aspect, h: scale }
}

const CM_PER_POINT = 2.54 / 72

/** Un cm son 28,35 puntos PostScript, que es la unidad en la que se escribe un PDF. */
export function cmToPoints(cm: number): number {
  return cm / CM_PER_POINT
}
