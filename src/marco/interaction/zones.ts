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

/** Dónde se apoya la burbuja de cada categoría: sobre la parte que edita. */
export function anchorsFor(rects: SceneRects, hasFrame: boolean, hasMat: boolean): Anchors {
  const { outer, glass, sight } = rects

  // Corridas del punto medio de su banda a propósito: ahí es donde el gizmo pone la
  // doble flecha, y si coinciden la burbuja tapa la manija que querés arrastrar.
  return {
    // Sobre la moldura, en el tramo bajo del lado izquierdo.
    frame: {
      x: hasFrame ? (outer.x + glass.x) / 2 : glass.x - GHOST / 2,
      y: outer.y + outer.h * 0.74,
    },
    // Sobre la banda del passe-partout, hacia la izquierda del lado superior.
    mat: {
      x: glass.x + glass.w * 0.26,
      y: hasMat ? (glass.y + sight.y) / 2 : glass.y + GHOST / 2,
    },
    // Sobre el vidrio, esquina superior derecha de la obra. El margen es una
    // fracción de la obra y no un número fijo de píxeles: con un margen constante
    // la burbuja se despega de su esquina apenas hacés zoom.
    glass: { x: sight.x + sight.w * 0.88, y: sight.y + sight.h * 0.09 },
    // Sobre la obra, esquina inferior izquierda.
    artwork: { x: sight.x + sight.w * 0.12, y: sight.y + sight.h * 0.91 },
    // Junto a la cartela: es la zona de pared de la escena, así que el control que
    // pinta la pared vive ahí en vez de flotando en un rincón cualquiera.
    wall: { x: outer.x + outer.w + 46, y: outer.y + outer.h * 0.34 - 34 },
  }
}
