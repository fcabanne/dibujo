import { paintHeads, type HeadScene } from '../../shared/loomis/head'
import { computeGrid } from '../domain/grid'
import { drawingArea } from '../domain/paper'
import { drawGrid, lineWidthFor, type Rect } from './grid'
import type { AppState } from '../types'

/**
 * Foto, grilla y cabeza dentro de un rectángulo, sea el de la pantalla o el de un export de
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
  /** Ver `paintGrid`: acá sí puede venir en `true`, es lo único que la distingue. */
  labels = false,
  /** Las cabezas ya resueltas para la foto, o null si no hay (ver `paintHead`). */
  head: HeadScene | null = null,
): void {
  paintPhoto(ctx, rect, photo, state.effects.opacity)
  paintGrid(ctx, rect, state, aspect, labels)
  paintHead(ctx, rect, state, head)
}

/**
 * La cabeza de construcción, encima de la grilla. Como la grilla, su grosor es
 * relativo al ancho de la foto: la línea que se ve en pantalla es la que sale en
 * el export.
 *
 * Las cabezas llegan resueltas de afuera porque encontrarlas es asincrónico —hay un
 * detector que se baja la primera vez—; lo que decide si se ven es el estado.
 */
export function paintHead(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  state: AppState,
  head: HeadScene | null,
): void {
  if (!head || state.head.mode === 'none') return
  const { style } = state.head
  paintHeads(ctx, rect, head, {
    color: style.color,
    opacity: style.opacity,
    lineWidth: lineWidthFor(rect, style),
  })
}

/**
 * La foto, fundida contra papel blanco según cuánto se ve. Blanco y no
 * transparente: un JPEG no tiene transparencia y la saldría negra, y en la hoja
 * impresa el papel es blanco igual. Suelta para el lienzo, que la usa también en
 * sus fundidos: `alpha` es el de ese fundido, y se multiplica.
 */
export function paintPhoto(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  photo: CanvasImageSource,
  opacity: number,
  alpha = 1,
): void {
  ctx.save()
  if (opacity < 1) {
    ctx.globalAlpha = alpha
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
  }
  ctx.globalAlpha = alpha * opacity
  ctx.drawImage(photo, rect.x, rect.y, rect.w, rect.h)
  ctx.restore()
}

/**
 * La mitad de `paintScene` que va encima de la foto. Existe suelta para el
 * lienzo, que durante un cambio de grilla pinta la vieja y la nueva a la vez
 * con opacidades cruzadas. No es un segundo camino: `paintScene` la usa
 * tal cual, así que lo que se funde en pantalla es lo mismo que sale.
 *
 * `labels` por defecto en `false`: el lienzo nunca las pasa, así que las
 * etiquetas quedan reservadas al export sin que el llamador tenga que
 * acordarse de apagarlas.
 */
export function paintGrid(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  state: AppState,
  aspect: number,
  labels = false,
): void {
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
    labels,
  )
}

/** El rectángulo más grande con la proporción `aspect` que entra en `box`. */
export function fitRect(aspect: number, box: { w: number; h: number }): Rect {
  const w = Math.min(box.w, box.h * aspect)
  const h = w / aspect
  return { x: (box.w - w) / 2, y: (box.h - h) / 2, w, h }
}
