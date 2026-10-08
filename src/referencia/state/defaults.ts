import type { AppState, Effects, EffectsMode } from '../types'

/**
 * Qué valores fija cada modo. El de la perilla que el modo deja a la vista es el
 * punto de partida, no el final: se abre mostrando algo, para que se entienda qué
 * hace el botón antes de tocar nada.
 *
 * `bw` ya no es independiente del modo: Bordes y Facetado son monocromos siempre
 * —"siempre es blanco y negro" es parte de lo que son, no una casilla aparte— y
 * Blanco y negro es su propio modo, no un interruptor sobre los otros tres.
 */
export const EFFECT_MODES: Record<EffectsMode, Omit<Effects, 'mode'>> = {
  original: { bw: false, light: 0, contrast: 0, edges: 0, tones: 0 },
  bw: { bw: true, light: 0, contrast: 0, edges: 0, tones: 0 },
  // La luz arriba y el contraste abajo aplastan la foto a un gris parejo; encima de
  // ese gris, los bordes quedan como un dibujo de línea.
  edges: { bw: true, light: 100, contrast: -100, edges: 50, tones: 0 },
  facets: { bw: true, light: 0, contrast: 0, edges: 0, tones: 3 },
}

/** Los efectos en punto muerto: la foto tal cual vino. */
export const NEUTRAL_EFFECTS: Effects = {
  mode: 'original',
  ...EFFECT_MODES.original,
}

export const DEFAULT_STATE: AppState = {
  grid: {
    mode: 'none',
    count: 4,
    subdivide: false,
    style: {
      color: '#ffffff',
      opacity: 0.75,
      weight: 4,
    },
  },
  head: {
    mode: 'none',
    lens: null,
    style: { color: '#ffffff', opacity: 0.9, weight: 3 },
  },
  effects: NEUTRAL_EFFECTS,
  paper: { id: 'none', w: 21, h: 29.7 },
  export: { size: 'original', format: 'jpg', labels: false },
}
