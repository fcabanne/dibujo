import { SIDE_NORMAL, type Light, type Side } from './light'
import type { FrameProfile } from '../types'

/**
 * Sección transversal de la moldura.
 *
 * Cada perfil describe la altura del frente a lo ancho de la banda, del canto
 * exterior (t = 0) al interior (t = 1). El sombreado sale de iluminar la normal de
 * esa curva en cada punto, así que cambiar de perfil cambia de verdad cómo cae la
 * luz sobre el marco, no solo un degradé.
 */

/** Interpolación suave entre dos umbrales: 0 antes de `a`, 1 después de `b`. */
function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Los perfiles se arman sumando tramos suaves en vez de encadenar segmentos: con
 * quiebres de pendiente el sombreado muestra una banda dura donde termina un tramo
 * y empieza el otro, que es justo el artefacto que delata un degradé.
 */
const SHAPES: Record<FrameProfile, (t: number) => number> = {
  // Plana: cara recta con los cantos apenas matados.
  flat: (t) => 0.94 + 0.06 * smoothstep(0, 0.08, t) - 0.14 * smoothstep(0.88, 1, t),

  // Biselada: cae en rampa recta desde el canto exterior hasta el rebaje.
  bevel: (t) => 1 - 0.62 * smoothstep(0.05, 0.95, t),

  // Caveta: cóncava, la clásica de marco de cuadro.
  scoop: (t) =>
    0.72 + 0.28 * smoothstep(0, 0.08, t) - 0.5 * smoothstep(0.22, 0.88, t) -
    0.16 * smoothstep(0.84, 1, t),

  // Bombé: convexa, panza hacia afuera.
  round: (t) => 0.52 + 0.48 * Math.sin(Math.PI * Math.min(1, Math.max(0, t * 0.92 + 0.04))),

  // Escalonada: dos planos separados por un escalón.
  step: (t) => 1 - 0.3 * smoothstep(0.3, 0.42, t) - 0.34 * smoothstep(0.72, 0.84, t),
}

/** Cuánto relieve tiene la moldura respecto de su ancho. Gobierna el contraste. */
const RELIEF = 1.35

const SAMPLES = 26

export interface ProfileStop {
  t: number
  /** -1..1: cuánto se aparta del valor base del material. */
  shade: number
  /** 0..1: reflejo especular en ese punto. */
  spec: number
}

/** Qué tan concentrado es el reflejo: más alto, más chico y más intenso. */
const SPEC_EXP = 26

type Normal = { x: number; y: number; z: number }

const normalsCache = new Map<string, Normal[]>()

/**
 * La normal de la superficie en cada punto de la sección, para un lado. Se inclina
 * según la pendiente del perfil: la componente en pantalla apunta según la
 * pendiente y la z es lo que mira al observador.
 */
function sectionNormals(side: Side, profile: FrameProfile): Normal[] {
  const key = side + profile
  const cached = normalsCache.get(key)
  if (cached) return cached

  const height = SHAPES[profile] ?? SHAPES.scoop
  const n = SIDE_NORMAL[side]
  const normals: Normal[] = []
  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1)
    const d = 0.02
    const slope = (height(Math.min(1, t + d)) - height(Math.max(0, t - d))) / (2 * d)
    const s = slope * RELIEF
    const len = Math.hypot(n.x * s, n.y * s, 1) || 1
    normals.push({ x: (n.x * s) / len, y: (n.y * s) / len, z: 1 / len })
  }
  normalsCache.set(key, normals)
  return normals
}

/**
 * Ilumina el perfil para un lado concreto. La normal se inclina según la pendiente
 * de la sección en cada punto, y de ahí sale el difuso y el especular.
 */
export function shadeProfile(
  side: Side,
  light: Light,
  gloss: number,
  profile: FrameProfile,
): ProfileStop[] {
  // Vector intermedio entre la luz y el observador, para el especular.
  const hx = light.x
  const hy = light.y
  const hz = light.z + 1
  const hLen = Math.hypot(hx, hy, hz) || 1

  return sectionNormals(side, profile).map((nrm, i) => {
    const diffuse = nrm.x * light.x + nrm.y * light.y + nrm.z * light.z
    const specDot = Math.max(0, (nrm.x * hx + nrm.y * hy + nrm.z * hz) / hLen)
    return {
      t: i / (SAMPLES - 1),
      shade: Math.max(-1, Math.min(1, (diffuse - 0.42) * 1.9)),
      spec: Math.pow(specDot, SPEC_EXP) * gloss,
    }
  })
}

/**
 * El reflejo más fuerte que da la sección de un lado para un vector intermedio `h`
 * (normalizado, z hacia el observador), sin el acabado. Es lo que dice cuánto brilla
 * un punto del listón cuando la luz y el ojo ya no están en el infinito: ver
 * `drawGlint` en `frame.ts`.
 */
export function specPeak(side: Side, profile: FrameProfile, h: Normal): number {
  let best = 0
  for (const n of sectionNormals(side, profile)) {
    best = Math.max(best, n.x * h.x + n.y * h.y + n.z * h.z)
  }
  return Math.pow(best, SPEC_EXP)
}

/** Cuán marcado es el reflejo según el acabado. */
export function glossOf(finish: string): number {
  if (finish === 'gloss') return 1
  if (finish === 'satin') return 0.5
  if (finish === 'grained') return 0.28
  return 0.16
}

/**
 * La altura del frente de la moldura en `t` (0 canto exterior, 1 interior), de 0 a 1.
 * La usa el render 3D para levantar el perfil como una pieza de verdad.
 */
export function profileHeight(profile: FrameProfile, t: number): number {
  return SHAPES[profile](Math.min(1, Math.max(0, t)))
}
