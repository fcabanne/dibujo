import { composeRects, computeLayout, type SceneRects } from '../domain/geometry'
import type { AppState, Layout } from '../types'
import { drawArtwork } from './artwork'
import { drawFrame, drawGlassClips, drawRebateShadow, type Parallax } from './frame'
import { drawGlass } from './glass'
import { lightFor, type Light } from './light'
import { drawMat } from './mat'
import { drawCastShadow } from './shadow'
import { drawWall } from './wall'

export interface SceneParams {
  width: number
  height: number
  pxPerCm: number
  dpr: number
  /** Puntero normalizado a -1..1 sobre el lienzo, ya suavizado. */
  parallax: Parallax
}

export interface SceneResult {
  light: Light
  layout: Layout
  rects: SceneRects
}

/**
 * Composición completa, de la pared hacia el espectador. Es una función pura de
 * (estado, imagen, tamaño, puntero): la misma llamada sirve para el lienzo y, en la
 * Fase 2, para el thumbnail de un snapshot en un canvas chico.
 */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  state: AppState,
  image: HTMLImageElement | null,
  params: SceneParams,
): SceneResult {
  const { width, height, pxPerCm, dpr, parallax } = params
  const layout = computeLayout(state)
  const light = lightFor(parallax.x, parallax.y)
  const rects = composeRects(layout, { width, height }, pxPerCm, parallax)
  const { outer, glass, sight } = rects
  const depthPx = layout.depth * pxPerCm

  // 1. Pared, con el foco apuntado al cuadro
  drawWall(ctx, width, height, state.wall, light, outer)

  // 2. Sombra proyectada. Se desplaza más que el cuadro: esa diferencia es la
  //    señal de profundidad más barata que hay.
  drawCastShadow(ctx, outer, layout.depth, pxPerCm, light)

  const hasFrame = state.frame.width > 0
  const mat = state.mats[0]
  const hasMat = Boolean(mat?.enabled)

  // 3. Marco, con su cara lateral asomando según el puntero
  if (hasFrame) {
    drawFrame(ctx, outer, glass, state.frame, light, depthPx, parallax)
  }

  // 4. Obra y 5. passe-partout por encima de su borde
  if (image) drawArtwork(ctx, sight, image, state.artwork)
  if (hasMat) drawMat(ctx, glass, sight, mat, pxPerCm, light)

  // 6. Vidrio, sobre todo el contenido del rebaje
  drawGlass(ctx, glass, state.glass, dpr, light, parallax)

  // 7. Sombra del rebaje, o los ganchitos si no hay marco
  if (hasFrame) {
    drawRebateShadow(ctx, glass, depthPx, light)
  } else {
    drawGlassClips(ctx, glass, pxPerCm)
  }

  return { layout, rects, light }
}
