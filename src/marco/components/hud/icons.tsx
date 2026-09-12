const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function FrameIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <rect x="7" y="7" width="10" height="10" rx="0.5" />
      <path d="M3 3l4 4M21 3l-4 4M21 21l-4-4M3 21l4-4" />
    </svg>
  )
}

export function MatIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <rect x="8" y="8" width="8" height="8" rx="0.5" />
    </svg>
  )
}

export function GlassIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <path d="M5 16L16 5M11 19l8-8" />
    </svg>
  )
}

export function WallIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="2.5" y="4" width="19" height="16" rx="1.5" />
      <path d="M2.5 9.5h19M2.5 15h19M9 4v5.5M15 9.5V15M9 15v5" />
    </svg>
  )
}

export function ArtIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <circle cx="9" cy="9.5" r="1.6" />
      <path d="M3.5 17l5-5 4 4 3-2.5 5 4" />
    </svg>
  )
}

export function RotateIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M20 11a8 8 0 10-2.3 5.7" />
      <path d="M20 4.5V11h-6.2" />
    </svg>
  )
}

export function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M12 16V4M8 7.5L12 3.5l4 4" />
      <path d="M4 15v3.5A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5V15" />
    </svg>
  )
}

export function RulerIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="2" y="8" width="20" height="8" rx="1.3" />
      <path d="M6.5 8v3M10 8v4.5M13.5 8v3M17 8v4.5" />
    </svg>
  )
}

export function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M10 13.5a4 4 0 005.7 0l3-3a4 4 0 10-5.7-5.7L11.6 6.2" />
      <path d="M14 10.5a4 4 0 00-5.7 0l-3 3a4 4 0 105.7 5.7l1.4-1.4" />
    </svg>
  )
}

export function UnlinkIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M10.5 13a4 4 0 005.7 0l2-2a4 4 0 00-5.7-5.7l-1 1" />
      <path d="M13.5 11a4 4 0 00-5.7 0l-2 2a4 4 0 005.7 5.7l1-1" />
      <path d="M3 3l18 18" />
    </svg>
  )
}
