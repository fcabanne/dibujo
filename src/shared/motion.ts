/**
 * Movimiento hecho a mano, para lo que CSS no alcanza: valores que viven en
 * JavaScript —el zoom de un lienzo, una opacidad que se pinta en un canvas—
 * y que igual tienen que llegar a destino con la misma curva que el resto.
 */

/** Si el sistema pidió menos movimiento. Se pregunta cada vez: puede cambiar en vivo. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** La `--ds-ease` de los tokens, en número: arranca rápido y se asienta. */
export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Lleva `t` de 0 a 1 en `duration` milisegundos y llama a `onFrame` en cada
 * cuadro. Devuelve con qué cortarlo a mitad de camino.
 *
 * Con movimiento reducido salta directo al final: el estado que se pide
 * llega igual, solo que sin el recorrido.
 */
export function tween(
  duration: number,
  onFrame: (t: number) => void,
  onDone?: () => void,
): () => void {
  if (prefersReducedMotion() || duration <= 0) {
    onFrame(1)
    onDone?.()
    return () => {}
  }

  let frame = 0
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration)
    onFrame(easeOut(t))
    if (t < 1) frame = requestAnimationFrame(step)
    else onDone?.()
  }
  frame = requestAnimationFrame(step)
  return () => cancelAnimationFrame(frame)
}
