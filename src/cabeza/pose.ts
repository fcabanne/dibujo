import { CANONICAL } from './canonical'

/**
 * Dónde está la cabeza respecto de la cámara, y con qué lente se sacó la foto.
 *
 * El detector da 468 puntos en la foto. La cara canónica (`canonical.ts`) da los
 * mismos 468 en centímetros. La pose es la rotación y la posición que, proyectando
 * la cara canónica con una lente dada, mejor caen sobre los puntos de la foto.
 *
 * Convención de cámara la de la foto: x a la derecha, y hacia abajo, z hacia
 * adentro. Un punto de la cabeza `P` cae en `R·P + t`, y en la foto en
 * `(cx + f·x/z, cy + f·y/z)`, con `f` en píxeles.
 */

export type Vec3 = [number, number, number]
/** Rotación 3×3, por filas. */
export type Mat3 = number[]

export interface Pose {
  R: Mat3
  t: Vec3
}

export interface Camera {
  /** Distancia focal en píxeles de la foto. */
  f: number
  cx: number
  cy: number
}

/** Los puntos de una cara en la foto, en píxeles: x0, y0, x1, y1… (468 pares). */
export type Landmarks = Float64Array

/** Lo que mide la diagonal de un negativo de 35 mm. */
const FULL_FRAME_DIAGONAL = 43.267

/** La focal equivalente a 35 mm, en píxeles de una foto de ese tamaño. */
export function focalPx(mm: number, width: number, height: number): number {
  return (mm / FULL_FRAME_DIAGONAL) * Math.hypot(width, height)
}

export function project(cam: Camera, pose: Pose, p: Vec3): [number, number, number] {
  const [x, y, z] = transform(pose, p)
  return [cam.cx + (cam.f * x) / z, cam.cy + (cam.f * y) / z, z]
}

export function transform({ R, t }: Pose, [x, y, z]: Vec3): Vec3 {
  return [
    R[0] * x + R[1] * y + R[2] * z + t[0],
    R[3] * x + R[4] * y + R[5] * z + t[1],
    R[6] * x + R[7] * y + R[8] * z + t[2],
  ]
}

/** Dónde está la cámara vista desde la cabeza: `−Rᵀ·t`. */
export function cameraInHead({ R, t }: Pose): Vec3 {
  return [
    -(R[0] * t[0] + R[3] * t[1] + R[6] * t[2]),
    -(R[1] * t[0] + R[4] * t[1] + R[7] * t[2]),
    -(R[2] * t[0] + R[5] * t[1] + R[8] * t[2]),
  ]
}

/**
 * La pose que da MediaPipe, pasada a nuestra convención.
 *
 * MediaPipe la calcula con su propia cámara —la de OpenGL: mira hacia −z, y hacia
 * arriba— y una lente fija de 63° de vertical. Sirve como punto de partida; la
 * pose de verdad la ajusta `solvePose` con la lente que corresponda.
 *
 * La matriz viene por columnas (como la espera OpenGL).
 */
export function fromMediaPipe(m: ArrayLike<number>): Pose {
  // Pasar de OpenGL a la foto es dar vuelta y y z: diag(1, −1, −1) por izquierda.
  const R = [m[0], m[4], m[8], -m[1], -m[5], -m[9], -m[2], -m[6], -m[10]]
  return { R, t: [m[12], -m[13], -m[14]] }
}

/** La lente vertical que asume MediaPipe para su pose. */
export const MEDIAPIPE_VFOV = (63 * Math.PI) / 180

/**
 * Ajusta la pose para una lente dada: Gauss-Newton sobre los seis grados de
 * libertad, minimizando la distancia en píxeles entre la cara canónica proyectada
 * y los puntos de la foto. Arranca de `start`, que tiene que estar cerca.
 *
 * Devuelve el error medio en píxeles, que es lo que compara `fitLens`.
 */
