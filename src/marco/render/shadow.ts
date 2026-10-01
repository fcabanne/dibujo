import type { Rect } from '../types'
import { fillBlurredPath } from './blur'
import { REST_LIGHT, shadowTint, spotPosition } from './light'

/**
 * Sombra proyectada sobre la pared, en tres capas: oclusión al ras del canto,
 * sombra de contacto y sombra ambiental larga.
 *
 * Las tres van desenfocadas, y con un marco de caja el radio de blur pasa de los
 * 100 px. Recalcular tres desenfoques de ese tamaño en cada frame hundía el
 * framerate apenas ensanchabas la moldura, y como el radio depende del espesor la
 * escena nunca se recuperaba. Ahora el conjunto se hornea una vez en un sprite y
 * después solo se pega.
 *
 * **Es una cuña, no un rectángulo corrido.** Un cuadro colgado de un alambre se
 * inclina: arriba se despega de la pared un centímetro o dos y abajo apoya. La sombra
 * es ancha arriba y se afina hasta casi tocar el canto de abajo, donde además es más
 * nítida —la penumbra se abre con la distancia a la pared—. Y la luz es un foco, no
 * el sol: cada esquina tira su sombra alejándose de él, así que la sombra sale un
 * poco más grande que el cuadro y más larga del lado que queda más lejos del foco.
 * Se hornea con la luz de la escena (`REST_LIGHT`), que está quieta: el puntero mueve
 * el ojo y no el foco, así que la forma de la sombra no cambia; lo que cambia es
 * dónde se la ve, porque está sobre la pared (ver `wallShift`).
 */

type Pt = { x: number; y: number }

const MAX_BLUR = 64
/** Los tamaños se redondean para que arrastrar no genere un sprite por frame. */
const BUCKET = 12
const CACHE_LIMIT = 24

/** Cuánto oscurece la sombra en sí, y cuánto color le devuelve la pared. */
const DARK = 0.86
const CHROMA = 0.9

interface Baked {
  /** La sombra en negro: su forma y su densidad. */
  mask: HTMLCanvasElement
  /** Dónde va la esquina del sprite, respecto del centro del cuadro. */
  ox: number
  oy: number
  /** La misma forma teñida del color de la pared, por color. */
  tints: Map<string, HTMLCanvasElement>
}

const cache = new Map<string, Baked>()

/**
 * Cuánto se despega de la pared el canto de arriba, en cm. Un cuadro chico cuelga
 * casi derecho; uno grande, con el alambre más largo, se inclina más.
 */
export function standoff(heightCm: number): number {
  return Math.min(2, Math.max(0.6, heightCm * 0.03))
}

interface Layer {
  /** Cuánto se corre respecto de la sombra "física". */
  spread: number
  blur: (z: number) => number
  alpha: number
}

/** De la más larga a la más corta. Los números son los de siempre: la forma es lo nuevo. */
const LAYERS: Layer[] = [
  { spread: 1.7, blur: (z) => Math.min(MAX_BLUR, 9 + z * 2.1), alpha: 0.36 },
  { spread: 0.5, blur: (z) => Math.min(MAX_BLUR, 2.4 + z * 0.5), alpha: 0.48 },
  // Oclusión: la línea oscura donde el marco toca la pared.
  { spread: 0.04, blur: (z) => Math.max(1, z * 0.16), alpha: 0.43 },
]

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
  return c
}

/**
 * Hornea la sombra de un cuadro de `w`×`h` px con el canto de abajo a `d` px de la
 * pared y el de arriba a `d + t`. Todo en píxeles, con el cuadro centrado en el origen.
 */
