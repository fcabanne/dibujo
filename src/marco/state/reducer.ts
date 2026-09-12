import type {
  AppState,
  ArtworkState,
  FrameState,
  GlassType,
  MatState,
  Rotation,
  WallState,
} from '../types'
import { DEFAULT_STATE } from './defaults'

export type Action =
  | { type: 'frame/patch'; patch: Partial<FrameState> }
  | { type: 'mat/patch'; patch: Partial<MatState> }
  | { type: 'glass/set'; value: GlassType }
  | { type: 'wall/patch'; patch: Partial<WallState> }
  | { type: 'artwork/patch'; patch: Partial<ArtworkState> }
  | { type: 'artwork/resize'; side: 'w' | 'h'; value: number }
  | { type: 'artwork/replace'; src: string; aspect: number }
  | { type: 'artwork/rotate' }
  | { type: 'artwork/restore'; src: string }
  | { type: 'state/replace'; state: AppState }

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'frame/patch': {
      const frame = { ...state.frame, ...action.patch }

      // Elegir una moldura con el marco en cero lo trae de vuelta. Sin esto tocás
      // un color y no pasa nada, porque no hay marco donde aplicarlo: es el segundo
      // camino de regreso, además de arrastrar la banda fantasma.
      const choosingMolding =
        action.patch.color !== undefined ||
        action.patch.material !== undefined ||
        action.patch.finish !== undefined

      if (state.frame.width === 0 && action.patch.width === undefined && choosingMolding) {
        frame.width = DEFAULT_STATE.frame.width
      }

      return { ...state, frame }
    }

    case 'mat/patch': {
      const [first, ...rest] = state.mats
      return { ...state, mats: [{ ...first, ...action.patch }, ...rest] }
    }

    case 'glass/set':
      return { ...state, glass: action.value }

    case 'wall/patch':
      return { ...state, wall: { ...state.wall, ...action.patch } }

    case 'artwork/patch':
      return { ...state, artwork: { ...state.artwork, ...action.patch } }

    case 'artwork/resize': {
      const { size, rotation, lockRatio } = state.artwork
      // Los campos muestran la medida tal como cuelga, así que con el cuadro girado
      // el lado que tocó el usuario es el contrario en la obra sin rotar.
      const rotated = rotation === 90 || rotation === 270
      const axis: 'w' | 'h' = rotated ? (action.side === 'w' ? 'h' : 'w') : action.side
      const other: 'w' | 'h' = axis === 'w' ? 'h' : 'w'

      const next = { ...size, [axis]: action.value }

      // Con la proporción trabada el otro lado acompaña, que es lo que espera
      // cualquiera que esté escribiendo la medida de un dibujo que ya existe.
      if (lockRatio && size[axis] > 0) {
        const ratio = size[other] / size[axis]
        next[other] = Math.round(action.value * ratio * 10) / 10
      }

      return { ...state, artwork: { ...state.artwork, size: next, sizeConfirmed: true } }
    }

    case 'artwork/replace': {
      // Al cargar una obra nueva conservamos el lado mayor declarado y derivamos el
      // otro de la proporción real: el usuario ajusta una sola medida, no dos.
      const { w, h } = state.artwork.size
      const longest = Math.max(w, h)
      const size =
        action.aspect >= 1
          ? { w: longest, h: Math.round((longest / action.aspect) * 10) / 10 }
          : { w: Math.round(longest * action.aspect * 10) / 10, h: longest }

      return {
        ...state,
        artwork: {
          ...state.artwork,
          src: action.src,
          size,
          rotation: 0,
          sizeConfirmed: false,
        },
      }
    }

    case 'artwork/restore':
      // Llega cuando termina de leerse la obra guardada, un instante después de
      // abrir. Si en ese ratito ya cargaste otra, no la pisa.
      return state.artwork.src === DEFAULT_STATE.artwork.src
        ? { ...state, artwork: { ...state.artwork, src: action.src } }
        : state

    case 'artwork/rotate': {
      const next = ((state.artwork.rotation + 90) % 360) as Rotation
      return { ...state, artwork: { ...state.artwork, rotation: next } }
    }

    case 'state/replace':
      return action.state
  }
}
