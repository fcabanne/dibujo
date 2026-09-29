import type { SceneRects } from '../domain/geometry'
import type { Rect } from '../types'

/**
 * Zonas del cuadro bajo el puntero. Son rectángulos concéntricos, así que se
 * resuelve con aritmética y no hace falta leer píxeles del canvas.
 */
export type Zone = 'frame' | 'frame-ghost' | 'mat' | 'mat-ghost' | 'art' | 'wall'

/**
 * Ancho de la banda fantasma que queda cuando una pieza está en cero. Sin esto, al
 * llevar el marco o el passe-partout a cero desaparece la banda y te quedás sin nada
 * para agarrar: es el camino de vuelta.
 */
export const GHOST = 22

export interface Point {
  x: number
  y: number
}

function inside(p: Point, r: Rect, grow = 0): boolean {
  return (
    p.x >= r.x - grow &&
    p.x <= r.x + r.w + grow &&
    p.y >= r.y - grow &&
    p.y <= r.y + r.h + grow
  )
}

export function hitZone(
  p: Point,
  rects: SceneRects,
  hasFrame: boolean,
  hasMat: boolean,
): Zone {
  const { outer, glass, sight } = rects

  if (hasFrame && inside(p, outer) && !inside(p, glass)) return 'frame'
  if (!hasFrame && inside(p, glass, GHOST) && !inside(p, glass)) return 'frame-ghost'

  if (hasMat && inside(p, glass) && !inside(p, sight)) return 'mat'
  if (!hasMat && inside(p, glass) && !inside(p, shrink(sight, GHOST))) return 'mat-ghost'

  if (inside(p, sight)) return 'art'
  return 'wall'
}

/**
 * Lo mismo que `hitZone`, pero para un dedo.
 *
 * Una moldura de tres centímetros en un teléfono mide veinte píxeles, menos que la
 * yema. Así que la banda se agranda hacia afuera —la pared de al lado del marco
 * cuenta como marco— y la del passe-partout se mete un poco en la obra. Hacia
 * adentro el marco no crece: ahí empieza el passe-partout, y robarle toques a una
 * banda para dárselos a la otra sería peor que errarle.
 */
export function touchZone(
  p: Point,
  rects: SceneRects,
  hasFrame: boolean,
  hasMat: boolean,
): Zone {
  const { outer, glass, sight } = rects
  const REACH = 16

  if (hasFrame && inside(p, outer, REACH) && !inside(p, glass)) return 'frame'
  if (!hasFrame && inside(p, glass, GHOST + REACH) && !inside(p, glass)) return 'frame-ghost'

  if (hasMat && inside(p, glass) && !inside(p, shrink(sight, 10))) return 'mat'
  if (!hasMat && inside(p, glass) && !inside(p, shrink(sight, GHOST))) return 'mat-ghost'

  if (inside(p, sight)) return 'art'
  return 'wall'
}

function shrink(r: Rect, by: number): Rect {
  return { x: r.x + by, y: r.y + by, w: Math.max(0, r.w - by * 2), h: Math.max(0, r.h - by * 2) }
}

/** Las zonas que se arrastran para cambiar un ancho. */
export function draggableTarget(zone: Zone): 'frame' | 'mat' | null {
  if (zone === 'frame' || zone === 'frame-ghost') return 'frame'
  if (zone === 'mat' || zone === 'mat-ghost') return 'mat'
  return null
}

/**
 * Distancia del puntero al centro sobre el eje de la banda que agarró. Arrastrar
 * hacia afuera aumenta el ancho, sin importar de qué lado del cuadro agarraste.
 */
export function grabDistance(p: Point, rects: SceneRects): number {
  const { outer, center } = rects
  const nx = Math.abs(p.x - center.x) / Math.max(1, outer.w / 2)
  const ny = Math.abs(p.y - center.y) / Math.max(1, outer.h / 2)
  return nx >= ny ? Math.abs(p.x - center.x) : Math.abs(p.y - center.y)
}

export interface Anchors {
  frame: Point
  mat: Point
  glass: Point
  artwork: Point
  wall: Point
}

/** Del canto del cuadro al centro de su burbuja. */
export const BUBBLE_GAP = 34
/** Mitad de la separación entre las dos burbujas de un mismo lado. */
const PAIR = 31
/** Lo que se aparta del borde de la pantalla el centro de una burbuja. */
const BUBBLE_EDGE = 32

/**
 * Dónde se apoya la burbuja de cada categoría.
 *
 * Una regla que se pueda adivinar: **dos a cada lado del cuadro y una abajo**, todas
 * afuera y sobre el eje del medio. A la izquierda lo que lo envuelve, de afuera hacia
 * adentro (marco y passe-partout); a la derecha lo que lo cubre y lo rodea (vidrio y
 * pared); abajo, la obra, que no abre un abanico sino la cartela.
 *
 * Antes cada una colgaba de un punto distinto de su propia banda, y las bandas son tan
 * finas que las burbujas terminaban encimadas o sueltas. Y arriba y abajo no hay lugar
 * para un abanico —el cuadro cuelga a la altura de la vista y sobran unos sesenta
 * píxeles—, mientras que a los costados sobran cuatrocientos: por eso las que abren
 * abanico van a los costados.
 *
 * Se corren para no salirse de la pantalla cuando el cuadro la llena.
 */
export function anchorsFor(
  rects: SceneRects,
  view?: { w: number; h: number },
): Anchors {
  const { outer } = rects
  const cx = outer.x + outer.w / 2
  const cy = outer.y + outer.h / 2
  const left = outer.x - BUBBLE_GAP
  const right = outer.x + outer.w + BUBBLE_GAP

  const keep = (p: Point): Point =>
    view
      ? {
          x: Math.min(Math.max(p.x, BUBBLE_EDGE), view.w - BUBBLE_EDGE),
          y: Math.min(Math.max(p.y, BUBBLE_EDGE), view.h - BUBBLE_EDGE),
        }
      : p

  return {
    frame: keep({ x: left, y: cy - PAIR }),
    mat: keep({ x: left, y: cy + PAIR }),
    glass: keep({ x: right, y: cy - PAIR }),
    wall: keep({ x: right, y: cy + PAIR }),
    artwork: keep({ x: cx, y: outer.y + outer.h + BUBBLE_GAP }),
  }
}
