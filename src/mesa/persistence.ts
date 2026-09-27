import type { Quad } from './corners'

const KEY = 'mesa:session:v1'

/** Mitad y mitad: se ve la foto y se ve el lápiz. */
export const DEFAULT_OPACITY = 0.5

export interface Session {
  opacity: number
  /** Dónde quedaron las esquinas. `null` es la foto encajada, sin tocar. */
  corners: Quad | null
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
  const fallback: Session = { opacity: DEFAULT_OPACITY, corners: null }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as { opacity?: unknown; corners?: unknown }
    const opacity =
      typeof parsed.opacity === 'number' && !Number.isNaN(parsed.opacity)
        ? Math.min(1, Math.max(0, parsed.opacity))
        : DEFAULT_OPACITY
    return { opacity, corners: isQuad(parsed.corners) ? parsed.corners : null }
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
