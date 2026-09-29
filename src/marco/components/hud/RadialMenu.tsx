import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { CHIP, chipOffset, SLIDER_RADIUS, SLIDER_SPAN, type FanLayout, type Point } from './fan'

export interface FanItem {
  node: ReactNode
  /** El nombre, que se lee sobre la muestra en la que está el puntero. */
  label: string
}

interface Props {
  /** Abierto o cerrándose: las muestras siguen montadas mientras vuelven a la burbuja. */
  open: boolean
  rows: FanItem[][]
  layout: FanLayout
  /** Hacia dónde se abre, en grados: 0 es a la derecha y 180, a la izquierda. */
  centerDeg: number
  /** Dónde está la burbuja en pantalla: decide de qué lado sale la etiqueta. */
  origin: Point
  /** Control de arco, en el radio interno: queda entre la burbuja y las muestras. */
  arc?: (radius: number, centerDeg: number, span: number) => ReactNode
}

/** Lo que tardan las muestras en llegar a su lugar: hasta ahí no atienden al puntero. */
const ARM_MS = 300

/**
 * Opciones repartidas en arcos concéntricos a partir de la burbuja que las abrió.
 *
 * Cada fila es un grupo con sentido propio, de adentro hacia afuera. El reparto sale
 * de `fan.ts` —mismo paso en píxeles en todos los arcos— y el ángulo lo elige quien
 * lo monta, así que el menú cae del lado que tiene lugar y no tapa el cuadro.
 *
 * No hay una etiqueta bajo cada muestra: con doce nombres a la vez se pisaban entre
 * sí. Se lee uno solo, sobre la muestra en la que está el puntero.
 */
export function RadialMenu({ open, rows, layout, centerDeg, origin, arc }: Props) {
  /**
   * Las opciones se montan recién al abrir, así que su posición final ya es la primera
   * que el navegador conoce y no habría desde dónde animar. Este paso intermedio las
   * pinta un instante en el centro de la burbuja para que la transición tenga de dónde
   * salir. Con temporizador y no con requestAnimationFrame: en una pestaña que no está
   * pintando el rAF queda suspendido y las opciones se quedarían invisibles.
   */
  const [entered, setEntered] = useState(false)
  /**
   * Las muestras nacen en el centro de la burbuja, o sea debajo del puntero: si
   * atendieran el puntero desde el primer cuadro, la que cayera encima se quedaría
   * como "hover" —con su etiqueta y su vista previa— hasta que el mouse se moviera.
   * Se arman recién cuando terminaron de desplegarse.
   */
  const [armed, setArmed] = useState(false)
  const [hot, setHot] = useState<{ row: number; i: number } | null>(null)

  useEffect(() => {
    if (!open) {
      setEntered(false)
      setArmed(false)
      setHot(null)
      return
    }
    const id = window.setTimeout(() => setEntered(true), 16)
    const arm = window.setTimeout(() => setArmed(true), ARM_MS)
    return () => {
      window.clearTimeout(id)
      window.clearTimeout(arm)
    }
  }, [open])

  const center = (centerDeg * Math.PI) / 180
  const out = open && entered
  let order = 0

  const hotItem = hot ? rows[hot.row]?.[hot.i] : null
  const hotAt = hot ? chipOffset(layout, hot.row, hot.i, center) : null
  // Cerca del borde de arriba la etiqueta se pasa abajo: si no, quedaría fuera de la pantalla.
  const below = hotAt ? origin.y + hotAt.y < CHIP + 24 : false

  return (
    <div className={'radial' + (open ? ' is-open' : '') + (armed ? ' is-armed' : '')} aria-hidden={!open}>
      {arc && layout.slider && (
        <div className={'radial-arc' + (out ? ' is-out' : '')}>
          {arc(SLIDER_RADIUS, centerDeg, SLIDER_SPAN)}
        </div>
      )}

      {rows.map((row, r) =>
        row.map((item, i) => {
          const at = chipOffset(layout, r, i, center)
          return (
            <div
              key={r + '-' + i}
              className={'radial-item' + (out ? ' is-out' : '')}
              style={
                {
                  '--x': at.x + 'px',
                  '--y': at.y + 'px',
                  '--i': order++,
                } as CSSProperties
              }
              onPointerEnter={() => setHot({ row: r, i })}
              onPointerLeave={() => setHot((h) => (h && h.row === r && h.i === i ? null : h))}
            >
              {item.node}
            </div>
          )
        }),
      )}

      {out && hotItem && hotAt && (
        <span
          key={hot!.row + '-' + hot!.i}
          className={'radial-label' + (below ? ' is-below' : '')}
          style={{ left: hotAt.x, top: hotAt.y }}
          aria-hidden
        >
          {hotItem.label}
        </span>
      )}
    </div>
  )
}
