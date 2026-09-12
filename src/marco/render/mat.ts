import type { MatState, Rect } from '../types'
import { rgba, shade, sideIntensity, type Light, type Side } from './light'
import { matPattern } from './textures'

const SIDES: Side[] = ['top', 'left', 'right', 'bottom']

/**
 * Passe-partout: cartón grueso con la ventana cortada en ángulo. El bisel deja ver
 * el núcleo blanco del cartón, y es el detalle que distingue un passe-partout real
 * de un simple borde de color.
 */
export function drawMat(
  ctx: CanvasRenderingContext2D,
  outer: Rect,
  sight: Rect,
  mat: MatState,
  pxPerCm: number,
  light: Light,
) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(outer.x, outer.y, outer.w, outer.h)
  ctx.rect(sight.x, sight.y, sight.w, sight.h)
  ctx.clip('evenodd')

  ctx.fillStyle = mat.color
  ctx.fillRect(outer.x, outer.y, outer.w, outer.h)

  const grain = matPattern(ctx)
  if (grain) {
    ctx.save()
    ctx.globalCompositeOperation = 'soft-light'
    ctx.globalAlpha = 0.55
    ctx.fillStyle = grain
    ctx.fillRect(outer.x, outer.y, outer.w, outer.h)
    ctx.restore()
  }

  // Caída de luz sobre el cartón, siguiendo la fuente.
  const wash = ctx.createLinearGradient(
    outer.x + (light.x > 0 ? outer.w : 0),
    outer.y + (light.y > 0 ? outer.h : 0),
    outer.x + (light.x > 0 ? 0 : outer.w),
    outer.y + (light.y > 0 ? 0 : outer.h),
  )
  wash.addColorStop(0, 'rgba(255, 250, 238, 0.2)')
  wash.addColorStop(1, 'rgba(0, 0, 0, 0.22)')
  ctx.fillStyle = wash
  ctx.fillRect(outer.x, outer.y, outer.w, outer.h)
  ctx.restore()

  drawBevel(ctx, sight, mat.color, pxPerCm, light)
}

/**
 * El corte a 45° de la ventana. La iluminación va invertida respecto de la moldura:
 * es una cara que mira hacia adentro, así que el lado de arriba queda en sombra.
 */
function drawBevel(
  ctx: CanvasRenderingContext2D,
  sight: Rect,
  color: string,
  pxPerCm: number,
  light: Light,
) {
  const bevel = Math.max(1.5, pxPerCm * 0.2) // ~2 mm de canto de cartón
  const core = shade(color, 0.6) // el núcleo del cartón es más claro que la cara

  const outerB: Rect = {
    x: sight.x - bevel,
    y: sight.y - bevel,
    w: sight.w + bevel * 2,
    h: sight.h + bevel * 2,
  }

  for (const side of SIDES) {
    const k = -sideIntensity(side, light) // invertido: la cara mira hacia el interior
    ctx.save()
    ctx.beginPath()
    switch (side) {
      case 'top':
        ctx.moveTo(outerB.x, outerB.y)
        ctx.lineTo(outerB.x + outerB.w, outerB.y)
        ctx.lineTo(sight.x + sight.w, sight.y)
        ctx.lineTo(sight.x, sight.y)
        break
      case 'right':
        ctx.moveTo(outerB.x + outerB.w, outerB.y)
        ctx.lineTo(outerB.x + outerB.w, outerB.y + outerB.h)
        ctx.lineTo(sight.x + sight.w, sight.y + sight.h)
        ctx.lineTo(sight.x + sight.w, sight.y)
        break
      case 'bottom':
        ctx.moveTo(outerB.x + outerB.w, outerB.y + outerB.h)
        ctx.lineTo(outerB.x, outerB.y + outerB.h)
        ctx.lineTo(sight.x, sight.y + sight.h)
        ctx.lineTo(sight.x + sight.w, sight.y + sight.h)
        break
      case 'left':
        ctx.moveTo(outerB.x, outerB.y + outerB.h)
        ctx.lineTo(outerB.x, outerB.y)
        ctx.lineTo(sight.x, sight.y)
        ctx.lineTo(sight.x, sight.y + sight.h)
        break
    }
    ctx.closePath()
    ctx.fillStyle = core
    ctx.fill()
    ctx.fillStyle = rgba(k > 0 ? '#ffffff' : '#000000', Math.abs(k) * 0.5)
    ctx.fill()
    ctx.restore()
  }

  // Hilo de sombra del labio del passe-partout cayendo sobre la obra.
  ctx.save()
  ctx.beginPath()
  ctx.rect(sight.x, sight.y, sight.w, sight.h)
  ctx.clip()
  const drop = Math.max(1.5, pxPerCm * 0.24)
  const fromTop = Math.max(0, -light.y)
  const fromLeft = Math.max(0, -light.x)

  const t = ctx.createLinearGradient(0, sight.y, 0, sight.y + drop * 2.6)
  t.addColorStop(0, 'rgba(0, 0, 0, ' + (0.16 + fromTop * 0.3).toFixed(3) + ')')
  t.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = t
  ctx.fillRect(sight.x, sight.y, sight.w, drop * 2.6)

  const l = ctx.createLinearGradient(sight.x, 0, sight.x + drop * 2.2, 0)
  l.addColorStop(0, 'rgba(0, 0, 0, ' + (0.12 + fromLeft * 0.24).toFixed(3) + ')')
  l.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = l
  ctx.fillRect(sight.x, sight.y, drop * 2.2, sight.h)
  ctx.restore()
}
