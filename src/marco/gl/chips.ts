import { DEFAULT_STATE } from '../state/defaults'
import type { FrameFinish, FrameMaterial, FrameProfile } from '../types'
import { REST_POSE } from '../render/pose'
import type { ChipLook } from '../render/chip'
import { createObjectRenderer, type ObjectRenderer } from './renderer'

/**
 * Las muestras de moldura pintadas por el mismo 3D que el cuadro: un listón de arriba
 * visto de cerca, con la misma luz, la misma madera y el mismo cuarto reflejado. Si
 * la muestra y el marco se pintaran por caminos distintos, lo que se elige no sería lo
 * que se ve enmarcado.
 *
 * Un solo contexto para todas las muestras, en un lienzo que no está en la página:
 * los navegadores limitan cuántos contextos WebGL puede haber a la vez.
 */

/** Cuánto mide de ancho el pedazo de moldura que muestra cada muestra, en cm. */
const CHIP_CM = 2.5

let renderer: ObjectRenderer | null | undefined
let canvas: HTMLCanvasElement | null = null

export function paintGlChip(
  target: HTMLCanvasElement,
  size: number,
  color: string,
  material: FrameMaterial,
  finish: FrameFinish,
  profile: FrameProfile | undefined,
  /**
   * Qué se mira (ver `ChipLook` en `render/chip.ts`): el listón de arriba, el de
   * abajo, o el material de frente —un listón plano, para que el color se lea parejo—.
   */
  look: ChipLook = 'top',
): boolean {
  if (renderer === undefined) {
    canvas = document.createElement('canvas')
    renderer = createObjectRenderer(canvas)
  }
  if (!renderer || !canvas) return false

  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const pxPerCm = size / CHIP_CM
  // Un cuadro enorme del que solo entra en la muestra un listón —el de arriba o el de
  // abajo—: la banda de la moldura ocupa la muestra entera y las esquinas quedan lejos.
  const big = size * 9
  const below = look === 'bottom'
  // De frente se mira solo el material: la banda es más ancha que la muestra y la
  // muestra cae en su medio, lejos de los cantos.
  const face = look === 'face'
  const band = face ? size * 1.6 : size
  const outer = {
    x: (size - big) / 2,
    y: below ? size - big : face ? -size * 0.3 : 0,
    w: big,
    h: big,
  }
  const glass = { x: outer.x + band, y: outer.y + band, w: big - 2 * band, h: big - 2 * band }
  const shape = look === 'face' ? 'flat' : (profile ?? DEFAULT_STATE.frame.profile)
  const state = {
    ...DEFAULT_STATE,
    frame: { ...DEFAULT_STATE.frame, color, material, finish, profile: shape, width: CHIP_CM },
    glass: 'none' as const,
  }
  renderer.render({
    state,
    rects: { outer, glass, sight: glass, center: { x: outer.x + big / 2, y: outer.y + big / 2 } },
    pose: REST_POSE,
    pxPerCm,
    dpr,
    width: size,
    height: size,
    // El ojo, frente a la muestra: del centro del cuadro enorme hasta el listón.
    eye: { x: 0, y: ((below ? 1 : -1) * (big - size)) / 2 / pxPerCm, z: 150 },
    image: null,
    hasFrame: true,
    hasMat: false,
    depthCm: 1,
    wallCm: 1.5,
    standoffCm: 1,
    chip: true,
  })

  target.width = size * dpr
  target.height = size * dpr
  const ctx = target.getContext('2d')
  if (!ctx) return false
  ctx.clearRect(0, 0, target.width, target.height)
  ctx.drawImage(canvas, 0, 0, target.width, target.height)
  return true
}
