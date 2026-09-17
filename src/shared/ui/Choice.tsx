export interface ChoiceOption<T extends string> {
  value: T
  label: string
  /** Una aclaración al pasar por encima. Opcional. */
  title?: string
}

export interface ChoiceGroupProps<T extends string> {
  value: T
  options: ChoiceOption<T>[]
  onChange: (value: T) => void
  /** Qué se está eligiendo. Va al grupo, para el lector de pantalla. */
  label: string
  className?: string
}

/**
 * Elegir una opción entre pocas. Figma: `Button` (22:595 / 22:596), el botón
 * chico con borde.
 *
 * Se llama `Choice` y no `Button` porque el sistema ya tiene un `Button` —el
 * de 48 px que dispara una acción— y estos dos no hacen lo mismo: este no
 * hace nada, elige. Confundirlos en el código es confundirlos en la pantalla.
 *
 * Los botones se dibujan sueltos y no adentro de una píldora: el elegido se
 * reconoce por el borde violeta y el fondo claro, no por su lugar.
 */
export function ChoiceGroup<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: ChoiceGroupProps<T>) {
  return (
    <div
      className={['ds-choice-group', className].filter(Boolean).join(' ')}
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          className={'ds-choice' + (option.value === value ? ' is-selected' : '')}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
