import type { ButtonHTMLAttributes, ReactNode } from 'react'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Cómo se llama el botón. **Obligatorio**, aunque no se dibuje: un botón
   * que es solo un dibujo no tiene nombre para quien no ve el dibujo. Va al
   * `aria-label` y al `title`.
   */
  label: string
  /** Marcado, como la pestaña abierta: fondo violeta e ícono claro. */
  selected?: boolean
  /** El ícono, de `icons.tsx`. */
  children: ReactNode
}

/**
 * El botón de 48×48 que lleva un ícono y nada más. Figma: `Button`
 * (4:650), con la propiedad `Selected`.
 */
export function IconButton({
  label,
  selected = false,
  children,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      aria-pressed={selected}
      className={['ds-icon-button', selected && 'is-selected', className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}
