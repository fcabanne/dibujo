import type { GlassType, Rect } from '../types'
import { canvasFilterSupported } from './blur'
import { sideIntensity, type Light, type Side } from './light'

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
  light: Light,
  parallax: { x: number; y: number },
  /**
   * La transformación de la pantalla, sin el cuadro. El reflejo es del cuarto: si el
   * cuadro se balancea, el vidrio gira debajo de un reflejo que se queda quieto.
   */
  world?: DOMMatrix,
) {
  if (type === 'none') return

  ctx.save()
  ctx.beginPath()
  ctx.rect(rect.x, rect.y, rect.w, rect.h)
  ctx.clip()

  if (type === 'matte') {
    drawDiffusion(ctx, rect)
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
    // El clip del vidrio, puesto en el espacio del cuadro, sigue valiendo.
    if (world) ctx.setTransform(world)
    drawReflection(ctx, rect, light, parallax, world ? 1.6 : 0)
  }

  ctx.restore()
}

/**
 * Relee el área ya compuesta y la vuelve a pegar borrosa: difusión real.
 *
 * Trabaja en píxeles del dispositivo, a través de la transformación que tenga el
 * contexto: si el cuadro está girado, lo que hay detrás del vidrio es la caja que
 * ocupa en pantalla, no el rectángulo derecho. El recorte del vidrio, puesto antes,
 * se encarga de que lo pegado no se salga.
 */
function drawDiffusion(ctx: CanvasRenderingContext2D, rect: Rect) {
  const m = ctx.getTransform()
  const corners = [
    m.transformPoint(new DOMPoint(rect.x, rect.y)),
    m.transformPoint(new DOMPoint(rect.x + rect.w, rect.y)),
    m.transformPoint(new DOMPoint(rect.x + rect.w, rect.y + rect.h)),
    m.transformPoint(new DOMPoint(rect.x, rect.y + rect.h)),
  ]
  const minX = Math.min(...corners.map((p) => p.x))
  const minY = Math.min(...corners.map((p) => p.y))
  const boxW = Math.max(...corners.map((p) => p.x)) - minX
  const boxH = Math.max(...corners.map((p) => p.y)) - minY
  const dw = Math.max(1, Math.round(boxW))
  const dh = Math.max(1, Math.round(boxH))
  const sctx = getScratch(dw, dh)
  if (!sctx) return

  sctx.clearRect(0, 0, dw, dh)
  sctx.drawImage(ctx.canvas, Math.round(minX), Math.round(minY), dw, dh, 0, 0, dw, dh)

  // El radio del filtro no pasa por la transformación; el del respaldo sí.
  const scale = Math.hypot(m.a, m.b) || 1
  const radius = Math.min(rect.w, rect.h) * 0.006

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 0.75
  if (canvasFilterSupported()) {
    ctx.filter = 'blur(' + radius.toFixed(2) + 'px)'
    ctx.drawImage(sctx.canvas, minX, minY, boxW, boxH)
  } else {
    // Sin filtro (Safari): achicar y volver a agrandar. El suavizado del reescalado
    // es un desenfoque barato, y al radio chico del vidrio mate no se le nota la
    // diferencia con el gaussiano.
    const shrink = Math.max(1.5, radius * scale * 1.4)
    const small = getSmall(Math.max(1, Math.round(dw / shrink)), Math.max(1, Math.round(dh / shrink)))
    if (small) {
      small.imageSmoothingQuality = 'high'
      small.drawImage(sctx.canvas, 0, 0, small.canvas.width, small.canvas.height)
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(small.canvas, minX, minY, boxW, boxH)
    }
  }
  ctx.restore()
}

let smallScratch: HTMLCanvasElement | null = null

function getSmall(w: number, h: number): CanvasRenderingContext2D | null {
  if (!smallScratch) smallScratch = document.createElement('canvas')
  if (smallScratch.width !== w || smallScratch.height !== h) {
    smallScratch.width = w
    smallScratch.height = h
  }
  const small = smallScratch.getContext('2d')
  small?.clearRect(0, 0, w, h)
  return small
}

/**
 * El canto del vidrio, cuando no hay marco que lo tape.
 *
 * Con moldura el borde del vidrio queda escondido en el rebaje. Sin ella —el
 * sándwich de vidrio con ganchitos— el canto pulido está a la vista y agarra luz: un
 * hilo claro del lado de la fuente y uno oscuro del otro, con el tinte verdoso que
 * tiene el vidrio común visto de canto. Es lo que hace que ese cuadro se lea como
 * una placa con espesor y no como un rectángulo con un reflejo encima.
 */
export function drawGlassEdge(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  pxPerCm: number,
  light: Light,
) {
  const width = Math.max(1, pxPerCm * 0.12)
  const half = width / 2
  const x0 = rect.x + half
  const y0 = rect.y + half
  const x1 = rect.x + rect.w - half
  const y1 = rect.y + rect.h - half

  const sides: { side: Side; from: [number, number]; to: [number, number] }[] = [
    { side: 'top', from: [x0, y0], to: [x1, y0] },
    { side: 'left', from: [x0, y0], to: [x0, y1] },
    { side: 'bottom', from: [x0, y1], to: [x1, y1] },
    { side: 'right', from: [x1, y0], to: [x1, y1] },
  ]

  ctx.save()
  ctx.lineWidth = width
  ctx.lineCap = 'square'
  for (const { side, from, to } of sides) {
    const k = sideIntensity(side, light)
    ctx.strokeStyle =
      k > 0
        ? 'rgba(232, 248, 242, ' + (0.28 + k * 0.4).toFixed(3) + ')'
        : 'rgba(34, 58, 52, ' + (0.18 - k * 0.22).toFixed(3) + ')'
    ctx.beginPath()
    ctx.moveTo(from[0], from[1])
    ctx.lineTo(to[0], to[1])
    ctx.stroke()
  }
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
  /** Cuánto pintar de más alrededor, por si el vidrio está girado bajo el reflejo. */
  pad = 0,
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
  const px = rect.w * pad
  const py = rect.h * pad
  ctx.fillStyle = g
  ctx.fillRect(rect.x - px, rect.y - py, rect.w + 2 * px, rect.h + 2 * py)

  // Brillo concentrado del lado de la fuente.
  const hotX = rect.x + rect.w * (0.5 - light.x * 0.34 - parallax.x * 0.4)
  const hotY = rect.y + rect.h * (0.5 + light.y * 0.34 - parallax.y * 0.28)
  const hot = ctx.createRadialGradient(hotX, hotY, 0, hotX, hotY, Math.max(rect.w, rect.h) * 0.6)
  hot.addColorStop(0, 'rgba(255, 253, 246, 0.1)')
  hot.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = hot
  ctx.fillRect(rect.x - px, rect.y - py, rect.w + 2 * px, rect.h + 2 * py)
}
