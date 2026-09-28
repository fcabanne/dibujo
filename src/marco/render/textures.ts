import type { FrameFinish, FrameMaterial, Rect, WallPattern } from '../types'
import { grainTile, rand1, tileableFbm } from './noise'
import { shade } from './light'
import { drawWood } from './wood'

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
 * A qué escala se dibujan las baldosas de la pared: píxeles por centímetro, y cuántos
 * centímetros de pared entran en una. Las texturas se piensan en centímetros —una
 * gota de gotelé mide medio centímetro, un hilo de lino un milímetro y medio— y se
 * llevan a la escala del cuadro al pintarlas.
 */
const WALL_PPC = 24
const WALL_CM = 16
const WALL_TILE = WALL_PPC * WALL_CM

/**
 * Estructura de la pared, en escala real.
 *
 * Antes se dibujaba en píxeles de pantalla —un grano de un píxel, gotitas de dos— y
 * no importaba el tamaño del cuadro: en un celular las cuatro paredes se veían
 * iguales, y al acercar la vista la textura no crecía. Ahora cada una está medida en
 * centímetros y se pinta a la escala del cuadro (`pxPerCm`), anclada a él
 * (`origin`): se ve lo que se vería frente a esa pared, y acercarse la agranda.
 *
 * La variación grande de toda pared sigue siendo el campo de manchas sin repetición
 * de `noise.ts`; esto es el acabado propio de cada una.
 */
export function wallStructure(
  ctx: CanvasRenderingContext2D,
  pattern: WallPattern,
  pxPerCm: number,
  origin: { x: number; y: number },
): CanvasPattern | null {
  if (pattern === 'plain') return null
  const structure = cached(ctx, `wall|${pattern}`, () => buildWallTile(pattern))
  if (!structure) return null
  const k = pxPerCm / WALL_PPC
  if (typeof DOMMatrix !== 'undefined' && structure.setTransform) {
    structure.setTransform(new DOMMatrix([k, 0, 0, k, origin.x, origin.y]))
  }
  return structure
}

/** Pinta `draw` en (x, y) y en las copias del otro lado de cada borde que toque. */
function wrapped(x: number, y: number, reach: number, draw: (x: number, y: number) => void) {
  for (const dx of [-WALL_TILE, 0, WALL_TILE]) {
    for (const dy of [-WALL_TILE, 0, WALL_TILE]) {
      const cx = x + dx
      const cy = y + dy
      if (cx + reach < 0 || cy + reach < 0 || cx - reach > WALL_TILE || cy - reach > WALL_TILE) continue
      draw(cx, cy)
    }
  }
}

/** Una baldosa en gris: 128 no cambia la pared, más claro la levanta, más oscuro la hunde. */
function buildWallTile(pattern: Exclude<WallPattern, 'plain'>): HTMLCanvasElement {
  const t = tile(WALL_TILE)
  const c = t.ctx
  c.fillStyle = '#808080'
  c.fillRect(0, 0, WALL_TILE, WALL_TILE)

  if (pattern === 'plaster') drawPlaster(c)
  if (pattern === 'stucco') drawStucco(c)
  if (pattern === 'linen') drawLinen(c)

  return t.canvas
}

/**
 * Yeso: la pared alisada a llana. Manchas suaves de unos centímetros, donde la
 * llana dejó más o menos material, y los barridos en arco que deja la herramienta.
 */
function drawPlaster(c: CanvasRenderingContext2D) {
  // Las manchas, a media resolución: son de baja frecuencia y así se calculan rápido.
  const half = WALL_TILE / 2
  const small = tile(half)
  const img = small.ctx.createImageData(half, half)
  for (let y = 0; y < half; y++) {
    for (let x = 0; x < half; x++) {
      const n = tileableFbm((x / half) * 5, (y / half) * 5, 5, 17, 3)
      const v = Math.round(128 + (n - 0.5) * 92)
      const i = (y * half + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = 255
    }
  }
  small.ctx.putImageData(img, 0, 0)
  c.imageSmoothingQuality = 'high'
  c.drawImage(small.canvas, 0, 0, WALL_TILE, WALL_TILE)

  // Los barridos de la llana: arcos anchos, apenas más claros o más oscuros.
  c.lineCap = 'round'
  for (let i = 0; i < 16; i++) {
    const x = rand1(i, 211) * WALL_TILE
    const y = rand1(i + 50, 211) * WALL_TILE
    const r = (3 + rand1(i + 100, 211) * 5) * WALL_PPC
    const start = rand1(i + 150, 211) * Math.PI * 2
    const sweep = 0.5 + rand1(i + 200, 211) * 0.7
    c.lineWidth = (0.6 + rand1(i + 250, 211) * 1.2) * WALL_PPC
    c.strokeStyle = rand1(i + 300, 211) > 0.5 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.085)'
    wrapped(x, y, r + c.lineWidth, (cx, cy) => {
      c.beginPath()
      c.arc(cx, cy, r, start, start + sweep)
      c.stroke()
    })
  }

  c.globalAlpha = 0.5
  c.drawImage(grainTile(WALL_TILE, 22, 17), 0, 0)
  c.globalAlpha = 1
}

/**
 * Gotelé: gotas de pintura espesa salpicadas, de dos a seis milímetros. Cada una es un
 * relieve —luz arriba a la izquierda, sombra abajo a la derecha—, que es lo que las
 * distingue de manchas.
 */
