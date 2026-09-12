import { useEffect, useState, type ReactNode } from 'react'

interface Props {
  open: boolean
  /** Cada fila es un grupo con sentido propio: colores, formas, acabados. */
  rows: ReactNode[][]
  /** 180 abre el arco hacia la izquierda del botón; 0, hacia la derecha. */
  centerDeg: number
  /** Separación entre opciones. Las que llevan etiqueta necesitan más aire. */
  spacing?: number
  /** Control de arco, en el radio interno: queda entre el cuadro y las opciones. */
  arc?: (radius: number, centerDeg: number, span: number) => ReactNode
}

/** Radio del arco interno, donde vive el slider. */
const ARC_RADIUS = 96
const FIRST_ROW = 150
/** Suficiente para el swatch más su etiqueta: con menos, las filas se tocan. */
const ROW_GAP = 74
/** Barrido amplio: las filas quedan como columnas curvas al costado del cuadro. */
const SPAN_DEG = 150

/**
 * Opciones repartidas en arcos concéntricos al costado del botón que las abrió.
 *
 * Cada fila es un grupo semántico con su propio arco, de adentro hacia afuera y de
 * lo elemental a lo específico. Los arcos son siempre los mismos y se abren siempre
 * en horizontal —a la izquierda o a la derecha, según de qué lado del cuadro esté
 * la burbuja—, así que el menú cae donde uno lo espera en lugar de reacomodarse.
 */
export function RadialMenu({ open, rows, centerDeg, spacing = 62, arc }: Props) {
  /**
   * Las opciones se montan recién al abrir, así que su posición final ya es la
   * primera que el navegador conoce y no habría desde dónde animar. Este paso
   * intermedio las pinta un frame en el centro del icono para que la transición
   * tenga de dónde salir.
   */
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (!open) {
      setEntered(false)
      return
    }
    // Con temporizador y no con requestAnimationFrame: en una pestaña que no está
    // pintando el rAF queda suspendido, y las opciones se quedarían invisibles en
    // vez de simplemente abrirse sin animación.
    const id = window.setTimeout(() => setEntered(true), 16)
    return () => window.clearTimeout(id)
  }, [open])

  const maxSpan = (SPAN_DEG * Math.PI) / 180

  // Un único paso angular para todas las filas, dictado por la más poblada. Con un
  // paso por fila los arcos quedaban de largos distintos y el conjunto se leía
  // desordenado; compartiéndolo, las opciones se alinean radialmente.
  const longest = Math.max(1, ...rows.map((r) => r.length))
  const step = longest > 1 ? Math.min(spacing / FIRST_ROW, maxSpan / (longest - 1)) : 0

  let index = 0
  const placed: { node: ReactNode; x: number; y: number; order: number }[] = []

  rows.forEach((items, row) => {
    if (items.length === 0) return
    const radius = FIRST_ROW + row * ROW_GAP
    const start = (centerDeg * Math.PI) / 180 - (step * (items.length - 1)) / 2

    items.forEach((node, i) => {
      const angle = start + step * i
      placed.push({
        node,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        // Entrada corrida a lo largo del arco, en un solo sentido: nada de rebotes.
        order: index++,
      })
    })
  })

  const out = open && entered

  return (
    <div className={open ? 'radial is-open' : 'radial'} aria-hidden={!open}>
      {open && arc?.(ARC_RADIUS, centerDeg, SPAN_DEG)}
      {placed.map((p, i) => (
        <div
          key={i}
          className="radial-item"
          style={{
            transform: out
              ? 'translate(-50%, -50%) translate(' + p.x + 'px, ' + p.y + 'px) scale(1)'
              : 'translate(-50%, -50%) scale(0.5)',
            opacity: out ? 1 : 0,
            transitionDelay: (out ? p.order : 0) * 9 + 'ms',
          }}
        >
          {p.node}
        </div>
      ))}
    </div>
  )
}

/** Extensión del abanico, para dimensionar la zona de hover que lo mantiene abierto. */
export function fanReach(rowCount: number): number {
  return FIRST_ROW + Math.max(0, rowCount - 1) * ROW_GAP + 60
}
