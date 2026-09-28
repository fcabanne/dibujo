import type { Rect } from '../types'
import { hexToRgb, luminance, rgbToHex } from './light'
import { stripNoise } from './noise'

/**
 * La madera de la moldura.
 *
 * Antes la veta eran líneas onduladas, y era lo más flojo del render: se leía como
 * un dibujo de madera. Esto la arma como es: una tabla aserrada de un tronco, con los
 * anillos de crecimiento cortados por la cara. Donde la cara pasa cerca de la médula
 * los anillos salen como líneas paralelas; donde se aleja, se abren en las
 * "catedrales" que tiene cualquier tabla. Encima van los poros del roble, las rayas
 * finas del nogal y la variación lenta de tono de una pieza a lo largo.
 *
 * Se hornea una vez por madera, en centímetros —como las paredes—, y se pinta a la
 * escala del cuadro anclada a cada listón: acercarse la agranda, y cada pieza muestra
 * otro pedazo de la tabla.
 */

/** Píxeles por centímetro de la baldosa, y cuánta tabla entra: 64 cm de largo, 12 de ancho. */
const PPC = 20
const LENGTH_CM = 64
const WIDTH_CM = 12
const TILE_W = PPC * LENGTH_CM
const TILE_H = PPC * WIDTH_CM

interface Figure {
  /** Separación entre anillos, en cm. */
  spacing: number
  /** Cuánto oscurece la madera tardía de cada anillo. */
  rings: number
  /** Poros abiertos: el roble los tiene, el pino no. */
  pores: number
  /** Rayas finas a lo largo: el nogal casi no muestra anillos y sí esto. */
  streaks: number
  /** A qué profundidad corre la médula debajo de la cara, en cm: más honda, catedrales más anchas. */
  depth: number
  seed: number
}

type Species = 'pine' | 'oak' | 'walnut'

const FIGURES: Record<Species, Figure> = {
  pine: { spacing: 0.42, rings: 0.4, pores: 0, streaks: 0.05, depth: 2.4, seed: 3 },
  oak: { spacing: 0.3, rings: 0.3, pores: 0.26, streaks: 0.07, depth: 1.6, seed: 7 },
  walnut: { spacing: 0.24, rings: 0.18, pores: 0.18, streaks: 0.16, depth: 1.1, seed: 13 },
}

/**
 * Qué madera sugiere el color. El color de la moldura se elige aparte del material,
 * así que la especie se deduce: los claros tienen los anillos marcados del pino, los
 * medios los poros del roble, y en los oscuros —nogal, caoba— los anillos casi no se
 * ven y manda la raya fina.
 */
function speciesOf(color: string): Species {
  const l = luminance(color)
  if (l > 0.55) return 'pine'
  if (l > 0.33) return 'oak'
  return 'walnut'
}

/** Cuánto más oscura es la madera tardía por canal: también es más roja. */
const WARM = [0.84, 1, 1.2]

interface WoodTile {
  canvas: HTMLCanvasElement
  /** Cuánto deja pasar la baldosa en promedio, por canal: para no oscurecer el color elegido. */
  mean: [number, number, number]
  pattern: CanvasPattern | null
}

