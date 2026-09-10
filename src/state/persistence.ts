import type { AppState } from '../types'
import { DEFAULT_STATE } from './defaults'

const KEY = 'cuadros:session:v1'

/**
 * Autoguardado de la sesión. No es una feature vistosa, pero es lo que hace que
 * probar combinaciones no cueste nada: recargás y seguís donde estabas.
 */
export function loadSession(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as Partial<AppState>
    // Merge contra los defaults: una versión vieja guardada no debe romper la app.
    return {
      ...DEFAULT_STATE,
      ...parsed,
      artwork: { ...DEFAULT_STATE.artwork, ...parsed.artwork },
      frame: { ...DEFAULT_STATE.frame, ...parsed.frame },
      mats: parsed.mats?.length ? parsed.mats : DEFAULT_STATE.mats,
      wall: { ...DEFAULT_STATE.wall, ...parsed.wall },
      snapshots: parsed.snapshots ?? [],
    }
  } catch {
    return DEFAULT_STATE
  }
}

export function saveSession(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Cuota llena o modo privado: preferimos perder el autoguardado antes que la sesión.
  }
}
