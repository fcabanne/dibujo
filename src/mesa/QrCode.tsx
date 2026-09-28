import { useMemo } from 'react'
import { makeQr } from '../shared/qr'

/** Módulos de margen blanco alrededor: lo que pide el estándar para que se lea. */
const QUIET = 4

/**
 * Un QR dibujado en SVG: un solo trazo con todos los módulos oscuros, sobre blanco. Va
 * en blanco y negro puros y no en los colores del sistema —un lector necesita contraste,
 * no estilo—; el blanco y el negro sí salen de los tokens.
 */
export function QrCode({ value, label }: { value: string; label: string }) {
  const modules = useMemo(() => makeQr(value), [value])
  const size = modules.length + QUIET * 2

  const path = useMemo(() => {
    let d = ''
    modules.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x + QUIET} ${y + QUIET}h1v1h-1z`
      }),
    )
    return d
  }, [modules])

  return (
    <svg
      className="qr"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="var(--ds-white)" />
      <path d={path} fill="var(--ds-black)" />
    </svg>
  )
}
