import type { FrameState, Rect } from '../types'
import { rgba, shade, sideIntensity, type Light, type Side } from './light'
import { glossOf, shadeProfile } from './profile'
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

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  outer: Rect,
  inner: Rect,
  frame: FrameState,
  light: Light,
  depthPx: number,
  parallax: Parallax,
) {
  drawSideFaces(ctx, outer, frame, depthPx, parallax)

  const gloss = glossOf(frame.finish)

  for (const side of SIDES) {
    const pts = sidePath(outer, inner, side)
    const { rect, alongX } = sideBounds(outer, inner, side)
    if (rect.w <= 0 || rect.h <= 0) continue

    ctx.save()
    tracePath(ctx, pts)
    ctx.clip()

    // Material con la veta corriendo a lo largo de la pieza real.
    drawMaterial(ctx, rect, alongX, frame.color, frame.material, frame.finish, SEED[side])

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
      const spec = ctx.createLinearGradient(axis.x0, axis.y0, axis.x1, axis.y1)
      for (const s of stops) {
        spec.addColorStop(s.t, 'rgba(255, 252, 245, ' + (s.spec * 0.85).toFixed(3) + ')')
      }
      ctx.fillStyle = spec
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
    }

    ctx.restore()
  }

  drawFillets(ctx, outer, inner, light)
  drawMiters(ctx, outer, inner)
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
 */
export function drawRebateShadow(
  ctx: CanvasRenderingContext2D,
  inner: Rect,
  depthPx: number,
  light: Light,
) {
  const spread = Math.max(2, depthPx * 0.6)
  ctx.save()
  ctx.beginPath()
  ctx.rect(inner.x, inner.y, inner.w, inner.h)
  ctx.clip()

  const fromTop = Math.max(0, -light.y)
  const fromLeft = Math.max(0, -light.x)

  const top = ctx.createLinearGradient(0, inner.y, 0, inner.y + spread)
  top.addColorStop(0, 'rgba(0, 0, 0, ' + (0.2 + fromTop * 0.32).toFixed(3) + ')')
  top.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = top
  ctx.fillRect(inner.x, inner.y, inner.w, spread)

  const left = ctx.createLinearGradient(inner.x, 0, inner.x + spread, 0)
  left.addColorStop(0, 'rgba(0, 0, 0, ' + (0.16 + fromLeft * 0.26).toFixed(3) + ')')
  left.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = left
  ctx.fillRect(inner.x, inner.y, spread, inner.h)

  ctx.restore()
}

/**
 * Sin marco: la obra queda en un sándwich de vidrio sujeto por ganchitos metálicos
 * en el medio de cada lado. Es una opción real de enmarcado, no una ausencia.
 */
export function drawGlassClips(ctx: CanvasRenderingContext2D, rect: Rect, pxPerCm: number) {
  const len = Math.max(10, pxPerCm * 2.4)
  const thick = Math.max(4, pxPerCm * 0.9)

  const clips = [
    { x: rect.x + rect.w / 2 - len / 2, y: rect.y - thick / 2, w: len, h: thick },
    { x: rect.x + rect.w / 2 - len / 2, y: rect.y + rect.h - thick / 2, w: len, h: thick },
    { x: rect.x - thick / 2, y: rect.y + rect.h / 2 - len / 2, w: thick, h: len },
    { x: rect.x + rect.w - thick / 2, y: rect.y + rect.h / 2 - len / 2, w: thick, h: len },
  ]

  for (const c of clips) {
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'
    ctx.shadowBlur = thick
    ctx.shadowOffsetX = thick * 0.3
    ctx.shadowOffsetY = thick * 0.35

    const horizontal = c.w > c.h
    const g = ctx.createLinearGradient(
      c.x,
      c.y,
      horizontal ? c.x : c.x + c.w,
      horizontal ? c.y + c.h : c.y,
    )
    g.addColorStop(0, shade('#c8ccd0', 0.34))
    g.addColorStop(0.45, '#9aa0a6')
    g.addColorStop(1, shade('#6f747a', -0.3))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.roundRect(c.x, c.y, c.w, c.h, thick * 0.35)
    ctx.fill()
    ctx.restore()
  }
}
