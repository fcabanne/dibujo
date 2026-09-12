import { useRef } from 'react'

interface Props {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  format: (value: number) => string
  radius: number
  centerDeg: number
  spanDeg: number
}

const TRACK = 9

/**
 * Slider curvo que cierra el abanico siguiendo el mismo arco que las opciones.
 *
 * Un slider recto colgando de un menú radial rompe el lenguaje: es el único
 * elemento que no sigue la geometría. Acá el riel es el arco siguiente al de la
 * última fila, y el valor se lee del ángulo del puntero respecto del centro.
 */
export function ArcSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  radius,
  centerDeg,
  spanDeg,
}: Props) {
  const ref = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)

  const span = (spanDeg * Math.PI) / 180
  const center = (centerDeg * Math.PI) / 180
  const from = center - span / 2
  const to = center + span / 2

  const ratio = (value - min) / (max - min)
  const angle = from + span * ratio

  const size = (radius + TRACK) * 2
  const c = size / 2
  const at = (a: number, r: number) => ({ x: c + Math.cos(a) * r, y: c + Math.sin(a) * r })

  const p0 = at(from, radius)
  const p1 = at(to, radius)
  const pv = at(angle, radius)
  const knob = at(angle, radius)

  // El arco nunca supera media vuelta, así que el flag de arco mayor va siempre en 0.
  const arcTo = (p: { x: number; y: number }) =>
    `A ${radius} ${radius} 0 0 1 ${p.x.toFixed(2)} ${p.y.toFixed(2)}`

  const update = (clientX: number, clientY: number) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    const dx = clientX - (box.left + box.width / 2)
    const dy = clientY - (box.top + box.height / 2)

    // Ángulo desenrollado alrededor del centro del arco: sin esto, cruzar el eje
    // de 180° haría saltar el valor de un extremo al otro.
    let a = Math.atan2(dy, dx)
    while (a - center > Math.PI) a -= Math.PI * 2
    while (center - a > Math.PI) a += Math.PI * 2

    const t = Math.min(1, Math.max(0, (a - from) / span))
    const raw = min + t * (max - min)
    onChange(Math.round(raw / step) * step)
  }

  return (
    <div className="arc-slider" style={{ width: size, height: size, marginLeft: -c, marginTop: -c }}>
      <svg
        ref={ref}
        width={size}
        height={size}
        onPointerDown={(e) => {
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          update(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => {
          if (dragging.current) update(e.clientX, e.clientY)
        }}
        onPointerUp={(e) => {
          dragging.current = false
          e.currentTarget.releasePointerCapture(e.pointerId)
        }}
      >
        <path
          d={`M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} ${arcTo(p1)}`}
          className="arc-track"
          strokeWidth={TRACK}
        />
        <path
          d={`M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} ${arcTo(pv)}`}
          className="arc-fill"
          strokeWidth={TRACK}
        />
        <circle cx={knob.x} cy={knob.y} r={9} className="arc-knob" />
      </svg>

      <span
        className="arc-value"
        style={{ left: knob.x, top: knob.y }}
        aria-hidden
      >
        {format(value)}
      </span>

      <input
        type="range"
        className="arc-input"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}
