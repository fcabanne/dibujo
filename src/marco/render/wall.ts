import type { Rect, WallState } from '../types'
import { luminance, rgba, scaleHex, shadowTint, type Light } from './light'
import { blotchField } from './noise'
import { wallStructure } from './textures'

/**
 * Pared bajo foco de galería.
 *
 * Antes era un color casi parejo con un degradé suave, y por eso todo se veía chato:
 * sin un pozo de luz marcado alrededor del cuadro y penumbra en los bordes, la escena
 * no tiene rango dinámico y la obra no se despega del fondo.
 */
export function drawWall(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  wall: WallState,
  light: Light,
  focus: Rect,
  pxPerCm: number,
) {
  ctx.fillStyle = wall.color
  ctx.fillRect(0, 0, w, h)

  // Variación de baja frecuencia, generada al tamaño del lienzo: es lo que rompe la
  // uniformidad sin dejar el período visible que tenía el tile anterior.
  ctx.save()
  ctx.globalCompositeOperation = 'soft-light'
  ctx.globalAlpha = 0.55
  ctx.drawImage(blotchField(w, h, 7), 0, 0, w, h)
  ctx.restore()

  // Anclada al cuadro y a su escala: la textura es de la pared en la que cuelga, no
  // de la pantalla, así que acompaña al cuadro cuando se lo acerca o se lo corre.
  const structure = wallStructure(ctx, wall.pattern, pxPerCm, { x: focus.x, y: focus.y })
  if (structure) {
    ctx.save()
    ctx.globalCompositeOperation = 'soft-light'
    ctx.globalAlpha = 0.8
    ctx.fillStyle = structure
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  drawSpotlight(ctx, w, h, light, focus, wall.color)
}

/**
 * El pozo de luz. Es un óvalo centrado apenas por encima del cuadro y desplazado
 * hacia la fuente, y por fuera la pared cae a penumbra. Se dibuja en dos pasadas:
 * primero se oscurece todo, después se levanta el centro.
 */
function drawSpotlight(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  light: Light,
  focus: Rect,
  color: string,
) {
  const { cx, cy, reach } = spotOf(focus, light)

  // Penumbra: todo lo que está lejos del foco se apaga, y lo que se apaga conserva
  // su color, como la sombra del cuadro: lejos del foco la pared es la misma pared con
  // menos luz, no una pared más gris. Es una sola pasada que multiplica —oscurece y
  // satura a la vez— con la misma caída que tenía el negro de antes.
  const tint = shadowTint(color)
  const deep = scaleHex(tint, PENUMBRA)
  const keep = 1 - luminance(deep)
  const falloff = ctx.createRadialGradient(cx, cy, reach * 0.3, cx, cy, reach * 1.5)
  falloff.addColorStop(0, rgba(deep, 0))
  falloff.addColorStop(0.55, rgba(deep, Math.min(1, 0.42 / keep)))
  falloff.addColorStop(1, rgba(deep, Math.min(1, 0.86 / keep)))
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = falloff
  ctx.fillRect(0, 0, w, h)
  ctx.restore()

  // Pozo cálido sobre el cuadro.
  const pool = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach * 0.92)
  pool.addColorStop(0, 'rgba(255, 244, 224, 0.3)')
  pool.addColorStop(0.4, 'rgba(255, 240, 218, 0.14)')
  pool.addColorStop(1, 'rgba(255, 236, 210, 0)')
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = pool
  ctx.fillRect(0, 0, w, h)
  ctx.restore()

  // Rebote del piso: muy tenue, evita que la parte baja quede muerta.
  const bounce = ctx.createLinearGradient(0, h * 0.72, 0, h)
  bounce.addColorStop(0, 'rgba(0, 0, 0, 0)')
  bounce.addColorStop(1, 'rgba(0, 0, 0, 0.34)')
  ctx.fillStyle = bounce
  ctx.fillRect(0, h * 0.72, w, h * 0.28)
}

/** Cuánta luz queda en el rincón más oscuro de la pared, respecto del centro del foco. */
const PENUMBRA = 0.17

/**
 * Dónde cae el foco: apenas por encima del medio del cuadro y corrido hacia la
 * fuente. Lo usan la pared, el cuadro y la cartela, así que la cuenta vive en un
 * solo lugar — si cada uno la hiciera por su lado, el pozo de luz de la pared y el
 * del cuadro terminarían en dos lugares distintos.
 */
function spotOf(focus: Rect, light: Light) {
  return {
    cx: focus.x + focus.w / 2 + light.x * focus.w * 0.16,
    cy: focus.y + focus.h * 0.42 + light.y * focus.h * 0.12,
    reach: Math.max(focus.w, focus.h) * 1.5,
  }
}

/**
 * El mismo foco, ahora sobre el cuadro.
 *
 * La pared ya caía a penumbra lejos del pozo de luz, pero el cuadro se pintaba
 * parejo encima, iluminado igual en la esquina de abajo que arriba, y por eso se
 * leía pegado sobre la pared en vez de colgado bajo la misma luz. Esta capa le
 * aplica la misma caída, mucho más suave: unos pocos puntos en los bordes lejanos,
 * que es lo que muestra una foto de un cuadro colgado y no alcanza para cambiar
 * cómo se ven los colores de la obra.
 */
export function drawObjectFalloff(
  ctx: CanvasRenderingContext2D,
  outer: Rect,
  light: Light,
  /** Qué pintar: el cuadro, o más si quien llama ya recortó al cuadro girado. */
  fill: Rect = outer,
) {
  const { cx, cy, reach } = spotOf(outer, light)
  const g = ctx.createRadialGradient(cx, cy, reach * 0.1, cx, cy, reach * 0.62)
  g.addColorStop(0, 'rgba(10, 8, 6, 0)')
  g.addColorStop(0.55, 'rgba(10, 8, 6, 0.035)')
  g.addColorStop(1, 'rgba(10, 8, 6, 0.12)')
  ctx.save()
  ctx.fillStyle = g
  ctx.fillRect(fill.x, fill.y, fill.w, fill.h)
  ctx.restore()
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * Brillo aproximado de la pared en un punto, 0..1.
 *
 * Antes esto se leía con `getImageData` sobre el lienzo. Chrome avisa que los
 * readbacks repetidos sacan al canvas de la aceleración por GPU, y ese castigo no
 * se revierte: la escena queda lenta para siempre. Reproducir el perfil del foco a
 * mano cuesta unas cuentas y evita tocar los píxeles.
 */
export function wallLumaAt(
  px: number,
  py: number,
  focus: Rect,
  light: Light,
  baseLuma: number,
): number {
  const { cx, cy, reach } = spotOf(focus, light)
  const d = Math.hypot(px - cx, py - cy)

  // Penumbra, con las mismas paradas que el gradiente de drawSpotlight.
  const t = clamp01((d - reach * 0.3) / (reach * 1.2))
  const dark = t < 0.55 ? (t / 0.55) * 0.42 : 0.42 + ((t - 0.55) / 0.45) * 0.44

  // Pozo cálido sobre el cuadro.
  const p = clamp01(d / (reach * 0.92))
  const pool = p < 0.4 ? 0.3 - (p / 0.4) * 0.16 : (1 - (p - 0.4) / 0.6) * 0.14

  return clamp01(baseLuma * (1 - dark) + Math.max(0, pool))
}
