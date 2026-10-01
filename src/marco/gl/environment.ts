/**
 * El cuarto que se refleja en el vidrio y en las molduras: un estudio inventado,
 * horneado una vez en una imagen equirectangular.
 *
 * Un vidrio plano a metro y medio refleja un pedacito del cuarto —lo que queda detrás
 * de quien mira, unos veinte grados para cada lado—, así que lo que importa está ahí:
 * la silueta del que mira en el medio, una ventana con sus parantes a un lado, una
 * caja de luz al otro y un riel de focos arriba. Correr la cabeza corre el reflejo,
 * y lo que pasa por el vidrio son esas cosas, no un degradé.
 *
 * Cada píxel guarda dos cosas aparte:
 * - en `a`, cuánto se ve ahí de la pared del cuarto —que se pinta en el shader con el
 *   color de la pared elegida, así que cambiarla no pide hornear otra vez—;
 * - en `rgb`, la luz que emite (ventana, caja, focos), comprimida con una raíz para
 *   que entre en ocho bits: se decodifica como `rgb² · EMIT_MAX`.
 *
 * La dirección se lee como en el shader (`envUV`): u = 0,5 es el frente, hacia donde
 * está el que mira; v = 0 es el techo.
 */

export const ENV_W = 512
export const ENV_H = 256
/** El brillo máximo que se puede guardar, en veces el blanco de la pared. */
export const EMIT_MAX = 8

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** 1 adentro de un rectángulo en (phi, theta), con el borde suavizado `soft`. */
function box(phi: number, th: number, p0: number, p1: number, t0: number, t1: number, soft: number): number {
  return smooth(p0 - soft, p0 + soft, phi) * (1 - smooth(p1 - soft, p1 + soft, phi)) *
    smooth(t0 - soft, t0 + soft, th) * (1 - smooth(t1 - soft, t1 + soft, th))
}

let baked: Uint8Array | null = null

export function studioEnvironment(): Uint8Array {
  if (baked) return baked
  const data = new Uint8Array(ENV_W * ENV_H * 4)
  let i = 0
  for (let y = 0; y < ENV_H; y++) {
    // theta: positivo arriba, de +90° a -90°.
    const th = (0.5 - (y + 0.5) / ENV_H) * Math.PI
    for (let x = 0; x < ENV_W; x++, i += 4) {
      // phi: 0 de frente (detrás del que mira), positivo a la derecha de la pantalla.
      const phi = ((x + 0.5) / ENV_W - 0.5) * 2 * Math.PI

      // La pared del cuarto: más clara a la altura de los ojos, el piso en penumbra,
      // el techo apenas más oscuro que las paredes.
      let room = 0.62 + 0.12 * smooth(-0.2, 0.3, th) - 0.2 * smooth(0.55, 1.1, th)
      room *= 1 - 0.6 * smooth(-0.12, -0.45, th)
      let r = 0
      let g = 0
      let b = 0

      // La ventana, a la izquierda: cielo claro, más luminoso arriba, con un parante
      // al medio y un travesaño. Los parantes no emiten: son madera contra el cielo.
      const win = box(phi, th, -0.36, -0.12, -0.1, 0.26, 0.01)
      if (win > 0) {
        const mullion =
          1 - (1 - smooth(0.009, 0.004, Math.abs(phi + 0.24))) * (1 - smooth(0.009, 0.004, Math.abs(th - 0.1)))
        const sky = (2.6 + 1.2 * smooth(-0.1, 0.26, th)) * win * (1 - mullion)
        r += sky * 0.86
        g += sky * 0.93
        b += sky * 1.0
        room *= 1 - 0.7 * win * mullion
      }

      // La caja de luz, a la derecha: pareja, cálida apenas, con el borde blando de la tela.
      const soft = box(phi, th, 0.11, 0.3, 0.0, 0.24, 0.015)
      if (soft > 0) {
        const s = 3.6 * soft * (0.9 + 0.1 * smooth(0.24, 0.0, th))
        r += s
        g += s * 0.97
        b += s * 0.92
      }

      // Otra más chica y más lejos, para que el metal tenga algo que agarrar de costado.
      const far = box(phi, th, 0.95, 1.25, 0.1, 0.42, 0.03)
      if (far > 0) {
        r += 2.4 * far
        g += 2.3 * far
        b += 2.2 * far
      }

      // El riel del techo: una línea oscura con focos chiquitos cada tanto.
      const rail = Math.exp(-Math.pow((th - 0.36) / 0.006, 2))
      room *= 1 - 0.5 * rail
      const k = phi / 0.16
      const spot = Math.exp(-(Math.pow((k - Math.round(k)) * 0.16 / 0.01, 2) + Math.pow((th - 0.35) / 0.01, 2)))
      if (spot > 0.001) {
        r += 7 * spot
        g += 6.6 * spot
        b += 5.6 * spot
      }

      // El que mira: una silueta oscura y blanda, justo detrás del ojo. Cabeza y hombros.
      const head = Math.hypot(phi / 0.07, (th + 0.01) / 0.085)
      const torso = box(phi, th, -0.16, 0.16, -0.8, -0.09, 0.03)
      const viewer = Math.max(1 - smooth(0.8, 1.15, head), torso)
      room *= 1 - 0.72 * viewer
      r *= 1 - viewer
      g *= 1 - viewer
      b *= 1 - viewer

      const enc = (v: number) => Math.round(Math.sqrt(Math.min(1, v / EMIT_MAX)) * 255)
      data[i] = enc(r)
      data[i + 1] = enc(g)
      data[i + 2] = enc(b)
      data[i + 3] = Math.round(Math.min(1, Math.max(0, room)) * 255)
    }
  }
  baked = data
  return data
}
