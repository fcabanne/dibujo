/**
 * Las cuatro esquinas de la foto sobre la pantalla.
 *
 * El trípode casi nunca queda perfectamente perpendicular a la hoja: la cámara ve
 * el papel como un trapecio, no como un rectángulo. Mover el teléfono arregla el
 * encuadre pero no la inclinación, y ahí la foto derecha no calza nunca. Llevar
 * cada esquina de la foto a su marca en el papel sí: la foto se deforma con la
 * misma perspectiva que la cámara, y lo que queda encima coincide con lo de abajo.
 *
 * Las esquinas se guardan **en fracciones 0..1 de la pantalla**, no en píxeles:
 * así sobreviven a la barra del navegador que aparece y desaparece, y a abrir la
 * mesa otro día con la pantalla de otro alto.
 */

export interface Point {
  x: number
  y: number
}

/** Arriba-izquierda, arriba-derecha, abajo-derecha, abajo-izquierda. */
export type Quad = [Point, Point, Point, Point]

/**
 * Cuánto lugar se le deja a la foto encajada, en píxeles.
 *
 * Abajo va la barra de controles, y la foto no puede empezar debajo de ella: las
 * esquinas de abajo quedarían tapadas justo donde hay que agarrarlas. Además cada
 * esquina tiene su manija un poco afuera, así que alrededor hace falta aire. Y
 * pegada al borde, la foto caería justo donde la lente deforma.
 */
const INSET = { top: 64, side: 48, bottom: 150 }

/** La foto entera y centrada en el lugar libre, en fracciones de la pantalla. */
export function fitQuad(photo: { w: number; h: number }, stage: { w: number; h: number }): Quad {
  const room = {
    w: Math.max(1, stage.w - 2 * INSET.side),
    h: Math.max(1, stage.h - INSET.top - INSET.bottom),
  }
  const scale = Math.min(room.w / photo.w, room.h / photo.h)
  const w = (photo.w * scale) / stage.w
  const h = (photo.h * scale) / stage.h
  const left = (1 - w) / 2
  const top = (INSET.top + (room.h - photo.h * scale) / 2) / stage.h
  return [
    { x: left, y: top },
    { x: left + w, y: top },
    { x: left + w, y: top + h },
    { x: left, y: top + h },
  ]
}

/**
 * Una esquina que cruza a la del frente da vuelta la foto como un guante. Se
 * frena antes: mientras las cuatro vueltas giren para el mismo lado, la figura
 * sigue siendo una hoja vista en perspectiva.
 */
export function isConvex(quad: Quad): boolean {
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const a = quad[i]
    const b = quad[(i + 1) % 4]
    const c = quad[(i + 2) % 4]
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (Math.abs(cross) < 1e-9) return false
    const s = Math.sign(cross)
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return true
}

/**
 * El `matrix3d` que lleva la foto, de `w × h` píxeles, a las cuatro esquinas (en
 * píxeles de pantalla). Es la homografía de un rectángulo a un cuadrilátero
 * (Heckbert, 1989), con el origen de la transformación en `0 0`.
 *
 * Una perspectiva y no cuatro triángulos: con triángulos la foto se quiebra en la
 * diagonal y una recta que la cruza sale doblada, justo lo que no se puede calcar.
 */
export function perspective(w: number, h: number, quad: Quad): string {
  const [p0, p1, p2, p3] = quad
  const dx1 = p1.x - p2.x
  const dx2 = p3.x - p2.x
  const dx3 = p0.x - p1.x + p2.x - p3.x
  const dy1 = p1.y - p2.y
  const dy2 = p3.y - p2.y
  const dy3 = p0.y - p1.y + p2.y - p3.y

  let g = 0
  let k = 0
  if (dx3 !== 0 || dy3 !== 0) {
    const det = dx1 * dy2 - dx2 * dy1
    g = (dx3 * dy2 - dx2 * dy3) / det
    k = (dx1 * dy3 - dx3 * dy1) / det
  }
  const a = p1.x - p0.x + g * p1.x
  const b = p3.x - p0.x + k * p3.x
  const d = p1.y - p0.y + g * p1.y
  const e = p3.y - p0.y + k * p3.y

  // Por columnas, como lo pide CSS. Las dos primeras se dividen por el tamaño de
  // la foto: la cuenta de arriba va de un cuadrado de lado 1.
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, p0.x, p0.y, 0, 1]
  return `matrix3d(${m.join(',')})`
}
