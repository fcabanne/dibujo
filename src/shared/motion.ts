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

/**
 * Un resorte, en los términos en que se piensa uno: cuánto tarda en llegar
 * (`response`, en segundos, el período sin amortiguar) y cuánto rebota (`damping`:
 * 1 llega sin pasarse, 0,5 se pasa un poco y vuelve, menos de eso tiembla).
 */
export interface SpringParams {
  response: number
  damping: number
}

/** Un valor con inercia: dónde está y a qué velocidad va. */
export interface Spring {
  x: number
  v: number
}

/** El paso fijo de la integración. Con el más rígido de los resortes sigue estable. */
const SPRING_STEP = 1 / 240

/**
 * Lleva el resorte `dt` segundos hacia `target`. Se integra en pasos fijos y chicos:
 * un cuadro lento (hasta 64 ms) no puede volverlo inestable ni cambiar cómo se ve.
 */
export function stepSpring(s: Spring, target: number, p: SpringParams, dt: number): void {
  const k = Math.pow((2 * Math.PI) / p.response, 2)
  const c = (4 * Math.PI * p.damping) / p.response
  let left = dt
  while (left > 0) {
    const h = Math.min(SPRING_STEP, left)
    s.v += (-k * (s.x - target) - c * s.v) * h
    s.x += s.v * h
    left -= h
  }
}

/**
 * Si el resorte ya llegó: cerca y casi quieto. Ahí se lo deja exactamente en el
 * destino, para que no quede temblando un subpíxel para siempre.
 */
export function settleSpring(s: Spring, target: number, eps: number): boolean {
  if (Math.abs(s.x - target) < eps && Math.abs(s.v) < eps * 10) {
    s.x = target
    s.v = 0
    return true
  }
  return false
}

let reducedQuery: MediaQueryList | null = null

/**
 * Lo mismo que `prefersReducedMotion`, sin consultar al sistema en cada cuadro: la
 * consulta se arma una vez y lee su estado vivo.
 */
export function reducedMotionNow(): boolean {
  if (!reducedQuery) reducedQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null
  return reducedQuery?.matches ?? false
}
