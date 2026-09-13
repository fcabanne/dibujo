const KEY = 'mesa:session:v1'

/** Mitad y mitad: se ve la foto y se ve el lápiz. */
export const DEFAULT_OPACITY = 0.5

/**
 * Acá va un solo número. La foto se guarda aparte, en IndexedDB (ver
 * `shared/imageStore`): en localStorage una foto de cámara revienta la cuota y se
 * pierde todo, no solo la foto.
 */
export function loadOpacity(): number {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_OPACITY
    const parsed = JSON.parse(raw) as { opacity?: number }
    if (typeof parsed.opacity !== 'number' || Number.isNaN(parsed.opacity)) return DEFAULT_OPACITY
    return Math.min(1, Math.max(0, parsed.opacity))
  } catch {
    return DEFAULT_OPACITY
  }
}

export function saveOpacity(opacity: number): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ opacity }))
  } catch {
    // Modo privado o cuota llena: se pierde el autoguardado, no la sesión.
  }
}
