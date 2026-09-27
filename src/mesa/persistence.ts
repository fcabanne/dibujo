import type { Quad } from './corners'

const KEY = 'mesa:session:v1'

/** Mitad y mitad: se ve la foto y se ve el lápiz. */
export const DEFAULT_OPACITY = 0.5

export interface Session {
  opacity: number
  /** Dónde quedaron las esquinas. `null` es la foto encajada, sin tocar. */
  corners: Quad | null
  /**
   * De qué foto son esas esquinas (ver `photoKey`). La foto puede cambiar sin pasar
   * por la mesa —Referencia la manda directo—, y las esquinas de otra foto, con
   * otra proporción, la deformarían.
   */
  photo: string | null
}

/**
 * Acá van un número y cuatro puntos. La foto se guarda aparte, en IndexedDB (ver
 * `shared/imageStore`): en localStorage una foto de cámara revienta la cuota y se
 * pierde todo, no solo la foto.
 *
 * Las esquinas se guardan porque el trípode no se mueve de un día para el otro:
 * volver a la mesa y tener que calzar la foto de nuevo sería rehacer lo que ya
 * estaba hecho.
 */
export function loadSession(): Session {
  const fallback: Session = { opacity: DEFAULT_OPACITY, corners: null, photo: null }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as { opacity?: unknown; corners?: unknown; photo?: unknown }
    const opacity =
      typeof parsed.opacity === 'number' && !Number.isNaN(parsed.opacity)
        ? Math.min(1, Math.max(0, parsed.opacity))
        : DEFAULT_OPACITY
    return {
      opacity,
      corners: isQuad(parsed.corners) ? parsed.corners : null,
      photo: typeof parsed.photo === 'string' ? parsed.photo : null,
    }
  } catch {
    return fallback
  }
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // Modo privado o cuota llena: se pierde el autoguardado, no la sesión.
  }
}

/**
 * Una huella de la foto, para saber si es la misma sin guardarla dos veces: el
 * largo y unos pedacitos repartidos por todo el data URI. El final solo no alcanza
 * —todos los JPEG terminan parecido—, pero ocho muestras de adentro sí. Y si dos
 * fotos coincidieran igual, lo peor que pasa es que queden las esquinas de antes.
 */
export function photoKey(src: string): string {
  const samples = Array.from({ length: 8 }, (_, i) => {
    const at = Math.floor(((i + 1) * src.length) / 9)
    return src.slice(at, at + 4)
  })
  return `${src.length}:${samples.join('')}`
}

function isQuad(value: unknown): value is Quad {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every(
      (p) =>
        typeof p === 'object' &&
        p !== null &&
        Number.isFinite((p as { x: unknown }).x) &&
        Number.isFinite((p as { y: unknown }).y),
    )
  )
}
