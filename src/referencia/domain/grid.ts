import type { GridState } from '../types'

/**
 * Dónde caen las líneas, siempre como fracción 0..1 del lado de la foto.
 *
 * Nunca en píxeles: la misma grilla se dibuja en la vista previa de mil píxeles y
 * en el export de seis mil, y si las posiciones estuvieran en píxeles habría que
 * recalcularlas para cada tamaño — que es exactamente la clase de cuenta doble por
 * la que lo que ves deja de ser lo que sale.
 */
export interface GridLines {
  /** Líneas verticales, como fracción del ancho. Sin los bordes. */
  x: number[]
  /** Líneas horizontales, como fracción del alto. */
  y: number[]
  /** Las de la subdivisión, que van más finas y más tenues. Vacías si está apagada. */
  subX: number[]
  subY: number[]
  /** Casillas a lo ancho y a lo alto, contando la última aunque salga cortada. */
  cols: number
  rows: number
  /** Lado de la casilla entera, como fracción de cada lado. */
  cellW: number
  cellH: number
  /** Lo que sobra a la derecha y abajo, como fracción. */
  restX: number
  restY: number
}

/**
 * El slider se mueve entre estos números, y es el mismo para los dos modos. Más de
 * ocho a lo ancho no se lee sobre una foto: las casillas quedan más chicas que el
 * detalle que uno está tratando de ubicar adentro de ellas.
 */
export const GRID_LIMITS = { min: 2, max: 8 }

export function computeGrid(grid: GridState, aspect: number): GridLines | null {
  if (grid.mode === 'none') return null
  const n = clamp(grid.count)
  return grid.mode === 'proportional'
    ? proportional(n, grid.subdivide)
    : square(n, aspect, grid.subdivide)
}

/** Partes iguales por lado: cada casilla tiene la misma proporción que la foto. */
function proportional(n: number, subdivide: boolean): GridLines {
  const lines: number[] = []
  for (let i = 1; i < n; i++) lines.push(i / n)

  const sub = subdivide ? midlines(1 / n) : []

  return {
    x: lines,
    y: [...lines],
    subX: sub,
    subY: [...sub],
    cols: n,
    rows: n,
    cellW: 1 / n,
    cellH: 1 / n,
    restX: 0,
    restY: 0,
  }
}

/**
 * Cuadrados exactos desde arriba a la izquierda. El ancho se reparte justo —es lo
 * que se elige con el slider— pero el alto casi nunca es múltiplo del cuadrado, así
 * que la última fila sale cortada. Eso no es un defecto: es lo que hay que saber
 * antes de trazar.
 */
function square(n: number, aspect: number, subdivide: boolean): GridLines {
  const x: number[] = []
  for (let i = 1; i < n; i++) x.push(i / n)

  // El lado del cuadrado medido contra el alto: el mismo largo sobre un lado más
  // corto ocupa proporcionalmente más.
  const step = aspect / n
  const y: number[] = []
  for (let i = 1; i * step < 1 - 1e-6; i++) y.push(i * step)

  const full = Math.floor(1 / step + 1e-6)

  return {
    x,
    y,
    subX: subdivide ? midlines(1 / n) : [],
    subY: subdivide ? midlines(step) : [],
    cols: n,
    rows: y.length + 1,
    cellW: 1 / n,
    cellH: step,
    restX: 0,
    restY: full === 0 ? 0 : Math.max(0, 1 - full * step),
  }
}

/**
 * El medio de cada casilla, de punta a punta del lado. La subdivisión no repite las
 * líneas que ya están: si dibujara una grilla del doble encima, las principales
 * quedarían pintadas dos veces y se verían más gruesas de lo que se eligió.
 */
function midlines(step: number): number[] {
  const out: number[] = []
  for (let i = 0; (i + 0.5) * step < 1 - 1e-6; i++) out.push((i + 0.5) * step)
  return out
}

function clamp(value: number): number {
  return Math.min(GRID_LIMITS.max, Math.max(GRID_LIMITS.min, Math.round(value)))
}

/** A1, B3, … — el nombre que tiene una columna en las etiquetas. */
export function columnLabel(index: number): string {
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}
