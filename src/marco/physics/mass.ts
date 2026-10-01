import { layoutFromDims, type Dims } from '../domain/geometry'
import { speciesOf } from '../render/wood'
import type { AppState } from '../types'

/**
 * Cuánto pesa el cuadro, con densidades de verdad.
 *
 * El peso no decide cuánto tarda en balancearse —eso lo decide la geometría, como en
 * cualquier péndulo—, pero sí cuánto cuesta moverlo y cómo suena: un cuadro pesado se
 * asienta lento y sin rebote, y un golpe a él suena más grave. Y lo más pesado de un
 * cuadro casi nunca es la moldura: es el vidrio. Sacarlo lo alivia a la mitad.
 */

/** g/cm³ de cada madera. La especie sale del color, como la veta (`speciesOf`). */
const WOOD: Record<ReturnType<typeof speciesOf>, number> = { pine: 0.5, oak: 0.75, walnut: 0.65 }
/** Una moldura pintada suele ser de madera blanda, laqueada. */
const PAINTED = 0.7
/** Aluminio, pero hueco: un perfil de metal es una chapa doblada, no una barra. */
const METAL = 2.7 * 0.25
/** Una moldura no es maciza: tiene el rebaje y la curva del perfil. */
const FILL = 0.7
const GLASS = { density: 2.5, thickness: 0.2 }
const BOARD = { density: 0.8, thickness: 0.14 }
/** El fondo: un cartón duro o un MDF fino. */
const BACKING = { density: 0.75, thickness: 0.3 }
/** La moldura tiene el espesor de siempre (`FRAME_DEPTH`), un centímetro. */
const MOLDING_DEPTH = 1

export interface Mass {
  /** El total, en kg. */
  kg: number
}

export function massOf(state: AppState, dims: Dims): Mass {
  const layout = layoutFromDims(dims)
  const { glass, sight, outer } = layout
  const frame = Math.max(0, dims.frame)

  // La moldura: su largo por la línea media, por su ancho y su espesor.
  const centerline = 2 * (outer.w - frame + (outer.h - frame))
  const density =
    state.frame.material === 'metal' ? METAL : state.frame.material === 'painted' ? PAINTED : WOOD[speciesOf(state.frame.color)]
  const molding = centerline * frame * MOLDING_DEPTH * FILL * density

  const glassArea = glass.w * glass.h
  const pane = state.glass === 'none' ? 0 : glassArea * GLASS.thickness * GLASS.density
  const board = Math.max(0, glassArea - sight.w * sight.h) * BOARD.thickness * BOARD.density
  const back = glassArea * BACKING.thickness * BACKING.density

  return { kg: (molding + pane + board + back) / 1000 }
}
