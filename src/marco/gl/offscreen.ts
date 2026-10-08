import { createObjectRenderer, type ObjectFrame } from './renderer'

/**
 * El 3D fuera de la pantalla: un solo renderer, en un lienzo que no está en la
 * página, para lo que hay que pintar aparte —las muestras de moldura y la foto que se
 * descarga—. Uno solo porque los navegadores limitan cuántos contextos WebGL puede
 * haber a la vez.
 *
 * `setGlActive` lo prende el lienzo cuando el cuadro se está viendo en 3D: si la
 * pantalla está en 2D (sin WebGL2, o con `?2d`), lo de afuera también, para que lo
 * que se elige y lo que se descarga sea lo que se ve.
 */

let active = false

export function setGlActive(on: boolean) {
  active = on
}

export function isGlActive(): boolean {
  return active
}

let renderer: ReturnType<typeof createObjectRenderer> | undefined
let canvas: HTMLCanvasElement | null = null

/** Pinta el cuadro en 3D y devuelve el lienzo, o `null` si no hay 3D. */
export function renderOffscreen(frame: ObjectFrame): HTMLCanvasElement | null {
  if (!active) return null
  if (renderer === undefined) {
    canvas = document.createElement('canvas')
    renderer = createObjectRenderer(canvas)
  }
  if (!renderer || !canvas) return null
  renderer.render(frame)
  return canvas
}
