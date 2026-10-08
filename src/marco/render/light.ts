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

function normalize(l: Light): Light {
  const len = Math.hypot(l.x, l.y, l.z) || 1
  return { x: l.x / len, y: l.y / len, z: l.z / len }
}

/**
 * La luz de la escena, quieta. El foco está atornillado al techo del cuarto: lo que
 * se mueve cuando uno se corre frente al cuadro es el ojo, no la fuente. Por eso el
 * puntero no la toca —antes la corría apenas, y lo difuso respiraba con el mouse—;
 * mueve el ojo (`eyeOf` en `pose.ts`), y con él los brillos, el reflejo del vidrio y
 * cuánto se ve de la pared detrás del cuadro.
 */
export const REST_LIGHT = normalize(BASE)

/**
 * Dónde está el foco, en px respecto del centro de un cuadro de `w`×`h`, con z
 * saliendo de la pared. Sobre la dirección de la luz y a una distancia que crece con
 * el cuadro: nadie ilumina un cuadro de un metro con un foco a medio metro.
 *
 * Lo usan la sombra y el brillo de la moldura. La dirección sola alcanza para casi
 * todo, pero no para lo que cambia de un punto del cuadro a otro: de qué lado se
 * estira la sombra, qué punta del listón brilla.
 */
export function spotPosition(light: Light, w: number, h: number, pxPerCm: number) {
  const reach = 150 * pxPerCm + 1.5 * Math.max(w, h)
  return { x: light.x * reach, y: light.y * reach, z: light.z * reach, reach }
}

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

/** Cuánto más saturada que la superficie es su sombra. */
const SHADOW_CHROMA = 1.4

/**
 * Lo que una superficie le agrega a la sombra que cae sobre ella, para multiplicar.
 *
 * Una sombra de verdad no es negro encima: es la misma superficie con menos luz, y
 * lo que queda es más saturado —la pared se ilumina con su propio rebote— y un poco
 * más frío, porque lo que se tapó es el foco cálido y lo que sigue llegando es la luz
 * de la habitación. Con negro semitransparente una pared crema salía gris sucio.
 *
 * Es el color de la superficie llevado a que su canal más alto valga uno y corrido
 * hacia el azul: multiplicado, no oscurece casi nada —de eso se ocupa la sombra
 * negra de siempre— y solo le devuelve el color.
 */
export function shadowTint(hex: string): string {
  const { r, g, b } = hexToRgb(hex)
  const c = [
    Math.pow(Math.max(r, 12) / 255, SHADOW_CHROMA) * 0.94,
    Math.pow(Math.max(g, 12) / 255, SHADOW_CHROMA) * 0.98,
    Math.pow(Math.max(b, 12) / 255, SHADOW_CHROMA) * 1.06,
  ]
  const top = Math.max(...c)
  return rgbToHex({ r: (c[0] / top) * 255, g: (c[1] / top) * 255, b: (c[2] / top) * 255 })
}

/** Un color multiplicado por `k`, canal por canal: más oscuro sin cambiar de tono. */
export function scaleHex(hex: string, k: number): string {
  const { r, g, b } = hexToRgb(hex)
  return rgbToHex({ r: r * k, g: g * k, b: b * k })
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