function bake(w: number, h: number, d: number, t: number, pxPerCm: number): Baked {
  const P = spotPosition(REST_LIGHT, w, h, pxPerCm)
  const { reach } = P

  const corners: (Pt & { z: number })[] = [
    { x: -w / 2, y: -h / 2, z: d + t },
    { x: w / 2, y: -h / 2, z: d + t },
    { x: w / 2, y: h / 2, z: d },
    { x: -w / 2, y: h / 2, z: d },
  ]

  // Proyección desde el foco, escalada para que en el centro del cuadro cada capa se
  // corra lo mismo que antes: la cuña y el agrandado son lo nuevo, no el largo.
  const quad = (spread: number): Pt[] => {
    const k = (spread * (P.z - d)) / reach
    return corners.map((c) => {
      const s = (k * c.z) / Math.max(1, P.z - c.z)
      return { x: c.x + (c.x - P.x) * s, y: c.y + (c.y - P.y) * s }
    })
  }

  const shapes = LAYERS.map((layer) => ({ layer, pts: quad(layer.spread) }))
  const pad = MAX_BLUR * 3 + 4
  const xs = shapes.flatMap((s) => s.pts.map((p) => p.x))
  const ys = shapes.flatMap((s) => s.pts.map((p) => p.y))
  const ox = Math.floor(Math.min(...xs, -w / 2) - pad)
  const oy = Math.floor(Math.min(...ys, -h / 2) - pad)
  const mask = canvas(Math.max(...xs, w / 2) + pad - ox, Math.max(...ys, h / 2) + pad - oy)
  const ctx = mask.getContext('2d')
  if (!ctx) return { mask, ox, oy, tints: new Map() }

  // Cada capa se hornea dos veces —con el desenfoque del canto de abajo y con el del
  // de arriba— y se funden de abajo hacia arriba: nítida donde apoya, abierta donde
  // se despega. Arriba la oclusión además se aclara: ese canto no toca la pared.
  const low = canvas(mask.width, mask.height)
  const high = canvas(mask.width, mask.height)
  const top = -h / 2 - oy
  const bottom = h / 2 - oy

  for (const { layer, pts } of shapes) {
    const local = pts.map((p) => ({ x: p.x - ox, y: p.y - oy }))
    const near = layer.alpha
    const far = layer.spread < 0.1 ? layer.alpha * (d / (d + t)) : layer.alpha

    paintHalf(low, local, layer.blur(d), near, top, bottom, false)
    paintHalf(high, local, layer.blur(d + t), far, top, bottom, true)

    // Las dos mitades se suman: son complementarias, y sumadas dan la mezcla.
    const lctx = low.getContext('2d')
    if (!lctx) continue
    lctx.globalCompositeOperation = 'lighter'
    lctx.drawImage(high, 0, 0)
    lctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(low, 0, 0)
  }

  return { mask, ox, oy, tints: new Map() }
}

/** Una capa desenfocada, desvanecida hacia arriba (`fromTop` = false) o hacia abajo. */
function paintHalf(
  target: HTMLCanvasElement,
  pts: Pt[],
  blur: number,
  alpha: number,
  top: number,
  bottom: number,
  fromTop: boolean,
) {
  const c = target.getContext('2d')
  if (!c) return
  c.clearRect(0, 0, target.width, target.height)
  fillBlurredPath(c, pts, blur, 'rgba(0, 0, 0, ' + alpha.toFixed(3) + ')')
  const fade = c.createLinearGradient(0, top, 0, bottom)
  fade.addColorStop(0, fromTop ? '#000' : 'rgba(0, 0, 0, 0)')
  fade.addColorStop(1, fromTop ? 'rgba(0, 0, 0, 0)' : '#000')
  c.globalCompositeOperation = 'destination-in'
  c.fillStyle = fade
  c.fillRect(0, 0, target.width, target.height)
  c.globalCompositeOperation = 'source-over'
}

/** La forma de la sombra pintada del color que le devuelve la pared. */
function tinted(baked: Baked, color: string): HTMLCanvasElement {
  let tint = baked.tints.get(color)
  if (tint) return tint
  tint = canvas(baked.mask.width, baked.mask.height)
  const c = tint.getContext('2d')
  if (c) {
    c.drawImage(baked.mask, 0, 0)
    c.globalCompositeOperation = 'source-in'
    c.fillStyle = color
    c.fillRect(0, 0, tint.width, tint.height)
  }
  // Una pared a la vez: el color cambia de a uno y no vuelve seguido.
  baked.tints.clear()
  baked.tints.set(color, tint)
  return tint
}

export function drawCastShadow(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  depthCm: number,
  pxPerCm: number,
  wallColor: string,
) {
  const d = Math.round((Math.max(0.2, depthCm) * pxPerCm) / 2) * 2
  const t = Math.round((standoff(rect.h / pxPerCm) * pxPerCm) / 2) * 2
  const w = Math.round(rect.w / BUCKET) * BUCKET
  const h = Math.round(rect.h / BUCKET) * BUCKET
  const k = Math.round(pxPerCm * 4) / 4
  const key = `${w}x${h}|${d}|${t}|${k}`

  let baked = cache.get(key)
  if (!baked) {
    baked = bake(w, h, d, t, k)
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string)
    cache.set(key, baked)
  }

  // Anclado al centro del cuadro: el sprite está horneado a la medida redondeada, y
  // esa diferencia de unos píxeles es invisible en una sombra desenfocada.
  const x = rect.x + rect.w / 2 + baked.ox
  const y = rect.y + rect.h / 2 + baked.oy

  ctx.save()
  ctx.globalAlpha = DARK
  ctx.drawImage(baked.mask, x, y)
  ctx.globalAlpha = CHROMA
  ctx.globalCompositeOperation = 'multiply'
  ctx.drawImage(tinted(baked, shadowTint(wallColor)), x, y)
  ctx.restore()
}
