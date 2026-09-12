import type { FrameFinish, FrameMaterial, Rect, WallPattern } from '../types'
import { grainTile, rand1 } from './noise'
import { shade } from './light'

const patternCache = new Map<string, CanvasPattern>()

function tile(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo crear el contexto de textura')
  return { canvas, ctx }
}

function cached(
  ctx: CanvasRenderingContext2D,
  key: string,
  build: () => HTMLCanvasElement,
): CanvasPattern | null {
  const hit = patternCache.get(key)
  if (hit) return hit
  const pattern = ctx.createPattern(build(), 'repeat')
  if (!pattern) return null
  patternCache.set(key, pattern)
  return pattern
}

/**
 * Grano fino por píxel. Acá tilear no molesta: el ruido blanco a un píxel no tiene
 * estructura, así que el ojo no puede engancharse con el período.
 */
export function grainPattern(
  ctx: CanvasRenderingContext2D,
  strength: number,
  seed: number,
): CanvasPattern | null {
  return cached(ctx, `grain|${strength}|${seed}`, () => grainTile(200, strength, seed))
}

/**
 * Estructura de la pared. Va con poco contraste a propósito: la variación grande la
 * pone el campo de manchas sin repetición de `noise.ts`, y esto es solo el acabado
 * de cerca. Antes iba fuerte y por eso el lino leía como damero.
 */
export function wallStructure(
  ctx: CanvasRenderingContext2D,
  pattern: WallPattern,
): CanvasPattern | null {
  if (pattern === 'plain') return null

  return cached(ctx, `wall|${pattern}`, () => {
    const size = 192
    const t = tile(size)
    t.ctx.fillStyle = '#808080'
    t.ctx.fillRect(0, 0, size, size)

    if (pattern === 'plaster') {
      t.ctx.drawImage(grainTile(size, 26, 17), 0, 0)
    }

    if (pattern === 'stucco') {
      // Salpicado con luz arriba y sombra abajo: lee como relieve, no como manchas.
      for (let i = 0; i < 620; i++) {
        const x = rand1(i, 91) * size
        const y = rand1(i + 1000, 97) * size
        const r = 0.8 + rand1(i + 2000, 101) * 2.4
        t.ctx.globalAlpha = 0.16
        t.ctx.fillStyle = '#ffffff'
        t.ctx.beginPath()
        t.ctx.arc(x, y - 0.6, r, 0, Math.PI * 2)
        t.ctx.fill()
        t.ctx.globalAlpha = 0.14
        t.ctx.fillStyle = '#000000'
        t.ctx.beginPath()
        t.ctx.arc(x, y + 0.8, r * 0.9, 0, Math.PI * 2)
        t.ctx.fill()
      }
      t.ctx.globalAlpha = 1
    }

    if (pattern === 'linen') {
      // Trama de 4 px: divide exacto en 192, así que no hay costura entre tiles.
      const weave = 4
      for (let y = 0; y < size; y += weave) {
        for (let x = 0; x < size; x += weave) {
          const over = (x / weave + y / weave) % 2 === 0
          t.ctx.fillStyle = over ? '#8a8a8a' : '#767676'
          t.ctx.fillRect(x, y, weave, weave)
        }
      }
      t.ctx.globalAlpha = 0.5
      t.ctx.drawImage(grainTile(size, 30, 23), 0, 0)
      t.ctx.globalAlpha = 1
    }

    return t.canvas
  })
}

/** Grano del cartón del passe-partout: muy tenue, se nota solo de cerca. */
export function matPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  return cached(ctx, 'mat-grain', () => grainTile(200, 16, 29))
}

/**
 * Material de la moldura sobre la región ya recortada al lado que se está pintando.
 *
 * El detalle direccional se dibuja **a lo largo de la pieza real**, no como tile: es
 * como corre la veta en una moldura de verdad, y de paso elimina la repetición que se
 * veía cada 256 px en los lados largos.
 */
export function drawMaterial(
  ctx: CanvasRenderingContext2D,
  bounds: Rect,
  alongX: boolean,
  color: string,
  material: FrameMaterial,
  finish: FrameFinish,
  seed: number,
) {
  ctx.fillStyle = color
  ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h)

  if (material === 'wood') {
    drawWoodGrain(ctx, bounds, alongX, color, finish === 'grained' ? 1 : 0.45, seed)
  } else if (material === 'metal' && finish !== 'gloss') {
    drawBrushed(ctx, bounds, alongX, seed)
  }

  const grain = grainPattern(ctx, material === 'metal' ? 12 : 20, 5)
  if (grain) {
    ctx.save()
    ctx.globalCompositeOperation = 'soft-light'
    ctx.globalAlpha = finish === 'gloss' ? 0.3 : 0.6
    ctx.fillStyle = grain
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h)
    ctx.restore()
  }
}

/** Vetas: líneas paralelas al eje de la pieza, con desvío y grosor variables. */
function drawWoodGrain(
  ctx: CanvasRenderingContext2D,
  bounds: Rect,
  alongX: boolean,
  color: string,
  contrast: number,
  seed: number,
) {
  const dark = shade(color, -0.42)
  const light = shade(color, 0.22)
  // Una veta cada ~3 px de ancho de banda, independiente del largo de la pieza.
  const across = alongX ? bounds.h : bounds.w
  const along = alongX ? bounds.w : bounds.h
  const lines = Math.max(10, Math.round(across / 3))

  ctx.save()
  for (let i = 0; i < lines; i++) {
    const base = (i / lines) * across + (rand1(i, seed) - 0.5) * 3
    const amp = 1 + rand1(i + 300, seed) * 5
    const freq = (0.4 + rand1(i + 600, seed) * 1.4) / along
    const phase = rand1(i + 900, seed) * Math.PI * 2
    const thin = rand1(i + 1200, seed) > 0.68

    ctx.beginPath()
    for (let d = 0; d <= along; d += 6) {
      const off = base + Math.sin(d * freq * Math.PI * 2 + phase) * amp
      const x = alongX ? bounds.x + d : bounds.x + off
      const y = alongX ? bounds.y + off : bounds.y + d
      if (d === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = thin ? light : dark
    ctx.globalAlpha = (thin ? 0.14 : 0.22) * contrast
    ctx.lineWidth = thin ? 0.8 : 1 + rand1(i + 1500, seed) * 2
    ctx.stroke()
  }
  ctx.restore()
}

/** Cepillado del metal: rayas finas en el eje de la pieza. */
function drawBrushed(
  ctx: CanvasRenderingContext2D,
  bounds: Rect,
  alongX: boolean,
  seed: number,
) {
  const across = alongX ? bounds.h : bounds.w
  const lines = Math.round(across / 1.5)

  ctx.save()
  ctx.globalAlpha = 0.055
  ctx.lineWidth = 0.7
  for (let i = 0; i < lines; i++) {
    const off = (i / lines) * across
    ctx.strokeStyle = rand1(i, seed) > 0.5 ? '#ffffff' : '#000000'
    ctx.beginPath()
    if (alongX) {
      ctx.moveTo(bounds.x, bounds.y + off)
      ctx.lineTo(bounds.x + bounds.w, bounds.y + off)
    } else {
      ctx.moveTo(bounds.x + off, bounds.y)
      ctx.lineTo(bounds.x + off, bounds.y + bounds.h)
    }
    ctx.stroke()
  }
  ctx.restore()
}
