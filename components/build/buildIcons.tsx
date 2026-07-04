// Build-only inline SVGs not already in components/icons.tsx. See handoff 01 §5.
// stroke-width 1.3-1.7, aria-hidden unless meaningful. 16px unless noted.

export function SparkIcon({ size = 16, fill = '#F2B021' }: { size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2l1.4 3.5L13 7l-3.6 1.5L8 12l-1.4-3.5L3 7l3.6-1.5z" fill={fill} />
    </svg>
  )
}

export function PlusIcon({ size = 16, stroke = 'currentColor' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 3.5v9M3.5 8h9" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function ChevronRight({ size = 16, stroke = 'currentColor' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6 4l4 4-4 4" stroke={stroke} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ChevronLeft({ size = 16, stroke = 'currentColor' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M10 4l-4 4 4 4" stroke={stroke} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function LongArrow({ size = 16, stroke = 'currentColor' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8h9M8 4l4 4-4 4" stroke={stroke} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function UploadIcon({ size = 16, stroke = 'currentColor' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 11V3M5 6l3-3 3 3" stroke={stroke} strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12.5h10" stroke={stroke} strokeWidth="1.7" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function SearchIcon({ size = 16, stroke = 'currentColor' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="7" cy="7" r="5" stroke={stroke} strokeWidth="1.5" fill="none" />
      <path d="M10.5 10.5L14 14" stroke={stroke} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function EyeIcon({ size = 20, stroke = '#2C3A57' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10z" stroke={stroke} strokeWidth="1.5" fill="none" />
      <circle cx="10" cy="10" r="2.4" stroke={stroke} strokeWidth="1.5" fill="none" />
    </svg>
  )
}

export function WarningIcon({ size = 20, stroke = '#C2682B' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="9" stroke={stroke} strokeWidth="1.4" fill="none" />
      <path d="M10 6v5" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="13.5" r="0.9" fill={stroke} />
    </svg>
  )
}

export function LinkChainIcon({ size = 16, stroke = 'var(--blueprint)' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6.5 9.5a2.4 2.4 0 003.4 0l2-2a2.4 2.4 0 00-3.4-3.4l-1 1" stroke={stroke} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M9.5 6.5a2.4 2.4 0 00-3.4 0l-2 2a2.4 2.4 0 003.4 3.4l1-1" stroke={stroke} strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  )
}
