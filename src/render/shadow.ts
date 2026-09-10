import type { Rect } from '../types'
import type { Light } from './light'

/**
 * Sombra proyectada sobre la pared, en tres capas: oclusión al ras del canto,
 * sombra de contacto y sombra ambiental larga.
 *
 * Las tres van desenfocadas, y con un marco de caja el radio de blur pasa de los
 * 100 px. Recalcular tres desenfoques de ese tamaño en cada frame hundía el
 * framerate apenas ensanchabas la moldura, y como el radio depende del espesor la
 * escena nunca se recuperaba. Ahora el conjunto se hornea una vez en un sprite y
 * después solo se pega.
 */

const MAX_BLUR = 64
/** Los tamaños se redondean para que arrastrar no genere un sprite por frame. */
const BUCKET = 12
const CACHE_LIMIT = 24

const cache = new Map<string, HTMLCanvasElement>()

function bake(w: number, h: number, depthPx: number, dx: number, dy: number): HTMLCanvasElement {
  const ambient = Math.min(MAX_BLUR, 9 + depthPx * 2.1)
  const pad = Math.ceil(ambient * 3 + depthPx * 2 + 8)

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(w + pad * 2)
  canvas.height = Math.ceil(h + pad * 2)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const put = (blur: number, alpha: number, fill: string, spread: number) => {
    ctx.globalAlpha = alpha
    ctx.filter = 'blur(' + blur.toFixed(1) + 'px)'
    ctx.fillStyle = fill
    ctx.fillRect(pad + dx * depthPx * spread, pad + dy * depthPx * spread, w, h)
  }

  put(ambient, 0.5, 'rgba(0, 0, 0, 0.72)', 1.7)
  put(Math.min(MAX_BLUR, 2.4 + depthPx * 0.5), 0.6, 'rgba(0, 0, 0, 0.8)', 0.5)
  // Oclusión: la línea oscura donde el marco toca la pared.
  put(Math.max(1, depthPx * 0.16), 0.62, 'rgba(0, 0, 0, 0.7)', 0.04)

  return canvas
}

export function drawCastShadow(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  depthCm: number,
  pxPerCm: number,
  light: Light,
) {
  const depthPx = Math.max(0.2, depthCm) * pxPerCm
  const dx = -light.x
  const dy = -light.y

  const w = Math.round(rect.w / BUCKET) * BUCKET
  const h = Math.round(rect.h / BUCKET) * BUCKET
  const d = Math.round(depthPx / 2) * 2
  const key = `${w}x${h}|${d}`

  let sprite = cache.get(key)
  if (!sprite) {
    sprite = bake(w, h, d, dx, dy)
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string)
    cache.set(key, sprite)
  }

  // Centrado en el cuadro: el sprite está horneado a la medida redondeada, y esa
  // diferencia de unos píxeles es invisible en una sombra desenfocada.
  ctx.drawImage(
    sprite,
    rect.x + rect.w / 2 - sprite.width / 2,
    rect.y + rect.h / 2 - sprite.height / 2,
  )
}