const tiles = new Map<Species, WoodTile>()

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function bake(f: Figure): WoodTile {
  const canvas = document.createElement('canvas')
  canvas.width = TILE_W
  canvas.height = TILE_H
  const ctx = canvas.getContext('2d')
  const mean: [number, number, number] = [1, 1, 1]
  if (!ctx) return { canvas, mean, pattern: null }

  const img = ctx.createImageData(TILE_W, TILE_H)
  const data = img.data
  const s = f.seed

  // Lo que cambia solo a lo largo: a qué profundidad y de qué lado corre la médula,
  // y el tono de la pieza. Las frecuencias dan vueltas enteras en los 64 cm, para que
  // la baldosa empalme con la siguiente.
  const depthAt = new Float32Array(TILE_W)
  const pithAt = new Float32Array(TILE_W)
  const toneAt = new Float32Array(TILE_W)
  for (let x = 0; x < TILE_W; x++) {
    const u = x / PPC
    const wander = 0.65 * stripNoise(u / 16, 0.5, 4, s) + 0.35 * stripNoise(u / 8, 1.5, 8, s)
    depthAt[x] = f.depth * (0.15 + 1.7 * wander)
    pithAt[x] = WIDTH_CM * 0.5 + 2.4 * (stripNoise(u / 8, 2.5, 8, s + 1) - 0.5)
    toneAt[x] = stripNoise(u / 16, 7.5, 4, s + 2) - 0.5
  }

  // Un píxel, medido en vueltas de anillo: el corte entre anillos se suaviza eso.
  const edge = Math.min(0.2, 1 / PPC / f.spacing)
  const sums = [0, 0, 0]
  let i = 0
  for (let y = 0; y < TILE_H; y++) {
    const v = y / PPC
    for (let x = 0; x < TILE_W; x++, i += 4) {
      const u = x / PPC

      // Los anillos: la distancia a la médula, torcida por un ruido suave —ningún
      // tronco es un cilindro— y con anillos de ancho desparejo, como los años.
      const warp =
        0.55 * (stripNoise(u / 8, v / 2.4, 8, s + 3) - 0.5) +
        0.05 * (stripNoise(u / 2, v * 1.5, 32, s + 4) - 0.5)
      const dv = v - pithAt[x] + warp
      const r = Math.sqrt(dv * dv + depthAt[x] * depthAt[x])
      const ring = r / f.spacing + 0.9 * stripNoise(0.5, r * 0.6, 1, s + 5)
      const t = ring - Math.floor(ring)

      // Madera tardía: se oscurece a lo largo del anillo y corta de golpe donde
      // empieza el siguiente.
      const late = smoothstep(0.42, 0.92, t) * (1 - smoothstep(1 - edge, 1, t))

      // Poros: rayitas de dos milímetros, sobre todo en la madera temprana.
      let pore = 0
      if (f.pores > 0) {
        const p = stripNoise(u * 4, v * 22, LENGTH_CM * 4, s + 6)
        pore = Math.max(0, p - 0.7) / 0.3
        pore *= 0.35 + 0.65 * (1 - smoothstep(0.2, 0.5, t))
      }

      // Rayas finas y largas, más claras o más oscuras.
      const streak = stripNoise(u / 4, v * 7, LENGTH_CM / 4, s + 7) - 0.5

      const dark =
        f.rings * late * (0.8 + streak * 0.6) +
        f.pores * pore +
        f.streaks * streak * 2 +
        0.1 * toneAt[x] +
        0.04

      for (let c = 0; c < 3; c++) {
        const m = Math.min(1, Math.max(0.2, 1 - dark * WARM[c]))
        data[i + c] = m * 255
        sums[c] += m
      }
      data[i + 3] = 255
    }
  }

  ctx.putImageData(img, 0, 0)
  const n = TILE_W * TILE_H
  return {
    canvas,
    mean: [sums[0] / n, sums[1] / n, sums[2] / n],
    pattern: ctx.createPattern(canvas, 'repeat'),
  }
}

function tileFor(species: Species): WoodTile {
  let tile = tiles.get(species)
  if (!tile) {
    tile = bake(FIGURES[species])
    tiles.set(species, tile)
  }
  return tile
}

const frac = (n: number) => n - Math.floor(n)

/**
 * Pinta la madera sobre un listón ya recortado. `alongX` dice si la pieza corre en
 * horizontal —la veta va a lo largo de la pieza— y `seed` qué pedazo de la tabla le
 * toca. `contrast` es cuánto se ve la veta: todo en "veteado", menos en "lisa".
 *
 * Devuelve `false` si el navegador no puede escalar ni girar un patrón: ahí queda la
 * veta dibujada de antes.
 */
export function drawWood(
  ctx: CanvasRenderingContext2D,
  bounds: Rect,
  alongX: boolean,
  color: string,
  contrast: number,
  seed: number,
  pxPerCm: number,
): boolean {
  if (typeof DOMMatrix === 'undefined') return false
  const tile = tileFor(speciesOf(color))
  // En una madera muy clara —cruda, blanqueada— la misma veta se leería como madera
  // gastada: en esas el anillo apenas se asoma.
  contrast *= 1 - 0.5 * smoothstep(0.6, 0.9, luminance(color))
  const pattern = tile.pattern
  if (!pattern || typeof pattern.setTransform !== 'function') return false

  const k = pxPerCm / PPC
  const u0 = frac(seed * 0.618) * TILE_W
  const v0 = frac(seed * 0.377) * TILE_H * 0.5
  pattern.setTransform(
    alongX
      ? new DOMMatrix([k, 0, 0, k, bounds.x - u0 * k, bounds.y - v0 * k])
      : new DOMMatrix([0, k, k, 0, bounds.x - v0 * k, bounds.y - u0 * k]),
  )

  // La veta oscurece al multiplicar; el color de abajo se levanta lo mismo que la
  // veta baja en promedio, para que el nogal siga siendo el nogal de la muestra.
  const { r, g, b } = hexToRgb(color)
  const lift = (value: number, c: number) =>
    Math.min(255, value / (1 - contrast * (1 - tile.mean[c])))
  ctx.fillStyle = rgbToHex({ r: lift(r, 0), g: lift(g, 1), b: lift(b, 2) })
  ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h)

  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.globalAlpha = contrast
  ctx.fillStyle = pattern
  ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h)
  ctx.restore()
  return true
}
