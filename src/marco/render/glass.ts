import type { GlassType, Rect } from '../types'
import type { Light } from './light'

let scratch: HTMLCanvasElement | null = null

function getScratch(w: number, h: number): CanvasRenderingContext2D | null {
  if (!scratch) scratch = document.createElement('canvas')
  if (scratch.width !== w || scratch.height !== h) {
    scratch.width = w
    scratch.height = h
  }
  return scratch.getContext('2d')
}

/**
 * El vidrio cambia lo que se ve de la obra, no es una decoración encima: el mate
 * difumina de verdad, el antirreflejo se come un punto de contraste, y el cristal
 * común devuelve el reflejo especular.
 *
 * El reflejo se desliza con el puntero. Un brillo fijo lee como una calcomanía; uno
 * que barre el cristal cuando movés la cabeza es lo que delata que hay un vidrio.
 */
export function drawGlass(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  type: GlassType,
  dpr: number,
  light: Light,
  parallax: { x: number; y: number },
) {
  if (type === 'none') return

  ctx.save()
  ctx.beginPath()
  ctx.rect(rect.x, rect.y, rect.w, rect.h)
  ctx.clip()

  if (type === 'matte') {
    drawDiffusion(ctx, rect, dpr)
    ctx.fillStyle = 'rgba(236, 239, 242, 0.11)'
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
  }

  if (type === 'antireflective') {
    // Sin reflejo, pero el tratamiento levanta apenas los negros.
    ctx.fillStyle = 'rgba(224, 231, 236, 0.05)'
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
  }

  if (type === 'clear') {
    ctx.fillStyle = 'rgba(196, 224, 214, 0.05)'
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
    drawReflection(ctx, rect, light, parallax)
  }

  ctx.restore()
}

/** Relee el área ya compuesta y la vuelve a pegar borrosa: difusión real. */
function drawDiffusion(ctx: CanvasRenderingContext2D, rect: Rect, dpr: number) {
  const dw = Math.max(1, Math.round(rect.w * dpr))
  const dh = Math.max(1, Math.round(rect.h * dpr))
  const sctx = getScratch(dw, dh)
  if (!sctx) return

  sctx.clearRect(0, 0, dw, dh)
  sctx.drawImage(
    ctx.canvas,
    Math.round(rect.x * dpr),
    Math.round(rect.y * dpr),
    dw,
    dh,
    0,
    0,
    dw,
    dh,
  )

  ctx.save()
  ctx.filter = 'blur(' + (Math.min(rect.w, rect.h) * 0.006).toFixed(2) + 'px)'
  ctx.globalAlpha = 0.75
  ctx.drawImage(sctx.canvas, rect.x, rect.y, rect.w, rect.h)
  ctx.restore()
}

/**
 * La banda de luz de ventana que devuelve el cristal.
 *
 * Es lo único de la escena que responde fuerte al puntero. El resto del paralaje
 * quedó al 10 % porque un cuadro colgado casi no se mueve, pero un reflejo sí
 * barre el cristal apenas movés la cabeza: exagerarlo acá es lo que delata que hay
 * un vidrio delante, sin que nada más se sacuda.
 */
function drawReflection(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  light: Light,
  parallax: { x: number; y: number },
) {
  // El reflejo cae del lado opuesto a la fuente, como en un espejo, y el puntero
  // lo corre mucho más que a la luz.
  const shift = -light.x * 0.42 - parallax.x * 0.55
  const lift = -light.y * 0.18 + parallax.y * 0.32
  const cx = rect.x + rect.w * (0.5 + shift)
  const cy = rect.y + rect.h * (0.5 - lift)

  // Banda diagonal, centrada donde manda la luz.
  const span = Math.hypot(rect.w, rect.h)
  const g = ctx.createLinearGradient(
    cx - span * 0.5,
    cy - span * 0.5,
    cx + span * 0.32,
    cy + span * 0.32,
  )
  // La banda no es solo brillo: a un lado el cristal aclara y al otro devuelve el
  // gris de la habitación. Sin esa contraparte oscura el reflejo desaparece sobre
  // un passe-partout blanco, que es justo donde más se lo busca.
  g.addColorStop(0, 'rgba(90, 96, 104, 0.1)')
  g.addColorStop(0.3, 'rgba(90, 96, 104, 0.05)')
  g.addColorStop(0.4, 'rgba(255, 255, 255, 0.08)')
  g.addColorStop(0.46, 'rgba(255, 255, 255, 0.24)')
  g.addColorStop(0.54, 'rgba(255, 255, 255, 0.27)')
  g.addColorStop(0.6, 'rgba(255, 255, 255, 0.05)')
  g.addColorStop(0.66, 'rgba(255, 255, 255, 0.12)')
  g.addColorStop(0.78, 'rgba(80, 86, 96, 0.06)')
  g.addColorStop(1, 'rgba(80, 86, 96, 0.12)')
  ctx.fillStyle = g
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)

  // Brillo concentrado del lado de la fuente.
  const hotX = rect.x + rect.w * (0.5 - light.x * 0.34 - parallax.x * 0.4)
  const hotY = rect.y + rect.h * (0.5 + light.y * 0.34 - parallax.y * 0.28)
  const hot = ctx.createRadialGradient(hotX, hotY, 0, hotX, hotY, Math.max(rect.w, rect.h) * 0.6)
  hot.addColorStop(0, 'rgba(255, 253, 246, 0.1)')
  hot.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = hot
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
}
