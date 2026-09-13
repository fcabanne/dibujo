const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** Una foto: marco, sol y horizonte. */
export function PhotoIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="M3 16.5l4.5-4 4 3.5 3.5-3L21 17" />
    </svg>
  )
}

/** Una hoja con sus cotas: el tamaño del dibujo. */
export function SizeIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <rect x="6" y="3.5" width="12" height="17" rx="1.5" />
      <path d="M3 5v2.5M3 5h1.6M3 5H1.4M3 19v-2.5M3 19h1.6M3 19H1.4M3 7.5v9" />
    </svg>
  )
}

/** La grilla. */
export function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" />
      <path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17" />
    </svg>
  )
}

/** Perillas: los ajustes de la foto. */
export function TuneIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <path d="M4 7h9M17.5 7H20M4 17h3.5M12 17h8" />
      <circle cx="15.2" cy="7" r="2.3" />
      <circle cx="9.7" cy="17" r="2.3" />
    </svg>
  )
}

/** Bajar: la flecha hacia la bandeja. */
export function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <path d="M12 3.5v11M12 14.5l4-4M12 14.5l-4-4M4.5 16v2.5a2 2 0 002 2h11a2 2 0 002-2V16" />
    </svg>
  )
}

export function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}
