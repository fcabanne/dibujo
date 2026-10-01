import type { FrameProfile, FrameState, Rect } from '../types'
import { rgba, shade, shadowTint, sideIntensity, spotPosition, type Light, type Side } from './light'
import { glossOf, shadeProfile, specPeak, type ProfileStop } from './profile'
import { drawMaterial } from './textures'

interface Pt {
  x: number
  y: number
}

export interface Parallax {
  x: number
  y: number
}

/**
 * Las cuatro caras de la moldura con inglete a 45°: cada una es un trapecio entre
 * una esquina exterior y su correspondiente interior. Dibujarlas por separado es lo
 * que permite darle a cada lado su propia iluminación y su propia veta.
 */
function sidePath(outer: Rect, inner: Rect, side: Side): Pt[] {
  const o = {
    tl: { x: outer.x, y: outer.y },
    tr: { x: outer.x + outer.w, y: outer.y },
    br: { x: outer.x + outer.w, y: outer.y + outer.h },
    bl: { x: outer.x, y: outer.y + outer.h },
  }
  const i = {
    tl: { x: inner.x, y: inner.y },
    tr: { x: inner.x + inner.w, y: inner.y },
    br: { x: inner.x + inner.w, y: inner.y + inner.h },
    bl: { x: inner.x, y: inner.y + inner.h },
  }
  switch (side) {
    case 'top':
      return [o.tl, o.tr, i.tr, i.tl]
    case 'right':
      return [o.tr, o.br, i.br, i.tr]
    case 'bottom':
      return [o.br, o.bl, i.bl, i.br]
    case 'left':
      return [o.bl, o.tl, i.tl, i.bl]
  }
}

/** Franja que contiene una cara, y si la pieza corre en horizontal. */
function sideBounds(outer: Rect, inner: Rect, side: Side): { rect: Rect; alongX: boolean } {
  switch (side) {
    case 'top':
      return { rect: { x: outer.x, y: outer.y, w: outer.w, h: inner.y - outer.y }, alongX: true }
    case 'bottom':
      return {
        rect: {
          x: outer.x,
          y: inner.y + inner.h,
          w: outer.w,
          h: outer.y + outer.h - (inner.y + inner.h),
        },
        alongX: true,
      }
    case 'left':
      return { rect: { x: outer.x, y: outer.y, w: inner.x - outer.x, h: outer.h }, alongX: false }
    case 'right':
      return {
        rect: {
          x: inner.x + inner.w,
          y: outer.y,
          w: outer.x + outer.w - (inner.x + inner.w),
          h: outer.h,
        },
        alongX: false,
      }
  }
}

/** Eje del perfil: del canto exterior al interior. Por ahí corre la sección. */
function profileAxis(outer: Rect, inner: Rect, side: Side) {
  switch (side) {
    case 'top':
      return { x0: 0, y0: outer.y, x1: 0, y1: inner.y }
    case 'bottom':
      return { x0: 0, y0: outer.y + outer.h, x1: 0, y1: inner.y + inner.h }
    case 'left':
      return { x0: outer.x, y0: 0, x1: inner.x, y1: 0 }
    case 'right':
      return { x0: outer.x + outer.w, y0: 0, x1: inner.x + inner.w, y1: 0 }
  }
}

const SIDES: Side[] = ['top', 'left', 'right', 'bottom']
const SEED: Record<Side, number> = { top: 11, right: 29, bottom: 47, left: 67 }

/**
 * Cuánto se aparta cada listón del tono de la madera: positivo aclara, negativo
 * oscurece. Fijo y no al azar para que el marco no cambie entre una visita y otra,
 * y alternado para que dos lados vecinos nunca coincidan.
 */
