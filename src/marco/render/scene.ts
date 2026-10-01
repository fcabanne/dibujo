import { composeRects, computeLayout, layoutFromDims, type Dims, type SceneRects } from '../domain/geometry'
import type { AppState, Layout } from '../types'
import { drawArtwork } from './artwork'
import { drawGlassClips } from './clips'
import { drawFrame, drawRebateShadow, type Parallax } from './frame'
import { drawGlass, drawGlassEdge } from './glass'
import { REST_LIGHT, type Light } from './light'
import { drawMat } from './mat'
import { drawCastShadow, standoff } from './shadow'
import { GONE } from '../physics/body'
import { applyObjectTransform, isRest, objectLight, REST_POSE, wallShift, type Pose } from './pose'
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
  /**
   * Las medidas tal como se ven, si no son las del estado: el cuerpo las lleva con
   * resortes hacia las de verdad. Sin ellas se dibuja el estado tal cual.
   */
  dims?: Dims
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
  const layout = params.dims ? layoutFromDims(params.dims) : computeLayout(state)
  const light = REST_LIGHT
  const rects = composeRects(layout, { width, height }, pxPerCm, anchor)
  const { outer, glass, sight } = rects
  const depthPx = layout.depth * pxPerCm

  // La pared, vista desde donde está el ojo: el frente del cuadro está a su espesor
  // más media cuña de la pared, y lo de atrás se corre respecto de él.
  const front = layout.depth + standoff(layout.outer.h) / 2
  const shift = wallShift(parallax, front, pxPerCm)
  const behind = { ...outer, x: outer.x + shift.x, y: outer.y + shift.y }

  // 1. Pared, con el foco apuntado al cuadro
  drawWall(ctx, width, height, state.wall, light, behind, pxPerCm)

  // 2. Sombra proyectada. Está sobre la pared, así que se corre con ella: entre la
  //    sombra y el canto se abre la rendija que dice que el cuadro está colgado.
  drawCastShadow(ctx, behind, layout.depth, pxPerCm, state.wall.color)

  // Lo que existe es lo que se ve: una moldura que se está yendo a cero se sigue
  // dibujando hasta que no queda nada de ella.
  const mat = state.mats[0]
  const hasFrame = params.dims ? params.dims.frame > GONE : state.frame.width > 0
  const hasMat = Boolean(mat) && (params.dims ? params.dims.mat > GONE : Boolean(mat?.enabled))
  // Los ganchitos aparecen recién cuando la moldura terminó de irse.
  const clipped = !hasFrame && state.frame.width === 0

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
  } else if (clipped) {
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
