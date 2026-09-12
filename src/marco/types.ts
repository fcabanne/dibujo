/** Todo lo dimensional de la app vive en centímetros. El render convierte a px al final. */

export type FrameMaterial = 'wood' | 'metal' | 'painted'
export type FrameFinish = 'matte' | 'satin' | 'gloss' | 'grained'
/** Forma de la sección de la moldura. */
export type FrameProfile = 'flat' | 'bevel' | 'scoop' | 'round' | 'step'
export type GlassType = 'clear' | 'antireflective' | 'matte' | 'none'
export type WallPattern = 'plain' | 'plaster' | 'stucco' | 'linen'
export type Rotation = 0 | 90 | 180 | 270

export interface Size {
  w: number
  h: number
}

/** Rectángulo centrado en el origen, en cm. */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface FrameState {
  /** Ancho de la moldura vista de frente. 0 = sin marco (vidrio con ganchitos). */
  width: number
  /** Profundidad de la moldura. Gobierna la sombra proyectada. */
  depth: number
  color: string
  material: FrameMaterial
  finish: FrameFinish
  profile: FrameProfile
}

export interface MatState {
  enabled: boolean
  width: number
  color: string
}

export interface WallState {
  color: string
  pattern: WallPattern
}

export interface ArtworkState {
  /** Data URI. Siempre presente: al arrancar es el placeholder. */
  src: string
  /** Nombre de la obra. Se muestra en la cartela de la pared. */
  title: string
  /** Tamaño real de la obra física. Es la base de escala de todo. */
  size: Size
  /** Rota el cuadro entero: en 90/270 se intercambian ancho y alto. */
  rotation: Rotation
  /** false hasta que el usuario declara el tamaño real. */
  sizeConfirmed: boolean
  /** Con la proporción trabada, editar un lado ajusta el otro. */
  lockRatio: boolean
}

export interface AppState {
  artwork: ArtworkState
  frame: FrameState
  /** Array desde ya: la Fase 2 suma passe-partout multinivel sin refactor. */
  mats: MatState[]
  glass: GlassType
  wall: WallState
  /** Reservado para la Fase 2. */
  snapshots: Snapshot[]
}

export interface Snapshot {
  id: string
  createdAt: number
  thumbnail: string
  state: Omit<AppState, 'snapshots'>
}

/** Geometría resuelta, en cm, lista para escalar a px. */
export interface Layout {
  /** Tamaño de la obra con la rotación ya aplicada. */
  art: Size
  /** Luz: lo que se ve de la obra (el passe-partout pisa el borde). */
  sight: Size
  /** Vidrio = passe-partout exterior. */
  glass: Size
  /** Medida exterior del marco: lo que se cuelga. */
  outer: Size
  diagonal: number
  depth: number
}
