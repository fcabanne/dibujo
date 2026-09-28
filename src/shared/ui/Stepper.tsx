import { useRef } from 'react'
import { MinusIcon, PlusIcon } from './icons'

export interface StepperProps {
  /** Cómo se llama. Va al lector de pantalla; el nombre dibujado está en la fila. */
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  /** Cómo se llaman los dos botones. Sin esto son dos dibujos sin nombre. */
  decrementLabel: string
  incrementLabel: string
}

/**
 * El stepper del sistema. Figma: `Stepper` (22:296).
 *
 * Para los números chicos y contados, donde un slider pide puntería para algo
 * que se elige de a uno: "seis divisiones" es una decisión, no un punto que se
 * busca arrastrando. En los extremos el botón que no lleva a ningún lado queda
 * apagado en vez de desaparecer, para que la píldora no cambie de forma.
 */
export function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  decrementLabel,
  incrementLabel,
}: StepperProps) {
  // Hacia dónde se movió el número la última vez que cambió: decide si el
  // nuevo entra rodando desde abajo o desde arriba. Se guarda junto al valor
  // y no se recalcula en cada render, así un render que no cambia el número
  // —cualquier otra perilla del panel— no le corta la animación a la mitad.
  // En el primer render no hay dirección y el número aparece quieto.
  const previous = useRef(value)
  const direction = useRef('')
  if (value !== previous.current) {
    direction.current = value > previous.current ? 'is-up' : 'is-down'
    previous.current = value
  }

  return (
    <div className="ds-stepper" role="group" aria-label={label}>
      <button
        type="button"
        title={decrementLabel}
        aria-label={decrementLabel}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        <MinusIcon />
      </button>
      {/* `aria-live` para que al tocar ± el lector de pantalla cante el número
          nuevo: el foco se queda en el botón y sin esto el cambio pasa mudo. */}
      <span className="ds-stepper-value" aria-live="polite">
        {/* `key` para que cada número sea un elemento nuevo y su animación de
            entrada corra de nuevo. */}
        <span key={value} className={'ds-stepper-digit ' + direction.current}>
          {value}
        </span>
      </span>
      <button
        type="button"
        title={incrementLabel}
        aria-label={incrementLabel}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
      >
        <PlusIcon />
      </button>
    </div>
  )
}
