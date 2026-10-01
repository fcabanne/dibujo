import type { SceneRects } from '../domain/geometry'
import type { Light } from './light'

/**
 * Cómo está el cuadro ahora mismo, más allá de dónde cuelga en reposo.
 *
 * Los rectángulos de `composeRects` dicen dónde está el cuadro quieto y derecho; esto
 * dice cuánto se apartó de ahí, y el render lo aplica como una transformación sobre
 * las capas del objeto. La pared no se transforma: el cuadro se mueve delante de ella.
 */
export interface Pose {
  /** Balanceo sobre el clavo, en radianes. Positivo gira en sentido horario. */
  roll: number
  /** Giro alrededor del centro, en radianes: el de cuando se rota la obra 90°. */
  turn: number
  /** Cuánto se despegó de la pared hacia el espectador, en cm. */
  lift: number
  /** Corrimiento vertical, en cm; positivo baja. El asiento en el alambre. */
  drop: number
  /**
   * Cuánto se separa de la pared el canto de arriba, como fracción de la cuña en
   * reposo: 1 es colgado normal, 0 aplastado contra la pared.
   */
  lean: number
  /** Giro hacia un costado, en radianes. En 2D solo asoma el canto. */
  yaw: number
}

export const REST_POSE: Pose = { roll: 0, turn: 0, lift: 0, drop: 0, lean: 1, yaw: 0 }

/**
 * Dónde está el clavo: sobre el eje del cuadro, a un poco más de un cuarto de su alto
 * desde arriba. Es por donde pasa el alambre tenso, y el punto sobre el que se balancea.
 */
export const NAIL = 0.28

export function nailOf(rects: SceneRects): { x: number; y: number } {
  return { x: rects.center.x, y: rects.outer.y + rects.outer.h * NAIL }
}

/** Si la pose es la de reposo: así el render se ahorra la transformación. */
export function isRest(p: Pose): boolean {
  return p.roll === 0 && p.turn === 0 && p.lift === 0 && p.drop === 0 && p.yaw === 0
}

/**
 * Cuánto agranda despegarse de la pared. Un cuadro que se acerca medio metro hacia
 * el ojo crece; uno que se despega dos centímetros, apenas: lo justo para leerse
 * como "más cerca".
 */
const VIEW_CM = 150

/**
 * Lleva el contexto al espacio del cuadro: de ahí en más, dibujar en los rectángulos
 * de reposo cae donde el cuadro está ahora.
 */
export function applyObjectTransform(
  ctx: CanvasRenderingContext2D,
  pose: Pose,
  rects: SceneRects,
  pxPerCm: number,
) {
  if (isRest(pose)) return
  const { center } = rects
  const nail = nailOf(rects)
  const scale = 1 + pose.lift / VIEW_CM

  ctx.translate(0, pose.drop * pxPerCm)
  ctx.translate(nail.x, nail.y)
  ctx.rotate(pose.roll)
  ctx.translate(center.x - nail.x, center.y - nail.y)
  ctx.rotate(pose.turn)
  ctx.scale(scale, scale)
  ctx.translate(-center.x, -center.y)
}

/** Un punto de la pantalla llevado al espacio del cuadro en reposo: la inversa de lo de arriba. */
export function toObject(
  p: { x: number; y: number },
  pose: Pose,
  rects: SceneRects,
  pxPerCm: number,
): { x: number; y: number } {
  if (isRest(pose)) return p
  const { center } = rects
  const nail = nailOf(rects)
  const scale = 1 + pose.lift / VIEW_CM

  let x = p.x
  let y = p.y - pose.drop * pxPerCm
  x -= nail.x
  y -= nail.y
  ;[x, y] = rotate(x, y, -pose.roll)
  x -= center.x - nail.x
  y -= center.y - nail.y
  ;[x, y] = rotate(x, y, -pose.turn)
  return { x: x / scale + center.x, y: y / scale + center.y }
}

function rotate(x: number, y: number, a: number): [number, number] {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [x * c - y * s, x * s + y * c]
}

/**
 * La luz vista desde el cuadro. Si el cuadro giró, la fuente quedó en otro ángulo
 * respecto de sus listones: el de arriba puede dejar de ser el más iluminado.
 */
export function objectLight(light: Light, pose: Pose): Light {
  const a = pose.roll + pose.turn
  if (a === 0) return light
  const [x, y] = rotate(light.x, light.y, -a)
  return { x, y, z: light.z }
}
