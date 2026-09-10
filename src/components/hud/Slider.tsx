import { useState } from 'react'

interface Props {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  format?: (value: number) => string
}

/** Diámetro del pulgar; el relleno lo descuenta para no desfasarse en los extremos. */
const THUMB = 14

/**
 * Slider con la burbuja del valor solo mientras se arrastra: el número importa al
 * final, pero mientras probás lo que mirás es el cuadro, no la cifra.
 */
export function Slider({ label, value, min, max, step, onChange, format }: Props) {
  const [active, setActive] = useState(false)
  const ratio = (value - min) / (max - min)
  const offset = 'calc(' + THUMB / 2 + 'px + (100% - ' + THUMB + 'px) * ' + ratio + ')'
  const text = format ? format(value) : String(value)

  return (
    <label className="slider">
      <span className="slider-label">
        {label}
        <em className={active ? 'is-active' : ''}>{text}</em>
      </span>
      <span className="slider-track">
        <span className="slider-fill" style={{ width: offset }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerDown={() => setActive(true)}
          onPointerUp={() => setActive(false)}
          onBlur={() => setActive(false)}
        />
        {active && (
          <span className="slider-bubble" style={{ left: offset }}>
            {text}
          </span>
        )}
      </span>
    </label>
  )
}