function drawStucco(c: CanvasRenderingContext2D) {
  const count = 1100
  for (let i = 0; i < count; i++) {
    const x = rand1(i, 91) * WALL_TILE
    const y = rand1(i + 3000, 97) * WALL_TILE
    const size = rand1(i + 6000, 101)
    const r = (0.14 + size * size * 0.3) * WALL_PPC
    const squash = 0.7 + rand1(i + 9000, 103) * 0.3
    const turn = rand1(i + 12000, 107) * Math.PI

    wrapped(x, y, r * 1.6, (cx, cy) => {
      const blob = (ox: number, oy: number, scale: number, fill: string) => {
        c.fillStyle = fill
        c.beginPath()
        c.ellipse(cx + ox, cy + oy, r * scale, r * scale * squash, turn, 0, Math.PI * 2)
        c.fill()
      }
      blob(r * 0.22, r * 0.32, 1.02, 'rgba(0, 0, 0, 0.36)')
      blob(0, 0, 1, 'rgba(150, 150, 150, 0.55)')
      blob(-r * 0.2, -r * 0.26, 0.62, 'rgba(255, 255, 255, 0.4)')
    })
  }

  c.globalAlpha = 0.4
  c.drawImage(grainTile(WALL_TILE, 20, 43), 0, 0)
  c.globalAlpha = 1
}

/**
 * Lino: la tela de la pared entelada. El tejido en sí es demasiado fino para verse a
 * esta distancia; lo que lo delata son los hilos de trama, cada uno de un tono, y los
 * nudos —tramos más gruesos— que los cruzan de costado.
 */
function drawLinen(c: CanvasRenderingContext2D) {
  const pitch = 0.18 * WALL_PPC

  // La trama: hilos horizontales, cada uno con su tono y variando a lo largo.
  for (let row = 0; row * pitch < WALL_TILE; row++) {
    const y = row * pitch + pitch / 2
    const base = (rand1(row, 311) - 0.5) * 36
    const step = 6
    for (let x = 0; x < WALL_TILE; x += step) {
      const along = (tileableFbm((x / WALL_TILE) * 48, row * 0.37, 48, 313, 2) - 0.5) * 34
      const v = Math.round(128 + base + along)
      c.fillStyle = `rgb(${v}, ${v}, ${v})`
      c.fillRect(x, y - pitch * 0.42, step, pitch * 0.84)
    }
  }

  // La urdimbre: hilos verticales que se asoman entre los de trama. Sin ellos la
  // tela se leía como metal cepillado, que también es de rayas pero de una sola.
  c.globalAlpha = 0.6
  for (let col = 0; col * pitch < WALL_TILE; col++) {
    const v = Math.round(128 + (rand1(col, 317) - 0.5) * 48)
    c.fillStyle = `rgb(${v}, ${v}, ${v})`
    c.fillRect(col * pitch, 0, pitch * 0.45, WALL_TILE)
  }
  c.globalAlpha = 1

  // Los nudos: tramos más gruesos de un hilo, más claros o más oscuros.
  for (let i = 0; i < 140; i++) {
    const x = rand1(i, 331) * WALL_TILE
    const row = Math.floor(rand1(i + 100, 331) * (WALL_TILE / pitch))
    const y = row * pitch + pitch / 2
    const len = (0.8 + rand1(i + 200, 331) * 2.4) * WALL_PPC
    const light = rand1(i + 300, 331) > 0.5
    c.fillStyle = light ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.26)'
    wrapped(x, y, len, (cx, cy) => {
      c.beginPath()
      c.ellipse(cx, cy, len / 2, pitch * 0.62, 0, 0, Math.PI * 2)
      c.fill()
    })
  }
}

/**
 * La muestra de una pared para su tarjeta: el color con la textura encima, acercada
 * —a más centímetros por píxel que en la escena— para que en un cuadradito se vea
 * qué textura es. La luz corre en diagonal, como la del foco.
 */
export function paintWallChip(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  color: string,
  pattern: WallPattern,
) {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = color
  ctx.fillRect(0, 0, w, h)

  const structure = wallStructure(ctx, pattern, 12, { x: 0, y: 0 })
  if (structure) {
    ctx.save()
    ctx.globalCompositeOperation = 'soft-light'
    ctx.globalAlpha = 0.9
    ctx.fillStyle = structure
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  const light = ctx.createLinearGradient(0, 0, w, h)
  light.addColorStop(0, 'rgba(255, 246, 230, 0.18)')
  light.addColorStop(1, 'rgba(0, 0, 0, 0.16)')
  ctx.fillStyle = light
  ctx.fillRect(0, 0, w, h)
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
  pxPerCm: number,
) {
  ctx.fillStyle = color
  ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h)

  if (material === 'wood') {
    const contrast = finish === 'grained' ? 1 : 0.45
    if (!drawWood(ctx, bounds, alongX, color, contrast, seed, pxPerCm)) {
      drawWoodGrain(ctx, bounds, alongX, color, contrast, seed)
    }
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

/**
 * Vetas dibujadas: líneas paralelas al eje de la pieza, con desvío y grosor
 * variables. Es el respaldo de `drawWood` para un navegador que no sabe escalar un
 * patrón.
 */
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
