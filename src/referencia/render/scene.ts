import { computeGrid } from '../domain/grid'
import { drawingArea } from '../domain/paper'
import { drawGrid, type Rect } from './grid'
import type { AppState } from '../types'

/**
 * Foto y grilla dentro de un rectángulo, sea el de la pantalla o el de un export de
 * seis mil píxeles.
 *
 * Es una sola función para los tres destinos a propósito: en cuanto la vista previa
 * y el export dibujan por caminos distintos, se desincronizan, y una herramienta
 * cuyo resultado no es lo que mostró no sirve para decidir nada.
 */
export function paintScene(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  photo: CanvasImageSource,
  state: AppState,
  aspect: number,
): void {
  ctx.drawImage(photo, rect.x, rect.y, rect.w, rect.h)

  const lines = computeGrid(state.grid, aspect)
  if (!lines) return

  // Las cotas solo pueden existir si hay tamaño de dibujo: sin él no hay centímetros
  // que informar, apenas una proporción.
  const area = drawingArea(state.paper, aspect)
  drawGrid(
    ctx,
    rect,
    lines,
    state.grid.style,
    area ? { w: lines.cellW * area.w, h: lines.cellH * area.h } : null,
  )
}

/** El rectángulo más grande con la proporción `aspect` que entra en `box`. */
export function fitRect(aspect: number, box: { w: number; h: number }): Rect {
  const w = Math.min(box.w, box.h * aspect)
  const h = w / aspect
  return { x: (box.w - w) / 2, y: (box.h - h) / 2, w, h }
}