export function solvePose(
  points: Landmarks,
  cam: Camera,
  start: Pose,
  iterations = 12,
): { pose: Pose; error: number } {
  let R = start.R.slice()
  let t: Vec3 = [...start.t]
  const n = CANONICAL.length / 3
  let error = Infinity

  for (let it = 0; it < iterations; it++) {
    // JᵀJ (6×6) y Jᵀr: el sistema normal, armado punto por punto.
    const A = new Float64Array(36)
    const b = new Float64Array(6)
    let sum = 0

    for (let i = 0; i < n; i++) {
      const px = CANONICAL[i * 3]
      const py = CANONICAL[i * 3 + 1]
      const pz = CANONICAL[i * 3 + 2]
      // q = R·P, y la cámara ve c = q + t.
      const qx = R[0] * px + R[1] * py + R[2] * pz
      const qy = R[3] * px + R[4] * py + R[5] * pz
      const qz = R[6] * px + R[7] * py + R[8] * pz
      const x = qx + t[0]
      const y = qy + t[1]
      const z = qz + t[2]
      if (z <= 1e-3) continue

      const iz = 1 / z
      const ru = cam.cx + cam.f * x * iz - points[i * 2]
      const rv = cam.cy + cam.f * y * iz - points[i * 2 + 1]
      sum += ru * ru + rv * rv

      // d(u,v)/dc, y dc/d(ω, t) = [−[q]×  I]: una rotación chica ω mueve q a q + ω×q.
      const fu = cam.f * iz
      const du = [fu, 0, -fu * x * iz]
      const dv = [0, fu, -fu * y * iz]
      const ju = [
        du[1] * -qz + du[2] * qy,
        du[0] * qz + du[2] * -qx,
        du[0] * -qy + du[1] * qx,
        du[0],
        du[1],
        du[2],
      ]
      const jv = [
        dv[1] * -qz + dv[2] * qy,
        dv[0] * qz + dv[2] * -qx,
        dv[0] * -qy + dv[1] * qx,
        dv[0],
        dv[1],
        dv[2],
      ]
      for (let r = 0; r < 6; r++) {
        b[r] += ju[r] * ru + jv[r] * rv
        for (let c = 0; c < 6; c++) A[r * 6 + c] += ju[r] * ju[c] + jv[r] * jv[c]
      }
    }

    error = Math.sqrt(sum / n)
    // Un poco de amortiguación (Levenberg): sin ella, de lejos, z se dispara.
    for (let r = 0; r < 6; r++) A[r * 7] *= 1.001
    const step = solve6(A, b)
    if (!step) break

    const w: Vec3 = [-step[0], -step[1], -step[2]]
    R = multiply(rodrigues(w), R)
    t = [t[0] - step[3], t[1] - step[4], t[2] - step[5]]
    if (Math.hypot(...step) < 1e-6) break
  }

  return { pose: { R, t }, error }
}

/** El punto de partida para otra lente: misma rotación, y la cara del mismo tamaño. */
export function rescale(pose: Pose, from: number, to: number): Pose {
  // Alejarse en la misma proporción que crece la focal deja la cara del mismo
  // tamaño en la foto; x e y no cambian para que siga en el mismo lugar.
  return { R: pose.R, t: [pose.t[0], pose.t[1], (pose.t[2] * to) / from] }
}

export const LENS_MIN = 14
export const LENS_MAX = 200

/**
 * La lente que mejor explica la foto: se prueban focales de gran angular a tele, y
 * gana la que deja menos error. Funciona en una foto de cerca, donde la nariz crece
 * y las orejas se esconden; de lejos todas dan casi igual, y ahí da lo mismo,
 * porque la perspectiva tampoco se nota.
 */
export function fitLens(faces: { points: Landmarks; start: Pose }[], cam: Camera, width: number, height: number): number {
  const startF = (height / 2) / Math.tan(MEDIAPIPE_VFOV / 2)
  let best = { mm: 50, error: Infinity }
  const steps = 32
  for (let s = 0; s <= steps; s++) {
    const mm = LENS_MIN * Math.pow(LENS_MAX / LENS_MIN, s / steps)
    const f = focalPx(mm, width, height)
    let error = 0
    for (const face of faces) {
      error += solvePose(face.points, { ...cam, f }, rescale(face.start, startF, f), 8).error
    }
    if (error < best.error) best = { mm, error }
  }
  return best.mm
}

/** Rotación de un vector eje-ángulo. */
function rodrigues([x, y, z]: Vec3): Mat3 {
  const a = Math.hypot(x, y, z)
  if (a < 1e-12) return [1, 0, 0, 0, 1, 0, 0, 0, 1]
  const kx = x / a
  const ky = y / a
  const kz = z / a
  const c = Math.cos(a)
  const s = Math.sin(a)
  const v = 1 - c
  return [
    c + kx * kx * v, kx * ky * v - kz * s, kx * kz * v + ky * s,
    ky * kx * v + kz * s, c + ky * ky * v, ky * kz * v - kx * s,
    kz * kx * v - ky * s, kz * ky * v + kx * s, c + kz * kz * v,
  ]
}

function multiply(a: Mat3, b: Mat3): Mat3 {
  const out = new Array<number>(9)
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]
  return out
}

/** Eliminación gaussiana con pivoteo para el sistema de 6×6. */
function solve6(A: Float64Array, b: Float64Array): number[] | null {
  const m = Array.from({ length: 6 }, (_, r) => [...A.slice(r * 6, r * 6 + 6), b[r]])
  for (let c = 0; c < 6; c++) {
    let p = c
    for (let r = c + 1; r < 6; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r
    if (Math.abs(m[p][c]) < 1e-12) return null
    ;[m[c], m[p]] = [m[p], m[c]]
    for (let r = c + 1; r < 6; r++) {
      const k = m[r][c] / m[c][c]
      for (let k2 = c; k2 < 7; k2++) m[r][k2] -= k * m[c][k2]
    }
  }
  const x = new Array<number>(6).fill(0)
  for (let r = 5; r >= 0; r--) {
    let s = m[r][6]
    for (let c = r + 1; c < 6; c++) s -= m[r][c] * x[c]
    x[r] = s / m[r][r]
  }
  return x
}
