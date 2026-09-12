import type { Rect, WallState } from '../types'
import type { Light } from './light'
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

  const structure = wallStructure(ctx, wall.pattern)
  if (structure) {
    ctx.save()
    ctx.globalCompositeOperation = 'soft-light'
    ctx.globalAlpha = 0.7
    ctx.fillStyle = structure
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  drawSpotlight(ctx, w, h, light, focus)
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
) {
  const cx = focus.x + focus.w / 2 + light.x * focus.w * 0.16
  const cy = focus.y + focus.h * 0.42 + light.y * focus.h * 0.12
  const reach = Math.max(focus.w, focus.h) * 1.5

  // Penumbra: todo lo que está lejos del foco se apaga.
  const falloff = ctx.createRadialGradient(cx, cy, reach * 0.3, cx, cy, reach * 1.5)
  falloff.addColorStop(0, 'rgba(0, 0, 0, 0)')
  falloff.addColorStop(0.55, 'rgba(0, 0, 0, 0.42)')
  falloff.addColorStop(1, 'rgba(6, 6, 10, 0.86)')
  ctx.fillStyle = falloff
  ctx.fillRect(0, 0, w, h)

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
  const cx = focus.x + focus.w / 2 + light.x * focus.w * 0.16
  const cy = focus.y + focus.h * 0.42 + light.y * focus.h * 0.12
  const reach = Math.max(focus.w, focus.h) * 1.5
  const d = Math.hypot(px - cx, py - cy)

  // Penumbra, con las mismas paradas que el gradiente de drawSpotlight.
  const t = clamp01((d - reach * 0.3) / (reach * 1.2))
  const dark = t < 0.55 ? (t / 0.55) * 0.42 : 0.42 + ((t - 0.55) / 0.45) * 0.44

  // Pozo cálido sobre el cuadro.
  const p = clamp01(d / (reach * 0.92))
  const pool = p < 0.4 ? 0.3 - (p / 0.4) * 0.16 : (1 - (p - 0.4) / 0.6) * 0.14

  return clamp01(baseLuma * (1 - dark) + Math.max(0, pool))
}
