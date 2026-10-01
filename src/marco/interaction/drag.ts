import { clamp, LIMITS, snap, type SceneRects } from '../domain/geometry'
import type { Action } from '../state/reducer'
import type { AppState } from '../types'
import { grabDistance, type Point } from './zones'

/** Una banda agarrada: cuál, y desde dónde. */
export interface DragState {
  target: 'frame' | 'mat'
  startWidth: number
  startDist: number
  /** Escala congelada: si se reajustara al crecer, el cuadro se escapa del cursor. */
  frozenScale: number
  /** El último movimiento, para saber a qué velocidad va la mano. */
  lastX: number
  lastY: number
  lastAt: number
  /** px/ms, suavizada. */
  speed: number
}

export function startDrag(
  target: 'frame' | 'mat',
  current: AppState,
  p: Point,
  rects: SceneRects,
  scale: number,
): DragState {
  const mat = current.mats[0]
  return {
    target,
    startWidth: target === 'frame' ? current.frame.width : mat?.enabled ? mat.width : 0,
    startDist: grabDistance(p, rects),
    frozenScale: scale,
    lastX: p.x,
    lastY: p.y,
    lastAt: performance.now(),
    speed: 0,
  }
}

/**
 * Cuánto pesa, entre muesca y muesca, lo que la mano corrió de más. La banda sigue
 * apenas a la mano —un cuarto de lo que se movió— y al cruzar la mitad salta a la
 * muesca siguiente: ese salto es el clic que se siente.
 */
const DETENT_PULL = 0.25
/** Cuánto deja estirarse pasado el máximo, en cm, antes de que no ceda más. */
const STRETCH = 0.8

export interface DragResult {
  /** La medida redondeada, la que se encarga. */
  snapped: number
  /** La que se ve: la redondeada más lo que la mano tira entre muescas. */
  shown: number
  /** Cuánto se pasó del máximo, en cm. */
  over: number
  /** Si la medida redondeada cambió en este movimiento. */
  changed: boolean
}

/**
 * Mueve la banda agarrada. Despacha solo cuando la medida redondeada cambia: entre
 * muesca y muesca no pasa nada en el estado, y el resto de la app no tiene por qué
 * volver a dibujarse.
 */
export function dragWidth(
  drag: DragState,
  p: Point,
  rects: SceneRects,
  current: AppState,
  dispatch: (action: Action) => void,
): DragResult {
  const now = performance.now()
  const dt = Math.max(1, now - drag.lastAt)
  const moved = Math.hypot(p.x - drag.lastX, p.y - drag.lastY)
  drag.speed += (moved / dt - drag.speed) * 0.4
  drag.lastX = p.x
  drag.lastY = p.y
  drag.lastAt = now

  const dist = grabDistance(p, rects)
  const raw = drag.startWidth + (dist - drag.startDist) / drag.frozenScale
  const limits = drag.target === 'frame' ? LIMITS.frameWidth : LIMITS.matWidth
  const over = Math.max(0, raw - limits.max)

  let snapped: number
  let changed = false
  if (drag.target === 'frame') {
    snapped = clamp(snap(raw, limits.step), LIMITS.frameWidth.min, limits.max)
    if (snapped !== current.frame.width) {
      dispatch({ type: 'frame/patch', patch: { width: snapped } })
      changed = true
    }
  } else {
    // Por debajo del mínimo el passe-partout no se encoge: se apaga.
    const width = clamp(snap(raw, limits.step), 0, limits.max)
    snapped = width < LIMITS.matWidth.min ? 0 : width
    const mat = current.mats[0]
    if (snapped === 0) {
      if (mat?.enabled) {
        dispatch({ type: 'mat/patch', patch: { enabled: false } })
        changed = true
      }
    } else if (!mat?.enabled || mat.width !== snapped) {
      dispatch({ type: 'mat/patch', patch: { enabled: true, width: snapped } })
      changed = true
    }
  }

  // Pasado el máximo, la banda resiste: cede cada vez menos, como un elástico, y
  // al soltarla vuelve.
  const shown =
    over > 0
      ? limits.max + STRETCH * (1 - 1 / (1 + over / STRETCH))
      : Math.max(0, snapped + (raw - snapped) * DETENT_PULL)

  return { snapped, shown, over, changed }
}
