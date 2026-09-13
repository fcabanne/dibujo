import type {
  AppState,
  Effects,
  EffectsMode,
  ExportState,
  GridState,
  GridStyle,
  Paper,
} from '../types'
import { EFFECT_MODES } from './defaults'

export type Action =
  | { type: 'grid/patch'; patch: Partial<GridState> }
  | { type: 'grid/style'; patch: Partial<GridStyle> }
  | { type: 'effects/patch'; patch: Partial<Effects> }
  | { type: 'effects/mode'; mode: EffectsMode }
  | { type: 'paper/patch'; patch: Partial<Paper> }
  | { type: 'export/patch'; patch: Partial<ExportState> }

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'grid/patch':
      return { ...state, grid: { ...state.grid, ...action.patch } }
    case 'grid/style':
      return { ...state, grid: { ...state.grid, style: { ...state.grid.style, ...action.patch } } }
    case 'effects/patch':
      return { ...state, effects: { ...state.effects, ...action.patch } }
    // Cambiar de modo reescribe todo salvo el blanco y negro, que es aparte.
    case 'effects/mode':
      return {
        ...state,
        effects: {
          mode: action.mode,
          bw: state.effects.bw,
          ...EFFECT_MODES[action.mode],
        },
      }
    case 'paper/patch':
      return { ...state, paper: { ...state.paper, ...action.patch } }
    case 'export/patch':
      return { ...state, export: { ...state.export, ...action.patch } }
  }
}
