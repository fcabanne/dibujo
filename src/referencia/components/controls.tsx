import type { ReactNode } from 'react'

/**
 * Los controles del panel. Son propios y no los del probador de enmarcado porque
 * allá viven flotando sobre el cuadro y acá viven en una columna: mismo lenguaje
 * visual (los tokens son compartidos), distinta postura.
 */

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  format?: (value: number) => string
  disabled?: boolean
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  disabled,
}: SliderProps) {
  const ratio = max === min ? 0 : (value - min) / (max - min)
  return (
    <label className={'slider' + (disabled ? ' is-off' : '')}>
      <span className="row">
        <span>{label}</span>
        <em>{format ? format(value) : String(value)}</em>
      </span>
      <span className="track">
        <span className="fill" style={{ width: `${ratio * 100}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </span>
    </label>
  )
}

interface Option<T> {
  value: T
  label: string
  title?: string
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  label?: string
}) {
  return (
    <div className="field">
      {label && <span className="field-label">{label}</span>}
      <div className="segmented" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            title={option.title}
            className={option.value === value ? 'is-on' : ''}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  hint?: string
}) {
  return (
    <label className="toggle">
      {/* La casilla va primero y el nombre después, como en el diseño: se lee
          "está marcado — qué cosa", que es el orden en que se mira una lista. */}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="box" aria-hidden="true" />
      <span className="etiqueta">
        {label}
        {hint && <em>{hint}</em>}
      </span>
    </label>
  )
}

/** Los colores que de verdad se usan encima de una foto, más el cuentagotas para el resto. */
const COLORS = ['#ffffff', '#111111', '#ff3b30', '#00e5ff', '#ffd60a', '#ff2d95']

export function ColorRow({
  value,
  onChange,
}: {
  value: string
  onChange: (color: string) => void
}) {
  const custom = !COLORS.includes(value.toLowerCase())
  return (
    <div className="field">
      <span className="field-label">Color</span>
      <div className="colors">
        {COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={'chip' + (color === value.toLowerCase() ? ' is-on' : '')}
            style={{ background: color }}
            aria-label={color}
            aria-pressed={color === value.toLowerCase()}
            onClick={() => onChange(color)}
          />
        ))}
        <label className={'chip is-custom' + (custom ? ' is-on' : '')} title="Otro color">
          <span style={{ background: value }} />
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        </label>
      </div>
    </div>
  )
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="hint">{children}</p>
}
