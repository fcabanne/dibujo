import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * Los tres tipos del botón, con los nombres del componente de Figma
 * (`Button`, 18:136) en minúscula.
 *
 * - `loud`: la acción principal. Fondo violeta, texto claro.
 * - `quiet`: la secundaria. Fondo claro, texto violeta.
 * - `transparent`: la terciaria. Sin fondo.
 */
export type ButtonVariant = 'loud' | 'quiet' | 'transparent'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** Ícono a la izquierda del texto. */
  icon?: ReactNode
  /** Ícono a la derecha. El componente de Figma tiene las dos ranuras. */
  iconRight?: ReactNode
  children?: ReactNode
}

export function Button({
  variant = 'loud',
  icon,
  iconRight,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={['ds-button', `ds-button--${variant}`, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {icon}
      {children != null && <span className="ds-button-label">{children}</span>}
      {iconRight}
    </button>
  )
}
