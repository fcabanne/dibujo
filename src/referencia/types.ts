/** Cómo se reparte la grilla sobre la foto. */
export type GridMode = 'none' | 'proportional' | 'square'

export interface GridStyle {
  color: string
  /** 0..1 */
  opacity: number
  /**
   * Grosor relativo, no en píxeles: 1 equivale a una línea de 1 px sobre una foto
   * de 1200 px de ancho. Guardarlo relativo es lo que hace que la línea que ves en
   * pantalla sea la misma que sale en un export de 6000 px.
   */
  weight: number
  /** Letras en las columnas y números en las filas. */
  labels: boolean
}

export interface GridState {
  mode: GridMode
  /**
   * Cuántas partes a lo ancho. **Una sola para los dos modos**: cambiar de
   * proporcional a cuadrada con el mismo número muestra en qué se diferencian, que
   * es la comparación que uno quiere hacer. Con un número por modo, cada cambio
   * traía además un salto de tamaño y no se veía nada.
   */
  count: number
  /**
   * Una segunda grilla más fina encima, partiendo cada casilla al medio. Sin ajustes
   * propios: sale siempre a mitad de espesor y mitad de opacidad, para que se lea
   * como ayuda y no compita con la principal.
   */
  subdivide: boolean
  style: GridStyle
}

/**
 * Qué se le está haciendo a la foto. Son tres caminos cerrados y no cinco perillas
 * sueltas: las perillas sueltas son honestas pero exigen saber qué hace cada una, y
 * lo que uno quiere acá es elegir cómo mirar la referencia, no revelarla a mano.
 *
 * Cada modo fija los valores que no le importan y deja a la vista solo los que sí.
 */
export type EffectsMode = 'original' | 'edges' | 'facets'

/**
 * Los efectos, todos en unidades de persona y no de shader: el shader traduce.
 *
 * El modo manda sobre estos valores, salvo `bw`, que es independiente: pasar a
 * blanco y negro no tiene que ver con qué se le está haciendo a la foto.
 */
export interface Effects {
  mode: EffectsMode
  bw: boolean
  /** -100..100 */
  light: number
  /** -100..100 */
  contrast: number
  /** 0..100 */
  edges: number
  /** 0 = apagado; si no, a cuántos tonos se aplasta la foto. */
  tones: number
}

export type PaperId = 'none' | 'a5' | 'a4' | 'a3' | 'a2' | 'custom'

/**
 * El tamaño que va a tener el dibujo terminado. Opcional: sin él la grilla anda
 * igual, solo que no puede decir cuánto mide una casilla en centímetros.
 *
 * Los presets se guardan con el lado corto primero y se orientan solos según la foto
 * (ver `paperSize`). Los de "a medida" se respetan tal como se escriben.
 */
export interface Paper {
  id: PaperId
  w: number
  h: number
}

/** Las hojas en las que se imprime de verdad. Nada que ver con el tamaño del dibujo. */
export type SheetId = 'a4' | 'a3' | 'oficio'

/** `original` es la foto con sus píxeles; el resto son hojas de impresión. */
export type ExportSize = 'original' | SheetId

export interface ExportState {
  size: ExportSize
  format: 'pdf' | 'jpg'
}

export interface AppState {
  grid: GridState
  effects: Effects
  paper: Paper
  export: ExportState
}
