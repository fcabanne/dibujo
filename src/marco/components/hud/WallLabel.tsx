import { buildMeasurements } from '../../domain/measurements'
import type { AppState, Layout } from '../../types'

interface Props {
  state: AppState
  layout: Layout
  /** Brillo de la pared ya renderizada bajo la cartela, 0..1. */
  wallLuma: number
}

/**
 * Cartela de museo, pintada sobre la pared al costado del cuadro.
 *
 * Las medidas no viven en un panel de app: son parte de la escena, como la ficha
 * que acompaña a una obra colgada. El color del texto sale del brillo real del
 * muro en ese punto, no del color elegido — ahí cae la penumbra del foco, así que
 * una pared blanco roto puede terminar siendo oscura justo debajo del texto.
 */
export function WallLabel({ state, layout, wallLuma }: Props) {
  const rows = buildMeasurements(state, layout)

  return (
    <div className={'wall-label' + (wallLuma < 0.45 ? ' on-dark' : '')}>
      <h2>{state.artwork.title || 'Sin título'}</h2>
      <dl>
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
