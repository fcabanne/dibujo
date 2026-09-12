import type { AppState } from '../types'
import { DEFAULT_STATE } from './defaults'
import { saveArtwork } from '../../shared/imageStore'

const KEY = 'cuadros:session:v1'

/**
 * Autoguardado de la sesión. No es una feature vistosa, pero es lo que hace que
 * probar combinaciones no cueste nada: recargás y seguís donde estabas.
 *
 * La imagen viaja por separado, en IndexedDB (ver `imageStore`). Acá queda solo la
 * configuración, que pesa unos pocos KB y por lo tanto nunca falla por cuota — que
 * es lo que rompía el guardado entero cuando la obra era una foto de cámara.
 */
export function loadSession(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as Partial<AppState>
    // Merge contra los defaults: una versión vieja guardada no debe romper la app.
    // La obra arranca en el placeholder y la reemplaza `artwork/restore` cuando
    // termina de leerse de IndexedDB, un instante después.
    return {
      ...DEFAULT_STATE,
      ...parsed,
      artwork: { ...DEFAULT_STATE.artwork, ...parsed.artwork, src: DEFAULT_STATE.artwork.src },
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
  const { src, ...artwork } = state.artwork

  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, artwork }))
  } catch {
    // Cuota llena o modo privado: preferimos perder el autoguardado antes que la sesión.
  }

  // Aparte y sin esperar: que la imagen no entre no puede arrastrar a la config.
  void saveArtwork('marco', src)
}