const PIECE_TONE: Record<Side, number> = { top: 0.022, right: -0.026, bottom: 0.016, left: -0.02 }

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  outer: Rect,
  inner: Rect,
  frame: FrameState,
  light: Light,
  depthPx: number,
  parallax: Parallax,
  pxPerCm: number,
) {
  drawSideFaces(ctx, outer, frame, depthPx, parallax)

  const gloss = glossOf(frame.finish)
  const view = viewpoint(outer, light, parallax, pxPerCm)

  for (const side of SIDES) {
    const pts = sidePath(outer, inner, side)
    const { rect, alongX } = sideBounds(outer, inner, side)
    if (rect.w <= 0 || rect.h <= 0) continue

    ctx.save()
    tracePath(ctx, pts)
    ctx.clip()

    // Material con la veta corriendo a lo largo de la pieza real.
    drawMaterial(ctx, rect, alongX, frame.color, frame.material, frame.finish, SEED[side], pxPerCm)

    // Cada lado de una moldura de madera es un listón distinto, cortado de otra
    // parte de la tabla, y ninguno tiene exactamente el tono del de al lado. Cuatro
    // piezas idénticas son lo que delata un marco dibujado; unos pocos puntos de
    // diferencia alcanzan para que la juntura del inglete se lea como una juntura.
    if (frame.material === 'wood') {
      const tone = PIECE_TONE[side]
      ctx.fillStyle = tone > 0 ? rgba('#fff4e4', tone) : rgba('#140c06', -tone)
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
    }

    // Sección de la moldura: cada parada sale de iluminar la normal del perfil.
    const axis = profileAxis(outer, inner, side)
    const stops = shadeProfile(side, light, gloss, frame.profile)

    const shading = ctx.createLinearGradient(axis.x0, axis.y0, axis.x1, axis.y1)
    for (const s of stops) {
      shading.addColorStop(
        s.t,
        s.shade >= 0
          ? rgba('#fff6e8', Math.min(0.72, s.shade * 0.62))
          : rgba('#07070c', Math.min(0.82, -s.shade * 0.72)),
      )
    }
    ctx.fillStyle = shading
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h)

    if (gloss > 0.2) {
      drawGlint(ctx, outer, rect, axis, alongX, side, frame.profile, stops, gloss, view)
    }

    ctx.restore()
  }

  drawFillets(ctx, outer, inner, light)
  drawMiters(ctx, outer, inner)
}

type Vec = { x: number; y: number; z: number }

/**
 * Dónde están el foco y el ojo, en px respecto del centro del cuadro.
 *
 * El ojo está parado enfrente a la distancia a la que se mira un cuadro, y el
 * puntero —o la inclinación del teléfono— lo corre de costado: es moverse frente al
 * cuadro. Va al revés que el puntero, como la cara lateral que se asoma.
 */
function viewpoint(outer: Rect, light: Light, parallax: Parallax, pxPerCm: number) {
  const spot = spotPosition(light, outer.w, outer.h, pxPerCm)
  const far = spot.reach
  return {
    center: { x: outer.x + outer.w / 2, y: outer.y + outer.h / 2 },
    spot: spot as Vec,
    eye: { x: -parallax.x * far * 0.5, y: -parallax.y * far * 0.35, z: far } as Vec,
  }
}

