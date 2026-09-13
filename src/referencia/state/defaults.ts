import type { AppState, Effects, EffectsMode } from '../types'

/**
 * Qué valores fija cada modo. El de la perilla que el modo deja a la vista es el
 * punto de partida, no el final: se abre mostrando algo, para que se entienda qué
 * hace el botón antes de tocar nada.
 *
 * `bw` queda afuera a propósito: es independiente del modo y sobrevive al cambio.
 */
export const EFFECT_MODES: Record<EffectsMode, Omit<Effects, 'mode' | 'bw'>> = {
  original: { light: 0, contrast: 0, edges: 0, tones: 0 },
  // La luz arriba y el contraste abajo aplastan la foto a un gris parejo; encima de
  // ese gris, los bordes quedan como un dibujo de línea.
  edges: { light: 100, contrast: -100, edges: 50, tones: 0 },
  facets: { light: 0, contrast: 0, edges: 0, tones: 3 },
}

/** Los efectos en punto muerto: la foto tal cual vino. */
export const NEUTRAL_EFFECTS: Effects = {
  mode: 'original',
  bw: false,
  ...EFFECT_MODES.original,
}

export const DEFAULT_STATE: AppState = {
  grid: {
    mode: 'proportional',
    count: 8,
    subdivide: false,
    style: {
      color: '#ffffff',
      opacity: 0.75,
      weight: 2,
      labels: false,
    },
  },
  effects: NEUTRAL_EFFECTS,
  paper: { id: 'none', w: 21, h: 29.7 },
  export: { size: 'original', format: 'jpg' },
}
