import type { AppState } from '../types'
import { DEFAULT_STATE } from './defaults'

const KEY = 'referencia:session:v1'

/**
 * La herramienta se llamaba "grilla". Se lee una vez, se copia a la clave nueva y no
 * se la busca más ahí: renombrar no tiene por qué costarle la sesión a nadie.
 * Borrable cuando ya no queden navegadores con la clave vieja.
 */
const RENAMED_KEY = 'grilla:session:v1'

/**
 * Acá va solo la configuración, que son unos pocos cientos de bytes. La foto se
 * guarda aparte, en IndexedDB (ver `shared/imageStore`), porque cuando iban juntas
 * en localStorage una foto pesada reventaba la cuota y se perdía todo, no solo la
 * foto.
 */
export function loadSession(): AppState {
  try {
    const raw = localStorage.getItem(KEY) ?? adoptRenamed()
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as Partial<AppState>
    // La grilla tuvo un modo "ninguna" hasta que el diseño lo sacó: ahora la
    // grilla se saca bajándole la opacidad. Una sesión guardada con ese modo se
    // traduce a lo que significaba, para que al abrir se vea lo mismo que se
    // dejó y no aparezca una grilla que nadie pidió.
    const hadNoGrid = (parsed.grid?.mode as string | undefined) === 'none'

    // Merge contra los defaults: una versión vieja guardada no debe romper la app.
    return {
      grid: {
        ...DEFAULT_STATE.grid,
        ...parsed.grid,
        mode: hadNoGrid ? DEFAULT_STATE.grid.mode : parsed.grid?.mode ?? DEFAULT_STATE.grid.mode,
        style: {
          ...DEFAULT_STATE.grid.style,
          ...parsed.grid?.style,
          ...(hadNoGrid ? { opacity: 0 } : null),
          // El espesor cambió de escala entre versiones. Sin redondear, una sesión
          // vieja dibujaría 1,4 mientras el slider marca 1: el control diciendo una
          // cosa y el lienzo otra.
          weight: Math.min(6, Math.max(1, Math.round(parsed.grid?.style?.weight ?? DEFAULT_STATE.grid.style.weight))),
        },
      },
      effects: { ...DEFAULT_STATE.effects, ...parsed.effects },
      paper: { ...DEFAULT_STATE.paper, ...parsed.paper },
      export: { ...DEFAULT_STATE.export, ...parsed.export },
    }
  } catch {
    return DEFAULT_STATE
  }
}

function adoptRenamed(): string | null {
  const raw = localStorage.getItem(RENAMED_KEY)
  if (!raw) return null
  localStorage.setItem(KEY, raw)
  localStorage.removeItem(RENAMED_KEY)
  return raw
}

export function saveSession(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Modo privado o cuota llena: se pierde el autoguardado, no la sesión.
  }
}