const unit = (v: Vec): Vec => {
  const len = Math.hypot(v.x, v.y, v.z) || 1
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

/** Estaciones a lo largo de cada listón donde se mide cuánto brilla. */
const GLINT_STATIONS = 16

let glintCanvas: HTMLCanvasElement | null = null

/**
 * El brillo de un listón, que recorre la moldura.
 *
 * Con la luz y el ojo en el infinito cada listón brillaba igual de punta a punta,
 * como un perfil extruido. Un foco está en un lugar y el ojo en otro, así que en cada
 * punto del listón la luz llega de otro ángulo: el reflejo es fuerte donde el ángulo
 * de la luz y el del ojo se compensan, y se apaga hacia las puntas. Moverse frente al
 * cuadro corre ese punto, y el brillo viaja por la moldura —lo que hace un marco
 * laqueado o dorado cuando uno camina delante—.
 *
 * La sección sigue saliendo de `shadeProfile` (dónde cae el brillo a lo ancho); lo
 * nuevo es cuánto brilla a lo largo. Las dos cosas se multiplican en un lienzo
 * aparte y se pegan sobre el listón.
 */
function drawGlint(
  ctx: CanvasRenderingContext2D,
  outer: Rect,
  rect: Rect,
  axis: { x0: number; y0: number; x1: number; y1: number },
  alongX: boolean,
  side: Side,
  profile: FrameProfile,
  stops: ProfileStop[],
  gloss: number,
  view: ReturnType<typeof viewpoint>,
) {
  const peak = Math.max(...stops.map((s) => s.spec))
  if (peak <= 0) return

  // Cuánto brilla cada estación del listón, por la línea media de la banda.
  const mid = alongX ? rect.y + rect.h / 2 : rect.x + rect.w / 2
  const from = alongX ? outer.x : outer.y
  const span = alongX ? outer.w : outer.h
  const along: number[] = []
  for (let i = 0; i < GLINT_STATIONS; i++) {
    const u = from + (span * i) / (GLINT_STATIONS - 1)
    const p = {
      x: (alongX ? u : mid) - view.center.x,
      y: (alongX ? mid : u) - view.center.y,
    }
    const toSpot = unit({ x: view.spot.x - p.x, y: view.spot.y - p.y, z: view.spot.z })
    const toEye = unit({ x: view.eye.x - p.x, y: view.eye.y - p.y, z: view.eye.z })
    const half = unit({ x: toSpot.x + toEye.x, y: toSpot.y + toEye.y, z: toSpot.z + toEye.z })
    along.push(specPeak(side, profile, half))
  }
  const top = Math.max(...along)
  if (top * gloss < 0.004) return

  // La escala real del contexto, aunque el cuadro esté girado.
  const m = ctx.getTransform()
  const k = Math.hypot(m.a, m.b) || 1
  const w = Math.ceil(rect.w * k)
  const h = Math.ceil(rect.h * k)
  if (!glintCanvas) glintCanvas = document.createElement('canvas')
  if (glintCanvas.width < w || glintCanvas.height < h) {
    glintCanvas.width = Math.max(glintCanvas.width, w)
    glintCanvas.height = Math.max(glintCanvas.height, h)
  }
  const g = glintCanvas.getContext('2d')
  if (!g) return

  g.setTransform(1, 0, 0, 1, 0, 0)
  g.clearRect(0, 0, w, h)
  g.setTransform(k, 0, 0, k, -rect.x * k, -rect.y * k)

  // A lo ancho: la forma del brillo en la sección, con la intensidad del punto que
  // más brilla del listón.
  const across = g.createLinearGradient(axis.x0, axis.y0, axis.x1, axis.y1)
  for (const s of stops) {
    across.addColorStop(s.t, rgba('#fffcf5', (s.spec / peak) * 0.85 * gloss * top))
  }
  g.fillStyle = across
  g.fillRect(rect.x, rect.y, rect.w, rect.h)

  // A lo largo: cuánto de eso llega a cada estación.
  const fade = alongX
    ? g.createLinearGradient(outer.x, 0, outer.x + outer.w, 0)
    : g.createLinearGradient(0, outer.y, 0, outer.y + outer.h)
  along.forEach((a, i) => fade.addColorStop(i / (GLINT_STATIONS - 1), rgba('#000000', a / top)))
  g.globalCompositeOperation = 'destination-in'
  g.fillStyle = fade
  g.fillRect(rect.x, rect.y, rect.w, rect.h)
  g.globalCompositeOperation = 'source-over'

  ctx.drawImage(glintCanvas, 0, 0, w, h, rect.x, rect.y, w / k, h / k)
}

/**
 * La cara lateral de la moldura, visible del lado que se aleja del puntero. Es lo
 * que vende el espesor: sin esto el cuadro es un recorte plano por más sombra que
 * tenga debajo.
 */
function drawSideFaces(
  ctx: CanvasRenderingContext2D,
  outer: Rect,
  frame: FrameState,
  depthPx: number,
  parallax: Parallax,
) {
  const dark = shade(frame.color, -0.5)
  const mid = shade(frame.color, -0.28)

  const revealX = depthPx * parallax.x * 0.105
  const revealY = depthPx * parallax.y * 0.105
  const skew = Math.abs(revealY) * 0.5

  if (Math.abs(revealX) > 0.4) {
    // Puntero a la derecha, el cuadro gira y se asoma la cara izquierda. Y al revés.
    const onLeft = revealX > 0
    const w = Math.abs(revealX)
    const nearX = onLeft ? outer.x : outer.x + outer.w
    const farX = onLeft ? outer.x - w : outer.x + outer.w + w

    const g = ctx.createLinearGradient(Math.min(nearX, farX), 0, Math.max(nearX, farX), 0)
    g.addColorStop(0, onLeft ? dark : mid)
    g.addColorStop(1, onLeft ? mid : dark)
    ctx.fillStyle = g

    ctx.beginPath()
    ctx.moveTo(nearX, outer.y)
    ctx.lineTo(farX, outer.y + skew)
    ctx.lineTo(farX, outer.y + outer.h + skew)
    ctx.lineTo(nearX, outer.y + outer.h)
    ctx.closePath()
    ctx.fill()
  }

  if (Math.abs(revealY) > 0.4) {
    const onTop = revealY > 0
    const h = Math.abs(revealY)
    const y = onTop ? outer.y - h : outer.y + outer.h
    const g = ctx.createLinearGradient(0, y, 0, y + h)
    g.addColorStop(0, onTop ? mid : dark)
    g.addColorStop(1, onTop ? dark : mid)
    ctx.fillStyle = g
    ctx.fillRect(outer.x, y, outer.w, h)
  }
}

/** Filetes de canto: los dos hilos que hacen que la moldura lea como un sólido. */
function drawFillets(ctx: CanvasRenderingContext2D, outer: Rect, inner: Rect, light: Light) {
  const band = Math.max(1, Math.min(outer.w - inner.w, outer.h - inner.h) / 2)
  ctx.save()
  ctx.lineWidth = Math.max(1, band * 0.05)

  const lit = Math.max(0, sideIntensity('top', light))
  ctx.strokeStyle = 'rgba(255, 250, 238, ' + (0.2 + lit * 0.3).toFixed(3) + ')'
  ctx.beginPath()
  ctx.moveTo(outer.x, outer.y + outer.h)
  ctx.lineTo(outer.x, outer.y)
  ctx.lineTo(outer.x + outer.w, outer.y)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.beginPath()
  ctx.moveTo(outer.x + outer.w, outer.y)
  ctx.lineTo(outer.x + outer.w, outer.y + outer.h)
  ctx.lineTo(outer.x, outer.y + outer.h)
  ctx.stroke()
  ctx.restore()
}

/** La juntura diagonal de cada esquina. */
function drawMiters(ctx: CanvasRenderingContext2D, outer: Rect, inner: Rect) {
  ctx.save()
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'
  ctx.lineWidth = 1
  const corners: [Pt, Pt][] = [
    [{ x: outer.x, y: outer.y }, { x: inner.x, y: inner.y }],
    [{ x: outer.x + outer.w, y: outer.y }, { x: inner.x + inner.w, y: inner.y }],
    [{ x: outer.x + outer.w, y: outer.y + outer.h }, { x: inner.x + inner.w, y: inner.y + inner.h }],
    [{ x: outer.x, y: outer.y + outer.h }, { x: inner.x, y: inner.y + inner.h }],
  ]
  for (const [a, b] of corners) {
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  ctx.restore()
}

function tracePath(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y)
  ctx.closePath()
}

/**
 * Sombra del rebaje sobre el contenido: el marco está por delante del vidrio y
 * proyecta un hilo de sombra hacia adentro. Es lo que asienta las capas.
 *
 * `surface` es el color de lo que queda debajo —el passe-partout, si hay—: la sombra
 * toma su color, como la de la pared (ver `shadowTint`).
 */
export function drawRebateShadow(
  ctx: CanvasRenderingContext2D,
  inner: Rect,
  depthPx: number,
  light: Light,
  surface: string | null,
) {
  const spread = Math.max(2, depthPx * 0.6)
  ctx.save()
  ctx.beginPath()
  ctx.rect(inner.x, inner.y, inner.w, inner.h)
  ctx.clip()

  const fromTop = Math.max(0, -light.y)
  const fromLeft = Math.max(0, -light.x)

  const edges = (color: string, k: number) => {
    const top = ctx.createLinearGradient(0, inner.y, 0, inner.y + spread)
    top.addColorStop(0, rgba(color, (0.2 + fromTop * 0.32) * k))
    top.addColorStop(1, rgba(color, 0))
    ctx.fillStyle = top
    ctx.fillRect(inner.x, inner.y, inner.w, spread)

    const left = ctx.createLinearGradient(inner.x, 0, inner.x + spread, 0)
    left.addColorStop(0, rgba(color, (0.16 + fromLeft * 0.26) * k))
    left.addColorStop(1, rgba(color, 0))
    ctx.fillStyle = left
    ctx.fillRect(inner.x, inner.y, spread, inner.h)
  }

  edges('#000000', 0.88)
  ctx.globalCompositeOperation = 'multiply'
  edges(shadowTint(surface ?? '#d8d4cc'), 1.6)

  ctx.restore()
}
