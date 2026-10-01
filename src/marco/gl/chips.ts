import { DEFAULT_STATE } from '../state/defaults'
import type { FrameFinish, FrameMaterial, FrameProfile } from '../types'
import { REST_POSE } from '../render/pose'
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
): boolean {
  if (renderer === undefined) {
    canvas = document.createElement('canvas')
    renderer = createObjectRenderer(canvas)
  }
  if (!renderer || !canvas) return false

  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const pxPerCm = size / CHIP_CM
  // Un cuadro enorme del que solo entra en la muestra el listón de arriba: la banda
  // de la moldura ocupa la muestra entera y las esquinas quedan lejos.
  const big = size * 9
  const outer = { x: (size - big) / 2, y: 0, w: big, h: big }
  const glass = { x: outer.x + size, y: size, w: big - 2 * size, h: big - 2 * size }
  const state = {
    ...DEFAULT_STATE,
    frame: { ...DEFAULT_STATE.frame, color, material, finish, profile: profile ?? DEFAULT_STATE.frame.profile, width: CHIP_CM },
    glass: 'none' as const,
  }
  renderer.render({
    state,
    rects: { outer, glass, sight: glass, center: { x: outer.x + big / 2, y: big / 2 } },
    pose: REST_POSE,
    pxPerCm,
    dpr,
    width: size,
    height: size,
    eye: { x: 0, y: -big / 2 / pxPerCm, z: 150 },
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
