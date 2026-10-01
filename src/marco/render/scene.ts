import { composeRects, computeLayout, type SceneRects } from '../domain/geometry'
import type { AppState, Layout } from '../types'
import { drawArtwork } from './artwork'
import { drawGlassClips } from './clips'
import { drawFrame, drawRebateShadow, type Parallax } from './frame'
import { drawGlass, drawGlassEdge } from './glass'
import { lightFor, type Light } from './light'
import { drawMat } from './mat'
import { drawCastShadow } from './shadow'
import { applyObjectTransform, isRest, objectLight, REST_POSE, type Pose } from './pose'
import { drawObjectFalloff, drawWall } from './wall'

export interface SceneParams {
  width: number
  height: number
  pxPerCm: number
  dpr: number
  /** Puntero normalizado a -1..1 sobre el lienzo, ya suavizado. */
  parallax: Parallax
  /**
   * Dónde va el centro del cuadro, en px. Sin él cuelga donde siempre: al medio y
   * apenas por encima. El celular lo pasa porque el lugar libre cambia —el cajón de
   * controles sube y el cuadro se acomoda arriba de él—.
   */
  anchor?: { x: number; y: number }
  /** Cuánto se apartó el cuadro de su reposo. Sin ella, cuelga quieto. */
  pose?: Pose
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
  const { width, height, pxPerCm, parallax, anchor } = params
  const pose = params.pose ?? REST_POSE
  const layout = computeLayout(state)
  const light = lightFor(parallax.x, parallax.y)
  const rects = composeRects(layout, { width, height }, pxPerCm, parallax, anchor)
  const { outer, glass, sight } = rects
  const depthPx = layout.depth * pxPerCm

  // 1. Pared, con el foco apuntado al cuadro
  drawWall(ctx, width, height, state.wall, light, outer, pxPerCm)

  // 2. Sombra proyectada. Se desplaza más que el cuadro: esa diferencia es la
  //    señal de profundidad más barata que hay.
  drawCastShadow(ctx, outer, layout.depth, pxPerCm, state.wall.color)

  const hasFrame = state.frame.width > 0
  const mat = state.mats[0]
  const hasMat = Boolean(mat?.enabled)

  // De acá en más se dibuja el objeto, en su espacio: si el cuadro se balancea o se
  // despega, todo lo suyo lo acompaña. La luz y el ojo se llevan a ese espacio,
  // porque lo que importa es de dónde les llegan a los listones.
  const world = ctx.getTransform()
  const moved = !isRest(pose)
  const objLight = objectLight(light, pose)
  const objParallax = moved ? toObjectVector(parallax, pose) : parallax
  ctx.save()
  applyObjectTransform(ctx, pose, rects, pxPerCm)

  // 3. Marco, con su cara lateral asomando según el puntero
  if (hasFrame) {
    drawFrame(ctx, outer, glass, state.frame, objLight, depthPx, objParallax, pxPerCm)
  }

  // 4. Obra y 5. passe-partout por encima de su borde
  if (image) drawArtwork(ctx, sight, image, state.artwork)
  if (hasMat) drawMat(ctx, glass, sight, mat, pxPerCm, objLight)

  // 6. Vidrio, sobre todo el contenido del rebaje. El reflejo es del cuarto y no
  //    del cuadro, así que se pinta en el espacio de la pantalla.
  drawGlass(ctx, glass, state.glass, light, parallax, world)

  // 7. Sombra del rebaje, o el canto del vidrio y los ganchitos si no hay marco
  if (hasFrame) {
    drawRebateShadow(ctx, glass, depthPx, objLight, hasMat ? mat.color : null)
  } else {
    if (state.glass !== 'none') drawGlassEdge(ctx, glass, pxPerCm, objLight)
    drawGlassClips(ctx, glass, pxPerCm, objLight, light)
  }

  // 8. El foco también cae sobre el cuadro, no solo sobre la pared. El foco está
  //    quieto en el cuarto: se recorta al cuadro, pero se pinta en la pantalla.
  ctx.beginPath()
  ctx.rect(outer.x, outer.y, outer.w, outer.h)
  ctx.clip()
  if (moved) ctx.setTransform(world)
  drawObjectFalloff(ctx, outer, light, moved ? { x: 0, y: 0, w: width, h: height } : outer)
  ctx.restore()

  return { layout, rects, light }
}

/** El ojo, o cualquier dirección de pantalla, vista desde el cuadro girado. */
function toObjectVector(v: { x: number; y: number }, pose: Pose) {
  const a = -(pose.roll + pose.turn)
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }
}
