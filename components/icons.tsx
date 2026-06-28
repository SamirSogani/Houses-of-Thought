export function ArrowIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3 8h9M8 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function LogoMark({ stroke = '#14213A' }: { stroke?: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <path d="M3 12 L13 3 L23 12" stroke={stroke} strokeWidth="1.6" fill="none" />
      <rect x="6" y="12" width="14" height="11" stroke={stroke} strokeWidth="1.6" fill="none" />
      <line x1="6" y1="16.3" x2="20" y2="16.3" stroke={stroke} strokeWidth="1.2" />
      <rect x="11" y="18.5" width="4" height="4.5" fill="#F2B021" />
    </svg>
  )
}
