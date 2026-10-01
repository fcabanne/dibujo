import type { Rect } from '../types'
import { sideIntensity, type Light, type Side } from './light'

/**
 * Los ganchitos del cuadro sin marco.
 *
 * Un cuadro "sin marco" es un sándwich —vidrio, obra, fondo— apretado por clips de
 * acero de resorte. Cada clip abraza el borde: de frente se ve una lengüeta chata de
 * un centímetro de ancho que pisa el vidrio, el doblez sobre el canto, que agarra la
 * luz, y la sombra que la lengüeta tira sobre la obra, a través del vidrio. Antes eran
 * cuatro pastillas grises montadas sobre el borde, y se leían como un juguete.
 *
 * Todo va en centímetros, como el resto del cuadro: un clip mide lo que mide uno de
 * verdad, así que en un cuadro grande se ven chicos y en uno chico, grandes.
 */

/** La lengüeta: ancho a lo largo del borde, y cuánto pisa el vidrio. */
const TONGUE = { w: 1.1, reach: 0.85 }
/** Lo que el doblez sobresale del canto: el espesor de la chapa más su curva. */
const BEND = 0.14
/** Cuánto se separa la sombra de la lengüeta: el espesor del vidrio que la separa de la obra. */
const LIFT = 0.25

/**
 * Cuántos clips lleva un lado y dónde. Los lados cortos llevan uno al medio hasta que
 * pasan de 45 cm; los largos, dos cerca de las puntas desde los 30. Es como vienen los
 * portarretratos de clip: seis en un 40 × 50, cuatro en un A4.
 */
function stations(length: number, isLong: boolean): number[] {
  const two = isLong ? length >= 30 : length >= 45
  return two ? [0.2, 0.8] : [0.5]
}

export function drawGlassClips(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  pxPerCm: number,
  light: Light,
  /**
   * La luz en el espacio de la pantalla. La sombra de cada clip se corre en píxeles
   * del dispositivo, que no giran con el cuadro: si el cuadro se balancea, la sombra
   * sigue cayendo lejos del foco del cuarto.
   */
  shadowLight: Light = light,
) {
  const wCm = rect.w / pxPerCm
  const hCm = rect.h / pxPerCm
  const horizontalIsLong = wCm >= hCm

  const clips: { side: Side; x: number; y: number; angle: number }[] = []
  for (const t of stations(wCm, horizontalIsLong)) {
    clips.push({ side: 'top', x: rect.x + rect.w * t, y: rect.y, angle: 0 })
    clips.push({ side: 'bottom', x: rect.x + rect.w * t, y: rect.y + rect.h, angle: Math.PI })
  }
  for (const t of stations(hCm, !horizontalIsLong)) {
    clips.push({ side: 'left', x: rect.x, y: rect.y + rect.h * t, angle: -Math.PI / 2 })
    clips.push({ side: 'right', x: rect.x + rect.w, y: rect.y + rect.h * t, angle: Math.PI / 2 })
  }

  // La sombra se corre en pantalla, no en el marco girado de cada clip: `shadowOffset`
  // y `shadowBlur` se miden en píxeles del dispositivo, por eso la escala de a mano.
  const device = ctx.getTransform()
  const scale = Math.hypot(device.a, device.b) || 1

  const w = Math.max(7, TONGUE.w * pxPerCm)
  const reach = Math.max(5, TONGUE.reach * pxPerCm)
  const bend = Math.max(1, BEND * pxPerCm)
  const tip = w * 0.42

  for (const clip of clips) {
    const k = sideIntensity(clip.side, light)

    ctx.save()
    ctx.translate(clip.x, clip.y)
    ctx.rotate(clip.angle)

    // La lengüeta, con la punta redondeada: en el marco local, x corre a lo largo del
    // borde e y entra hacia el vidrio.
    ctx.beginPath()
    ctx.moveTo(-w / 2, -bend)
    ctx.lineTo(w / 2, -bend)
    ctx.lineTo(w / 2, reach - tip)
    ctx.arcTo(w / 2, reach, w / 2 - tip, reach, tip)
    ctx.lineTo(-w / 2 + tip, reach)
    ctx.arcTo(-w / 2, reach, -w / 2, reach - tip, tip)
    ctx.closePath()

    // Del doblez hacia la punta: la curva que se va para atrás queda oscura, el canto
    // del doblez brilla, y la chapa plana se apaga de a poco. El lado que mira a la
    // fuente brilla más.
    const g = ctx.createLinearGradient(0, -bend, 0, reach)
    const lit = Math.max(0, k)
    const stop = bend / (bend + reach)
    g.addColorStop(0, '#5d6368')
    g.addColorStop(stop * 0.6, '#9ba2a8')
    g.addColorStop(stop, `rgb(${Math.round(226 + lit * 25)}, ${Math.round(230 + lit * 22)}, ${Math.round(233 + lit * 20)})`)
    g.addColorStop(Math.min(1, stop + 0.18), '#c3c9cd')
    g.addColorStop(1, '#a3aaaf')

    ctx.shadowColor = 'rgba(0, 0, 0, 0.34)'
    ctx.shadowBlur = Math.max(1.5, pxPerCm * 0.14) * scale
    ctx.shadowOffsetX = -shadowLight.x * LIFT * pxPerCm * scale
    ctx.shadowOffsetY = -shadowLight.y * LIFT * pxPerCm * scale
    ctx.fillStyle = g
    ctx.fill()

    ctx.shadowColor = 'transparent'
    if (k < 0) {
      // El lado en sombra: la misma chapa, con menos luz.
      ctx.fillStyle = `rgba(20, 24, 28, ${(-k * 0.22).toFixed(3)})`
      ctx.fill()
    }

    // El contorno fino que separa la chapa del vidrio.
    ctx.lineWidth = Math.max(0.5, pxPerCm * 0.025)
    ctx.strokeStyle = 'rgba(34, 38, 42, 0.55)'
    ctx.stroke()
    ctx.restore()
  }
}
