/**
 * Modelo de luz de la escena. Deja de ser una constante de módulo: el puntero la
 * mueve, y de ahí sale el volumen. Todas las capas la reciben por parámetro, que es
 * lo que hace que el conjunto lea como un objeto bajo una misma luz y no como
 * recortes apilados.
 *
 * `x`/`y` apuntan HACIA la fuente en coordenadas de pantalla (y negativo es arriba),
 * así que la iluminación de una cara es el producto punto directo con su normal y la
 * sombra cae en la dirección opuesta. `z` es cuánto viene la luz desde el frente.
 */
export interface Light {
  x: number
  y: number
  z: number
}

/** Foco de galería: alto, a la izquierda y bastante frontal. */
const BASE: Light = { x: -0.46, y: -0.82, z: 0.34 }

/** Cuánto llega a desviar el puntero la dirección de la luz. */
const SWAY = 0.044

function normalize(l: Light): Light {
  const len = Math.hypot(l.x, l.y, l.z) || 1
  return { x: l.x / len, y: l.y / len, z: l.z / len }
}

/**
 * La luz según dónde está el puntero, en -1..1 sobre el lienzo. Mover el mouse a la
 * derecha corre la fuente hacia la derecha: los brillos barren el marco y el reflejo
 * del vidrio se desliza, que es lo que da la sensación volumétrica.
 */
export function lightFor(parallaxX: number, parallaxY: number): Light {
  return normalize({
    x: BASE.x + parallaxX * SWAY,
    y: BASE.y + parallaxY * SWAY * 0.5,
    z: BASE.z,
  })
}

export const REST_LIGHT = normalize(BASE)

export interface RGB {
  r: number
  g: number
  b: number
}

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  const n = parseInt(full, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function rgbToHex({ r, g, b }: RGB): string {
  const h = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

/** amount > 0 aclara hacia blanco, < 0 oscurece hacia negro. */
export function shade(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex)
  const target = amount > 0 ? 255 : 0
  const t = Math.abs(amount)
  return rgbToHex({
    r: r + (target - r) * t,
    g: g + (target - g) * t,
    b: b + (target - b) * t,
  })
}

export function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Luminancia percibida 0..1. Sirve para decidir contrastes contra la pared. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

export type Side = 'top' | 'right' | 'bottom' | 'left'

/** Normal saliente de cada lado de la moldura, en coordenadas de pantalla. */
export const SIDE_NORMAL: Record<Side, { x: number; y: number }> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
}

/**
 * Cuánta luz recibe un lado, -1..1. El lado superior mira hacia la fuente y es el
 * más claro; el inferior queda en sombra.
 */
export function sideIntensity(side: Side, light: Light): number {
  const n = SIDE_NORMAL[side]
  return n.x * light.x + n.y * light.y
}
