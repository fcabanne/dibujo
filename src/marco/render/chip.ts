import type { FrameFinish, FrameMaterial, FrameProfile } from '../types'
import { REST_LIGHT, rgba, type Side } from './light'
import { glossOf, shadeProfile } from './profile'
import { drawMaterial } from './textures'
import { paintGlChip } from '../gl/chips'

/**
 * Si el cuadro se está dibujando en 3D, las muestras de la sección también: lo prende
 * el lienzo cuando el 3D anda. Las muestras que ya estaban pintadas no cambian; las
 * del abanico se pintan al abrirlo.
 */
let glChips = false

export function setGlChips(on: boolean) {
  glChips = on
}

/**
 * Cómo se mira la muestra:
 * - `top` / `bottom`: la sección de la moldura, iluminada como el lado de arriba
 *   (que en una caveta mira para abajo y queda en sombra) o como el de abajo (que
 *   mira a la luz). Es lo que distingue un perfil de otro.
 * - `face`: el material de frente, con una luz suave. Es lo que dice el color: con la
 *   sección de arriba encima, un marco blanco se veía gris oscuro en la muestra.
 */
export type ChipLook = Side | 'face'

/**
 * Una muestra de moldura: el mismo material y el mismo perfil que el marco del
 * lienzo, pintados en un cuadradito. Lo que se elige es exactamente lo que se va a
 * ver enmarcado — incluida la forma de la sección, que en un círculo de color plano
 * no se distinguiría.
 *
 * La usan el abanico del escritorio y las muestras del celular: dos lugares que
 * muestran la misma moldura no pueden pintarla de dos maneras.
 */
export function paintMoldingChip(
  canvas: HTMLCanvasElement,
  size: number,
  color: string,
  material?: FrameMaterial,
  finish?: FrameFinish,
  profile?: FrameProfile,
  look: ChipLook = 'top',
) {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = size * dpr
  canvas.height = size * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, size, size)

  if (!material || !finish) {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, size, size)
    return
  }

  if (glChips && look === 'top' && paintGlChip(canvas, size, color, material, finish, profile)) return

  // Un pedazo de unos dos centímetros y medio: la veta a la escala en que se la ve.
  drawMaterial(ctx, { x: 0, y: 0, w: size, h: size }, false, color, material, finish, 11, size / 2.5)

  if (look === 'face') {
    // Una luz de arriba a la izquierda, como la del cuarto, y un brillo que crece
    // con el acabado: la laca brilla, el mate no.
    const gloss = glossOf(finish)
    const g = ctx.createRadialGradient(size * 0.3, size * 0.24, 0, size * 0.5, size * 0.5, size * 0.78)
    g.addColorStop(0, rgba('#fff6e8', 0.12 + gloss * 0.3))
    g.addColorStop(0.45, rgba('#fff6e8', 0))
    g.addColorStop(1, rgba('#07070c', 0.3))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    return
  }

  // Mismo perfil que la moldura, corriendo de arriba abajo.
  const stops = shadeProfile(look, REST_LIGHT, glossOf(finish), profile ?? 'scoop')
  const g = ctx.createLinearGradient(0, 0, 0, size)
  for (const s of stops) {
    g.addColorStop(
      s.t,
      s.shade >= 0
        ? rgba('#fff6e8', Math.min(0.72, s.shade * 0.62))
        : rgba('#07070c', Math.min(0.82, -s.shade * 0.72)),
    )
  }
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
}
