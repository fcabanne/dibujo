import type { AppState } from '../types'

/**
 * Qué pasó entre un cuadro y el siguiente, dicho como lo vive el cuadro: alguien
 * eligió algo nuevo (`commit`), o está pasando por encima de una muestra (`hover`).
 *
 * Se deduce comparando estados en vez de avisarlo desde cada botón: así las muestras,
 * los abanicos y la cartela no saben nada de sonidos ni de pesos, y nada que cambie
 * el cuadro se puede escapar sin su reacción.
 *
 * Mira dos estados: el que se ve (`shown`, con la vista previa del puntero encima) y el
 * confirmado (`committed`). Un clic sobre una muestra que ya se estaba viendo no
 * cambia lo que se ve, pero sí lo confirmado: por eso hacen falta los dos.
 */
export type Part = 'frame' | 'mat' | 'glass' | 'wall' | 'art'

/**
 * `width`: lo único que cambió de la banda es su ancho —un paso del deslizador del
 * celular, una medida tipeada—. Suena como la muesca y no como elegir otra moldura.
 */
export type Reaction = { kind: 'hover' } | { kind: 'commit'; part: Part; width?: boolean }

export interface Seen {
  shown: AppState
  committed: AppState
}

function frameLooks(s: AppState) {
  const f = s.frame
  return `${f.color}|${f.material}|${f.finish}|${f.profile}|${f.width}`
}

function matLooks(s: AppState) {
  const m = s.mats[0]
  return m ? `${m.enabled}|${m.color}|${m.width}` : ''
}

function looks(s: AppState) {
  return `${frameLooks(s)}#${matLooks(s)}#${s.glass}#${s.wall.color}|${s.wall.pattern}`
}

/**
 * Las reacciones de pasar de `prev` a `next`. `dragging` calla los cambios de ancho
 * mientras la mano arrastra: esos tienen su propio clic, y el asiento llega al soltar.
 */
export function diffScenes(prev: Seen, next: Seen, dragging: boolean): Reaction[] {
  const out: Reaction[] = []
  const a = prev.committed
  const b = next.committed

  if (a !== b) {
    if (frameLooks(a) !== frameLooks(b) && !(dragging && sameButWidth(a, b, 'frame'))) {
      out.push({ kind: 'commit', part: 'frame', width: sameButWidth(a, b, 'frame') && a.frame.width > 0 && b.frame.width > 0 })
    }
    if (matLooks(a) !== matLooks(b) && !(dragging && sameButWidth(a, b, 'mat'))) {
      const on = (s: AppState) => Boolean(s.mats[0]?.enabled)
      out.push({ kind: 'commit', part: 'mat', width: sameButWidth(a, b, 'mat') && on(a) && on(b) })
    }
    if (a.glass !== b.glass) out.push({ kind: 'commit', part: 'glass' })
    if (a.wall.color !== b.wall.color || a.wall.pattern !== b.wall.pattern) {
      out.push({ kind: 'commit', part: 'wall' })
    }
    if (a.artwork.size.w !== b.artwork.size.w || a.artwork.size.h !== b.artwork.size.h) {
      out.push({ kind: 'commit', part: 'art' })
    }
  }

  // Pasar por encima de una muestra: lo que se ve cambió, sin que se haya confirmado nada.
  if (out.length === 0 && prev.shown !== next.shown && next.shown !== b && looks(prev.shown) !== looks(next.shown)) {
    out.push({ kind: 'hover' })
  }

  return out
}

/** Si entre dos estados lo único que cambió de la banda es su ancho (o si está puesta). */
function sameButWidth(a: AppState, b: AppState, part: 'frame' | 'mat'): boolean {
  if (part === 'frame') {
    const f = a.frame
    const g = b.frame
    return f.color === g.color && f.material === g.material && f.finish === g.finish && f.profile === g.profile
  }
  return a.mats[0]?.color === b.mats[0]?.color
}
